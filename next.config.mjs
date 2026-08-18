const contentSecurityPolicy = [
  "default-src 'self' http://localhost:* ws://localhost:*",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self' http://localhost:*",
  "frame-src 'self' http://localhost:*",
  "object-src 'none'",
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:*`,
  "style-src 'self' 'unsafe-inline' http://localhost:*",
  "font-src 'self' data: http://localhost:*",
  "img-src 'self' data: blob: https: http://localhost:*",
  "media-src 'self' blob: https://d8j0ntlcm91z4.cloudfront.net http://localhost:*",
  "connect-src 'self' http://localhost:* ws://localhost:* https://*.ingest.sentry.io https://*.ingest.us.sentry.io",
  "worker-src 'self' blob:",
  "upgrade-insecure-requests",
].join('; ')

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: process.cwd(),
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    const lovableUrl = process.env.LOVABLE_APP_URL || 'http://localhost:8080'
    return [
      {
        source: '/lovable-app/:path*',
        destination: `${lovableUrl}/:path*`,
      },
    ]
  },
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'Content-Security-Policy',
          value: contentSecurityPolicy,
        },
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
        {
          key: 'X-Frame-Options',
          value: 'SAMEORIGIN',
        },
        {
          key: 'X-XSS-Protection',
          value: '1; mode=block',
        },
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin',
        },
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=()',
        },
      ],
    },
  ],
}

const withSentryConfig = process.env.SENTRY_DSN
  ? (await import('@sentry/nextjs')).withSentryConfig
  : null

export default withSentryConfig
  ? withSentryConfig(nextConfig, {
      silent: true,
      webpack: { treeshake: { removeDebugLogging: true } },
    })
  : nextConfig
