/** @type {import('next').NextConfig} */
const nextConfig = {
    // Static export for production (Electron loads file:// paths)
    output: process.env.NODE_ENV === 'production' ? 'export' : undefined,
    trailingSlash: true,
    images: {
        unoptimized: true,
    },
    reactStrictMode: true,
};

export default nextConfig;
