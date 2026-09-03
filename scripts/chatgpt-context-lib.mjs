import { execFile } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
  ".svg",
]);

const EXTENSIONLESS_TEXT_FILES = new Set([
  ".gitignore",
  "AGENTS",
  "LICENSE",
]);

const EXCLUDED_PREFIXES = [
  ".git/",
  "node_modules/",
  "dist/",
  "_chatgpt_bundle/",
  "docs/archive/",
];

const TREE_SKIPPED_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  "dist",
  "_chatgpt_bundle",
]);

const TREE_SKIPPED_FILES = new Set([".DS_Store", "Thumbs.db"]);

const COLLAPSED_TREE_PATHS = new Set([
  "assets/Mechanized Magic",
  "public/assets/mechanized-magic",
  "data",
]);

function normalizeRelativePath(relativePath) {
  return String(relativePath).replaceAll("\\", "/").replace(/^\.\//, "");
}

export function isBundleExcludedPath(relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  return EXCLUDED_PREFIXES.some(
    (prefix) => normalized === prefix.slice(0, -1) || normalized.startsWith(prefix),
  );
}

export function isEmbeddableTextPath(relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  if (isBundleExcludedPath(normalized)) return false;
  const basename = path.posix.basename(normalized);
  const extension = path.posix.extname(normalized).toLowerCase();
  if (TEXT_EXTENSIONS.has(extension)) return true;
  return extension === "" && EXTENSIONLESS_TEXT_FILES.has(basename);
}

async function renderTreeDirectory(rootDir, relativeDir, prefix, lines) {
  const absoluteDir = path.join(rootDir, ...relativeDir.split("/").filter(Boolean));
  const entries = (await readdir(absoluteDir, { withFileTypes: true }))
    .filter((entry) => {
      if (TREE_SKIPPED_FILES.has(entry.name)) return false;
      if (entry.isDirectory() && TREE_SKIPPED_DIRECTORIES.has(entry.name)) return false;
      return true;
    })
    .sort((left, right) => {
      if (left.isDirectory() !== right.isDirectory()) return left.isDirectory() ? -1 : 1;
      return left.name.localeCompare(right.name);
    });

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const isLast = index === entries.length - 1;
    const connector = isLast ? "└── " : "├── ";
    const childPrefix = prefix + (isLast ? "    " : "│   ");
    const childRelative = normalizeRelativePath(
      relativeDir ? `${relativeDir}/${entry.name}` : entry.name,
    );

    if (entry.isDirectory()) {
      if (COLLAPSED_TREE_PATHS.has(childRelative)) {
        lines.push(`${prefix}${connector}${entry.name}/ [contents omitted]`);
      } else {
        lines.push(`${prefix}${connector}${entry.name}/`);
        await renderTreeDirectory(rootDir, childRelative, childPrefix, lines);
      }
    } else {
      lines.push(`${prefix}${connector}${entry.name}`);
    }
  }
}

export async function generateProjectTree(rootDir) {
  const lines = [`${path.basename(path.resolve(rootDir))}/`];
  await renderTreeDirectory(path.resolve(rootDir), "", "", lines);
  return `${lines.join("\n")}\n`;
}


const execFileAsync = promisify(execFile);

const MANDATORY_CONTEXT_FILES = Object.freeze([
  "AGENTS.md",
  "PROJECT.md",
  "CURRENT_STATE.md",
  "ART_DIRECTION.md",
  "TREE.txt",
]);

async function git(rootDir, ...args) {
  const { stdout } = await execFileAsync("git", args, {
    cwd: rootDir,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  return stdout;
}

export async function collectWorkingTreeChanges(rootDir) {
  const output = await git(
    rootDir,
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
    "-z",
  );
  if (!output) return [];

  const tokens = output.split("\0");
  const changes = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) continue;
    const status = token.slice(0, 2);
    const relativePath = normalizeRelativePath(token.slice(3));
    changes.push({ status, path: relativePath });
    if (status.includes("R") || status.includes("C")) {
      index += 1;
    }
  }
  return changes;
}

