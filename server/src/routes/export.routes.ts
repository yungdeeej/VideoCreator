import { Router } from "express";
import { asyncRoute } from "../util/route.js";
import { startExport } from "../services/export.service.js";

export const exportRouter = Router();

/** Start (or no-op if already running) the combine + export render. */
exportRouter.post(
  "/:id/export",
  asyncRoute(async (req, res) => {
    const started = await startExport(req.params.id);
    res.json({ started });
  }),
);
