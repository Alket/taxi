/** @type {import('next').NextConfig} */
const nextConfig = {
  // Smaller production image for Docker.
  output: "standalone",
  // Allow the app to be reached via ngrok during local PayPal testing.
  allowedDevOrigins: ["yin-dealt-citadel.ngrok-free.dev"],
}

export default nextConfig
