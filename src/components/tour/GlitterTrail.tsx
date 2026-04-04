'use client';

import React, { useEffect, useState } from 'react';
import type { Position } from './useTourPositions';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  hue: number; // slight color variation: gold to amber
}

interface GlitterTrailProps {
  position: Position;
  active: boolean;
  charSize: number;
}

/**
 * Spawns golden particles at Aladdin's current position while he flies.
 * Each particle is fixed at its spawn coordinate, so as Aladdin moves forward
 * the particles stay behind — creating a genuine glowing trail.
 */
export function GlitterTrail({ position, active, charSize }: GlitterTrailProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!active) {
      setParticles([]);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      // Spawn 2-3 particles per tick, spread across Aladdin's body
      const batch: Particle[] = Array.from({ length: 3 }, (_, i) => ({
        id: now + i,
        x: position.x + charSize * 0.45 + (Math.random() - 0.5) * charSize * 0.7,
        y: position.y + charSize * 0.25 + (Math.random() - 0.5) * charSize * 0.5,
        size: 5 + Math.random() * 7,
        hue: 40 + Math.random() * 20, // gold (40°) to amber (60°)
      }));

      setParticles(prev => [
        ...prev.filter(p => now - p.id < 1500), // remove expired
        ...batch,
      ]);
    }, 65);

    return () => clearInterval(interval);
  }, [active, position, charSize]);

  if (!active || particles.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes glitter-drift {
          0%   { opacity: 1;    transform: translateY(0px)   scale(1)   rotate(0deg);  }
          35%  { opacity: 0.85; transform: translateY(-10px) scale(0.85) rotate(35deg); }
          100% { opacity: 0;    transform: translateY(-26px) scale(0.25) rotate(80deg); }
        }
      `}</style>

      {particles.map(p => (
        <div
          key={p.id}
          style={{
            position: 'fixed',
            left: p.x - p.size / 2,
            top: p.y - p.size / 2,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: `radial-gradient(circle, #fffde7 0%, hsl(${p.hue},100%,55%) 45%, hsl(${p.hue},90%,40%) 85%, transparent 100%)`,
            boxShadow: `0 0 ${p.size + 2}px ${p.size * 0.6}px hsla(${p.hue},100%,60%,0.65)`,
            zIndex: 111,
            pointerEvents: 'none',
            animation: 'glitter-drift 1.4s ease-out forwards',
          }}
        />
      ))}
    </>
  );
}
