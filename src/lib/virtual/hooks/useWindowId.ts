import { useState, useEffect } from "react";
import { getThisWindowID } from "@/lib/virtual/windowId";
import { getCurrentWindowRect } from "@/lib/virtual/registry";

export function useWindowId() {
  const [windowId, setWindowId] = useState<string>("");
  const [winRect, setWinRect] = useState(() => ({ x: 0, y: 0, w: 1920, h: 1080 }));

  useEffect(() => {
    if (typeof window !== "undefined") {
      const id = getThisWindowID();
      setWindowId(id);
      setWinRect(getCurrentWindowRect());
    }
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
        return r;
      });
    };

    const onResize = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };

    window.addEventListener("resize", onResize);

    // Polling (move detection) - unified 250ms
    interval = window.setInterval(update, 250);

    return () => {
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
      if (interval) window.clearInterval(interval);
    };
  }, []);

  return { windowId, winRect };
}