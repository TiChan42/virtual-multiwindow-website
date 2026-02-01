"use client";

import React, { useEffect, useMemo, useRef } from "react";

import { Minimap } from "./Minimap";
import { PermissionDialog } from "./PermissionDialog";

import type { VirtualContext } from "@/lib/virtual/types";
import { VirtualCtx } from "@/lib/virtual/export/virtualContext";
import { VirtualEngine } from "@/lib/virtual/core/VirtualEngine";
import { useVirtualState } from "@/lib/virtual/hooks/useVirtualStore";
import { getThisWindowID } from "@/lib/virtual/windowId";
import { getCurrentWindowRect } from "@/lib/virtual/export/utils";

export function VirtualViewportProvider({ children }: { children: React.ReactNode }) {
  // 1. Initialize Engine (Singleton per component lifecycle)
  const engineRef = useRef<VirtualEngine | null>(null);
  
  if (!engineRef.current && typeof window !== "undefined") {
    engineRef.current = new VirtualEngine(getThisWindowID(), getCurrentWindowRect());
  }
  const engine = engineRef.current;

  // 2. Sync External Store (Replaces useState/useEffect for state)
  // This ensures high-performance rendering without tearing
  const state = useVirtualState(engine as VirtualEngine) || {
    // Fallback initial state for SSR
    windowId: '',
    winRect: { x:0, y:0, w:0, h:0 },
    windows: {},
    layout: null,
    viewportOffset: { x:0, y:0 },
    isLeader: false,
    permissionGranted: false,
    sharedData: {},
    assignedScreenId: undefined
  };

  // 3. Drive the Engine with physical events
  useEffect(() => {
    if (!engine) return;

    const updateRect = () => {
        engine.updateRect(getCurrentWindowRect());
    };

    window.addEventListener("resize", updateRect);
    // Poll for position changes (browsers don't emit event for moving windows)
    const interval = setInterval(updateRect, 500);

    return () => {
        window.removeEventListener("resize", updateRect);
        clearInterval(interval);
        engine.dispose();
    };
  }, [engine]);

  // 4. Request Permission Logic (Mapped to Context)
  const requestPermission = async () => {
    // For now simple pass-through or dummy
    // In valid implementation this would trigger browser permission prompts
    console.log("Request permission");
  };

  const computeWithoutPermission = () => {
    console.log("Compute without permission");
  };

  // 5. Construct Legacy Context Compatibility Layer
  const ctx: VirtualContext = useMemo(() => ({
    ...state,
    permissionPending: false, // simplified
    requestPermission,
    computeWithoutPermission,
    engine // Expose engine for new components
  }), [state, engine]);

  // 6. Rendering
  const renderedChildren = useMemo(() => {
    if (!engine || !state.layout) return null; // Wait for layout

    const { viewportOffset } = state;
    const layout = state.layout;

    const frameW = layout.frame.w; 
    const frameH = layout.frame.h;

    // Viewport Logic 
    // This logic ensures the content stays absolute in virtual space
    // while the window acts as a viewport moving over it.
    
    // We clamp offsets slightly to avoid flickering at edges if desired, 
    // but the engine provides raw precise values.
    
    return (
      <div style={{ width: "100vw", height: "100vh", overflow: "hidden", position: "relative" }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: frameW,
            height: frameH,
            transform: `translate(${-viewportOffset.x}px, ${-viewportOffset.y}px)`,
            willChange: "transform",
            transformOrigin: 'top left',
          }}
        >
          {children}
        </div>
        
          <Minimap 
            layout={layout} 
            windows={state.windows} 
            windowId={state.windowId} 
            assignedScreenId={state.assignedScreenId} 
          />
        
      </div>
    );
  }, [state, engine, children]);

  if (!engine) return null;

  return <VirtualCtx.Provider value={ctx}>{renderedChildren}</VirtualCtx.Provider>;
}
