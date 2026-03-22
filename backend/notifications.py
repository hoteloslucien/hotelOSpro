"""Hotel OS — Service de notification centralisé

Convention : notify() / notify_many() / notify_role() ajoutent à la session
mais NE commitent PAS. L'appelant (routeur/service) doit faire db.commit()
après avoir terminé toute sa logique métier.
"""
from . import models


def notify(db, *, hotel_id=None, user_id, type, title, message,
           entity_type=None, entity_id=None, priority="medium"):
    """Crée une notification pour un utilisateur."""
    n = models.Notification(
        hotel_id=hotel_id, user_id=user_id, type=type,
        title=title, message=message,
        entity_type=entity_type, entity_id=entity_id,
        priority=priority,
    )
    db.add(n)
    return n


def notify_many(db, *, hotel_id=None, user_ids, type, title, message,
                entity_type=None, entity_id=None, priority="medium"):
    """Crée une notification pour plusieurs utilisateurs."""
    for uid in user_ids:
        notify(db, hotel_id=hotel_id, user_id=uid, type=type,
               title=title, message=message,
               entity_type=entity_type, entity_id=entity_id,
               priority=priority)


def notify_role(db, role, *, hotel_id=None, type, title, message,
                entity_type=None, entity_id=None, priority="medium",
                exclude_user_id=None):
    """Crée une notification pour tous les utilisateurs d'un rôle."""
    q = db.query(models.User).filter(models.User.is_active == True, models.User.role == role)
    if hotel_id:
        q = q.filter(models.User.hotel_id == hotel_id)
    for u in q.all():
        if exclude_user_id and u.id == exclude_user_id:
            continue
        notify(db, hotel_id=hotel_id, user_id=u.id, type=type,
               title=title, message=message,
               entity_type=entity_type, entity_id=entity_id,
               priority=priority)
