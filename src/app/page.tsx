"use client";

import React, { useContext, useEffect, useState } from "react";
import { VirtualCtx } from "@/lib/virtual/extensions/virtualContext";
import type { VirtualEngine } from "@/lib/virtual/core/VirtualEngine";

type Particle = {
  id: string;
  centerX: number;
  centerY: number;
  radius: number;
  angle: number;
  speed: number;
  hue: number;
  size: number;
};

const PARTICLE_COUNT = 22;
const ANIMATION_SPEED = 0.2;

function ParticleAnimation() {
  const ctx = useContext(VirtualCtx);
  const { layout, isLeader, sharedData, engine } = ctx || {};
  const virtualEngine = engine as VirtualEngine;

  // 1. Background Color Management
  useEffect(() => {
    if (!ctx || !ctx.layout) return;
    let color = sharedData?.bgColor;
    // Leader initializes color
    if (!color && isLeader && virtualEngine) {
       color = `hsl(${Math.random() * 360}, 30%, 20%)`;
       virtualEngine.setSharedData("bgColor", color);
    }
    // All apply color
    if (color && typeof window !== 'undefined') {
        document.body.style.backgroundColor = color as string;
    }
  }, [ctx, sharedData?.bgColor, isLeader, virtualEngine]);

  // 2. Particle Initialization (Leader Only)
  useEffect(() => {
    if (!ctx || !ctx.layout) return;
    if (isLeader && virtualEngine && (!sharedData?.particles || (sharedData?.particles as Particle[]).length === 0)) {
        const initParticles: Particle[] = [];
        const frameW = layout?.frame?.w || 1920; 
        
        console.log("[ParticleAnimation] Initializing Particles as Leader");
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const centerX = Math.random() * (layout?.frame?.w || 1000); 
          const centerY = Math.random() * (layout?.frame?.h || 1000);
          const orbitRadius = Math.random() * 300 + 50;
          const size = i < 5 ? 0.7 * frameW : Math.random() * 150 + 50;
          
          initParticles.push({
            id: `p${i}`,
            centerX,
            centerY,
            radius: orbitRadius,
            angle: 0,
            speed: (Math.random() * 0.01 + 0.005) * ANIMATION_SPEED,
            hue: Math.random() * 360,
            size,
          });
        }
        virtualEngine.setSharedData("particles", initParticles);
    }
  }, [ctx, isLeader, sharedData?.particles, layout, virtualEngine]);

  // Custom hook for time-based animation
  const useTime = () => {
      const [time, setTime] = useState(Date.now());
      useEffect(() => {
          let req: number;
          const val = () => {
              setTime(Date.now());
              req = requestAnimationFrame(val);
          }
          req = requestAnimationFrame(val);
          return () => cancelAnimationFrame(req);
      }, []);
      return time;
  };
  
  const time = useTime(); 

  // If context isn't ready, do nothing
  if (!ctx || !ctx.layout) return null;

  // 3. Rendering
  const particles = (sharedData?.particles as Particle[]) || [];
  
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((p) => {
        // Calculate position based on time
        // angle = initialAngle + speed * time
        const t = time / 1000;
        const currentAngle = p.angle + p.speed * t * 60; // scale factor
        const x = p.centerX + Math.cos(currentAngle) * p.radius;
        const y = p.centerY + Math.sin(currentAngle) * p.radius;

        return (
          <div
            key={p.id}
            className="absolute rounded-full blur-3xl opacity-60 mix-blend-screen"
            style={{
              left: x,
              top: y,
              width: p.size,
              height: p.size,
              backgroundColor: `hsl(${p.hue}, 70%, 50%)`,
              transform: "translate(-50%, -50%)",
              transition: "none", 
            }}
          />
        );
      })}
    </div>
  );
}


export default function Page() {
  return (
    <main className="relative w-full h-full min-h-screen overflow-hidden">
        <ParticleAnimation />
        
        {/* Content Overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <h1 className="text-6xl font-black text-white mix-blend-overlay tracking-tight select-none">
             VIRTUAL
            </h1>
        </div>
    </main>
  );
}
