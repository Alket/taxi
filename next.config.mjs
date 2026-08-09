/** @type {import('next').NextConfig} */
const nextConfig = {
  // Smaller production image for Docker.
  output: "standalone",
  // Allow overriding when `.next` is owned by the Docker container user.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Allow the app to be reached via ngrok during local PayPal testing.
  allowedDevOrigins: ["wriggle-dollhouse-unhidden.ngrok-free.dev"],
  images: {
    // Admins can set arbitrary external hero/OG image URLs via the CMS
    // (destination pages, homepage). Allow any HTTPS host so next/image
    // optimization doesn't break those uploads; local /uploads/* images are
    // served from this app's own origin regardless.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
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
