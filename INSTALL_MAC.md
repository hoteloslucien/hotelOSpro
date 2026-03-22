# Installation Hotel OS sur Mac

## Prérequis

Tu as besoin de **Python 3.10+** (préinstallé sur macOS récent).

Vérifie dans le Terminal :
```bash
python3 --version
```

Si tu vois `Python 3.10` ou plus → c'est bon.
Si la commande n'existe pas → installe Python depuis https://python.org/downloads

---

## Installation (5 minutes)

### 1. Dézipper le projet

Double-clic sur `hotelOS_pro_v7_final.zip` → ça crée un dossier.

### 2. Ouvrir le Terminal

- Spotlight (Cmd+Espace) → taper `Terminal` → Entrée
- Ou : Applications → Utilitaires → Terminal

### 3. Aller dans le dossier du projet

```bash
cd ~/Downloads/hotelOS_pro_v7_final
```

> Adapte le chemin si tu l'as mis ailleurs. Tu peux aussi taper `cd ` puis glisser-déposer le dossier dans le Terminal.

### 4. Créer un environnement Python isolé

```bash
python3 -m venv venv
source venv/bin/activate
```

Tu verras `(venv)` apparaître au début de la ligne → c'est normal.

### 5. Installer les dépendances

```bash
pip install -r requirements.txt
```

Ça prend 30 secondes à 2 minutes. Attends que ça finisse.

### 6. Lancer le serveur

```bash
uvicorn backend.main:app --reload
```

Tu verras :
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     🌱 Seed Hotel OS...
INFO:     ✅ Seed terminé !
```

### 7. Ouvrir l'application

Ouvre ton navigateur → va sur :

**http://localhost:8000**

---

## Comptes de test

| Rôle | Email | Mot de passe |
|---|---|---|
| **Direction** | `direction1@hotel.fr` | `admin123` |
| **Responsable** | `gouvg@hotel.fr` | `admin123` |
| **Gouvernante** | `gouv1@hotel.fr` | `admin123` |
| **Technicien 1** | `tech1@hotel.fr` | `admin123` |
| **Technicien 2** | `tech2@hotel.fr` | `admin123` |
| **Réception** | `recep1@hotel.fr` | `admin123` |

> **Pour la démo** : connecte-toi avec `direction1@hotel.fr` pour tout voir (dashboard, équipe, notifications, interventions).

---

## Ce que tu vas voir

Au premier lancement, le seed crée automatiquement :
- 2 hôtels (Paris + Nice)
- 15 chambres
- 6 tâches
- 5 interventions
- 4 groupes de conversation avec messages
- 1 conversation directe
- 13 familles d'équipement + 83 types
- 17 notifications de démo
- 7 articles de stock
- 5 avis clients

---

## Parcours démo recommandé

1. **Login** avec `direction1@hotel.fr` / `admin123`
2. **Dashboard** → voir les KPIs, l'équipe, les alertes
3. **Notifications** (cloche 🔔 en haut) → voir les 7+ notifications, cliquer dessus
4. **Interventions** → créer une nouvelle intervention urgente → voir la notif apparaître
5. **Messages** → ouvrir le groupe Technique → voir les messages
6. **Présence** → onglet Mon poste → prendre le poste
7. **Équipements** → parcourir les familles, ajouter un équipement

---

## Arrêter / Relancer

**Arrêter :** Ctrl+C dans le Terminal

**Relancer :**
```bash
cd ~/Downloads/hotelOS_pro_v7_final
source venv/bin/activate
uvicorn backend.main:app --reload
```

---

## Repartir de zéro (reset base)

Si tu veux supprimer toutes les données et recommencer :

```bash
rm hotel_os.db
uvicorn backend.main:app --reload
```

Le seed se relancera automatiquement.

---

## Tester sur ton iPhone (même réseau Wi-Fi)

1. Trouve l'IP de ton Mac :
   - Préférences Système → Réseau → ton IP (ex: `192.168.1.42`)

2. Lance avec cette IP :
```bash
uvicorn backend.main:app --reload --host 0.0.0.0
```

3. Sur l'iPhone, ouvre Safari :
   `http://192.168.1.42:8000`

4. Bouton partage ↑ → "Sur l'écran d'accueil" → ça s'installe comme une app

---

## En cas de problème

**`command not found: python3`**
→ Installe Python : https://python.org/downloads

**`error: externally-managed-environment`**
→ Tu n'as pas activé le venv. Refais `source venv/bin/activate`

**Le port 8000 est déjà pris**
→ Lance sur un autre port : `uvicorn backend.main:app --reload --port 8001`

**La page est blanche**
→ Vérifie que le Terminal affiche bien `Uvicorn running`. Regarde les erreurs dans le Terminal.

**Les données sont vides**
→ Le seed ne tourne que si la base est vide. Supprime `hotel_os.db` et relance.
