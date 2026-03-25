"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface SpotlightProps {
  className?: string;
  color?: string;
}

export function Spotlight({
  className,
  color = "rgba(124,58,237,0.12)",
}: SpotlightProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;

    const move = (e: MouseEvent) => {
      const rect = parent.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      el.style.background = `radial-gradient(700px circle at ${x}px ${y}px, ${color}, transparent 40%)`;
    };

    parent.addEventListener("mousemove", move);
    return () => parent.removeEventListener("mousemove", move);
  }, [color]);

  return (
    <div
      ref={ref}
      className={cn(
        "pointer-events-none absolute inset-0 z-0 transition-opacity duration-500",
        className
      )}
    />
  );
}
