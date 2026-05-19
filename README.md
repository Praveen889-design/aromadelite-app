# Aromadelite Quote & Lead Manager

Full-stack BD tool for **Sri Vemuri Sai Enterprises** — captures leads, builds GST-correct quotes, exports PDFs, and tracks the pipeline across Hyderabad, Vijayawada, and Warangal.

```
aromadelite-app/
├── client/        React 18 + Tailwind + React Router (CRA)
├── server/        Express + better-sqlite3 + JWT
├── database/      Schema + SQLite file (gitignored)
└── package.json   Workspace runner (concurrently)
```

---

## Quick start (one command)

```bash
# 1. From inside aromadelite-app/
npm run install:all      # installs server + client deps
npm run seed             # creates database/aromadelite.db and seeds demo data
npm run dev              # starts API on :5050 AND React on :3000 in parallel
```

Open **http://localhost:3000** and sign in:

| Role         | Employee ID  | Password   |
|--------------|--------------|------------|
| Admin        | `ARO-ADMIN`  | `Admin@123`|
| Associate    | `ARO-001`    | `Assoc@123`|
| Associate    | `ARO-002`    | `Assoc@123`|

---

## Production build (single Node process)

In production the Express server serves the compiled React bundle from `client/build`, so you only run **one** process.

```bash
npm run prod          # = npm run build && NODE_ENV=production npm start
# → API + UI on http://localhost:5050
```

The server logs `[static] Serving React build from …/client/build` when the build is detected. If the build is missing it warns and continues serving the API only.

---

## Environment variables

Copy the examples and fill in real values:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env       # only needed if deploying split front/back
```

### `server/.env` — required in production

| Key             | Required | Description                                                                 |
|-----------------|----------|-----------------------------------------------------------------------------|
| `JWT_SECRET`    | ✅ (prod) | Secret used to sign JWTs. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `DATABASE_PATH` | optional | Absolute path to the SQLite file. Defaults to `database/aromadelite.db`. Point at a persistent volume in production. |
| `PORT`          | optional | Server port. Most hosts inject this automatically.                          |
| `JWT_EXPIRES_IN`| optional | Token lifetime. Defaults to `8h`.                                           |
| `CORS_ORIGIN`   | optional | Comma-separated allow-list of frontend origins (e.g. your Vercel URLs).     |
| `NODE_ENV`      | optional | Set to `production` to enable static serving + strict CORS.                 |

### `client/.env`

| Key                    | Description                                                                  |
|------------------------|------------------------------------------------------------------------------|
| `REACT_APP_API_URL`    | When the frontend is hosted on a different origin than the API (e.g. Vercel + Railway), set this to the API origin. Leave blank for local dev — the CRA proxy handles it. |

---

## Deploy: frontend on Vercel, API on Railway/Render/Fly

The SQLite-backed API needs a persistent filesystem and a long-lived process, so it doesn't fit Vercel's serverless model. The recommended split is:

1. **API** → Railway / Render / Fly (anything that runs a Node process with a writable disk).
2. **Frontend (this repo's `client/`)** → Vercel.

### Step 1 — host the API

Pick any Node-friendly host. Example: **Railway**.

1. Create a new project → "Deploy from GitHub repo" → pick this repo, set the **Root Directory** to `aromadelite-app/server`.
2. Add a **Volume** mounted at `/data` (1 GB is plenty).
3. Set environment variables:
   - `JWT_SECRET` = your generated secret
   - `DATABASE_PATH` = `/data/aromadelite.db`
   - `NODE_ENV` = `production`
   - `CORS_ORIGIN` = `https://<your-app>.vercel.app,https://<your-app>-git-main-*.vercel.app`
4. Build command: `npm install`
5. Start command: `npm start`
6. After first boot, open a shell on the service and seed the DB once:
   `node database/seed.js`
7. Copy the public URL (e.g. `https://aromadelite-api.up.railway.app`).

### Step 2 — host the frontend on Vercel

```bash
cd aromadelite-app/client
npx vercel link              # link to a new Vercel project
npx vercel env add REACT_APP_API_URL production
# paste your Railway URL when prompted, e.g. https://aromadelite-api.up.railway.app
npx vercel --prod
```

