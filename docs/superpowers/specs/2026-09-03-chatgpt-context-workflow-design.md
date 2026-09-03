# Hex Garden ChatGPT context workflow

## Goal

Add a repository-owned low-token handoff workflow for Hex Garden so a fresh ChatGPT session can continue development from the current codebase without rereading the full project or treating obsolete visual notes as active requirements.

The workflow must preserve working runtime code and assets. This change is documentation/tooling only: it does not replace Mechanized Magic at runtime, alter gameplay, progression, economy, Yandex integration, or choose a final art direction.

## Source-of-truth hierarchy

When project documents disagree, use this order:

1. **Code and tests** — factual current implementation.
2. **`PROJECT.md`** — stable product/rules intent that should not be casually reinterpreted.
3. **`CURRENT_STATE.md`** — concise snapshot of what is implemented now, known temporary states, and the next development focus.
4. **`ART_DIRECTION.md`** — only the currently valid visual decisions and rejected directions.
5. **`AGENTS.md`** — working instructions and constraints for an agent editing the repository.
6. **`README.md` / `RULES_AUDIT.md` / `THIRD_PARTY_ASSETS.md`** — supporting reference documents.
7. **`docs/archive/**`** — historical material only. Never treat it as a current requirement unless the user explicitly asks to revisit it.

If a current active document conflicts with code/tests, do not silently “fix” the implementation to match the document. Surface the mismatch and use code/tests as the factual current state until the user chooses the intended behavior.

## Active documentation responsibilities

### `PROJECT.md`

Keeps stable project identity and gameplay/product contracts. It should describe the game in implementation-neutral language and point to `RULES_AUDIT.md` for the audited low-level rule details.

It must not lock the project to paper, garden, alchemy presentation, Mechanized Magic, or any other final visual theme. Internal atom identifiers and mechanics may remain because they are part of the current code/rules contract even if the presentation is later reskinned.

### `CURRENT_STATE.md`

Keeps a short, factual implementation snapshot:

- stack and run commands;
- current public modes;
- current campaign/endless/economy/solver/platform state;
- current runtime art integration;
- known temporary choices;
- what is explicitly not final;
- next focus.

It is not a design-history log.

### `ART_DIRECTION.md`

Keeps only current art sourcing/direction facts.

Initial state for this change:

- final visual direction is **not selected**;
- a full visual replacement is allowed;
- do not pre-bind the game to paper, garden, alchemy, elements, metals, cozy, casual, or any other theme;
- third-party asset packs are allowed when their commercial-use rights are suitable and documented;
- free and paid assets may be considered, with a practical preference around USD 0–8 and exceptional packages around USD 10 only when justified;
- paid BOOTH listings are excluded because cross-country payment is inconvenient; free BOOTH assets remain acceptable;
- using non-exclusive assets is acceptable; distinct art direction can come from selection, composition, palette, field presentation, animation, typography, and a small set of custom/high-salience elements;
- generating a full production asset library through image generation is rejected because consistency between separate assets proved unreliable;
- the free Mechanized Magic direction was tested in the live Hex Garden UI and rejected as the target style because it reads too much like RPG/strategy HUD and ability icons;
- the previous paper/sketchbook direction remains historical inspiration only, not a current requirement.

Current Mechanized Magic files remain in the runtime until a replacement direction is selected and implemented.

### `AGENTS.md`

Retain current implementation/product constraints that are still true, but replace the obsolete visual policy that bans third-party art. Add the source-of-truth hierarchy and archive rule. Do not duplicate long art-search history here; link to `ART_DIRECTION.md`.

### `TREE.txt`

Machine-generated structural overview for context handoff. It should emphasize code, tests, docs, and scripts while collapsing bulky binary/source-art directories.

## Historical archive

Create `docs/archive/visual/` and move obsolete visual documents into it instead of deleting them:

- `assets/REGENERATION_PROMPTS.md` → `docs/archive/visual/REGENERATION_PROMPTS-paper-sketchbook.md`
- `docs/superpowers/specs/2026-09-01-mechanized-magic-visual-replacement-design.md` → `docs/archive/visual/2026-09-01-mechanized-magic-visual-replacement-design.md`
- `docs/superpowers/plans/2026-09-01-mechanized-magic-visual-replacement.md` → `docs/archive/visual/2026-09-01-mechanized-magic-visual-replacement-plan.md`

Do **not** move or delete:

- `public/assets/mechanized-magic/**`;
- `assets/Mechanized Magic/**`;
- `src/art-assets.js`;
- other runtime/source art files.

The archive is excluded from ordinary ChatGPT bundles.

## Context commands

Add two package scripts matching the Dungeon Logic workflow:

