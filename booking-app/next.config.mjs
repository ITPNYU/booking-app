/** @type {import('next').NextConfig} */

const nextConfig = {
  env: {
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    FIREBASE_PRIVATE_KEY_ID: process.env.FIREBASE_PRIVATE_KEY_ID,
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
    FIREBASE_CLIENT_ID: process.env.FIREBASE_CLIENT_ID,
    FIREBASE_AUTH_URI: process.env.FIREBASE_AUTH_URI,
    FIREBASE_TOKEN_URI: process.env.FIREBASE_TOKEN_URI,
    FIREBASE_AUTH_PROVIDER_X509_CERT_URL:
      process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
    FIREBASE_CLIENT_X509_CERT_URL: process.env.FIREBASE_CLIENT_X509_CERT_URL,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    NEXT_PUBLIC_BRANCH_NAME: process.env.NEXT_PUBLIC_BRANCH_NAME,
    NEXT_PUBLIC_GCP_LOG_NAME: process.env.NEXT_PUBLIC_GCP_LOG_NAME,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
    GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN,
    GOOGLE_SHEET_ID: process.env.GOOGLE_SHEET_ID,
    GOOGLE_SPREADSHEET_ID: process.env.GOOGLE_SPREADSHEET_ID,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    NYU_API_CLIENT_ID: process.env.NYU_API_CLIENT_ID,
    NYU_API_CLIENT_SECRET: process.env.NYU_API_CLIENT_SECRET,
    NYU_API_USER_NAME: process.env.NYU_API_USER_NAME,
    NYU_API_PASSWORD: process.env.NYU_API_PASSWORD,
  },
  compiler: {
    styledComponents: true,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias.handlebars = false;
    }
    return config;
  },
  async headers() {
    return [
      {
        source: "/api/safety_training_users",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, max-age=0",
          },
        ],
      },
      {
        source: "/api/calendarEvents",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, max-age=0",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/__/auth/:path*',
        destination: 'https://flowing-mantis-389917.firebaseapp.com/__/auth/:path*',
      },
    ];
  },
};

export default nextConfig;
