/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use a custom build directory to avoid ".next" permission/lock issues on Windows
  distDir: '.next_build',
  experimental: {
    serverActions: {
      allowedOrigins: []
    }
  }
};

export default nextConfig;