Or via the UI:
- New Project → import this repo
- **Root Directory:** `aromadelite-app/client`
- Framework Preset: **Create React App** (auto-detected from `vercel.json`)
- Environment variables → `REACT_APP_API_URL = https://aromadelite-api.up.railway.app`
- Deploy

`vercel.json` in `client/` already configures the build command, output dir, SPA rewrites, and aggressive caching for hashed static assets.

After the first deploy, go back to the API host and update `CORS_ORIGIN` to include the new Vercel production URL.

---

## Building the Android APK (Capacitor)

The React build is wrapped via Capacitor — same JS bundle, native shell.

> **Prerequisites (on your dev machine):** Android Studio with Android SDK 33+ and a Java JDK 17+. Capacitor will error clearly if either is missing.

One-time setup:

```bash
cd aromadelite-app/client
npm run android:init     # installs Capacitor + scaffolds the android/ project
```

Each subsequent build:

```bash
npm run android:sync     # rebuilds the React bundle and syncs into the native project
npm run android:build    # produces a debug APK
# → output: client/android/app/build/outputs/apk/debug/app-debug.apk
```

If you want the APK to point at your hosted Vercel UI instead of bundling the JS, uncomment `server.url` in `client/capacitor.config.ts` and set it to your Vercel URL — then `npm run android:build` again.

To open the project in Android Studio (signed/release builds, icon swap, etc.):

```bash
npm run android:open
```

---

## API surface

| Method | Path                          | Purpose                                   |
|--------|-------------------------------|-------------------------------------------|
| POST   | `/api/auth/login`             | Issue JWT (employee_id + password)        |
| POST   | `/api/auth/logout`            | Blacklist current token                   |
| GET    | `/api/auth/me`                | Current user                              |
| GET    | `/api/products[/categories]`  | Catalog                                   |
| POST   | `/api/quotes`                 | Create quote (auto-creates lead)          |
| GET    | `/api/quotes`                 | List (role-scoped)                        |
| PATCH  | `/api/quotes/:id/status`      | Update status (mirrors to lead)           |
| GET    | `/api/quotes/:id/pdf-data`    | Print-ready payload                       |
| GET    | `/api/leads[/:id][/summary]`  | List, detail, status counts               |
| PATCH  | `/api/leads/:id`              | Update status / notes / follow-up / owner |
| GET    | `/api/dashboard/stats`        | Cards + trends + top products             |
| GET    | `/api/employees`              | (admin) team + per-rep totals             |
| POST   | `/api/employees`              | (admin) create new employee               |
| GET    | `/api/products/admin/all`     | (admin) including inactive                |
| POST   | `/api/products`               | (admin) create product                    |
| PATCH  | `/api/products/:id`           | (admin) update product                    |
| GET    | `/api/reports/summary`        | (admin) date-ranged revenue breakdowns    |

---

## Scripts cheat sheet

| Command                       | What it does                                       |
|-------------------------------|----------------------------------------------------|
| `npm run install:all`         | Install server + client deps                       |
| `npm run seed`                | Drop/rebuild schema and seed demo data             |
| `npm run dev`                 | Start API + React in parallel                      |
| `npm run build`               | Build the React production bundle                  |
| `npm start`                   | Run the API in production mode (serves the build)  |
| `npm run prod`                | `build` then `start`                               |
| `npm --prefix client run android:build` | Generate a debug APK                     |

---

## Troubleshooting

- **`EADDRINUSE :5050`** on macOS → AirPlay Receiver. Disable it in *System Settings → General → AirDrop & Handoff* or change `PORT` in `server/.env`.
- **`secretOrPrivateKey must have a value`** → `JWT_SECRET` not exported. Add it to `server/.env` (or your host's env tab).
- **Vercel build fails on `better-sqlite3`** → expected; that package is only used by the API. Make sure the Vercel "Root Directory" is `aromadelite-app/client`, not the repo root.
- **CORS errors after Vercel deploy** → add your Vercel URL to `CORS_ORIGIN` on the API host and redeploy the API.
