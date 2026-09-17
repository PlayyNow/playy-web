# Playy web viewer

Public live viewer for Playy events. Polls `GET /api/v1/events/:id/public` every 10 seconds. Private events 404.

This is a **separate GitHub repo** from Playy-App. Deploy on Vercel. Do not add it to the Render backend service.

## Saturday demo

https://playy-web.vercel.app/event/c62d15e9-766d-42a3-9a98-b265aa191b7f

## Local

```bash
npm install
npm run dev
```

## Vercel

1. Import `PlayyNow/playy-web` in Vercel
2. Framework preset: Vite
3. Build command: `npm run build`
4. Output: `dist`

No env vars required. The API URL is `https://playy-api.onrender.com/api/v1`.
