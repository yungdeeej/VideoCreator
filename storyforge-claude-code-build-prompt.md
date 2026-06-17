# Build Prompt — "StoryForge": Parallel AI Story-Video Generator

> Paste this whole document into Claude Code as the project brief. It is written as a spec + instructions. Build it in the phases listed at the bottom — get each phase working and testable before moving on.

---

## 1. What we're building

A web app that lets a small team produce **short cinematic story sequences end-to-end**: write a storyboard of scenes, generate the still image for each scene, animate each still into a video clip, run all clips **in parallel**, then stitch them in order with optional **title cards and text overlays**, and export one finished video.

The whole point is **speed through parallelism**. Today the workflow is manual and serial: generate an image, fire one video job, wait, download, repeat, then re-import everything into a video editor. This tool collapses that into: define the storyboard once → click "Generate All" → fire every job concurrently → assemble automatically → export.

Primary use case: animating pixel-art game lore sequences (cozy isometric farming-game style). Character and style consistency across scenes matters a lot.

---

## 2. Core user flow (the happy path)

1. User creates a **Project** (a storyline).
2. User sets a **Style Preset** for the project (a reusable style-prompt prefix auto-applied to all image prompts) and optionally uploads a **character reference image** for consistency.
3. User adds **Scenes** in order. Each scene has:
   - An **image prompt** (text → image).
   - A **motion prompt** (image → video).
   - A chosen **video model** (Kling for normal motion, Seedance for start→end-frame morphs).
   - Optional **per-scene text overlay** and/or a **title card** before it.
4. User clicks **Generate All**. The app:
   - Fires all **image** generations concurrently, shows live per-scene status.
   - As each image lands (or all at once), fires all **video** generations concurrently, shows live status + thumbnails.
5. User reviews clips, can **regenerate** any single scene without touching the others.
6. User clicks **Combine & Export**. The app normalizes all clips, inserts title cards, burns in text overlays, concatenates in scene order, and produces a single downloadable MP4.
7. Project state is **saved** so the user can come back and iterate.

---

## 3. Tech stack

- **Frontend:** React (Vite) + TypeScript + Tailwind CSS.
- **Backend:** Node.js + Express + TypeScript.
- **Video processing:** `ffmpeg` (installed in the environment) driven via `fluent-ffmpeg` or direct child-process calls.
- **AI:** fal.ai via the official `@fal-ai/client` JS SDK. **All fal calls happen on the backend** — the `FAL_KEY` must never reach the browser.
- **Storage (MVP):** local filesystem for generated assets + a single JSON (or SQLite) store for project data. Keep it swappable so we can move to object storage later.
- **Hosting:** Replit. Make sure ffmpeg is available (add it to the Replit config / nix deps if needed) and that long-running generation works within the platform's limits (use async jobs + polling, not one giant blocking request).

**Why this split:** the fal key is a secret, ffmpeg needs a real filesystem and CPU, and video jobs are long-running. The browser is only an orchestration UI; the backend does all the heavy lifting and exposes a small REST + polling API.

---

## 4. Data model

```
Project
  id, name, createdAt, updatedAt
  stylePreset: string            // prompt prefix applied to all image prompts
  characterRefImageUrl: string?  // optional, for consistency via image-edit endpoint
  aspectRatio: "1:1" | "16:9" | "9:16"
  scenes: Scene[]                // ordered

Scene
  id, order
  imagePrompt: string
  motionPrompt: string
  videoModel: "kling" | "seedance"
  // Seedance needs two frames:
  startImageUrl: string?         // generated image (or the prev scene's end)
  endImagePrompt: string?        // only for seedance morph scenes
  endImageUrl: string?
  imageUrl: string?              // generated still (for kling) = startImageUrl
  videoUrl: string?              // generated clip
  imageStatus: "idle"|"queued"|"running"|"done"|"error"
  videoStatus: "idle"|"queued"|"running"|"done"|"error"
  error: string?
  // optional overlay burned into THIS clip:
  textOverlay: { text, position, fontSize, color, startSec, endSec }?

TitleCard                        // inserted as its own clip between scenes
  id, order                      // shares ordering space with scenes
  text: string
  subtitle: string?
  durationSec: number            // default 2
  bgColor: string                // default near-black
  textColor: string
```