```bash
pnpm context
pnpm context:last
```

They invoke `scripts/chatgpt-context.mjs`.

### `pnpm context`

Builds a handoff bundle for the current working tree:

- refreshes `TREE.txt` first;
- records branch and current HEAD;
- lists tracked changes plus untracked files that are not ignored by Git;
- always embeds the current active source-of-truth files;
- embeds current contents of changed text/source files;
- lists binary asset changes by path without embedding their bytes;
- excludes historical archive contents and generated/bulky data from embedded contents.

### `pnpm context:last`

Builds a handoff bundle around the latest commit:

- refreshes `TREE.txt` first;
- records branch and current HEAD;
- lists files changed by `HEAD` relative to its first parent;
- always embeds active source-of-truth files;
- embeds current `HEAD`/working-copy contents for changed text/source files that still exist;
- marks deleted paths rather than failing.

The mode is intended for a clean checkpoint/commit handoff. If the working tree contains later edits, the bundle header must state that the source-of-truth documents are current working-copy documents while the changed-file list describes the last commit.

## Mandatory bundle contents

Every bundle embeds, in this order when present:

1. `AGENTS.md`
2. `PROJECT.md`
3. `CURRENT_STATE.md`
4. `ART_DIRECTION.md`
5. `TREE.txt`

Supporting files such as `RULES_AUDIT.md`, `THIRD_PARTY_ASSETS.md`, README, source files, tests, or scripts are embedded only when changed, unless a later explicit requirement promotes them to mandatory context.

The bundle header repeats the source-of-truth hierarchy and warns that `docs/archive/**` is historical only.

## Embedded-file policy

Text/source files safe to embed include common project formats such as:

- `.js`, `.mjs`, `.cjs`, `.ts`, `.tsx`;
- `.json`, `.md`, `.txt`;
- `.css`, `.html`, `.svg`;
- `.yaml`, `.yml`, `.toml`, `.xml`;
- extensionless text project files when explicitly whitelisted.

Do not embed binary/media/database bytes. Examples: `.png`, `.jpg`, `.webp`, `.gif`, `.ttf`, `.woff*`, `.bin`, `.dat`, audio/video, archives. Those paths may appear in `CHANGED FILES`.

Always exclude from embedded changed contents:

- `.git/**`;
- `node_modules/**`;
- `dist/**`;
- `_chatgpt_bundle/**`;
- `docs/archive/**`.

The generated bundle itself must not become a Git change.

## `TREE.txt` policy

The generated tree includes meaningful project structure but collapses high-volume content. At minimum, collapse children under:

- `assets/Mechanized Magic/`;
- `data/` generated databases;
- `public/assets/mechanized-magic/`.

Show the directory with an `[contents omitted]` marker so a new session knows the resource exists without receiving thousands of asset filenames.

Exclude `.git`, `node_modules`, `dist`, `_chatgpt_bundle`, and OS/editor junk.

## Output

Bundles are written to:

```text
_chatgpt_bundle/CHATGPT_CONTEXT(YYYYMMDD-HHMMSS).txt
```

Header fields:

- `HEX GARDEN - CHATGPT CONTEXT`
- `Mode: working-tree | last-commit`
- `Branch: ...`
- `Base HEAD: ...`
- `TREE.txt changed: yes | no`

Then:

- source-of-truth warning;
- `CHANGED FILES`;
- `CURRENT FILE CONTENTS`.

The script prints the generated bundle path to stdout.

## Git behavior

The context workflow is Git-based. If invoked outside a Git working tree, it exits non-zero with a clear message instead of generating misleading output.

The conversation archive supplied to ChatGPT intentionally lacks `.git`; tests therefore verify Git behavior using temporary initialized repositories. In the user's actual local repository, the commands operate on the real branch/history.

## Verification

Add Node built-in tests for the context tooling using temporary Git repositories. Verify at least:

- working-tree mode includes mandatory docs and a modified source file;
- archive files are not embedded even when present;
- a changed PNG is listed but its bytes are not embedded;
- last-commit mode identifies files changed in the latest commit;
- generated tree collapses the bulky asset/database directories;
- running outside Git fails clearly.

Run the existing full `pnpm test` suite and `pnpm build` after implementation. This tooling change must not require any runtime/gameplay changes.

## Non-goals

- Do not select or implement the next final visual style.
- Do not remove Mechanized Magic runtime assets yet.
- Do not rename atom IDs or change game rules.
- Do not change campaign progression, economy, scoring, hints, rewarded ads, responsive layouts, persistence, or Yandex SDK behavior.
- Do not archive gameplay/rules documents merely because their prose could later be polished; only the identified obsolete visual documents move in this change.
