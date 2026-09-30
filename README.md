# stoop

[![check](https://github.com/ampactor-labs/stoop/actions/workflows/check.yml/badge.svg)](https://github.com/ampactor-labs/stoop/actions/workflows/check.yml)
[![License: AGPL-3.0-or-later](https://img.shields.io/badge/license-AGPL--3.0--or--later-blue.svg)](#license)

A one-file web app that gathers pieces from a small group, lays out an issue and prints it as a folded zine or an exact PDF for a copy shop. A zine is a small self-published magazine, usually photocopied and folded by hand. Each issue it exports is one HTML file holding the issue, its back issues and a working copy of the app for the next one. It needs no server or account: the app is one page of plain HTML and JavaScript that makes no network requests.

**Status: shipping.** Everything [PLAN.md](PLAN.md) calls for is built and live; the one measure the project keeps, a scene it did not found shipping its Issue #2, has not happened yet.

Live: https://ampactor.dev/stoop/

## Quick start

The app runs at https://ampactor.dev/stoop/. To run your own copy:

```sh
git clone https://github.com/ampactor-labs/stoop.git
cd stoop
```

Open `index.html` in a browser; there is nothing to install or build. It opens on the press, which shows the cover of issue №01 followed by seven blank pages, and two sample pieces wait in the desk's tray. Open **desk**, press **FLOW ONTO THE PAGES**, then press **RING THE BELL**. Issue №01 moves to the shelf, where **PDF** saves the sheet ready to print and fold, and **EXPORT** saves the issue as a single HTML file.

## Usage

The press is the one surface. The pages sit in the middle at the largest size the screen allows; a rail of tools stands beside them; a strip above them has a chip for every page, to jump to or to drag into another place; and a sheet of controls for whatever is selected opens beside the pages on a laptop and from the bottom on a phone. Everything else opens as a drawer over it, in the order the cycle runs: **scraps**, **desk**, **paper**, **shelf** and **scene**, a tab bar on a phone. **hand it on** saves the latest issue as a file. [docs/TABLE.md](docs/TABLE.md) says why it is laid out this way.

### Writing and the desk

**scraps** keeps anything worth keeping: a line, a page or a photograph. Once a cycle, **PULL IN THE NEW SCRAPS** at the desk draws in whatever was written since the last issue shipped, so issue two cannot reprint issue one. A scrap with a title, or one over 280 characters, becomes a piece of its own, and the shorter ones run together as one SCRAPS column. The desk also takes a piece typed straight into it: a title, a kind (essay, photos, log, mix, recipe or letters) and a body, bylined to whoever is writing. Anything can go in unsigned.

A scene is however many people it is. The roster under **scene** takes as many names as write for the zine, and a byline that arrives in a piece file from somebody else's copy keeps its name. Whoever has the desk this cycle reads the tray, cuts what will not run and can add an editor's note. A cut piece stays in the tray, struck through, and can run next cycle. **RING THE BELL** puts the issue on the shelf as it stands and hands the desk to the next person on the roster, so a pair alternates and a scene of four sees it come back every fourth issue. The bell has a date, and **ADD TO A CALENDAR** saves it as a calendar file with a reminder the day before.

### The press and the paste-up

The press shows the pages right way up, in reading order. A page clips what does not fit, as a printer would, and the fit meter counts the words that will not print. A piece too long for its page runs on to the next, with a line saying where it went.

On top of the pages sits the paste-up: cuttings placed by hand, the way a zine is glued together before it goes through a photocopier. A cutting dropped on a page can be dragged anywhere and turned to any angle, over whatever is already there. Text comes in seven voices: typewriter, headline, a felt-tip marker, stencil with bridges cut through the letters, a ransom note cut letter by letter from four faces, and a plain sans and serif for the parts of a zine that read like a magazine. A line can sit left, centred or right, be set in capitals or as typed, and be drawn as outlines. Photographs, boxes, rules nine stamps (FREE, TAKE ONE, PHOTOCOPY THIS, №, an arrow, a star, tape, a staple and a barcode that scans nothing) and a QR code for any link, which does scan, complete the kit, with **+ BLOCK** for the parts of a magazine made from the rest of it: page numbers that know which page they are on, a contents list and credits built from the pages as they stand, and a pulled quote, in black or in any of seven inks a print shop is likely to have loaded (red, pink, orange, yellow, green, blue and purple), on the page or knocked out of a block. A page can be printed on a colour, pink, yellow, blue, green, orange, lavender or kraft, as a flood under everything on it. Drag to move, double-click to type, use the arrow keys to nudge and Ctrl-D to duplicate; undo and redo keep 50 steps. A cutting dragged across the gutter lands on both pages of the spread, and a faint line on each page shows where a home printer stops reaching. **GEN** sets how many times the issue has been through a copier, from GEN 0 (the master) to GEN 3 (a laundromat copy of a copy). Its wear comes from fixed seeds, so it prints the same everywhere. Cuttings are stored as fractions of their page, never in points, so a collage survives a change of format the same way a paragraph does.

Photographs go on the page as they were taken, in colour, at up to 2400 pixels on the long edge, and reach the PDF as the same JPEG, so the colour on paper is the colour on screen. A cut-out PNG keeps its transparency. The camera's own file is never kept: the photo is redrawn on the way in, which leaves behind where it was taken and everything else a phone writes into a picture. The device keeps the redrawn original, so a photo can be lightened or darkened later, turned black and white, or screened the way a photocopier would: dithered to grain, halftone dots or hard contrast, which a screened photo can then print in any of the inks. A clean scan, for a drawing or a page photographed on a table, turns its tinted paper white and its ink black and keeps the colour of whatever was drawn in colour. Every look can be turned back. A photograph can fill its page edge to edge, as a cutting under everything glued on it or as the page's own photograph behind its heading and words, which can be set in white over it. A photograph can carry a description for screen readers, which the text view also prints.

### Paper

Imposition is the arrangement of pages on a printed sheet so that they come out in order once the sheet is folded and cut. The press imposes the same pages in sixteen formats. One sheet of eight panels with a single cut prints on Letter or A4. A saddle-stitched booklet runs from 8 to 32 pages, four at a time, on Letter or A4; past 32 a desk stapler no longer reaches through the fold. Saddle stitch nests folded sheets inside each other and staples them through the fold. The nested sheets form one signature, the printer's word for a group of pages printed together and folded as a unit. Changing the format re-flows the same pieces with nothing retyped.

**paper** asks for a test sheet first and offers **SWAP FOLD** when the page numbers come out shuffled. **SAVE PDF** writes an exact PDF at the paper's size, with nothing left for a print dialog to change, so it can go straight to a copy shop. **PDF FOR A PRINT SHOP** is for a shop that folds and trims its own: every page on a sheet of its own, in reading order, with an eighth of an inch of bleed that page colours, full-page photographs and cuttings over the edge run into, and crop marks. **PRINT FROM THE BROWSER** uses the browser's own dialog, and **FLYER + TEAR TABS** writes a PDF flyer whose tear-off tabs carry the scene's address. When the scene has an address, the back cover carries it as text and as a QR code the page draws itself.

### The shelf and handing it on

The shelf keeps every issue as it shipped, with its own pages, format and fold, so a back issue reprints correctly whatever the current draft is set to. Each issue has **READ**, **REPRINT**, **PDF**, **SHOP PDF** and **EXPORT**.

**hand it on** saves the latest issue as one HTML file named for the scene and the issue, such as `stoop-zine-01.html`. Opened on a machine that has never seen the app, it shows the issue page by page, with the text one tap away, and then offers the press it rode in for the next issue. It carries every back issue too, each with only its cover photograph, so the file does not grow with the shelf until nobody can send it. **SEND** in the tray saves a single piece as its own file, which carries the press as well, and **TAKE IN** under **scene** takes in a piece or an issue somebody sent; taking the same file twice does nothing.

**MAKE THE SITE (.ZIP)** on the shelf writes the folder the back covers point at: every issue as the page its QR code leads to, with a PDF beside each and the newest at the root. Beside them go `feed.xml`, an Atom feed with one entry per issue and the PDF as its enclosure, so the bell rings in a feed reader; `catalog.csv`, the shelf as a library catalogues it, one row per issue; and each cover photograph as a JPEG beside its issue, so a shared link shows it. It works on any host that serves plain files, such as Neocities, Netlify Drop or GitHub Pages, or from a thumb drive.

**THE CARD** under **desk** is the catalogue record zine libraries are standardising on, the twelve elements of xZINECOREx. Six are read off the issue: the title, the creators, the publisher, the contributors, the date and the physical description ("2.75 × 4.25 in, 8 pages, one sheet folded and cut"). Six are typed once and stay for the next issue: place, language, subjects, rights, see also, and a union id left blank for a library to fill. The card goes with the issue at the bell, rides in the file's head as JSON-LD so a hosted issue is machine-readable, and **COLOPHON** under **+ BLOCK** lays it out as a cutting.

When the scene has an address, the back cover also says where to write back: the issue's own address with `#reply` after it. Opened there, the file asks who is writing and opens the press on the piece form, so a reply from paper is a piece file, sent back the same way, with no server anywhere in the loop.

**BACKUP** under **scene** saves everything, photographs included, as one JSON file. **MERGE ONE IN** merges another device's backup by id and keeps the newer copy of anything both hold, and a merge never overwrites a published issue. The shelf says when this browser was last backed up, because until then the browser holds the only copy.

## How it works

The app is one HTML page. `build.sh` assembles it from the parts in `src/`: the views, the stylesheets, two fonts and one script file per concern, each under 300 lines. It concatenates the scripts inside a single function, so they share one scope with no module system, the way SQLite ships its many source files as one amalgamation. It drops whole-line comments from the shipped script and all comments from the stylesheet, because every issue file carries the page.

State lives in the browser. The roster, the scraps, the pieces, the draft and every published issue sit in `localStorage`, and photographs sit in IndexedDB; both are the browser's own storage for a site. An exported issue is the same page with the issue, its back issues, the roster and the photographs it needs embedded in one `<script type="application/json" id="stoop-seed">` element. [FORMAT.md](FORMAT.md) specifies that file, the imposition and the address, so that somebody can write another press that reads and writes the same files without reading this source.

Two decisions shape the rest:

- **The issue carries the press.** A file that is also a working press means the next issue needs no server and no address, only the file. None of the tools surveyed in [PLAN.md](PLAN.md) do this. It also means the press's size is paid again in every file anyone sends. There is no ceiling on that: `test/08-weight.js` publishes issues, weighs them and holds a file to carrying the press once, each photograph once and nothing the issue does not need.
- **Paper matches the screen.** The page carries its two typefaces, Anton for headlines and Knewave for the marker, cut down to Latin characters and embedded in the page itself. The hand-written PDF writer reads the same font bytes back out of the stylesheet and embeds them, and a cutting records the line breaks its browser made. A line on paper is therefore the line on screen, letter for letter, even on a machine that has never had the fonts.

### What a file weighs

`test/08-weight.js` publishes two issues through the app and measures the exported files. From a run on 28 September 2026:

| Measured | Size |
| --- | --- |
| The press, carried by every issue file | 283 KB |
| One photograph (a generated 3000 by 2250 test image), kept in colour at 2400 px on its long edge | 337 KB |
| A full 8-page issue with a photograph on every page | 2,986 KB |

An issue of plain text is almost all press, and an issue full of photographs is almost all photographs. The built page is 287,352 bytes, or 99,052 bytes gzipped (`wc -c artifact/index.html` and `gzip -c artifact/index.html | wc -c`).

### One cycle

```text
the scraps     lines, pages, photos: everything you wrote down
     |
the desk       SUBMIT a piece, or PULL IN THE NEW SCRAPS
     |         CUT what does not run, write the editor's note
     |         FLOW ONTO THE PAGES
     |         RING THE BELL: onto the shelf, and the desk moves on
     |
the press      paste it up, then PAPER: test sheet, swap fold, SAVE PDF, fold
     |
HAND IT ON     the latest issue as one file that is also a press
     |
the shelf      MAKE THE SITE: every issue where its back cover points
```

Then the cycle starts again with the next issue.

### Why it exists

The project starts from an argument about media: that a small group making a periodical for itself, owned in common and aimed at paper, is a third form beside mass media and social media. [docs/FOLK-MEDIA.md](docs/FOLK-MEDIA.md) makes that argument and sets out the evidence behind its timing. There is no minimum scene size: the desk goes round whoever is on the roster, and a scene with no running costs has no dues to collect. The project expects its first scene to be two people and a copier, because two people ship on a deadline and eight people with no habit miss the first bell.

The hand kit at [press/](press/index.html) is the same one-sheet layout with fold diagrams and starter prompts, printable with no app at all.

## Project layout

```text
index.html         the app, built from src/ (the page GitHub Pages serves)
press/index.html   the hand print kit, built from src/press.html
artifact/          both pages as fragments for the claude.ai artifact publisher
src/               the parts: views/, js/ (one file per concern), stylesheets, fonts/
test/              twenty-four browser suites and their runner, run.js
build.sh           assembles src/ into the four built files
check.sh           the repository's laws, run by CI and the pre-commit hook
docs/              longer write-ups linked from this README
```

The documents beside the code:

- [FORMAT.md](FORMAT.md) specifies the issue file, the imposition and the address, so somebody can implement a stoop press without reading this source.
- [PLAN.md](PLAN.md) is the route in seven phases, each with a gate the build can check. Phases 0 through 5 are built and phase 6 is written; its gate is a scene the project did not found shipping its second issue.
- [DESIGN.md](DESIGN.md) is the machine as imagined before anything shipped. Its objects and loops still describe the app, and PLAN.md supersedes its staging.
- [CHARTER.md](CHARTER.md) is the constitution of a federation that was never built, kept as a template a scene may adopt. Its Article III still binds, through the licence and `check.sh`.
- [CONTRIBUTING.md](CONTRIBUTING.md) explains the source layout, the workflow and why each law in `check.sh` exists.
- [tool/SPEC.md](tool/SPEC.md) specified a scene tool before PLAN.md existed. It is superseded: its desk and shelf now exist in the app, and its federation half is struck.
- [docs/FOLK-MEDIA.md](docs/FOLK-MEDIA.md) is the argument the project was built on.
- [docs/MOAT.md](docs/MOAT.md) surveys the field as of September 2026 and designs the next stretch of the route: the catalogue card and the feed, riso plates, the distro, the pen, your own faces.

## Deploy

GitHub Pages serves the repository from `main`: the app at https://ampactor.dev/stoop/ and the hand print kit at https://ampactor.dev/stoop/press/. Both are static files, with no backend to run and nothing to sign in to. There is no deploy workflow. The built files are committed, so a change reaches the site when its rebuilt `index.html` and `press/index.html` land on `main`. On 27 September 2026 both live pages were byte-identical to the files on `main`.

Hosting the page does not publish what anyone writes in it. The words and photographs stay in the browser that holds them, and the page makes no network requests. `check.sh` guards that by failing on any `http` link or `@import` in `src/` and any absolute URL in the built pages. Local storage and no accounts are the whole of its privacy policy.

The `artifact/` copies are the same two pages without a doctype, because the claude.ai artifact publisher wraps them in its own.

## Testing

`check.sh` enforces the repository's laws in under a second. It needs bash, `perl`, and the GNU versions of `sed` and `base64`:

```sh
bash check.sh
```

It prints `check: all laws hold` when all eight of these hold:

1. the committed built files rebuild byte for byte from `src/`;
2. no file in `src/` is over 300 lines;
3. nothing in `src/` loads anything over `http` or through `@import`;
4. the page weight printed in the footer is within 3 KB of the built page;
5. the app's two one-cut folds match the hand kit's;
6. `LICENSE`, `LICENSE-docs` and both font licences are present;
7. the built pages contain no absolute URL;
8. the built page carries both typefaces.

There is no size law. One used to hold the built page to 256 KB so that an issue with a photograph on every page stayed under a megabyte, and it held every photograph to black and white.

GitHub Actions runs it on every push and pull request ([check.yml](.github/workflows/check.yml), with no third-party actions). `git config core.hooksPath .githooks` makes a pre-commit hook run it before each commit.

The browser suites in `test/` check that the app behaves. They drive the built `index.html` in Chromium through Playwright:

```sh
npm install playwright
npx playwright install chromium
node test/run.js
```

`npm install playwright` writes `package.json`, `package-lock.json` and `node_modules/`, all ignored by git. `PLAYWRIGHT_CHROMIUM` points the runner at a Chromium binary you already have. The twenty-four suites cover the parts that would be easy to fake, among them:

- two issues on the shelf, each keeping its own words;
- the same pieces re-flowing into another format with nothing retyped;
- the fit meter naming the words that will not print;
- an exported issue opening on a machine with no storage of its own and making the next issue;
- the back-cover QR code matching an independent encoder square for square;
- the PDF surviving a parse of its bytes and embedding the same fonts as the page;
- a photograph reaching the PDF in colour as the same JPEG, cuttings in ink and pages printed on a colour, on screen, on paper and in the file handed on;
- the card's JSON-LD parsing out of the file and naming the issue, the site's feed carrying an entry per issue, and a file opened at `#reply` ending at SEND.

On 28 September 2026, in a cloud container with Chromium, a full run passed all 346 checks. One check, "PRINT SHOWS THE IMPOSED SHEET ALONE" in `01-features`, has failed once on a slow machine: it inspects the print zone while the app's 800 ms clean-up timer is running, so the timer can empty the zone before the check reads it.

CI runs `check.sh` and nothing else, the same check the pre-commit hook runs. [CONTRIBUTING.md](CONTRIBUTING.md) asks for the browser suites before any commit that touches `src/js/` or the press. Nothing tests printing on real paper, folding and cutting, a copy shop's output, a real phone (the suites use a phone-sized window), browsers other than Chromium, or scanning the QR code with a camera.

## Limitations

Everything lives in the browser that made it. There is no server to fall back on, and the browser keeps this data for one web address only, so a backup file is the only copy that outlives a cleared cache, and moving between a phone and a laptop means exporting and merging by hand.

- **The PDF only handles Western European letters.** The typefaces are cut down to Latin, and the PDF writer encodes text as WinAnsi, the Windows character set for Western European languages. A letter outside it (ł, ş, Greek, Cyrillic, any emoji) comes out of SAVE PDF as a question mark.
- **Sync is a file handed over.** Two people on two devices see each other's work only when one hands the other a file (a backup, a piece or an issue) and it is taken in.
- **A local copy and the hosted page keep their work apart.** Work done in `index.html` opened from disk does not appear at https://ampactor.dev/stoop/, and the other way round. Export and merge carries it across.
- **Back issues travel with their covers only.** A handed-on file carries each back issue's cover photograph; its other photographs show as marked places that say which issue file holds them.
- **A photograph that arrives in a file cannot be lightened or given another look.** Its original stays on the device that took it in.
- **A text-only issue is mostly press.** Every issue file carries the press, about 283 KB, however little the issue holds.
- **Photographs make heavy files.** An issue with a colour photograph on every page is about 3 MB, which is the photographs. Screening a photo to grain or dots makes it several times lighter.
- **Colour runs to the edge only at a print shop.** A page colour floods the whole page, and most home printers stop about a quarter inch short of the paper's edge, which is what the faint line on each page shows. **PDF FOR A PRINT SHOP** carries the bleed a shop needs to trim it clean.
- **Printers and hands differ.** The page asks for a test sheet before a print run and offers the other fold when the page numbers come out shuffled. Nothing checks a real printer.
- **Some things are left out on purpose.** There is no feed in the sense [DESIGN.md](DESIGN.md#refusals) refuses, nothing that ranks, counts or scrolls; the site's `feed.xml` is a list of issue drops for a feed reader, which is the bell, not a feed. [PLAN.md](PLAN.md#what-never-gets-built) rules out accounts, cloud sync, a hosted service and any surface that counts anything. It also struck the federation DESIGN.md imagined: rooms, vouching, a protocol, a cooperative and a court. If the format spreads, that federation is somebody else's to build.

## License

The software is under the GNU Affero General Public License, version 3 or any later version (AGPL-3.0-or-later); [LICENSE](LICENSE) holds the text. The prose and design documents are under Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0), in [LICENSE-docs](LICENSE-docs). The two typefaces the page carries, Anton and Knewave, are under the SIL Open Font License 1.1, with their licences in [src/fonts/](src/fonts/). The AGPL follows Article III of [CHARTER.md](CHARTER.md). Copy this repository; that is what it is for.
