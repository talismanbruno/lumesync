import React from "react";
import { ShieldCheck } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface AdminVerifiedBadgeProps {
  isAdmin?: boolean | null | undefined;
  className?: string;
  size?: number;
}

/**
 * Componente centralizado para exibir o selo de administrador verificado do LUME.
 * Baseado no campo seguro `is_admin` do perfil.
 */
export const AdminVerifiedBadge: React.FC<AdminVerifiedBadgeProps> = ({
  isAdmin,
  className,
  size = 14,
}) => {
  // Garantir que undefined vire null/false para agradar o TS se necessário, 
  // mas aqui o tipo já é boolean | null.
  if (!isAdmin) return null;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span 
            className={cn("inline-flex items-center justify-center text-cyan-400 shrink-0 select-none", className)}
            aria-label="Administrador verificado do LUME"
          >
            <ShieldCheck size={size} strokeWidth={2.5} />
          </span>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="bg-[#121212] border border-white/10 text-[10px] font-bold text-white px-2 py-1"
        >
          Administrador verificado do LUME
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

/**
 * Função utilitária para verificar se um perfil é administrador.
 */
export const isUserAdmin = (profile: any): boolean => {
  if (!profile) return false;
  // O Bot oficial tem ID fixo e não deve ser confundido com admin humano
  if (profile.id === '00000000-0000-0000-0000-000000000001' || profile.username === 'lume') {
    return false;
  }
  return !!profile.is_admin;
};
