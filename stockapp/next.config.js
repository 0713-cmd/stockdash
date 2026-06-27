/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    FINNHUB_KEY: process.env.FINNHUB_KEY,
    FRED_KEY: process.env.FRED_KEY,
  },
}
module.exports = nextConfig
