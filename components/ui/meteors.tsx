"use client";

import { cn } from "@/lib/utils";
import { useMemo } from "react";

interface MeteorsProps {
  number?: number;
  className?: string;
}

export function Meteors({ number = 18, className }: MeteorsProps) {
  // Generamos los meteoros una sola vez con useMemo para evitar re-renders
  const meteors = useMemo(
    () =>
      [...Array(number)].map((_, i) => ({
        id: i,
        top:   `${Math.floor(Math.random() * 100)}%`,
        left:  `${Math.floor(Math.random() * 100)}%`,
        delay: `${(Math.random() * 4).toFixed(2)}s`,
        duration: `${(Math.random() * 6 + 5).toFixed(2)}s`,
      })),
    [number]
  );

  return (
    <div className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}>
      {meteors.map((m) => (
        <span
          key={m.id}
          className="absolute animate-meteor"
          style={{
            top: m.top,
            left: m.left,
            animationDelay: m.delay,
            animationDuration: m.duration,
            // Línea con cola de gradiente
            width: "120px",
            height: "1px",
            background: "linear-gradient(90deg, transparent, rgba(167,139,250,0.7))",
            transform: "rotate(215deg)",
            borderRadius: "9999px",
            boxShadow: "0 0 4px 0 rgba(167,139,250,0.3)",
          }}
        />
      ))}
    </div>
  );
}
