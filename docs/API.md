# TerraTwin AI - API Documentation (v1)

All endpoints are prefixed with `/api/v1`. The server runs on port `5000` by default.

---

## Global Headers
For authenticated endpoints, include the JWT token in the `Authorization` header:
```http
Authorization: Bearer <your_jwt_token>
```

---

## Health & Status
### Health Check
- **Endpoint**: `GET /api/v1/health`
- **Authentication**: None
- **Response** (200 OK):
```json
{
  "status": "ok",
  "database": "connected"
}
```

---

## Authentication APIs

### Register User
- **Endpoint**: `POST /api/v1/auth/register`
- **Body**:
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "Eco Advocate"
}
```
- **Response** (201 Created):
```json
{
  "message": "User registered successfully",
  "token": "eyJhbG...",
  "user": {
    "id": "cuid...",
    "email": "user@example.com",
    "name": "Eco Advocate"
  }
}
```

### Login User
- **Endpoint**: `POST /api/v1/auth/login`
- **Body**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```
- **Response** (200 OK):
```json
{
  "token": "eyJhbG...",
  "user": {
    "id": "cuid...",
    "email": "user@example.com",
    "name": "Eco Advocate"
  }
}
```

---

## Carbon Tracking APIs

### Fetch Carbon Entries
- **Endpoint**: `GET /api/v1/carbon/entries?limit=30&offset=0`
- **Authentication**: JWT Required
- **Response** (200 OK):
```json
{
  "entries": [
    {
      "id": "entry-cuid...",
      "category": "transport",
      "type": "car",
      "value": 50.0,
      "unit": "km",
      "carbonEmitted": 10.5,
      "source": "manual",
      "automatic": false,
      "createdAt": "2026-06-20T12:00:00.000Z"
    }
  ],
  "count": 1
}
```

### Create Carbon Entry
- **Endpoint**: `POST /api/v1/carbon/entries`
- **Authentication**: JWT Required
- **Body**:
```json
{
  "category": "transport",
  "type": "car",
  "value": 50,
  "unit": "km"
}
```
- **Response** (201 Created):
```json
{
  "id": "entry-cuid...",
  "userId": "user-cuid...",
  "category": "transport",
  "type": "car",
  "value": 50,
  "unit": "km",
  "carbonEmitted": 10.5,
  "source": "manual",
  "automatic": false,
  "createdAt": "2026-06-20T15:45:00.000Z"
}
```

---

## Geolocation APIs

### Log GPS Track
- **Endpoint**: `POST /api/v1/track/location`
- **Authentication**: JWT Required
- **Body**:
```json
{
  "latitude": 40.7128,
  "longitude": -74.0060,
  "timestamp": 1782015600000
}
```
- **Response** (200 OK):
```json
{
  "status": "logged",
  "commuteDetected": true,
  "distanceKm": 5.3,
  "classifiedAs": "car",
  "carbonEmitted": 1.11,
  "tokensAwarded": 0
}
```

---

## Vision APIs (Gemini OCR)

### Scan Bill OCR
- **Endpoint**: `POST /api/v1/vision/scan-bill`
- **Authentication**: JWT Required
- **Body**: `multipart/form-data` containing `file` (image).
- **Response** (200 OK):
```json
{
  "provider": "NextEnergy",
  "quantity": 100,
  "unit": "kWh",
  "carbonEmitted": 23.3,
  "tokensAwarded": 75
}
```

### Analyze Food Image
- **Endpoint**: `POST /api/v1/vision/analyze-food`
- **Authentication**: JWT Required
- **Body**: `multipart/form-data` containing `file` (image).
- **Response** (200 OK):
```json
{
  "foodItem": "beef burger with fries",
  "breakdown": [
    { "item": "beef", "emissions": 27.0 },
    { "item": "potato", "emissions": 2.0 }
  ],
  "totalEmissions": 29.0
}
```

---

## Smart Home / IoT APIs

### Sync Smart Meter
- **Endpoint**: `POST /api/v1/devices/sync`
- **Authentication**: JWT Required
- **Body**:
```json
{
  "watts": 720,
  "devices": {
    "lights": 154,
    "ac": 0,
    "fridge": 255,
    "media": 311
  }
}
```
- **Response** (200 OK):
```json
{
  "status": "synced",
  "carbonEmitted": 0.167
}
```

---

## Digital Carbon Twin APIs

### Get Digital Twin Profile
- **Endpoint**: `GET /api/v1/twin/profile`
- **Authentication**: JWT Required
- **Response** (200 OK):
```json
{
  "score": 85,
  "persona": "Sustainability Champion",
  "monthlyFootprint": 45.2,
  "annualFootprint": 0.54,
  "risk": "Low",
  "potentialReduction": 18,
  "goal": 600,
  "goalProgress": 8
}
```

---

## AI Agent & Storyteller APIs

### Generate AI Carbon Story
- **Endpoint**: `GET /api/v1/agent/story`
- **Authentication**: JWT Required
- **Response** (200 OK):
```json
{
  "story": "Hello User! Here is your Carbon Story for this month. You have emitted 45.2 kg CO₂..."
}
```

### Chat with AI Sustainability Advisor
- **Endpoint**: `POST /api/v1/agent/chat`
- **Authentication**: JWT Required
- **Body**:
```json
{
  "message": "Why is my carbon footprint high?"
}
```
- **Response** (200 OK):
```json
{
  "reply": "Your monthly carbon emissions are currently at 45.2 kg CO2. Lowering AC help.",
  "userId": "user-cuid...",
  "timestamp": "2026-06-20T12:00:00.000Z"
}
```

---

## Token & gamification APIs

### Fetch Token Balance and NFT Tier
- **Endpoint**: `GET /api/v1/tokens/balance`
- **Authentication**: JWT Required
- **Response** (200 OK):
```json
{
  "balanceECO": 400,
  "nftTier": "🌱 Seed"
}
```

### Fetch Leaderboards
- **Endpoint**: `GET /api/v1/tokens/leaderboard`
- **Authentication**: JWT Required
- **Response** (200 OK):
```json
[
  {
    "id": "user-1",
    "name": "Eco Champion",
    "balanceECO": 1250,
    "nftTier": "🌍 Ecosystem"
  }
]
```

