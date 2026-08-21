/** @type {import('next').NextConfig} */
const nextConfig = {
  // Smaller production image for Docker.
  output: "standalone",
  // Allow overriding when `.next` is owned by the Docker container user.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Allow the app to be reached via ngrok during local PayPal testing.
  allowedDevOrigins: ["wriggle-dollhouse-unhidden.ngrok-free.dev"],
  images: {
    // Local /uploads/* are same-origin. External CMS heroes are limited to
    // hosts we actually use — not a wildcard HTTPS allowlist.
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "plus.unsplash.com" },
      { protocol: "https", hostname: "www.welcomepickups.com" },
    ],
  },
  async redirects() {
    const locale = "it|de|pl|tr|uk|ru"
    return [
      // Dual-spelling / legacy destination URLs → canonical CMS slugs.
      {
        source: "/destinations/saranda",
        destination: "/destinations/sarande",
        permanent: true,
      },
      {
        source: `/:locale(${locale})/destinations/saranda`,
        destination: "/:locale/destinations/sarande",
        permanent: true,
      },
      {
        source: "/destinations/vlora",
        destination: "/destinations/vlore",
        permanent: true,
      },
      {
        source: `/:locale(${locale})/destinations/vlora`,
        destination: "/:locale/destinations/vlore",
        permanent: true,
      },
      // Broken URL picked up by Google Search Console.
      {
        source: "/\\$",
        destination: "/",
        permanent: true,
      },
      {
        source: `/:locale(${locale})/\\$`,
        destination: "/:locale",
        permanent: true,
      },
    ]
  },
  async rewrites() {
    return [
      {
        source: "/uploads/pages/:filename",
        destination: "/api/uploads/pages/:filename",
      },
    ]
  },
}

export default nextConfig
