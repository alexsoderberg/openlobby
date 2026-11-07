import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

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
    // ADR 0015: the 3D library stays in the lazy scene adapter.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/features/landing/heroScene.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["three", "three/*"],
              message:
                "Only heroScene.ts imports three, and LandingHero.tsx loads heroScene with import() (ADR 0015).",
            },
          ],
        },
      ],
    },
  },
);
