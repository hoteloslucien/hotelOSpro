"""Hotel OS — Routes Notifications"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel

from .database import get_db
from . import models, schemas
from .auth import get_current_user
from .notifications import notify_role

notifications_router = APIRouter(prefix="/notifications", tags=["Notifications"])


@notifications_router.get("", response_model=List[schemas.NotificationOut])
def list_notifications(limit: int = 50, db: Session = Depends(get_db),
                       me: models.User = Depends(get_current_user)):
    return (db.query(models.Notification)
            .filter(models.Notification.user_id == me.id)
            .order_by(models.Notification.created_at.desc())
            .limit(limit).all())


@notifications_router.get("/unread-count")
def unread_count(db: Session = Depends(get_db),
                 me: models.User = Depends(get_current_user)):
    count = (db.query(models.Notification)
             .filter(models.Notification.user_id == me.id,
                     models.Notification.is_read == False)
             .count())
    return {"count": count}


class NotifCreateForRole(BaseModel):
    role: str
    type: str
    title: str
    message: str
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    priority: str = "medium"


@notifications_router.post("/create-for-role")
def create_for_role(payload: NotifCreateForRole, db: Session = Depends(get_db),
                    me: models.User = Depends(get_current_user)):
    """Create notifications for all users of a given role."""
    notify_role(db, payload.role, hotel_id=me.hotel_id,
                type=payload.type, title=payload.title, message=payload.message,
                entity_type=payload.entity_type, entity_id=payload.entity_id,
                priority=payload.priority, exclude_user_id=me.id)
    db.commit()
    return {"ok": True}


@notifications_router.post("/{notification_id}/read")
def mark_one_read(notification_id: int, db: Session = Depends(get_db),
                  me: models.User = Depends(get_current_user)):
    notif = (db.query(models.Notification)
             .filter(models.Notification.id == notification_id,
                     models.Notification.user_id == me.id).first())
    if not notif:
        raise HTTPException(404, "Notification introuvable")
    notif.is_read = True
    notif.read_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True}


@notifications_router.post("/read")
def mark_many_read(payload: schemas.NotificationMarkRead, db: Session = Depends(get_db),
                   me: models.User = Depends(get_current_user)):
    notifs = (db.query(models.Notification)
              .filter(models.Notification.user_id == me.id,
                      models.Notification.id.in_(payload.notification_ids)).all())
    now = datetime.now(timezone.utc)
    for n in notifs:
        n.is_read = True
        n.read_at = now
    db.commit()
    return {"ok": True, "updated": len(notifs)}


@notifications_router.post("/read-all")
def mark_all_read(db: Session = Depends(get_db),
                  me: models.User = Depends(get_current_user)):
    notifs = (db.query(models.Notification)
              .filter(models.Notification.user_id == me.id,
                      models.Notification.is_read == False).all())
    now = datetime.now(timezone.utc)
    for n in notifs:
        n.is_read = True
        n.read_at = now
    db.commit()
    return {"ok": True, "updated": len(notifs)}
