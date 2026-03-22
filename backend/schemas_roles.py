"""
Hotel OS — Schémas Pydantic — Rôles & Permissions
"""

from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


# ── Permission ────────────────────────────────────────────────────────────────

class PermissionOut(BaseModel):
    id:     int
    module: str
    action: str
    code:   str
    label:  Optional[str]
    class Config:
        from_attributes = True


# ── Role ──────────────────────────────────────────────────────────────────────

class RoleCreate(BaseModel):
    name:      str
    label:     str
    is_active: bool = True

class RoleUpdate(BaseModel):
    label:     Optional[str] = None
    is_active: Optional[bool] = None

class RoleOut(BaseModel):
    id:         int
    name:       str
    label:      str
    is_active:  bool
    is_system:  bool
    created_at: datetime
    class Config:
        from_attributes = True

class RoleWithPermissions(RoleOut):
    permissions: List[PermissionOut] = []
    class Config:
        from_attributes = True


# ── Role permission update ─────────────────────────────────────────────────────

class RolePermissionsUpdate(BaseModel):
    permission_codes: List[str]   # liste complète des codes à affecter au rôle


# ── User with role (extension) ────────────────────────────────────────────────

class UserPermissions(BaseModel):
    """Réponse pour /auth/my-permissions"""
    role:        str
    permissions: List[str]   # liste des codes ex: ["interventions.view", ...]
