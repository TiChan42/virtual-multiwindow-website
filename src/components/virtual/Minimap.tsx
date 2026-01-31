"use client";

import React from "react";
import type { VflLayout } from "@/lib/virtual/types";

interface MinimapProps {
  layout: VflLayout;
  windows: Record<string, any>;
  windowId: string;
  assignedScreenId?: string;
}

export function Minimap({ layout, windows, windowId, assignedScreenId }: MinimapProps) {
  const frame = layout.frame;
  const maxW = 200;
  const maxH = 150;
  const ratio = frame.w / frame.h;
  const maxRatio = maxW / maxH;
  let w, h;
  if (ratio > maxRatio) {
    w = maxW;
    h = maxW / ratio;
  } else {
    h = maxH;
    w = maxH * ratio;
  }
  return (
    <div
      className="fixed bottom-2.5 right-2.5 bg-black/80 border border-white z-[1000] pointer-events-none"
      style={{ width: w, height: h }}
    >
      {/* Frame */}
      <div
        className="absolute inset-0 border border-gray-500"
      >
        {/* Screens */}
        {layout.screens.map((screen) => {
          const scaleX = w / frame.w;
          const scaleY = h / frame.h;
          const screenLeft = (screen.x - frame.x) * scaleX;
          const screenTop = (screen.y - frame.y) * scaleY;
          const screenWidth = screen.w * scaleX;
          const screenHeight = screen.h * scaleY;
          const isOwnScreen = screen.id === assignedScreenId;
          return (
            <div
              key={screen.id}
              className={`absolute border border-white ${isOwnScreen ? 'bg-purple-500/50' : 'bg-white/20'}`}
              style={{
                left: screenLeft,
                top: screenTop,
                width: screenWidth,
                height: screenHeight,
              }}
              title={`Screen ${screen.id}: ${screen.w}x${screen.h}`}
            />
          );
        })}
        {/* Windows */}
        {Object.values(windows).map((win: any) => {
          const scaleX = w / frame.w;
          const scaleY = h / frame.h;
          const winLeft = (win.rect.x - frame.x) * scaleX;
          const winTop = (win.rect.y - frame.y) * scaleY;
          const winWidth = win.rect.w * scaleX;
          const winHeight = win.rect.h * scaleY;
          const isOwnWindow = win.id === windowId;
          return (
            <div
              key={win.id}
              className={`absolute border border-yellow-400 ${isOwnWindow ? 'bg-yellow-400/70' : 'bg-green-500/30'}`}
              style={{
                left: winLeft,
                top: winTop,
                width: winWidth,
                height: winHeight,
              }}
              title={`Window ${win.id}: ${win.rect.w}x${win.rect.h} @ (${win.rect.x}, ${win.rect.y})`}
            />
          );
        })}
      </div>
    </div>
  );
}