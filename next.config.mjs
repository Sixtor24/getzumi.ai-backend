/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    experimental: {
        serverComponentsExternalPackages: ['undici', 'fluent-ffmpeg', '@ffmpeg-installer/ffmpeg'],
    },
    webpack: (config) => {
        config.externals.push({
            'fluent-ffmpeg': 'commonjs fluent-ffmpeg',
            '@ffmpeg-installer/ffmpeg': 'commonjs @ffmpeg-installer/ffmpeg',
        });
        return config;
    },
};

export default nextConfig;
