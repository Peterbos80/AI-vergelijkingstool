/** Shared validators for identifiers that end up in outbound API URLs. */

/** GitHub "owner/repo": owner 1–39 alphanumerics/hyphens (no leading hyphen); repo not "." or "..". */
export const GITHUB_REPO = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/(?!\.{1,2}$)[A-Za-z0-9._-]{1,100}$/;

/** YouTube channel id: "UC" + 22 URL-safe characters. */
export const YOUTUBE_CHANNEL = /^UC[\w-]{22}$/;

export const isGithubRepo = (v: string | null | undefined): v is string => typeof v === 'string' && GITHUB_REPO.test(v);
export const isYoutubeChannel = (v: string | null | undefined): v is string => typeof v === 'string' && YOUTUBE_CHANNEL.test(v);
