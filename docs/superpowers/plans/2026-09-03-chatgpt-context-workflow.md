# Hex Garden ChatGPT Context Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Git-based low-token ChatGPT handoff workflow and separate active project truth from obsolete Hex Garden visual documentation without changing runtime behavior.

**Architecture:** Active truth lives in small root documents (`PROJECT.md`, `CURRENT_STATE.md`, `ART_DIRECTION.md`, `AGENTS.md`, `TREE.txt`), while obsolete visual decisions move under `docs/archive/visual`. A tested Node script refreshes a compact project tree and emits working-tree or last-commit context bundles containing mandatory truth documents plus changed text/source files, while only listing binary changes.

**Tech Stack:** Node.js 20+, native ES modules, Node built-in test runner, Git CLI, pnpm, Phaser 3/Vite project.

**Spec:** `docs/superpowers/specs/2026-09-03-chatgpt-context-workflow-design.md`

## Global Constraints

- Code and tests remain the factual current implementation when documentation conflicts.
- `docs/archive/**` is historical only and must never be embedded as active context by default.
- Do not select or implement a new visual style.
- Do not remove or alter the current Mechanized Magic runtime integration in this change.
- Do not change rules, progression, economy, scoring, hints, rewarded ads, persistence, responsive gameplay behavior, or Yandex SDK behavior.
- The supplied conversation archive has no `.git`; context-tool tests must create temporary Git repositories.
- Use only Node built-ins and the Git executable for the context tooling; add no dependency.

---

### Task 1: Establish active truth documents and archive obsolete visual decisions

**Files:**
- Create: `PROJECT.md`
- Create: `CURRENT_STATE.md`
- Create: `ART_DIRECTION.md`
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `THIRD_PARTY_ASSETS.md`
- Create directory: `docs/archive/visual/`
- Move: `assets/REGENERATION_PROMPTS.md` → `docs/archive/visual/REGENERATION_PROMPTS-paper-sketchbook.md`
- Move: `docs/superpowers/specs/2026-09-01-mechanized-magic-visual-replacement-design.md` → `docs/archive/visual/2026-09-01-mechanized-magic-visual-replacement-design.md`
- Move: `docs/superpowers/plans/2026-09-01-mechanized-magic-visual-replacement.md` → `docs/archive/visual/2026-09-01-mechanized-magic-visual-replacement-plan.md`

**Interfaces:**
- Consumes: current code/tests, `README.md`, `RULES_AUDIT.md`, current `AGENTS.md`, and the approved context-workflow spec.
- Produces: an explicit hierarchy of current truth and a visual archive that later context tooling can ignore.

- [ ] **Step 1: Move the three obsolete visual documents without modifying runtime assets**

Run:

```bash
mkdir -p docs/archive/visual
mv assets/REGENERATION_PROMPTS.md docs/archive/visual/REGENERATION_PROMPTS-paper-sketchbook.md
mv docs/superpowers/specs/2026-09-01-mechanized-magic-visual-replacement-design.md docs/archive/visual/2026-09-01-mechanized-magic-visual-replacement-design.md
mv docs/superpowers/plans/2026-09-01-mechanized-magic-visual-replacement.md docs/archive/visual/2026-09-01-mechanized-magic-visual-replacement-plan.md
```

Expected: `public/assets/mechanized-magic/**`, `assets/Mechanized Magic/**`, and `src/art-assets.js` remain untouched.

- [ ] **Step 2: Create `ART_DIRECTION.md` with only current valid visual decisions**

Write the exact active decisions from the spec: final direction not selected; full replacement allowed; no pre-binding to paper/garden/alchemy/etc.; third-party commercial assets allowed; practical `$0–8` preference; paid BOOTH excluded/free BOOTH allowed; full generated production set rejected; Mechanized Magic Free rejected as target but remains temporary runtime art.

- [ ] **Step 3: Create `PROJECT.md` as a stable non-visual product contract**

Include:

```markdown
# Hex Garden — Project Contract

## Purpose
Hex-board clearing puzzle for Yandex Games built on the audited Garden rules.

## Authority
- Code/tests = factual current implementation.
- RULES_AUDIT.md = audited low-level rule reference.
- CURRENT_STATE.md = implementation snapshot.
- ART_DIRECTION.md = current visual decisions.

## Stable gameplay contract
- Preserve internal atom IDs from src/atom-types.js.
- Preserve free-atom geometry and pairing/unlock rules audited in RULES_AUDIT.md.
- Campaign and standard Endless are the public product modes; Quintessence stays internal unless explicitly re-approved.
- Solver-backed Move/Undo/Rescue behavior and assisted-run policy remain renderer-independent contracts.
- Runtime presentation may be fully reskinned without changing the underlying mechanics.
```

