// Static export: generated once at build time. Trailing slashes match next.config (no redirect hop).
export const dynamic = 'force-static';

const SITE = process.env.SITE_URL || 'https://kinthread.pages.dev';

export default function sitemap() {
  return ['/', '/how-it-works/', '/limits/', '/build-log/'].map((path) => ({ url: `${SITE}${path}` }));
}
