"use client";

import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes } from "react";

interface ShimmerButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  shimmerColor?: string;
  background?: string;
  className?: string;
}

export function ShimmerButton({
  shimmerColor = "rgba(255,255,255,0.15)",
  background = "rgba(124,58,237,1)",
  className,
  children,
  ...props
}: ShimmerButtonProps) {
  return (
    <button
      className={cn(
        "relative inline-flex h-14 w-full cursor-pointer items-center justify-center rounded-2xl px-8 font-bold text-white transition-all duration-300 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60",
        "shadow-[0_0_20px_rgba(124,58,237,0.3)] hover:shadow-[0_0_35px_rgba(124,58,237,0.5)]",
        className
      )}
      style={{ background }}
      {...props}
    >
      {/* Shimmer sweep */}
      <span
        className="absolute inset-0 rounded-[inherit] overflow-hidden"
        aria-hidden
      >
        <span
          className="absolute inset-0 rounded-[inherit]"
          style={{
            background: `linear-gradient(105deg, transparent 40%, ${shimmerColor} 50%, transparent 60%)`,
            backgroundSize: "200% 100%",
            animation: "shimmer 2.5s linear infinite",
          }}
        />
      </span>
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </button>
  );
}
