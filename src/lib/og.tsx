/**
 * Open Graph "receipts": 1200×630 share images rendered with next/og from
 * catalog data. Self-hosted fonts (OFL), no third-party requests. Colours
 * mirror the design tokens (light theme).
 */
import { readFile } from 'node:fs/promises';
import { ImageResponse } from 'next/og';
import type { ReactNode } from 'react';

export const OG_SIZE = { width: 1200, height: 630 };

const C = {
  paper: '#f7f5f0',
  card: '#ffffff',
  ink: '#121212',
  ink2: '#3d3d3a',
  ink3: '#66655f',
  line: '#dedad0',
  signal: '#d9401f',
  verified: '#1e7f4f',
  supported: '#2456c8',
  community: '#9a5b00',
  unverified: '#66655f',
};

export const STATUS_COLOR: Record<string, string> = { verified: C.verified, supported: C.supported, community: C.community, unverified: C.unverified };

let fonts: Promise<{ name: string; data: Buffer; weight: 400 | 700; style: 'normal' }[]> | null = null;
function loadFonts() {
  fonts ??= Promise.all([
    readFile(new URL('../app/fonts/og/schibsted-grotesk-latin-400-normal.woff', import.meta.url)),
    readFile(new URL('../app/fonts/og/schibsted-grotesk-latin-700-normal.woff', import.meta.url)),
    readFile(new URL('../app/fonts/og/ibm-plex-mono-latin-400-normal.woff', import.meta.url)),
  ]).then(([regular, bold, mono]) => [
    { name: 'Grotesk', data: regular, weight: 400 as const, style: 'normal' as const },
    { name: 'Grotesk', data: bold, weight: 700 as const, style: 'normal' as const },
    { name: 'Mono', data: mono, weight: 400 as const, style: 'normal' as const },
  ]);
  return fonts;
}

function Dial() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10.5" fill="none" stroke={C.ink} strokeWidth="2" />
      <path d="M12 1.5 A10.5 10.5 0 0 1 21.1 6.75" fill="none" stroke={C.signal} strokeWidth="2.5" />
      <line x1="12" y1="12" x2="16.5" y2="7.5" stroke={C.ink} strokeWidth="2.25" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1.75" fill={C.ink} />
    </svg>
  );
}

export function Stamp({ label, status }: { label: string; status: string }) {
  const color = STATUS_COLOR[status] ?? C.ink3;
  return (
    <div style={{ display: 'flex', border: `3px solid ${color}`, color, borderRadius: 8, padding: '6px 14px', fontFamily: 'Mono', fontSize: 22, letterSpacing: 2, textTransform: 'uppercase' }}>
      {label}
    </div>
  );
}

export function Frame({ siteName, eyebrow, children, footer }: { siteName: string; eyebrow: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: C.paper, padding: '56px 64px', fontFamily: 'Grotesk', color: C.ink }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Dial />
        <div style={{ display: 'flex', fontSize: 30, fontWeight: 700 }}>{siteName}</div>
        <div style={{ display: 'flex', marginLeft: 'auto', fontFamily: 'Mono', fontSize: 20, color: C.ink3, letterSpacing: 2, textTransform: 'uppercase' }}>{eyebrow}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center' }}>{children}</div>
      {footer && <div style={{ display: 'flex', alignItems: 'center', gap: 20, borderTop: `2px dashed ${C.line}`, paddingTop: 22, fontSize: 24, color: C.ink2 }}>{footer}</div>}
    </div>
  );
}

export const og = { colors: C };

export async function renderOg(node: ReactNode): Promise<ImageResponse> {
  return new ImageResponse(node as React.ReactElement, {
    ...OG_SIZE,
    fonts: await loadFonts(),
    headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800' },
  });
}

/** Clip text to a length that fits the layout (satori does not ellipsize multi-line text). */
export function clipText(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).replace(/\s+\S*$/, '')}…`;
}
