import { z } from "zod";
import type { Rect, VflLayout, VflScreen } from "./types";

const RectZ = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
});

const ScreenZ = RectZ.extend({
  id: z.string().min(1),
  scale: z.number().optional(),
});

const LayoutZ = z.object({
  v: z.literal(1),
  frame: RectZ,
  screens: z.array(ScreenZ).min(1),
});

export function unionRects(rects: Rect[]): Rect {
  const xs = rects.map((r) => r.x);
  const ys = rects.map((r) => r.y);
  const x2 = rects.map((r) => r.x + r.w);
  const y2 = rects.map((r) => r.y + r.h);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...x2);
  const maxY = Math.max(...y2);
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function normalizeLayout(layout: Omit<VflLayout, "frame"> & { frame?: Rect }): VflLayout {
  const frame = layout.frame ?? unionRects(layout.screens);
  const normalized: VflLayout = { v: 1, frame, screens: layout.screens };
  LayoutZ.parse(normalized);
  return normalized;
}

// base64url helpers
function b64urlEncode(str: string): string {
  const b64 = btoa(unescape(encodeURIComponent(str)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function b64urlDecode(b64url: string): string {
  const pad = b64url.length % 4 === 0 ? "" : "=".repeat(4 - (b64url.length % 4));
  const b64 = (b64url + pad).replace(/-/g, "+").replace(/_/g, "/");
  return decodeURIComponent(escape(atob(b64)));
}

/**
 * URL-Format: layout=vfl1.<urlencoded(json)>
 */
export function encodeVflToUrlParam(layout: VflLayout): string {
  LayoutZ.parse(layout);
  const json = JSON.stringify(layout);
  return `vfl1.${encodeURIComponent(json)}`;
}

export function decodeVflFromUrlParam(param: string): VflLayout | null {
  if (!param?.startsWith("vfl1.")) return null;
  const payload = param.slice("vfl1.".length);
  try {
    const json = decodeURIComponent(payload);
    const parsed = JSON.parse(json);
    const layout = LayoutZ.parse(parsed) as VflLayout;
    return layout;
  } catch {
    return null;
  }
}

export function rectIntersection(a: Rect, b: Rect): Rect | null {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  if (x2 <= x1 || y2 <= y1) return null;
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export function area(r: Rect): number {
  return Math.max(0, r.w) * Math.max(0, r.h);
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function normalizedSizeDistance(a: { w: number; h: number }, b: { w: number; h: number }): number {
  // relative difference (0..1+) then clamp to 0..1
  const dw = Math.abs(a.w - b.w) / Math.max(a.w, b.w);
  const dh = Math.abs(a.h - b.h) / Math.max(a.h, b.h);
  return clamp01((dw + dh) / 2);
}

// stable "random" tie-breaker (deterministic)
export function stableRand01(key: string): number {
  // simple FNV-1a-ish hash
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // map to [0,1)
  return ((h >>> 0) % 1_000_000) / 1_000_000;
}

/**
 * Assign window to one screen:
 * - primary: overlap ratio
 * - secondary: size similarity
 * - tie: stableRand(windowId + screenId)
 */
export function assignScreenForWindow(args: {
  windowId: string;
  winRect: Rect;
  screens: VflScreen[];
  scoreEpsilon?: number;
}): { screenId: string; score: number } {
  const { windowId, winRect, screens, scoreEpsilon = 0.01 } = args;
  const winArea = Math.max(1, area(winRect));

  let best: { screenId: string; score: number; tie: number } | null = null;

  for (const s of screens) {
    const inter = rectIntersection(winRect, s);
    const overlap = inter ? area(inter) : 0;
    const overlapRatio = overlap / winArea;

    const sizeDist = normalizedSizeDistance({ w: winRect.w, h: winRect.h }, { w: s.w, h: s.h });
    const sizeScore = 1 - sizeDist;

    const score = overlap > 0
      ? 0.8 * overlapRatio + 0.2 * sizeScore
      : 0.05 * sizeScore;

    const tie = stableRand01(`${windowId}:${s.id}`);

    if (!best) {
      best = { screenId: s.id, score, tie };
      continue;
    }

    if (score > best.score + scoreEpsilon) {
      best = { screenId: s.id, score, tie };
    } else if (Math.abs(score - best.score) <= scoreEpsilon) {
      // tie-break: "random" but stable
      if (tie < best.tie) best = { screenId: s.id, score, tie };
    }
  }

  // fallback
  return best ?? { screenId: screens[0].id, score: 0 };
}
