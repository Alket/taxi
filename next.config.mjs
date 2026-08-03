/** @type {import('next').NextConfig} */
const nextConfig = {
  // Smaller production image for Docker.
  output: "standalone",
  // Allow the app to be reached via ngrok during local PayPal testing.
  allowedDevOrigins: ["wriggle-dollhouse-unhidden.ngrok-free.dev"],
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
