import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    agentFeedback: true,
    serverActions: {
      // plansele SVG exportate din EPLAN pot avea cativa MB
      bodySizeLimit: "9mb",
    },
  },
  // MuPDF (WebAssembly) ruleaza direct din node_modules, nu este impachetat
  serverExternalPackages: ["mupdf"],
  cacheComponents: true,
  partialPrefetching: true,
  // fisierele citite la pornire de instrumentation.ts (schema + fixtures)
  outputFileTracingIncludes: {
    "/*": ["./db/**/*.sql", "./public/demo/*.svg"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
