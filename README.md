# Hotel OS — Guide de démarrage

Application terrain pour hôtels. PWA installable sur téléphone.

---

## Démarrage local

```bash
python3 -m venv venv
source venv/bin/activate      # Mac/Linux
pip install -r requirements.txt
uvicorn backend.main:app --reload
# Ouvrir http://localhost:8000
```

Le seed s'exécute automatiquement au premier démarrage.

---

## Comptes de test

| Rôle | Email | Mot de passe |
|---|---|---|
| Direction | direction@hotel.fr | Admin123! |
| Responsable technique | resptech@hotel.fr | Admin123! |
| Adjoint technique | adjtech@hotel.fr | Admin123! |
| Chef équipe tech. | cheftech@hotel.fr | Admin123! |
| Technicien 1 | tech1@hotel.fr | Admin123! |
| Technicien 2 | tech2@hotel.fr | Admin123! |
| Gouvernante générale | gouvernante@hotel.fr | Admin123! |
| Gouvernante | gouv1@hotel.fr | Admin123! |
| Réception | reception1@hotel.fr | Admin123! |
| Duty Manager | duty1@hotel.fr | Admin123! |
| Admin | admin@hotel.fr | admin123 |

> Changer tous les mots de passe avant déploiement en production.

---

## Modules disponibles

| Module | Description |
|---|---|
| Dashboard | Vue du jour adaptée au rôle |
| Réglages | Hôtel, Zones, Chambres, Exploitation, Stock, Technique, Utilisateurs, Communication |
| Interventions | Créer, prendre, suivre, clôturer — avec filtres et workflows |
| Tâches | Planifiées avec statuts, priorités, assignation, validation |
| Chambres | Statut en temps réel, ménage, disponibilité, QR checkout |
| Conversations | Messagerie interne directe ou groupe |
| Tournées | Planification et suivi des rondes de ménage |
| Équipements | Inventaire familles/types/items avec statuts |
| Stock | Consommables avec mouvements et alertes de seuil |
| Présence | Gestion des postes, pauses, vues équipe |
| Notifications | Alertes temps réel par rôle |
| Avis clients | Collecte et traitement des retours post check-out |

---

## Variables d'environnement

| Variable | Défaut | Description |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./hotel_os.db` | PostgreSQL en production |
| `SECRET_KEY` | `hotel-os-dev-secret-change-in-prod` | Clé JWT — **obligatoire en prod** |
| `ALLOWED_ORIGINS` | `*` | CORS — restreindre en production |

---

## Route santé

```
GET /health
→ {"status": "ok", "version": "1.0.0"}
```

Utilisée par Railway/Render pour le healthcheck automatique.

---

## Structure du projet

```
hotelOSpro/
├── backend/
│   ├── main.py                  — FastAPI + /health + sert le frontend
│   ├── database.py              — SQLite dev / PostgreSQL prod
│   ├── models.py                — Tous les modèles SQLAlchemy
│   ├── models_roles.py          — Rôles et permissions
│   ├── schemas.py               — Validation Pydantic (Create/Update/Out)
│   ├── auth.py                  — JWT + bcrypt + require_roles
│   ├── security.py              — Vérification permissions granulaires
│   ├── seed.py                  — Rôles, permissions, comptes de base
│   ├── notifications.py         — Helpers notifications push
│   ├── routers.py               — Rooms, Tasks, Interventions, Stock, Dashboard, Rounds, Reviews
│   ├── routers_socle.py         — Hotels, Zones, Services, Audit
│   ├── routers_settings.py      — Référentiels : catégories, types, familles/types équipements
│   ├── routers_roles.py         — Rôles, permissions, users réglages
│   ├── routers_attendance.py    — Présence et postes
│   ├── routers_conversations.py — Conversations et messages
│   └── routers_notifications.py — Notifications
├── frontend/
│   ├── index.html
│   ├── sw.js                    — Service Worker (PWA + cache v13)
│   ├── manifest.json
│   ├── css/style.css
│   └── js/
│       ├── api.js               — Client HTTP centralisé (92+ méthodes)
│       ├── app.js               — Navigation + filtrage par rôle
│       ├── utils.js             — Helpers (label, badge, timeAgo, formatDate)
│       ├── modal.js             — Modale réutilisable avec formulaires
│       └── pages/
│           ├── settings.js      — Réglages généraux (8 onglets CRUD)
│           ├── dashboard.js
│           ├── interventions.js
│           ├── tasks.js
│           ├── rooms.js
│           ├── stock.js
│           ├── equipment.js
│           ├── conversations.js
│           ├── attendance.js
│           ├── notifications.js
│           ├── reviews.js
│           └── rounds.js
├── Procfile
├── railway.json
├── nixpacks.toml
└── requirements.txt
```

---

## Déploiement

Voir `DEPLOIEMENT.md` — environ 10 minutes sur Railway.

---

## Checklist avant partage

- [ ] `uvicorn backend.main:app --reload` démarre sans erreur
- [ ] `GET /health` → `{"status":"ok","version":"1.0.0"}`
- [ ] Login fonctionne avec les comptes ci-dessus
- [ ] Dashboard, Interventions, Tâches, Chambres s'affichent
- [ ] Réglages → tous les onglets opérationnels
- [ ] Interface correcte sur mobile
- [ ] PWA installable (Safari iPhone / Chrome Android)
- [ ] `SECRET_KEY` différente de la valeur par défaut en production
- [ ] `ALLOWED_ORIGINS` restreinte à ton domaine en production
