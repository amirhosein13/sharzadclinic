import type { NextConfig } from "next";

// همه‌ی محاسبات تاریخ/ساعت سمت سرور بر مبنای وقت تهران انجام می‌شود
process.env.TZ ||= "Asia/Tehran";

const nextConfig: NextConfig = {
  // standalone خروجی سبک برای Docker / لیارا / VPS می‌سازد
  output: process.env.BUILD_STANDALONE === "true" ? "standalone" : undefined,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
  },
};

export default nextConfig;