The export timeline is the **merge of scenes and title cards sorted by `order`**.

---

## 5. Feature spec

### 5.1 Image generation (Nano Banana)
- Model: **Nano Banana Pro** on fal. Support two modes:
  - **Text→image** (`fal-ai/nano-banana` text endpoint) when there's no character reference.
  - **Image-edit / reference** (`fal-ai/nano-banana/edit`-style endpoint) when a character reference image is set, so the character stays consistent across scenes. Pass the project's `characterRefImageUrl` as a reference input.
- The **final prompt sent** = `stylePreset + "\n\n" + scene.imagePrompt`. Show the user the assembled prompt but only store the editable part.
- Respect project `aspectRatio` and a sensible resolution (default ~1K — do NOT default to 4K; higher res makes pixel art smoother/worse and costs more).
- **IMPORTANT — verify current model slugs:** fal renames/versions models often. Before hardcoding, fetch the current model IDs and input schemas from fal.ai's model pages/docs and use those. Centralize all model IDs in one `models.config.ts` so they're easy to update.

### 5.2 Video generation (Kling + Seedance)
- **Kling (workhorse, image→video):** user-facing label "Kling Pro". Input = the scene's `imageUrl` + `motionPrompt` + duration (default 5s). Use the current Kling Pro image-to-video model on fal (verify slug — likely a `fal-ai/kling-video/v2...` family ID).
- **Seedance 1.5 Pro (start→end-frame morph):** input = `startImageUrl` + `endImageUrl` + `motionPrompt`. Use this for transformation scenes (e.g. run-down→restored farm). If a scene's model is `seedance`, the app must generate BOTH images first (`imagePrompt` → start, `endImagePrompt` → end) before firing the video job.
- Make the model list **config-driven** (`models.config.ts`) with: id, label, type (kling/seedance), default duration, price-per-second, required inputs. Adding Veo or another model later = one config entry, no code rewrite.

### 5.3 Parallel execution + status
- Use fal's **queue/async pattern**, not blocking calls. Submit jobs, get request IDs, poll status (or use webhooks if Replit supports a stable public URL — polling is the safer default).
- Fire all image jobs concurrently (`Promise.allSettled` over the scenes). Then fire all video jobs concurrently once their inputs exist.
- The backend tracks job state per scene; the frontend **polls a `/projects/:id/status` endpoint** every ~3s and updates the storyboard live (per-scene spinner → thumbnail → clip).
- One scene failing must NOT kill the batch (`allSettled`, per-scene error state, individual retry button).
- Add light **concurrency guarding** (e.g. cap simultaneous in-flight fal jobs to a configurable N, default 8) to respect rate limits.

### 5.4 Combine: stitch + title cards + text overlays (ffmpeg)
This is the part that breaks if done naively — follow exactly:
- **Normalize every clip first.** Re-encode all clips to identical codec/resolution/fps/pixel-format/SAR before concatenating (e.g. H.264, project aspect ratio, 30fps, yuv420p). Concatenating mismatched clips is the #1 cause of corrupt/janky output.
- **Title cards:** generate each as a short solid-color clip (matching res/fps) with centered text via ffmpeg `drawtext`. Duration from the data model.
- **Per-scene text overlays:** burn in with `drawtext` using the overlay's text/position/timing/color, applied to that scene's normalized clip.
- **Concatenate** all normalized clips + title cards in `order` using the concat demuxer (file list) — not the filter approach unless transitions are needed.
- Output a single **MP4 (H.264 + AAC if audio later)** to a downloadable path.
- Use a safe pixel-font-friendly default font for the cozy aesthetic; let font/size/color be set per overlay and per title card.

### 5.5 Export + download
- Expose the final MP4 for download, plus let the user download **individual clips** and **individual stills**.
- Show the **render status** of the combine step (it can take a bit) with progress if ffmpeg progress is parseable.

### 5.6 Cost preview
- Using per-second / per-image prices in `models.config.ts`, show an **estimated cost per scene and total per project** before "Generate All", and a running actual-cost tally after. Keeps spend visible.

---

