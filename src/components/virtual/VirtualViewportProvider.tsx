"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { VflLayout } from "@/lib/virtual/types";
import { decodeVflFromUrlParam, normalizeLayout, assignScreenForWindow, encodeVflToUrlParam } from "@/lib/virtual/vfl";
import { getThisWindowID } from "@/lib/virtual/windowId";
import { WindowRegistry, getCurrentWindowRect, computeViewportOffset } from "@/lib/virtual/registry";
import { Minimap } from "./Minimap";

type Ctx = {
  windowId: string;
  layout: VflLayout | null;
  winRect: { x: number; y: number; w: number; h: number };
  viewportOffset: { x: number; y: number };
  assignedScreenId?: string;
  windows: Record<string, any>;
  permissionPending: boolean;
  requestPermission: () => Promise<void>;
  computeWithoutPermission: () => void;
};

export const VirtualCtx = React.createContext<Ctx | null>(null);

async function getVflFromScreenDetails(): Promise<VflLayout | null> {
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

function getLayoutFromUrl(): VflLayout | null {
  const url = new URL(window.location.href);
  const p = url.searchParams.get("layout");
  if (!p) return null;
  return decodeVflFromUrlParam(p);
}

function computeLayoutFromScreens(): VflLayout {
  // Berechne Layout aus screen-Eigenschaften (ohne Permission)
  const scr = window.screen as any;
  const availLeft = scr.availLeft ?? 0;
  const availTop = scr.availTop ?? 0;
  const availWidth = scr.availWidth;
  const availHeight = scr.availHeight;
  const screens = [
    { id: "S1", x: availLeft, y: availTop, w: availWidth, h: availHeight },
  ];
  // Für Multi-Monitor könnte man weitere hinzufügen, aber screen API ist limitiert
  const frame = {
    x: availLeft,
    y: availTop,
    w: availWidth,
    h: availHeight,
  };
  return normalizeLayout({ v: 1, frame, screens });
}

export function VirtualViewportProvider({ children }: { children: React.ReactNode }) {
  // SSR: windowId und winRect initial neutral, im Client nachziehen
  // console.log('[VirtualViewportProvider] mount');
  const [windowId, setWindowId] = useState<string>("");
  const [winRect, setWinRect] = useState(() => ({ x: 0, y: 0, w: 1920, h: 1080 }));
  const [layout, setLayout] = useState<VflLayout | null>(null);
  const [assignedScreenId, setAssignedScreenId] = useState<string | undefined>(undefined);
  const [viewportOffset, setViewportOffset] = useState({ x: 0, y: 0 });
  const [windows, setWindows] = useState<Record<string, any>>({});
  const [permissionPending, setPermissionPending] = useState<boolean>(false);
  const [showMinimap, setShowMinimap] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      return url.searchParams.get("minimap") === "true";
    }
    return false;
  });
  React.useEffect(() => { return () => { /* console.log('[VirtualViewportProvider] unmount'); */ }; }, []);

  const requestPermission = async () => {
    const vfl = await getVflFromScreenDetails();
    if (vfl) {
      const param = encodeVflToUrlParam(vfl);
      const newUrl = `${window.location.origin}${window.location.pathname}?layout=${param}`;
      console.log('[VirtualViewportProvider] permission granted, layout computed, reloading with', newUrl);
      window.location.href = newUrl; // Reloads the page
    } else {
      console.warn('[VirtualViewportProvider] permission denied or failed');
      // Optional: Setze permissionPending zurück oder zeige Fehler
    }
  };

  const computeWithoutPermission = () => {
    const computedLayout = computeLayoutFromScreens();
    const param = encodeVflToUrlParam(computedLayout);
    const newUrl = `${window.location.origin}${window.location.pathname}?layout=${param}`;
    console.log('[VirtualViewportProvider] computed layout without permission, reloading with', newUrl);
    window.location.href = newUrl; // Reloads the page
  };

  const registryRef = useRef<WindowRegistry | null>(null);

  // init registry
  // windowId und winRect im Client initialisieren
  useEffect(() => {
    if (typeof window !== "undefined") {
      const id = getThisWindowID();
      setWindowId(id);
      setWinRect(getCurrentWindowRect());
      // console.log('[VirtualViewportProvider] set windowId', id);
    }
  }, []);

  useEffect(() => {
    if (!windowId) return;
    // console.log('[VirtualViewportProvider] windowId effect', windowId);
    const reg = new WindowRegistry((w) => {
      setWindows(w);
      // console.log('[VirtualViewportProvider] windows updated', w);
    });
    registryRef.current = reg;

    console.log(`[VirtualViewportProvider] Registry created for window ${windowId}`);

    const helloRect = getCurrentWindowRect();
    reg.send({ t: "hello", id: windowId, rect: helloRect, timestamp: Date.now() });
    // Add own window to the registry since BroadcastChannel doesn't send to self
    setWindows(prev => ({
      ...prev,
      [windowId]: {
        id: windowId,
        lastSeen: Date.now(),
        rect: helloRect,
        timestamp: Date.now(),
      }
    }));
    // Sende snapshot, um andere über den aktuellen Zustand zu informieren
    setTimeout(() => {
      reg.send({ t: "snapshot", windows: reg.getWindows() });
    }, 100); // Kurze Verzögerung, um hello zu verarbeiten

    // Nach Reload: Zeige alle aktuellen Fenster in der Konsole
    setTimeout(() => {
      console.log('[VirtualViewportProvider] Aktuelle Fenster nach Reload:', reg.getWindows());
    }, 200);

    const onUnload = () => reg.send({ t: "goodbye", id: windowId });
    window.addEventListener("beforeunload", onUnload);

    return () => {
      window.removeEventListener("beforeunload", onUnload);
      reg.close();
      registryRef.current = null;
      // console.log('[VirtualViewportProvider] registry closed');
    };
  }, [windowId]);

  // decide mode:
  // - if URL layout exists => permissionless mode
  // - else => set permissionPending to true, wait for user to request permission
  useEffect(() => {
    const fromUrl = getLayoutFromUrl();
    if (fromUrl) {
      setLayout(fromUrl);
      setPermissionPending(false);
      // console.log('[VirtualViewportProvider] layout from URL', fromUrl);
      return;
    }

    // no URL => set pending, user must request permission
    setPermissionPending(true);
    // console.log('[VirtualViewportProvider] no layout, permission pending');
  }, []);

  // update window rect (resize + adaptive polling)
  useEffect(() => {
    let raf: number | null = null;
    let interval: number | null = null;

    const update = () => {
      const r = getCurrentWindowRect();
      setWinRect((prev) => {
        const dx = Math.abs(prev.x - r.x);
        const dy = Math.abs(prev.y - r.y);
        const dw = Math.abs(prev.w - r.w);
        const dh = Math.abs(prev.h - r.h);
        // avoid tiny churn
        if (dx + dy + dw + dh < 2) return prev;
        // console.log('[VirtualViewportProvider] winRect changed', r);
        return r;
      });
    };

    const onResize = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };

    window.addEventListener("resize", onResize);

    // Polling (move detection) - einheitlich 250ms
    interval = window.setInterval(update, 250);

    return () => {
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
      if (interval) window.clearInterval(interval);
    };
  }, []);

  // heartbeat + GC - einheitlich 2000ms
  useEffect(() => {
    const reg = registryRef.current;
    if (!reg) return;
    // console.log('[VirtualViewportProvider] heartbeat start', windowId);
    let prevRect: { x: number; y: number; w: number; h: number } | null = null;
    const tick = window.setInterval(() => {
      const r = getCurrentWindowRect();
      const hasChanged = !prevRect || Math.abs(prevRect.x - r.x) + Math.abs(prevRect.y - r.y) + Math.abs(prevRect.w - r.w) + Math.abs(prevRect.h - r.h) >= 2;
      if (hasChanged) {
        reg.send({ t: "heartbeat", id: windowId, rect: r });
        // Update own window in state
        setWindows(prev => ({
          ...prev,
          [windowId]: {
            ...prev[windowId],
            lastSeen: Date.now(),
            rect: r,
          }
        }));
        prevRect = r;
      }
    }, 2000);

    return () => {
      window.clearInterval(tick);
      // console.log('[VirtualViewportProvider] heartbeat stop', windowId);
    };
  }, [windowId]);

  // assign screen when we have URL layout (permissionless settings mode)
  useEffect(() => {
    if (!layout) {
      // fallback: derive a layout that matches the current window rect so
      // the initial render doesn't jump when the real layout is resolved.
      const fallback: VflLayout = {
        v: 1,
        // use the current window origin/size (winRect) so computeViewportOffset -> 0
        frame: { x: winRect.x, y: winRect.y, w: winRect.w, h: winRect.h },
        screens: [
          { id: "S1", x: winRect.x, y: winRect.y, w: winRect.w, h: winRect.h },
        ],
      };
      setViewportOffset(computeViewportOffset(fallback, winRect));
      setAssignedScreenId("S1");
      // console.log('[VirtualViewportProvider] fallback layout used', fallback);
      return;
    }

    // If layout came from URL: permissionless mode uses the given screens
    const urlHadLayout = !!getLayoutFromUrl();
    if (urlHadLayout) {
      const { screenId } = assignScreenForWindow({
        windowId,
        winRect,
        screens: layout.screens,
      });
      setAssignedScreenId(screenId);
      // console.log('[VirtualViewportProvider] assigned screenId', screenId);
    }

    setViewportOffset(computeViewportOffset(layout, winRect));
    // console.log('[VirtualViewportProvider] viewportOffset set', layout, winRect);
  }, [layout, winRect, windowId]);

  const ctx: Ctx = {
    windowId,
    layout,
    winRect,
    viewportOffset,
    assignedScreenId,
    windows,
    permissionPending,
    requestPermission,
    computeWithoutPermission,
  };

  // Rendering logic from VirtualViewport
  const renderedChildren = useMemo(() => {
    if (!ctx) {
      return <>{children}</>;
    }

    const frameW = ctx.layout?.frame.w ?? ctx.winRect.w ?? (typeof window !== 'undefined' ? window.innerWidth : 1920);
    const frameH = ctx.layout?.frame.h ?? ctx.winRect.h ?? (typeof window !== 'undefined' ? window.innerHeight : 1080);

    const ox = ctx.viewportOffset.x;
    const oy = ctx.viewportOffset.y;

    const containerW = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const containerH = typeof window !== 'undefined' ? window.innerHeight : 1080;
    const maxOffsetX = Math.max(0, frameW - containerW);
    const maxOffsetY = Math.max(0, frameH - containerH);
    const clampedOX = Math.max(0, Math.min(ox, maxOffsetX));
    const clampedOY = Math.max(0, Math.min(oy, maxOffsetY));

    const assignedScreen = ctx.layout?.screens.find(s => s.id === ctx.assignedScreenId);
    const scale = assignedScreen?.scale ?? 1;
    // Fix: Skalierung deaktivieren, da scale=2 den Content zu klein macht
    const effectiveScale = 1;
    const scaleTransform = effectiveScale !== 1 ? ` scale(${1 / effectiveScale})` : '';

    return (
      <div style={{ width: "100vw", height: "100vh", overflow: "hidden", position: "relative" }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: frameW,
            height: frameH,
            transform: `translate(${-clampedOX}px, ${-clampedOY}px)${scaleTransform}`,
            willChange: "transform",
            transformOrigin: 'top left',
          }}
        >
          {children}
        </div>
        {showMinimap && ctx.layout && (
          <Minimap layout={ctx.layout} windows={ctx.windows} windowId={ctx.windowId} assignedScreenId={ctx.assignedScreenId} />
        )}
      </div>
    );
  }, [ctx.layout, ctx.winRect, ctx.viewportOffset, ctx.windows, ctx.assignedScreenId, ctx.windowId, children]);

  // Popup from VirtualWorld
  if (ctx?.permissionPending) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-800">
        <div className="w-[500px] shadow-2xl border border-gray-700 bg-gray-900/95 text-white rounded-lg">
          <div className="text-center p-6">
            <h2 className="text-2xl font-bold text-white mb-2">Scan Monitor Layout</h2>
            <p className="text-lg text-gray-300">
              Choose an option to set the layout for your virtual world.
            </p>
          </div>
          <div className="space-y-6 pt-4 px-6 pb-6">
            <button onClick={ctx.requestPermission} className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium">
              Grant Permission and Scan All Monitors
            </button>
            <button onClick={ctx.computeWithoutPermission} className="w-full h-12 text-base border border-gray-600 text-gray-300 hover:bg-gray-800 rounded-md font-medium">
              Continue Without Permission (Current Screen Only)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <VirtualCtx.Provider value={ctx}>{renderedChildren}</VirtualCtx.Provider>;
}
