"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

interface MagicCardProps {
  children: React.ReactNode;
  className?: string;
  gradientColor?: string;
  gradientSize?: number;
}

/**
 * Wrapper que agrega un gradiente radial que sigue el cursor
 * dentro de la card. Envolvé cualquier Card con este componente.
 */
export function MagicCard({
  children,
  className,
  gradientColor = "rgba(124,58,237,0.14)",
  gradientSize = 280,
}: MagicCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    ref.current.style.setProperty("--magic-x", `${e.clientX - rect.left}px`);
    ref.current.style.setProperty("--magic-y", `${e.clientY - rect.top}px`);
  };

  const handleMouseLeave = () => {
    if (!ref.current) return;
    // Mover el gradiente fuera de la card al salir
    ref.current.style.setProperty("--magic-x", "-9999px");
    ref.current.style.setProperty("--magic-y", "-9999px");
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn("relative", className)}
      style={
        {
          "--magic-x": "-9999px",
          "--magic-y": "-9999px",
        } as React.CSSProperties
      }
    >
      {/* Gradiente que sigue el cursor — z-10 para estar sobre el contenido pero pointer-events-none */}
      <div
        className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] transition-opacity duration-300"
        style={{
          background: `radial-gradient(${gradientSize}px circle at var(--magic-x) var(--magic-y), ${gradientColor}, transparent 40%)`,
        }}
      />
      {children}
    </div>
  );
}
