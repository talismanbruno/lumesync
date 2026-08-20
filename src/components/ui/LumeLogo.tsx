import React from 'react';

interface LogoProps {
  variant?: 'icon' | 'full';
  className?: string;
}

export const LumeLogo: React.FC<LogoProps> = ({ variant = 'full', className = '' }) => {
  if (variant === 'icon') {
    return (
      <svg viewBox="0 0 100 100" className={className || "w-10 h-10"} fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="lume-icon-arc" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#00D1FF" />
          </linearGradient>
          <filter id="icon-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        {/* Fundo escuro */}
        <rect width="100" height="100" rx="24" fill="#121212" />
        {/* Arco inferior */}
        <path d="M 28 48 C 34 72, 66 72, 72 48" stroke="url(#lume-icon-arc)" strokeWidth="7" strokeLinecap="round" />
        {/* Ponto Branco */}
        <circle cx="28" cy="48" r="7" fill="#FFFFFF" />
        {/* Ponto Ciano com Glow */}
        <circle cx="72" cy="48" r="8" fill="#00D1FF" filter="url(#icon-glow)" />
      </svg>
    );
  }

  // Versão Completa (l u m e)
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <svg viewBox="0 0 280 80" className="h-10 md:h-12 w-auto max-w-[240px]" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="lume-full-arc" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#00D1FF" />
          </linearGradient>
          <filter id="full-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3.5" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Letra 'l' */}
        <rect x="18" y="16" width="10" height="50" rx="5" fill="#FFFFFF" />

        {/* Letra 'u' (Arco Lume) */}
        <path d="M 58 40 C 60 62, 92 62, 94 40" stroke="url(#lume-full-arc)" strokeWidth="8" strokeLinecap="round" />
        <circle cx="58" cy="40" r="7" fill="#FFFFFF" />
        <circle cx="94" cy="40" r="7.5" fill="#00D1FF" filter="url(#full-glow)" />

        {/* Letra 'm' */}
        <path d="M 128 66 V 36 C 128 26, 144 26, 144 36 C 144 26, 160 26, 160 36 V 66" 
              stroke="#FFFFFF" strokeWidth="8.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Letra 'e' */}
        <path d="M 218 48 H 190 C 190 34, 218 32, 218 46 C 218 64, 190 66, 190 52" 
              stroke="#FFFFFF" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
};
