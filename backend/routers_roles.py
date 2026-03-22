"""
Hotel OS — Routes Rôles & Permissions
GET  /roles                       → liste des rôles
POST /roles                       → créer un rôle
PUT  /roles/{id}                  → modifier label / is_active
GET  /roles/{id}/permissions      → permissions d'un rôle
PUT  /roles/{id}/permissions      → remplacer toutes les permissions d'un rôle
GET  /permissions                 → catalogue complet des permissions
GET  /auth/my-permissions         → permissions de l'utilisateur connecté
GET  /settings/users              → liste utilisateurs (settings.view)
POST /settings/users              → créer utilisateur (users.create)
PATCH /settings/users/{id}        → modifier rôle/actif (users.update)
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from .database import get_db
from .auth import get_current_user, hash_password
from . import models
from .models_roles import Role, Permission, RolePermission
from .schemas_roles import (
    RoleCreate, RoleUpdate, RoleOut, RoleWithPermissions,
    PermissionOut, RolePermissionsUpdate, UserPermissions,
)
from .schemas import UserCreate, UserOut
from .security import require_permission, get_user_permissions

# ── Rôles ─────────────────────────────────────────────────────────────────────

roles_router = APIRouter(prefix="/roles", tags=["Rôles"])


@roles_router.get("", response_model=List[RoleOut])
def list_roles(
    db: Session = Depends(get_db),
    _: models.User = Depends(require_permission("roles.view")),
):
    return db.query(Role).order_by(Role.id).all()


@roles_router.post("", response_model=RoleOut, status_code=201)
def create_role(
    data: RoleCreate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_permission("roles.create")),
):
    if db.query(Role).filter(Role.name == data.name).first():
        raise HTTPException(400, "Un rôle avec ce nom existe déjà")
    role = Role(**data.model_dump())
    db.add(role); db.commit(); db.refresh(role)
    return role


@roles_router.put("/{role_id}", response_model=RoleOut)
def update_role(
    role_id: int,
    data: RoleUpdate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_permission("roles.update")),
):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(404, "Rôle introuvable")
    if role.is_system and data.is_active is False:
        raise HTTPException(400, "Impossible de désactiver un rôle système")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(role, k, v)
    db.commit(); db.refresh(role)
    return role


@roles_router.get("/{role_id}/permissions", response_model=RoleWithPermissions)
def get_role_permissions(
    role_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_permission("roles.view")),
):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(404, "Rôle introuvable")
    perms = (
        db.query(Permission)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .filter(RolePermission.role_id == role_id)
        .all()
    )
    return RoleWithPermissions(
        **{c: getattr(role, c) for c in ["id","name","label","is_active","is_system","created_at"]},
        permissions=perms,
    )


@roles_router.put("/{role_id}/permissions", response_model=RoleWithPermissions)
def set_role_permissions(
    role_id: int,
    data: RolePermissionsUpdate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_permission("roles.update")),
):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(404, "Rôle introuvable")

    # Supprimer toutes les permissions actuelles
    db.query(RolePermission).filter(RolePermission.role_id == role_id).delete()

    # Ajouter les nouvelles
    codes_added = []
    for code in data.permission_codes:
        perm = db.query(Permission).filter(Permission.code == code).first()
        if perm:
            db.add(RolePermission(role_id=role_id, permission_id=perm.id))
            codes_added.append(perm)

    db.commit()

    return RoleWithPermissions(
        **{c: getattr(role, c) for c in ["id","name","label","is_active","is_system","created_at"]},
        permissions=codes_added,
    )


# ── Permissions catalogue ──────────────────────────────────────────────────────

permissions_router = APIRouter(prefix="/permissions", tags=["Permissions"])


@permissions_router.get("", response_model=List[PermissionOut])
def list_permissions(
    db: Session = Depends(get_db),
    _: models.User = Depends(require_permission("roles.view")),
):
    return db.query(Permission).order_by(Permission.module, Permission.action).all()


# ── My permissions ─────────────────────────────────────────────────────────────

my_perms_router = APIRouter(tags=["Auth"])


@my_perms_router.get("/auth/my-permissions", response_model=UserPermissions)
def my_permissions(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    perms = get_user_permissions(current_user, db)
    return UserPermissions(role=current_user.role, permissions=perms)


# ── Settings — Users management ───────────────────────────────────────────────

settings_users_router = APIRouter(prefix="/settings/users", tags=["Réglages"])


@settings_users_router.get("", response_model=List[UserOut])
def settings_list_users(
    db: Session = Depends(get_db),
    _: models.User = Depends(require_permission("users.view")),
):
    return db.query(models.User).order_by(models.User.name).all()


@settings_users_router.post("", response_model=UserOut, status_code=201)
def settings_create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_permission("users.create")),
):
    if db.query(models.User).filter(models.User.email == data.email).first():
        raise HTTPException(400, "Email déjà utilisé")
    user = models.User(
        name=data.name, email=data.email,
        password_hash=hash_password(data.password),
        role=data.role, service=data.service,
    )
    db.add(user); db.commit(); db.refresh(user)
    return user


@settings_users_router.patch("/{user_id}", response_model=UserOut)
def settings_update_user(
    user_id: int,
    role: str | None = None,
    is_active: bool | None = None,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_permission("users.update")),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Utilisateur introuvable")
    if role is not None:
        # Vérifier que le rôle existe
        if not db.query(Role).filter(Role.name == role, Role.is_active == True).first():
            raise HTTPException(400, f"Rôle inconnu ou inactif : {role}")
        user.role = role
    if is_active is not None:
        user.is_active = is_active
    db.commit(); db.refresh(user)
    return user
