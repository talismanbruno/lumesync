import React from "react";
import { cn } from "@/lib/utils";

interface LumeLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function LumeLogo({ size = "md", className }: LumeLogoProps) {
  const sizes = {
    sm: "h-12 w-12",
    md: "h-16 w-16",
    lg: "h-24 w-24",
    xl: "h-32 w-32",
  };

  return (
    <div
      className={cn(
        "relative flex items-center justify-center rounded-[22%] bg-black overflow-visible shadow-2xl",
        sizes[size],
        className
      )}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-[75%] h-[75%]"
      >
        <defs>
          <linearGradient id="lume-gradient" x1="25" y1="65" x2="75" y2="65" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#00D1FF" />
          </linearGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        
        {/* Arco Conector curvado para baixo */}
        <path
          d="M 25 50 Q 50 85 75 50"
          stroke="url(#lume-gradient)"
          strokeWidth="9"
          strokeLinecap="round"
          fill="none"
        />
        
        {/* Nó Esquerdo (Branco) */}
        <circle cx="25" cy="50" r="8" fill="#FFFFFF" />
        
        {/* Nó Direito (Ciano + Glow) */}
        <circle 
          cx="75" 
          cy="50" 
          r="9" 
          fill="#00D1FF" 
          filter="url(#glow)"
        />
      </svg>
    </div>
  );
}
