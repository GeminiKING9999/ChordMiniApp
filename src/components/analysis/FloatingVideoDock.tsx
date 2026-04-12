'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { FaExpand, FaCompress } from 'react-icons/fa';
import { MdPictureInPictureAlt } from 'react-icons/md';
import { HiOutlineArrowPath, HiArrowPath } from 'react-icons/hi2';
import { Tooltip } from '@heroui/react';
import { AnalysisResult } from '@/services/chord-analysis/chordRecognitionService';
import { useChordPlayback } from '@/hooks/chord-playback/useChordPlayback';
import { useShowRomanNumerals, useToggleRomanNumerals } from '@/stores/uiStore';
import type { SegmentationResult } from '@/types/chatbotTypes';

// Dynamic imports for heavy components
const MetronomeControls = dynamic(() => import('@/components/chord-playback/MetronomeControls'), {
  loading: () => <div className="h-8 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-lg" />,
  ssr: false
});

const ChordSimplificationToggle = dynamic(() => import('@/components/analysis/ChordSimplificationToggle'), {
  loading: () => <div className="h-8 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-lg" />,
  ssr: false
});

import ChordPlaybackToggle from '@/components/chord-playback/ChordPlaybackToggle';
import MelodicTranscriptionToggle from '@/components/analysis/MelodicTranscriptionToggle';
import { useSimplifySelector } from '@/contexts/selectors'; // Now uses Zustand internally

const RomanNumeralToggle = dynamic(() => import('@/components/analysis/RomanNumeralToggle'), {
  loading: () => <div className="h-8 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-lg" />,
  ssr: false
});

const CollapsibleVideoPlayer = dynamic(() => import('@/components/analysis/CollapsibleVideoPlayer'), {
  ssr: false,
  loading: () => (
    <div className="aspect-video rounded-[18px] border border-white/35 bg-white/45 backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/35">
      <div className="flex h-full items-center justify-center">
        <div className="h-10 w-32 rounded-full bg-white/70 animate-pulse dark:bg-white/10" />
      </div>
    </div>
  )
});

interface FloatingVideoDockProps {
  // Layout positioning
  isChatbotOpen: boolean;
  isLyricsPanelOpen: boolean;
  isVideoMinimized: boolean;

  // Toggle states and handlers
  isFollowModeEnabled: boolean;
  analysisResults: AnalysisResult | null; // for opacity gating

  // Chord playback props
  currentBeatIndex: number;
  chords: string[];
  beats: (number | null)[];
  segmentationData?: SegmentationResult | null;

  // Handlers
  toggleVideoMinimization: () => void;
  toggleFollowMode: () => void;
  toggleMetronomeWithSync: () => Promise<boolean>;

  // Video player props
  videoId: string;
  isPlaying: boolean;
  playbackRate: number;
  currentTime: number;
  duration: number;
  onReady: (player: unknown) => void;
  onPlay: () => void;
  onPause: () => void;
  onProgress: (state: { playedSeconds: number; played: number; loadedSeconds: number; loaded: number }) => void;
  onSeek: (time: number) => void;
  onEnded?: () => void;

  // URLs
  youtubeEmbedUrl?: string;
  videoUrl?: string;

  // YouTube player for volume control
  youtubePlayer?: {
    seekTo: (time: number, type?: 'seconds' | 'fraction') => void;
    playVideo: () => void;
    pauseVideo: () => void;
    setPlaybackRate: (rate: number) => void;
    getCurrentTime: () => number;
    muted: boolean;
    // Volume control methods (may not be available on all YouTube player implementations)
    setVolume?: (volume: number) => void;
    getVolume?: () => number;
    mute?: () => void;
    unMute?: () => void;
    isMuted?: () => boolean;
  } | null;

