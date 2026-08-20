import React from "react";
import { cn } from "@/lib/utils";

interface LumeLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function LumeLogo({ size = "md", className }: LumeLogoProps) {
  const sizes = {
    sm: "h-12 w-12", // Sidebar button size
    md: "h-16 w-16",
    lg: "h-24 w-24", // Auth screen size
    xl: "h-32 w-32",
  };

  return (
    <div
      className={cn(
        "relative flex items-center justify-center rounded-[22%] bg-[#121212] overflow-visible shadow-2xl border border-white/5",
        sizes[size],
        className
      )}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-[70%] h-[70%]"
      >
        <defs>
          <linearGradient id="lume-gradient" x1="25" y1="50" x2="75" y2="50" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#00D1FF" />
          </linearGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        
        {/* Arco Conector */}
        <path
          d="M 25 50 Q 50 85 75 50"
          stroke="url(#lume-gradient)"
          strokeWidth="8"
          strokeLinecap="round"
          fill="none"
        />
        
        {/* Nó Esquerdo (Branco) */}
        <circle cx="25" cy="50" r="7" fill="#FFFFFF" />
        
        {/* Nó Direito (Ciano + Glow) */}
        <circle 
          cx="75" 
          cy="50" 
          r="7" 
          fill="#00D1FF" 
          filter="url(#glow)"
        />
      </svg>
    </div>
  );
}
