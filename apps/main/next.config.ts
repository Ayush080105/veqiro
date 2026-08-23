import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL ?? "http://localhost:5000";
    return [
      {
        source: "/api/:version/auth/:path*",
        destination: `${backendUrl}/api/:version/auth/:path*`,
      },
    ];
  },
  // Tree-shake heavy packages that aren't optimized by Next.js by default.
  // (lucide-react, date-fns, recharts are already on the default list.)
  experimental: {
    optimizePackageImports: [
      "radix-ui",
      "@base-ui/react",
      "react-markdown",
      "remark-gfm",
    ],
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "**.cloudflarestorage.com" },
      { protocol: "https", hostname: "**.googleusercontent.com" },
      { protocol: "https", hostname: "**.veqiro.com" },
    ],
  },
};

export default nextConfig;
