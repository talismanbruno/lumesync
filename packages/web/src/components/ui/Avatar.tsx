import React, { useEffect, useMemo, useState } from 'react';
import type { User, UserStatus, ProfileCustomization } from '@backspace/shared';
import { cosmeticAvatarUrl } from '../../stores/customizationStore';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useAuthStore } from '../../stores/authStore';
import { useSpaceStore } from '../../stores/spaceStore';
import { canonicalUserKey, isSelf } from '../../utils/identity';
import { useUIStore } from '../../stores/uiStore';
import { getAvatarGradient } from '../../utils/gradients';
import { resolveAvatarSource } from '../../utils/safeUrls';
import { getPresenceLabel } from '../../utils/presenceLabels';
import { Tooltip } from './Tooltip';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: number;
  status?: UserStatus | null;
  statusLabel?: string;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  user?: User;
  userId?: string;
  ring?: { width: number; color: string };
  avatarColor?: string | null;
  freezeAnimation?: boolean;
  showDecoration?: boolean;
  customization?: ProfileCustomization | null;
}

const frozenAvatarCache = new Map<string, string>();

function useFrozenAvatar(src: string | null, freeze: boolean): string | null {
  const [frozen, setFrozen] = useState<{ original: string; still: string } | null>(null);

  useEffect(() => {
    if (!src || !freeze) return;
    const cached = frozenAvatarCache.get(src);
    if (cached) {
      setFrozen({ original: src, still: cached });
      return;
    }

    let cancelled = false;
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement('canvas');
        const width = image.naturalWidth || 128;
        const height = image.naturalHeight || 128;
        const scale = Math.min(1, 256 / Math.max(width, height));
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
        const still = canvas.toDataURL('image/webp', 0.9);
        if (frozenAvatarCache.size >= 64) {
          const oldest = frozenAvatarCache.keys().next().value;
          if (oldest !== undefined) frozenAvatarCache.delete(oldest);
        }
        frozenAvatarCache.set(src, still);
        setFrozen({ original: src, still });
      } catch {
        setFrozen({ original: src, still: src });
      }
    };
    image.onerror = () => { if (!cancelled) setFrozen({ original: src, still: src }); };
    image.src = src;
    return () => { cancelled = true; };
  }, [src, freeze]);

  return freeze && src ? frozenAvatarCache.get(src) ?? (frozen?.original === src ? frozen.still : null) : src;
}

const statusColors: Record<string, string> = {
  online: 'bg-status-online',
  working: 'bg-status-working shadow-[0_0_8px_rgba(56,189,248,0.75)]',
  idle: 'bg-status-idle',
  dnd: 'bg-status-dnd',
  offline: 'bg-status-offline',
};

/**
 * Builds a CSS radial-gradient mask that punches a circular hole in the avatar
 * where the status dot sits. The hole reveals the parent background, creating
 * a true cutout effect on any surface — no border-color matching needed.
 *
 * Prototype reference (.m-dot): 12px box with 3px border (border-box) = 6px
 * visible color, positioned at bottom:-2 right:-2 → center 4px from corner.
 */
function buildCutoutMask(avatarSize: number, ringWidth: number = 0): string {
  const outerSize = avatarSize + ringWidth * 2;
  const { dot, gap, inset } = getDotMetrics(avatarSize, ringWidth);
  const cx = outerSize - inset;
  const cy = outerSize - inset;
  const r = dot / 2 + gap;
  return `radial-gradient(circle at ${cx}px ${cy}px, transparent ${r}px, black ${r + 0.5}px)`;
}

/** Returns visible dot diameter, gap width, and center inset from outer edge. */
function getDotMetrics(avatarSize: number, ringWidth: number = 0) {
  let dot: number, gap: number, avatarInset: number;
  if (avatarSize <= 24) {
    dot = 5; gap = 2; avatarInset = 3;
  } else if (avatarSize <= 48) {
    dot = 6; gap = 3; avatarInset = 4;
  } else {
    dot = Math.round(avatarSize * 0.15);
    gap = Math.round(avatarSize * 0.05);
    avatarInset = Math.round(avatarSize * 0.10);
  }
  return { dot, gap, inset: avatarInset + ringWidth };
}