## 6. UI requirements

- **Project list** → **Project editor**.
- Project editor = a **storyboard / vertical timeline** of scene cards in order. Each scene card shows: thumbnail (image then video), image prompt (editable), motion prompt (editable), model selector, status badges, regenerate buttons, optional overlay editor, cost estimate.
- Buttons between cards to **insert a title card** or **insert/reorder scenes**.
- Top bar: project name, style-preset editor, character-reference uploader, aspect-ratio selector, **Generate All**, **Combine & Export**, total cost estimate.
- Live status via polling — no manual refresh.
- Keep it clean, dark, and fast. (Consult the `frontend-design` skill for visual direction; aim for a focused tool aesthetic, not a generic dashboard.)

---

## 7. Constraints, gotchas, and defaults (READ CAREFULLY)

1. **Secrets:** `FAL_KEY` lives in backend env (`.env`, Replit secrets) and is NEVER sent to or referenced by the frontend. All fal calls are proxied through the backend.
2. **Verify fal model IDs at build time** — don't trust slugs from memory; fal versions them. Centralize in `models.config.ts`.
3. **Pixel-art preservation:** ship a default Style Preset and default motion-prompt suffix that include: "hard pixel edges, no anti-aliasing, no warping, no melting, no smoothing." Default video resolution ~720p/1K, not 4K.
4. **Normalize before concat** (Section 5.4) — most important ffmpeg detail.
5. **Async, never block:** long jobs use queue + polling; the HTTP request that starts a batch returns immediately with job IDs.
6. **Per-scene isolation:** one failure ≠ whole-batch failure; everything is individually retryable.
7. **Seedance scenes need two images** generated before the video job — enforce this ordering.
8. **Idempotent regeneration:** regenerating one scene must not re-run or overwrite others.

---

## 8. Default Style Preset to ship with (FarmTown pixel-art)

Pre-populate new projects with this editable preset:

```
Pixel art, cozy isometric farming-sim style: chibi proportions, bold black outlines,
flat saturated palette, hard pixel edges, NO anti-aliasing, no smoothing. Cinematic
lighting, warm golden-hour glow, soft long shadows, atmospheric depth. Polished indie
game key art, not AI generated.
```

And this default motion-prompt suffix (appended to every video prompt):

```
Smooth, stable, cinematic motion. Preserve the pixel art style exactly — hard pixel
edges, no warping, no melting, no smoothing of edges.
```

---

## 9. Environment / setup

- `FAL_KEY` — fal.ai API key (backend secret).
- Ensure `ffmpeg` is installed and on PATH in the Replit environment.
- `npm` scripts: `dev` (run frontend + backend concurrently), `build`, `start`.
- Provide a `.env.example` and a short README with run instructions.

---

## 10. Build order (do these in sequence, test each)

1. **Scaffold:** Vite React+TS frontend, Express+TS backend, shared types, `.env`, project JSON/SQLite store, health check.
2. **fal image gen:** backend endpoint that takes a prompt + style preset → returns an image URL via Nano Banana. Test from a simple form. Add reference-image (character consistency) mode.
3. **fal video gen:** backend endpoint image+motion prompt → Kling clip. Then add Seedance start+end mode. Test single scenes.
4. **Project + scenes data model + storyboard UI:** create/edit projects and ordered scenes, persist state.
5. **Parallel batch + live status:** Generate All fires concurrent jobs (allSettled, concurrency cap), `/status` polling endpoint, live UI updates, per-scene retry.
6. **ffmpeg combine:** normalize → title cards → text overlays → concat → single MP4. Get a clean export from a multi-scene project.
7. **Cost preview + polish:** cost estimates, individual downloads, error states, README.
8. (Later, not v1) per-clip trim/reorder, transitions, audio/music track, Veo support, multi-user auth, object storage.

---

## 11. Success criteria for v1

I can: create a project, set the FarmTown style preset + a twosox reference image, add ~6 scenes (mix of Kling motion shots and one Seedance morph), insert two title cards, click Generate All and watch all jobs run concurrently with live status, regenerate one scene I don't like, then Combine & Export a single clean MP4 with my title cards and text overlays — all without leaving the app or touching a separate video editor.
