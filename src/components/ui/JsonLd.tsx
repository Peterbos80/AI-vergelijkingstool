import { headers } from 'next/headers';

/** Structured data with the request's CSP nonce. `<` is escaped to prevent script breakout. */
export async function JsonLd({ data }: { data: unknown }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: json }} />;
}
