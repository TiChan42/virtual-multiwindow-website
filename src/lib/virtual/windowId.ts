import { nanoid } from "nanoid";

const KEY = "vwin:id";

export function getThisWindowID(): string {
  // sessionStorage: neue ID pro Browser-Session/Fenster, bleibt beim Reload stabil
  const existing = typeof window !== "undefined" ? window.sessionStorage.getItem(KEY) : null;
  if (existing) return existing;

  const id = nanoid(10);
  window.sessionStorage.setItem(KEY, id);
  return id;
}
