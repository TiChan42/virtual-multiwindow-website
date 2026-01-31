"use client";

import React, { useMemo } from "react";

import { Minimap } from "./Minimap";
import { PermissionDialog } from "./PermissionDialog";

import type { VirtualContext } from "@/lib/virtual/types";
import { VirtualCtx } from "@/lib/virtual/export/virtualContext";
import { useWindowId } from "@/lib/virtual/hooks/useWindowId";
import { useLayout } from "@/lib/virtual/hooks/useLayout";
import { useRegistry } from "@/lib/virtual/hooks/useRegistry";
import { useViewportOffset } from "@/lib/virtual/hooks/useViewportOffset";
import { useMinimap } from "@/lib/virtual/hooks/useMinimap";

type Ctx = VirtualContext;

export function VirtualViewportProvider({ children }: { children: React.ReactNode }) {
  const { windowId, winRect } = useWindowId();
  const { layout, permissionPending, requestPermission, computeWithoutPermission } = useLayout();
  const { windows } = useRegistry(windowId);
  const { viewportOffset, assignedScreenId } = useViewportOffset(layout, winRect, windowId);
  const { showMinimap } = useMinimap();

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

    // Scaling removed as it makes the content too small

    return (
      <div style={{ width: "100vw", height: "100vh", overflow: "hidden", position: "relative" }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: frameW,
            height: frameH,
            transform: `translate(${-clampedOX}px, ${-clampedOY}px)`,
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
    return <PermissionDialog requestPermission={ctx.requestPermission} computeWithoutPermission={ctx.computeWithoutPermission} />;
  }

  return <VirtualCtx.Provider value={ctx}>{renderedChildren}</VirtualCtx.Provider>;
}
