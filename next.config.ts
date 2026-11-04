import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  headers() {
    return Promise.resolve([
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
    ]);
  },
  devIndicators: {
    position: "top-right",
  },
  allowedDevOrigins: [
    "10.*.*.*",
    "192.168.*.*",
    ...Array.from({
      length: 16,
    }, (_value, index) => `172.${index + 16}.*.*`),
  ],
};

export default nextConfig;
