import { Router, type RequestHandler } from "express";
import {
  addScene,
  addTitleCard,
  createProject,
  deleteItem,
  deleteProject,
  getProject,
  listProjects,
  reorderItems,
  StoreNotFoundError,
  updateProject,
  updateScene,
  updateTitleCard,
} from "../services/project.service.js";

export const projectsRouter = Router();

/** Wrap an async handler so rejections become clean HTTP errors. */
function asyncRoute(
  fn: (req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1]) => Promise<void>,
): RequestHandler {
  return (req, res) => {
    fn(req, res).catch((err: any) => {
      const msg = err?.message ?? String(err);
      const notFound =
        err instanceof StoreNotFoundError || /not found/i.test(msg);
      res.status(notFound ? 404 : 500).json({ error: msg });
    });
  };
}

// ---------- projects ----------

projectsRouter.get(
  "/",
  asyncRoute(async (_req, res) => {
    res.json(await listProjects());
  }),
);

projectsRouter.post(
  "/",
  asyncRoute(async (req, res) => {
    const project = await createProject(req.body ?? {});
    res.status(201).json(project);
  }),
);

projectsRouter.get(
  "/:id",
  asyncRoute(async (req, res) => {
    const project = await getProject(req.params.id);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json(project);
  }),
);

projectsRouter.patch(
  "/:id",
  asyncRoute(async (req, res) => {
    res.json(await updateProject(req.params.id, req.body ?? {}));
  }),
);

projectsRouter.delete(
  "/:id",
  asyncRoute(async (req, res) => {
    const ok = await deleteProject(req.params.id);
    res.status(ok ? 204 : 404).end();
  }),
);

// ---------- scenes ----------

projectsRouter.post(
  "/:id/scenes",
  asyncRoute(async (req, res) => {
    res.status(201).json(await addScene(req.params.id, req.body ?? {}));
  }),
);

projectsRouter.patch(
  "/:id/scenes/:sceneId",
  asyncRoute(async (req, res) => {
    res.json(
      await updateScene(req.params.id, req.params.sceneId, req.body ?? {}),
    );
  }),
);

// ---------- title cards ----------

projectsRouter.post(
  "/:id/titles",
  asyncRoute(async (req, res) => {
    res.status(201).json(await addTitleCard(req.params.id, req.body ?? {}));
  }),
);

projectsRouter.patch(
  "/:id/titles/:titleId",
  asyncRoute(async (req, res) => {
    res.json(
      await updateTitleCard(req.params.id, req.params.titleId, req.body ?? {}),
    );
  }),
);

// ---------- timeline ----------

projectsRouter.delete(
  "/:id/items/:itemId",
  asyncRoute(async (req, res) => {
    res.json(await deleteItem(req.params.id, req.params.itemId));
  }),
);

projectsRouter.post(
  "/:id/reorder",
  asyncRoute(async (req, res) => {
    const orderedIds = (req.body?.orderedIds ?? []) as string[];
    res.json(await reorderItems(req.params.id, orderedIds));
  }),
);
