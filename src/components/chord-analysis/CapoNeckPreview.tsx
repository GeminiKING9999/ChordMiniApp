'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Chip } from '@heroui/react';
import { motion } from 'framer-motion';
import UtilityPopoverPanel from '@/components/analysis/UtilityPopoverPanel';

export interface FretboardTheme {
  name: string;
  neckBg: string;
  neckBorder: string;
  nutFill: string;
  fretLine: string;
  stringLine: string;
  markerFill: string;
  capoFill: string;
  capoStroke: string;
  capoSuggested: string;
  hoverCapoFill: string;
  hoverCapoStroke: string;
}

export const SYNTHWAVE_THEME: FretboardTheme = {
  name: 'synthwave',
  neckBg: 'url(#synthwave-neck-bg)',
  neckBorder: 'rgba(186, 85, 211, 0.45)',
  nutFill: 'rgba(26, 12, 45, 0.95)',
  fretLine: 'rgba(238, 130, 238, 0.75)',
  stringLine: 'rgba(0, 255, 255, 0.95)',
  markerFill: 'rgba(238, 130, 238, 0.4)',
  capoFill: 'url(#capo-synthwave-gradient)',
  capoStroke: '#ffffff',
  capoSuggested: '#ffd700',
  hoverCapoFill: 'rgba(255, 0, 127, 0.25)',
  hoverCapoStroke: 'rgba(255, 0, 127, 0.75)',
};

interface CapoNeckPreviewProps {
  capoFret: number;
  suggestedCapoFret?: number | null;
  onCapoFretChange?: (fret: number) => void;
  theme?: FretboardTheme;
}

const SVG_WIDTH = 312;
const SVG_HEIGHT = 112;
const NECK_LEFT = 30;
const NECK_RIGHT = 290;
const NECK_TOP = 26;
const NECK_BOTTOM = 92;
const STRING_COUNT = 6;
const DEFAULT_FRET_COUNT = 12;
const FRET_MARKERS = [3, 5, 7, 9, 12];

function clampCapoFret(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(12, value));
}

