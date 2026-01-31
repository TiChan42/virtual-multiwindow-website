import { useState } from "react";

export function useMinimap() {
  const [showMinimap, setShowMinimap] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      return url.searchParams.get("minimap") === "true";
    }
    return false;
  });

  return { showMinimap };
}