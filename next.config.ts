import type { NextConfig } from "next";

const isGithubPages = process.env.GITHUB_PAGES === "true";
const repoName = process.env.NEXT_PUBLIC_BASE_PATH || (isGithubPages ? "/stock" : "");

const nextConfig: NextConfig = {
  output: isGithubPages ? "export" : undefined,
  basePath: repoName || undefined,
  trailingSlash: isGithubPages,
  images: {
    unoptimized: isGithubPages,
    remotePatterns: [{ protocol: "https", hostname: "ssl.pstatic.net" }],
  },
};

export default nextConfig;
