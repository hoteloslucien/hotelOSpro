"""
Hotel OS — Seed données de démonstration
Lance avec : python -m backend.seed
"""

def run():
    from .database import SessionLocal, Base, engine
    from . import models
    from .models_roles import Role, Permission, RolePermission
    from .auth import hash_password

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        print("SEED.PY APPELE")

        perms_data = [
            ("dashboard", "view", "Voir le dashboard"),
            ("users", "view", "Voir les utilisateurs"),
            ("users", "create", "Créer un utilisateur"),
            ("users", "update", "Modifier un utilisateur"),
        ]

        perm_map = {}

        for module, action, label in perms_data:
            code = f"{module}.{action}"

            existing = db.query(Permission).filter(Permission.code == code).first()
            if existing:
                perm_map[code] = existing
                continue

            p = Permission(
                module=module,
                action=action,
                code=code,
                label=label,
            )
            db.add(p)
            db.flush()
            perm_map[code] = p

        print(f"{len(perm_map)} permissions créées")

        user = models.User(
            name="Admin",
            email="admin@hotel.fr",
            password_hash=hash_password("admin123"),
            role="direction"
        )
        db.add(user)

        db.commit()
        print("Seed terminé")

    except Exception as e:
        db.rollback()
        print("Erreur seed:", e)

    finally:
        db.close()


if __name__ == "__main__":
    run()
