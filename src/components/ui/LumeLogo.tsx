import React from 'react';

interface LogoProps {
  variant?: 'icon' | 'full';
  className?: string;
}

export const LumeLogo: React.FC<LogoProps> = ({ variant = 'full', className = '' }) => {
  // TOPO DA BARRA LATERAL DE SERVIDORES - COLUNA 1 (ÍCONE DO APP)
  if (variant === 'icon') {
    return (
      <img 
        src="/brand/lume-mark.png" 
        alt="Lume Icon" 
        className={`w-10 h-10 rounded-xl object-contain hover:scale-105 transition-transform select-none ${className}`} 
      />
    );
  }

  // ÁREA CENTRAL DO DASHBOARD E TELA DE LOGIN (LOGO COMPLETA)
  return (
    <div className={`flex items-center justify-center select-none ${className}`}>
      <img 
        src="/brand/lume-wordmark.png" 
        alt="Lume" 
        className="h-12 w-auto max-w-[280px] mx-auto object-contain mb-3" 
      />
    </div>
  );
};
