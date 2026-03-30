"""
Hotel OS — Tous les routeurs API V1
Fichier unique regroupant : users, rooms, tasks, interventions,
rounds, messages, qr, reviews, equipment, stock, dashboard
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel
import secrets

from .database import get_db
from . import models
from . import schemas
from .auth import get_current_user, hash_password, verify_password, create_token, require_roles
from .notifications import notify, notify_role

# ── Users / Auth ──────────────────────────────────────────────────────────────

auth_router = APIRouter(prefix="/auth", tags=["Auth"])

@auth_router.post("/register", response_model=schemas.UserOut, status_code=201)
def register(data: schemas.UserCreate, db: Session = Depends(get_db),
             _: models.User = Depends(require_roles("direction","responsable"))):
    if db.query(models.User).filter(models.User.email == data.email).first():
        raise HTTPException(400, "Email déjà utilisé")
    user = models.User(
        name=data.name, email=data.email,
        password_hash=hash_password(data.password),
        role=data.role, service=data.service
    )
    db.add(user); db.commit(); db.refresh(user)
    return user

@auth_router.post("/login", response_model=schemas.TokenResponse)
def login(data: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == data.email).first()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(401, "Identifiants incorrects")
    if not user.is_active:
        raise HTTPException(403, "Compte désactivé")
    from .auth import create_access_token, create_refresh_token
    access = create_access_token(user.id, user.role, user.hotel_id)
    return {"access_token": access, "token_type": "bearer", "user": user}

@auth_router.post("/switch-hotel")
def switch_hotel(hotel_id: int, db: Session = Depends(get_db), me: models.User = Depends(get_current_user)):
    h = db.query(models.Hotel).filter(models.Hotel.id == hotel_id, models.Hotel.is_active == True).first()
    if not h: raise HTTPException(404, "Hôtel introuvable")
    if me.role != "direction" and me.hotel_id != hotel_id: raise HTTPException(403, "Réservé direction")
    from .auth import create_access_token
    return {"access_token": create_access_token(me.id, me.role, hotel_id), "hotel": {"id": h.id, "name": h.name, "code": h.code}}

@auth_router.get("/me", response_model=schemas.UserOut)
def me(current_user: models.User = Depends(get_current_user)):
    return current_user

class MeUpdate(BaseModel):
    name: Optional[str] = None
    service: Optional[str] = None
    password: Optional[str] = None

@auth_router.patch("/me", response_model=schemas.UserOut)
def update_me(data: MeUpdate, db: Session = Depends(get_db),
              current_user: models.User = Depends(get_current_user)):
    if data.name: current_user.name = data.name
    if data.service: current_user.service = data.service
    if data.password:
        if len(data.password) < 6: raise HTTPException(400, "Mot de passe trop court (6 caractères min)")
        current_user.password_hash = hash_password(data.password)
    db.commit(); db.refresh(current_user)
    return current_user


users_router = APIRouter(prefix="/users", tags=["Users"])

@users_router.get("", response_model=List[schemas.UserOut])
def list_users(include_inactive: bool = False, db: Session = Depends(get_db),
               current_user: models.User = Depends(require_roles("responsable","responsable_technique","direction"))):
    q = db.query(models.User)
    if not include_inactive:
        q = q.filter(models.User.is_active == True)
    return q.order_by(models.User.name).all()

@users_router.patch("/{user_id}/deactivate")
def deactivate_user(user_id: int, db: Session = Depends(get_db),
                    current_user: models.User = Depends(require_roles("direction","responsable"))):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user: raise HTTPException(404, "Utilisateur introuvable")
    if user.id == current_user.id: raise HTTPException(400, "Impossible de se désactiver soi-même")
    user.is_active = False
    db.commit()
    return {"message": "Utilisateur désactivé"}

@users_router.patch("/{user_id}/activate")
def activate_user(user_id: int, db: Session = Depends(get_db),
                  current_user: models.User = Depends(require_roles("direction","responsable"))):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user: raise HTTPException(404, "Utilisateur introuvable")
    user.is_active = True
    db.commit()
    return {"message": "Utilisateur activé"}

class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    service: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None

@users_router.patch("/{user_id}", response_model=schemas.UserOut)
def update_user(user_id: int, data: UserUpdate, db: Session = Depends(get_db),
                current_user: models.User = Depends(require_roles("direction","responsable"))):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user: raise HTTPException(404, "Utilisateur introuvable")
    if data.name: user.name = data.name
    if data.role: user.role = data.role
    if data.service is not None: user.service = data.service
    if data.is_active is not None:
        if data.is_active == False and user.id == current_user.id:
            raise HTTPException(400, "Impossible de se désactiver soi-même")
        user.is_active = data.is_active
    if data.password:
        if len(data.password) < 6: raise HTTPException(400, "Mot de passe trop court (6 caractères min)")
        user.password_hash = hash_password(data.password)
    db.commit(); db.refresh(user)
    return user

@users_router.delete("/{user_id}", status_code=204)
def delete_user(user_id: int, db: Session = Depends(get_db),
                current_user: models.User = Depends(require_roles("direction"))):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user: raise HTTPException(404, "Utilisateur introuvable")
    if user.id == current_user.id: raise HTTPException(400, "Impossible de supprimer son propre compte")
    db.delete(user); db.commit()


# ── Rooms ─────────────────────────────────────────────────────────────────────

rooms_router = APIRouter(prefix="/rooms", tags=["Chambres"])

@rooms_router.get("", response_model=List[schemas.RoomOut])
def list_rooms(floor: Optional[int] = None, status: Optional[str] = None,
               db: Session = Depends(get_db),
               current_user: models.User = Depends(get_current_user)):
    active_hotel = getattr(current_user, "_active_hotel_id", None) or current_user.hotel_id
    q = db.query(models.Room)
    if active_hotel: q = q.filter(models.Room.hotel_id == active_hotel)
    if floor:  q = q.filter(models.Room.floor == floor)
    if status: q = q.filter(models.Room.status == status)
    return q.order_by(models.Room.number).all()

@rooms_router.post("", response_model=schemas.RoomOut, status_code=201)
def create_room(data: schemas.RoomCreate, db: Session = Depends(get_db),
                current_user: models.User = Depends(require_roles("responsable","responsable_technique","direction"))):
    active_hotel = getattr(current_user, "_active_hotel_id", None) or current_user.hotel_id
    if db.query(models.Room).filter(models.Room.number == data.number, models.Room.hotel_id == active_hotel).first():
        raise HTTPException(400, "Numéro de chambre déjà existant pour cet hôtel")
    token = secrets.token_urlsafe(32)
    room = models.Room(**data.model_dump(), qr_token=token, hotel_id=active_hotel)
    db.add(room); db.commit(); db.refresh(room)
    return room

@rooms_router.get("/{room_id}", response_model=schemas.RoomOut)
def get_room(room_id: int, db: Session = Depends(get_db),
             _: models.User = Depends(get_current_user)):
    room = db.query(models.Room).filter(models.Room.id == room_id).first()
    if not room: raise HTTPException(404, "Chambre introuvable")
    return room

@rooms_router.patch("/{room_id}", response_model=schemas.RoomOut)
def update_room(room_id: int, data: schemas.RoomUpdate, db: Session = Depends(get_db),
                current_user: models.User = Depends(get_current_user)):
    room = db.query(models.Room).filter(models.Room.id == room_id).first()
    if not room: raise HTTPException(404, "Chambre introuvable")
    active_hotel = getattr(current_user, "_active_hotel_id", None) or current_user.hotel_id
    old_status = room.status

    data_dict = data.model_dump(exclude_none=True)
    for k, v in data_dict.items():
        setattr(room, k, v)

    if data.status == "prete":
        room.last_cleaned = datetime.now(timezone.utc)
    if data.status == "bloquee" and old_status != "bloquee" and current_user.role not in ("reception", "direction"):
        notify_role(db, "reception", hotel_id=active_hotel,
                    type="room_block_request", title="Demande blocage ch. " + room.number,
                    message=current_user.name + " demande le blocage de la chambre " + room.number,
                    entity_type="room", entity_id=room.id, priority="high",
                    exclude_user_id=current_user.id)
    db.commit(); db.refresh(room)
    return room

@rooms_router.get("/{room_id}/qr-token")
def get_qr_token(room_id: int, db: Session = Depends(get_db),
                 _: models.User = Depends(get_current_user)):
    room = db.query(models.Room).filter(models.Room.id == room_id).first()
    if not room: raise HTTPException(404, "Chambre introuvable")
    return {"room_number": room.number, "token": room.qr_token}

@rooms_router.delete("/{room_id}", status_code=204)
def delete_room(room_id: int, db: Session = Depends(get_db),
                current_user: models.User = Depends(require_roles("responsable","responsable_technique","direction"))):
    active_hotel = getattr(current_user, "_active_hotel_id", None) or current_user.hotel_id
    room = db.query(models.Room).filter(models.Room.id == room_id).first()
    if not room: raise HTTPException(404, "Chambre introuvable")
    if active_hotel and room.hotel_id and room.hotel_id != active_hotel:
        raise HTTPException(403, "Accès refusé — chambre d'un autre hôtel")
    db.delete(room); db.commit()


# ── Tasks ─────────────────────────────────────────────────────────────────────

tasks_router = APIRouter(prefix="/tasks", tags=["Tâches"])

@tasks_router.get("", response_model=List[schemas.TaskOut])
def list_tasks(status: Optional[str] = None, priority: Optional[str] = None,
               assigned_to_id: Optional[int] = None, service: Optional[str] = None,
               db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    active_hotel = getattr(current_user, "_active_hotel_id", None) or current_user.hotel_id
    q = db.query(models.Task)
    if active_hotel:     q = q.filter(models.Task.hotel_id == active_hotel)
    if status:           q = q.filter(models.Task.status == status)
    if priority:         q = q.filter(models.Task.priority == priority)
    if assigned_to_id:   q = q.filter(models.Task.assigned_to_id == assigned_to_id)
    if service:          q = q.filter(models.Task.service == service)
    return q.order_by(models.Task.created_at.desc()).all()

@tasks_router.post("", response_model=schemas.TaskOut, status_code=201)
def create_task(data: schemas.TaskCreate, db: Session = Depends(get_db),
                current_user: models.User = Depends(get_current_user)):
    active_hotel = getattr(current_user, "_active_hotel_id", None) or current_user.hotel_id
    task = models.Task(**data.model_dump(), created_by_id=current_user.id, hotel_id=active_hotel)
    db.add(task); db.commit(); db.refresh(task)
    # Notifier la personne assignée si différente du créateur
    if task.assigned_to_id and task.assigned_to_id != current_user.id:
        notify(db, hotel_id=active_hotel, user_id=task.assigned_to_id,
               type="task_assigned", title="Tâche assignée",
               message=f"Nouvelle tâche assignée : {task.title}",
               entity_type="task", entity_id=task.id, priority="medium")
    # Notifier les responsables si tâche urgente
    if task.priority == "urgente":
        notify_role(db, "responsable", hotel_id=active_hotel,
                    type="task_assigned", title="Tâche urgente",
                    message=f"Tâche urgente créée : {task.title}",
                    entity_type="task", entity_id=task.id, priority="high",
                    exclude_user_id=current_user.id)
    db.commit()
    return task

@tasks_router.patch("/{task_id}", response_model=schemas.TaskOut)
def update_task(task_id: int, data: schemas.TaskUpdate, db: Session = Depends(get_db),
                current_user: models.User = Depends(get_current_user)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task: raise HTTPException(404, "Tâche introuvable")
    active_hotel = getattr(current_user, "_active_hotel_id", None) or current_user.hotel_id
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(task, k, v)
    now = datetime.now(timezone.utc)
    if data.status == "en_cours" and not task.started_at:
        task.started_at = now
    elif data.status == "terminee" and not task.completed_at:
        task.completed_at = now
    elif data.status == "validee":
        task.validated_at = now
    if data.assigned_to_id and data.assigned_to_id != current_user.id:
        notify(db, hotel_id=active_hotel, user_id=data.assigned_to_id,
               type="task_assigned", title="Tâche assignée",
               message=task.title, entity_type="task", entity_id=task.id, priority="medium")
    db.commit(); db.refresh(task)
    return task

@tasks_router.delete("/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db),
                current_user: models.User = Depends(require_roles("responsable","responsable_technique","direction"))):
    active_hotel = getattr(current_user, "_active_hotel_id", None) or current_user.hotel_id
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task: raise HTTPException(404, "Tâche introuvable")
    if active_hotel and task.hotel_id and task.hotel_id != active_hotel:
        raise HTTPException(403, "Accès refusé — tâche d'un autre hôtel")
    db.delete(task); db.commit()


# ── Interventions ─────────────────────────────────────────────────────────────

interventions_router = APIRouter(prefix="/interventions", tags=["Interventions"])

@interventions_router.get("", response_model=List[schemas.InterventionOut])
def list_interventions(status: Optional[str] = None, priority: Optional[str] = None,
                       room_id: Optional[int] = None,
                       db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    active_hotel = getattr(current_user, "_active_hotel_id", None) or current_user.hotel_id
    q = db.query(models.Intervention)
    if active_hotel: q = q.filter(models.Intervention.hotel_id == active_hotel)
    if status:  q = q.filter(models.Intervention.status == status)
    if priority:q = q.filter(models.Intervention.priority == priority)
    if room_id: q = q.filter(models.Intervention.room_id == room_id)
    return q.order_by(models.Intervention.created_at.desc()).all()

@interventions_router.post("", response_model=schemas.InterventionOut, status_code=201)
def create_intervention(data: schemas.InterventionCreate, db: Session = Depends(get_db),
                        current_user: models.User = Depends(get_current_user)):
    active_hotel = getattr(current_user, "_active_hotel_id", None) or current_user.hotel_id
    inv = models.Intervention(**data.model_dump(), created_by_id=current_user.id, hotel_id=active_hotel)
    db.add(inv); db.commit(); db.refresh(inv)
    prio = "critical" if data.priority == "urgente" else "high" if data.priority == "haute" else "medium"
    ntype = "intervention_urgent" if data.priority == "urgente" else "intervention_created"
    title_notif = "Nouvelle intervention" + (" URGENTE 🚨" if data.priority == "urgente" else "")
    # Notifier responsables et direction (sans exclure le créateur pour les urgentes)
    exclude = current_user.id if data.priority != "urgente" else None
    for role in ("responsable", "direction", "responsable_technique"):
        notify_role(db, role, hotel_id=active_hotel, type=ntype,
                    title=title_notif, message=inv.title,
                    entity_type="intervention", entity_id=inv.id,
                    priority=prio, exclude_user_id=exclude)
    db.commit()
    return inv

@interventions_router.patch("/{inv_id}", response_model=schemas.InterventionOut)
def update_intervention(inv_id: int, data: schemas.InterventionUpdate,
                        db: Session = Depends(get_db),
                        current_user: models.User = Depends(get_current_user)):
    inv = db.query(models.Intervention).filter(models.Intervention.id == inv_id).first()
    if not inv: raise HTTPException(404, "Intervention introuvable")
    active_hotel = getattr(current_user, "_active_hotel_id", None) or current_user.hotel_id

    VALID_TRANSITIONS = {
        "nouvelle":    ["en_attente", "en_cours", "prise", "cloturee", "duplicate"],
        "en_attente":  ["en_cours", "prise", "cloturee", "duplicate"],
        "prise":       ["en_cours", "pause", "cloturee", "duplicate"],
        "en_cours":    ["pause", "terminee", "cloturee", "duplicate"],
        "pause":       ["en_cours", "cloturee", "duplicate"],
        "terminee":    ["cloturee"],
        "cloturee":    [],
        "duplicate":   ["nouvelle"],
    }
    if data.status and data.status != inv.status:
        allowed = VALID_TRANSITIONS.get(inv.status, [])
        if data.status not in allowed:
            raise HTTPException(400, f"Transition {inv.status} → {data.status} non autorisée")

    for k, v in data.model_dump(exclude_none=True).items():
        setattr(inv, k, v)
    now = datetime.now(timezone.utc)
    if data.status == "en_cours" and not inv.started_at:
        inv.started_at = now
        if data.taken_by_id is None:
            inv.taken_by_id = current_user.id
    elif data.status == "cloturee" and not inv.completed_at:
        inv.completed_at = now
        if inv.created_by_id and inv.created_by_id != current_user.id:
            notify(db, hotel_id=active_hotel, user_id=inv.created_by_id,
                   type="intervention_closed", title="Intervention clôturée",
                   message=inv.title, entity_type="intervention", entity_id=inv.id, priority="low")
    if data.taken_by_id and data.taken_by_id != current_user.id:
        notify(db, hotel_id=active_hotel, user_id=data.taken_by_id,
               type="intervention_assigned", title="Intervention assignée",
               message=inv.title, entity_type="intervention", entity_id=inv.id, priority="high")
    db.commit(); db.refresh(inv)
    return inv

@interventions_router.post("/{inv_id}/take", response_model=schemas.InterventionOut)
def take_intervention(inv_id: int, db: Session = Depends(get_db),
                      current_user: models.User = Depends(get_current_user)):
    inv = db.query(models.Intervention).filter(models.Intervention.id == inv_id).first()
    if not inv: raise HTTPException(404, "Intervention introuvable")
    if inv.status not in ("nouvelle", "en_attente"):
        raise HTTPException(400, "Cette intervention ne peut plus être prise")
    active_hotel = getattr(current_user, "_active_hotel_id", None) or current_user.hotel_id
    inv.taken_by_id = current_user.id
    inv.status = "en_cours"
    inv.started_at = datetime.now(timezone.utc)
    db.commit(); db.refresh(inv)
    if inv.created_by_id and inv.created_by_id != current_user.id:
        notify(db, hotel_id=active_hotel, user_id=inv.created_by_id,
               type="intervention_taken", title="Intervention prise en charge",
               message=inv.title + " prise par " + current_user.name,
               entity_type="intervention", entity_id=inv.id, priority="low")
        db.commit()
    return inv

@interventions_router.post("/{inv_id}/close", response_model=schemas.InterventionOut)
def close_intervention(inv_id: int, payload: schemas.InterventionClose,
                       db: Session = Depends(get_db),
                       current_user: models.User = Depends(get_current_user)):
    """Dedicated close route — sets status, resolution_note, cost, completed_at."""
    inv = db.query(models.Intervention).filter(models.Intervention.id == inv_id).first()
    if not inv: raise HTTPException(404, "Intervention introuvable")
    if inv.status == "cloturee": raise HTTPException(400, "Déjà clôturée")
    if inv.status == "duplicate": raise HTTPException(400, "Un doublon ne peut pas être clôturé")
    active_hotel = getattr(current_user, "_active_hotel_id", None) or current_user.hotel_id
    inv.status = "cloturee"
    inv.resolution_note = payload.resolution_note
    if payload.cost is not None: inv.cost = payload.cost
    inv.completed_at = datetime.now(timezone.utc)
    if inv.created_by_id and inv.created_by_id != current_user.id:
        notify(db, hotel_id=active_hotel, user_id=inv.created_by_id,
               type="intervention_closed", title="Intervention clôturée",
               message=inv.title, entity_type="intervention", entity_id=inv.id, priority="low")
    db.commit(); db.refresh(inv)
    return inv

@interventions_router.post("/{inv_id}/mark-duplicate", response_model=schemas.InterventionOut)
def mark_duplicate(inv_id: int, payload: schemas.InterventionMarkDuplicate,
                   db: Session = Depends(get_db),
                   current_user: models.User = Depends(get_current_user)):
    inv = db.query(models.Intervention).filter(models.Intervention.id == inv_id).first()
    if not inv: raise HTTPException(404, "Intervention introuvable")
    parent = db.query(models.Intervention).filter(models.Intervention.id == payload.duplicate_of_id).first()
    if not parent: raise HTTPException(404, "Intervention principale introuvable")
    if inv.id == parent.id: raise HTTPException(400, "Une intervention ne peut pas être son propre doublon")
    active_hotel = getattr(current_user, "_active_hotel_id", None) or current_user.hotel_id
    inv.is_duplicate = True
    inv.duplicate_of_id = payload.duplicate_of_id
    inv.duplicate_reason = payload.duplicate_reason
    inv.duplicate_reported_by = current_user.id
    inv.duplicate_marked_at = datetime.now(timezone.utc)
    inv.status = "duplicate"
    db.commit(); db.refresh(inv)
    if inv.created_by_id and inv.created_by_id != current_user.id:
        notify(db, hotel_id=active_hotel, user_id=inv.created_by_id,
               type="intervention_duplicate", title="Intervention marquée doublon",
               message=inv.title + " → doublon de #" + str(parent.id),
               entity_type="intervention", entity_id=inv.id, priority="low")
        db.commit()
    return inv

@interventions_router.post("/{inv_id}/unmark-duplicate", response_model=schemas.InterventionOut)
def unmark_duplicate(inv_id: int, db: Session = Depends(get_db),
                     current_user: models.User = Depends(get_current_user)):
    inv = db.query(models.Intervention).filter(models.Intervention.id == inv_id).first()
    if not inv: raise HTTPException(404, "Intervention introuvable")
    inv.is_duplicate = False
    inv.duplicate_of_id = None
    inv.duplicate_reason = None
    inv.duplicate_reported_by = None
    inv.duplicate_marked_at = None
    if inv.status == "duplicate": inv.status = "nouvelle"
    db.commit(); db.refresh(inv)
    return inv

@interventions_router.delete("/{inv_id}", status_code=204)
def delete_intervention(inv_id: int, db: Session = Depends(get_db),
                        current_user: models.User = Depends(require_roles("responsable","responsable_technique","direction"))):
    active_hotel = getattr(current_user, "_active_hotel_id", None) or current_user.hotel_id
    inv = db.query(models.Intervention).filter(models.Intervention.id == inv_id).first()
    if not inv: raise HTTPException(404, "Intervention introuvable")
    if active_hotel and inv.hotel_id and inv.hotel_id != active_hotel:
        raise HTTPException(403, "Accès refusé — intervention d'un autre hôtel")
    db.delete(inv); db.commit()


# ── Rounds ────────────────────────────────────────────────────────────────────

rounds_router = APIRouter(prefix="/rounds", tags=["Tournées"])

@rounds_router.get("", response_model=List[schemas.RoundOut])
def list_rounds(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    active_hotel = getattr(current_user, "_active_hotel_id", None) or current_user.hotel_id
    q = db.query(models.Round)
    if active_hotel: q = q.filter(models.Round.hotel_id == active_hotel)
    return q.order_by(models.Round.date.desc()).all()

@rounds_router.post("", response_model=schemas.RoundOut, status_code=201)
def create_round(data: schemas.RoundCreate, db: Session = Depends(get_db),
                 current_user: models.User = Depends(require_roles("gouvernante","responsable","direction"))):
    active_hotel = getattr(current_user, "_active_hotel_id", None) or current_user.hotel_id
    rooms_data = data.rooms
    round_dict = data.model_dump(exclude={"rooms"})
    round_dict["hotel_id"] = active_hotel
    rnd = models.Round(**round_dict)
    db.add(rnd); db.flush()
    for r in rooms_data:
        rr = models.RoundRoom(round_id=rnd.id, room_id=r.room_id, order=r.order)
        db.add(rr)
    db.commit(); db.refresh(rnd)
    return rnd

@rounds_router.patch("/{round_id}/status")
def update_round_status(round_id: int, status: str, db: Session = Depends(get_db),
                        _: models.User = Depends(get_current_user)):
    rnd = db.query(models.Round).filter(models.Round.id == round_id).first()
    if not rnd: raise HTTPException(404, "Tournée introuvable")
    rnd.status = status
    now = datetime.now(timezone.utc)
    if status == "en_cours" and not rnd.started_at: rnd.started_at = now
    if status == "terminee" and not rnd.completed_at: rnd.completed_at = now
    db.commit()
    return {"message": f"Tournée {status}"}

@rounds_router.patch("/{round_id}/rooms/{rr_id}", response_model=schemas.RoundRoomOut)
def update_round_room(round_id: int, rr_id: int, data: schemas.RoundRoomUpdate,
                      db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    rr = db.query(models.RoundRoom).filter(
        models.RoundRoom.id == rr_id, models.RoundRoom.round_id == round_id
    ).first()
    if not rr: raise HTTPException(404, "Entrée tournée introuvable")
    rr.status = data.status
    rr.note   = data.note
    if data.status == "fait":
        rr.completed_at = datetime.now(timezone.utc)
        # mettre à jour le statut de la chambre
        room = db.query(models.Room).filter(models.Room.id == rr.room_id).first()
        if room:
            room.status = "prete"
            room.last_cleaned = datetime.now(timezone.utc)
    db.commit(); db.refresh(rr)
    return rr


# ── Messages LEGACY — remplacé par Conversations — ne plus utiliser ───────────

messages_router = APIRouter(prefix="/messages", tags=["Messagerie LEGACY"])

@messages_router.get("", response_model=List[schemas.MessageOut])
def list_messages(channel: Optional[str] = None, limit: int = 50,
                  db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    q = db.query(models.Message)
    if channel: q = q.filter(models.Message.channel == channel)
    return q.order_by(models.Message.created_at.desc()).limit(limit).all()

@messages_router.post("", response_model=schemas.MessageOut, status_code=201)
def send_message(data: schemas.MessageCreate, db: Session = Depends(get_db),
                 current_user: models.User = Depends(get_current_user)):
    msg = models.Message(**data.model_dump(), sender_id=current_user.id)
    db.add(msg); db.commit(); db.refresh(msg)
    return msg

@messages_router.patch("/{msg_id}/read")
def mark_read(msg_id: int, db: Session = Depends(get_db),
              _: models.User = Depends(get_current_user)):
    msg = db.query(models.Message).filter(models.Message.id == msg_id).first()
    if not msg: raise HTTPException(404, "Message introuvable")
    msg.is_read = True
    db.commit()
    return {"message": "Lu"}


# ── QR Checkout ───────────────────────────────────────────────────────────────

qr_router = APIRouter(prefix="/qr", tags=["QR Checkout"])

@qr_router.post("/scan", response_model=schemas.QRCheckoutOut)
def scan_qr(data: schemas.QRScanPayload, db: Session = Depends(get_db)):
    """Route publique — scannée par le client depuis sa chambre"""
    room = db.query(models.Room).filter(models.Room.qr_token == data.token).first()
    if not room: raise HTTPException(404, "QR code invalide")
    checkout = models.QRCheckout(
        token=data.token, room_id=room.id,
        guest_name=data.guest_name, guest_comment=data.guest_comment,
        scanned_at=datetime.now(timezone.utc)
    )
    db.add(checkout)
    # Déclencher le flux ménage
    room.status = "en_menage"
    db.commit(); db.refresh(checkout)
    return checkout

@qr_router.get("/checkouts", response_model=List[schemas.QRCheckoutOut])
def list_checkouts(db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    return db.query(models.QRCheckout).order_by(models.QRCheckout.created_at.desc()).all()


# ── Reviews ───────────────────────────────────────────────────────────────────

reviews_router = APIRouter(prefix="/reviews", tags=["Avis clients"])

@reviews_router.get("", response_model=List[schemas.ReviewOut])
def list_reviews(status: Optional[str] = None, db: Session = Depends(get_db),
                 current_user: models.User = Depends(get_current_user)):
    active_hotel = getattr(current_user, "_active_hotel_id", None) or current_user.hotel_id
    q = db.query(models.ClientReview)
    if active_hotel: q = q.filter(models.ClientReview.hotel_id == active_hotel)
    if status: q = q.filter(models.ClientReview.status == status)
    return q.order_by(models.ClientReview.created_at.desc()).all()

@reviews_router.post("", response_model=schemas.ReviewOut, status_code=201)
def create_review(data: schemas.ReviewCreate, db: Session = Depends(get_db)):
    """Route publique — formulaire client post check-out"""
    if data.rating < 1 or data.rating > 5:
        raise HTTPException(400, "Note entre 1 et 5")
    review = models.ClientReview(**data.model_dump())
    db.add(review); db.commit(); db.refresh(review)
    return review

@reviews_router.patch("/{review_id}", response_model=schemas.ReviewOut)
def update_review(review_id: int, data: schemas.ReviewUpdate, db: Session = Depends(get_db),
                  _: models.User = Depends(get_current_user)):
    review = db.query(models.ClientReview).filter(models.ClientReview.id == review_id).first()
    if not review: raise HTTPException(404, "Avis introuvable")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(review, k, v)
    if data.status == "clos":
        review.resolved_at = datetime.now(timezone.utc)
    db.commit(); db.refresh(review)
    return review

@reviews_router.delete("/{review_id}", status_code=204)
def delete_review(review_id: int, db: Session = Depends(get_db),
                  current_user: models.User = Depends(require_roles("responsable","direction"))):
    active_hotel = getattr(current_user, "_active_hotel_id", None) or current_user.hotel_id
    review = db.query(models.ClientReview).filter(models.ClientReview.id == review_id).first()
    if not review: raise HTTPException(404, "Avis introuvable")
    if active_hotel and review.hotel_id and review.hotel_id != active_hotel:
        raise HTTPException(403, "Accès refusé")
    db.delete(review); db.commit()


# ── Equipment ─────────────────────────────────────────────────────────────────

equipment_router = APIRouter(prefix="/equipment", tags=["Équipements"])

# ── Equipment V2 — Familles / Types / Items (AVANT les routes avec {eq_id}) ─

@equipment_router.get("/families", response_model=List[schemas.EquipmentFamilyOut])
def list_families(db: Session = Depends(get_db),
                  _: models.User = Depends(get_current_user)):
    return db.query(models.EquipmentFamily).order_by(models.EquipmentFamily.sort_order.asc()).all()

@equipment_router.get("/types", response_model=List[schemas.EquipmentTypeOut])
def list_types(family_id: Optional[int] = None, db: Session = Depends(get_db),
               _: models.User = Depends(get_current_user)):
    q = db.query(models.EquipmentType).filter(models.EquipmentType.is_active == True)
    if family_id: q = q.filter(models.EquipmentType.family_id == family_id)
    return q.order_by(models.EquipmentType.name).all()

@equipment_router.get("/items", response_model=List[schemas.EquipmentItemOut])
def list_items(family_id: Optional[int] = None, type_id: Optional[int] = None,
               room_id: Optional[int] = None, status: Optional[str] = None,
               db: Session = Depends(get_db),
               current_user: models.User = Depends(get_current_user)):
    active_hotel = getattr(current_user, "_active_hotel_id", None) or current_user.hotel_id
    q = db.query(models.EquipmentItem)
    if active_hotel: q = q.filter(models.EquipmentItem.hotel_id == active_hotel)
    if family_id: q = q.filter(models.EquipmentItem.family_id == family_id)
    if type_id:   q = q.filter(models.EquipmentItem.type_id == type_id)
    if room_id:   q = q.filter(models.EquipmentItem.room_id == room_id)
    if status:    q = q.filter(models.EquipmentItem.status == status)
    return q.order_by(models.EquipmentItem.name).all()

@equipment_router.post("/items", response_model=schemas.EquipmentItemOut, status_code=201)
def create_item(payload: schemas.EquipmentItemCreate, db: Session = Depends(get_db),
                current_user: models.User = Depends(get_current_user)):
    active_hotel = getattr(current_user, "_active_hotel_id", None) or current_user.hotel_id
    if not active_hotel:
        first_hotel = db.query(models.Hotel).filter(models.Hotel.is_active == True).first()
        active_hotel = first_hotel.id if first_hotel else None
    if not active_hotel:
        raise HTTPException(400, "Aucun hôtel configuré pour cet utilisateur")
    item = models.EquipmentItem(
        hotel_id=active_hotel,
        **payload.model_dump()
    )
    db.add(item); db.commit(); db.refresh(item)
    return item

@equipment_router.patch("/items/{item_id}", response_model=schemas.EquipmentItemOut)
def update_item(item_id: int, data: schemas.EquipmentItemUpdate, db: Session = Depends(get_db),
                current_user: models.User = Depends(get_current_user)):
    item = db.query(models.EquipmentItem).filter(models.EquipmentItem.id == item_id).first()
    if not item: raise HTTPException(404, "Équipement introuvable")
    active_hotel = getattr(current_user, "_active_hotel_id", None) or current_user.hotel_id
    old_status = item.status
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(item, k, v)
    if data.status and data.status in ("en_panne", "hors_service") and old_status not in ("en_panne", "hors_service"):
        notify_role(db, "responsable", hotel_id=active_hotel,
                    type="equipment_alert", title="Équipement en panne",
                    message=item.name, entity_type="equipment", entity_id=item.id,
                    priority="high", exclude_user_id=current_user.id)
    db.commit(); db.refresh(item)
    return item

@equipment_router.delete("/items/{item_id}", status_code=204)
def delete_item(item_id: int, db: Session = Depends(get_db),
                current_user: models.User = Depends(require_roles("responsable","responsable_technique","direction"))):
    active_hotel = getattr(current_user, "_active_hotel_id", None) or current_user.hotel_id
    item = db.query(models.EquipmentItem).filter(models.EquipmentItem.id == item_id).first()
    if not item: raise HTTPException(404, "Équipement introuvable")
    if active_hotel and item.hotel_id and item.hotel_id != active_hotel:
        raise HTTPException(403, "Accès refusé — équipement d'un autre hôtel")
    db.delete(item); db.commit()

# ── Equipment Legacy — GELÉ — ne plus utiliser ──────────────────────────────
# Les routes ci-dessous sont désactivées. Le frontend utilise uniquement :
#   /equipment/families, /equipment/types, /equipment/items
# Si besoin de les réactiver pour compatibilité, décommenter.

# @equipment_router.get("", response_model=List[schemas.EquipmentOut])
# def list_equipment(status: Optional[str] = None, db: Session = Depends(get_db),
#                    _: models.User = Depends(get_current_user)):
#     q = db.query(models.Equipment)
#     if status: q = q.filter(models.Equipment.status == status)
#     return q.order_by(models.Equipment.name).all()

# @equipment_router.post("", response_model=schemas.EquipmentOut, status_code=201)
# def create_equipment(data: schemas.EquipmentCreate, db: Session = Depends(get_db),
#                      _: models.User = Depends(require_roles("responsable","direction","technicien"))):
#     eq = models.Equipment(**data.model_dump())
#     db.add(eq); db.commit(); db.refresh(eq)
#     return eq

# @equipment_router.patch("/{eq_id}", response_model=schemas.EquipmentOut)
# def update_equipment(eq_id: int, data: schemas.EquipmentUpdate, db: Session = Depends(get_db),
#                      _: models.User = Depends(get_current_user)):
#     eq = db.query(models.Equipment).filter(models.Equipment.id == eq_id).first()
#     if not eq: raise HTTPException(404, "Équipement introuvable")
#     for k, v in data.model_dump(exclude_none=True).items():
#         setattr(eq, k, v)
#     db.commit(); db.refresh(eq)
#     return eq


# ── Stock ─────────────────────────────────────────────────────────────────────

stock_router = APIRouter(prefix="/stock", tags=["Stock"])

@stock_router.get("/items", response_model=List[schemas.StockItemOut])
def list_stock(low_only: bool = False, db: Session = Depends(get_db),
               current_user: models.User = Depends(get_current_user)):
    active_hotel = getattr(current_user, "_active_hotel_id", None) or current_user.hotel_id
    q = db.query(models.StockItem)
    if active_hotel: q = q.filter(models.StockItem.hotel_id == active_hotel)
    items = q.order_by(models.StockItem.name).all()
    if low_only:
        items = [i for i in items if i.quantity <= i.threshold_min]
    return items

@stock_router.post("/items", response_model=schemas.StockItemOut, status_code=201)
def create_stock_item(data: schemas.StockItemCreate, db: Session = Depends(get_db),
                      current_user: models.User = Depends(get_current_user)):
    active_hotel = getattr(current_user, "_active_hotel_id", None) or current_user.hotel_id
    item = models.StockItem(**data.model_dump(), hotel_id=active_hotel)
    db.add(item); db.commit(); db.refresh(item)
    return item

@stock_router.patch("/items/{item_id}", response_model=schemas.StockItemOut)
def update_stock_item(item_id: int, data: schemas.StockItemUpdate, db: Session = Depends(get_db),
                      current_user: models.User = Depends(get_current_user)):
    active_hotel = getattr(current_user, "_active_hotel_id", None) or current_user.hotel_id
    item = db.query(models.StockItem).filter(models.StockItem.id == item_id).first()
    if not item: raise HTTPException(404, "Article introuvable")
    if active_hotel and item.hotel_id and item.hotel_id != active_hotel:
        raise HTTPException(403, "Accès refusé — article d'un autre hôtel")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(item, k, v)
    db.commit(); db.refresh(item)
    return item

@stock_router.delete("/items/{item_id}", status_code=204)
def delete_stock_item(item_id: int, db: Session = Depends(get_db),
                      current_user: models.User = Depends(require_roles("responsable","responsable_technique","direction"))):
    active_hotel = getattr(current_user, "_active_hotel_id", None) or current_user.hotel_id
    item = db.query(models.StockItem).filter(models.StockItem.id == item_id).first()
    if not item: raise HTTPException(404, "Article introuvable")
    if active_hotel and item.hotel_id and item.hotel_id != active_hotel:
        raise HTTPException(403, "Accès refusé — article d'un autre hôtel")
    db.delete(item); db.commit()

@stock_router.post("/movements", response_model=schemas.StockMovementOut, status_code=201)
def add_movement(data: schemas.StockMovementCreate, db: Session = Depends(get_db),
                 current_user: models.User = Depends(get_current_user)):
    active_hotel = getattr(current_user, "_active_hotel_id", None) or current_user.hotel_id
    item = db.query(models.StockItem).filter(models.StockItem.id == data.item_id).with_for_update().first()
    if not item: raise HTTPException(404, "Article introuvable")
    if data.quantity <= 0: raise HTTPException(400, "La quantité doit être positive")
    mv = models.StockMovement(**data.model_dump(), user_id=current_user.id)
    db.add(mv)
    if data.type == "entree":
        item.quantity += data.quantity
    elif data.type == "sortie":
        if item.quantity < data.quantity:
            raise HTTPException(400, "Stock insuffisant")
        item.quantity -= data.quantity
    elif data.type == "inventaire":
        item.quantity = data.quantity
    db.commit(); db.refresh(mv)
    if item.quantity <= item.threshold_min:
        notify_role(db, "responsable", hotel_id=active_hotel,
                    type="stock_alert", title="Alerte stock",
                    message=item.name + " — seuil minimum atteint (" + str(int(item.quantity)) + "/" + str(int(item.threshold_min)) + ")",
                    entity_type="stock", entity_id=item.id, priority="high",
                    exclude_user_id=current_user.id)
        db.commit()
    return mv

@stock_router.get("/movements", response_model=List[schemas.StockMovementOut])
def list_movements(item_id: Optional[int] = None, db: Session = Depends(get_db),
                   _: models.User = Depends(get_current_user)):
    q = db.query(models.StockMovement)
    if item_id: q = q.filter(models.StockMovement.item_id == item_id)
    return q.order_by(models.StockMovement.created_at.desc()).limit(200).all()


# ── Dashboard ─────────────────────────────────────────────────────────────────

dashboard_router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@dashboard_router.get("/stats", response_model=schemas.DashboardStats)
def get_stats(db: Session = Depends(get_db),
              current_user: models.User = Depends(get_current_user)):
    active_hotel = getattr(current_user, "_active_hotel_id", None) or current_user.hotel_id
    rooms_q = db.query(models.Room)
    if active_hotel: rooms_q = rooms_q.filter(models.Room.hotel_id == active_hotel)
    rooms = rooms_q.all()
    stock_q = db.query(models.StockItem)
    if active_hotel: stock_q = stock_q.filter(models.StockItem.hotel_id == active_hotel)
    stock_items = stock_q.all()
    avg_q = db.query(func.avg(models.ClientReview.rating))
    if active_hotel: avg_q = avg_q.filter(models.ClientReview.hotel_id == active_hotel)
    avg_rating = avg_q.scalar() or 0.0

    def count_rooms(s): return sum(1 for r in rooms if r.status == s)
    def count_tasks(s):
        q = db.query(models.Task).filter(models.Task.status == s)
        if active_hotel: q = q.filter(models.Task.hotel_id == active_hotel)
        return q.count()
    def count_inv(s):
        q = db.query(models.Intervention).filter(models.Intervention.status == s, models.Intervention.is_duplicate == False)
        if active_hotel: q = q.filter(models.Intervention.hotel_id == active_hotel)
        return q.count()

    # Real attendance stats
    from datetime import date
    today = date.today().isoformat()
    att_q = db.query(models.AttendanceShift).filter(models.AttendanceShift.shift_date == today)
    if active_hotel: att_q = att_q.filter(models.AttendanceShift.hotel_id == active_hotel)
    shifts = att_q.all()
    att_present = sum(1 for s in shifts if s.status in ("present", "late"))
    att_absent = sum(1 for s in shifts if s.status == "absent")
    att_late = sum(1 for s in shifts if s.status == "late")

    tasks_urg_q = db.query(models.Task).filter(
        models.Task.priority == "urgente",
        models.Task.status.notin_(["terminee","validee"])
    )
    if active_hotel: tasks_urg_q = tasks_urg_q.filter(models.Task.hotel_id == active_hotel)

    rev_q = db.query(models.ClientReview).filter(models.ClientReview.status == "nouveau")
    if active_hotel: rev_q = rev_q.filter(models.ClientReview.hotel_id == active_hotel)

    eq_q = db.query(models.EquipmentItem).filter(models.EquipmentItem.status.in_(["en_panne", "hors_service"]))
    if active_hotel: eq_q = eq_q.filter(models.EquipmentItem.hotel_id == active_hotel)

    return schemas.DashboardStats(
        rooms_total        = len(rooms),
        rooms_libre        = count_rooms("libre"),
        rooms_en_menage    = count_rooms("en_menage"),
        rooms_prete        = count_rooms("prete"),
        rooms_bloquee      = count_rooms("bloquee"),
        tasks_a_faire      = count_tasks("a_faire"),
        tasks_en_cours     = count_tasks("en_cours"),
        tasks_urgentes     = tasks_urg_q.count(),
        interventions_nouvelles = count_inv("nouvelle"),
        interventions_en_cours  = count_inv("en_cours"),
        reviews_nouveau         = rev_q.count(),
        reviews_avg_rating      = round(float(avg_rating), 1),
        stock_alerts            = sum(1 for i in stock_items if i.quantity <= i.threshold_min),
        equipment_en_panne      = eq_q.count(),
        attendance_present = att_present,
        attendance_absent = att_absent,
        attendance_late = att_late,
    )
