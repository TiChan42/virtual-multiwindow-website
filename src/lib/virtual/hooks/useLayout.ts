import { useState, useEffect } from "react";
import type { VflLayout } from "@/lib/virtual/types";
import { encodeVflToUrlParam } from "@/lib/virtual/vfl";
import { getVflFromScreenDetails, getLayoutFromUrl, computeLayoutFromScreens } from "../screenUtils";

export function useLayout() {
  const [layout, setLayout] = useState<VflLayout | null>(null);
  const [permissionPending, setPermissionPending] = useState<boolean>(false);

  const requestPermission = async () => {
    console.log('requestPermission called');
    const vfl = await getVflFromScreenDetails();
    if (vfl) {
      const param = encodeVflToUrlParam(vfl);
      const newUrl = `${window.location.origin}${window.location.pathname}?layout=${param}`;
      console.log('[VirtualViewportProvider] permission granted, layout computed, reloading with', newUrl);
      window.location.href = newUrl; // Reloads the page
    } else {
      console.warn('[VirtualViewportProvider] permission denied or failed');
      alert('Permission denied or not supported. Please use "Continue Without Permission" instead.');
    }
  };

  const computeWithoutPermission = () => {
    console.log('computeWithoutPermission called');
    const computedLayout = computeLayoutFromScreens();
    const param = encodeVflToUrlParam(computedLayout);
    const newUrl = `${window.location.origin}${window.location.pathname}?layout=${param}`;
    console.log('[VirtualViewportProvider] computed layout without permission, reloading with', newUrl);
    window.location.href = newUrl; // Reloads the page
  };

  // decide mode:
  // - if URL layout exists => permissionless mode
  // - else => set permissionPending to true, wait for user to request permission
  useEffect(() => {
    const fromUrl = getLayoutFromUrl();
    if (fromUrl) {
      setLayout(fromUrl);
      setPermissionPending(false);
      return;
    }

    // no URL => set pending, user must request permission
    setPermissionPending(true);
  }, []);

  return { layout, permissionPending, requestPermission, computeWithoutPermission };
}