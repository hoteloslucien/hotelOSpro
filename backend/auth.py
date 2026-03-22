"""Hotel OS — Auth complet corrigé (bcrypt direct + JWT + compat legacy)"""

import os
import jwt
import bcrypt
from datetime import datetime, timedelta, timezone

# from passlib.context import CryptContext
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from .database import get_db
from . import models


SECRET_KEY = os.getenv("SECRET_KEY", "hotel-os-dev-secret-change-in-prod")
ALGORITHM = "HS256"
ACCESS_EXPIRE_MIN = 1440  # 24h — confortable pour démo/terrain
REFRESH_EXPIRE_DAYS = 30

# pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer()


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    if not hashed:
        return False

    # Compat ancien mode texte brut
    if not hashed.startswith("$2a$") and not hashed.startswith("$2b$") and not hashed.startswith("$2y$"):
        return plain == hashed

    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(uid, role, hotel_id=None):
    exp = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_EXPIRE_MIN)
    payload = {"sub": str(uid), "role": role, "type": "access", "exp": exp}
    if hotel_id is not None:
        payload["hotel_id"] = hotel_id
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(uid):
    exp = datetime.now(timezone.utc) + timedelta(days=REFRESH_EXPIRE_DAYS)
    return jwt.encode(
        {"sub": str(uid), "type": "refresh", "exp": exp},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def create_token(uid, role, hotel_id=None):
    return create_access_token(uid, role, hotel_id)


def decode_token(token):
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except Exception:
        return None


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
):
    token = creds.credentials
    payload = decode_token(token)

    if not payload or payload.get("type") != "access":
        raise HTTPException(401, "Token invalide")

    uid = payload.get("sub")
    if not uid:
        raise HTTPException(401, "Token invalide")

    user = db.query(models.User).filter(models.User.id == int(uid)).first()
    if not user:
        raise HTTPException(401, "Utilisateur introuvable")

    return user


def get_current_active_user(
    me: models.User = Depends(get_current_user),
):
    if hasattr(me, "is_active") and not me.is_active:
        raise HTTPException(403, "Compte désactivé")
    return me


def require_roles(*roles):
    def _dep(me: models.User = Depends(get_current_active_user)):
        if roles and getattr(me, "role", None) not in roles:
            raise HTTPException(403, "Accès refusé")
        return me
    return _dep
