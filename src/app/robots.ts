import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/go/', '/api/', '/admin', '/*/match', '/*/stack/', '/*/my-stack', '/*/newsletter/confirm', '/*/newsletter/unsubscribe'],
      },
    ],
    sitemap: siteUrl('/sitemap.xml'),
  };
}
