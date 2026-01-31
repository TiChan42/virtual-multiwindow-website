import type { Rect, WindowSnapshot, VflLayout } from "./types";
import { getThisWindowID } from "./windowId";

type Msg =
  | { t: "hello"; id: string; rect: Rect; timestamp: number }
  | { t: "heartbeat"; id: string; rect: Rect }
  | { t: "goodbye"; id: string }
  | { t: "snapshot"; windows: Record<string, WindowSnapshot> };

const CHANNEL = "vwin:registry";
const STORAGE_KEY = "vwin:windows";

export class WindowRegistry {
  private id: string;
  private bc: BroadcastChannel | null = null;
  private windows: Record<string, WindowSnapshot> = {};
  private onChange: ((w: Record<string, WindowSnapshot>) => void) | null = null;
  private storageListener: ((ev: StorageEvent) => void) | null = null;

  constructor(onChange: (w: Record<string, WindowSnapshot>) => void) {
    this.onChange = onChange;
    this.id = getThisWindowID();
    this.bc = new BroadcastChannel(CHANNEL);
    this.bc.onmessage = (ev) => this.handle(ev.data as Msg);

    // Lade aus localStorage beim Initialisieren
    this.loadFromStorage();

    console.log(`[WindowRegistry] Created for window ${this.id} at ${new Date().toISOString()}`);

    // Höre auf Storage-Änderungen für Cross-Tab-Sync
    this.storageListener = (ev) => {
      if (ev.key === STORAGE_KEY && ev.newValue) {
        try {
          const stored = JSON.parse(ev.newValue);
          const currentIds = Object.keys(this.windows).sort().join(',');
          const storedIds = Object.keys(stored).sort().join(',');
          if (currentIds !== storedIds) {
            console.log("[WindowRegistry] Storage event, updating windows:", stored);
            this.windows = stored;
            this.emit();
          }
        } catch (e) {
          console.warn("Failed to parse stored windows:", e);
        }
      }
    };
    window.addEventListener("storage", this.storageListener);

    // announce ourselves so others learn about us quickly
    // (we still send hello from provider)
  }

  close() {
    this.bc?.close();
    this.bc = null;
    if (this.storageListener) {
      window.removeEventListener("storage", this.storageListener);
      this.storageListener = null;
    }
  }

  send(msg: Msg) {
    this.bc?.postMessage(msg);
    // Nach dem Senden aktualisiere localStorage
    this.saveToStorage();
  }

  getWindows() {
    return this.windows;
  }

  private emit() {
    this.onChange?.({ ...this.windows });
  }

  private loadFromStorage() {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.windows = JSON.parse(stored);
        console.log("[WindowRegistry] Loaded from storage:", this.windows);
        this.emit();
        // Sofort GC, um veraltete zu entfernen
        this.gc();
      }
    } catch (e) {
      console.warn("Failed to load windows from storage:", e);
    }
  }

  private saveToStorage() {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.windows));
    } catch (e) {
      console.warn("Failed to save windows to storage:", e);
    }
  }

  private handle(msg: Msg) {
    const now = Date.now();

    if (msg.t === "hello" || msg.t === "heartbeat") {
      this.windows[msg.id] = {
        ...(this.windows[msg.id] ?? { id: msg.id }),
        id: msg.id,
        lastSeen: now,
        rect: msg.rect,
        timestamp: msg.t === "hello" ? msg.timestamp : this.windows[msg.id]?.timestamp,
        assignedScreenId: this.windows[msg.id]?.assignedScreenId,
        viewportOffset: this.windows[msg.id]?.viewportOffset,
      };
      if (msg.t === "hello") {
        console.log("[WindowRegistry] Handling message:", msg);
        console.log("[WindowRegistry] Updated window:", msg.id, this.windows[msg.id]);
      }
      this.emit();
      this.saveToStorage();
      // Send snapshot occasionally could be added; we keep it simple: everyone maintains local map
      return;
    }

    if (msg.t === "goodbye") {
      console.log("[WindowRegistry] Handling message:", msg);
      console.log("[WindowRegistry] Removing window:", msg.id);
      delete this.windows[msg.id];
      this.emit();
      this.saveToStorage();
      return;
    }

    if (msg.t === "snapshot") {
      console.log("[WindowRegistry] Received snapshot:", msg.windows);
      this.windows = msg.windows ?? {};
      this.emit();
      this.saveToStorage();
      return;
    }
  }

  gc(timeoutMs = 30000) {
    const now = Date.now();
    let changed = false;
    const before = Object.keys(this.windows).length;
    for (const id of Object.keys(this.windows)) {
      if (now - this.windows[id].lastSeen > timeoutMs) {
        console.log("[WindowRegistry] GC removing stale window:", id);
        delete this.windows[id];
        changed = true;
      }
    }
    if (changed) {
      console.log(`[WindowRegistry] GC removed ${before - Object.keys(this.windows).length} windows`);
      this.emit();
      this.saveToStorage();
    }
  }
}

// helper: compute "window rect" from permissionless browser props
export function getCurrentWindowRect(): Rect {
  if (typeof window === "undefined") {
    // SSR: Fallback auf 0/0/1920/1080
    return { x: 0, y: 0, w: 1920, h: 1080 };
  }
  return {
    x: window.screenX,
    y: window.screenY,
    w: window.innerWidth,
    h: window.innerHeight,
  };
}

// helper: compute viewport offset relative to frame for rendering
export function computeViewportOffset(layout: VflLayout, winRect: Rect): { x: number; y: number } {
  return {
    x: winRect.x - layout.frame.x,
    y: winRect.y - layout.frame.y,
  };
}
