import { useEffect, useRef } from 'react';

/**
 * Fires a background Firebase cache warm-up as soon as a videoId is present.
 * By the time the user triggers analysis, the cache result is already known.
 */
export function useCachePrefetch(
  videoId: string | undefined,
  beatModel = 'madmom',
  chordModel = 'chord-cnn-lstm',
): void {
  const prefetchedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!videoId || prefetchedRef.current === videoId) return;
    prefetchedRef.current = videoId;

    import('@/services/cache/smartFirebaseCache').then((mod) => {
      void mod.prefetchCache(videoId, beatModel, chordModel);
    }).catch(() => {
      // Best-effort — do not block the page
    });
  }, [videoId, beatModel, chordModel]);
}
