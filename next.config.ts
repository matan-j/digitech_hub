import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse + mammoth use Node-native code paths that don't play with webpack RSC bundling.
  serverExternalPackages: ["pdf-parse", "mammoth"],
  // The account page moved under the /learn layout (so it renders with the side
  // nav like every other menu item). Keep the old /account URL working for
  // existing bookmarks and the Stripe billing-portal return URL.
  async redirects() {
    return [
      { source: "/account", destination: "/learn/account", permanent: true },
    ];
  },
};

export default nextConfig;
