/**
 * Self-hosted fonts (OFL): no requests to third parties (privacy by default).
 * next/font/local adds preloading and metric-adjusted fallbacks (no CLS).
 */
import localFont from 'next/font/local';

export const grotesk = localFont({
  src: [
    { path: './fonts/schibsted-grotesk-latin-wght-normal.woff2', weight: '400 900', style: 'normal' },
    { path: './fonts/schibsted-grotesk-latin-ext-wght-normal.woff2', weight: '400 900', style: 'normal' },
  ],
  variable: '--font-grotesk',
  display: 'swap',
  fallback: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
});

export const plexMono = localFont({
  src: [
    { path: './fonts/ibm-plex-mono-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/ibm-plex-mono-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/ibm-plex-mono-latin-600-normal.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-plex-mono',
  display: 'swap',
  preload: false,
  fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
});
