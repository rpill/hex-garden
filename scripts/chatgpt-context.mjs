#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import {
  buildContextBundle,
  generateProjectTree,
} from "./chatgpt-context-lib.mjs";

const execFileAsync = promisify(execFile);

function parseMode(argv) {
  if (argv.length === 0) return "working-tree";
  if (argv.length === 1 && argv[0] === "--last-commit") return "last-commit";
  throw new Error(`Unknown arguments: ${argv.join(" ")}`);
}

async function resolveGitRoot(cwd) {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["rev-parse", "--show-toplevel"],
      { cwd, encoding: "utf8" },
    );
    return stdout.trim();
  } catch {
    throw new Error("chatgpt-context must be run inside a Git working tree");
  }
}

async function readOptionalText(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function localTimestamp(date) {
  return [
    date.getFullYear(),
    pad2(date.getMonth() + 1),
    pad2(date.getDate()),
    "-",
    pad2(date.getHours()),
    pad2(date.getMinutes()),
    pad2(date.getSeconds()),
  ].join("");
}

async function main() {
  const mode = parseMode(process.argv.slice(2));
  const rootDir = await resolveGitRoot(process.cwd());

  const treePath = path.join(rootDir, "TREE.txt");
  const generatedTree = await generateProjectTree(rootDir);
  const previousTree = await readOptionalText(treePath);
  const treeChanged = previousTree !== generatedTree;
  if (treeChanged) {
    await writeFile(treePath, generatedTree, "utf8");
  }

  const now = new Date();
  const result = await buildContextBundle({ rootDir, mode, now });
  const bundleText = result.text.replace(
    /^TREE\.txt changed: (?:yes|no)$/m,
    `TREE.txt changed: ${treeChanged ? "yes" : "no"}`,
  );

  const outputDir = path.join(rootDir, "_chatgpt_bundle");
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(
    outputDir,
    `CHATGPT_CONTEXT(${localTimestamp(now)}).txt`,
  );
  await writeFile(outputPath, bundleText, "utf8");
  console.log(outputPath);
}

main().catch((error) => {
  console.error(error?.message ?? String(error));
  process.exitCode = 1;
});
