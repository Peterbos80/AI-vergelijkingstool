/**
 * SSRF guard: only public unicast addresses may be fetched. Checked on the
 * resolved IPs of every redirect hop (docs/strategy/08 §8).
 */
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, o) => (acc << 8) + Number(o), 0) >>> 0;
}

const V4_BLOCKED: [string, number][] = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10], // CGNAT
  ['127.0.0.0', 8],
  ['169.254.0.0', 16], // link-local incl. cloud metadata 169.254.169.254
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved + broadcast
];

export function isBlockedIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const n = ipv4ToInt(ip);
    return V4_BLOCKED.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
      return (n & mask) === (ipv4ToInt(base) & mask);
    });
  }
  if (v === 6) {
    const x = ip.toLowerCase();
    if (x === '::' || x === '::1') return true;
    if (x.startsWith('::ffff:')) return isBlockedIp(x.slice(7));
    if (/^f[cd]/.test(x)) return true; // unique local fc00::/7
    if (/^fe[89ab]/.test(x)) return true; // link-local fe80::/10
    if (/^ff/.test(x)) return true; // multicast
    if (x.startsWith('2001:db8')) return true; // documentation
    if (x.startsWith('64:ff9b')) return true; // NAT64 (could map to private v4)
    return false;
  }
  return true;
}

export function checkUrlShape(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (u.username || u.password) return null;
  if (u.port && u.port !== '80' && u.port !== '443') return null;
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return null;
  return u;
}

export type Resolver = (host: string) => Promise<string[]>;

export const dnsResolver: Resolver = async (host) => {
  if (isIP(host)) return [host];
  const res = await lookup(host, { all: true, verbatim: true });
  return res.map((r) => r.address);
};

/** Throws when the host resolves to any blocked address. */
export async function assertPublicHost(host: string, resolve: Resolver = dnsResolver): Promise<void> {
  const clean = host.replace(/^\[|\]$/g, '');
  const ips = await resolve(clean);
  if (ips.length === 0) throw new Error('no addresses');
  const bad = ips.find(isBlockedIp);
  if (bad) throw new Error(`blocked address ${bad}`);
}
