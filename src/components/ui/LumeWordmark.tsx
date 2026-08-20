import React from "react";
import { cn } from "@/lib/utils";

interface LumeWordmarkProps {
  className?: string;
  size?: "md" | "lg";
}

export function LumeWordmark({ className, size = "md" }: LumeWordmarkProps) {
  const sizes = {
    md: "h-8",
    lg: "h-12",
  };

  return (
    <div className={cn("flex items-center justify-center", sizes[size], className)}>
      <svg
        viewBox="0 0 280 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-auto"
      >
        <defs>
          <linearGradient id="lume-wordmark-gradient" x1="55" y1="40" x2="105" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#00D1FF" />
          </linearGradient>
          <filter id="wordmark-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* L */}
        <path
          d="M 20 15 L 20 65 Q 20 70 25 70 L 25 70"
          stroke="white"
          strokeWidth="8"
          strokeLinecap="round"
          fill="none"
        />

        {/* U (The Brand Icon) */}
        {/* Arc */}
        <path
          d="M 55 40 Q 80 75 105 40"
          stroke="url(#lume-wordmark-gradient)"
          strokeWidth="8"
          strokeLinecap="round"
          fill="none"
        />
        {/* Left Dot */}
        <circle cx="55" cy="40" r="7" fill="white" />
        {/* Right Dot (Glowing) */}
        <circle cx="105" cy="40" r="7" fill="#00D1FF" filter="url(#wordmark-glow)" />

        {/* M */}
        <path
          d="M 135 70 L 135 45 Q 135 35 145 35 Q 155 35 155 45 L 155 70 M 155 45 Q 155 35 165 35 Q 175 35 175 45 L 175 70"
          stroke="white"
          strokeWidth="8"
          strokeLinecap="round"
          fill="none"
        />

        {/* E */}
        <path
          d="M 235 45 L 200 45 Q 200 35 210 35 Q 225 35 225 45 M 235 45 Q 235 70 215 70 Q 200 70 200 50 Q 200 30 220 30 Q 235 30 235 45"
          stroke="white"
          strokeWidth="8"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </div>
  );
}
