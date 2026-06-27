import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Workers does not support Node.js APIs at the edge by default.
  // opennextjs/cloudflare handles the transformation.
};

export default nextConfig;
