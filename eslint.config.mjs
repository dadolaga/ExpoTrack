import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";
import tseslint from "typescript-eslint";

export default defineConfig([
  js.configs.recommended,
  ...nextVitals,
  ...nextTypeScript,
  {
    name: "expotrack/code-standard",
    files: ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"],
    plugins: {
      "@stylistic": stylistic,
    },
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
    rules: {
      // Formatting is maintained by Stylistic, not deprecated ESLint core rules.
      "@stylistic/array-bracket-newline": [
        "error", {
          multiline: true,
          minItems: 3,
        },
      ],
      "@stylistic/array-bracket-spacing": ["error", "never"],
      "@stylistic/array-element-newline": ["error", "consistent"],
      "@stylistic/arrow-parens": ["error", "always"],
      "@stylistic/arrow-spacing": "error",
      "@stylistic/block-spacing": ["error", "always"],
      "@stylistic/brace-style": [
        "error", "1tbs", {
          allowSingleLine: false,
        },
      ],
      "@stylistic/comma-dangle": ["error", "always-multiline"],
      "@stylistic/comma-spacing": "error",
      "@stylistic/comma-style": ["error", "last"],
      "@stylistic/computed-property-spacing": ["error", "never"],
      "@stylistic/dot-location": ["error", "property"],
      "@stylistic/eol-last": ["error", "always"],
      "@stylistic/function-call-argument-newline": ["error", "consistent"],
      "@stylistic/function-call-spacing": ["error", "never"],
      "@stylistic/function-paren-newline": ["error", "multiline-arguments"],
      "@stylistic/generator-star-spacing": [
        "error", {
          before: false,
          after: true,
        },
      ],
      "@stylistic/indent": [
        "error", 2, {
          SwitchCase: 1,
        },
      ],
      "@stylistic/key-spacing": "error",
      "@stylistic/keyword-spacing": "error",
      "@stylistic/linebreak-style": ["error", "unix"],
      "@stylistic/lines-between-class-members": ["error", "always"],
      "@stylistic/max-len": [
        "error", {
          code: 120,
          ignoreUrls: true,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
          ignoreRegExpLiterals: true,
          ignoreComments: true,
        },
      ],
      "@stylistic/max-statements-per-line": [
        "error", {
          max: 1,
        },
      ],
      "@stylistic/member-delimiter-style": "error",
      "@stylistic/new-parens": ["error", "always"],
      "@stylistic/no-extra-parens": ["error", "functions"],
      "@stylistic/no-floating-decimal": "error",
      "@stylistic/no-mixed-operators": "error",
      "@stylistic/no-mixed-spaces-and-tabs": "error",
      "@stylistic/no-multi-spaces": "error",
      "@stylistic/no-multiple-empty-lines": [
        "error", {
          max: 1,
          maxBOF: 0,
          maxEOF: 0,
        },
      ],
      "@stylistic/no-tabs": "error",
      "@stylistic/no-trailing-spaces": "error",
      "@stylistic/no-whitespace-before-property": "error",
      "@stylistic/object-curly-newline": [
        "error", {
          ObjectExpression: {
            minProperties: 1,
            consistent: true,
          },
          ObjectPattern: {
            minProperties: 4,
            multiline: true,
            consistent: true,
          },
          ImportDeclaration: {
            minProperties: 4,
            multiline: true,
            consistent: true,
          },
          ExportDeclaration: {
            minProperties: 4,
            multiline: true,
            consistent: true,
          },
          TSTypeLiteral: {
            minProperties: 1,
            consistent: true,
          },
          TSInterfaceBody: {
            minProperties: 1,
            consistent: true,
          },
        },
      ],
      "@stylistic/object-curly-spacing": ["error", "always"],
      "@stylistic/object-property-newline": [
        "error", {
          allowAllPropertiesOnSameLine: false,
        },
      ],
      "@stylistic/operator-linebreak": ["error", "before"],
      "@stylistic/padded-blocks": ["error", "never"],
      "@stylistic/padding-line-between-statements": [
        "error",
        {
          blankLine: "always",
          prev: "*",
          next: [
            "return", "throw", "function", "class",
          ],
        },
        {
          blankLine: "always",
          prev: ["const", "let"],
          next: "*",
        },
        {
          blankLine: "any",
          prev: ["const", "let"],
          next: ["const", "let"],
        },
        {
          blankLine: "always",
          prev: ["function", "class"],
          next: "*",
        },
      ],
      "@stylistic/quote-props": ["error", "as-needed"],
      "@stylistic/quotes": [
        "error", "double", {
          avoidEscape: true,
        },
      ],
      "@stylistic/rest-spread-spacing": ["error", "never"],
      "@stylistic/semi": ["error", "always"],
      "@stylistic/semi-spacing": "error",
      "@stylistic/semi-style": ["error", "last"],
      "@stylistic/space-before-blocks": ["error", "always"],
      "@stylistic/space-before-function-paren": [
        "error", {
          anonymous: "never",
          named: "never",
          asyncArrow: "always",
        },
      ],
      "@stylistic/space-in-parens": ["error", "never"],
      "@stylistic/space-infix-ops": "error",
      "@stylistic/space-unary-ops": "error",
      "@stylistic/spaced-comment": [
        "error", "always", {
          markers: ["/", "!"],
        },
      ],
      "@stylistic/switch-colon-spacing": "error",
      "@stylistic/template-curly-spacing": ["error", "never"],
      "@stylistic/template-tag-spacing": ["error", "never"],
      "@stylistic/type-annotation-spacing": "error",
      "@stylistic/type-generic-spacing": "error",
      "@stylistic/type-named-tuple-spacing": "error",
      "@stylistic/wrap-iife": ["error", "outside"],
      "@stylistic/yield-star-spacing": [
        "error", {
          before: false,
          after: true,
        },
      ],

      // Runtime correctness and modern JavaScript.
      "accessor-pairs": "error",
      "array-callback-return": [
        "error", {
          checkForEach: true,
        },
      ],
      "block-scoped-var": "error",
      curly: ["error", "all"],
      "default-case-last": "error",
      "default-param-last": "error",
      "dot-notation": "error",
      eqeqeq: ["error", "always"],
      "guard-for-in": "error",
      "no-alert": "error",
      "no-caller": "error",
      "no-constructor-return": "error",
      "no-else-return": [
        "error", {
          allowElseIf: false,
        },
      ],
      "no-eval": "error",
      "no-extend-native": "error",
      "no-extra-bind": "error",
      "no-implicit-coercion": "error",
      "no-implied-eval": "error",
      "no-iterator": "error",
      "no-labels": "error",
      "no-lone-blocks": "error",
      "no-lonely-if": "error",
      "no-multi-assign": "error",
      "no-nested-ternary": "error",
      "no-new": "error",
      "no-new-func": "error",
      "no-new-wrappers": "error",
      "no-object-constructor": "error",
      "no-param-reassign": [
        "error", {
          props: true,
        },
      ],
      "no-promise-executor-return": "error",
      "no-return-assign": ["error", "always"],
      "no-script-url": "error",
      "no-self-compare": "error",
      "no-sequences": "error",
      "no-shadow": "error",
      "no-template-curly-in-string": "error",
      "no-throw-literal": "error",
      "no-unneeded-ternary": "error",
      "no-unused-expressions": "error",
      "no-unused-vars": [
        "error", {
          args: "all",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "no-use-before-define": [
        "error", {
          functions: false,
        },
      ],
      "no-useless-computed-key": "error",
      "no-useless-concat": "error",
      "no-useless-rename": "error",
      "no-useless-return": "error",
      "no-var": "error",
      "object-shorthand": ["error", "always"],
      "one-var": ["error", "never"],
      "prefer-arrow-callback": "error",
      "prefer-const": "error",
      "prefer-exponentiation-operator": "error",
      "prefer-numeric-literals": "error",
      "prefer-object-has-own": "error",
      "prefer-object-spread": "error",
      "prefer-promise-reject-errors": "error",
      "prefer-rest-params": "error",
      "prefer-spread": "error",
      "prefer-template": "error",
      radix: ["error", "always"],
      yoda: ["error", "never"],

      // Keep imports predictable without relying on source file layout.
      "import/first": "error",
      "import/newline-after-import": "error",
      "import/no-cycle": "error",
      "import/no-duplicates": "error",
      "import/no-mutable-exports": "error",
      "import/no-self-import": "error",
      "import/no-useless-path-segments": "error",
      "import/order": [
        "error", {
          groups: [
            "builtin", "external", "internal", "parent", "sibling", "index", "object", "type",
          ],
          "newlines-between": "always",
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
          warnOnUnassignedImports: true,
        },
      ],
    },
  },
  {
    name: "expotrack/typed-safety",
    files: ["**/*.{ts,mts,cts,tsx}"],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "default-param-last": "off",
      "dot-notation": "off",
      "no-implied-eval": "off",
      "no-shadow": "off",
      "no-unused-vars": "off",
      "no-use-before-define": "off",
      "@typescript-eslint/consistent-type-exports": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error", {
          fixStyle: "separate-type-imports",
        },
      ],
      "@typescript-eslint/default-param-last": "error",
      "@typescript-eslint/dot-notation": "error",
      "@typescript-eslint/method-signature-style": ["error", "property"],
      "@typescript-eslint/no-confusing-void-expression": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-import-type-side-effects": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-shadow": "error",
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/no-unnecessary-type-arguments": "error",
      "@typescript-eslint/no-unused-vars": [
        "error", {
          args: "all",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "@typescript-eslint/no-use-before-define": [
        "error", {
          functions: false,
        },
      ],
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/prefer-optional-chain": "error",
      "@typescript-eslint/prefer-readonly": "error",
      "@typescript-eslint/strict-boolean-expressions": [
        "error", {
          allowString: false,
          allowNumber: false,
        },
      ],
      "@typescript-eslint/switch-exhaustiveness-check": "error",
    },
  },
  {
    name: "expotrack/react-source",
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    rules: {
      "no-console": [
        "error", {
          allow: ["warn", "error"],
        },
      ],
      "react/jsx-boolean-value": ["error", "never"],
      "react/jsx-no-useless-fragment": "error",
      "react/self-closing-comp": "error",
      "@stylistic/jsx-closing-bracket-location": ["error", "line-aligned"],
      "@stylistic/jsx-closing-tag-location": "error",
      "@stylistic/jsx-curly-brace-presence": [
        "error", {
          props: "never",
          children: "never",
        },
      ],
      "@stylistic/jsx-curly-spacing": ["error", "never"],
      "@stylistic/jsx-equals-spacing": ["error", "never"],
      "@stylistic/jsx-first-prop-new-line": ["error", "multiline"],
      "@stylistic/jsx-indent-props": ["error", 2],
      "@stylistic/jsx-max-props-per-line": [
        "error", {
          maximum: 1,
        },
      ],
      "@stylistic/jsx-quotes": ["error", "prefer-double"],
      "@stylistic/jsx-tag-spacing": [
        "error", {
          beforeSelfClosing: "always",
        },
      ],
      "@stylistic/jsx-wrap-multilines": [
        "error", {
          declaration: "parens-new-line",
          assignment: "parens-new-line",
          return: "parens-new-line",
          arrow: "parens-new-line",
          condition: "parens-new-line",
          logical: "parens-new-line",
          prop: "parens-new-line",
        },
      ],
    },
  },
  globalIgnores([
    "public/sw.js", // Generated from the linted worker source after each build.
    ".next/**",
    ".npm-cache/**",
    "out/**",
    "build/**",
    "validation-results/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
]);
