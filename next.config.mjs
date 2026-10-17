import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const aliases = {
  "@": path.join(projectRoot, "client", "src"),
  "@shared": path.join(projectRoot, "shared"),
};

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    resolveAlias: aliases,
  },
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      ...aliases,
    };
    return config;
  },
};

export default nextConfig;
