/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.OUTPUT_EXPORT === 'true' ? 'export' : undefined,
  images: { unoptimized: true },
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://saas-learning-exit-exam-platform.onrender.com/api/v1',
  },
};

export default nextConfig;
