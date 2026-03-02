import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";
import prettierPlugin from "eslint-plugin-prettier";
import globals from "globals";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "public/**",
      "*.config.js",
      "*.config.mjs",
      "*.config.mts",
      "*.config.ts",
      "scripts/**",
      "prisma/**",
      "getToken.js",
      "getRefreshToken.js",
      "seed.ts",
      "components/src/test/**",
      "tests/**",
      // Legacy JS files with babel dependencies not available
      "components/src/client/index.js",
      "components/src/client/routes/booking/approvalEmail.js",
      "components/src/server/auth.js",
    ],
  },

  // Base JS recommended
  js.configs.recommended,

  // TypeScript recommended + type-checked
  ...tseslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  // Legacy configs via FlatCompat
  ...compat.extends("airbnb-base"),
  ...compat.extends("next/core-web-vitals"),

  // Re-establish typescript-eslint parser for TS/TSX files
  // (next/core-web-vitals overrides the parser, breaking type-checked rules)
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
  },

  // Disable type-checked rules for JS files
  {
    files: ["**/*.js", "**/*.mjs"],
    ...tseslint.configs.disableTypeChecked,
  },

  // Prettier must be last to override formatting rules
  prettierConfig,

  // Project-wide settings and custom rules
  {
    plugins: {
      prettier: prettierPlugin,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    settings: {
      "import/resolver": {
        typescript: {
          project: "./tsconfig.json",
        },
      },
    },
    rules: {
      "no-shadow": "off",
      "no-void": "off",
      "no-nested-ternary": "off",
      "arrow-body-style": ["error", "as-needed"],
      "spaced-comment": ["error", "always"],
      "prettier/prettier": "error",
      "import/prefer-default-export": "off",
      "import/no-extraneous-dependencies": "off",
      "import/no-unresolved": "off",
      "import/no-cycle": "off",
      "import/named": "off",
      "import/no-named-default": "off",
      "import/no-mutable-exports": "off",
      "no-use-before-define": "off",
      "import/extensions": [
        "error",
        "ignorePackages",
        {
          "js": "never",
          "jsx": "never",
          "ts": "never",
          "tsx": "never",
        },
      ],
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-shadow": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-use-before-define": "off",
      "no-console": "off",
      // Disabled: TypeScript handles these checks
      "no-undef": "off",
      "no-unused-vars": "off",
      // Downgraded to warn: pre-existing issues to fix incrementally
      "react-hooks/rules-of-hooks": "warn",
      "@next/next/no-html-link-for-pages": "warn",
      "react/no-unescaped-entities": "warn",
      // Disabled: overly strict airbnb-base rules not matching project style
      "no-await-in-loop": "off",
      "no-restricted-syntax": "off",
      "no-continue": "off",
      "no-plusplus": "off",
      "no-param-reassign": "off",
      "no-underscore-dangle": "off",
      "consistent-return": "off",
      "no-template-curly-in-string": "off",
      "default-case": "off",
      "camelcase": "off",
      "class-methods-use-this": "off",
      "lines-around-directive": "off",
      "radix": "off",
      "global-require": "off",
      "no-case-declarations": "off",
      "no-restricted-globals": "off",
      "no-empty-function": "off",
      "no-promise-executor-return": "off",
      "eqeqeq": "off",
      "guard-for-in": "off",
      "no-useless-escape": "off",
      "default-param-last": "off",
      "prefer-destructuring": "off",
      "no-lonely-if": "off",
      "no-return-await": "off",
      "no-unsafe-optional-chaining": "off",
      "no-empty": "off",
      "no-constant-binary-expression": "off",
      "dot-notation": "off",
      "@typescript-eslint/dot-notation": "off",
      // Disabled: additional type-checked rules not enforced in original config
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-enum-comparison": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/no-misused-promises": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-redundant-type-constituents": "off",
      "@typescript-eslint/unbound-method": "off",
      "@typescript-eslint/no-base-to-string": "off",
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/await-thenable": "off",
      "@typescript-eslint/prefer-promise-reject-errors": "off",
    },
  },
);
