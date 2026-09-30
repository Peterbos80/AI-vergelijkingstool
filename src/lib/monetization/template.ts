/**
 * Affiliate link templates: pure helpers shared by the /go redirect, the
 * admin, the dataset sync (data/affiliates.json) and the link-check agent.
 */

/** Sub-id used when the monetization agent follows a link, so a network that counts it can filter it. */
export const LINKCHECK_SUB_ID = 'linkcheck';

/**
 * Build the outbound URL. `{click_id}` in the template is replaced by the
 * click id (the affiliate sub-id) so conversions can be attributed to pages.
 */
export function buildAffiliateUrl(template: string, clickId: string): string {
  return template.replaceAll('{click_id}', encodeURIComponent(clickId));
}

/** Static checks on a link template before any request is made. */
export function validateTemplate(template: string): string | null {
  const url = buildAffiliateUrl(template, LINKCHECK_SUB_ID);
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return 'invalid_url';
  }
  if (u.protocol !== 'https:') return 'not_https';
  if (u.username || u.password) return 'credentials_in_url';
  if (!u.hostname.includes('.')) return 'invalid_host';
  return null;
}
