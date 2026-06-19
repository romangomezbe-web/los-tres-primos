# Los Tres Primos — POS System

React + Node.js + SQLite restaurant POS. Runs fully on local WiFi.

## Quick Start

```bash
cd los-tres-primos
npm install
npm run install:all
npm run dev
```

- Cajero/Admin: http://localhost:5173
- Cocina: http://localhost:5173/cocina

## Credentials

| Rol    | Contraseña |
|--------|-----------|
| Cajero | caja123   |
| Admin  | admin123  |
| Cocina | cocina    |

## LAN Access

Vite exposes on 0.0.0.0. Kitchen iPad connects to `http://<server-ip>:5173/cocina`.  
Update `client/.env` → `VITE_API_URL=http://<server-ip>:3001` if on different machine.

## Deploy to Vercel (when ready)

1. Push to GitHub
2. Import repo in Vercel
3. Set root to `client/`, build command `npm run build`, output `dist`
4. Deploy server separately (Railway, Render, Fly.io) — set `VITE_API_URL` to production API URL
5. Add `FRONTEND_URL=https://your-vercel-domain.vercel.app` to server env vars