  // UI options
  showTopToggles?: boolean;
  melodicTranscriptionPlayback?: {
    isEnabled: boolean;
    hasTranscription: boolean;
    isLoading?: boolean;
    disabled?: boolean;
    disabledReason?: string;
    errorMessage?: string | null;
    canAdjustVolume?: boolean;
    togglePlayback: () => void;
  };

  // Positioning mode
  positionMode?: 'fixed' | 'sticky' | 'relative';

  // Countdown gating (optional)
  isCountdownEnabled?: boolean;
  isCountingDown?: boolean;
  countdownDisplay?: string;
  onRequestCountdown?: () => Promise<boolean> | boolean;

  // Time signature for piano pattern (e.g. 3 for 3/4, defaults to 4)
  timeSignature?: number;
}

const FloatingVideoDock: React.FC<FloatingVideoDockProps> = ({
  isChatbotOpen,
  isLyricsPanelOpen,
  isVideoMinimized,
  isFollowModeEnabled,
  analysisResults,
  currentBeatIndex,
  chords,
  beats,
  segmentationData,
  toggleVideoMinimization,
  toggleFollowMode,
  toggleMetronomeWithSync,
  videoId,
  isPlaying,
  playbackRate,
  currentTime,

  duration,
  onReady,
  onPlay,
  onPause,
  onProgress,
  onSeek,
  onEnded,
  youtubeEmbedUrl,
  videoUrl,
  youtubePlayer,
  showTopToggles = true,
  melodicTranscriptionPlayback,
  positionMode = 'fixed',
  isCountdownEnabled = false,
  isCountingDown = false,
  countdownDisplay,
  timeSignature,
}) => {
  const utilityCircleButtonClass = 'h-9 w-9 min-w-9 rounded-full shadow-md transition-colors duration-200 inline-flex items-center justify-center p-0';
  // Roman numerals from Zustand store
  const showRomanNumerals = useShowRomanNumerals();
  const toggleRomanNumerals = useToggleRomanNumerals();

  // Chord playback hook - keep active regardless of top toggles so UtilityBar can still control playback
  // Simplify selector from UIContext
  const { simplifyChords, toggleSimplifyChords } = useSimplifySelector();

  const chordPlayback = useChordPlayback({
    currentBeatIndex,
    chords,
    beats,
    isPlaying,
    currentTime,
    segmentationData,
    timeSignature,
  });

  // Picture-in-Picture: detach the actual player as a draggable/resizable floating overlay
  const [isDetached, setIsDetached] = useState(false);
  const isPipActive = isDetached;
  const [pipPos, setPipPos] = useState({ x: 0, y: 0 });
  const [pipSize, setPipSize] = useState({ w: 640, h: 360 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null);
  const pipContainerRef = useRef<HTMLDivElement>(null);

  const handlePictureInPicture = useCallback(() => {
    setIsDetached(prev => {
      if (!prev) {
        // Detaching — center the floating video
        const w = Math.min(640, window.innerWidth - 32);
        const h = Math.round(w * 9 / 16);
        setPipSize({ w, h });
        setPipPos({ x: window.innerWidth - w - 16, y: window.innerHeight - h - 16 });
      }
      return !prev;
    });
  }, []);

  // Drag handlers — no deps so the closure captures the ref, not stale state
  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setPipPos(cur => {
      dragRef.current = { startX: e.clientX, startY: e.clientY, origX: cur.x, origY: cur.y };
      return cur;
    });
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      setPipPos({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  // Resize handlers — no deps so the closure captures the ref, not stale state
  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPipSize(cur => {
      resizeRef.current = { startX: e.clientX, startY: e.clientY, origW: cur.w, origH: cur.h };
      return cur;
    });
    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const dw = ev.clientX - resizeRef.current.startX;
      const dh = ev.clientY - resizeRef.current.startY;
      const newW = Math.max(320, resizeRef.current.origW + dw);
      const newH = Math.max(180, resizeRef.current.origH + dh);
      setPipSize({ w: newW, h: newH });
    };
    const onUp = () => {
      resizeRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  // Keep pip in bounds on window resize
  useEffect(() => {
    if (!isDetached) return;
    const onResize = () => {
      setPipPos(prev => ({
        x: Math.min(prev.x, window.innerWidth - 100),
        y: Math.min(prev.y, window.innerHeight - 100),
      }));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isDetached]);

  // Don't render if no video URLs are available
  if (!youtubeEmbedUrl && !videoUrl) {
    return null;
  }

  // FIXED: Support relative positioning for responsive layout
  const getContainerStyles = () => {
    if (positionMode === 'relative') {
      return {
        position: 'relative' as const,
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        pointerEvents: 'auto' as const,
        zIndex: 'auto'
      };
    }

    const position = positionMode === 'sticky' ? 'sticky' : 'fixed';
    return {
      position: position as 'sticky' | 'fixed',
      bottom: positionMode === 'sticky' ? undefined : '88px',
      top: positionMode === 'sticky' ? '8px' : undefined,
      right: isChatbotOpen || isLyricsPanelOpen ? '392px' : '4px',
      maxWidth: isVideoMinimized ? '250px' : '500px',
      minWidth: isVideoMinimized ? '200px' : '300px',
      pointerEvents: 'auto' as const,
      zIndex: 55
    };
  };

  const containerStyles = getContainerStyles();

  return (
    <>
    <div
      ref={isDetached ? pipContainerRef : undefined}
      className={`${isDetached ? '' : 'transition-all duration-300'} ${
        isDetached
          ? 'fixed z-[9999] rounded-2xl overflow-hidden ring-2 ring-blue-500/60 shadow-2xl'
          : `shadow-xl ${
              positionMode === 'relative'
                ? 'w-full'
                : `z-50 ${isVideoMinimized ? 'w-1/4 md:w-1/5' : 'w-2/3 md:w-1/3'}`
            }`
      }`}
      style={isDetached
        ? { left: pipPos.x, top: pipPos.y, width: pipSize.w, height: pipSize.h }
        : containerStyles
      }
    >
      {/* FIXED: Responsive toggle button container - inline for mobile, absolute for fixed positioning */}
      {!isDetached && showTopToggles && (
        <div
          className={`${
            positionMode === 'relative'
              ? 'relative mb-1.5 w-full' // Inline positioning for responsive layout
              : 'absolute -top-12 left-0 right-2 md:right-12 z-60' // Absolute positioning for fixed layout
          } md:hidden flex items-center gap-2 overflow-x-auto hide-scrollbar rounded-[20px] border border-white/45 bg-white/55 p-1.5 shadow-lg backdrop-blur-xl transition-colors duration-300 dark:border-white/10 dark:bg-slate-900/45`}
          style={{
            maxWidth: positionMode === 'relative' ? '100%' : 'calc(100vw - 100px)' // Full width for inline, constrained for absolute
          }}
        >
          <Tooltip
            content={isFollowModeEnabled ? "Disable auto-scroll" : "Enable auto-scroll"}
            placement="top"
            delay={500}
            closeDelay={100}
            classNames={{
              base: "max-w-xs",
              content: "bg-white text-gray-900 dark:bg-content-bg dark:text-gray-100 border border-gray-300 dark:border-gray-600 shadow-lg"
            }}
          >
            <button
              onClick={toggleFollowMode}
              className={`${utilityCircleButtonClass} ${
                isFollowModeEnabled
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500'
              }`}
            >
              {/* Icon */}
              {isFollowModeEnabled ? (
                <HiArrowPath className="h-4 w-4" />
              ) : (
                <HiOutlineArrowPath className="h-4 w-4" />
              )}
            </button>
          </Tooltip>

          {/* Roman numeral toggle - reserve space to prevent layout shift */}
          <div style={{ opacity: analysisResults ? 1 : 0, pointerEvents: analysisResults ? 'auto' : 'none' }}>
            <RomanNumeralToggle
              isEnabled={showRomanNumerals}
              onClick={toggleRomanNumerals}
            />
          </div>

          {/* Chord playback toggle - reserve space to prevent layout shift */}
          <div style={{ opacity: analysisResults ? 1 : 0, pointerEvents: analysisResults ? 'auto' : 'none' }}>
            <ChordPlaybackToggle
              isEnabled={chordPlayback.isEnabled}
              onClick={chordPlayback.togglePlayback}
              pianoVolume={chordPlayback.pianoVolume}
              guitarVolume={chordPlayback.guitarVolume}
              violinVolume={chordPlayback.violinVolume}
              fluteVolume={chordPlayback.fluteVolume}
              onPianoVolumeChange={chordPlayback.setPianoVolume}
              onGuitarVolumeChange={chordPlayback.setGuitarVolume}
              onViolinVolumeChange={chordPlayback.setViolinVolume}
              onFluteVolumeChange={chordPlayback.setFluteVolume}
              youtubePlayer={youtubePlayer}
            />
          </div>

          {melodicTranscriptionPlayback && (
            <div style={{ opacity: analysisResults ? 1 : 0, pointerEvents: analysisResults ? 'auto' : 'none' }}>
              <MelodicTranscriptionToggle
                isEnabled={melodicTranscriptionPlayback.isEnabled}
                hasTranscription={melodicTranscriptionPlayback.hasTranscription}
                isLoading={melodicTranscriptionPlayback.isLoading}
                disabled={melodicTranscriptionPlayback.disabled}
                disabledReason={melodicTranscriptionPlayback.disabledReason}
                errorMessage={melodicTranscriptionPlayback.errorMessage}
                canAdjustVolume={melodicTranscriptionPlayback.canAdjustVolume}
                onClick={melodicTranscriptionPlayback.togglePlayback}
              />
            </div>
          )}

          {/* Chord simplification toggle - reserve space to prevent layout shift */}
          <div style={{ opacity: analysisResults ? 1 : 0, pointerEvents: analysisResults ? 'auto' : 'none' }}>
            <ChordSimplificationToggle
              isEnabled={simplifyChords}
              onClick={toggleSimplifyChords}
            />
          </div>

          {/* Metronome controls - reserve space to prevent layout shift */}
          <div style={{ opacity: analysisResults ? 1 : 0, pointerEvents: analysisResults ? 'auto' : 'none' }}>
            <MetronomeControls
              onToggleWithSync={toggleMetronomeWithSync}
            />
          </div>
        </div>
      )}
      <div
        className={`relative overflow-hidden ${
          isDetached
            ? 'h-full w-full rounded-2xl bg-black'
            : 'rounded-[20px] border border-white/45 bg-white/20 shadow-[0_24px_60px_-28px_rgba(15,23,42,0.7)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/20 sm:rounded-[24px]'
        }`}
      >
        {/* Drag handle bar — only when detached */}
        {isDetached && (
          <div
            onMouseDown={onDragStart}
            className="absolute inset-x-0 top-0 z-30 flex h-8 cursor-grab items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-3 active:cursor-grabbing"
          >
            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/70 select-none">Drag to move</span>
            <button
              onClick={handlePictureInPicture}
              className="flex items-center gap-1 rounded-md bg-blue-600/90 px-2 py-0.5 text-[10px] font-semibold text-white transition-colors hover:bg-blue-500"
            >
              <MdPictureInPictureAlt className="h-3.5 w-3.5" />
              Reattach
            </button>
          </div>
        )}
        {/* Desktop controls: PiP + shrink/expand */}
        {!isDetached && <div className="absolute right-3 top-3 z-20 hidden md:flex md:items-center md:gap-2">
          <Tooltip
            content={isPipActive ? 'Close detached video' : 'Detach video (Picture-in-Picture)'}
            placement="left"
            delay={300}
            closeDelay={100}
            classNames={{
              base: 'max-w-xs',
              content: 'bg-white text-gray-900 dark:bg-content-bg dark:text-gray-100 border border-gray-300 dark:border-gray-600 shadow-lg'
            }}
          >
            <button
              onClick={handlePictureInPicture}
              className={`group inline-flex h-10 min-w-10 items-center justify-center rounded-xl border px-2.5 text-white shadow-[0_10px_30px_-14px_rgba(15,23,42,0.95)] backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_-16px_rgba(15,23,42,1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black/20 ${
                isPipActive
                  ? 'border-blue-400/40 bg-blue-600/80 hover:bg-blue-500/90'
                  : 'border-white/20 bg-slate-950/10 hover:bg-slate-950/78'
              }`}
              aria-label={isPipActive ? 'Close detached video' : 'Detach video'}
            >
              <span className="flex items-center gap-2">
                <MdPictureInPictureAlt className="h-4 w-4" />
                <span className="hidden lg:inline text-[10px] font-semibold uppercase tracking-[0.16em] text-white/92">
                  {isPipActive ? 'Close' : 'Detach'}
                </span>
              </span>
            </button>
          </Tooltip>
          <Tooltip
            content={isVideoMinimized ? 'Expand video player' : 'Shrink video player'}
            placement="left"
            delay={300}
            closeDelay={100}
            classNames={{
              base: 'max-w-xs',
              content: 'bg-white text-gray-900 dark:bg-content-bg dark:text-gray-100 border border-gray-300 dark:border-gray-600 shadow-lg'
            }}
          >
            <button
              onClick={toggleVideoMinimization}
              className="group inline-flex h-10 min-w-10 items-center justify-center rounded-xl border border-white/20 bg-slate-950/10 px-2.5 text-white shadow-[0_10px_30px_-14px_rgba(15,23,42,0.95)] backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-950/78 hover:shadow-[0_16px_36px_-16px_rgba(15,23,42,1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black/20"
              aria-label={isVideoMinimized ? 'Expand video player' : 'Shrink video player'}
            >
              <span className="flex items-center gap-2">
                {isVideoMinimized ? (
                  <FaExpand className="h-3.5 w-3.5" />
                ) : (
                  <FaCompress className="h-3.5 w-3.5" />
                )}
                <span className="hidden lg:inline text-[10px] font-semibold uppercase tracking-[0.16em] text-white/92">
                  {isVideoMinimized ? 'Expand' : 'Shrink'}
                </span>
              </span>
            </button>
          </Tooltip>
        </div>}

        {/* Countdown overlay */}
        {!isDetached && isCountdownEnabled && isCountingDown && (
          <div className="absolute inset-0 z-60 flex items-center justify-center bg-black/40 text-white text-4xl font-bold select-none pointer-events-none">
            {countdownDisplay || ''}
          </div>
        )}

        {/* Video player with mobile collapsible functionality */}
        {(youtubeEmbedUrl || videoUrl) && (
          <div className={isDetached ? 'h-full w-full' : 'relative'}>
            <CollapsibleVideoPlayer
              videoId={videoId}
              isPlaying={isPlaying}
              playbackRate={playbackRate}
              currentTime={currentTime}
              duration={duration}
              onReady={onReady}
              onPlay={onPlay}
              onPause={onPause}
              onProgress={onProgress}
              onSeek={onSeek}
              onEnded={onEnded}
            />
          </div>
        )}
        {/* Resize handle — only when detached */}
        {isDetached && (
          <div
            onMouseDown={onResizeStart}
            className="absolute bottom-0 right-0 z-30 h-5 w-5 cursor-nwse-resize"
            style={{ background: 'linear-gradient(135deg, transparent 50%, rgba(59,130,246,0.7) 50%)' }}
          />
        )}
      </div>
    </div>
    </>
  );
};

export default FloatingVideoDock;
export { FloatingVideoDock };
