import { join } from "node:path";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const LIBRARY_IMPORT =
  'import { House } from "lucide-react";\nexport const icon = House;\n';
const SUBPATH_IMPORT =
  'import house from "lucide-react/icons/house";\nexport const icon = house;\n';

// Loading the eslint config is slow on a busy test run, hence one instance and a longer timeout.
const eslint = new ESLint({ cwd: join(import.meta.dirname, "../..") });
const LINT_TIMEOUT_MS = 30_000;

async function restrictedImportErrors(code: string, file: string) {
  const [result] = await eslint.lintText(code, { filePath: file });
  return result.messages.filter(
    (message) => message.ruleId === "no-restricted-imports",
  );
}

describe("icon library imports (ADR 0021)", () => {
  it.each([LIBRARY_IMPORT, SUBPATH_IMPORT])(
    "are refused outside ui/Icon.tsx",
    async (code) => {
      expect(
        await restrictedImportErrors(code, "src/features/shell/TabBar.tsx"),
      ).toHaveLength(1);
    },
    LINT_TIMEOUT_MS,
  );

  it(
    "are allowed in ui/Icon.tsx",
    async () => {
      expect(
        await restrictedImportErrors(LIBRARY_IMPORT, "src/ui/Icon.tsx"),
      ).toHaveLength(0);
    },
    LINT_TIMEOUT_MS,
  );
});
