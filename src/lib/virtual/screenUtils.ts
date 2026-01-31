import type { VflLayout } from "@/lib/virtual/types";
import { normalizeLayout, decodeVflFromUrlParam } from "@/lib/virtual/vfl";

export async function getVflFromScreenDetails(): Promise<VflLayout | null> {
  // Permission / support dependent
  const anyWin = window as any;
  if (typeof anyWin.getScreenDetails !== "function") return null;

  try {
    const details = await anyWin.getScreenDetails(); // may prompt permission
    const screens = (details.screens ?? []).map((s: any, i: number) => ({
      id: s.id?.toString?.() ?? `S${i + 1}`,
      x: Number(s.left ?? s.availLeft ?? 0),
      y: Number(s.top ?? s.availTop ?? 0),
      w: Number(s.width ?? s.availWidth ?? window.screen.width),
      h: Number(s.height ?? s.availHeight ?? window.screen.height),
      scale: typeof s.devicePixelRatio === "number" ? s.devicePixelRatio : undefined,
    }));
    if (!screens.length) return null;

    const vfl = normalizeLayout({ v: 1, screens });
    console.log("[VFL]", JSON.stringify(vfl, null, 2));
    return vfl;
  } catch (e) {
    console.warn("getScreenDetails failed or denied:", e);
    return null;
  }
}

export function getLayoutFromUrl(): VflLayout | null {
  const url = new URL(window.location.href);
  const p = url.searchParams.get("layout");
  if (!p) return null;
  return decodeVflFromUrlParam(p);
}

export function computeLayoutFromScreens(): VflLayout {
  // Compute layout from screen properties (without permission)
  const scr = window.screen as any;
  const availLeft = scr.availLeft ?? 0;
  const availTop = scr.availTop ?? 0;
  const availWidth = scr.availWidth;
  const availHeight = scr.availHeight;
  const screens = [
    { id: "S1", x: availLeft, y: availTop, w: availWidth, h: availHeight },
  ];
  // For multi-monitor, one could add more, but screen API is limited
  const frame = {
    x: availLeft,
    y: availTop,
    w: availWidth,
    h: availHeight,
  };
  return normalizeLayout({ v: 1, frame, screens });
}