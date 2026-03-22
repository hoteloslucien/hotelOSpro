# Hotel OS — Guide de démarrage

Application terrain pour hôtels. PWA installable sur téléphone.

---

## Démarrage local (test complet)

```bash
# 1. Environnement Python
python3 -m venv venv
source venv/bin/activate      # Mac/Linux
# venv\Scripts\activate       # Windows

# 2. Dépendances
pip install -r requirements.txt

# 3. Lancer (le seed s'exécute automatiquement au 1er démarrage)
uvicorn backend.main:app --reload

# 4. Ouvrir http://localhost:8000
```

Le seed est automatique au premier démarrage si la base est vide.
Pour le relancer manuellement : `python -m backend.seed`

---

## Comptes de test

| Rôle         | Email                | Mot de passe | Modules visibles                                                     |
|--------------|----------------------|--------------|----------------------------------------------------------------------|
| Direction    | direction1@hotel.fr  | admin123     | Tout                                                                 |
| Responsable  | gouvg@hotel.fr       | admin123     | Dashboard, Chambres, Interventions, Tâches, Tournées, Messages, Avis, Équipements, Stock |
| Gouvernante  | gouv1@hotel.fr       | admin123     | Dashboard, Chambres, Interventions, Tâches, Tournées, Messages      |
| Technicien   | tech1@hotel.fr       | admin123     | Dashboard, Interventions, Tâches, Chambres, Messages, Stock         |
| Technicien 2 | tech2@hotel.fr       | admin123     | Dashboard, Interventions, Tâches, Chambres, Messages, Stock         |
| Réception    | recep1@hotel.fr      | admin123     | Dashboard, Chambres, Interventions, Messages, Avis                  |

> Changer les mots de passe avant tout déploiement en production.

---

## Ce que fait chaque module

| Module        | Usage terrain                                      |
|---------------|-----------------------------------------------------|
| Dashboard     | Vue du jour adaptée au rôle connecté               |
| Interventions | Créer, prendre, suivre, clôturer une intervention  |
| Tâches        | Tâches planifiées avec statuts et priorités        |
| Chambres      | Statut en temps réel, ménage, disponibilité        |
| Messages      | Messagerie interne par canal (général, technique…) |
| Tournées      | Planification et suivi des tournées de ménage      |
| Avis clients  | Collecte et traitement des retours clients         |
| Équipements   | Inventaire et statut du matériel                   |
| Stock         | Gestion des consommables avec alertes              |

---

## Variables d'environnement

| Variable          | Défaut                               | Description                                  |
|-------------------|--------------------------------------|----------------------------------------------|
| DATABASE_URL      | sqlite:///./hotel_os.db              | URL base de données (PostgreSQL en prod)     |
| SECRET_KEY        | hotel-os-dev-secret-change-in-prod   | Clé de signature JWT — changer en prod       |
| ALLOWED_ORIGINS   | *                                    | CORS : https://ton-app.railway.app en prod   |

---

## Route santé

```
GET /health
{"status": "ok", "version": "1.0.0"}
```

Utilisée par Railway pour le healthcheck automatique.

---

## Déploiement sur Railway

Voir DEPLOIEMENT.md — 10 min, gratuit pour commencer.

---

## Structure du projet

```
hotelOS/
├── backend/
│   ├── __init__.py     - package Python
│   ├── main.py         - FastAPI + sert le frontend + seed auto
│   ├── database.py     - SQLite dev / PostgreSQL prod
│   ├── models.py       - Modèles SQLAlchemy
│   ├── routers.py      - Routes API
│   ├── schemas.py      - Validation Pydantic
│   ├── auth.py         - JWT + bcrypt
│   └── seed.py         - Données de démonstration
├── frontend/
│   ├── index.html
│   ├── sw.js           - Service Worker (installation mobile)
│   ├── manifest.json
│   ├── css/style.css
│   └── js/
│       ├── api.js      - Client HTTP centralisé
│       ├── app.js      - Navigation + filtrage par rôle
│       ├── utils.js
│       ├── modal.js
│       └── pages/      - Un fichier par module
├── Procfile
├── railway.json
├── nixpacks.toml
└── requirements.txt
```

---

## Checklist avant partage collègues

- Le projet démarre sans erreur (uvicorn backend.main:app --reload)
- /health répond {"status":"ok"} sur http://localhost:8000/health
- Le login fonctionne avec les comptes ci-dessus
- La console navigateur ne remonte aucune erreur rouge
- Les modules principaux (Dashboard, Interventions, Tâches, Chambres, Messages) s'affichent
- L'interface s'affiche correctement sur mobile
- La PWA s'installe via Safari (iPhone) ou Chrome (Android)
- SECRET_KEY est changée en prod
- ALLOWED_ORIGINS est restreinte en prod
