import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  buildContextBundle,
  collectLastCommitChanges,
  collectWorkingTreeChanges,
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


const execFileAsync = promisify(execFile);

async function git(root, ...args) {
  return execFileAsync("git", args, { cwd: root });
}

async function initRepo(root) {
  await git(root, "init");
  await git(root, "config", "user.email", "test@example.com");
  await git(root, "config", "user.name", "Context Test");
}

async function writeFixtureFile(root, relativePath, contents) {
  const target = path.join(root, ...relativePath.split("/"));
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, contents);
}

async function createContextRepo() {
  const root = await mkdtemp(path.join(os.tmpdir(), "hex-context-"));
  await initRepo(root);
  const mandatory = {
    "AGENTS.md": "# Agents\n",
    "PROJECT.md": "# Project\n",
    "CURRENT_STATE.md": "# State\n",
    "ART_DIRECTION.md": "# Art\n",
    "TREE.txt": "old tree\n",
  };
  for (const [relativePath, contents] of Object.entries(mandatory)) {
    await writeFixtureFile(root, relativePath, contents);
  }
  await writeFixtureFile(root, "src/main.js", "export const value = 1;\n");
  await writeFixtureFile(root, "docs/archive/visual/old.md", "historical baseline\n");
  await writeFixtureFile(root, "public/icon.png", Buffer.from([0, 1, 2, 3]));
  await git(root, "add", ".");
  await git(root, "commit", "-m", "baseline");
  return root;
}

test("working-tree bundle embeds active truth and changed source but not archive or PNG bytes", async () => {
  const root = await createContextRepo();
  await writeFixtureFile(root, "src/main.js", "export const value = 2;\n");
  await writeFixtureFile(root, "docs/archive/visual/old.md", "SECRET_ARCHIVE_TEXT\n");
  await writeFixtureFile(root, "public/icon.png", Buffer.from("SECRET_PNG_BYTES"));

  const changes = await collectWorkingTreeChanges(root);
  assert.ok(changes.some((entry) => entry.path === "src/main.js"));
  assert.ok(changes.some((entry) => entry.path === "public/icon.png"));

  const result = await buildContextBundle({
    rootDir: root,
    mode: "working-tree",
    now: new Date("2026-09-03T12:00:00Z"),
  });

  assert.match(result.text, /HEX GARDEN - CHATGPT CONTEXT/);
  assert.match(result.text, /===== FILE: ART_DIRECTION\.md =====/);
  assert.match(result.text, /===== FILE: src\/main\.js =====/);
  assert.match(result.text, /public\/icon\.png/);
  assert.doesNotMatch(result.text, /===== FILE: public\/icon\.png =====/);
  assert.doesNotMatch(result.text, /===== FILE: docs\/archive\/visual\/old\.md =====/);
  assert.doesNotMatch(result.text, /SECRET_ARCHIVE_TEXT/);
  assert.doesNotMatch(result.text, /SECRET_PNG_BYTES/);
});

test("last-commit mode reports and embeds files changed by HEAD", async () => {
  const root = await createContextRepo();
  await writeFixtureFile(root, "src/main.js", "export const value = 3;\n");
  await git(root, "add", "src/main.js");
  await git(root, "commit", "-m", "change source");

  const changes = await collectLastCommitChanges(root);
  assert.ok(changes.some((entry) => entry.path === "src/main.js"));

  const result = await buildContextBundle({
    rootDir: root,
    mode: "last-commit",
    now: new Date("2026-09-03T12:00:00Z"),
  });

  assert.match(result.text, /Mode: last-commit/);
  assert.match(result.text, /src\/main\.js/);
  assert.match(result.text, /export const value = 3;/);
});


test("CLI fails clearly outside a Git working tree", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "hex-context-no-git-"));
  const scriptPath = fileURLToPath(
    new URL("../scripts/chatgpt-context.mjs", import.meta.url),
  );

  await assert.rejects(
    execFileAsync(process.execPath, [scriptPath], { cwd: root }),
    (error) => {
      assert.notEqual(error.code, 0);
      assert.match(error.stderr, /must be run inside a Git working tree/i);
      return true;
    },
  );
});
