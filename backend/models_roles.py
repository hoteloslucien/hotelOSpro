"""
Hotel OS — Modèles Rôles & Permissions
Tables : roles, permissions, role_permissions
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


class Role(Base):
    __tablename__ = "roles"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String(50), unique=True, nullable=False)   # ex: technicien
    label      = Column(String(100), nullable=False)               # ex: Technicien
    is_active  = Column(Boolean, default=True)
    is_system  = Column(Boolean, default=False)  # rôles système non supprimables
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    role_permissions = relationship("RolePermission", back_populates="role",
                                    cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Role {self.name}>"


class Permission(Base):
    __tablename__ = "permissions"

    id     = Column(Integer, primary_key=True, index=True)
    module = Column(String(50), nullable=False)   # ex: interventions
    action = Column(String(50), nullable=False)   # ex: assign
    code   = Column(String(100), unique=True, nullable=False)  # ex: interventions.assign
    label  = Column(String(150), nullable=True)   # ex: Assigner une intervention

    role_permissions = relationship("RolePermission", back_populates="permission")

    def __repr__(self):
        return f"<Permission {self.code}>"


class RolePermission(Base):
    __tablename__ = "role_permissions"

    id            = Column(Integer, primary_key=True, index=True)
    role_id       = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    permission_id = Column(Integer, ForeignKey("permissions.id", ondelete="CASCADE"), nullable=False)

    __table_args__ = (
        UniqueConstraint("role_id", "permission_id", name="uq_role_permission"),
    )

    role       = relationship("Role",       back_populates="role_permissions")
    permission = relationship("Permission", back_populates="role_permissions")
