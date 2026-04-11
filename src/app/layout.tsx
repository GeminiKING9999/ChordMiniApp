import type { Metadata } from 'next';
import { DM_Sans, Roboto_Mono, Varela_Round } from 'next/font/google';
import './globals.css';
import '../styles/analysis-embedded.css';
import '../styles/chord-grid.css';
import { Providers } from './providers';
import ClientErrorBoundary from '@/components/common/ClientErrorBoundary';
import FirebaseInitializer from '@/components/layout/FirebaseInitializer';
import ServiceWorkerRegistration from '@/components/layout/ServiceWorkerRegistration';
import Footer from '@/components/common/Footer';
import PerformanceMonitor from '@/components/layout/PerformanceMonitor';
import CriticalPerformanceOptimizer from '@/components/layout/CriticalPerformanceOptimizer';
import DesktopPerformanceOptimizer from '@/components/layout/DesktopPerformanceOptimizer';
import CriticalCSS from '@/components/layout/CriticalCSS';
import CorsErrorSuppression from '@/components/layout/CorsErrorSuppression';
import DevIndicatorHider from '@/components/layout/DevIndicatorHider';
import { getFrontendBaseUrl } from '@/config/serverBackend';

// Configure Google Fonts
const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  variable: '--font-roboto-mono',
  display: 'swap',
});

// Reference-inspired primary sans (closest supported match to Google Sans)
const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-brand-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

// Previous chord-label font family used across beat grids, guitar chord labels, and lyrics chords
const varelaRound = Varela_Round({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-varela-round',
  display: 'swap',
});



// Define metadata for the application
export const metadata: Metadata = {
  metadataBase: new URL(getFrontendBaseUrl()),
  title: {
    default: 'Chord Reaper - AI-Powered Music Analysis',
    template: '%s | Chord Reaper'
  },
  description: 'Advanced music analysis platform with AI-powered chord recognition, beat detection, and synchronized lyrics. Analyze YouTube videos and audio files to discover chord progressions, beats, and musical structure.',
  keywords: [
    'chord recognition',
    'music analysis',
    'beat detection',
    'chord progression',
    'music theory',
    'audio analysis',
    'YouTube music',
    'chord charts',
    'music AI',
    'song analysis',
    'chord detection',
    'music transcription'
  ],
  authors: [
    {
      name: 'Eclectic Emporium',
      url: 'https://eclecticemporium.store'
    }
  ],
  creator: 'Eclectic Emporium',
  publisher: 'Eclectic Emporium',
  category: 'Music Technology',
  classification: 'Music Technology',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48', type: 'image/x-icon' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-48x48.png', sizes: '48x48', type: 'image/png' },
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' }
    ],
    shortcut: '/favicon.ico',
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
    ],
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://eclecticemporium.store',
    siteName: 'Chord Reaper',
    title: 'Chord Reaper - AI-Powered Music Analysis',
    description: 'Advanced music analysis platform with AI-powered chord recognition, beat detection, and synchronized lyrics.',
    images: [
      {
        url: '/chord-reaper-mark.webp',
        width: 1200,
        height: 630,
        alt: 'Chord Reaper - AI Music Analysis Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Chord Reaper - AI-Powered Music Analysis',
    description: 'Advanced music analysis platform with AI-powered chord recognition, beat detection, and synchronized lyrics.',
    images: ['/chord-reaper-mark.webp'],
  },
  verification: {
    google: 'google-site-verification-code', // To be replaced with actual verification code
  },
  alternates: {
    canonical: 'https://eclecticemporium.store',
  },
};

