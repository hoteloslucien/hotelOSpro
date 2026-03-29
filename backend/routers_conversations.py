"""Hotel OS — Conversations router V2 (WhatsApp-style: direct + groups)"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel
from .database import get_db
from . import models
from .auth import get_current_user
from .notifications import notify, notify_many

conv_router = APIRouter(prefix="/conversations", tags=["Conversations"])

# ── Schemas ──────────────────────────────────────────────────────

class ConvCreateDirect(BaseModel):
    user_id: int

class ConvCreateGroup(BaseModel):
    name: str
    participant_ids: List[int] = []

class ConvMsgCreate(BaseModel):
    body: str

class AddParticipants(BaseModel):
    user_ids: List[int]

class ConvOut(BaseModel):
    id: int; type: str; name: Optional[str]; is_archived: bool
    created_at: datetime; updated_at: Optional[datetime]
    last_message: Optional[str] = None; last_message_at: Optional[datetime] = None
    unread_count: int = 0; participant_count: int = 0
    other_user_name: Optional[str] = None; other_user_id: Optional[int] = None
    created_by_id: Optional[int] = None
    class Config: from_attributes = True

class MsgOut(BaseModel):
    id: int; conversation_id: int; sender_id: int; body: str
    message_type: str; created_at: datetime; sender_name: Optional[str] = None
    class Config: from_attributes = True

class ParticipantOut(BaseModel):
    id: int; user_id: int; role_in_conv: str; is_active: bool
    joined_at: datetime; left_at: Optional[datetime] = None
    user_name: Optional[str] = None; user_role: Optional[str] = None
    class Config: from_attributes = True


# ── Helpers ──────────────────────────────────────────────────────

def _build_conv_out(db, conv, me_id):
    """Build ConvOut with last message, unread, participants."""
    last_msg = db.query(models.ConvMessage).filter(
        models.ConvMessage.conversation_id == conv.id,
        models.ConvMessage.deleted_at == None
    ).order_by(models.ConvMessage.created_at.desc()).first()

    read_ids = db.query(models.ConvMessageRead.message_id).filter(
        models.ConvMessageRead.user_id == me_id
    ).subquery()
    unread = db.query(models.ConvMessage).filter(
        models.ConvMessage.conversation_id == conv.id,
        models.ConvMessage.sender_id != me_id,
        models.ConvMessage.deleted_at == None,
        ~models.ConvMessage.id.in_(read_ids)
    ).count()

    parts = db.query(models.ConversationParticipant).filter(
        models.ConversationParticipant.conversation_id == conv.id,
        models.ConversationParticipant.is_active == True
    ).all()

    other_name = None; other_id = None
    if conv.type == "direct":
        other_p = next((p for p in parts if p.user_id != me_id), None)
        if other_p:
            other_user = db.query(models.User).filter(models.User.id == other_p.user_id).first()
            if other_user:
                other_name = other_user.name; other_id = other_user.id

    return ConvOut(
        id=conv.id, type=conv.type, name=conv.name or other_name, is_archived=conv.is_archived,
        created_at=conv.created_at, updated_at=conv.updated_at,
        last_message=last_msg.body[:80] if last_msg else None,
        last_message_at=last_msg.created_at if last_msg else None,
        unread_count=unread, participant_count=len(parts),
        other_user_name=other_name, other_user_id=other_id,
        created_by_id=conv.created_by_id,
    )


def _verify_participant(db, conv_id, user_id):
    """Verify user is active participant, raise 403 if not."""
    part = db.query(models.ConversationParticipant).filter(
        models.ConversationParticipant.conversation_id == conv_id,
        models.ConversationParticipant.user_id == user_id,
        models.ConversationParticipant.is_active == True
    ).first()
    if not part:
        raise HTTPException(403, "Vous ne participez pas à cette conversation")
    return part


# ── Routes ───────────────────────────────────────────────────────

@conv_router.get("/unread-count")
def unread_count(db: Session = Depends(get_db), me: models.User = Depends(get_current_user)):
    """Total unread messages across all conversations."""
    my_convs = db.query(models.ConversationParticipant.conversation_id).filter(
        models.ConversationParticipant.user_id == me.id,
        models.ConversationParticipant.is_active == True
    ).subquery()
    read_ids = db.query(models.ConvMessageRead.message_id).filter(
        models.ConvMessageRead.user_id == me.id
    ).subquery()
    count = db.query(models.ConvMessage).filter(
        models.ConvMessage.conversation_id.in_(my_convs),
        models.ConvMessage.sender_id != me.id,
        models.ConvMessage.deleted_at == None,
        ~models.ConvMessage.id.in_(read_ids)
    ).count()
    return {"unread": count}


@conv_router.get("", response_model=List[ConvOut])
def list_conversations(db: Session = Depends(get_db), me: models.User = Depends(get_current_user)):
    """List all conversations for current user, with last message + unread count."""
    my_convs = db.query(models.ConversationParticipant.conversation_id).filter(
        models.ConversationParticipant.user_id == me.id,
        models.ConversationParticipant.is_active == True
    ).subquery()

    convs = db.query(models.Conversation).filter(
        models.Conversation.id.in_(my_convs),
        models.Conversation.is_archived == False
    ).order_by(models.Conversation.updated_at.desc().nullslast(), models.Conversation.created_at.desc()).all()

    return [_build_conv_out(db, c, me.id) for c in convs]


@conv_router.post("/direct", response_model=ConvOut)
def create_or_get_direct(data: ConvCreateDirect, db: Session = Depends(get_db),
                         me: models.User = Depends(get_current_user)):
    """Create or return existing direct conversation with another user."""
    if data.user_id == me.id:
        raise HTTPException(400, "Impossible de converser avec soi-même")
    other = db.query(models.User).filter(models.User.id == data.user_id).first()
    if not other:
        raise HTTPException(404, "Utilisateur introuvable")

    # Check if direct conv already exists between these 2 users
    my_directs = db.query(models.Conversation).filter(
        models.Conversation.type == "direct"
    ).join(models.ConversationParticipant).filter(
        models.ConversationParticipant.user_id == me.id,
        models.ConversationParticipant.is_active == True
    ).all()

    for conv in my_directs:
        other_in = db.query(models.ConversationParticipant).filter(
            models.ConversationParticipant.conversation_id == conv.id,
            models.ConversationParticipant.user_id == data.user_id,
            models.ConversationParticipant.is_active == True
        ).first()
        if other_in:
            return _build_conv_out(db, conv, me.id)

    # Create new
    conv = models.Conversation(type="direct", created_by_id=me.id, hotel_id=me.hotel_id)
    db.add(conv); db.flush()
    db.add(models.ConversationParticipant(conversation_id=conv.id, user_id=me.id, role_in_conv="member"))
    db.add(models.ConversationParticipant(conversation_id=conv.id, user_id=data.user_id, role_in_conv="member"))
    db.commit(); db.refresh(conv)
    return _build_conv_out(db, conv, me.id)


@conv_router.post("/group", response_model=ConvOut)
def create_group(data: ConvCreateGroup, db: Session = Depends(get_db),
                 me: models.User = Depends(get_current_user)):
    """Create a group conversation. Creator becomes admin."""
    if not data.name or not data.name.strip():
        raise HTTPException(400, "Nom du groupe requis")

    # Only responsable, direction, gouvernante can create groups
    if me.role not in ("responsable", "direction", "gouvernante"):
        raise HTTPException(403, "Seuls les responsables et la direction peuvent créer des groupes")

    conv = models.Conversation(
        type="group", name=data.name.strip(),
        created_by_id=me.id, hotel_id=me.hotel_id
    )
    db.add(conv); db.flush()

    # Add creator as admin
    db.add(models.ConversationParticipant(
        conversation_id=conv.id, user_id=me.id, role_in_conv="admin"
    ))

    # Add participants
    for uid in data.participant_ids:
        if uid == me.id:
            continue
        user = db.query(models.User).filter(models.User.id == uid, models.User.is_active == True).first()
        if user:
            db.add(models.ConversationParticipant(
                conversation_id=conv.id, user_id=uid, role_in_conv="member"
            ))

    db.commit(); db.refresh(conv)
    # Notify initial participants they've been added
    for uid in data.participant_ids:
        if uid != me.id:
            notify(db, hotel_id=me.hotel_id, user_id=uid,
                   type="conversation_added", title="Ajouté à un groupe",
                   message=me.name + " vous a ajouté au groupe " + data.name.strip(),
                   entity_type="conversation", entity_id=conv.id, priority="low")
    db.commit()
    return _build_conv_out(db, conv, me.id)


@conv_router.get("/{conv_id}", response_model=ConvOut)
def get_conversation(conv_id: int, db: Session = Depends(get_db),
                     me: models.User = Depends(get_current_user)):
    """Get a single conversation."""
    _verify_participant(db, conv_id, me.id)
    conv = db.query(models.Conversation).filter(models.Conversation.id == conv_id).first()
    if not conv:
        raise HTTPException(404, "Conversation introuvable")
    return _build_conv_out(db, conv, me.id)


class ConvUpdate(BaseModel):
    name: Optional[str] = None
    is_archived: Optional[bool] = None

@conv_router.patch("/{conv_id}", response_model=ConvOut)
def update_conversation(conv_id: int, data: ConvUpdate, db: Session = Depends(get_db),
                        me: models.User = Depends(get_current_user)):
    """Renommer un groupe ou archiver une conversation."""
    _verify_participant(db, conv_id, me.id)
    conv = db.query(models.Conversation).filter(models.Conversation.id == conv_id).first()
    if not conv: raise HTTPException(404, "Conversation introuvable")
    if conv.type != "group" and data.name is not None:
        raise HTTPException(400, "Seuls les groupes peuvent être renommés")
    if data.name is not None: conv.name = data.name
    if data.is_archived is not None: conv.is_archived = data.is_archived
    db.commit(); db.refresh(conv)
    return _build_conv_out(db, conv, me.id)


@conv_router.get("/{conv_id}/participants", response_model=List[ParticipantOut])
def get_participants(conv_id: int, db: Session = Depends(get_db),
                     me: models.User = Depends(get_current_user)):
    """List participants of a conversation."""
    _verify_participant(db, conv_id, me.id)
    parts = db.query(models.ConversationParticipant).filter(
        models.ConversationParticipant.conversation_id == conv_id,
        models.ConversationParticipant.is_active == True
    ).all()
    result = []
    for p in parts:
        user = db.query(models.User).filter(models.User.id == p.user_id).first()
        result.append(ParticipantOut(
            id=p.id, user_id=p.user_id, role_in_conv=p.role_in_conv,
            is_active=p.is_active, joined_at=p.joined_at, left_at=p.left_at,
            user_name=user.name if user else None,
            user_role=user.role if user else None,
        ))
    return result


@conv_router.post("/{conv_id}/participants")
def add_participants(conv_id: int, data: AddParticipants, db: Session = Depends(get_db),
                     me: models.User = Depends(get_current_user)):
    """Add participants to a group conversation (admin only)."""
    conv = db.query(models.Conversation).filter(models.Conversation.id == conv_id).first()
    if not conv:
        raise HTTPException(404, "Conversation introuvable")
    if conv.type != "group":
        raise HTTPException(400, "Impossible d'ajouter des participants à une conversation directe")

    # Verify caller is admin of this group
    my_part = _verify_participant(db, conv_id, me.id)
    if my_part.role_in_conv != "admin" and me.role not in ("direction", "responsable"):
        raise HTTPException(403, "Seuls les admins du groupe peuvent ajouter des participants")

    added = 0
    for uid in data.user_ids:
        user = db.query(models.User).filter(models.User.id == uid, models.User.is_active == True).first()
        if not user:
            continue
        # Check if already participant
        existing = db.query(models.ConversationParticipant).filter(
            models.ConversationParticipant.conversation_id == conv_id,
            models.ConversationParticipant.user_id == uid
        ).first()
        if existing:
            if not existing.is_active:
                existing.is_active = True
                existing.left_at = None
                existing.joined_at = datetime.now(timezone.utc)
                added += 1
        else:
            db.add(models.ConversationParticipant(
                conversation_id=conv_id, user_id=uid, role_in_conv="member"
            ))
            added += 1

    db.commit()
    # Notify added users
    conv = db.query(models.Conversation).filter(models.Conversation.id == conv_id).first()
    group_name = conv.name if conv else "un groupe"
    for uid in data.user_ids:
        if uid != me.id:
            notify(db, hotel_id=me.hotel_id, user_id=uid,
                   type="conversation_added", title="Ajouté à un groupe",
                   message=me.name + " vous a ajouté au groupe " + group_name,
                   entity_type="conversation", entity_id=conv_id, priority="low")
    db.commit()
    return {"added": added}


@conv_router.delete("/{conv_id}/participants/{user_id}")
def remove_participant(conv_id: int, user_id: int, db: Session = Depends(get_db),
                       me: models.User = Depends(get_current_user)):
    """Remove a participant from a group (admin or self-leave)."""
    conv = db.query(models.Conversation).filter(models.Conversation.id == conv_id).first()
    if not conv:
        raise HTTPException(404, "Conversation introuvable")
    if conv.type != "group":
        raise HTTPException(400, "Impossible de retirer un participant d'une conversation directe")

    my_part = _verify_participant(db, conv_id, me.id)

    # Either admin removes someone, or user removes self
    if user_id != me.id and my_part.role_in_conv != "admin" and me.role not in ("direction", "responsable"):
        raise HTTPException(403, "Seuls les admins peuvent retirer un participant")

    target = db.query(models.ConversationParticipant).filter(
        models.ConversationParticipant.conversation_id == conv_id,
        models.ConversationParticipant.user_id == user_id,
        models.ConversationParticipant.is_active == True
    ).first()
    if not target:
        raise HTTPException(404, "Participant introuvable")

    target.is_active = False
    target.left_at = datetime.now(timezone.utc)
    db.commit()
    return {"removed": True}


@conv_router.get("/{conv_id}/messages", response_model=List[MsgOut])
def get_messages(conv_id: int, limit: int = 50, db: Session = Depends(get_db),
                 me: models.User = Depends(get_current_user)):
    """Get messages for a conversation."""
    _verify_participant(db, conv_id, me.id)

    msgs = db.query(models.ConvMessage).filter(
        models.ConvMessage.conversation_id == conv_id,
        models.ConvMessage.deleted_at == None
    ).order_by(models.ConvMessage.created_at.desc()).limit(limit).all()

    result = []
    for m in reversed(msgs):
        sender = db.query(models.User).filter(models.User.id == m.sender_id).first()
        result.append(MsgOut(
            id=m.id, conversation_id=m.conversation_id, sender_id=m.sender_id,
            body=m.body, message_type=m.message_type, created_at=m.created_at,
            sender_name=sender.name if sender else None
        ))
    return result


@conv_router.post("/{conv_id}/messages", response_model=MsgOut, status_code=201)
def send_message(conv_id: int, data: ConvMsgCreate, db: Session = Depends(get_db),
                 me: models.User = Depends(get_current_user)):
    """Send a message in a conversation."""
    _verify_participant(db, conv_id, me.id)

    if not data.body or not data.body.strip():
        raise HTTPException(400, "Message vide")

    msg = models.ConvMessage(conversation_id=conv_id, sender_id=me.id, body=data.body.strip())
    db.add(msg)
    # Update conversation timestamp
    conv = db.query(models.Conversation).filter(models.Conversation.id == conv_id).first()
    if conv:
        conv.updated_at = datetime.now(timezone.utc)
    # Auto-read own message
    db.flush()
    db.add(models.ConvMessageRead(message_id=msg.id, user_id=me.id))
    db.commit(); db.refresh(msg)

    # Notify other participants
    parts = db.query(models.ConversationParticipant).filter(
        models.ConversationParticipant.conversation_id == conv_id,
        models.ConversationParticipant.is_active == True,
        models.ConversationParticipant.user_id != me.id
    ).all()
    conv_name = conv.name or me.name if conv else me.name
    for p in parts:
        notify(db, hotel_id=me.hotel_id, user_id=p.user_id,
               type="message_received", title="Nouveau message",
               message=me.name + " : " + msg.body[:80],
               entity_type="conversation", entity_id=conv_id, priority="low")
    db.commit()

    return MsgOut(id=msg.id, conversation_id=conv_id, sender_id=me.id,
                 body=msg.body, message_type=msg.message_type, created_at=msg.created_at,
                 sender_name=me.name)


@conv_router.post("/{conv_id}/read")
def mark_read(conv_id: int, db: Session = Depends(get_db),
              me: models.User = Depends(get_current_user)):
    """Mark all messages in conversation as read for current user."""
    read_ids = db.query(models.ConvMessageRead.message_id).filter(
        models.ConvMessageRead.user_id == me.id
    ).subquery()
    unread_msgs = db.query(models.ConvMessage).filter(
        models.ConvMessage.conversation_id == conv_id,
        models.ConvMessage.sender_id != me.id,
        ~models.ConvMessage.id.in_(read_ids)
    ).all()
    now = datetime.now(timezone.utc)
    for m in unread_msgs:
        db.add(models.ConvMessageRead(message_id=m.id, user_id=me.id, read_at=now))
    db.commit()
    return {"marked": len(unread_msgs)}


@conv_router.delete("/{conv_id}", status_code=204)
def delete_conversation(conv_id: int, db: Session = Depends(get_db),
                        me: models.User = Depends(get_current_user)):
    """Delete (archive) a conversation. Admin or creator only for groups."""
    conv = db.query(models.Conversation).filter(models.Conversation.id == conv_id).first()
    if not conv:
        raise HTTPException(404, "Conversation introuvable")
    _verify_participant(db, conv_id, me.id)
    if conv.type == "group":
        my_part = db.query(models.ConversationParticipant).filter(
            models.ConversationParticipant.conversation_id == conv_id,
            models.ConversationParticipant.user_id == me.id,
            models.ConversationParticipant.is_active == True
        ).first()
        if (not my_part or my_part.role_in_conv != "admin") and me.role not in ("direction", "responsable"):
            raise HTTPException(403, "Seuls les admins du groupe peuvent le supprimer")
    conv.is_archived = True
    db.commit()
