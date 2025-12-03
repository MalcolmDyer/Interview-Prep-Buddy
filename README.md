# Interview Prep Buddy

AI-first desktop app (Electron + React + TypeScript) that generates interview questions and scores your answers with targeted feedback.

## Features
- Tailor sessions by domain, seniority, session type, and target company.
- Live question generation plus automatic scoring with strengths, improvements, and model answers.
- Session history stored locally so you can review past Q/A.
- Ships with a lightweight OpenAI proxy for local development.

## Requirements
- Node.js 18+ and npm.
- An OpenAI API key to run the proxy (`OPENAI_API_KEY` or `AI_API_KEY`).

## Quick start (development)
1) Install dependencies:
   ```bash
   npm install
   ```
2) In one terminal, start the proxy (defaults to http://localhost:3000):
   ```bash
   OPENAI_API_KEY=your_key_here npm run dev:proxy
   ```
3) In another terminal, start the app (points Electron to the proxy URL):
   ```bash
   AI_PROXY_URL=http://localhost:3000 npm run dev
   ```
   - `npm run dev` runs Vite for the renderer and launches Electron after the dev server is ready.
   - You can also set `OPENAI_MODEL` to override the default `gpt-4o-mini`.

## Production build and run
```bash
AI_PROXY_URL=http://localhost:3000 npm run build   # builds renderer + Electron + proxy types
AI_PROXY_URL=http://localhost:3000 npm start      # runs the built Electron app from dist/
```
Replace the proxy URL with your deployed proxy host if you are not running it locally.

## Project structure
- `renderer/` – React front-end (Vite).
- `electron/` – Main/Preload processes for the desktop app.
- `proxy/` – Minimal OpenAI proxy server (Express).
- `shared/` – Shared TypeScript types between renderer and main.
- `dist/` – Build output (generated).

## Notes
- The renderer persists session data in `localStorage`.
- The proxy provides a single `POST /chat` endpoint that forwards to OpenAI; Electron expects `AI_PROXY_URL` or `PROXY_BASE_URL` to be set and points calls there.
