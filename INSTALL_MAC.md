# Installation Hotel OS sur Mac

---

## Prérequis

Python 3.10+ requis. Vérifier dans le Terminal :

```bash
python3 --version
```

Si absent → https://python.org/downloads

---

## Installation (5 minutes)

### 1. Dézipper le projet

Double-clic sur le fichier `.zip` → un dossier `hotelOSpro` est créé.

### 2. Ouvrir le Terminal

Spotlight (Cmd+Espace) → `Terminal` → Entrée

### 3. Aller dans le dossier

```bash
cd ~/Downloads/hotelOSpro
```

> Adapte le chemin. Tu peux aussi glisser-déposer le dossier après `cd `.

### 4. Créer un environnement virtuel

```bash
python3 -m venv venv
source venv/bin/activate
```

`(venv)` apparaît au début de la ligne — c'est normal.

### 5. Installer les dépendances

```bash
pip install -r requirements.txt
```

30 secondes à 2 minutes.

### 6. Lancer le serveur

```bash
uvicorn backend.main:app --reload
```

Résultat attendu :
```
INFO:     Uvicorn running on http://127.0.0.1:8000
```

### 7. Ouvrir l'application

Navigateur → **http://localhost:8000**

---

## Comptes de test

| Rôle | Email | Mot de passe |
|---|---|---|
| Direction | direction@hotel.fr | Admin123! |
| Responsable technique | resptech@hotel.fr | Admin123! |
| Adjoint technique | adjtech@hotel.fr | Admin123! |
| Gouvernante | gouv1@hotel.fr | Admin123! |
| Technicien | tech1@hotel.fr | Admin123! |
| Technicien 2 | tech2@hotel.fr | Admin123! |
| Réception | reception1@hotel.fr | Admin123! |
| Admin | admin@hotel.fr | admin123 |

---

## Modules disponibles en V8

- **Réglages** : Hôtel (activer/désactiver), Zones, Chambres, Tâches, Interventions, Stock, Équipements (familles/types/items), Utilisateurs, Communication
- **Interventions** : création, prise en charge, pause, clôture, doublons
- **Tâches** : création, assignation, statuts, validation
- **Chambres** : statuts temps réel, QR checkout
- **Équipements** : familles / types / items avec statuts
- **Stock** : articles, mouvements, alertes de seuil
- **Présence** : postes, pauses, vue équipe
- **Conversations** : direct et groupe
- **Notifications** : temps réel par rôle

---

## Arrêter / Relancer

**Arrêter :** `Ctrl+C` dans le Terminal

**Relancer :**
```bash
source venv/bin/activate
uvicorn backend.main:app --reload
```

---

## Repartir de zéro

```bash
rm hotel_os.db
uvicorn backend.main:app --reload
```

Le seed repart automatiquement.

---

## Tester sur iPhone (même réseau Wi-Fi)

1. Trouver l'IP du Mac : Préférences Système → Réseau (ex: `192.168.1.42`)

2. Lancer avec cette IP :
```bash
uvicorn backend.main:app --reload --host 0.0.0.0
```

3. Sur iPhone → Safari : `http://192.168.1.42:8000`

4. Bouton partage ↑ → "Sur l'écran d'accueil"

---

## Résolution de problèmes

**`command not found: python3`** → Installer Python : https://python.org/downloads

**`error: externally-managed-environment`** → Refaire `source venv/bin/activate`

**Port 8000 occupé** → `uvicorn backend.main:app --reload --port 8001`

**Page blanche** → Vérifier que le Terminal affiche bien `Uvicorn running`

**Données vides** → Supprimer `hotel_os.db` et relancer
