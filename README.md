# StoryForge

A web app for producing **short cinematic story sequences end-to-end**: write a
storyboard of scenes, generate the still image for each scene, animate each
still into a clip, run all clips **in parallel**, then stitch them in order with
**title cards and text overlays**, and export one finished MP4.

The whole point is **speed through parallelism** — define the storyboard once,
click **Generate All**, fire every job concurrently, assemble automatically, and
export, without ever leaving the app for a separate video editor.

Built for animating pixel-art game-lore sequences (cozy isometric farming-game
style), where character and style consistency across scenes matter.

---

## Architecture

```
client/   Vite + React + TypeScript + Tailwind   — orchestration UI only
server/   Express + TypeScript                     — all AI + ffmpeg work
shared/   @storyforge/shared                        — shared types (one source of truth)
```

- **All fal.ai calls happen on the backend.** `FAL_KEY` is a backend secret and
  is never sent to or referenced by the browser.
- The browser is a thin orchestration UI. It POSTs to start work and **polls**
  `GET /api/projects/:id/status` (~every 3s) for live progress.
- Long jobs use fal's **queue/async** pattern (submit → poll → result); the HTTP
  request that starts a batch returns immediately.
- Video assembly uses **ffmpeg** (normalize → title cards → overlays → concat).
- Persistence is a single JSON store (`server/data/db.json`) behind a swappable
  `ProjectStore` interface; generated assets live under `server/data/`.

### Generation pipeline

1. **Images** — Nano Banana Pro on fal. Text→image normally; the
   image-edit/reference endpoint when a character reference is set (for
   consistency). The final prompt is `stylePreset + "\n\n" + scene.imagePrompt`.
2. **Video** — config-driven:
   - **Kling Pro** (`image → video`): the workhorse.
   - **Seedance 1.5 Pro** (`start-frame + end-frame → video`): morph/transform
     scenes. The app generates **both** stills before firing the clip job.
3. **Parallel batch** — every scene's pipeline runs concurrently; the in-flight
   fal calls are throttled by a global semaphore (`MAX_CONCURRENT_JOBS`, default
   8). One scene failing never kills the batch — each is individually retryable.
4. **Combine** — every clip is re-encoded to identical
   H.264 / project-aspect / 30fps / yuv420p / SAR **before** concatenation (the
   #1 correctness detail), title cards are rendered as solid-color clips with
   centered text, per-scene overlays are burned in with `drawtext`, and
   everything is concatenated in `order` via the concat demuxer into one MP4.

### Model configuration

All model IDs, prices, and defaults live in
[`server/src/config/models.config.ts`](server/src/config/models.config.ts) —
the single place to update them. Adding another video model (e.g. Veo) is one
config entry, no code rewrite.

> **fal versions models often.** The slugs in that file were verified against
> fal.ai's model pages at build time (Nano Banana Pro, Kling v2.1 Pro, Seedance
> v1.5 Pro). Re-verify slugs and prices on fal before relying on them.

---

## Prerequisites

- **Node.js ≥ 20**
- **ffmpeg** (and `ffprobe`) on `PATH` — required for the combine/export step.
  - macOS: `brew install ffmpeg`
  - Debian/Ubuntu: `apt-get install -y ffmpeg`
  - Replit: add `ffmpeg` to the Nix deps (`replit.nix`).
- A **fal.ai API key** for real generation (`FAL_KEY`).

---

## Setup

```bash
git clone <repo> && cd VideoCreator
npm install
cp .env.example .env        # then edit .env and set FAL_KEY
```

### Environment (`.env`, repo root — or Replit Secrets)

