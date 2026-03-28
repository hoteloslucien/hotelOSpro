"""
Hotel OS — Point d'entrée FastAPI
Sert à la fois l'API ET le frontend statique.
Une seule URL pour tout → déployable sur Railway/Render en 5 min.

Local  : uvicorn backend.main:app --reload
Prod   : gunicorn backend.main:app -w 2 -k uvicorn.workers.UvicornWorker
"""

import os
from pathlib import Path

print("!! MAIN LOADED")

from fastapi import FastAPI
from  backend.routers_settings import settings_router

app = FastAPI()

app.include_router(settings_router)

from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .database import Base, engine, SessionLocal
from . import models
from . import models_roles


def ensure_bootstrap_data():
    db = SessionLocal()
    try:
        direction_role = db.query(models_roles.Role).filter(
            models_roles.Role.name == "direction",
            models_roles.Role.is_active == True
        ).first()

        has_permissions = db.query(models_roles.Permission).first() is not None

        has_direction_perms = False
        if direction_role:
            has_direction_perms = db.query(models_roles.RolePermission).filter(
                models_roles.RolePermission.role_id == direction_role.id
            ).first() is not None

        has_admin = db.query(models.User).filter(
            models.User.email == "admin@hotel.fr"
        ).first() is not None

        if direction_role and has_permissions and has_direction_perms and has_admin:
            return
    finally:
        db.close()

    from . import seed
    seed.run()


Base.metadata.create_all(bind=engine)
ensure_bootstrap_data()

app = FastAPI(title="Hotel OS", version="1.0.0")

# CORS — * en dev, restreindre via ALLOWED_ORIGINS en production
# Ex: ALLOWED_ORIGINS=https://mon-hotel.railway.app,https://mon-hotel.onrender.com
_raw_origins = os.getenv("ALLOWED_ORIGINS", "*")
_origins = [o.strip() for o in _raw_origins.split(",")] if _raw_origins != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

@app.get("/health", tags=["Santé"])
def health():
    """Healthcheck Railway/Render — répond toujours 200."""
    return {"status": "ok", "version": "1.0.0"}

# Imports routeurs après bootstrap DB
from .routers import (
    auth_router,
    users_router,
    rooms_router,
    tasks_router,
    interventions_router,
    rounds_router,
    qr_router,
    reviews_router,
    equipment_router,
    stock_router,
    dashboard_router,
)
from .routers_socle import hotels_router, zones_router, services_router, audit_router
from .routers_attendance import attendance_router
from .routers_conversations import conv_router
from .routers_notifications import notifications_router
from .routers_roles import (
    roles_router,
    permissions_router,
    my_perms_router,
    settings_users_router,
)
from .routers_settings import settings_router

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(rooms_router)
app.include_router(tasks_router)
app.include_router(interventions_router)
app.include_router(rounds_router)
app.include_router(qr_router)
app.include_router(reviews_router)
app.include_router(equipment_router)
app.include_router(stock_router)
app.include_router(dashboard_router)

app.include_router(hotels_router)
app.include_router(zones_router)
app.include_router(services_router)
app.include_router(audit_router)

app.include_router(attendance_router)
app.include_router(conv_router)
app.include_router(notifications_router)

app.include_router(roles_router)
app.include_router(permissions_router)
app.include_router(my_perms_router)
app.include_router(settings_users_router)
app.include_router(settings_router)

# Frontend statique
BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"

if FRONTEND_DIR.exists():
    css_dir = FRONTEND_DIR / "css"
    js_dir = FRONTEND_DIR / "js"
    icons_dir = FRONTEND_DIR / "icons"
    assets_dir = FRONTEND_DIR / "assets"

    if css_dir.exists():
        app.mount("/css", StaticFiles(directory=str(css_dir)), name="css")
    if js_dir.exists():
        app.mount("/js", StaticFiles(directory=str(js_dir)), name="js")
    if icons_dir.exists():
        app.mount("/icons", StaticFiles(directory=str(icons_dir)), name="icons")
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")


@app.get("/")
def serve_index():
    index_file = FRONTEND_DIR / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    return {"status": "ok", "message": "Hotel OS backend running"}