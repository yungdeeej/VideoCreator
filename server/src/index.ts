import express from "express";
import cors from "cors";
import fs from "node:fs";
import { env, hasFal, hasClaude } from "./env.js";
import { buildPublicConfig } from "./config/models.config.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Serve generated stills / clips / exports as static files.
app.use("/assets", express.static(env.paths.assetsDir));
app.use("/exports", express.static(env.paths.exportsDir));

// ---------- health + config ----------

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    falConfigured: !!env.FAL_KEY,
    mockMode: env.FAL_MOCK,
    ready: hasFal(),
    claudeConfigured: !!env.ANTHROPIC_API_KEY,
    claudeReady: hasClaude(),
    time: new Date().toISOString(),
  });
});

app.get("/api/config", (_req, res) => {
  res.json(
    buildPublicConfig({
      maxConcurrentJobs: env.MAX_CONCURRENT_JOBS,
      mockMode: env.FAL_MOCK,
      assistAvailable: hasClaude(),
      assistMock: env.CLAUDE_MOCK,
    }),
  );
});

// ---------- API routes (mounted in later phases) ----------
// Registered lazily so the file stays readable as the app grows.
async function mountRoutes() {
  const { projectsRouter } = await import("./routes/projects.routes.js");
  const { generateRouter } = await import("./routes/generate.routes.js");
  const { assetsRouter } = await import("./routes/assets.routes.js");
  const { exportRouter } = await import("./routes/export.routes.js");
  const { assistRouter } = await import("./routes/assist.routes.js");
  app.use("/api/projects", projectsRouter);
  app.use("/api/projects", generateRouter);
  app.use("/api/projects", exportRouter);
  app.use("/api", assetsRouter);
  app.use("/api/assist", assistRouter);
}

// ---------- production: serve built client ----------

function mountClient() {
  const dist = env.paths.clientDist;
  if (!fs.existsSync(dist)) return;
  app.use(express.static(dist));
  // SPA fallback for non-API routes.
  app.get(/^\/(?!api|assets|exports).*/, (_req, res) => {
    res.sendFile(`${dist}/index.html`);
  });
}

async function main() {
  await mountRoutes();
  mountClient();

  app.listen(env.PORT, () => {
    console.log(`[storyforge] backend listening on http://localhost:${env.PORT}`);
    console.log(`[storyforge] data dir: ${env.paths.dataDir}`);
    if (env.FAL_MOCK) {
      console.log("[storyforge] FAL_MOCK enabled — generating placeholders locally.");
    } else if (!env.FAL_KEY) {
      console.warn("[storyforge] WARNING: FAL_KEY not set. Generation will fail until you set it (or FAL_MOCK=1).");
    }
  });
}

main().catch((err) => {
  console.error("[storyforge] fatal startup error:", err);
  process.exit(1);
});
