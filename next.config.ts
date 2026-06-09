import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ['*.loca.lt'],
  output: 'standalone',
  outputFileTracingIncludes: {
    '/**': [
      './node_modules/sqlite3/build/**',
      './node_modules/sqlite3/lib/**',
      './node_modules/bindings/**',
      './node_modules/file-uri-to-path/**',
    ],
  },
};

export default nextConfig;
