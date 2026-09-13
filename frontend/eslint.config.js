// @ts-check
const eslint = require("@eslint/js");
const { defineConfig, globalIgnores } = require("eslint/config");
const tseslint = require("typescript-eslint");
const angular = require("angular-eslint");

module.exports = defineConfig([
  globalIgnores(["dist/**", ".angular/**", "playwright-report/**", "test-results/**", "node_modules/**"]),
  {
    files: ["**/*.ts"],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      "@angular-eslint/directive-selector": [
        "error",
        {
          type: "attribute",
          prefix: "app",
          style: "camelCase",
        },
      ],
      "@angular-eslint/component-selector": [
        "error",
        {
          type: "element",
          prefix: "app",
          style: "kebab-case",
        },
      ],
      // Modern Angular best practices (signals, standalone, lifecycle hygiene)
      "@angular-eslint/prefer-signals": "error",
      "@angular-eslint/prefer-inject": "error",
      "@angular-eslint/prefer-standalone": "error",
      "@angular-eslint/prefer-on-push-component-change-detection": "warn",
      "@angular-eslint/use-lifecycle-interface": "error",
      "@angular-eslint/no-input-rename": "error",
      "@angular-eslint/no-output-native": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-definitions": ["error", "interface"],
    },
  },
  {
    files: ["**/*.html"],
    extends: [
      angular.configs.templateRecommended,
      angular.configs.templateAccessibility,
    ],
    rules: {
      // Best practice / SEO / accessibility rules
      "@angular-eslint/template/prefer-control-flow": "error",
      "@angular-eslint/template/prefer-self-closing-tags": "warn",
      "@angular-eslint/template/alt-text": "error",
      "@angular-eslint/template/elements-content": "error",
      "@angular-eslint/template/button-has-type": "error",
      "@angular-eslint/template/no-inline-styles": ["error", { allowNgStyle: true, allowBindToStyle: true }],
      "@angular-eslint/template/click-events-have-key-events": "error",
      "@angular-eslint/template/interactive-supports-focus": "error",
      "@angular-eslint/template/label-has-associated-control": "error",
      "@angular-eslint/template/no-autofocus": "error",
      "@angular-eslint/template/no-distracting-elements": "error",
      "@angular-eslint/template/role-has-required-aria": "error",
      "@angular-eslint/template/valid-aria": "error",
    },
  },
  {
    files: ["tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
]);
