import type { NextConfig } from "next";

const iomServerUrl =
  process.env.NEXT_PUBLIC_IOM_SERVER_URL || "http://localhost:5600";

const connectOrigins = (() => {
  try {
    const origin = new URL(iomServerUrl).origin;
    if (origin.startsWith("https://"))
      return `${origin} ${origin.replace("https://", "wss://")}`;
    return origin;
  } catch {
    return "";
  }
})();

const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' https://challenges.cloudflare.com https://cdnjs.cloudflare.com;
  worker-src 'self' blob: https://cdnjs.cloudflare.com;
  frame-src 'self' https://challenges.cloudflare.com https://storage.googleapis.com https://*.googleapis.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.googleapis.com;
  img-src 'self' blob: data: http://localhost:* ${connectOrigins} https://storage.googleapis.com https://*.googleapis.com;
  font-src 'self' https://fonts.gstatic.com https://*.googleapis.com;
  connect-src 'self' http://localhost:* ${connectOrigins} https://cdnjs.cloudflare.com https://storage.googleapis.com https://*.googleapis.com;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`.replace(/\n/g, "");

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },

  async rewrites() {
    const routes = [
      {
        hosts: [
          "moa.betterinternship.com",
          "dev.moa.betterinternship.com",
          "moa.localhost",
        ],
        destination: "company",
      },
      {
        hosts: [
          "uni.betterinternship.com",
          "dev.uni.betterinternship.com",
          "uni.localhost",
        ],
        destination: "university",
      },
      {
        hosts: [
          "admin.iom.betterinternship.com",
          "dev.admin.iom.betterinternship.com",
          "admin.iom.localhost",
        ],
        destination: "admin",
      },
    ];

    const rewrites: {
      source: string;
      has: { type: "host"; value: string }[];
      destination: string;
    }[] = [];

    routes.forEach(({ hosts, destination }) => {
      hosts.forEach((host) => {
        rewrites.push({
          source:
            "/:path((?!_next|betterinternship-logo|BetterInternshipLogo|bg2(?:\\.png)?(?:/|$)|company(?:/|$)|university(?:/|$)|admin(?:/|$)|gcs-proxy(?:/|$)|invite(?:/|$)).*)*",
          has: [{ type: "host", value: host }],
          destination: `/${destination}/:path*`,
        });
      });
    });

    return { beforeFiles: rewrites };
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: cspHeader },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
