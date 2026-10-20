/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static files only: deployed to Cloudflare Pages, inference runs in the browser.
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;
