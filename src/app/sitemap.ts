import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/services`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/booking`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/gallery`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/blog`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/contact`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/track`, changeFrequency: "yearly", priority: 0.4 },
  ];

  try {
    const [services, posts] = await Promise.all([
      prisma.service.findMany({
        where: { isActive: true },
        select: { slug: true, updatedAt: true },
      }),
      prisma.post.findMany({
        where: { isPublished: true },
        select: { slug: true, updatedAt: true },
      }),
    ]);

    return [
      ...staticRoutes,
      ...services.map((s) => ({
        url: `${base}/services/${s.slug}`,
        lastModified: s.updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.8,
      })),
      ...posts.map((p) => ({
        url: `${base}/blog/${p.slug}`,
        lastModified: p.updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })),
    ];
  } catch {
    return staticRoutes;
  }
}
