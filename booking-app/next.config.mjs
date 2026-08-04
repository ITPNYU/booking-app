import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const resolveStub = (relativePath) => path.join(__dirname, relativePath);

// E2E runs swap the Firebase client SDK for in-memory stubs. Declared once
// here and applied to BOTH bundlers: Turbopack (`next dev --turbo`) via
// `turbopack.resolveAlias`, and webpack (`next build`, plain `next dev`) via
// the `webpack` hook below — Turbopack does not run the webpack hook.
const E2E_STUB_ALIASES = {
  "firebase/app": "./lib/firebase/stubs/firebaseAppStub.ts",
  "firebase/firestore": "./lib/firebase/stubs/firebaseFirestoreStub.ts",
  "@firebase/app": "./lib/firebase/stubs/firebaseAppStub.ts",
  "@firebase/firestore": "./lib/firebase/stubs/firebaseFirestoreStub.ts",
};

// Mirrors shouldBypassAuth() from lib/utils/testEnvironment.ts at build time
// so the client can check synchronously without an API call.
const isTestEnv =
  (process.env.CI === "true" &&
    process.env.NEXT_PUBLIC_BRANCH_NAME === "development") ||
  (process.env.NODE_ENV === "test" &&
    process.env.E2E_TESTING === "true") ||
  process.env.BYPASS_AUTH === "true";

/** @type {import('next').NextConfig} */

const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  ...(process.env.E2E_TESTING === "true"
    ? { turbopack: { resolveAlias: E2E_STUB_ALIASES } }
    : {}),
  experimental: {
    optimizePackageImports: [
      "@mui/material",
      "@mui/icons-material",
      "@mui/x-data-grid",
      "@mui/x-date-pickers",
    ],
  },
  serverExternalPackages: ["newrelic"],
  // Only non-secret, browser-facing values belong here. Next.js inlines every
  // `env` entry into any bundle that references it (including client bundles),
  // so server secrets must NOT be listed — a single client `process.env.X`
  // reference would ship them to the browser. Server code reads secrets from
  // `process.env` directly at runtime (loaded from the deploy-time env file),
  // which does not require an `env` entry.
  env: {
    NEXT_PUBLIC_IS_TEST_ENV: isTestEnv ? "true" : "false",
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    NEXT_PUBLIC_BRANCH_NAME: process.env.NEXT_PUBLIC_BRANCH_NAME,
    NEXT_PUBLIC_GCP_LOG_NAME: process.env.NEXT_PUBLIC_GCP_LOG_NAME,
  },
  compiler: {
    styledComponents: true,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias.handlebars = false;
      // Exclude firebase-admin on client side
      config.resolve.alias = {
        ...config.resolve.alias,
        "firebase-admin": false,
        "firebase-admin/app": false,
        "firebase-admin/firestore": false,
        newrelic: false,
      };
    }

    if (process.env.E2E_TESTING === "true") {
      config.resolve.alias = {
        ...config.resolve.alias,
        ...Object.fromEntries(
          Object.entries(E2E_STUB_ALIASES).map(([specifier, stubPath]) => [
            specifier,
            resolveStub(stubPath),
          ]),
        ),
      };
    }

    // Enable WebAssembly support
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    // Handle WebAssembly files
    config.module.rules.push({
      test: /\.wasm$/,
      type: "webassembly/async",
    });

    // Handle farmhash-modern WebAssembly files specifically
    config.module.rules.push({
      test: /farmhash.*\.wasm$/,
      type: "webassembly/async",
    });

    // Ignore README.md files in node_modules (fixes New Relic webpack issue)
    config.module.rules.push({
      test: /\.md$/,
      type: "asset/resource",
      generator: {
        emit: false,
      },
    });

    // Ensure WebAssembly files are properly handled
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      net: false,
      tls: false,
      crypto: false,
      stream: false,
      url: false,
      zlib: false,
      http: false,
      https: false,
      assert: false,
      os: false,
      util: false,
      // Add fallbacks for farmhash-modern dependencies
      buffer: false,
      process: false,
    };

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
    ];
  },
  async rewrites() {
    return [];
  },
};

export default nextConfig;
