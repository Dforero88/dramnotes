/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: false,
  images: {
    domains: [],
  },
  experimental: {
    workerThreads: false,
  },
  
}

module.exports = nextConfig
