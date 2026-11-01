import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Crests are served from football-data.org. We render them unoptimized so the
  // Hobby plan's image-optimization quota is never consumed.
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "crests.football-data.org" },
      { protocol: "https", hostname: "crests.football-data.org", pathname: "/**" },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
