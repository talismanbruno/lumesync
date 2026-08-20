import React from "react";
import { cn } from "@/lib/utils";

interface LumeWordmarkProps {
  className?: string;
  size?: "md" | "lg";
}

export function LumeWordmark({ className, size = "md" }: LumeWordmarkProps) {
  const sizes = {
    md: "h-10",
    lg: "h-14",
  };

  return (
    <div className={cn("flex items-center justify-center", sizes[size], className)}>
      <svg
        viewBox="0 0 280 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-auto"
      >
        <defs>
          <linearGradient id="lume-u-gradient" x1="55" y1="55" x2="105" y2="55" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#00D1FF" />
          </linearGradient>
          <filter id="wordmark-u-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* L */}
        <path
          d="M 20 20 L 20 70 L 40 70"
          stroke="white"
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* U (LUME Símbolo) */}
        <path
          d="M 55 45 Q 80 80 105 45"
          stroke="url(#lume-u-gradient)"
          strokeWidth="10"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="55" cy="45" r="9" fill="white" />
        <circle cx="105" cy="45" r="10" fill="#00D1FF" filter="url(#wordmark-u-glow)" />

        {/* M */}
        <path
          d="M 130 70 L 130 35 Q 130 25 145 25 Q 160 25 160 35 L 160 70 M 160 35 Q 160 25 175 25 Q 190 25 190 35 L 190 70"
          stroke="white"
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* E */}
        <path
          d="M 235 45 L 205 45 Q 205 25 220 25 Q 235 25 235 40 M 235 45 Q 235 70 210 70 Q 205 70 205 60 Q 205 25 220 25 Q 235 25 235 45"
          stroke="white"
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </div>
  );
}
