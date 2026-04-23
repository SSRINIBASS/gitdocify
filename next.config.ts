import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "bullmq", "ioredis", "simple-git", "bcryptjs"],
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
    //@ts-ignore - Next.js 16/experimental setting
    turbopack: {
      root: ".",
    },
  },
};

export default nextConfig;
