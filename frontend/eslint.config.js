// @ts-check
const eslint = require("@eslint/js");
const { defineConfig, globalIgnores } = require("eslint/config");
const tseslint = require("typescript-eslint");
const angular = require("angular-eslint");
const { readdirSync } = require("node:fs");

/** Legacy Angular APIs replaced by Signal Forms, control flow and class/style bindings. */
const RESTRICTED_PATHS = [
  {
    name: "@angular/forms",
    importNames: ["FormsModule", "ReactiveFormsModule", "NgModel", "FormControl", "FormGroup", "FormBuilder"],
    message: "Use Signal Forms (@angular/forms/signals).",
  },
  {
    name: "@angular/common",
    importNames: ["CommonModule", "NgClass", "NgStyle", "NgIf", "NgFor", "NgSwitch"],
    message: "Use control flow and [class.x] / [style.x] bindings.",
  },
];

/** `../` imports inside src/app (only `environments/`, outside the alias, may be reached that way). */
const NO_PARENT_IMPORTS = {
  regex: "^\\.\\./(?!(\\.\\./)*environments/environment$)",
  message: "Use the @app/... alias instead of ../ paths.",
};

/**
 * no-restricted-imports options. ESLint replaces (doesn't merge) a rule's options per matching config block,
 * so every block repeats RESTRICTED_PATHS.
 */
function restrictImports(...patterns) {
  return ["error", { paths: RESTRICTED_PATHS, ...(patterns.length ? { patterns } : {}) }];
}

/**
 * Layers: core <- shared <- features. A feature imports only itself; the reader embeds the comments of the
 * `social` feature (the one cross-feature import).
 */
const CROSS_FEATURE_ALLOWED = { reader: ["social/components/chapter-comments$"] };
const featureBlocks = readdirSync(`${__dirname}/src/app/features`, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map(({ name }) => ({
    files: [`src/app/features/${name}/**/*.ts`],
    rules: {
      "no-restricted-imports": restrictImports(NO_PARENT_IMPORTS, {
        regex: `^@app/features/(?!${[`${name}/`, ...(CROSS_FEATURE_ALLOWED[name] ?? [])].join("|")})`,
        message: "A feature imports only its own files (shared UI goes to src/app/shared, app-wide code to src/app/core).",
      }),
    },
  }));

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
    languageOptions: {
      // Type information for no-uncalled-signals.
      parserOptions: { projectService: true, tsconfigRootDir: __dirname },
    },
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
      // Angular 22: root singletons use @Service() instead of @Injectable({ providedIn: 'root' }).
      "@angular-eslint/prefer-service-decorator": "error",
      "@angular-eslint/prefer-standalone": "error",
      // OnPush is the default in Angular 22: no explicit changeDetection.
      "@angular-eslint/prefer-output-readonly": "error",
      "@angular-eslint/prefer-output-emitter-ref": "error",
      "@angular-eslint/prefer-signal-model": "error",
      "@angular-eslint/prefer-host-metadata-property": "error",
      "@angular-eslint/no-uncalled-signals": "error",
      "@angular-eslint/no-implicit-take-until-destroyed": "error",
      "no-restricted-imports": restrictImports(),
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
      "@angular-eslint/template/no-inline-styles": ["error", { allowNgStyle: false, allowBindToStyle: true }],
      "@angular-eslint/template/prefer-class-binding": "error",
      "@angular-eslint/template/prefer-style-binding": "error",
      "@angular-eslint/template/prefer-ngsrc": "error",
      "@angular-eslint/template/prefer-at-empty": "error",
      "@angular-eslint/template/prefer-at-else": "error",
      "@angular-eslint/template/prefer-contextual-for-variables": "error",
      "@angular-eslint/template/prefer-built-in-pipes": "error",
      "@angular-eslint/template/prefer-template-literal": "error",
      "@angular-eslint/template/no-duplicate-attributes": "error",
      "@angular-eslint/template/no-empty-control-flow": "error",
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
    files: ["src/app/**/*.ts"],
    rules: { "no-restricted-imports": restrictImports(NO_PARENT_IMPORTS) },
  },
  {
    files: ["src/app/core/**/*.ts"],
    rules: {
      "no-restricted-imports": restrictImports(NO_PARENT_IMPORTS, {
        regex: "^@app/(shared|features)/",
        message: "core is app-wide infrastructure: it must not depend on shared UI or features.",
      }),
    },
  },
  {
    files: ["src/app/shared/**/*.ts"],
    rules: {
      "no-restricted-imports": restrictImports(NO_PARENT_IMPORTS, {
        regex: "^@app/features/",
        message: "shared UI is feature-agnostic: it must not import features.",
      }),
    },
  },
  ...featureBlocks,
  {
    files: ["tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      // A focused test must never be committed (it silently skips the rest of the suite).
      "no-restricted-properties": [
        "error",
        ...["describe", "it", "test"].map((object) => ({ object, property: "only", message: "Remove .only before committing." })),
      ],
    },
  },
]);
