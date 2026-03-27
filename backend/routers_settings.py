"""
Hotel OS — Routeur Réglages
Routes : /settings/task-categories, /settings/intervention-types,
         /settings/equipment-families, /settings/equipment-types
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from .database import get_db
from . import models, schemas
from .auth import get_current_user, require_roles

settings_router = APIRouter(prefix="/settings", tags=["Réglages"])


# ── Catégories de tâches ──────────────────────────────────────────────────────

@settings_router.get("/task-categories", response_model=List[schemas.TaskCategoryOut])
def list_task_categories(db: Session = Depends(get_db),
                         current_user: models.User = Depends(get_current_user)):
    active_hotel = getattr(current_user, "_active_hotel_id", None) or current_user.hotel_id
    q = db.query(models.TaskCategory)
    if active_hotel:
        q = q.filter(models.TaskCategory.hotel_id == active_hotel)
    return q.order_by(models.TaskCategory.name).all()

@settings_router.post("/task-categories", response_model=schemas.TaskCategoryOut, status_code=201)
def create_task_category(data: schemas.TaskCategoryCreate, db: Session = Depends(get_db),
                         current_user: models.User = Depends(require_roles("responsable","responsable_technique","direction"))):
    active_hotel = getattr(current_user, "_active_hotel_id", None) or current_user.hotel_id
    cat = models.TaskCategory(**data.model_dump(), hotel_id=active_hotel)
    db.add(cat); db.commit(); db.refresh(cat)
    return cat

@settings_router.patch("/task-categories/{cat_id}", response_model=schemas.TaskCategoryOut)
def update_task_category(cat_id: int, data: schemas.TaskCategoryUpdate, db: Session = Depends(get_db),
                         _: models.User = Depends(require_roles("responsable","responsable_technique","direction"))):
    cat = db.query(models.TaskCategory).filter(models.TaskCategory.id == cat_id).first()
    if not cat: raise HTTPException(404, "Catégorie introuvable")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(cat, k, v)
    db.commit(); db.refresh(cat)
    return cat

@settings_router.delete("/task-categories/{cat_id}", status_code=204)
def delete_task_category(cat_id: int, db: Session = Depends(get_db),
                         _: models.User = Depends(require_roles("responsable","responsable_technique","direction"))):
    cat = db.query(models.TaskCategory).filter(models.TaskCategory.id == cat_id).first()
    if not cat: raise HTTPException(404, "Catégorie introuvable")
    db.delete(cat); db.commit()


# ── Types d'intervention ──────────────────────────────────────────────────────

@settings_router.get("/intervention-types", response_model=List[schemas.InterventionTypeOut])
def list_intervention_types(db: Session = Depends(get_db),
                             current_user: models.User = Depends(get_current_user)):
    active_hotel = getattr(current_user, "_active_hotel_id", None) or current_user.hotel_id
    q = db.query(models.InterventionType)
    if active_hotel:
        q = q.filter(models.InterventionType.hotel_id == active_hotel)
    return q.order_by(models.InterventionType.name).all()

@settings_router.post("/intervention-types", response_model=schemas.InterventionTypeOut, status_code=201)
def create_intervention_type(data: schemas.InterventionTypeCreate, db: Session = Depends(get_db),
                              current_user: models.User = Depends(require_roles("responsable","responsable_technique","direction"))):
    active_hotel = getattr(current_user, "_active_hotel_id", None) or current_user.hotel_id
    itype = models.InterventionType(**data.model_dump(), hotel_id=active_hotel)
    db.add(itype); db.commit(); db.refresh(itype)
    return itype

@settings_router.patch("/intervention-types/{type_id}", response_model=schemas.InterventionTypeOut)
def update_intervention_type(type_id: int, data: schemas.InterventionTypeUpdate, db: Session = Depends(get_db),
                              _: models.User = Depends(require_roles("responsable","responsable_technique","direction"))):
    itype = db.query(models.InterventionType).filter(models.InterventionType.id == type_id).first()
    if not itype: raise HTTPException(404, "Type introuvable")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(itype, k, v)
    db.commit(); db.refresh(itype)
    return itype

@settings_router.delete("/intervention-types/{type_id}", status_code=204)
def delete_intervention_type(type_id: int, db: Session = Depends(get_db),
                              _: models.User = Depends(require_roles("responsable","responsable_technique","direction"))):
    itype = db.query(models.InterventionType).filter(models.InterventionType.id == type_id).first()
    if not itype: raise HTTPException(404, "Type introuvable")
    db.delete(itype); db.commit()


# ── Familles d'équipements ────────────────────────────────────────────────────

@settings_router.get("/equipment-families", response_model=List[schemas.EquipmentFamilyOut])
def list_equipment_families(db: Session = Depends(get_db),
                             _: models.User = Depends(get_current_user)):
    return db.query(models.EquipmentFamily).order_by(models.EquipmentFamily.sort_order, models.EquipmentFamily.name).all()

@settings_router.post("/equipment-families", response_model=schemas.EquipmentFamilyOut, status_code=201)
def create_equipment_family(data: schemas.EquipmentFamilyCreate, db: Session = Depends(get_db),
                             _: models.User = Depends(require_roles("responsable","responsable_technique","direction"))):
    existing = db.query(models.EquipmentFamily).filter(models.EquipmentFamily.code == data.code).first()
    if existing: raise HTTPException(400, "Code famille déjà utilisé")
    fam = models.EquipmentFamily(code=data.code, name=data.name, sort_order=data.sort_order)
    db.add(fam); db.commit(); db.refresh(fam)
    return fam

@settings_router.patch("/equipment-families/{fam_id}", response_model=schemas.EquipmentFamilyOut)
def update_equipment_family(fam_id: int, data: schemas.EquipmentFamilyUpdate, db: Session = Depends(get_db),
                             _: models.User = Depends(require_roles("responsable","responsable_technique","direction"))):
    fam = db.query(models.EquipmentFamily).filter(models.EquipmentFamily.id == fam_id).first()
    if not fam: raise HTTPException(404, "Famille introuvable")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(fam, k, v)
    db.commit(); db.refresh(fam)
    return fam


# ── Types d'équipements ───────────────────────────────────────────────────────

@settings_router.get("/equipment-types", response_model=List[schemas.EquipmentTypeOut])
def list_equipment_types_settings(family_id: Optional[int] = None, db: Session = Depends(get_db),
                                   _: models.User = Depends(get_current_user)):
    q = db.query(models.EquipmentType)
    if family_id: q = q.filter(models.EquipmentType.family_id == family_id)
    return q.order_by(models.EquipmentType.name).all()

@settings_router.post("/equipment-types", response_model=schemas.EquipmentTypeOut, status_code=201)
def create_equipment_type(data: schemas.EquipmentTypeCreate, db: Session = Depends(get_db),
                           _: models.User = Depends(require_roles("responsable","responsable_technique","direction"))):
    existing = db.query(models.EquipmentType).filter(models.EquipmentType.code == data.code).first()
    if existing: raise HTTPException(400, "Code type déjà utilisé")
    etype = models.EquipmentType(**data.model_dump())
    db.add(etype); db.commit(); db.refresh(etype)
    return etype

@settings_router.patch("/equipment-types/{type_id}", response_model=schemas.EquipmentTypeOut)
def update_equipment_type(type_id: int, data: schemas.EquipmentTypeUpdate, db: Session = Depends(get_db),
                           _: models.User = Depends(require_roles("responsable","responsable_technique","direction"))):
    etype = db.query(models.EquipmentType).filter(models.EquipmentType.id == type_id).first()
    if not etype: raise HTTPException(404, "Type introuvable")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(etype, k, v)
    db.commit(); db.refresh(etype)
    return etype

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from .database import get_db
from . import models, schemas
from .auth import get_current_user, require_roles

settings_router = APIRouter(prefix="/settings", tags=["Réglages"])


# ── Catégories de tâches ──────────────────────────────────────────────────────

@settings_router.get("/task-categories", response_model=List[schemas.TaskCategoryOut])
def list_task_categories(db: Session = Depends(get_db),
                         current_user: models.User = Depends(get_current_user)):
    active_hotel = getattr(current_user, "_active_hotel_id", None) or current_user.hotel_id
    q = db.query(models.TaskCategory)
    if active_hotel:
        q = q.filter(models.TaskCategory.hotel_id == active_hotel)
    return q.order_by(models.TaskCategory.name).all()

@settings_router.post("/task-categories", response_model=schemas.TaskCategoryOut, status_code=201)
def create_task_category(data: schemas.TaskCategoryCreate, db: Session = Depends(get_db),
                         current_user: models.User = Depends(require_roles("responsable","responsable_technique","direction"))):
    active_hotel = getattr(current_user, "_active_hotel_id", None) or current_user.hotel_id
    cat = models.TaskCategory(**data.model_dump(), hotel_id=active_hotel)
    db.add(cat); db.commit(); db.refresh(cat)
    return cat

@settings_router.patch("/task-categories/{cat_id}", response_model=schemas.TaskCategoryOut)
def update_task_category(cat_id: int, data: schemas.TaskCategoryUpdate, db: Session = Depends(get_db),
                         _: models.User = Depends(require_roles("responsable","responsable_technique","direction"))):
    cat = db.query(models.TaskCategory).filter(models.TaskCategory.id == cat_id).first()
    if not cat: raise HTTPException(404, "Catégorie introuvable")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(cat, k, v)
    db.commit(); db.refresh(cat)
    return cat

@settings_router.delete("/task-categories/{cat_id}", status_code=204)
def delete_task_category(cat_id: int, db: Session = Depends(get_db),
                         _: models.User = Depends(require_roles("responsable","responsable_technique","direction"))):
    cat = db.query(models.TaskCategory).filter(models.TaskCategory.id == cat_id).first()
    if not cat: raise HTTPException(404, "Catégorie introuvable")
    db.delete(cat); db.commit()


# ── Types d'intervention ──────────────────────────────────────────────────────

@settings_router.get("/intervention-types", response_model=List[schemas.InterventionTypeOut])
def list_intervention_types(db: Session = Depends(get_db),
                             current_user: models.User = Depends(get_current_user)):
    active_hotel = getattr(current_user, "_active_hotel_id", None) or current_user.hotel_id
    q = db.query(models.InterventionType)
    if active_hotel:
        q = q.filter(models.InterventionType.hotel_id == active_hotel)
    return q.order_by(models.InterventionType.name).all()

@settings_router.post("/intervention-types", response_model=schemas.InterventionTypeOut, status_code=201)
def create_intervention_type(data: schemas.InterventionTypeCreate, db: Session = Depends(get_db),
                              current_user: models.User = Depends(require_roles("responsable","responsable_technique","direction"))):
    active_hotel = getattr(current_user, "_active_hotel_id", None) or current_user.hotel_id
    itype = models.InterventionType(**data.model_dump(), hotel_id=active_hotel)
    db.add(itype); db.commit(); db.refresh(itype)
    return itype

@settings_router.patch("/intervention-types/{type_id}", response_model=schemas.InterventionTypeOut)
def update_intervention_type(type_id: int, data: schemas.InterventionTypeUpdate, db: Session = Depends(get_db),
                              _: models.User = Depends(require_roles("responsable","responsable_technique","direction"))):
    itype = db.query(models.InterventionType).filter(models.InterventionType.id == type_id).first()
    if not itype: raise HTTPException(404, "Type introuvable")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(itype, k, v)
    db.commit(); db.refresh(itype)
    return itype

@settings_router.delete("/intervention-types/{type_id}", status_code=204)
def delete_intervention_type(type_id: int, db: Session = Depends(get_db),
                              _: models.User = Depends(require_roles("responsable","responsable_technique","direction"))):
    itype = db.query(models.InterventionType).filter(models.InterventionType.id == type_id).first()
    if not itype: raise HTTPException(404, "Type introuvable")
    db.delete(itype); db.commit()
