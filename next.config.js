/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [],
  },
  output: 'standalone',
  swcMinify: false,
  experimental: {
    workerThreads: false,
  },
}

module.exports = nextConfig
