# Contributing

Small repo, strong laws. Most of them are enforced by `check.sh`; this file explains the intent behind the enforcement.

## Source layout

The rule is SQLite's: develop as parts, ship as one file. `src/` holds the parts; `build.sh` assembles the shipped artifacts; nobody edits an amalgamation.

- `src/meta.html`, `src/chrome.html`, `src/footer.html`: the frame.
- `src/base.css`, `src/forms.css`, `src/views.css`: tokens and chrome, form and photo components, the view and sheet styles.
- `src/views/NN-name.html`: one file per view. The press is the surface and is always on screen; every other view opens as a drawer over it, and the landing replaces both when an issue file opens. A new view is a new file, never a longer one.
- `src/js/NN-name.js`: one file per concern, in load order — `01-store` (the roster, state, migration, and `SEED_ID`), `02-photos` (the photo store, dithering on intake, and the strip that glues one to a page), `03-render` (the roster and the scraps), `04-impose` (formats and the imposition solver), `05-press` (the sheet, the fit meter, scaling to fit, and what the draft on screen actually is), `05a-paste`/`05b-elrender`/`05c-pasteedit`/`05d-inspector`/`05e-drop`/`05f-fit`/`05g-stamps`/`05h-gen` (the paste-up: its model and undo stack, one renderer shared by the screen and the archive, the drag-resize-rotate gestures, the controls that are not geometry, what lands on the sheet by drag or paste, the fit meter, the stamps as one geometry drawn as SVG and as PDF, and the copier generation), `06-desk` and `06a-pour` (pieces, the tray, the cycle, publishing, and pouring the tray onto the pages), `07-shelf` (the archive, the reading view, reprints, and the guard that stops a blank sheet reaching paper), `07a-landing` (an issue file opens as the issue, chrome off, and the press it rode in offers itself at the end), `07b-pages` (the pages as made, read-only, shared by the file, the shelf and the printed sheet), `08-qr` and `09-qr-draw` (the encoder for the back cover, split only to stay under the ceiling), `10-pdf`, `10a-pdf-ttf`, `11-pdf-sheet`, `11a-pdf-paste`, `11b-pdf-flyer` and `11c-pdf-stamps` (a PDF written by hand: the container, the page's own typeface parsed and embedded as a TrueType subset, the imposed sheet, the paste-up drawn over it with the same face and metrics the screen used, the noticeboard flyer, and the stamps and toner), `12-export` (the self-carrying issue and piece bundles), `13-sync` (backup export, merge, import), `14-boot` and `14a-bar` (the drawers, events, start; the zine's name edited in the bar). `build.sh` concatenates them inside a single IIFE, so they share one scope with no module plumbing: parts on disk, one function at rest. A new concern is a new file. The build drops whole-line `//` comments from the shipped script: they are for whoever works on the press, and every issue file would otherwise carry them to every reader. Write an explanation on its own line, never trailing code, and it stays in the source and out of the file. `src/fonts/` holds the one typeface the press carries (Anton, OFL, subset with the command in its README); `build.sh` inlines it as a data URL, and the PDF writer reads it back out of the page's own stylesheet, so there is one copy of the face and it is the one every screen and every sheet uses.

One consequence of the single IIFE is worth knowing before it costs an afternoon: function declarations hoist across the whole bundle, so any file may call any function. `var` assignments do not. A constant read during start-up must be declared in a file that runs before its reader, which is why `SEED_ID` lives in `01-store.js` rather than next to the export code that names it.
- `src/press.html`: the hand print kit, whole (it fits under the ceiling as one coherent piece).

Hard rules, all checked: **no source file over 300 lines** (split at the next natural boundary: a view, a concern), **outputs are generated** (`index.html`, `press/index.html`, `artifact/*` come from `build.sh`; editing them directly is drift, and check 1 will catch you), **the two presses fold the same way** (the app's `PRESET_A`/`PRESET_B` and the hand kit's `presetA`/`presetB` must be equal; two presses that disagree is a stack of ruined paper), **a paste-up is stored in fractions of its panel** (never points, or changing format would strand every cutting), **the press does not creep** (every exported issue carries the press, so its size is paid again in every issue file; the built fragment is ratcheted at 256 KB, derived as the megabyte ceiling less eight photographs, and the ceiling that matters — a full issue under a megabyte — is measured on a real exported issue in `test/08-weight.js`), **built output names no host** (an absolute URL in a built page means the directory can no longer be copied to a thumb drive), and **the page carries its face** (the built page holds the `@font-face`; without it a handed-on issue would reflow on any machine that lacked the font, and the PDF could not embed what the screen showed).

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

Thirteen suites: `01-features` (names, photos, sync), `02-robustness` (corrupt storage, old backups, missing blobs, a phone-sized window), `03-publication` (the desk, the bell, two issues coexisting, format re-flow, the fit meter), `04-selfcarry` (an exported issue opened on a machine with no storage of its own, which then makes the next issue), `05-qr` (the back cover's symbol, compared module for module against `test/qr-fixtures.json`), `06-pdf` (the written PDF, parsed back as bytes), `07-scene` (a scene of four, which is where the two-person assumptions showed), `08-weight` (publishes an issue and weighs it, which is where the size ceilings are actually held), `09-pasteup` (dragging, turning, typing, undo, and whether a collage survives a change of format and reaches the paper), `10-typeface` (the font in the PDF is the font in the page byte for byte, the screen's ruler agrees with the PDF's width table, the first baseline sits where the browser puts it, and № reaches the paper as №), and `11-edges` (the bugs people walk into without trying: bylines on a scene of one or three, pulling scraps twice, pieces that did not fit at the bell, a format change and the back cover, keys typed into a text box, undo, a transparent cut-out, and a friend's zine opened on a machine that runs its own), and `12-loop` (an issue handed on, a piece made from the file under the maker's own name, sent back, and taken in by opening it), and `13-pages` (the file opens on the pages as made, a cutting across the gutter prints on both pages, and back issues ride with their covers only).

A gesture test aims at real pixels. The sheet sits well below the fold, so anything driving the mouse has to `scrollIntoViewIfNeeded()` first or it will click on nothing and report a bug that is not there.

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
