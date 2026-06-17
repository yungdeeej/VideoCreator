import type { Request, RequestHandler, Response } from "express";
import { StoreNotFoundError } from "../store/store.js";

/** Wrap an async handler so rejections become clean HTTP error responses. */
export function asyncRoute(
  fn: (req: Request, res: Response) => Promise<void>,
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
