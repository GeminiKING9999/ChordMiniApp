'use client';

import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { ChordEvent, isBlackKey } from '@/utils/chordToMidi';
import {
  attachVisualNotePositions,
  generateBaseInstrumentSchedule,
  resolveInstrumentVisualNotes,
  mergeConsecutiveChordEvents,
  type SignalDynamicsSource,
  type ActiveInstrument,
} from '@/utils/instrumentNoteGeneration';
import type { GuitarVoicingSelection } from '@/utils/guitarVoicing';
import type { SegmentationResult } from '@/types/chatbotTypes';
import type { SheetSageVisualNote } from '@/utils/sheetSagePlayback';

// Re-export ActiveInstrument so existing consumers don't break
export type { ActiveInstrument } from '@/utils/instrumentNoteGeneration';
export type ExtraVisualNote = SheetSageVisualNote;

interface FallingNotesCanvasProps {
  /** Chord events to render as falling notes */
  chordEvents: ChordEvent[];
  /** Current playback time in seconds */
  currentTime: number;
  /** Whether playback is active */
  isPlaying: boolean;
  /** Lowest MIDI note displayed */
  startMidi: number;
  /** Highest MIDI note displayed */
  endMidi: number;
  /** Width of each white key in pixels */
  whiteKeyWidth?: number;
  /** How many seconds of the future to show (look-ahead window) */
  lookAheadSeconds?: number;
  /** How many seconds of the past to show (trail) */
  lookBehindSeconds?: number;
  /** Height of the canvas in pixels */
  height?: number;
  /** Active instruments for instrument-specific coloring */
  activeInstruments?: ActiveInstrument[];
  /** BPM for consistent beat duration with audio playback */
  bpm?: number;
  /** Time signature (e.g. 3 for 3/4, defaults to 4) */
  timeSignature?: number;
  /** Optional song segmentation for section-aware piano patterns */
  segmentationData?: SegmentationResult | null;
  /** Shared guitar diagram selection used to resolve guitar strumming voicings */
  guitarVoicing?: Partial<GuitarVoicingSelection>;
  /** Enharmonic target key for capo-transposed guitar shapes */
  targetKey?: string;
  /** Optional signal-aware dynamics source so visuals mirror playback note patterns */
  signalDynamicsSource?: SignalDynamicsSource | null;
  /** Playback position used to apply the same in-chord scheduling adjustments as audio playback */
  playbackTime?: number;
  /** Optional precomputed overlay notes such as melodic transcription */
  extraVisualNotes?: ExtraVisualNote[];
  /** Callback: set of active MIDI notes at current time */
  onActiveNotesChange?: (notes: Set<number>, colors: Map<number, string>) => void;
  /** Simple mode: show only root note per chord */
  simpleMode?: boolean;
  /** Colorful mode: each pitch class gets a unique color */
  colorfulMode?: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_WHITE_KEY_WIDTH = 14;

// Default colors for chord degrees / note function
const DEFAULT_NOTE_COLOR = '#60a5fa'; // blue-400

// Chromatic color map — one unique vivid color per pitch class
const CHROMATIC_COLORS: Record<number, string> = {
  0:  '#ef4444', // C  — red
  1:  '#f97316', // C# — orange
  2:  '#eab308', // D  — yellow
  3:  '#84cc16', // D# — lime
  4:  '#22c55e', // E  — green
  5:  '#14b8a6', // F  — teal
  6:  '#06b6d4', // F# — cyan
  7:  '#3b82f6', // G  — blue
  8:  '#6366f1', // G# — indigo
  9:  '#8b5cf6', // A  — purple
  10: '#d946ef', // A# — fuchsia
  11: '#ec4899', // B  — pink
};

/** Get color for a note. In colorful mode, uses pitch class. Otherwise uniform blue. */
function getChromaticColor(midi: number): string {
  return CHROMATIC_COLORS[midi % 12] || DEFAULT_NOTE_COLOR;
}

// Hit line position from bottom (where notes "land")
const HIT_LINE_Y_RATIO = 0.88;
const SOFT_SYNC_DRIFT_THRESHOLD = 0.05;
const HARD_SYNC_DRIFT_THRESHOLD = 0.24;
const DRIFT_BLEND_FACTOR = 0.35;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Assign a color to a note based on its position in the chord.
 *  When instruments are not active (default mode), use a single uniform color. */
function getNoteColor(_noteIndex: number, _isBass: boolean): string {
  return DEFAULT_NOTE_COLOR;
}

// Note: Instrument voicing logic is now in @/utils/instrumentNoteGeneration.ts
// (single source of truth for both visualization and audio playback)

// ─── Component ───────────────────────────────────────────────────────────────

export const FallingNotesCanvas: React.FC<FallingNotesCanvasProps> = React.memo(({
  chordEvents,
  currentTime,
  isPlaying,
  startMidi,
  endMidi,
  whiteKeyWidth = DEFAULT_WHITE_KEY_WIDTH,
  lookAheadSeconds = 4,
  lookBehindSeconds = 0.5,
  height = 300,
  activeInstruments = [],
  bpm,
  timeSignature,
  segmentationData,
  guitarVoicing,
  targetKey,
  signalDynamicsSource,
  playbackTime,
  extraVisualNotes = [],
  onActiveNotesChange,
  simpleMode = false,
  colorfulMode = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(currentTime);
  const dprRef = useRef<number>(1);
  // Track previous active notes to avoid redundant state updates
  const prevActiveSignatureRef = useRef<string>('');
  // Stable ref for the render function — avoids restarting the animation loop
  // when data changes (which would cause flickering)
  const renderFrameRef = useRef<((time: number) => void) | null>(null);
  // Smooth playback interpolation: RAF loop interpolates time between the
  // ~4 Hz timeupdate events so notes fall at a steady 60 fps.
  const isPlayingRef = useRef(isPlaying);
  const playbackBaseRef = useRef({ wallTime: 0, audioTime: currentTime });

  // Calculate total width based on white keys
  const totalWidth = useMemo(() => {
    let count = 0;
    for (let m = startMidi; m <= endMidi; m++) {
      if (!isBlackKey(m)) count++;
    }
    return count * whiteKeyWidth;
  }, [startMidi, endMidi, whiteKeyWidth]);

  // Precompute MIDI key position lookup table (O(n) once instead of O(n) per lookup)
  const { midiKeyPositions, whiteKeyXPositions } = useMemo(() => {
    const positions = new Map<number, { x: number; width: number }>();
    const whiteXs: number[] = [];
    const blackKeyWidth = Math.round(whiteKeyWidth * 0.583);

    let whiteCount = 0;
    for (let midi = startMidi; midi <= endMidi; midi++) {
      if (isBlackKey(midi)) {
        const noteIndex = midi % 12;
        const offsets: Record<number, number> = {
          1: -0.35, 3: 0.35, 6: -0.40, 8: 0.0, 10: 0.40,
        };
        const offset = offsets[noteIndex] ?? 0;
        const baseX = whiteCount * whiteKeyWidth - blackKeyWidth / 2;
        const offsetPx = offset * (whiteKeyWidth * 0.3);
        positions.set(midi, { x: baseX + offsetPx, width: blackKeyWidth });
      } else {
        const x = whiteCount * whiteKeyWidth;
        positions.set(midi, { x, width: whiteKeyWidth });
        whiteXs.push(x);
        whiteCount++;
      }
    }

    return { midiKeyPositions: positions, whiteKeyXPositions: whiteXs };
  }, [startMidi, endMidi, whiteKeyWidth]);

  // Check if we have instrument-specific coloring
  const hasInstruments = activeInstruments.length > 0;

  // Merge consecutive same-chord events (audio only plays on chord changes)
  const mergedChordEvents = useMemo(() => {
    return mergeConsecutiveChordEvents(chordEvents);
  }, [chordEvents]);

  // Precompute note positions for default (non-instrument) rendering
  // In simple mode, only show root note (notes[0])
  const eventPositions = useMemo(() => {
    return mergedChordEvents.map(event => {
      const notesToShow = simpleMode ? event.notes.slice(0, 1) : event.notes;
      return {
        ...event,
        notePositions: notesToShow.map((note, idx) => ({
          ...note,
          pos: midiKeyPositions.get(note.midi) ?? null,
          color: colorfulMode ? getChromaticColor(note.midi) : getNoteColor(idx, idx === 0 && note.octave <= 2),
          intervalIndex: idx,
        })),
      };
    });
  }, [mergedChordEvents, midiKeyPositions, simpleMode, colorfulMode]);

  // Phase 1 (cached): Generate base instrument schedules — expensive instrument
  // pattern generation that only recomputes when chord data or instruments change.
  const baseInstrumentSchedule = useMemo(() => {
    if (!hasInstruments || chordEvents.length === 0) return [];
    return generateBaseInstrumentSchedule(
      chordEvents,
      activeInstruments,
      bpm,
      timeSignature,
      segmentationData,
      guitarVoicing,
      targetKey,
      signalDynamicsSource,
    );
  }, [
    chordEvents,
    hasInstruments,
    activeInstruments,
    bpm,
    timeSignature,
    segmentationData,
    guitarVoicing,
    targetKey,
    signalDynamicsSource,
  ]);

  // Phase 2 (cheap, ~4 Hz): Apply playbackTime adjustments and convert to
  // VisualNote[]. Only lightweight filtering — no instrument pattern generation.
  const instrumentVisualTimings = useMemo(() => {
    if (baseInstrumentSchedule.length === 0) return [];
    return resolveInstrumentVisualNotes(baseInstrumentSchedule, playbackTime);
  }, [baseInstrumentSchedule, playbackTime]);

  const instrumentVisualNotes = useMemo(
    () => attachVisualNotePositions(instrumentVisualTimings, midiKeyPositions),
    [instrumentVisualTimings, midiKeyPositions],
  );

  // ─── Render Frame ────────────────────────────────────────────────────────

  const renderFrame = useCallback((time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = dprRef.current;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);

    // Hit line position
    const hitLineY = h * HIT_LINE_Y_RATIO;

    // Time window
    const windowStart = time - lookBehindSeconds;
    const windowEnd = time + lookAheadSeconds;
    const pixelsPerSecond = hitLineY / lookAheadSeconds;

    // Draw subtle grid lines for white keys (precomputed positions)
    ctx.strokeStyle = 'rgba(128, 128, 128, 0.08)';
    ctx.lineWidth = 0.5;
    for (const x of whiteKeyXPositions) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // Draw hit line (subtle glow)
    const hitGradient = ctx.createLinearGradient(0, hitLineY - 2, 0, hitLineY + 2);
    hitGradient.addColorStop(0, 'rgba(96, 165, 250, 0)');
    hitGradient.addColorStop(0.5, 'rgba(96, 165, 250, 0.5)');
    hitGradient.addColorStop(1, 'rgba(96, 165, 250, 0)');
    ctx.fillStyle = hitGradient;
    ctx.fillRect(0, hitLineY - 2, w, 4);

    // Track active notes for keyboard highlighting
    const activeNotes = new Set<number>();
    const activeColors = new Map<number, string>();

    // Phase 4C: Collect active-note rects for a single batched glow pass.
    // Applying shadowBlur per-note is O(n) expensive shadow rasterizations.
    // Batching into one pass reduces it to O(1) per frame.
    type GlowRect = { x: number; y: number; w: number; h: number; color: string };
    const glowRects: GlowRect[] = [];

    // roundRect with fallback for older browsers that lack the method
    const safeRoundRect = (
      c: CanvasRenderingContext2D,
      x: number, y: number, w: number, h: number,
      radii: number | number[],
    ) => {
      if (c.roundRect) {
        c.roundRect(x, y, w, h, radii);
      } else {
        c.rect(x, y, w, h);
      }
    };

    // Helper to draw a single note rectangle (glow batched separately — see below)
    const drawNote = (
      noteX: number, noteW: number, drawTop: number, drawHeight: number,
      noteColor: string, isActive: boolean, opacity: number,
      labelText?: string,
    ) => {
      ctx.globalAlpha = opacity;
      const radius = Math.min(3, drawHeight / 2, noteW / 2);

      ctx.fillStyle = noteColor;
      ctx.beginPath();
      safeRoundRect(ctx, noteX, drawTop, noteW, drawHeight, radius);
      ctx.fill();

      // Highlight on top edge
      if (drawHeight > 6) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.beginPath();
        safeRoundRect(ctx, noteX, drawTop, noteW, Math.min(3, drawHeight * 0.3), [radius, radius, 0, 0]);
        ctx.fill();
      }

      // Label text
      if (labelText && isActive && drawHeight > 14 && noteW > 16) {
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText.substring(0, 4), noteX + noteW / 2, drawTop + drawHeight / 2);
      }

      // Phase 4C: Queue active note for the single batched glow pass below.
      if (isActive) {
        glowRects.push({ x: noteX, y: drawTop, w: noteW, h: drawHeight, color: noteColor });
      }

      ctx.globalAlpha = 1.0;
    };

    // Helper to compute note Y position and opacity
    const computeNoteGeometry = (noteStartTime: number, noteEndTime: number) => {
      const noteTopTime = noteStartTime - time;
      const noteBottomTime = noteEndTime - time;

      const noteTopY = hitLineY - noteTopTime * pixelsPerSecond;
      const noteBottomY = hitLineY - noteBottomTime * pixelsPerSecond;
      const isActive = noteStartTime <= time && noteEndTime > time;
      const anchoredBottomY = isActive ? hitLineY : noteTopY;

      const drawTop = Math.max(noteBottomY, 0);
      const drawBottom = Math.min(anchoredBottomY, h);
      if (drawTop >= h || drawBottom <= 0) return null;
      const drawHeight = drawBottom - drawTop;

      let opacity = 1.0;
      if (!isActive && noteTopTime < -lookBehindSeconds * 0.5) {
        opacity = Math.max(0, 1 + (noteTopTime / lookBehindSeconds));
      } else if (noteTopTime > lookAheadSeconds * 0.8) {
        opacity = Math.max(0.3, 1 - (noteTopTime - lookAheadSeconds * 0.8) / (lookAheadSeconds * 0.2));
      }

      return { drawTop, drawHeight, opacity, isActive };
    };

    if (hasInstruments && !simpleMode) {
      // ─── Instrument-specific rendering ─────────────────────────────────
      for (const note of instrumentVisualNotes) {
        if (!note.pos) continue;
        if (note.endTime < windowStart || note.startTime > windowEnd) continue;

        const geom = computeNoteGeometry(note.startTime, note.endTime);
        if (!geom) continue;

        const { x, width } = note.pos;
        const noteX = x + 1;
        const noteW = width - 2;
        const noteColor = colorfulMode ? getChromaticColor(note.midi) : note.color;

        if (geom.isActive) {
          activeNotes.add(note.midi);
          activeColors.set(note.midi, noteColor);
        }

        drawNote(noteX, noteW, geom.drawTop, geom.drawHeight, noteColor, geom.isActive, geom.opacity);
      }
    } else {
      // ─── Default interval-based coloring ─────────────────────────────────
      for (const event of eventPositions) {
        if (event.endTime < windowStart || event.startTime > windowEnd) continue;

        for (const noteData of event.notePositions) {
          if (!noteData.pos) continue;

          const geom = computeNoteGeometry(event.startTime, event.endTime);
          if (!geom) continue;

          const { x, width } = noteData.pos;
          const noteX = x + 1;
          const noteW = width - 2;

          if (geom.isActive) {
            activeNotes.add(noteData.midi);
            activeColors.set(noteData.midi, noteData.color);
          }

          const label = noteData.intervalIndex === 0 ? event.chordName : undefined;
          drawNote(noteX, noteW, geom.drawTop, geom.drawHeight, noteData.color, geom.isActive, geom.opacity, label);
        }
      }
    }

    for (const note of extraVisualNotes) {
      const pos = midiKeyPositions.get(note.midi);
      if (!pos) continue;
      if (note.endTime < windowStart || note.startTime > windowEnd) continue;

      const geom = computeNoteGeometry(note.startTime, note.endTime);
      if (!geom) continue;

      const noteX = pos.x + 1;
      const noteW = pos.width - 2;

      if (geom.isActive) {
        activeNotes.add(note.midi);
        activeColors.set(note.midi, note.color);
      }

      drawNote(noteX, noteW, geom.drawTop, geom.drawHeight, note.color, geom.isActive, geom.opacity, note.labelText);
    }

    // Phase 4C: Batched glow pass — one shadowBlur context state for ALL active notes.
    // Groups by color to minimize context switches; composites with 'lighter' for additive glow.
    if (glowRects.length > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowBlur = 12;
      ctx.globalAlpha = 0.55;
      // Group by color to minimize shadowColor changes
      const byColor = new Map<string, GlowRect[]>();
      for (const r of glowRects) {
        const list = byColor.get(r.color);
        if (list) list.push(r); else byColor.set(r.color, [r]);
      }
      for (const [color, rects] of byColor) {
        ctx.shadowColor = color;
        ctx.fillStyle = color;
        for (const r of rects) {
          ctx.beginPath();
          ctx.rect(r.x, r.y, r.w, r.h);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    ctx.restore();

    // Only notify parent when active notes actually changed (prevents excessive re-renders)
    const activeSignature = [...activeNotes]
      .sort((a, b) => a - b)
      .map(note => `${note}:${activeColors.get(note) ?? ''}`)
      .join('|');
    if (activeSignature !== prevActiveSignatureRef.current) {
      prevActiveSignatureRef.current = activeSignature;
      onActiveNotesChange?.(activeNotes, activeColors);
    }
  }, [eventPositions, extraVisualNotes, instrumentVisualNotes, midiKeyPositions, whiteKeyXPositions, lookAheadSeconds, lookBehindSeconds, onActiveNotesChange, hasInstruments, colorfulMode]);

  // Keep renderFrameRef in sync with the latest renderFrame callback.
  useEffect(() => {
    renderFrameRef.current = renderFrame;
  }, [renderFrame]);

  // Re-render when data changes (instrument toggles, chord events, etc.)
  // without touching the animation loop.
  useEffect(() => {
    if (!isPlayingRef.current) {
      // Paused — render immediately so the user sees updated visuals.
      renderFrameRef.current?.(lastTimeRef.current);
    }
    // During playback the RAF loop will pick up changes on the next frame
    // automatically because it reads renderFrameRef.current.
  }, [renderFrame]);

  // ─── Sync base time when currentTime changes from parent ─────────────────
  // The browser fires timeupdate at ~4 Hz.  We do NOT restart the RAF loop
  // here — we just update the interpolation anchor so the running loop
  // smoothly catches up.

  useEffect(() => {
    lastTimeRef.current = currentTime;
    if (isPlayingRef.current) {
      const now = performance.now();
      const projectedTime = playbackBaseRef.current.audioTime + (now - playbackBaseRef.current.wallTime) / 1000;
      const drift = currentTime - projectedTime;

      if (Math.abs(drift) >= SOFT_SYNC_DRIFT_THRESHOLD) {
        const correctedTime = Math.abs(drift) >= HARD_SYNC_DRIFT_THRESHOLD
          ? currentTime
          : projectedTime + drift * DRIFT_BLEND_FACTOR;

        playbackBaseRef.current = {
          wallTime: now,
          audioTime: correctedTime,
        };
        lastTimeRef.current = correctedTime;
      }
    } else {
      playbackBaseRef.current = {
        wallTime: performance.now(),
        audioTime: currentTime,
      };
    }

    // When paused (seeking), render the new position immediately.
    if (!isPlayingRef.current) {
      renderFrameRef.current?.(currentTime);
    }
  }, [currentTime]);

  // ─── Animation Loop ──────────────────────────────────────────────────────
  // Starts / stops ONLY when `isPlaying` toggles.
  // During playback the loop interpolates time at 60 fps using
  // performance.now() so notes fall smoothly between the ~4 Hz
  // timeupdate events from the <audio> element.

  useEffect(() => {
    isPlayingRef.current = isPlaying;

    if (isPlaying) {
      // Anchor interpolation from current known position.
      playbackBaseRef.current = {
        wallTime: performance.now(),
        audioTime: lastTimeRef.current,
      };

      const animate = () => {
        const { wallTime, audioTime } = playbackBaseRef.current;
        const elapsed = (performance.now() - wallTime) / 1000;
        const displayTime = audioTime + elapsed;
        lastTimeRef.current = displayTime;
        renderFrameRef.current?.(displayTime);
        animFrameRef.current = requestAnimationFrame(animate);
      };

      animFrameRef.current = requestAnimationFrame(animate);
    } else {
      // Stopped — render one final frame at the exact current time.
      renderFrameRef.current?.(lastTimeRef.current);
    }

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = 0;
      }
    };
  }, [isPlaying]);

  // ─── Canvas Sizing ───────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    dprRef.current = dpr;

    canvas.width = totalWidth * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${totalWidth}px`;
    canvas.style.height = `${height}px`;

    // Render with latest known time after resize
    renderFrameRef.current?.(lastTimeRef.current);
  }, [totalWidth, height]);

  return (
    <canvas
      ref={canvasRef}
      className="block"
      style={{ width: totalWidth, height }}
      role="img"
      aria-label="Falling notes piano roll visualization"
    />
  );
});

FallingNotesCanvas.displayName = 'FallingNotesCanvas';

export default FallingNotesCanvas;
