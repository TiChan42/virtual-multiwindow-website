import { useState, useEffect } from "react";
import type { VflLayout } from "@/lib/virtual/types";
import { assignScreenForWindow } from "@/lib/virtual/vfl";
import { computeViewportOffset } from "@/lib/virtual/registry";
import { getLayoutFromUrl } from "../screenUtils";

export function useViewportOffset(layout: VflLayout | null, winRect: { x: number; y: number; w: number; h: number }, windowId: string) {
  const [assignedScreenId, setAssignedScreenId] = useState<string | undefined>(undefined);
  const [viewportOffset, setViewportOffset] = useState({ x: 0, y: 0 });

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
    }

    setViewportOffset(computeViewportOffset(layout, winRect));
  }, [layout, winRect, windowId]);

  return { viewportOffset, assignedScreenId };
}