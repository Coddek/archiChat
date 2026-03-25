"use client";

import { cn } from "@/lib/utils";

interface BorderBeamProps {
  className?: string;
  duration?: number;
  colorFrom?: string;
  colorTo?: string;
  borderWidth?: number;
}

/**
 * Rota un conic-gradient alrededor del borde del contenedor padre.
 * El padre debe tener `position: relative` y `overflow: hidden`.
 */
export function BorderBeam({
  className,
  duration = 8,
  colorFrom = "#7c3aed",
  colorTo = "#818cf8",
  borderWidth = 1,
}: BorderBeamProps) {
  return (
    <>
      {/* Capa exterior: rota el gradiente cónico */}
      <div
        className={cn(
          "pointer-events-none absolute -inset-[1px] rounded-[inherit] z-0",
          className
        )}
        style={{
          background: `conic-gradient(from var(--beam-angle, 0deg), transparent 0%, transparent 60%, ${colorFrom} 80%, ${colorTo} 90%, transparent 100%)`,
          animation: `beam-spin ${duration}s linear infinite`,
        }}
      />
      {/* Capa interior: tapa el centro para que solo se vea el borde */}
      <div
        className="pointer-events-none absolute rounded-[inherit] z-[1]"
        style={{
          inset: `${borderWidth}px`,
          background: "inherit",
        }}
      />
    </>
  );
}
