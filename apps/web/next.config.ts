import type { NextConfig } from 'next'

// The API lives on another site (Render). Browsers won't send its httpOnly refresh
// cookie cross-site, so sessions died on every reload. Proxying /api/v1 through this
// app makes the API same-origin: the cookie is first-party and sessions survive.
const API_PROXY_TARGET = process.env['API_PROXY_TARGET'] || 'http://localhost:4000'

// Rewrites are fixed at build time. On Vercel, a missing target would silently proxy to
// localhost (every API call 404s with DNS_HOSTNAME_RESOLVED_PRIVATE) — fail the build instead.
if (process.env['VERCEL'] && !process.env['API_PROXY_TARGET']) {
  throw new Error('API_PROXY_TARGET is not set — add it in Vercel → Settings → Environment Variables (e.g. https://qiro-sport.onrender.com), then redeploy')
}

const nextConfig: NextConfig = {
  transpilePackages: ['@qiro/ui', '@qiro/types'],
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${API_PROXY_TARGET}/api/v1/:path*` }]
  },
}


export default nextConfig
