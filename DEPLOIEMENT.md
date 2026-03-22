# Déploiement Hotel OS
## Rendre l'app accessible à tes collègues sur leur téléphone

---

## Ce que tu vas obtenir

Une URL publique du type **`https://hotel-os-xxx.railway.app`**
Tes collègues l'ouvrent → bouton "Ajouter à l'écran d'accueil" → app installée.

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
2. Sélectionner le repo `hotel-os` → **Deploy**
3. Dans le projet → **"+ New"** → **"Database"** → **"PostgreSQL"**
   (La variable `DATABASE_URL` est injectée automatiquement)
4. **Variables** → ajouter :

| Variable          | Valeur                                    |
|-------------------|-------------------------------------------|
| `SECRET_KEY`      | une-longue-chaine-aleatoire-32-caracteres |
| `ALLOWED_ORIGINS` | https://hotel-os-xxx.railway.app          |

5. Redéployer → attendre 2–3 min

---

## Étape 3 — Vérifier le healthcheck

Ouvrir dans le navigateur :
```
https://ton-app.railway.app/health
```
Réponse attendue : `{"status":"ok","version":"1.0.0"}`

Si Railway indique "Service unhealthy", vérifier les logs du build.

---

## Étape 4 — Seed des données

Le seed s'exécute automatiquement au premier démarrage si la base est vide.
Si besoin de le relancer manuellement, dans Railway → ton service → Shell :

```bash
python -m backend.seed
```

---

## Étape 5 — Installation sur les téléphones

**Android (Chrome) :**
Menu ⋮ → "Ajouter à l'écran d'accueil"

**iPhone (Safari uniquement) :**
Bouton partage ↑ → "Sur l'écran d'accueil"

---

## Test local complet

```bash
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn backend.main:app --reload
# Ouvrir http://localhost:8000
# Vérifier http://localhost:8000/health
```

---

## Comptes de test

| Rôle        | Email                 | Mot de passe |
|-------------|-----------------------|--------------|
| Direction   | direction1@hotel.fr   | admin123     |
| Responsable | gouvg@hotel.fr        | admin123     |
| Gouvernante | gouv1@hotel.fr        | admin123     |
| Technicien  | tech1@hotel.fr        | admin123     |
| Réception   | recep1@hotel.fr       | admin123     |

Changer tous les mots de passe en production.

---

## En cas de problème

**Le backend ne démarre pas :**
Vérifier les logs Railway. La commande attendue est :
```
gunicorn backend.main:app -w 2 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT
```

**Le /health retourne du HTML :**
Impossible avec cette version — /health est déclaré avant la catch-all SPA.
Si cela se produit, vérifier que le bon fichier main.py est déployé.

**Le seed ne s'exécute pas :**
Le seed est idempotent : il ne s'exécute que si aucun utilisateur n'existe.
Vérifier la connexion PostgreSQL via DATABASE_URL dans les variables Railway.
