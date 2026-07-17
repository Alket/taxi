/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow the app to be reached via ngrok during local PayPal testing.
  allowedDevOrigins: ["yin-dealt-citadel.ngrok-free.dev"],
}

export default nextConfig
