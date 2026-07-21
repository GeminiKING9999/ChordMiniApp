import { NextRequest, NextResponse } from 'next/server';
import { detectEnvironment } from '@/utils/environmentDetection';

/**
 * Audio Extraction API Route
 *
 * - Local development: yt-dlp on the machine
 * - Production: prefer Cloud Run Python /api/extract-audio (current yt-dlp).
 *   Client code usually calls Cloud Run directly via getDirectPythonUrl() so
 *   Netlify does not hit function timeouts. This route still proxies for
 *   server-side callers and caches.
 *
 * Legacy fallback: yt-mp3-go async job (often outdated / SABR failures).
 */

// Allow long proxy when platform supports it (Cloud Run path can take minutes)
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const {
      videoId,
      forceRedownload = false,
      getInfoOnly = false,
      originalTitle,
      videoMetadata
    } = data;

    if (!videoId) {
      return NextResponse.json(
        { error: 'Missing videoId parameter' },
        { status: 400 }
      );
    }

    console.log(`🎵 Audio extraction request: ${videoId}${originalTitle ? ` ("${originalTitle}")` : ''}`);

    // If getInfoOnly is true, just return basic video info
    if (getInfoOnly) {
      return NextResponse.json({
        success: true,
        title: originalTitle || `YouTube Video ${videoId}`,
        duration: 0,
        videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`
      });
    }

    const env = detectEnvironment();

    // === LOCAL DEVELOPMENT: Use synchronous yt-dlp (no timeout constraints) ===
    if (env.strategy === 'ytdlp' && (env.isDevelopment || process.env.NEXT_PUBLIC_AUDIO_STRATEGY === 'ytdlp')) {
      const { audioExtractionServiceSimplified } = await import('@/services/audio/audioExtractionSimplified');
      const meta = videoMetadata || {
        id: videoId,
        title: originalTitle || 'YouTube Video',
        thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        channelTitle: 'Unknown Channel'
      };

      const result = await audioExtractionServiceSimplified.extractAudio(meta, forceRedownload);

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error || 'Audio extraction failed' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        audioUrl: result.audioUrl,
        title: result.title,
        duration: result.duration,
        youtubeEmbedUrl: `https://www.youtube.com/embed/${videoId}`,
        fromCache: result.fromCache,
        isStreamUrl: result.isStreamUrl,
        streamExpiresAt: result.streamExpiresAt,
        method: 'yt-dlp'
      });
    }

    // === PRODUCTION: Firebase cache, then Cloud Run yt-dlp, then yt-mp3-go job ===

    // Step 1: Check Firebase cache (fast path)
    if (!forceRedownload) {
      try {
        const { ensureFirebaseInitialized } = await import('@/config/firebase');
        await ensureFirebaseInitialized();
      } catch (initError) {
        console.warn('⚠️ Firebase initialization failed, skipping cache check:', initError);
      }

      // Check Firebase Storage for permanent audio files
      try {
        const { findExistingAudioFile } = await import('@/services/firebase/firebaseStorageService');
        const existingFile = await findExistingAudioFile(videoId);

        if (existingFile) {
          console.log(`✅ Firebase Storage cache hit for ${videoId}`);
          return NextResponse.json({
            success: true,
            audioUrl: existingFile.audioUrl,
            title: originalTitle || `YouTube Video ${videoId}`,
            duration: 0,
            youtubeEmbedUrl: `https://www.youtube.com/embed/${videoId}`,
            fromCache: true,
            isStreamUrl: false,
            method: 'firebase-cache'
          });
        }
      } catch (storageError) {
        console.warn('⚠️ Firebase Storage check failed:', storageError);
      }

      // Check Firestore metadata cache
      try {
        const { firebaseStorageSimplified } = await import('@/services/firebase/firebaseStorageSimplified');
        const cached = await firebaseStorageSimplified.getCachedAudioMetadata(videoId);

        if (cached) {
          console.log(`✅ Firestore cache hit for ${videoId}`);
          return NextResponse.json({
            success: true,
            audioUrl: cached.audioUrl,
            title: cached.title,
            duration: cached.duration,
            youtubeEmbedUrl: `https://www.youtube.com/embed/${videoId}`,
            fromCache: true,
            isStreamUrl: cached.isStreamUrl,
            streamExpiresAt: cached.streamExpiresAt,
            method: 'firestore-cache'
          });
        }
      } catch (cacheError) {
        console.warn('⚠️ Firestore cache check failed:', cacheError);
      }
    }

    // Step 2: Cloud Run yt-dlp (preferred production extractor)
    try {
      const { getPythonApiUrl } = await import('@/config/serverBackend');
      const { createSafeTimeoutSignal } = await import('@/utils/environmentUtils');
      const backendUrl = getPythonApiUrl();

      if (backendUrl && !backendUrl.includes('localhost') && !backendUrl.includes('127.0.0.1')) {
        console.log(`🚀 Proxying extract to Cloud Run yt-dlp: ${backendUrl}`);
        const backendResponse = await fetch(`${backendUrl}/api/extract-audio`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoId,
            originalTitle,
            videoMetadata,
            forceRefresh: forceRedownload,
          }),
          signal: createSafeTimeoutSignal(280000),
        });

        const backendData = await backendResponse.json().catch(() => ({}));
        if (backendResponse.ok && backendData.success && backendData.audioUrl) {
          return NextResponse.json({
            ...backendData,
            youtubeEmbedUrl: `https://www.youtube.com/embed/${videoId}`,
          });
        }
        console.warn('⚠️ Cloud Run extract failed, falling back to yt-mp3-go:', backendData?.error || backendResponse.status);
      }
    } catch (cloudRunError) {
      console.warn('⚠️ Cloud Run extract error, falling back to yt-mp3-go:', cloudRunError);
    }

    // Step 3: Legacy yt-mp3-go async job (often outdated)
    console.log(`🚀 Creating yt-mp3-go async extraction job for ${videoId}...`);

    const { ytMp3GoService } = await import('@/services/youtube/ytMp3GoService');
    const jobResult = await ytMp3GoService.createJobOnly(videoId, originalTitle, 'medium');

    if (!jobResult.success || !jobResult.jobId) {
      console.error(`❌ Failed to create extraction job for ${videoId}:`, jobResult.error);
      return NextResponse.json(
        {
          success: false,
          error: jobResult.error || 'Failed to create extraction job',
          suggestion: 'The video may be restricted, or upload an audio file instead. YouTube extractors break when outdated.'
        },
        { status: 500 }
      );
    }

    console.log(`✅ Job created: ${jobResult.jobId} for ${videoId}`);

    return NextResponse.json({
      success: true,
      status: 'processing',
      jobId: jobResult.jobId,
      videoId,
      title: originalTitle || `YouTube Video ${videoId}`,
      youtubeEmbedUrl: `https://www.youtube.com/embed/${videoId}`,
      message: 'Audio extraction job created. Poll /api/extract-audio/status for completion.'
    });

  } catch (error: unknown) {
    console.error('Error in audio extraction:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        error: 'Failed to extract audio from YouTube',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
