# 🚀 SafeGuard AI Deployment Guide: Vercel & Render

This guide provides step-by-step instructions for deploying the **SafeGuard AI Smart PPE Vision Access Control Gateway** to **Vercel** (Frontend) and **Render** (Backend or Unified Fullstack).

---

## 🏗️ Architecture Options

You can deploy SafeGuard AI in one of two production configurations:

| Deployment Mode | Frontend Host | Backend Host | Best For | Complexity |
| :--- | :--- | :--- | :--- | :--- |
| **Option A (Recommended)** | **Render** (Unified) | **Render** (Unified) | Zero-CORS, single domain, full WebSockets & AI inference out of the box | ⭐ Single 1-Click Setup |
| **Option B (Split)** | **Vercel** (Global CDN) | **Render** (Web Service) | High-traffic static frontend CDN + separate Python AI microservice | ⭐⭐ Two Service Setup |

---

## 🌟 Option A: Unified Fullstack Deployment on Render (Recommended)

In this mode, Render builds the Vite React production bundle (`frontend/dist`) and serves both the static web application, the FastAPI REST APIs, and WebSocket digital twin on a single domain.

### Step 1: Push Repository to GitHub
Ensure all code and the generated `render.yaml` and `runtime.txt` are pushed to your GitHub repository:
```bash
git add .
git commit -m "Configure mobile responsiveness and deployment readiness"
git push origin main
```

### Step 2: Deploy on Render via Blueprint (1-Click)
1. Log in to [Render.com](https://render.com).
2. Click **New +** in the top navigation and select **Blueprint**.
3. Connect your GitHub repository.
4. Render will automatically read `render.yaml`:
   * **Service Name**: `safeguard-ai-gateway`
   * **Runtime**: `Python`
   * **Build Command**: `pip install --upgrade pip && pip install -r requirements.txt && npm --prefix frontend install && npm --prefix frontend run build`
   * **Start Command**: `python run.py`
5. Click **Apply**.
6. Render will install dependencies, build the frontend, and spin up Uvicorn on `$PORT`.

### Manual Web Service Creation on Render (Alternative)
If not using Blueprints:
1. Go to **Dashboard** → **New +** → **Web Service**.
2. Connect your repo and configure:
   * **Name**: `safeguard-ai`
   * **Region**: Choose closest to your users (e.g. Frankfurt, Oregon, Singapore).
   * **Branch**: `main`
   * **Runtime**: `Python 3`
   * **Build Command**: `pip install --upgrade pip && pip install -r requirements.txt && npm --prefix frontend install && npm --prefix frontend run build`
   * **Start Command**: `python run.py`
   * **Plan**: `Free`
3. Under **Advanced**, add Environment Variables:
   * `PYTHON_VERSION`: `3.10.12`
   * `PRODUCTION`: `true`
4. Click **Create Web Service**.

Your unified app will be live at: `https://your-service-name.onrender.com`.

---

## ⚡ Option B: Frontend on Vercel + Backend on Render

Deploy the ultra-fast React SPA to Vercel's Edge Network, and connect it to your Render Python backend.

### Part 1: Deploy Backend to Render
1. Follow the **Manual Web Service Creation** above, using Build Command:
   ```bash
   pip install --upgrade pip && pip install -r requirements.txt
   ```
   and Start Command:
   ```bash
   python run.py
   ```
2. Once deployed, copy your Render backend URL (e.g. `https://safeguard-backend.onrender.com`).

### Part 2: Deploy Frontend to Vercel
Both root `vercel.json` and `frontend/vercel.json` are already pre-configured with SPA route rewriting.

#### Method 1: Using the Vercel Web Dashboard (Recommended)
1. Go to [Vercel.com](https://vercel.com) and click **Add New...** → **Project**.
2. Import your GitHub repository.
3. Configure the project:
   * **Framework Preset**: `Vite`
   * **Root Directory**: Select `frontend` (or leave as root; `vercel.json` handles both).
   * **Build Command**: `npm run build`
   * **Output Directory**: `dist`
4. Expand **Environment Variables** and add:
   * **Name**: `VITE_API_BASE_URL`
   * **Value**: Your Render backend URL (e.g., `https://safeguard-backend.onrender.com`).
   * *(Optional)* `VITE_WS_URL`: `wss://safeguard-backend.onrender.com/ws/hardware`
5. Click **Deploy**.

#### Method 2: Using the Vercel CLI
```bash
# Install Vercel CLI if needed
npm i -g vercel

# Navigate to frontend folder
cd frontend

# Deploy
vercel --prod
```

---

## 📱 Mobile Responsiveness Verification

The application is thoroughly optimized for all smartphones and tablets:

| Feature / Viewport | Optimization Applied | Tested Devices |
| :--- | :--- | :--- |
| **Touch Navigation** | Collapsible floating pill navigation with full-screen slide-down drawer | All mobile browsers |
| **Live Webcam** | Front / Rear camera switcher button for handheld site inspections | iOS Safari, Chrome Mobile |
| **Scan Button** | Giant, high-visibility tap target with responsive touch states | 320px – 430px phones |
| **Audience & Features** | Fluid 1-column layout with flexible padding and touch-friendly cards | iPhone SE, 13, 14, 15, Pixel |
| **Workstation Ledger** | Horizontally swipeable tables with responsive touch badges | Android & iOS |
| **Configuration Sliders**| Full-width touch drag sliders with live percentage indicators | All viewports |
| **Auth & Modals** | Adaptive single-column inputs with centered cards and scroll boundaries | Small screen displays |

---

## 🛠️ Testing Local Production Builds

To test the production build locally before pushing:

1. **Build the Frontend**:
   ```bash
   cd frontend
   npm run build
   cd ..
   ```

2. **Run the Fullstack Server**:
   ```bash
   python run.py
   ```

3. **Open in Mobile Viewport**:
   Navigate to `http://localhost:8000`, open DevTools (Press `F12` or `Cmd + Option + I`), toggle Device Toolbar (`Cmd + Shift + M`), and select **iPhone SE (375x667)** or **iPhone 14 Pro Max**.
