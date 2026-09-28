# The moat

What the field does on 28 September 2026, what stoop does that none of it does, and how to widen that gap. PLAN.md surveyed the field in August and drew the destination: a press, a format and an address convention, never a platform. This document re-runs the survey a month on, with the colour, type and print-shop work landed, and designs the next stretch of the route. The sources are listed at the end.

## 1. The field

Nine lanes. In each, what the tools do, what they charge, and where the work lives.

| Lane | Tools | What they do | Price | Where the work lives |
|---|---|---|---|---|
| One-sheet editors | Zineroo, Dirty Little Zine, snipzine, zeenster (virgilvox), Pocket Zine, EZZINE (iPad) | Lay out the eight-page one-cut zine; photos, captions, some text; PDF or PNG at 300 dpi | Free, except Zineroo: Plus for saddle stitch, trifolds and cloud; Pro for 300 ppi, CMYK, bleed, crop marks and colour profiles | The browser (IndexedDB or nothing); Zineroo Plus in its cloud |
| Booklet imposers | Zine Creator (PWA), ZineArranger, BookletCreator, PDF Snake, BetaPDF, PDFJar, a dozen more | Take a finished PDF and impose it for a saddle-stitched booklet or a tiny fold; ZineArranger offers nine sizes down to 1/64 | Free; BookletCreator paid past 16 pages | Nowhere: a PDF in, a PDF out |
| Photo zine layout | onlinezinemaker, writezimmermann's A5-on-A4 maker | Sequence photographs into a booklet; blend modes, custom fonts, a 3D flip preview, duplex-aware PDFs at 300 dpi | Free | The browser |
| The art toy | Electric Zine Maker | Paint, glitch, halftone, ASCII; a toy that prints; open-sourced; a community of zine jams on itch.io; a separate HTML reader (EZM-Reader) shows a finished zine in a browser from a folder of PNGs | Free | The desktop; itch.io for the reader |
| Group publication | Letterloop; Tribu News | Questions go out by email, replies come back as a newsletter; unlimited archive; PDF export for print; a "From You" one-to-many mode. Tribu prints and mails a family newspaper | Letterloop $5 a month, $50 for teams; Tribu per issue | Their servers |
| Digital reading | Flipsnack, Issuu, Publuu, zine.la | PDF to flipbook with links, video, analytics; zine.la adds ePub and cloud sync | Flipsnack $14 to $38 a month; Issuu $27 to $79, up 440% since 2019; zine.la freemium | Their servers |
| Riso | Spectrolite (with Layout Department for imposition) | Colour-separate artwork into one greyscale file per ink; ink and palette libraries; imposition being moved to a second app | Free desktop app | The desktop |
| Print shops | Mixam, Risolve, Out of the Blueprint, Good Press | Want pages in reading order, not imposed; PDF; 1/8 inch (3 mm) bleed; riso shops want one greyscale file per ink named for the ink, 300 to 600 ppi, and no crop marks | Per job | The shop |
| Distribution and archive | itch.io, Etsy, Ko-fi, zinedistro (self-hosted Rails), virtual zine libraries, QZAP, Barnard, xZINECOREx and the Zine Union Catalog | itch.io takes a single HTML file or a zip with index.html as a browser project; libraries take PDFs by email and physical copies by post; librarians catalogue with xZINECOREx, a Dublin Core profile with a Union ID for the union catalogue | Free to list; shops take a cut | Their servers; the library's shelf |

Three things have moved since August.

**The print counter is contested, and we already hold it.** Zineroo now sells as its Pro tier what stoop gives away: 300 ppi, bleed, crop marks, print-shop PDFs. Pocket Zine gives it away too, "margins and bleed sorted for the print shop", but for one maker on one device. Nobody in the one-sheet lane emits riso plates; the only tool that does is a separate desktop app that is itself shedding imposition to a companion app. A press whose cuttings already carry the riso drum colours as inks is one export away from being the tool a riso shop can take a job from directly.

**The nearest thing in spirit is Pocket Zine, and it is a single-maker tool.** Local-first, no accounts, no subscription, templates that are real publications, bleed sorted. It is the field catching up to the storage half of stoop's position. It has no issues, no roster, no desk, no shelf, no hand-off. The half it has not caught up to is the half that makes a periodical.