export default function CapoNeckPreview({
  capoFret,
  suggestedCapoFret = null,
  onCapoFretChange,
  theme = SYNTHWAVE_THEME,
}: CapoNeckPreviewProps) {
  const currentFret = clampCapoFret(capoFret);
  const suggestedFret = suggestedCapoFret == null ? null : clampCapoFret(suggestedCapoFret);
  const isDraggingRef = useRef(false);
  const [hoveredFret, setHoveredFret] = useState<number | null>(null);

  const fretCount = useMemo(() => DEFAULT_FRET_COUNT, []);

  const fretSpacing = (NECK_RIGHT - NECK_LEFT) / fretCount;
  const currentCapoX = NECK_LEFT + fretSpacing * currentFret;
  const neckWidth = NECK_RIGHT - NECK_LEFT;
  const nutWidth = 7;

  const stringLines = Array.from({ length: STRING_COUNT }, (_, index) => {
    const ratio = index / (STRING_COUNT - 1);
    return NECK_TOP + ((NECK_BOTTOM - NECK_TOP) * ratio);
  });

  const getFretFromClientX = useCallback((bounds: DOMRect | ReturnType<SVGRectElement['getBoundingClientRect']>, clientX: number): number => {
    const relativeX = clientX - bounds.left;
    const normalized = bounds.width > 0 ? relativeX / bounds.width : 0;
    return clampCapoFret(Math.round(normalized * fretCount));
  }, [fretCount]);

  const updateCapoFromPointer = useCallback((event: React.PointerEvent<SVGRectElement>) => {
    if (!onCapoFretChange) {
      return;
    }

    onCapoFretChange(getFretFromClientX(event.currentTarget.getBoundingClientRect(), event.clientX));
  }, [getFretFromClientX, onCapoFretChange]);

  const updateCapoFromMouse = useCallback((event: React.MouseEvent<SVGRectElement>) => {
    if (!onCapoFretChange) {
      return;
    }

    onCapoFretChange(getFretFromClientX(event.currentTarget.getBoundingClientRect(), event.clientX));
  }, [getFretFromClientX, onCapoFretChange]);

  const handlePointerDown = useCallback((event: React.PointerEvent<SVGRectElement>) => {
    if (!onCapoFretChange) {
      return;
    }

    isDraggingRef.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    updateCapoFromPointer(event);
  }, [onCapoFretChange, updateCapoFromPointer]);

  const handlePointerMove = useCallback((event: React.PointerEvent<SVGRectElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const fret = getFretFromClientX(bounds, event.clientX);
    setHoveredFret(fret);

    if (!isDraggingRef.current) {
      return;
    }

    updateCapoFromPointer(event);
  }, [getFretFromClientX, updateCapoFromPointer]);

  const handlePointerRelease = useCallback((event: React.PointerEvent<SVGRectElement>) => {
    isDraggingRef.current = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }, []);

  const handlePointerLeave = useCallback(() => {
    setHoveredFret(null);
  }, []);

  const handleMouseDown = useCallback((event: React.MouseEvent<SVGRectElement>) => {
    if (!onCapoFretChange) {
      return;
    }

    isDraggingRef.current = true;
    updateCapoFromMouse(event);
  }, [onCapoFretChange, updateCapoFromMouse]);

  const handleMouseMove = useCallback((event: React.MouseEvent<SVGRectElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const fret = getFretFromClientX(bounds, event.clientX);
    setHoveredFret(fret);

    if (!isDraggingRef.current) {
      return;
    }

    updateCapoFromMouse(event);
  }, [getFretFromClientX, updateCapoFromMouse]);

  const handleMouseRelease = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  const handleMouseLeave = useCallback(() => {
    isDraggingRef.current = false;
    setHoveredFret(null);
  }, []);

  return (
    <UtilityPopoverPanel bodyClassName="gap-3 p-3 bg-[#0d0418] border border-fuchsia-500/30">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-cyan-400">
              {suggestedFret != null
                ? suggestedFret === 0
                  ? 'Suggested: no capo'
                  : `Suggested: fret ${suggestedFret}`
                : 'Capo preview'}
            </p>
            <p className="text-xs font-semibold text-cyan-300">
              {currentFret === 0 ? 'Current: no capo' : `Current: fret ${currentFret}`}
            </p>
          </div>
          <Chip
            size="sm"
            variant="flat"
            classNames={{
              base: 'border border-fuchsia-500/30 bg-fuchsia-950/45 dark:bg-fuchsia-950/45',
              content: 'text-[11px] font-bold text-fuchsia-300',
            }}
          >
            Frets 0-{fretCount}
          </Chip>
        </div>

        <svg
          aria-hidden="true"
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          className="h-auto w-full"
          role="presentation"
        >
          <defs>
            {/* Dark obsidian-purple background gradient for the neck */}
            <linearGradient id="synthwave-neck-bg" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0c0314" />
              <stop offset="50%" stopColor="#1e082b" />
              <stop offset="100%" stopColor="#0c0314" />
            </linearGradient>

            {/* Metallic hot magenta/gold gradient for the capo */}
            <linearGradient id="capo-synthwave-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff007f" />
              <stop offset="25%" stopColor="#ff7700" />
              <stop offset="50%" stopColor="#ffd700" />
              <stop offset="75%" stopColor="#ff7700" />
              <stop offset="100%" stopColor="#ff007f" />
            </linearGradient>

            {/* Glow filter for neon purple (frets) */}
            <filter id="glow-neon-purple" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="blur1" />
              <feGaussianBlur stdDeviation="1.0" result="blur2" />
              <feMerge>
                <feMergeNode in="blur1" />
                <feMergeNode in="blur2" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Glow filter for neon cyan (strings) */}
            <filter id="glow-neon-cyan" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.0" result="blur1" />
              <feGaussianBlur stdDeviation="0.8" result="blur2" />
              <feMerge>
                <feMergeNode in="blur1" />
                <feMergeNode in="blur2" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Glow filter for gold marker */}
            <filter id="glow-gold" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3.0" result="blur" />
              <feColorMatrix type="matrix" values="
                1 0 0 0 1
                0 0.84 0 0 0.84
                0 0 0 0 0
                0 0 0 1 0
              " />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Glow filter for capo clamp */}
            <filter id="glow-capo" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#ff007f" floodOpacity="0.5" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Neck Background */}
          <rect
            x={NECK_LEFT - 8}
            y={NECK_TOP - 4}
            width={neckWidth + 10}
            height={(NECK_BOTTOM - NECK_TOP) + 8}
            rx={15}
            fill={theme.neckBg}
            stroke={theme.neckBorder}
            strokeWidth={1.5}
            style={{ filter: 'drop-shadow(0px 0px 8px rgba(186, 85, 211, 0.25))' }}
          />

          {/* Nut */}
          <rect
            x={NECK_LEFT - 10}
            y={NECK_TOP - 5}
            width={nutWidth}
            height={(NECK_BOTTOM - NECK_TOP) + 10}
            rx={3}
            fill={theme.nutFill}
            stroke={theme.neckBorder}
            strokeWidth={0.5}
          />

          {/* Frets */}
          {Array.from({ length: fretCount + 1 }, (_, fretIndex) => {
            const x = NECK_LEFT + (fretSpacing * fretIndex);
            const strokeWidth = fretIndex === 0 ? 0 : fretIndex === fretCount ? 1.2 : 1;
            return (
              <line
                key={`fret-${fretIndex}`}
                x1={x}
                x2={x}
                y1={NECK_TOP}
                y2={NECK_BOTTOM}
                stroke={theme.fretLine}
                strokeWidth={strokeWidth}
                filter="url(#glow-neon-purple)"
              />
            );
          })}

          {/* Strings */}
          {stringLines.map((y, index) => (
            <line
              key={`string-${index}`}
              x1={NECK_LEFT}
              x2={NECK_RIGHT}
              y1={y}
              y2={y}
              stroke={theme.stringLine}
              strokeWidth={index === 0 ? 1.8 : 1.2}
              filter="url(#glow-neon-cyan)"
            />
          ))}

          {/* Markers */}
          {FRET_MARKERS.filter((marker) => marker <= fretCount).map((marker) => {
            const x = NECK_LEFT + (fretSpacing * (marker - 0.5));
            const isDoubleMarker = marker === 12;

            if (isDoubleMarker) {
              return (
                <React.Fragment key={`marker-${marker}`}>
                  <circle cx={x} cy={NECK_TOP + 18} r={3.2} fill={theme.markerFill} filter="url(#glow-neon-purple)" />
                  <circle cx={x} cy={NECK_BOTTOM - 18} r={3.2} fill={theme.markerFill} filter="url(#glow-neon-purple)" />
                </React.Fragment>
              );
            }

            return <circle key={`marker-${marker}`} cx={x} cy={(NECK_TOP + NECK_BOTTOM) / 2} r={3.2} fill={theme.markerFill} filter="url(#glow-neon-purple)" />;
          })}

          {/* Interactive Drag Surface */}
          <rect
            x={NECK_LEFT}
            y={NECK_TOP - 8}
            width={neckWidth}
            height={(NECK_BOTTOM - NECK_TOP) + 16}
            rx={12}
            fill="transparent"
            className={onCapoFretChange ? 'cursor-grab active:cursor-grabbing' : undefined}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerRelease}
            onPointerCancel={handlePointerRelease}
            onPointerLeave={handlePointerLeave}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseRelease}
            onMouseLeave={handleMouseLeave}
            data-testid="capo-drag-surface"
          />

          {/* Suggested Fret Pulse Overlay */}
          {suggestedFret !== null && suggestedFret > 0 && (
            <motion.g
              animate={{ opacity: [0.35, 0.95, 0.35] }}
              transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
              style={{ pointerEvents: 'none' }}
            >
              <line
                x1={NECK_LEFT + fretSpacing * suggestedFret}
                x2={NECK_LEFT + fretSpacing * suggestedFret}
                y1={NECK_TOP - 12}
                y2={NECK_BOTTOM + 12}
                stroke={theme.capoSuggested}
                strokeWidth={2}
                strokeDasharray="2 3"
                filter="url(#glow-gold)"
              />
              <circle
                cx={NECK_LEFT + fretSpacing * suggestedFret}
                cy={NECK_TOP - 12}
                r={3.5}
                fill={theme.capoSuggested}
                filter="url(#glow-gold)"
              />
              <circle
                cx={NECK_LEFT + fretSpacing * suggestedFret}
                cy={NECK_BOTTOM + 12}
                r={3.5}
                fill={theme.capoSuggested}
                filter="url(#glow-gold)"
              />
            </motion.g>
          )}

          {/* Hover Preview Capo */}
          {hoveredFret !== null && hoveredFret > 0 && hoveredFret !== currentFret && !isDraggingRef.current && (
            <motion.rect
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.45, x: NECK_LEFT + fretSpacing * hoveredFret - 4 }}
              transition={{ duration: 0.1 }}
              y={NECK_TOP - 5}
              width={8}
              height={(NECK_BOTTOM - NECK_TOP) + 10}
              rx={4}
              fill={theme.hoverCapoFill}
              stroke={theme.hoverCapoStroke}
              strokeWidth={1}
              filter="url(#glow-capo)"
              style={{ pointerEvents: 'none' }}
            />
          )}

          {/* Current Capo */}
          {currentFret > 0 && (
            <motion.rect
              data-testid="capo-current-strip"
              initial={false}
              animate={{ x: currentCapoX - 5 }}
              transition={{ type: 'spring', stiffness: 260, damping: 26 }}
              y={NECK_TOP - 7}
              width={10}
              height={(NECK_BOTTOM - NECK_TOP) + 14}
              rx={5}
              fill={theme.capoFill}
              stroke={theme.capoStroke}
              strokeWidth={1.5}
              filter="url(#glow-capo)"
              style={{ pointerEvents: 'none' }}
            />
          )}
        </svg>
    </UtilityPopoverPanel>
  );
}
