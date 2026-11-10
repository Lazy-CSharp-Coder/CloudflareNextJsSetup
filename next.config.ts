import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // --- Your existing config goes here ---
  // Keep any settings you already have (experimental flags, redirects, etc.)

  // If you use next/image with remote images from Sanity CDN:
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.sanity.io",
      },
    ],
  },
};

export default nextConfig;
