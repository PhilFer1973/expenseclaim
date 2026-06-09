# SME Expense Claims App

Android-first expense claims app. FastAPI backend + Expo React Native frontend.

---

## Project structure

```
backend/        FastAPI backend (Python 3.11)
frontend/       Expo React Native app (Android)
startup.sh      Azure App Service startup script
```

---

## Running locally

### Backend

```bash
cd backend
py -3.11 -m venv venv311
venv311\Scripts\activate          # Windows
pip install -r requirements.txt
uvicorn server:app --reload --port 8000
```

Create `backend/.env` with the variables listed in the Azure section below.

### Frontend

```bash
cd frontend
yarn install
yarn start
```

Set `EXPO_PUBLIC_BACKEND_URL` in `frontend/.env.local`:

```
EXPO_PUBLIC_BACKEND_URL=http://<your-pc-ip>:8000
```

---

## Azure App Service Deployment

### Overview

The backend is a FastAPI app deployed to Azure App Service (Linux, Python 3.11).
`startup.sh` at the repo root is the startup command.

### Step-by-step Azure setup

1. **Create App Service**
   - Go to [portal.azure.com](https://portal.azure.com) → Create a resource → Web App
   - **Publish:** Code
   - **Runtime stack:** Python 3.11
   - **Operating System:** Linux
   - **Region:** UK South (or nearest to you)
   - **Plan:** Free F1 for testing; Basic B1 for production

2. **Set the startup command**
   - App Service → Settings → Configuration → General settings
   - **Startup Command:** `bash /home/site/wwwroot/startup.sh`
   - Save

3. **Set environment variables**
   - App Service → Settings → Environment variables → Add each variable below
   - Save and restart

4. **Deploy the code**
   - In Azure Portal → App Service → Deployment Center
   - Source: **GitHub**
   - Authorise, select repo `PhilFer1973/expenseclaim`, branch `Phase7`
   - Save — Azure will build and deploy automatically on every push

5. **Test the health endpoint**
   - Open on your phone: `https://<your-app-name>.azurewebsites.net/health`
   - Expected response: `{"status":"ok"}`

### Required environment variables

Set these in App Service → Settings → Environment variables:

| Variable | Description | Required |
|---|---|---|
| `SUPABASE_URL` | Your Supabase project URL (`https://xxxx.supabase.co`) | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key from Supabase → Settings → API | Yes |
| `RECEIPTS_BUCKET` | Storage bucket name (default: `receipts`) | No |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude Vision and AI features | Yes |
| `OPENAI_API_KEY` | OpenAI API key for receipt embeddings (kNN search) | Yes |

### Connecting the mobile app to Azure

Once deployed, update `frontend/.env.local`:

```
EXPO_PUBLIC_BACKEND_URL=https://<your-app-name>.azurewebsites.net
```

Then rebuild the EAS bundle so the new URL is baked in:

```bash
cd frontend
eas build --platform android --profile development --no-wait
```

### Testing /health from your phone

Open your phone browser and go to:

```
https://<your-app-name>.azurewebsites.net/health
```

You should see:

```json
{"status":"ok"}
```

If you see this, the backend is publicly reachable and the deployment succeeded.
