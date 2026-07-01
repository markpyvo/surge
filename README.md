# Surge — Macro Rings 🌊

A personal calorie & macro tracker with Apple-style activity rings. Say or type what
you ate (or the activity you did) and MiniMax-M2.5 estimates the nutrition and fills
your rings. Activity earns calories back, widening the calorie ring.

- **Rings**: calories (hero, 270° ring) + protein / carbs / fat
- **Log food**: dictate or type → MiniMax estimates calories + macros
- **Log activity**: dictate or type → MiniMax estimates calories burned → widens the
  calorie goal, shown as a coral "earned" segment
- **Settings**: daily target for each ring
- **Storage**: your phone only (localStorage). Rings reset each local day.
- **PWA**: installable to the iOS home screen, works offline.

## Stack
Next.js 15 (App Router) · HeroUI v3 · Tailwind v4 · Sora + Inter · MiniMax-M2.5.

## Run locally
```bash
npm install
# .env.local must contain your MiniMax key:
#   MINIMAX_API_KEY=sk-...
npm run dev      # http://localhost:7373
```

## Deploy (Vercel + add to home screen)
1. Push this folder to a Git repo and import it in Vercel (framework auto-detected as Next.js).
2. In Vercel → Project → Settings → Environment Variables, add:
   `MINIMAX_API_KEY` = your key (the same value as in `.env.local`).
3. Deploy. Open the URL on your iPhone in Safari → Share → **Add to Home Screen**.

The MiniMax key lives only in `.env.local` (gitignored) and the Vercel env var — it is
never shipped to the browser; the `/api/parse` route calls MiniMax server-side.
