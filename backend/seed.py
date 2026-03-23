from .database import Base, engine, SessionLocal
from . import models
from .models_roles import Role, Permission, RolePermission
from .auth import hash_password


def run():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # ----------------------------
        # 1) Permissions
        # ----------------------------
        perms_data = [
            # Dashboard
            ("dashboard", "view", "Voir le dashboard"),

            # Users
            ("users", "view", "Voir les utilisateurs"),
            ("users", "create", "Créer un utilisateur"),
            ("users", "update", "Modifier un utilisateur"),

            # Rooms
            ("rooms", "view", "Voir les chambres"),
            ("rooms", "create", "Créer une chambre"),
            ("rooms", "update", "Modifier une chambre"),
            ("rooms", "delete", "Supprimer une chambre"),

            # Tasks
            ("tasks", "view", "Voir les tâches"),
            ("tasks", "create", "Créer une tâche"),
            ("tasks", "update", "Modifier une tâche"),
            ("tasks", "delete", "Supprimer une tâche"),
            ("tasks", "assign", "Assigner une tâche"),
            ("tasks", "validate", "Valider une tâche"),
            ("tasks", "refuse", "Refuser une tâche"),

            # Interventions
            ("interventions", "view", "Voir les interventions"),
            ("interventions", "create", "Créer une intervention"),
            ("interventions", "update", "Modifier une intervention"),
            ("interventions", "take", "Prendre en charge une intervention"),
            ("interventions", "pause", "Mettre en pause une intervention"),
            ("interventions", "close", "Clôturer une intervention"),

            # Rounds / tournées
            ("rounds", "view", "Voir les tournées"),
            ("rounds", "create", "Créer une tournée"),
            ("rounds", "update", "Modifier une tournée"),
            ("rounds", "run", "Exécuter une tournée"),

            # Attendance / présence
            ("attendance", "view", "Voir la présence"),
            ("attendance", "start", "Démarrer un poste"),
            ("attendance", "finish", "Terminer un poste"),

            # Conversations / messages
            ("conversations", "view", "Voir les conversations"),
            ("conversations", "create", "Créer une conversation"),
            ("conversations", "update", "Modifier une conversation"),
            ("conversations", "delete", "Supprimer/archiver une conversation"),
            ("messages", "view", "Voir les messages"),
            ("messages", "send", "Envoyer des messages"),

            # Reviews / avis clients
            ("reviews", "view", "Voir les avis clients"),
            ("reviews", "update", "Modifier / traiter les avis clients"),

            # Equipment / équipements
            ("equipment", "view", "Voir les équipements"),
            ("equipment", "create", "Créer un équipement"),
            ("equipment", "update", "Modifier un équipement"),
            ("equipment", "delete", "Supprimer un équipement"),

            # Notifications
            ("notifications", "view", "Voir les notifications"),

            # Stock
            ("stock", "view", "Voir le stock"),
            ("stock", "create", "Créer un article de stock"),
            ("stock", "update", "Modifier le stock"),
            ("stock", "delete", "Supprimer un article de stock"),

            # Settings
            ("settings", "view", "Voir les réglages"),
            ("settings", "update", "Modifier les réglages"),

            # Hotels / zones
            ("hotels", "view", "Voir les hôtels"),
            ("hotels", "create", "Créer un hôtel"),
            ("hotels", "update", "Modifier un hôtel"),
            ("zones", "view", "Voir les zones"),
            ("zones", "create", "Créer une zone"),
            ("zones", "update", "Modifier une zone"),
            ("zones", "delete", "Supprimer une zone"),
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

        print(f"{len(perm_map)} permissions prêtes")

        # ----------------------------
        # 2) Rôles
        # ----------------------------
        roles_data = {
            "direction": {
                "label": "Direction",
                "permissions": list(perm_map.keys()),
            },
            "responsable_technique": {
                "label": "Responsable technique",
                "permissions": [
                    "dashboard.view",
                    "users.view",
                    "rooms.view",
                    "rooms.update",
                    "tasks.view",
                    "tasks.create",
                    "tasks.update",
                    "tasks.assign",
                    "tasks.validate",
                    "tasks.refuse",
                    "interventions.view",
                    "interventions.create",
                    "interventions.update",
                    "interventions.take",
                    "interventions.pause",
                    "interventions.close",
                    "rounds.view",
                    "rounds.create",
                    "rounds.update",
                    "rounds.run",
                    "attendance.view",
                    "messages.view",
                    "messages.send",
                    "conversations.view",
                    "conversations.create",
                    "conversations.update",
                    "reviews.view",
                    "equipment.view",
                    "equipment.create",
                    "equipment.update",
                    "equipment.delete",
                    "notifications.view",
                    "stock.view",
                    "stock.create",
                    "stock.update",
                    "settings.view",
                    "zones.view",
                    "zones.create",
                    "zones.update",
                    "zones.delete",
                ],
            },
            "adjoint_technique": {
                "label": "Adjoint technique",
                "permissions": [
                    "dashboard.view",
                    "users.view",
                    "rooms.view",
                    "rooms.update",
                    "tasks.view",
                    "tasks.create",
                    "tasks.update",
                    "tasks.assign",
                    "interventions.view",
                    "interventions.create",
                    "interventions.update",
                    "interventions.take",
                    "interventions.pause",
                    "interventions.close",
                    "rounds.view",
                    "rounds.run",
                    "attendance.view",
                    "messages.view",
                    "messages.send",
                    "conversations.view",
                    "conversations.create",
                    "reviews.view",
                    "equipment.view",
                    "equipment.create",
                    "equipment.update",
                    "equipment.delete",
                    "notifications.view",
                    "stock.view",
                    "stock.update",
                    "settings.view",
                    "zones.view",
                ],
            },
            "chef_equipe_technique": {
                "label": "Chef d’équipe technique",
                "permissions": [
                    "dashboard.view",
                    "rooms.view",
                    "tasks.view",
                    "tasks.create",
                    "tasks.update",
                    "tasks.assign",
                    "interventions.view",
                    "interventions.create",
                    "interventions.update",
                    "interventions.take",
                    "interventions.pause",
                    "interventions.close",
                    "rounds.view",
                    "rounds.run",
                    "attendance.view",
                    "messages.view",
                    "messages.send",
                    "conversations.view",
                    "conversations.create",
                    "equipment.view",
                    "equipment.update",
                    "notifications.view",
                    "stock.view",
                    "stock.update",
                    "zones.view",
                ],
            },
            "technicien": {
                "label": "Technicien",
                "permissions": [
                    "dashboard.view",
                    "rooms.view",
                    "tasks.view",
                    "tasks.update",
                    "interventions.view",
                    "interventions.take",
                    "interventions.pause",
                    "interventions.close",
                    "rounds.view",
                    "rounds.run",
                    "attendance.view",
                    "attendance.start",
                    "attendance.finish",
                    "messages.view",
                    "messages.send",
                    "conversations.view",
                    "equipment.view",
                    "notifications.view",
                    "stock.view",
                ],
            },
            "gouvernante_generale": {
                "label": "Gouvernante générale",
                "permissions": [
                    "dashboard.view",
                    "users.view",
                    "rooms.view",
                    "rooms.update",
                    "tasks.view",
                    "tasks.create",
                    "tasks.update",
                    "tasks.assign",
                    "tasks.validate",
                    "tasks.refuse",
                    "attendance.view",
                    "messages.view",
                    "messages.send",
                    "conversations.view",
                    "conversations.create",
                    "reviews.view",
                    "notifications.view",
                    "zones.view",
                ],
            },
            "gouvernante": {
                "label": "Gouvernante",
                "permissions": [
                    "dashboard.view",
                    "rooms.view",
                    "rooms.update",
                    "tasks.view",
                    "tasks.create",
                    "tasks.update",
                    "tasks.assign",
                    "attendance.view",
                    "messages.view",
                    "messages.send",
                    "conversations.view",
                    "reviews.view",
                    "notifications.view",
                ],
            },
            "reception": {
                "label": "Réception",
                "permissions": [
                    "dashboard.view",
                    "rooms.view",
                    "interventions.view",
                    "interventions.create",
                    "messages.view",
                    "messages.send",
                    "conversations.view",
                    "conversations.create",
                    "reviews.view",
                    "reviews.update",
                    "notifications.view",
                ],
            },
            "duty_manager": {
                "label": "Duty manager",
                "permissions": [
                    "dashboard.view",
                    "rooms.view",
                    "tasks.view",
                    "tasks.update",
                    "interventions.view",
                    "interventions.create",
                    "interventions.update",
                    "interventions.close",
                    "messages.view",
                    "messages.send",
                    "conversations.view",
                    "conversations.create",
                    "reviews.view",
                    "reviews.update",
                    "notifications.view",
                    "attendance.view",
                    "zones.view",
                ],
            },
            "securite": {
                "label": "Sécurité",
                "permissions": [
                    "dashboard.view",
                    "rooms.view",
                    "interventions.view",
                    "interventions.create",
                    "rounds.view",
                    "rounds.run",
                    "messages.view",
                    "messages.send",
                    "conversations.view",
                    "notifications.view",
                ],
            },
            "responsable_hebergement": {
                "label": "Responsable hébergement",
                "permissions": [
                    "dashboard.view",
                    "users.view",
                    "rooms.view",
                    "rooms.update",
                    "tasks.view",
                    "tasks.create",
                    "tasks.update",
                    "tasks.assign",
                    "tasks.validate",
                    "tasks.refuse",
                    "attendance.view",
                    "messages.view",
                    "messages.send",
                    "conversations.view",
                    "conversations.create",
                    "reviews.view",
                    "reviews.update",
                    "notifications.view",
                    "zones.view",
                ],
            },
            "responsable_restauration": {
                "label": "Responsable restauration",
                "permissions": [
                    "dashboard.view",
                    "tasks.view",
                    "tasks.create",
                    "tasks.update",
                    "tasks.assign",
                    "messages.view",
                    "messages.send",
                    "conversations.view",
                    "notifications.view",
                ],
            },
        }

        role_map = {}

        for code, data in roles_data.items():
            role = db.query(Role).filter(Role.code == code).first()
            if not role:
                role = Role(code=code, label=data["label"])
                db.add(role)
                db.flush()
            role_map[code] = role

        # ----------------------------
        # 3) Liaisons rôle -> permissions
        # ----------------------------
        for role_code, data in roles_data.items():
            role = role_map[role_code]

            for perm_code in data["permissions"]:
                perm = perm_map.get(perm_code)
                if not perm:
                    continue

                existing_rp = db.query(RolePermission).filter(
                    RolePermission.role_id == role.id,
                    RolePermission.permission_id == perm.id
                ).first()

                if not existing_rp:
                    db.add(
                        RolePermission(
                            role_id=role.id,
                            permission_id=perm.id
                        )
                    )

        # ----------------------------
        # 4) Utilisateurs de test
        # ----------------------------
        users_data = [
            {
                "name": "Direction Générale",
                "email": "direction@hotel.fr",
                "password": "Admin123!",
                "role": "direction",
                "service": "Direction",
            },
            {
                "name": "Directeur Technique",
                "email": "resptech@hotel.fr",
                "password": "Admin123!",
                "role": "responsable_technique",
                "service": "Technique",
            },
            {
                "name": "Adjoint Technique",
                "email": "adjtech@hotel.fr",
                "password": "Admin123!",
                "role": "adjoint_technique",
                "service": "Technique",
            },
            {
                "name": "Chef Équipe Technique",
                "email": "cheftech@hotel.fr",
                "password": "Admin123!",
                "role": "chef_equipe_technique",
                "service": "Technique",
            },
            {
                "name": "Technicien 1",
                "email": "tech1@hotel.fr",
                "password": "Admin123!",
                "role": "technicien",
                "service": "Technique",
            },
            {
                "name": "Technicien 2",
                "email": "tech2@hotel.fr",
                "password": "Admin123!",
                "role": "technicien",
                "service": "Technique",
            },
            {
                "name": "Gouvernante Générale",
                "email": "gouvernante@hotel.fr",
                "password": "Admin123!",
                "role": "gouvernante_generale",
                "service": "Housekeeping",
            },
            {
                "name": "Gouvernante 1",
                "email": "gouv1@hotel.fr",
                "password": "Admin123!",
                "role": "gouvernante",
                "service": "Housekeeping",
            },
            {
                "name": "Gouvernante 2",
                "email": "gouv2@hotel.fr",
                "password": "Admin123!",
                "role": "gouvernante",
                "service": "Housekeeping",
            },
            {
                "name": "Réception 1",
                "email": "reception1@hotel.fr",
                "password": "Admin123!",
                "role": "reception",
                "service": "Réception",
            },
            {
                "name": "Réception 2",
                "email": "reception2@hotel.fr",
                "password": "Admin123!",
                "role": "reception",
                "service": "Réception",
            },
            {
                "name": "Duty Manager",
                "email": "duty1@hotel.fr",
                "password": "Admin123!",
                "role": "duty_manager",
                "service": "Exploitation",
            },
            {
                "name": "Sécurité 1",
                "email": "securite1@hotel.fr",
                "password": "Admin123!",
                "role": "securite",
                "service": "Sécurité",
            },
            {
                "name": "Responsable Hébergement",
                "email": "hebergement@hotel.fr",
                "password": "Admin123!",
                "role": "responsable_hebergement",
                "service": "Hébergement",
            },
            {
                "name": "Responsable Restauration",
                "email": "restauration@hotel.fr",
                "password": "Admin123!",
                "role": "responsable_restauration",
                "service": "Restauration",
            },
            {
                "name": "Admin",
                "email": "admin@hotel.fr",
                "password": "admin123",
                "role": "direction",
                "service": "Direction",
            },
        ]

        for u in users_data:
            existing_user = db.query(models.User).filter(models.User.email == u["email"]).first()
            if existing_user:
                # si l'utilisateur existe mais sans hash, on le corrige
                if not getattr(existing_user, "password_hash", None):
                    existing_user.password_hash = hash_password(u["password"])
                if not getattr(existing_user, "role", None):
                    existing_user.role = u["role"]
                if hasattr(existing_user, "service") and not getattr(existing_user, "service", None):
                    existing_user.service = u["service"]
                if hasattr(existing_user, "is_active"):
                    existing_user.is_active = True
                continue

            user = models.User(
                name=u["name"],
                email=u["email"],
                password_hash=hash_password(u["password"]),
                role=u["role"],
                service=u["service"],
                is_active=True,
            )
            db.add(user)

        db.commit()
        print("Seed terminé")

    except Exception as e:
        db.rollback()
        print("Erreur seed:", e)
        raise

    finally:
        db.close()


if __name__ == "__main__":
    run()