| Var                   | Default                | Purpose                                            |
| --------------------- | ---------------------- | -------------------------------------------------- |
| `FAL_KEY`             | —                      | fal.ai API key (**backend secret**). Required.     |
| `PORT`                | `8787`                 | Backend HTTP port.                                 |
| `DATA_DIR`            | `server/data`          | Where the JSON store + assets live.                |
| `FFMPEG_PATH`         | `ffmpeg`               | ffmpeg binary path.                                |
| `FFPROBE_PATH`        | `ffprobe`              | ffprobe binary path.                               |
| `FONT_FILE`           | DejaVu Sans            | TTF used for title cards + overlays.               |
| `MAX_CONCURRENT_JOBS` | `8`                    | Cap on simultaneous in-flight fal jobs.            |
| `FAL_MOCK`            | `0`                    | `1` = no fal calls; synthesize placeholders (below)|
| `PUBLIC_BASE_URL`     | —                      | Public URL of the backend (rarely needed).         |

---

## Running

```bash
npm run dev      # runs backend (8787) + frontend (5173) concurrently
```

Open http://localhost:5173. The Vite dev server proxies `/api`, `/assets`, and
`/exports` to the backend.

Production:

```bash
npm run build    # builds shared + server + client
npm start        # serves the API and the built client from the backend
```

### Mock mode (no API key needed)

Set `FAL_MOCK=1` to exercise the **entire** storyboard → generate → combine →
export pipeline without a `FAL_KEY`. Instead of calling fal, the backend
synthesizes placeholder stills and clips locally with ffmpeg. Great for trying
the UI, the parallel batch, and the export end-to-end.

```bash
FAL_MOCK=1 npm run dev
```

---

## Typical flow

1. Create a project. It ships with the FarmTown pixel-art **style preset** and a
   pixel-preservation **motion suffix** (both editable).
2. Optionally upload a **character reference** image (for consistency) and pick
   an **aspect ratio**.
3. Add **scenes** (image prompt, motion prompt, model, duration, optional text
   overlay) and **title cards**, reorder freely.
4. Watch the running **cost estimate**; click **Generate All** to fire every job
   concurrently with live per-scene status.
5. **Regenerate** any single scene (image+clip, or clip-only) without touching
   the others.
6. **Combine & Export** → one downloadable MP4. Individual stills and clips are
   downloadable per scene too.

---

## API surface (backend)

| Method | Path                                          | Purpose                          |
| ------ | --------------------------------------------- | -------------------------------- |
| GET    | `/api/health`                                 | health + fal/mock status         |
| GET    | `/api/config`                                 | secret-free config for the UI    |
| GET    | `/api/projects`                               | list projects                    |
| POST   | `/api/projects`                               | create project                   |
| GET    | `/api/projects/:id`                           | get project                      |
| PATCH  | `/api/projects/:id`                           | update project settings          |
| DELETE | `/api/projects/:id`                           | delete project                   |
| POST   | `/api/projects/:id/scenes`                    | add scene                        |
| PATCH  | `/api/projects/:id/scenes/:sceneId`           | update scene                     |
| POST   | `/api/projects/:id/titles`                    | add title card                   |
| PATCH  | `/api/projects/:id/titles/:titleId`           | update title card                |
| DELETE | `/api/projects/:id/items/:itemId`             | delete scene/title               |
| POST   | `/api/projects/:id/reorder`                   | reorder timeline                 |
| POST   | `/api/projects/:id/generate`                  | start parallel generation        |
| POST   | `/api/projects/:id/items/:itemId/regenerate`  | regenerate one scene (`?stage=video`) |
| GET    | `/api/projects/:id/status`                    | live status (poll this)          |
| GET    | `/api/projects/:id/cost`                      | cost estimate                    |
| POST   | `/api/projects/:id/export`                    | start combine + export           |
| POST   | `/api/upload/reference`                        | upload character reference       |

---

## Notes & limitations (v1)

- Output is **video-only** (no audio); clips are normalized with no audio track
  so concat stays clean. Audio/music is a later addition.
- Generation state is in-memory plus the JSON store; restarting the backend
  mid-batch loses in-flight job tracking (already-saved URLs persist).
- Not yet: per-clip trim/reorder within the editor, transitions, Veo support,
  multi-user auth, object storage. These are intentionally out of scope for v1.
