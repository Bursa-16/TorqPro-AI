# TorqPro VISUAL-01A — Local Installation

## Prerequisites
- Node.js 18+ installed
- Python 3.10+ with FastAPI, python-jose, pydantic installed
- TorqPro repository at D:\TorqPro_TR_EN with working backend

## Step 1 — Extract VISUAL-01A into the repository

```cmd
cd /d D:\TorqPro_TR_EN
```

Extract `TorqPro_VISUAL01A_Handoff.tar.gz` so that it creates:

```
D:\TorqPro_TR_EN\frontend\app\          ← new React frontend
D:\TorqPro_TR_EN\frontend\legacy\       ← preserved legacy index.html copy
```

Using 7-Zip or tar:
```cmd
tar -xzf TorqPro_VISUAL01A_Handoff.tar.gz
```

The existing `D:\TorqPro_TR_EN\frontend\index.html` is NOT overwritten.
The legacy copy at `frontend\legacy\index.html` is a safety backup.

## Step 2 — Install frontend dependencies

```cmd
cd /d D:\TorqPro_TR_EN\frontend\app
npm install
```

## Step 3 — Start the TorqPro backend

Open a separate terminal:

```cmd
cd /d D:\TorqPro_TR_EN
set TORQPRO_SECRET_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
python -m uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload
```

Or if using the existing start script:
```cmd
cd /d D:\TorqPro_TR_EN
TorqPro_17_Baslat.bat
```

Verify backend is running:
```cmd
curl http://localhost:8000/api/health
```

Expected: `{"status":"ok","version":"3.3","database_ok":true,...}`

## Step 4 — Start the React dev server

```cmd
cd /d D:\TorqPro_TR_EN\frontend\app
npm run dev
```

The Vite dev server starts at: **http://localhost:5173**

The proxy configuration in `vite.config.ts` forwards all `/api/*` requests
to `http://localhost:8000` (the FastAPI backend).

## Step 5 — Build for production (optional)

```cmd
cd /d D:\TorqPro_TR_EN\frontend\app
npm run build
```

Output goes to: `D:\TorqPro_TR_EN\frontend\dist\`

## Network Configuration

| Service | URL | Purpose |
|---|---|---|
| Vite Dev Server | http://localhost:5173 | React frontend |
| FastAPI Backend | http://localhost:8000 | API server |
| Proxy | /api/* → localhost:8000 | Configured in vite.config.ts |

## Login Credentials (existing)

- Username: `Protype Lab`
- Password: `A1234`

## Verification Checklist

### APP SHELL
- [ ] Sidebar renders with 4 navigation groups
- [ ] Header shows "TorqPro v3.3" and user name
- [ ] Accordion: clicking one group closes the previous
- [ ] Route switching works for all sidebar items
- [ ] Active route is highlighted in sidebar

### TORK HESAP (/torque)
- [ ] Page loads with 16 engineering input fields
- [ ] Default values pre-filled (M10, 1.5mm pitch, 58 mm², 900 MPa, 0.75 yield ratio, μ=0.12)
- [ ] Units visible next to each field (mm, mm², MPa)
- [ ] "Hesapla" button triggers API call to POST /api/engineering/check
- [ ] Deterministic torque result (nom/min/max Nm) visible in results panel
- [ ] Preload (N) visible
- [ ] Nut proof utilization % visible with color-coded status
- [ ] Internal thread safety factor visible
- [ ] Status badges show (Uygun/Sınırda/Riskli)
- [ ] "Deterministik hesap · VDI 2230 tabanlı · AI değil" footer visible
- [ ] No clipped or overlapping elements

### VIEWPORT TESTS
- [ ] 1920×1080 — full layout, no horizontal scroll
- [ ] 1440×900 — sidebar + content fits
- [ ] 1366×768 — sidebar + content fits, no overlap

## Required Screenshots for Visual Quality Review

| ID | Description | How |
|---|---|---|
| SCREENSHOT_01 | Full App Shell after login (Dashboard) | Full page, 1920×1080 |
| SCREENSHOT_02 | /torque page BEFORE calculation | Full page, 1920×1080 |
| SCREENSHOT_03 | /torque page AFTER calculation (M10, 10.9, μ=0.12) | Full page, 1920×1080 |
| SCREENSHOT_04 | Close-up of results panel (torque + preload + status) | Crop results area |
| SCREENSHOT_05 | /torque page at 1366×768 | Resize browser, full page |

Return these screenshots for final visual quality gate assessment.