export async function collectLastCommitChanges(rootDir) {
  const output = await git(
    rootDir,
    "diff-tree",
    "--root",
    "--no-commit-id",
    "--name-status",
    "-r",
    "-z",
    "HEAD",
  );
  if (!output) return [];

  const tokens = output.split("\0").filter(Boolean);
  const changes = [];
  for (let index = 0; index < tokens.length; ) {
    const status = tokens[index++];
    if (!status) continue;
    if (status.startsWith("R") || status.startsWith("C")) {
      const oldPath = tokens[index++];
      const newPath = tokens[index++];
      if (newPath) {
        changes.push({
          status,
          path: normalizeRelativePath(newPath),
          from: normalizeRelativePath(oldPath ?? ""),
        });
      }
      continue;
    }
    const relativePath = tokens[index++];
    if (relativePath) {
      changes.push({ status, path: normalizeRelativePath(relativePath) });
    }
  }
  return changes;
}

async function readTextIfPresent(rootDir, relativePath) {
  try {
    return await readFile(path.join(rootDir, ...relativePath.split("/")), "utf8");
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "EISDIR") return null;
    throw error;
  }
}

function formatChangedFiles(changes) {
  if (changes.length === 0) return "(none)";
  return changes
    .map((entry) => {
      if (entry.from) return `${entry.status}\t${entry.from} -> ${entry.path}`;
      return `${entry.status}\t${entry.path}`;
    })
    .join("\n");
}

function uniquePaths(paths) {
  return [...new Set(paths.filter(Boolean).map(normalizeRelativePath))];
}

export async function buildContextBundle({ rootDir, mode, now = new Date() }) {
  if (mode !== "working-tree" && mode !== "last-commit") {
    throw new RangeError(`Unknown context mode: ${mode}`);
  }

  const resolvedRoot = path.resolve(rootDir);
  const branchRaw = (await git(resolvedRoot, "branch", "--show-current")).trim();
  const branch = branchRaw || "(detached HEAD)";
  const head = (await git(resolvedRoot, "rev-parse", "--short", "HEAD")).trim();
  const changes =
    mode === "working-tree"
      ? await collectWorkingTreeChanges(resolvedRoot)
      : await collectLastCommitChanges(resolvedRoot);

  const generatedTree = await generateProjectTree(resolvedRoot);
  const existingTree = await readTextIfPresent(resolvedRoot, "TREE.txt");
  const treeChanged = existingTree !== generatedTree;
  const workingTreeDirty =
    mode === "last-commit" &&
    (await git(
      resolvedRoot,
      "status",
      "--porcelain=v1",
      "--untracked-files=all",
    )).trim().length > 0;

  const header = [
    "HEX GARDEN - CHATGPT CONTEXT",
    `Mode: ${mode}`,
    `Branch: ${branch}`,
    `Base HEAD: ${head}`,
    `TREE.txt changed: ${treeChanged ? "yes" : "no"}`,
    `Generated: ${now.toISOString()}`,
    "",
    "SOURCE OF TRUTH",
    "1. Code and tests — factual current implementation.",
    "2. PROJECT.md — stable product/rules intent.",
    "3. CURRENT_STATE.md — current implementation snapshot.",
    "4. ART_DIRECTION.md — only active visual-direction decisions.",
    "5. AGENTS.md — working agent instructions.",
    "6. README.md / RULES_AUDIT.md / THIRD_PARTY_ASSETS.md — supporting references.",
    "7. docs/archive/** — historical only; never treat as active requirements unless explicitly revived by the user.",
  ];
  if (workingTreeDirty) {
    header.push(
      "",
      "NOTE: CHANGED FILES below describe the latest commit, while mandatory source-of-truth documents and embedded current file contents come from the current working copy.",
    );
  }

  const changedPaths = changes.map((entry) => entry.path);
  const pathsToEmbed = uniquePaths([
    ...MANDATORY_CONTEXT_FILES,
    ...changedPaths.filter(
      (relativePath) =>
        !isBundleExcludedPath(relativePath) && isEmbeddableTextPath(relativePath),
    ),
  ]);

  const contentSections = [];
  for (const relativePath of pathsToEmbed) {
    if (isBundleExcludedPath(relativePath)) continue;
    const contents = await readTextIfPresent(resolvedRoot, relativePath);
    if (contents === null) continue;
    contentSections.push(
      `===== FILE: ${relativePath} =====\n${contents.replace(/\s*$/, "")}\n===== END FILE: ${relativePath} =====`,
    );
  }

  const text = [
    ...header,
    "",
    "CHANGED FILES",
    formatChangedFiles(changes),
    "",
    "CURRENT FILE CONTENTS",
    contentSections.length > 0 ? contentSections.join("\n\n") : "(none)",
    "",
  ].join("\n");

  return { text, treeChanged };
}
