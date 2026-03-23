"""
Hotel OS — Point d'entrée FastAPI
Sert à la fois l'API ET le frontend statique.
Une seule URL pour tout → déployable sur Railway/Render en 5 min.

Local  : uvicorn backend.main:app --reload
Prod   : gunicorn backend.main:app -w 2 -k uvicorn.workers.UvicornWorker
"""

import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from .database import Base, engine, SessionLocal
from .auth import hash_password
from . import models          # noqa — enregistre les modèles métier
from . import models_roles    # noqa — enregistre les modèles rôles/permissions

def ensure_bootstrap_data():
    db = SessionLocal()
    try:
        has_user = db.query(models.User).first() is not None
        has_role = db.query(models_roles.Role).first() is not None
        has_perm = db.query(models_roles.Permission).first() is not None

        has_role_perm = False
        if hasattr(models_roles, "RolePermission"):
            has_role_perm = db.query(models_roles.RolePermission).first() is not None
        elif hasattr(models_roles, "role_permissions"):
            result = db.execute(models_roles.role_permissions.select().limit(1)).first()
            has_role_perm = result is not None

        if has_user and has_role and has_perm and has_role_perm:
            return
    finally:
        db.close()

    from . import seed
    seed.run()


Base.metadata.create_all(bind=engine)
ensure_bootstrap_data()



from .routers import (
    auth_router, users_router, rooms_router, tasks_router,
    interventions_router, rounds_router,
    qr_router, reviews_router, equipment_router, stock_router,
    dashboard_router,
)
from .routers_socle import hotels_router, zones_router, services_router, audit_router
from .routers_attendance import attendance_router
from .routers_conversations import conv_router
from .routers_notifications import notifications_router
from .routers_roles import (
    roles_router, permissions_router,
    my_perms_router, settings_users_router,
)

# ── App ────────────────────────────────────────────────────────────────────────
# IMPORTANT : app créé AVANT tout décorateur @app.*

app = FastAPI(
    title="Hotel OS API",
    description="Système opérationnel hôtelier",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    redirect_slashes=True,    # tolère /rooms et /rooms/ sans casser
)

# ── CORS ───────────────────────────────────────────────────────────────────────
_raw_origins = os.getenv("ALLOWED_ORIGINS", "*")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Seed automatique désactivé en production ──────────────────────────────────────────────


# ── API routers — métier ───────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(rooms_router)
app.include_router(tasks_router)
app.include_router(interventions_router)
app.include_router(rounds_router)
# messages_router removed — legacy, replaced by conversations_router
app.include_router(qr_router)
app.include_router(reviews_router)
app.include_router(equipment_router)
app.include_router(stock_router)
app.include_router(dashboard_router)

# ── API routers — rôles, permissions, réglages ────────────────────────────────
app.include_router(roles_router)
app.include_router(permissions_router)
app.include_router(my_perms_router)
app.include_router(settings_users_router)
app.include_router(hotels_router)
app.include_router(zones_router)
app.include_router(services_router)
app.include_router(audit_router)
app.include_router(attendance_router)
app.include_router(conv_router)
app.include_router(notifications_router)

# ── Health check ───────────────────────────────────────────────────────────────
# IMPORTANT : déclaré AVANT la catch-all SPA
@app.get("/health", tags=["Système"])
def health():
    return {"status": "ok", "version": "1.0.0"}

# ── Servir le frontend statique ────────────────────────────────────────────────
FRONTEND = Path(__file__).parent.parent / "frontend"

if FRONTEND.exists():
    app.mount("/css", StaticFiles(directory=FRONTEND / "css"), name="css")
    app.mount("/js",  StaticFiles(directory=FRONTEND / "js"),  name="js")

    @app.get("/manifest.json")
    def manifest():
        return FileResponse(FRONTEND / "manifest.json")

    @app.get("/sw.js")
    def service_worker():
        return FileResponse(FRONTEND / "sw.js", media_type="application/javascript")

    @app.get("/icon-192.png")
    def icon192():
        return FileResponse(FRONTEND / "icon-192.png")

    @app.get("/icon-512.png")
    def icon512():
        return FileResponse(FRONTEND / "icon-512.png")

    # Catch-all SPA — DOIT être en dernier
    @app.get("/{full_path:path}")
    def spa(full_path: str):
        return FileResponse(FRONTEND / "index.html")
