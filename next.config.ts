import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Needed to reach the dev server from the LAN address used for phone testing.
  allowedDevOrigins: ["10.0.33.28"],
  images: {
    // The landing carousel and OpenGraph art come from /public and from
    // remote sources; formats are negotiated per-request by next/image.
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