**Nobody makes a file that carries its own press.** The closest is EZM-Reader: a folder of PNGs and a JavaScript reader, zipped and uploaded to itch.io. It shows a zine; it cannot make the next one. Letterloop keeps the archive on its servers and cannot hand you the press without abandoning the subscription. Flipsnack and Issuu are the same shape at ten times the price. That gap is unchanged, and it is the moat.

## 2. The moat, stated

Stoop's position rests on three properties, each of which the field cannot copy without giving up its business or its architecture.

The file needs no server. Every subscription tool in the survey is built on the opposite.

The press rides inside the issue. Every editor in the survey produces a PDF and stops; the PDF cannot make the next issue.

The loop closes by file. A reader given an issue can make a piece inside it and hand the piece back; the editor takes it in by opening it. No tool in the survey has a roster, a desk or a bell.

The moat widens not by adding editor features the field already has, but by making the file go further than a PDF can: to a phone, to a host, to a print shop, to a riso studio, to a library, to another scene, and back to the desk. Each of the expansions below is a place the file arrives and is already the right shape when it gets there.

## 3. The expansions

Eight, in the order they should be built. Each names the object, the gap in the field, the design as it touches the file, the site and the format, the suite that gates it, and its size. The suites follow the pattern of the existing ones: a browser drives the built page and reads the outputs back as bytes.

### 3.1 The catalogue card, the bell on the web, and the reply

**The object.** Every issue carries a catalogue record in the schema zine librarians are standardising on, prints it as a colophon, and the site the back covers point at carries a feed of issue drops and the tags a shared link needs to unfurl. The back cover carries a reply address.

**The gap.** No tool emits catalogue metadata, so every zine a library takes in is catalogued by hand from the object. No zine tool emits a feed; the group-publication lane's "feed" is an email list on somebody's server. Letterloop's archive is unlimited and theirs.

