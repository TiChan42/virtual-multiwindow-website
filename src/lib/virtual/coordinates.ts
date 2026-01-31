"use client";

import { useContext, useState, useEffect } from 'react';
import { VirtualCtx } from '@/components/virtual/VirtualViewportProvider';

export type Coordinates = {
  x: number;
  y: number;
};

/**
 * Konvertiert lokale Koordinaten (z.B. clientX, clientY) in globale virtuelle Koordinaten.
 */
export function localToGlobal(localX: number, localY: number, viewportOffset: { x: number; y: number }): Coordinates {
  return {
    x: localX + viewportOffset.x,
    y: localY + viewportOffset.y,
  };
}

/**
 * Konvertiert globale virtuelle Koordinaten in lokale Koordinaten relativ zum aktuellen Viewport.
 */
export function globalToLocal(globalX: number, globalY: number, viewportOffset: { x: number; y: number }): Coordinates {
  return {
    x: globalX - viewportOffset.x,
    y: globalY - viewportOffset.y,
  };
}

/**
 * Hook, der die aktuellen globalen Maus-Koordinaten im virtuellen Viewport bereitstellt.
 * Aktualisiert sich bei Mausbewegungen.
 */
export function useVirtualMouseCoordinates(): Coordinates | null {
  const ctx = useContext(VirtualCtx);
  const [mousePos, setMousePos] = useState<Coordinates | null>(null);

  useEffect(() => {
    const viewportOffset = ctx?.viewportOffset || { x: 0, y: 0 };

    const handleMouseMove = (e: MouseEvent) => {
      const globalPos = localToGlobal(e.clientX, e.clientY, viewportOffset);
      setMousePos(globalPos);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [ctx?.viewportOffset]);

  return mousePos;
}

/**
 * Konvertiert globale virtuelle Koordinaten in Fensterkoordinaten (screenX, screenY).
 * Verwendet den frame-Ursprung des virtuellen Layouts.
 */
export function virtualToWindow(globalX: number, globalY: number, frame: { x: number; y: number }): Coordinates {
  return {
    x: globalX + frame.x, // Oder - frame.x, je nach Definition
    y: globalY + frame.y,
  };
}

/**
 * Konvertiert Fensterkoordinaten (screenX, screenY) in globale virtuelle Koordinaten.
 * Verwendet den frame-Ursprung des virtuellen Layouts.
 */
export function windowToVirtual(screenX: number, screenY: number, frame: { x: number; y: number }): Coordinates {
  return {
    x: screenX - frame.x,
    y: screenY - frame.y,
  };
}