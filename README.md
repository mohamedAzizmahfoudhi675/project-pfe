# Drone Command Platform

Une station de contrôle au sol professionnelle basée sur le Web pour la planification de missions UAV, le suivi de vol en temps réel, la diffusion vidéo en direct et le traitement avancé des données.

Construite avec React, intégrée avec le SDK DJI (via une application mobile compagnon), WebODM, Agora RTC et une API personnalisée de détection thermique basée sur YOLOv8.

---

# Aperçu

La plateforme Drone Command fournit un flux de travail complet pour les opérations de drones :

- Planification de mission (Waypoint / Area / Linear)
- Suivi de vol en temps réel (WebSocket)
- Diffusion vidéo en direct (Agora RTC)
- Génération de modèles 3D (WebODM)
- Détection d’anomalies thermiques (YOLOv8 + Flask API)

Architecture :

- Télémétrie → Serveur WebSocket
- Vidéo → Agora RTC
- Reconstruction 3D → WebODM
- Analyse thermique → API Flask

---

# Fonctionnalités

## Planificateur de mission

- Ajout de points via Google Maps
- Mode zone (polygone + trajectoire tondeuse automatique)
- Mode linéaire (corridor survey)
- Calcul en temps réel du GSD
- Recommandation de chevauchement
- Export JSON / KML / CSV

## Suivi de vol en direct

- Télémétrie : lat/lon, altitude, vitesse, cap, batterie
- Marqueur drone dynamique
- Enregistrement de trajectoire
- Commandes mission (start / pause / stop)

## Diffusion vidéo

- Streaming via Agora RTC
- Configuration App ID / Channel / Token
- Reconnexion automatique

## Génération de modèles 3D

- Upload d’images vers WebODM
- Suivi de progression des tâches
- Visualisation 3D intégrée
- Téléchargement du modèle texturé

## Détection d’anomalies thermiques

- Upload image thermique
- Ajustement seuil de confiance
- Affichage des bounding boxes
- Téléchargement image annotée

---

# Stack Technique

| Couche | Technologies |
|--------|-------------|
| Frontend | React 18, React Router 6, Tailwind CSS, Google Maps API, Turf.js, Agora RTC SDK, Axios |
| State Management | React Context |
| Backend | WebSocket Server (Node.js / Python), WebODM, Flask API |
| Build Tool | Vite |

---

# Prérequis

- Node.js 18+
- Clé Google Maps API
- App ID Agora
- Instance WebODM (local ou distante)
- API Flask thermique
- Serveur WebSocket

---

# Installation

```bash
git clone <repo-url>
cd drone-command
npm install
npm run dev
```

---

# Variables d'environnement

Créer un fichier `.env` :

```
VITE_GOOGLE_MAPS_API_KEY=your_key
VITE_WEBSOCKET_URL=ws://localhost:8080
VITE_WEBODM_URL=http://localhost:8000
VITE_AGORA_APP_ID=your_agora_app_id
```

---

# Structure du projet

```
src/
├── components/
├── contexts/
├── layouts/
├── pages/
├── utils/
├── App.jsx
├── main.jsx
└── index.css
```

---

# Format WebSocket

Exemple de message télémétrie :

```json
{
  "type": "telemetry_data",
  "telemetry": {
    "position": {
      "latitude": 37.7749,
      "longitude": -122.4194,
      "altitude": 100
    },
    "movement": {
      "speed": 5.2,
      "heading": 90
    },
    "status": {
      "batteryLevel": 85
    }
  }
}
```

Types supportés :

- identify
- ping
- drone_status
- mission_status
- telemetry_data
- error

---

# API WebODM utilisée

- POST /api/token-auth/
- GET /api/projects/
- POST /api/projects/
- POST /api/projects/{id}/tasks/
- GET /api/projects/{id}/tasks/{taskId}/
- GET /api/projects/{id}/tasks/{taskId}/download/textured_model.zip

---

# API Détection Thermique

Endpoints :

- GET /health
- POST /detect

Réponse :

```json
{
  "success": true,
  "processed_image": "base64_string",
  "detections": [],
  "timestamp": "ISO8601"
}
```

---

