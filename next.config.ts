import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
