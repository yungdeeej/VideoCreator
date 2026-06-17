import { Router } from "express";
import { store } from "../store/store.js";
import { asyncRoute } from "../util/route.js";
import {
  generateAll,
  regenerateItem,
  statusOf,
} from "../jobs/jobManager.js";
import { estimateProjectCost } from "../services/cost.service.js";

export const generateRouter = Router();

/** Start generating every not-yet-done scene. Returns immediately. */
generateRouter.post(
  "/:id/generate",
  asyncRoute(async (req, res) => {
    const scenes = await generateAll(req.params.id);
    res.json({ started: true, scenes });
  }),
);

/** Regenerate one scene without touching the rest. ?stage=video re-renders
 * only the clip from the existing stills (no image re-spend). */
generateRouter.post(
  "/:id/items/:itemId/regenerate",
  asyncRoute(async (req, res) => {
    const videoOnly = req.query.stage === "video";
    const ok = await regenerateItem(req.params.id, req.params.itemId, {
      videoOnly,
    });
    res.json({ started: ok });
  }),
);

/** Live status snapshot — the frontend polls this ~every 3s. */
generateRouter.get(
  "/:id/status",
  asyncRoute(async (req, res) => {
    const project = await store.get(req.params.id);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json(statusOf(req.params.id, project));
  }),
);

/** Cost estimate for the project. */
generateRouter.get(
  "/:id/cost",
  asyncRoute(async (req, res) => {
    const project = await store.get(req.params.id);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json(estimateProjectCost(project));
  }),
);
