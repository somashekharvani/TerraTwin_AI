# TerraTwin AI - Deployment Guide

This guide describes how to run TerraTwin AI locally and deploy it to cloud environments (Vercel + Railway + Polygon EVM).

---

## Local Development Setup

### Prerequisites
- Node.js (v18+)
- Docker and Docker Compose
- Google Gemini API Key

### Step 1: Install Dependencies
From the root workspace directory, run:
```bash
npm install
```

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env` in both the root workspace and `backend/` directories, and fill in the values:
```bash
cp .env.example backend/.env
```

### Step 3: Start Services via Docker Compose
To run PostgreSQL and the MQTT broker locally:
```bash
docker-compose -f deployment/docker-compose.yml up -d
```

### Step 4: Run Migrations and Seed Database
Generate the Prisma Client and migrate the schema, then run the seed script:
```bash
cd backend
npx prisma migrate dev --name init
npx prisma db seed
```

### Step 5: Start Development Server
From the root directory:
```bash
npm run dev
```
The frontend will start at `http://localhost:5173` and the backend API at `http://localhost:5000`.

---

## Production Cloud Deployment

### Backend Deployment (Railway)
1. Link your GitHub repository to [Railway](https://railway.app).
2. Choose the monorepo root, set the root directory or configure Railway variables.
3. Configure the start command as `npm run start --workspace backend`.
4. Inject env variables (`DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`).
5. Enable Public Networking to expose port `5000` at `api.terratwin.railway.app`.

### Frontend Deployment (Vercel)
1. Import your GitHub repository to [Vercel](https://vercel.com).
2. Set Build Settings:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Configure `vercel.json` rewrite paths to direct `/api/v1/*` to the Railway API address.

### Blockchain Smart Contract Deployment
Use Hardhat or Remix to deploy `contracts/EcoToken.sol` to Polygon Amoy Testnet.
1. Deploy contract.
2. Store the deployed address in the backend environment as `ECO_TOKEN_CONTRACT_ADDRESS`.
3. Provide the backend controller wallet with some POL tokens for gas fees to execute `mint` transactions.