Then summarize the existing campaign/economy/scoring/platform contracts from current code and active docs without introducing new behavior.

- [ ] **Step 4: Create `CURRENT_STATE.md` from current implementation facts**

Record Phaser `^3.90.0`, Vite `^7.1.3`, Node `>=20`, pnpm commands, current public modes, campaign/endless/economy/solver/rewarded-ad/responsive state, and the temporary Mechanized Magic runtime integration. Explicitly state that the final art direction is unresolved and points to `ART_DIRECTION.md`.

- [ ] **Step 5: Replace the obsolete `AGENTS.md` visual policy and add documentation authority**

Remove statements that third-party/stock art is prohibited and that paper texture is foundational. Replace with a concise section equivalent to:

```markdown
### Documentation authority

- Code and tests are the factual current implementation.
- `PROJECT.md` holds stable product/rules intent.
- `CURRENT_STATE.md` holds the implementation snapshot.
- `ART_DIRECTION.md` is the only active visual-direction document.
- `docs/archive/**` is historical only and must not drive implementation unless explicitly revived by the user.

### Visual asset policy

- A full visual replacement is allowed without changing gameplay rules.
- Third-party asset packs are allowed when commercial-use rights are suitable and recorded in `THIRD_PARTY_ASSETS.md` when bundled.
- Do not assume paper, garden, alchemy, elements/metals, cozy, casual, or Mechanized Magic is the final presentation.
- Current Mechanized Magic runtime assets are temporary implementation state, not approved target art.
- Keep dynamic labels/counts/prices/scores/localized strings in Phaser rather than baking them into raster UI.
- See `ART_DIRECTION.md` for current sourcing constraints and rejected directions.
```

- [ ] **Step 6: Update supporting docs without rewriting unrelated gameplay prose**

Add a short source-of-truth/context section to `README.md`, and update the Mechanized Magic entry in `THIRD_PARTY_ASSETS.md` to say it is currently bundled/runtime art but not an approved final direction. Do not remove its CC0 license record.

- [ ] **Step 7: Review only documentation/archive changes**

Run:

```bash
find docs/archive/visual -maxdepth 1 -type f -print | sort
grep -Rni "Third-party, stock, copied, or traced game art is prohibited\|paper texture is a foundational" AGENTS.md README.md PROJECT.md CURRENT_STATE.md ART_DIRECTION.md || true
```

Expected: three archived files are present; obsolete active-policy phrases are absent.

---

### Task 2: Add testable tree and context-bundle core

**Files:**
- Create: `scripts/chatgpt-context-lib.mjs`
- Create: `test/chatgpt-context.test.js`

**Interfaces:**
- Produces:
  - `generateProjectTree(rootDir) -> string`
  - `isEmbeddableTextPath(relativePath) -> boolean`
  - `isBundleExcludedPath(relativePath) -> boolean`
  - `collectWorkingTreeChanges(rootDir) -> Array<{ status: string, path: string }>`
  - `collectLastCommitChanges(rootDir) -> Array<{ status: string, path: string }>`
  - `buildContextBundle({ rootDir, mode, now }) -> { text: string, treeChanged: boolean }`
- Consumes: Git executable and filesystem only.

- [ ] **Step 1: Write failing tests for path classification and collapsed tree output**

Add tests equivalent to:

```js
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  generateProjectTree,
  isBundleExcludedPath,
  isEmbeddableTextPath,
} from "../scripts/chatgpt-context-lib.mjs";

test("classifies source text and excludes archive/binary bytes", () => {
  assert.equal(isEmbeddableTextPath("src/rules.js"), true);
  assert.equal(isEmbeddableTextPath("ART_DIRECTION.md"), true);
  assert.equal(isEmbeddableTextPath("public/icon.png"), false);
  assert.equal(isBundleExcludedPath("docs/archive/visual/old.md"), true);
  assert.equal(isBundleExcludedPath("_chatgpt_bundle/out.txt"), true);
});

test("tree collapses bulky asset and database directories", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "hex-tree-"));
  await mkdir(path.join(root, "src"), { recursive: true });
  await mkdir(path.join(root, "assets", "Mechanized Magic", "Icons"), { recursive: true });
  await mkdir(path.join(root, "public", "assets", "mechanized-magic", "hud"), { recursive: true });
  await mkdir(path.join(root, "data"), { recursive: true });
  await writeFile(path.join(root, "src", "main.js"), "export {};\n");
  await writeFile(path.join(root, "assets", "Mechanized Magic", "Icons", "x.png"), "binary");
  await writeFile(path.join(root, "public", "assets", "mechanized-magic", "hud", "x.png"), "binary");
  await writeFile(path.join(root, "data", "generated.dat"), "binary");

  const tree = await generateProjectTree(root);
  assert.match(tree, /src[\\/]main\.js|main\.js/);
  assert.match(tree, /Mechanized Magic.*contents omitted/s);
  assert.match(tree, /mechanized-magic.*contents omitted/s);
  assert.match(tree, /data.*contents omitted/s);
  assert.doesNotMatch(tree, /x\.png/);
});
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run:

```bash
node --test test/chatgpt-context.test.js
```

Expected: FAIL because `scripts/chatgpt-context-lib.mjs` does not exist.

- [ ] **Step 3: Implement path policy and project-tree generation**

Use Node `fs/promises` and `path`; no new package. Collapse exactly `assets/Mechanized Magic`, `public/assets/mechanized-magic`, and `data`, and skip `.git`, `node_modules`, `dist`, `_chatgpt_bundle`, `.DS_Store`, and `Thumbs.db`.

- [ ] **Step 4: Run the focused tests**

Run:

```bash
node --test test/chatgpt-context.test.js
```

Expected: classification/tree tests PASS.

- [ ] **Step 5: Add failing Git-fixture tests for working-tree and last-commit modes**

Create helpers inside the test file:

```js
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function git(root, ...args) {
  return execFileAsync("git", args, { cwd: root });
}

async function initRepo(root) {
  await git(root, "init");
  await git(root, "config", "user.email", "test@example.com");
  await git(root, "config", "user.name", "Context Test");
}
```

Fixture must contain all mandatory docs, `src/main.js`, `docs/archive/visual/old.md`, and a PNG. Commit baseline, then modify `src/main.js`, modify archive text, and add/change PNG. Assert working-tree bundle:

```js
const result = await buildContextBundle({ rootDir: root, mode: "working-tree", now: new Date("2026-09-03T12:00:00Z") });
assert.match(result.text, /HEX GARDEN - CHATGPT CONTEXT/);
assert.match(result.text, /===== FILE: ART_DIRECTION\.md =====/);
assert.match(result.text, /===== FILE: src\/main\.js =====/);
assert.match(result.text, /public\/icon\.png/);
assert.doesNotMatch(result.text, /===== FILE: public\/icon\.png =====/);
assert.doesNotMatch(result.text, /===== FILE: docs\/archive\/visual\/old\.md =====/);
```

Then commit the changed source and assert `mode: "last-commit"` reports `src/main.js` in `CHANGED FILES` and embeds its current content.

- [ ] **Step 6: Run Git-fixture tests and confirm failure**

Run:

```bash
node --test test/chatgpt-context.test.js
```

Expected: FAIL because Git collection/bundle functions are not implemented yet.

- [ ] **Step 7: Implement Git collection and bundle building**

Use `execFile`/`promisify` with the Git CLI. Working-tree changes come from `git status --porcelain=v1 --untracked-files=all`; latest-commit changes come from `git diff-tree --root --no-commit-id --name-status -r HEAD`. Mandatory docs are always embedded when present. Deduplicate mandatory and changed paths. Deleted files appear in the changed list but are not read.

The bundle header must include the hierarchy warning and `docs/archive/**` historical warning from the spec.

- [ ] **Step 8: Run focused tests until all pass**

Run:

```bash
node --test test/chatgpt-context.test.js
```

Expected: PASS.

---

### Task 3: Add the CLI, package commands, bundle ignore, and generated tree

**Files:**
- Create: `scripts/chatgpt-context.mjs`
- Modify: `package.json`
- Modify: `.gitignore`
- Create/update: `TREE.txt`
- Modify: `test/chatgpt-context.test.js`

**Interfaces:**
- `pnpm context` invokes working-tree mode.
- `pnpm context:last` invokes last-commit mode.
- CLI writes `_chatgpt_bundle/CHATGPT_CONTEXT(YYYYMMDD-HHMMSS).txt` and prints the path.

- [ ] **Step 1: Add a failing CLI-outside-Git test**

Spawn:

```js
await execFileAsync(process.execPath, [scriptPath], { cwd: nonGitTempDir });
```

Assert rejection stderr contains a clear phrase such as `must be run inside a Git working tree` and exit code is non-zero.

- [ ] **Step 2: Run focused tests and confirm failure**

Run:

```bash
node --test test/chatgpt-context.test.js
```

Expected: FAIL because CLI does not exist.

- [ ] **Step 3: Implement `scripts/chatgpt-context.mjs`**

Behavior:

```js
const mode = process.argv.includes("--last-commit") ? "last-commit" : "working-tree";
```

Reject unknown arguments. Resolve repository root with `git rev-parse --show-toplevel`. Refresh/write `TREE.txt` before building the final bundle, create `_chatgpt_bundle`, use local timestamp components for filename, write UTF-8 text, and print the absolute or repository-relative generated path.

- [ ] **Step 4: Wire package scripts and ignore generated bundles**

Add to `package.json`:

```json
"context": "node scripts/chatgpt-context.mjs",
"context:last": "node scripts/chatgpt-context.mjs --last-commit"
```

Add to `.gitignore`:

```text
# Generated ChatGPT context
_chatgpt_bundle/
```

Do not change existing run/test/build scripts.

- [ ] **Step 5: Generate the initial `TREE.txt` structure in the archive workspace**

Because the supplied archive itself has no `.git`, call the library tree generator directly (or an equivalent one-off Node invocation) rather than invoking the Git-based CLI. The resulting `TREE.txt` must show source/test/docs/scripts structure and collapsed binary directories.

- [ ] **Step 6: Run focused context tests**

Run:

```bash
node --test test/chatgpt-context.test.js
```

Expected: PASS.

---

### Task 4: Verify repository behavior and produce the updated handoff archive

**Files:**
- Modify only files required by verification fixes.
- Create user-facing archive outside the project working directory, e.g. `/mnt/data/garden-js-context-ready.rar` or `.zip`.

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: an updated Hex Garden project archive ready to replace the user's local project files while preserving runtime assets.

- [ ] **Step 1: Install dependencies only if the archive workspace lacks them**

Run:

```bash
pnpm install --frozen-lockfile
```

Expected: dependencies resolve according to existing `pnpm-lock.yaml`; no dependency additions.

- [ ] **Step 2: Run the full test suite**

Run:

```bash
pnpm test
```

Expected: all existing gameplay tests plus new context tests PASS.

- [ ] **Step 3: Run the production build**

Run:

```bash
pnpm build
```

Expected: Vite build PASS; no runtime asset changes are required.

- [ ] **Step 4: Audit active-vs-archive visual language**

Run:

```bash
grep -Rni "Mechanized Magic visual replacement\|REGENERATION_PROMPTS" AGENTS.md PROJECT.md CURRENT_STATE.md ART_DIRECTION.md README.md docs/superpowers/specs docs/superpowers/plans || true
```

Expected: no obsolete visual plan is referenced as active. `CURRENT_STATE.md`, `ART_DIRECTION.md`, or `THIRD_PARTY_ASSETS.md` may mention Mechanized Magic only as current temporary runtime art / rejected target direction.

- [ ] **Step 5: Audit runtime assets were preserved**

Run:

```bash
test -f src/art-assets.js
test -f public/assets/mechanized-magic/LICENSE.txt
test -d assets/'Mechanized Magic'
```

Expected: all commands succeed.

- [ ] **Step 6: Package the updated project**

Create the archive from the project root while excluding `node_modules`, `dist`, `_chatgpt_bundle`, and `.git`. Preserve source art and runtime assets because the user asked for the whole working project, not a code-only patch.

- [ ] **Step 7: Final report**

Report:

- which documents moved to archive;
- which active truth documents were created/updated;
- the two context commands;
- test/build results;
- note that the supplied archive has no Git history, so `pnpm context` should be run in the user's actual Git checkout after applying the updated files;
- link the updated archive.
