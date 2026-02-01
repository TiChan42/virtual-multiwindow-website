"use client";

import { useContext, useEffect, useRef, useState } from "react";
import { VirtualCtx } from "@/lib/virtual/export/virtualContext";
import { SharedState } from "@/lib/virtual/export/sharedState";
import { useLayout } from "@/lib/virtual/hooks/useLayout";
import { useRegistry } from "@/lib/virtual/hooks/useRegistry";
import { useWindowId } from "@/lib/virtual/hooks/useWindowId";
import { getMasterWindowId, isMasterWindow } from "@/lib/virtual/export/utils";

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
  const { layout } = useLayout();
  const { windows } = useRegistry(useWindowId().windowId);
  const windowId = useWindowId().windowId;
  const [particles, setParticles] = useState<Particle[]>([]);
  const currentParticlesRef = useRef<Particle[]>([]);
  const sharedStateRef = useRef<SharedState | null>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const frameCountRef = useRef(0);
  const [bgColor, setBgColor] = useState(`hsl(${Math.random() * 360}, 30%, 20%)`);
  const [isMaster, setIsMaster] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.body.style.backgroundColor = bgColor;
    }
  }, [bgColor]);

  useEffect(() => {
    sharedStateRef.current = new SharedState((key, value) => {
      if (key === "particles") {
        setParticles(value || []);
      } else if (key === "bgColor") {
        setBgColor(value || `hsl(${Math.random() * 360}, 30%, 20%)`);
      } else if (key === "masterId") {
        setIsMaster(value === windowId);
      }
    });

    // Bestimme Master: Fenster mit niedrigster ID, einmalig
    const existingMasterId = sharedStateRef.current.get("masterId");
    if (!existingMasterId || existingMasterId === 'NaN') {
      const masterId = getMasterWindowId(windows, windowId);
      sharedStateRef.current.set("masterId", masterId);
    }
    const currentMasterId = sharedStateRef.current.get("masterId") || windowId;
    const amIMaster = currentMasterId === windowId;
    setIsMaster(amIMaster);

    if (amIMaster) {
      // Master: Initialisiere und berechne
      const existingParticles = sharedStateRef.current.get("particles");
      const existingBgColor = sharedStateRef.current.get("bgColor");

      if (!existingParticles) {
        const initParticles: Particle[] = [];
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const centerX = Math.random() * 1920;
          const centerY = Math.random() * 1080;
          const orbitRadius = Math.random() * 300 + 50;
          const size = i < 5 ? 0.7 * (layout?.frame.w || 1920) : Math.random() * 150 + 50;
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
        sharedStateRef.current.set("particles", initParticles);
        currentParticlesRef.current = initParticles;
      } else {
        currentParticlesRef.current = existingParticles;
      }

      if (!existingBgColor) {
        const initialBgColor = `hsl(${Math.random() * 360}, 30%, 20%)`;
        sharedStateRef.current.set("bgColor", initialBgColor);
      }
    } else {
      // Slave: Lade nur
      const existingParticles = sharedStateRef.current.get("particles");
      const existingBgColor = sharedStateRef.current.get("bgColor");
      if (existingParticles) setParticles(existingParticles);
      if (existingBgColor) setBgColor(existingBgColor);
    }

    return () => {
      sharedStateRef.current?.destroy();
    };
  }, [layout, windows, windowId]);

  useEffect(() => {
    if (!isMaster || !ctx || !layout) return;

    const animate = () => {
      currentParticlesRef.current = currentParticlesRef.current.map(p => {
        const newAngle = p.angle + p.speed;
        return { ...p, angle: newAngle };
      });

      frameCountRef.current++;
      if (frameCountRef.current % 3 === 0) {
        sharedStateRef.current?.set("particles", [...currentParticlesRef.current]);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isMaster, ctx, layout]);

  if (!ctx || !layout) return <div>Loading...</div>;

  return (
    <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
      {particles.map((p) => {
        const x = p.centerX + Math.cos(p.angle) * p.radius;
        const y = p.centerY + Math.sin(p.angle) * p.radius;
        return (
          <div
            key={p.id}
            style={{
              position: "absolute",
              left: x - p.size,
              top: y - p.size,
              width: p.size * 2,
              height: p.size * 2,
              borderRadius: "50%",
              backgroundColor: `hsl(${p.hue}, 70%, 50%)`,
            }}
          />
        );
      })}
    </div>
  );
}

export default function Page() {
  return (
    <div style={{ position: "relative", width: "100%", height: "100vh" }}>
      <ParticleAnimation />
    </div>
  );
}
