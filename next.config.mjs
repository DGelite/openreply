/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: false,
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "*.cdninstagram.com" },
      { protocol: "https", hostname: "*.fbcdn.net" },
      { protocol: "https", hostname: "scontent*.cdninstagram.com" },
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    cpus: 1,
    workerThreads: false,
  },
  serverExternalPackages: ["mariadb", "@prisma/client", "@prisma/adapter-mariadb"],
};

export default nextConfig;

