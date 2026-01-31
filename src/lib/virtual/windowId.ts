import { nanoid } from "nanoid";

const KEY = "vwin:id";

export function getThisWindowID(): string {
  // sessionStorage: new ID per browser session/window, remains stable on reload
  const existing = typeof window !== "undefined" ? window.sessionStorage.getItem(KEY) : null;
  if (existing) return existing;

  const id = nanoid(10);
  window.sessionStorage.setItem(KEY, id);
  return id;
}
