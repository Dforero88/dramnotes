/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Disable Next image optimizer endpoint (_next/image) to reduce DoS exposure on self-hosting.
    unoptimized: true,
    domains: [],
  },
  experimental: {
    workerThreads: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  
}

const { withSentryConfig } = require('@sentry/nextjs')

module.exports = withSentryConfig(nextConfig, {
  silent: true,
})
