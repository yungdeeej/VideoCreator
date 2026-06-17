export type Route =
  | { name: "list" }
  | { name: "editor"; id: string };

export function parseHash(): Route {
  const h = window.location.hash.replace(/^#/, "");
  const m = h.match(/^\/p\/([^/]+)/);
  if (m) return { name: "editor", id: m[1] };
  return { name: "list" };
}

export function navigate(route: Route): void {
  window.location.hash = route.name === "editor" ? `/p/${route.id}` : "/";
}
