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