// Root layout component that wraps all pages
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${robotoMono.variable} ${dmSans.variable} ${varelaRound.variable}`} suppressHydrationWarning>
      <head>
        {/* Blocking script: apply dark class BEFORE first paint to prevent theme flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'){document.documentElement.classList.add('dark')}}catch(e){}if(document.body){document.body.classList.add('theme-ready')}else{document.addEventListener('DOMContentLoaded',function(){document.body.classList.add('theme-ready')},{once:true})}})()`
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var noisyLog=/^\\[Fast Refresh\\]|^\\[HMR\\]\\s+connected|^\\[BEAT_DRIFT_DEBUG\\]|Found existing audio file in Firebase Storage/;var noisyErr=/firestore\\.googleapis\\.com\\/google\\.firestore\\.v1\\.Firestore\\/Listen\\/channel|Fetch API cannot load .*Listen\\/channel.*access control checks/i;var ol=console.log,ow=console.warn,oe=console.error;console.log=function(){var s=Array.prototype.join.call(arguments,' ');if(noisyLog.test(s))return;ol.apply(console,arguments)};console.warn=function(){var s=Array.prototype.join.call(arguments,' ');if(noisyErr.test(s))return;ow.apply(console,arguments)};console.error=function(){var s=Array.prototype.join.call(arguments,' ');if(noisyErr.test(s))return;oe.apply(console,arguments)}}catch(e){}})()`
          }}
        />
        {/* Critical CSS inlined for performance - eliminates render blocking */}
        <style dangerouslySetInnerHTML={{
          __html: `
            /* Critical above-the-fold styles */
            html { font-family: var(--font-brand-sans), ui-sans-serif, system-ui, sans-serif; }
            body { margin: 0; padding: 0; background: #f8fafc; visibility: hidden; }
            body.theme-ready { visibility: visible; }
            .dark body { background: #1e252e; }
            /* Fallback: ensure page is visible if JS fails or takes too long */
            @media (scripting: none) { body { visibility: visible; } }
            .hero-container { min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; }
            .critical-layout { contain: layout style paint; will-change: auto; transform: translateZ(0); }
            /* Prevent layout shifts */
            img[data-lcp-image] { width: 100%; height: auto; object-fit: cover; }
            /* Font display optimization */
            @font-face { font-display: swap; }
            /* Navigation critical styles */
            nav { position: sticky; top: 0; z-index: 50; background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); }
            .dark nav { background: rgba(30, 37, 46, 0.95); }
            /* Hero section optimization */
            .hero-section { min-height: calc(100vh - 80px); display: flex; align-items: start; justify-content: center; }
            /* Button base styles */
            button { cursor: pointer; transition: all 0.2s ease; }
            /* Image optimization */
            img { max-width: 100%; height: auto; }
          `
        }} />

        <meta name="description" content="Recognize chords from audio using AI" />

        {/* Favicon configuration for better browser compatibility */}
        <link rel="icon" href="/favicon.ico" sizes="48x48" />
        <link rel="icon" href="/favicon-32x32.png" type="image/png" sizes="32x32" />
        <link rel="icon" href="/favicon-16x16.png" type="image/png" sizes="16x16" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
        <link rel="manifest" href="/site.webmanifest" />

        {/* Removed global image preloads: let Next/Image with priority handle above-the-fold assets on the pages that use them to avoid preload-not-used warnings. */}

        {/* DNS prefetch for external services */}
        <link rel="dns-prefetch" href="//youtube.com" />
        <link rel="dns-prefetch" href="//googleapis.com" />
        <link rel="dns-prefetch" href="//vercel.app" />

        {/* Critical CSS for above-the-fold content */}
        <CriticalCSS />
      </head>
      <body className="font-sans min-h-screen flex flex-col" suppressHydrationWarning>
        <Providers>
          <ClientErrorBoundary>
            <CriticalPerformanceOptimizer />
            <DesktopPerformanceOptimizer />
            <ServiceWorkerRegistration />
            <FirebaseInitializer />
            {process.env.NODE_ENV === 'development' ? <PerformanceMonitor /> : null}
            <CorsErrorSuppression />
            {process.env.NODE_ENV === 'development' ? <DevIndicatorHider /> : null}
            <main className="flex-1">
              {children}
            </main>
            <Footer />
          </ClientErrorBoundary>
        </Providers>
      </body>
    </html>
  );
}
