// Static export: generated once at build time.
export const dynamic = 'force-static';

const SITE = process.env.SITE_URL || 'https://kinthread.pages.dev';

export default function robots() {
  return { rules: { userAgent: '*', allow: '/' }, sitemap: `${SITE}/sitemap.xml` };
}
