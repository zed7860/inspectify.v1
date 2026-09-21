import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: { root: process.cwd() },
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
  images: { remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }] },
  headers: async () => [{ source: "/:path*", headers: [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }
  ] }]
};
export default nextConfig;
