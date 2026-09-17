# Contributing

Small repo, strong laws. Most of them are enforced by `check.sh`; this file explains the intent behind the enforcement.

## Source layout

The rule is SQLite's: develop as parts, ship as one file. `src/` holds the parts; `build.sh` assembles the shipped artifacts; nobody edits an amalgamation.

- `src/meta.html`, `src/chrome.html`, `src/footer.html`: the frame.
- `src/base.css`, `src/forms.css`, `src/views.css`: tokens and chrome, form and photo components, the view and sheet styles.
- `src/views/NN-name.html`: one file per view, numbered in display order. A new view is a new file, never a longer one.
- `src/js/NN-name.js`: one file per concern, in load order — `01-store` (the roster, state, migration, and `SEED_ID`), `02-photos` (the photo store, dithering on intake, and the tray that places one on a page), `03-render` (log, journal, projects), `04-impose` (formats and the imposition solver), `05-press` (the sheet, the fit meter, scaling to fit, and what the draft on screen actually is), `06-desk` (pieces, the tray, the cycle, publishing), `07-shelf` (the archive, the reading view, reprints, and the guard that stops a blank sheet reaching paper), `08-qr` and `09-qr-draw` (the encoder for the back cover, split only to stay under the ceiling), `10-pdf` and `11-pdf-sheet` (a PDF written by hand: the container, then the sheet and the flyer laid onto it), `12-export` (the self-carrying issue and piece bundles), `13-sync` (backup export, merge, import), `14-boot` (router, events, start). `build.sh` concatenates them inside a single IIFE, so they share one scope with no module plumbing: parts on disk, one function at rest. A new concern is a new file.

One consequence of the single IIFE is worth knowing before it costs an afternoon: function declarations hoist across the whole bundle, so any file may call any function. `var` assignments do not. A constant read during start-up must be declared in a file that runs before its reader, which is why `SEED_ID` lives in `01-store.js` rather than next to the export code that names it.
- `src/press.html`: the hand print kit, whole (it fits under the ceiling as one coherent piece).

Hard rules, all checked: **no source file over 300 lines** (split at the next natural boundary: a view, a concern), **outputs are generated** (`index.html`, `press/index.html`, `artifact/*` come from `build.sh`; editing them directly is drift, and check 1 will catch you), **the two presses fold the same way** (the app's `PRESET_A`/`PRESET_B` and the hand kit's `presetA`/`presetB` must be equal; two presses that disagree is a stack of ruined paper), **the press does not creep** (every exported issue carries the press, so its size is paid again in every issue file; the built fragment is ratcheted at 192 KB, and the ceiling that matters — a full issue under a megabyte — is measured on a real exported issue in `test/08-weight.js`), and **built output names no host** (an absolute URL in a built page means the directory can no longer be copied to a thumb drive).

Why two output shapes: the `artifact/` fragments have no doctype because the claude.ai artifact publisher wraps them; the root and `press/` documents carry their own doctype and meta so GitHub Pages and local files render in standards mode with a correct mobile viewport.

## Workflow

Edit `src/`, then:

```
bash build.sh
bash check.sh
```

Commit only when check passes. Once per clone, make that automatic:

```
git config core.hooksPath .githooks
```

`.githooks/pre-commit` runs `check.sh` and refuses the commit if the laws do not hold, naming the rebuild command when the failure is drift. `git commit --no-verify` skips it deliberately.

`check.sh` proves things about the files: that the outputs rebuild from source, that nothing reaches for a network, that the badge is honest, that the two presses fold the same way. It cannot prove the app works. The browser suites in `test/` do that — photos really dither to two levels, the sheet really keeps what was typed, a merge really keeps both people's notes — and they run against the built page in a real browser:

```
npm install playwright
node test/run.js
```

They are deliberately optional. `check.sh` stays instant and dependency-free so the pre-commit hook can run on every commit; the suites need a browser, so they run when the app's behaviour changed. Run them before any commit that touches `src/js/` or the press.

Seven suites: `01-features` (names, photos, sync), `02-robustness` (corrupt storage, old backups, missing blobs, a phone-sized window), `03-publication` (the desk, the bell, two issues coexisting, format re-flow, the fit meter), `04-selfcarry` (an exported issue opened on a machine with no storage of its own, which then makes the next issue), `05-qr` (the back cover's symbol, compared module for module against `test/qr-fixtures.json`), `06-pdf` (the written PDF, parsed back as bytes), and `07-scene` (a scene of four, which is where the two-person assumptions showed).

`06-pdf` is written the way it is because a hand-rolled PDF fails in three classic ways — an xref offset that misses its object, a `/Length` that disagrees with its stream, and a transform that never lands — and each produces a file some readers open and others reject. So the suite parses the bytes rather than trusting them. The content streams are left uncompressed, which keeps them readable to that suite and costs a few kilobytes on a file whose whole purpose is to be printed.

Those fixtures were produced by an independent implementation — the `qrcode` Python library, byte mode, error correction L — because a QR symbol either scans or it does not, and "looks about right" is not a test. Regenerate them only if the encoder's contract changes on purpose, and say so in the commit.

The hosted job in `.github/workflows/check.yml` runs the same script and nothing else, so there is no second, secret standard. It is deliberately free of third-party actions: `check.sh` needs bash and the repo, and a job that enforces a page making zero external requests should not need a network dependency to start. The hook is the copy that matters, because it runs on the machine where the work happens and cannot be switched off by a hosting account.

## The gate

No federation software gets built until a real scene ships Issue #2 — and per `PLAN.md`, most of it is now struck rather than merely waiting. Rooms, vouching, corkboards, the protocol, the cooperative: anything a second scene would touch is not this project's to build.

The press is not behind the gate. It is the thing the gate is waiting on, and it may grow whatever a scene of two needs to actually publish. But it grows under the same laws as everything else here: source in parts, outputs generated, the badge honest, the app small enough to ride inside its own output, and **no capability that does not end in paper**.

## Commits

Kernel register: an imperative subject line naming the subsystem, a body that says what changed and why, no bullets, no emoji, no attribution trailers.

## Development tooling

This repo is developed with AI assistance (Claude Code). Architecture decisions, the charter, and the design documents are human-judged; the assistant drafts, implements, and verifies under review. Per house convention there are no AI co-author trailers; disclosure lives here instead.
