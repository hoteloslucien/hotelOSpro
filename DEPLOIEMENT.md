# Déploiement Hotel OS sur Railway

---

## Résultat attendu

URL publique du type `https://hotel-os-xxx.railway.app`  
Tes collègues l'ouvrent → "Ajouter à l'écran d'accueil" → app installée.

**Coût : 0 € pour commencer** (Railway offre 5$/mois de crédit gratuit)

---

## Étape 1 — GitHub (5 min)

```bash
git init
git add .
git commit -m "Hotel OS v1"
git remote add origin https://github.com/TON_USERNAME/hotel-os.git
git push -u origin main
```

---

## Étape 2 — Railway (5 min)

1. **railway.app** → "New Project" → "Deploy from GitHub"
2. Sélectionner le repo → **Deploy**
3. Dans le projet → **"+ New"** → **"Database"** → **"PostgreSQL"**  
   (`DATABASE_URL` est injectée automatiquement)
4. **Variables** → ajouter :

| Variable | Valeur |
|---|---|
| `SECRET_KEY` | une-chaine-aleatoire-32-caracteres-minimum |
| `ALLOWED_ORIGINS` | https://hotel-os-xxx.railway.app |

5. Redéployer → attendre 2–3 min

---

## Étape 3 — Vérifier le healthcheck

```
https://ton-app.railway.app/health
→ {"status":"ok","version":"1.0.0"}
```

Railway vérifie cette route automatiquement via `railway.json`.  
Si le service est "unhealthy" → consulter les logs du build.

---

## Étape 4 — Seed automatique

Le seed s'exécute automatiquement au premier démarrage si la base est vide.  
Il crée : rôles, permissions et comptes utilisateurs.

Pour relancer manuellement (Railway → ton service → Shell) :

```bash
python -m backend.seed
```

---

## Étape 5 — Installation sur les téléphones

**Android (Chrome) :** Menu ⋮ → "Ajouter à l'écran d'accueil"

**iPhone (Safari uniquement) :** Bouton partage ↑ → "Sur l'écran d'accueil"

---

## Comptes de test

| Rôle | Email | Mot de passe |
|---|---|---|
| Direction | direction@hotel.fr | Admin123! |
| Responsable technique | resptech@hotel.fr | Admin123! |
| Gouvernante | gouv1@hotel.fr | Admin123! |
| Technicien | tech1@hotel.fr | Admin123! |
| Réception | reception1@hotel.fr | Admin123! |
| Admin | admin@hotel.fr | admin123 |

> Changer tous les mots de passe avant utilisation en production.

---

## Variables d'environnement

| Variable | Défaut | Description |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./hotel_os.db` | PostgreSQL en prod (Railway injecte auto) |
| `SECRET_KEY` | `hotel-os-dev-secret-change-in-prod` | Clé JWT — **changer obligatoirement** |
| `ALLOWED_ORIGINS` | `*` | CORS — restreindre à ton domaine en prod |

---

## Test local

```bash
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn backend.main:app --reload
# http://localhost:8000
# http://localhost:8000/health → {"status":"ok","version":"1.0.0"}
```

---

## Résolution de problèmes

**Le backend ne démarre pas :**
```
gunicorn backend.main:app -w 2 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT
```
Vérifier les logs Railway.

**`/health` ne répond pas :**  
La route `/health` est déclarée avant le montage des fichiers statiques dans `main.py`.  
Vérifier que le bon fichier est déployé.

**Le seed ne s'exécute pas :**  
Idempotent — ne tourne que si aucun rôle n'existe en base.  
Vérifier `DATABASE_URL` dans les variables Railway.

**Interface blanche après déploiement :**  
Vider le cache du navigateur — le Service Worker peut servir une ancienne version.  
La version de cache actuelle est `hotel-os-v13`.