**The design.** An issue gains an optional `card` with the xZINECOREx elements: title with the issue number, creators, publisher, contributors, date of publication, physical description, language, place of publication, subjects, see-also, freedoms and restrictions, and a Union ID left blank for a library to fill. Six of those are derived (the title from the zine's name and number, creators and contributors from the bylines on the pages, the publisher from the scene, the date from the bell, the physical description from the format: "5.5 × 8.5 in, 8 pages, one sheet folded"). The rest are typed once at the desk under a CARD heading and remembered for the next issue. A COLOPHON block under + BLOCK lays the card out as a cutting. The issue file carries the card as JSON-LD (`schema.org/PublicationIssue` inside a `Periodical`) in its head, so a hosted issue is machine-readable. MAKE THE SITE adds `catalog.csv` with the xZINECOREx columns, one row per issue, and `feed.xml`, an Atom feed with one entry per issue linking to `NN/` with `NN/sheet.pdf` as its enclosure, and `NN/cover.jpg` beside each issue so `og:image` can be absolute when the address is set. The back cover gains a second line under the address: `reply: <address>/NN/#reply`; an issue page opened at `#reply` offers the press already at the piece form, asks who is writing, and ends at SEND. FORMAT.md documents `card` as optional and the site's three new files.

**Why this is the moat.** The feed is the bell in a reader, not a feed in the sense DESIGN.md refuses: an Atom file of issue drops has no ranking, no counts and no scroll. The catalogue card means a stoop issue arrives at a library pre-catalogued in the library's own schema, which no PDF does. The reply line closes the loop from paper without a server.

**The gate.** `23-card`: the derived elements are right on a real issue; the typed ones survive the bell and reappear on the next; the colophon prints; the JSON-LD parses and names the issue; the site zip's `feed.xml` is valid Atom with an entry per issue; `catalog.csv` has the header and a row per issue; `#reply` opens on the piece form and the piece file it makes is signed.

**Size.** One module (`05n-card.js`) and additions to `12a-site.js`, `07a-landing.js` and `11-pdf-sheet.js`; about 300 lines and a suite.

### 3.2 Riso plates

**The object.** RISO PLATES writes the issue as one greyscale PDF per ink, in reading order with bleed and no marks, plus a preview with the inks overprinted, plus a note saying which pages go on coloured stock. It is what a riso studio asks for, in the words their file guides use.

**The gap.** Zineroo Pro sells CMYK; no zine tool separates for riso; Spectrolite separates artwork but is a desktop app that knows nothing about the pages.

**The design.** The inks a cutting can be printed in are already the riso drums. A plate is the print-shop PDF drawn with a filter: every cutting, rule, box, stamp, code and two-tone photograph in the plate's ink drawn in black, everything else left out; the page's own heading, body and rules go on the black plate, as does a colour photograph, rendered to greyscale; a page colour is paper, not ink, so it goes to `plates.txt` ("page 3: print on pink stock") and not to a plate. Plates are named for the ink (`blue.pdf`, `black.pdf`), carry 1/8 inch of bleed and no crop marks (Risolve says not to), and are zipped with `preview.pdf`, in which each plate is drawn in its ink with a Multiply blend, the preview the shops tell people to make in Photoshop. FORMAT.md gets a paragraph under On PDF.

**The gate.** `24-riso`: an issue with a blue headline, a black body and a pink page yields exactly two plates; the blue plate's content streams hold the headline and nothing else; the black plate holds the body and not the headline; the preview carries `/BM/Multiply`; `plates.txt` names page 3 as pink stock.

**Size.** One module (`11e-pdf-riso.js`) plus a filter hook in `11a-pdf-paste.js` and `11-pdf-sheet.js`; about 200 lines and a suite.

### 3.3 The distro

**The object.** The shelf carries other scenes' issues. Take in a friend's issue file and it sits under DISTRO, readable, printable in its own format, and published with the site under `distro/`, so a scene can stock what it likes the way a distro table does, and a hosted stoop site is also a distro.

**The gap.** zinedistro is a Rails app with S3 storage. Etsy takes a cut. A library is a building. Nothing in the field lets a maker stock another maker's work as a folder of files.

**The design.** A new store, `state.distro`, holds foreign issues with the roster, zine name and address of the file they came from, kept apart from `state.issues`. CARRY A ZINE on the shelf takes an issue file and shelves its newest issue with its cover photographs; the shelf lists carried issues with READ, PDF, SHOP PDF and DROP. MAKE THE SITE writes `distro/index.html` (a shelf of what is carried, each with who made it and where it lives) and `distro/<slug>/NN/` pages that are the issue page with that scene's seed, so anyone can hand it on from there. The own feed and catalogue exclude the distro. FORMAT.md: `distro` in a backup is optional and a reader MAY ignore it.

**Why this is not a directory.** PLAN.md refuses a public directory. A distro is stocked by hand, lists only what its keeper carries, and is served from the keeper's own folder; there is no place where scenes are listed, only shelves that carry one another.

**The gate.** `25-distro`: a friend's file goes on the shelf without touching the scene's own issues or roster; the carried issue reads and prints in its own format; the site zip holds `distro/`; DROP removes it and sweeps its photographs; the feed has no entry for it.

**Size.** A module (`07c-distro.js`), additions to `12a-site.js` and `13-sync.js`; about 250 lines and a suite.

### 3.4 The pen

**The object.** + PEN draws on a page. A stroke is a cutting like any other: it moves, turns, scales, takes an ink, reaches the PDF as lines, and rides in the file as points.

**The gap.** The zines photographed at the coffee shop were half hand-drawn. Electric Zine Maker paints; Pocket Zine takes an Apple Pencil; the press takes a photograph of a drawing and cleans it up, which is a workaround.

**The design.** A `draw` cutting holds strokes as arrays of `[x, y, w]` in fractions of its own box, with a base width in CSS pixels and an ink. Pen mode is entered by the button and left by Escape, the way typing is, so a finger still scrolls when it is off; pointer events with pressure set each point's width. On screen a stroke is an SVG path with round caps and joins; on paper it is `m`/`l` operators with `1 J 1 j` and the width in points, in the cutting's ink. FORMAT.md adds the kind.

**The gate.** `26-pen`: a drag in pen mode leaves one cutting with points inside its box; a second stroke without lifting the mode joins it; the SVG path exists and is in the ink; the PDF holds the stroke ops in the ink; moving the cutting moves the drawing; the file handed on shows it.

**Size.** A module (`05o-pen.js`) and a case each in `05b-elrender.js` and `11a-pdf-paste.js`; about 220 lines and a suite.

### 3.5 Your own faces

**The object.** A scene can add a typeface of its own. It rides in every issue file and every PDF the way Anton and Knewave do, and appears in the voice list under its own name.

**The gap.** onlinezinemaker and Pocket Zine load `.ttf` files but cannot embed them in a PDF the way the press does; a shop substitutes a missing face and the headline reflows.

**The design.** FACES under SCENE takes a `.ttf` or a TrueType `.woff`; a `.otf` with CFF outlines is refused with a sentence saying why. The face is kept in IndexedDB under a new `fonts` store, added to the page as an `@font-face` rule, embedded in the issue file as a data URL at export, and embedded in PDFs through the existing TrueType parser and embedder. Each face is a voice, named from its name table. There is no ceiling on what a file weighs, so a 400 KB face is the scene's call, and the badge says what it costs.

**The gate.** `27-faces`: Liberation Sans from the test machine is taken in; a cutting set in it measures the same on screen and in the PDF's width table; the PDF embeds it as a TrueType subset; the file handed on carries its `@font-face` and a stranger's browser sets the cutting in it; a CFF `.otf` is refused with a message.

**Size.** A module (`14b-faces.js`) plus changes to `10a-pdf-ttf.js`, `12-export.js` and `05j-type.js`; about 250 lines and a suite.

### 3.6 Creep

**The object.** A saddle-stitched booklet of five or more sheets has its inner pages pushed outward by the thickness of the paper wrapped around them, so a print shop trims the fore-edge and the inner pages lose their margin. The sheet PDF shifts each sheet's content away from the spine by the creep its position earns.

**The gap.** The free imposers do not compensate; writezimmermann's maker says so in its README. The 32-page booklets added last week make it stoop's problem.

**The design.** For a saddle format with S sheets, sheet k (0 the outermost) shifts its two pages away from the spine by (S − 1 − k) × 0.2 mm, 0.1 mm a leaf for 80 gsm paper. Below three sheets the shift is under a point and is skipped. The paper drawer says what was done.

**The gate.** In `21-booklet`: a 32-page sheet PDF's innermost side carries the shift and the outermost none.

**Size.** Twenty lines in `11-pdf-sheet.js` and two checks.

### 3.7 Micro formats

**The object.** The sixteen-page one-sheet (both sides printed, one cut) and the four-page card (one fold), two formats ZineArranger and the itch.io jams use that the press lacks.

**The gap.** Small.

**The design.** Two imposition maps in `04-impose.js`, and a hand-kit page for each so law 5 can hold them to the kit. Gated on a folded paper test before they ship: an imposition nobody has folded is a stack of ruined paper, and the suite can only check that the maps agree with themselves.

**Size.** About 80 lines, two fixtures, and a sheet of paper.

### 3.8 The reader on the file

**The object.** Not a new feature: the issue file, uploaded as it is, is an itch.io browser project, a Neocities page, a Netlify Drop, a thumb-drive file. The README and the site's `README.txt` should say so in one line each, because the field's nearest equivalent needs a zip, a folder of PNGs and a JavaScript reader.

**Size.** Two sentences.

## 4. What stays refused

PLAN.md's list stands: accounts, cloud sync, a hosted service, a template gallery, a public directory, a submission queue with a number on it, any surface that counts anything, the cooperative and its court. Two of the expansions above brush the list and are designed to stay on the right side of it. The feed is a static Atom file of issue drops, the web's form of the bell, with no ranking and no counts; it is not the feed DESIGN.md refuses. The distro is a shelf stocked by hand, served from its keeper's folder, listing nothing but what it carries; it is not a directory.

Not in this plan, on purpose: a flipbook reader with page turns (the pages view already shows the zine as made), blend modes for photographs (a paste-up glues things over each other; that is the blend), a template gallery (refused), and any form of comment, guestbook or count on the site.

## 5. The order, at a glance

| Chunk | Ships | Gate |
|---|---|---|
| 1 | The catalogue card, the colophon, JSON-LD, `feed.xml`, `catalog.csv`, `cover.jpg`, the reply line | `23-card` |
| 2 | Riso plates, the overprint preview, `plates.txt` | `24-riso` |
| 3 | The distro on the shelf and in the site | `25-distro` |
| 4 | The pen | `26-pen` |
| 5 | Your own faces | `27-faces` |
| 6 | Creep | in `21-booklet` |
| 7 | The sixteen-page sheet and the card | a folded sheet of paper, then `21-booklet` |
| 8 | Two sentences in two READMEs | none |

Each chunk lands as one commit with its suite green, in the order above; chunks 1 and 2 are the ones that move the moat, and if the plan stops after them it was still worth doing.

## 6. What could go wrong

**The card is only as good as its fields.** Librarians will take a CSV they can map; they will not take a schema of our own. The elements are xZINECOREx's, in its names, and the CSV header uses them verbatim, so a mapping is a lookup.

**Riso plates cannot separate a colour photograph.** A colour photograph goes to the black plate as greyscale, which is honest and what most riso zines do; a maker who wants a true two-ink separation of a photograph should screen it to grain in one ink and lay a second copy in another, which the press already allows, or use Spectrolite. The note in `plates.txt` should say this.

**The distro makes files heavy.** A carried issue brings its photographs. That is the cost of carrying it, and the badge and `08-weight` will say what it costs; there is no ceiling to defend.

**Own faces are the widest door.** A font file is parsed by the press's own TrueType reader; a malformed one must fail closed, and the parser needs a test with a truncated file before this ships.

**Nothing here moves phase 6.** The gate that matters, a scene the project did not found shipping its second issue, is still not in our hands. These expansions make the file a better object to be handed, hosted, printed, catalogued and stocked, which is the most a press can do about it.

## Sources

Read on 28 September 2026.

Zineroo, https://zineroo.com/ · Dirty Little Zine, https://dirtylittlezine.com/ · snipzine, https://snipzine.com/ · zeenster and virgilvox/zine-maker, https://zeenster.com/ and https://github.com/virgilvox/zine-maker · Pocket Zine, https://pocketzineclub.com/ · Zine Creator, https://zine-creator.com/ · ZineArranger, https://nashhigh.itch.io/zinearranger · BookletCreator, https://www.bookletcreator.com/ · onlinezinemaker, https://onlinezinemaker.netlify.app/ · writezimmermann/zine-maker, https://github.com/writezimmermann/zine-maker · Electric Zine Maker, https://alienmelon.itch.io/electric-zine-maker and https://github.com/alienmelon/Electric-Zine-Maker · EZM-Reader, https://github.com/jeremyoduber/EZM-Reader · Electric Zine Jam, https://itch.io/jam/the-sumer-twenty-twenty-five-electric-zine-jam · Letterloop, https://www.letterloop.co/pricing · Tribu News, https://en.wikipedia.org/wiki/Tribu_News · Flipsnack and Issuu pricing, https://zenflip.io/en/flipbook-pricing-comparison · zine.la, https://zine.la/ · Spectrolite, https://spectrolite.app/how-to/overview/riso-ify · Risolve file set-up, https://risolvestudio.com/pages/file-set-up · Mixam file formats, https://mixam.com/support/fileformats · Purdue riso file prep, https://guides.lib.purdue.edu/c.php?g=1478280&p=11039638 · itch.io HTML5 projects, https://itch.io/docs/creators/html5 · zinedistro, https://github.com/zinedistro/zinedistro · zineland/zine, https://github.com/zineland/zine · Sherwood Forest virtual zine library, https://www.sherwoodforestzinelibrary.org/virtual-zine-library-recently-added · Barnard Zine Library donations, https://zines.barnard.edu/donation · QZAP, https://archive.qzap.org/ · xZINECOREx, https://github.com/MiloQZAP/xZINECOREx and https://www.zinelibraries.info/wp-content/uploads/2021/05/Zinecore_Zine_Flats.pdf · Zine Union Catalog, https://www.zinelibraries.info/zine-union-catalog/
