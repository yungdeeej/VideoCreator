import type {
  CreateProjectInput,
  CreateSceneInput,
  CreateTitleCardInput,
  Project,
  ProjectCostEstimate,
  ProjectStatus,
  PublicConfig,
  UpdateProjectInput,
  UpdateSceneInput,
  UpdateTitleCardInput,
} from "@storyforge/shared";

async function req<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const opts: RequestInit = { ...init };
  if (init?.json !== undefined) {
    opts.body = JSON.stringify(init.json);
    opts.headers = { "Content-Type": "application/json", ...(init.headers ?? {}) };
  }
  const res = await fetch(`/api${path}`, opts);
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  getConfig: () => req<PublicConfig>("/config"),

  // projects
  listProjects: () => req<Project[]>("/projects"),
  getProject: (id: string) => req<Project>(`/projects/${id}`),
  createProject: (input: CreateProjectInput) =>
    req<Project>("/projects", { method: "POST", json: input }),
  updateProject: (id: string, patch: UpdateProjectInput) =>
    req<Project>(`/projects/${id}`, { method: "PATCH", json: patch }),
  deleteProject: (id: string) =>
    req<void>(`/projects/${id}`, { method: "DELETE" }),

  // scenes
  addScene: (id: string, input: CreateSceneInput) =>
    req<Project>(`/projects/${id}/scenes`, { method: "POST", json: input }),
  updateScene: (id: string, sceneId: string, patch: UpdateSceneInput) =>
    req<Project>(`/projects/${id}/scenes/${sceneId}`, {
      method: "PATCH",
      json: patch,
    }),

  // title cards
  addTitleCard: (id: string, input: CreateTitleCardInput) =>
    req<Project>(`/projects/${id}/titles`, { method: "POST", json: input }),
  updateTitleCard: (id: string, titleId: string, patch: UpdateTitleCardInput) =>
    req<Project>(`/projects/${id}/titles/${titleId}`, {
      method: "PATCH",
      json: patch,
    }),

  // timeline
  deleteItem: (id: string, itemId: string) =>
    req<Project>(`/projects/${id}/items/${itemId}`, { method: "DELETE" }),
  reorder: (id: string, orderedIds: string[]) =>
    req<Project>(`/projects/${id}/reorder`, {
      method: "POST",
      json: { orderedIds },
    }),

  // generation (Phase 5)
  generateAll: (id: string) =>
    req<{ started: boolean }>(`/projects/${id}/generate`, { method: "POST" }),
  regenerateItem: (
    id: string,
    itemId: string,
    stage: "all" | "video" = "all",
  ) =>
    req<{ started: boolean }>(
      `/projects/${id}/items/${itemId}/regenerate${stage === "video" ? "?stage=video" : ""}`,
      { method: "POST" },
    ),
  getStatus: (id: string) => req<ProjectStatus>(`/projects/${id}/status`),
  getCost: (id: string) => req<ProjectCostEstimate>(`/projects/${id}/cost`),

  // export (Phase 6)
  combine: (id: string) =>
    req<{ started: boolean }>(`/projects/${id}/export`, { method: "POST" }),

  // uploads
  uploadReference: async (file: File): Promise<string> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/upload/reference", {
      method: "POST",
      body: form,
    });
    if (!res.ok) throw new Error(`Upload failed: HTTP ${res.status}`);
    const body = await res.json();
    return body.url as string;
  },
};
