import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@qiro/ui', '@qiro/types'],
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
}

export default nextConfig
