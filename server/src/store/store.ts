/**
 * Project persistence. The MVP uses a single JSON file, but everything goes
 * through the `ProjectStore` interface so it can later be swapped for SQLite
 * or object storage without touching the routes/services.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../env.js";
import type { Project } from "@storyforge/shared";

export interface ProjectStore {
  list(): Promise<Project[]>;
  get(id: string): Promise<Project | undefined>;
  create(project: Project): Promise<Project>;
  /** Mutate-and-persist atomically. Returns the updated project. */
  update(id: string, mutate: (p: Project) => void): Promise<Project>;
  delete(id: string): Promise<boolean>;
}

interface DbShape {
  projects: Record<string, Project>;
}

class JsonProjectStore implements ProjectStore {
  private file: string;
  private cache: DbShape | null = null;
  /** Serializes writes so concurrent generation updates don't clobber. */
  private writeChain: Promise<unknown> = Promise.resolve();

  constructor(file: string) {
    this.file = file;
  }

  private async load(): Promise<DbShape> {
    if (this.cache) return this.cache;
    try {
      const raw = await fs.readFile(this.file, "utf8");
      this.cache = JSON.parse(raw) as DbShape;
    } catch (err: any) {
      if (err?.code === "ENOENT") {
        this.cache = { projects: {} };
      } else {
        throw err;
      }
    }
    if (!this.cache.projects) this.cache.projects = {};
    return this.cache;
  }

  private async persist(): Promise<void> {
    const db = await this.load();
    const tmp = `${this.file}.tmp`;
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
    await fs.rename(tmp, this.file); // atomic-ish replace
  }

  /** Run a mutation as part of the serialized write chain. */
  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.writeChain.then(fn, fn);
    // keep the chain alive regardless of individual failures
    this.writeChain = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  async list(): Promise<Project[]> {
    const db = await this.load();
    return Object.values(db.projects).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
  }

  async get(id: string): Promise<Project | undefined> {
    const db = await this.load();
    return db.projects[id];
  }

  async create(project: Project): Promise<Project> {
    return this.enqueue(async () => {
      const db = await this.load();
      db.projects[project.id] = project;
      await this.persist();
      return project;
    });
  }

  async update(id: string, mutate: (p: Project) => void): Promise<Project> {
    return this.enqueue(async () => {
      const db = await this.load();
      const project = db.projects[id];
      if (!project) throw new StoreNotFoundError(id);
      mutate(project);
      project.updatedAt = new Date().toISOString();
      await this.persist();
      return project;
    });
  }

  async delete(id: string): Promise<boolean> {
    return this.enqueue(async () => {
      const db = await this.load();
      if (!db.projects[id]) return false;
      delete db.projects[id];
      await this.persist();
      return true;
    });
  }
}

export class StoreNotFoundError extends Error {
  constructor(id: string) {
    super(`Project not found: ${id}`);
    this.name = "StoreNotFoundError";
  }
}

export const store: ProjectStore = new JsonProjectStore(
  path.join(env.paths.dataDir, "db.json"),
);