export function Avatar({ src, name, size = 40, status, statusLabel, className = '', onClick, user, userId, ring, avatarColor, freezeAnimation = false, showDecoration = false, customization }: AvatarProps) {
  const openUserProfile = useUIStore((s) => s.openUserProfile);
  const identityKey = user ? canonicalUserKey(user) : userId ?? null;
  const cachedCustomization = useSpaceStore(state => identityKey ? state.userViews?.get(identityKey)?.user.customization : undefined);
  const selfCustomization = useAuthStore(state => user ? (isSelf(user, state.user) ? state.user?.customization : undefined) : userId === state.user?.id ? state.user?.customization : undefined);
  const appearance = customization !== undefined ? customization : selfCustomization !== undefined ? selfCustomization : cachedCustomization !== undefined ? cachedCustomization : user?.customization;
  const reducedMotion = useReducedMotion();
  const freeze = freezeAnimation || reducedMotion;
  // Keep one source per decoration and motion preference, including while the catalog loads.
  const decoration = showDecoration ? cosmeticAvatarUrl(appearance?.avatarDecorationId, !freeze) : undefined;
  const initials = name.charAt(0).toUpperCase();
  const fontPx = Math.round(size * 0.4);
  const gradient = getAvatarGradient(userId ?? user?.homeUserId ?? user?.id, name, avatarColor ?? user?.avatarColor);
  const resolvedSrc = useMemo(() => {
    return resolveAvatarSource(src);
  }, [src]);
  const displaySrc = useFrozenAvatar(resolvedSrc, freeze);

  const ringWidth = ring?.width ?? 0;
  const outerSize = size + ringWidth * 2;

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      onClick(e);
    } else if (user) {
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      openUserProfile(user, {
        top: Math.min(rect.top, window.innerHeight - 450),
        left: rect.right + 16,
      });
    }
  };

  // Only compute mask when status dot is visible
  const cutoutMask = status ? buildCutoutMask(size, ringWidth) : undefined;
  const maskStyle: React.CSSProperties | undefined = cutoutMask
    ? { maskImage: cutoutMask, WebkitMaskImage: cutoutMask }
    : undefined;

  const { dot: dotDiameter, gap: dotGap, inset: dotInset } = getDotMetrics(size, ringWidth);

  return (
    <div
      data-avatar
      className={`relative inline-flex flex-shrink-0 ${(onClick || user) ? 'cursor-pointer' : ''} ${className}`}
      style={{ width: outerSize, height: outerSize }}
      onClick={handleClick}
    >
      {/* Inner masked circle — ring background + avatar content */}
      <div
        className="w-full h-full rounded-full"
        style={{
          padding: ringWidth,
          backgroundColor: ring?.color,
          ...maskStyle,
        }}
      >
        {displaySrc ? (
          <img
            src={displaySrc}
            alt={name}
            loading="lazy"
            className="w-full h-full rounded-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              const parent = (e.target as HTMLImageElement).parentElement;
              if (parent) {
                const fallback = parent.querySelector('.avatar-fallback') as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
              }
            }}
          />
        ) : null}
        <div
          className={`avatar-fallback w-full h-full rounded-full flex items-center justify-center font-bold text-white ${displaySrc ? 'hidden' : 'flex'}`}
          style={{ background: gradient.gradient, color: gradient.foreground, fontSize: fontPx, ...(displaySrc ? { display: 'none' } : {}) }}
        >
          {initials}
        </div>
      </div>
      {decoration && (
        <img
          key={decoration}
          src={decoration}
          alt=""
          aria-hidden="true"
          className="lume-avatar-decoration"
          loading="lazy"
          onError={event => { event.currentTarget.hidden = true; }}
        />
      )}
      {/* Status dot — outside the masked div so it isn't clipped */}
      {status && (
        <div
          className="absolute flex"
          style={{
            bottom: dotInset - dotDiameter / 2 - dotGap,
            right: dotInset - dotDiameter / 2 - dotGap,
          }}
        >
          <Tooltip content={statusLabel ?? getPresenceLabel(status)} position="top">
            <span
              role="img"
              aria-label={statusLabel ?? getPresenceLabel(status)}
              className="inline-flex"
              style={{ padding: dotGap }}
            >
              <span
                className={`block rounded-full ${statusColors[status] ?? 'bg-status-offline'}`}
                style={{ width: dotDiameter, height: dotDiameter }}
              />
            </span>
          </Tooltip>
        </div>
      )}
    </div>
  );
}
