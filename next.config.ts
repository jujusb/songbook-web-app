import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["puppeteer", "chordsheetjs"],
  allowedDevOrigins: ["oracle-vps-media.netbird.selfhosted"],
};

export default nextConfig;
