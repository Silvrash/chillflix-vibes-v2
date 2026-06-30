# ChillFlixVibes 🍿

A streaming web app for browsing and watching movies, TV shows and anime. Built with **Next.js (App Router)**, **Tailwind CSS** and **TanStack Query**, with metadata from [TMDB](https://www.themoviedb.org/) and playback via embed providers.

> Originally an Expo (React Native) app, now redesigned as a dedicated web application.

## Features

- Browse **Movies**, **TV Shows** and **Anime** with curated preset filters
- Auto-rotating trending hero banner
- Infinite-scroll poster grid and live search
- Detail pages with cast, recommended and similar rails
- Embedded player with season/episode selection and multiple servers
- TMDB token kept server-side via a Next.js route proxy (`/api/tmdb/...`)

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` from the example and add your TMDB v4 read token:

   ```bash
   cp .env.example .env.local
   # then set TMDB_API_TOKEN=...
   ```

3. Run the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command         | Description                       |
| --------------- | --------------------------------- |
| `npm run dev`   | Start the development server      |
| `npm run build` | Production build                  |
| `npm start`     | Serve the production build        |
| `npm run lint`  | Run ESLint                        |

## Project structure

```
app/                 # App Router pages
  api/tmdb/[...path] # Server proxy to TMDB (hides the token)
  movies|tv|anime/   # Browse pages
  media/[type]/[id]/ # Detail page
  watch/[type]/[id]/ # Player page
components/           # UI: layout, browse, media, player, ui
lib/                  # tmdb client/queries/hooks, streaming, presets, storage
```
