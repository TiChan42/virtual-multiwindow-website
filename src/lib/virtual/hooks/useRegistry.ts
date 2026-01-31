import { useState, useEffect, useRef } from "react";
import { WindowRegistry, getCurrentWindowRect } from "@/lib/virtual/registry";

export function useRegistry(windowId: string) {
  const [windows, setWindows] = useState<Record<string, any>>({});
  const registryRef = useRef<WindowRegistry | null>(null);

  useEffect(() => {
    if (!windowId) return;
    const reg = new WindowRegistry((w) => {
      setWindows(w);
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
    // Send snapshot to inform others about the current state
    setTimeout(() => {
      reg.send({ t: "snapshot", windows: reg.getWindows() });
    }, 100); // Short delay to process hello

    // After reload: Show all current windows in console
    setTimeout(() => {
      console.log('[VirtualViewportProvider] Current windows after reload:', reg.getWindows());
    }, 200);

    const onUnload = () => reg.send({ t: "goodbye", id: windowId });
    window.addEventListener("beforeunload", onUnload);

    return () => {
      window.removeEventListener("beforeunload", onUnload);
      reg.close();
      registryRef.current = null;
    };
  }, [windowId]);

  // heartbeat + GC - unified 2000ms
  useEffect(() => {
    const reg = registryRef.current;
    if (!reg) return;
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
    };
  }, [windowId]);

  return { windows };
}