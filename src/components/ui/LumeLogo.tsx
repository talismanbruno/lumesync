import React from 'react';

interface LogoProps {
  variant?: 'icon' | 'full';
  className?: string;
}

export const LumeLogo: React.FC<LogoProps> = ({ variant = 'full', className = '' }) => {
  // ÍCONE QUADRADO (Sidebar / Home)
  if (variant === 'icon') {
    return (
      <img
        src="https://i.ibb.co/pvXzxPn5/logo-icon.png"
        alt="Lume Icon"
        className={`w-10 h-10 rounded-xl object-contain select-none ${className}`}
        onError={(e) => {
          // Fallback se o link direto mudar
          (e.target as HTMLImageElement).src = "https://ibb.co/pvXzxPn5";
        }}
      />
    );
  }

  // LOGO DE TEXTO COMPLETA (Login / Dashboard)
  return (
    <div className={`flex items-center justify-center select-none ${className}`}>
      <img
        src="https://i.ibb.co/q3khCM2Z/logo-full.png"
        alt="Lume Logo"
        className="h-10 md:h-12 w-auto max-w-[260px] object-contain"
        onError={(e) => {
          // Fallback se o link direto mudar
          (e.target as HTMLImageElement).src = "https://ibb.co/q3khCM2Z";
        }}
      />
    </div>
  );
};
