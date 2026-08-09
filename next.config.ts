import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The seeded SQLite template is read at runtime by src/lib/db/client.ts and copied to
  // /tmp. Nothing imports it, so tracing cannot infer it — it must be declared here or it
  // is left out of the serverless bundle and every data-backed page 500s.
  outputFileTracingIncludes: {
    "/**": ["./prisma/demo.db"],
  },
};

export default nextConfig;
