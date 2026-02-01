import { useState, useEffect } from "react";
import type { VflLayout } from "@/lib/virtual/types";
import { assignScreenForWindow } from "@/lib/virtual/vfl";
import { computeViewportOffset } from "@/lib/virtual/registry";
import { getLayoutFromUrl, getScreenIdFromUrl, getScreenPositionFromUrl } from "../screenUtils";

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
      const screenIdFromUrl = getScreenIdFromUrl();
      const positionFromUrl = getScreenPositionFromUrl();
      
      let assignedScreenIdValue: string;
      let viewportOffsetValue: { x: number; y: number };
      
      if (screenIdFromUrl) {
        // Skip assignment calculation, use explicit screenId
        assignedScreenIdValue = screenIdFromUrl;
        console.log(`[useViewportOffset] Explicit screenId: ${screenIdFromUrl}`);
      } else {
        // Normal assignment
        const { screenId } = assignScreenForWindow({
          windowId,
          winRect,
          screens: layout.screens,
        });
        assignedScreenIdValue = screenId;
      }
      
      setAssignedScreenId(assignedScreenIdValue);
      
      if (positionFromUrl) {
        // Skip offset calculation, use explicit position
        viewportOffsetValue = positionFromUrl;
        console.log(`[useViewportOffset] Explicit position: (${positionFromUrl.x}, ${positionFromUrl.y})`);
      } else {
        // Compute offset relative to the assigned screen
        const assignedScreen = layout.screens.find(s => s.id === assignedScreenIdValue);
        if (assignedScreen) {
          // Offset relative to screen: winRect - screenPosition
          const offsetX = winRect.x - assignedScreen.x;
          const offsetY = winRect.y - assignedScreen.y;
          viewportOffsetValue = { x: offsetX, y: offsetY };
          console.log(`[useViewportOffset] Computed offset for screen ${assignedScreenIdValue}: (${offsetX}, ${offsetY})`);
        } else {
          // Fallback: Use frame offset, but log warning
          console.warn(`[useViewportOffset] No assigned screen found for ${assignedScreenIdValue}, falling back to frame offset`);
          viewportOffsetValue = computeViewportOffset(layout, winRect);
        }
      }
      
      setViewportOffset(viewportOffsetValue);
    } else {
      // Without URL layout: Use frame offset
      setViewportOffset(computeViewportOffset(layout, winRect));
    }
  }, [layout, winRect, windowId]);

  return { viewportOffset, assignedScreenId };
}