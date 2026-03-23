"""
Hotel OS — Vérification des permissions
Complète auth.py : vérifie les permissions granulaires par rôle.
"""

from typing import List

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from .database import get_db
from .auth import get_current_user
from . import models
from .models_roles import RolePermission, Permission, Role


def get_user_permissions(user: models.User, db: Session) -> List[str]:
    """Retourne la liste des codes de permission pour l'utilisateur connecté."""

    role = db.query(Role).filter(
        Role.name == user.role,
        Role.is_active == True
    ).first()

    if not role:
        return []

    perms = (
        db.query(Permission.code)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .filter(RolePermission.role_id == role.id)
        .all()
    )

    return [p.code for p in perms]


def require_permission(code: str):
    def dependency(
        current_user: models.User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        perms = get_user_permissions(current_user, db)
        if code not in perms:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permission refusée"
            )
        return current_user

    return dependency