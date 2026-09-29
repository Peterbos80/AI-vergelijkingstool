/**
 * Letter monogram with a colour derived from the name. We do not hotlink or
 * reproduce vendor logos (docs/strategy/10 §3).
 */
function hue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

export function ToolMonogram({ name, size = 40 }: { name: string; size?: number }) {
  const letters = name
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  const h = hue(name);
  return (
    <span
      aria-hidden="true"
      className="monogram"
      style={{ width: size, height: size, fontSize: size * 0.38, ['--h' as string]: String(h) }}
    >
      {letters || '?'}
    </span>
  );
}
