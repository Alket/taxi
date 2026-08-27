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
    const destAliases = [
      ["saranda", "sarande"],
      ["vlora", "vlore"],
      ["scutari", "shkoder"],
      ["shkodra", "shkoder"],
      ["durazzo", "durres"],
      ["valona", "vlore"],
    ]

    const destinationRedirects = destAliases.flatMap(([from, to]) => [
      {
        source: `/destinations/${from}`,
        destination: `/destinations/${to}`,
        permanent: true,
      },
      {
        source: `/:locale(${locale})/destinations/${from}`,
        destination: `/:locale/destinations/${to}`,
        permanent: true,
      },
    ])

    return [
      ...destinationRedirects,
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
