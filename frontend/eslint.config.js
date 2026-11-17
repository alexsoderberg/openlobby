import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const ICON_LIBRARY = {
  group: ["lucide-react", "lucide-react/*"],
  message: "Use Icon from src/ui instead (ADR 0021 point 1).",
};

export default tseslint.config(
  { ignores: ["dist", "src/api/gen"] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    // ADR 0015 point 3: no static import of the 3D scene or of three outside the scene itself.
    // Re-exports are caught too. Tests may import heroScene to mock it. `import()` is an ImportExpression, so it passes.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/**/*.test.{ts,tsx}", "src/features/landing/heroScene.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            ":matches(ImportDeclaration, ExportNamedDeclaration, ExportAllDeclaration)[source.value=/heroScene$|^three(\\/|$)/]",
          message:
            "Load the 3D scene only with import() in LandingHero.tsx (ADR 0015 point 3).",
        },
      ],
    },
  },
  {
    // ADR 0021 point 1: the icon library is imported only in ui/Icon.tsx, so a swap stays in that one file.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/ui/Icon.tsx"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [ICON_LIBRARY] }],
    },
  },
  {
    // ADR 0023 point 8: each vendor sits in its ui/ wrapper. One rule entry per file, so this one repeats the icons.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/ui/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ICON_LIBRARY,
            {
              group: ["@radix-ui/*", "sonner"],
              message: "Use the ui component (ADR 0023 point 8).",
            },
          ],
        },
      ],
    },
  },
);
