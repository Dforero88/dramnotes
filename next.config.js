/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === 'development'

const nextConfig = {
  reactStrictMode: !isDev,
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
  webpack: (config, { dev }) => {
    if (dev) {
      config.resolve = config.resolve || {}
      config.resolve.alias = config.resolve.alias || {}
      config.resolve.alias['@sentry/nextjs'] = require('path').resolve(__dirname, 'lib/sentry-noop.ts')
    }
    return config
  },
  
}

const { withSentryConfig } = require('@sentry/nextjs')

module.exports = isDev
  ? nextConfig
  : withSentryConfig(nextConfig, {
      silent: true,
    })
