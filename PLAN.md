# The Plan

`CHARTER.md` was the law until this document demoted it. `DESIGN.md` is the machine. This is the work: the route from a 62 KB notebook for two people to a format that does not need us.

It is a proposal, not a ratification. Where it contradicts `DESIGN.md` it says so plainly, and adopting it means editing that file rather than quietly diverging from it.

## Where this stands

Phases 0 through 5 are built, and phase 6's documentation is written. Every gate below is asserted by the browser suites in `test/` and every law by `check.sh`.

| Phase | State |
|---|---|
| 0 · the shelf, the compile window, the fit meter | **Landed.** Two issues coexist and keep their own words. |
| 1 · pieces as the content model | **Landed.** The same pieces re-flow into another format with nothing retyped. |
| 2 · the desk, the bell, alternating editors | **Landed.** Cut-with-restore, an editor's note, a chair that alternates on parity. |
| 3 · reading view, imposition solver, A4, saddle-stitch | **Landed.** One-cut at Letter and A4, signatures at 8, 12 and 16 pages. |
| 4 · the self-carrying issue, piece bundles | **Landed.** An exported issue opens on a machine with no storage of its own and makes the next issue. |
| 5 · the paper is the network | **Landed.** The QR and printed address, checked module for module against an independent encoder; a hand-written PDF writer so the sheet is byte-exact and mailable to a copy shop; and a flyer with tear-off tabs. |
| 6 · the specification, the demotion, the giving away | **Written** — `FORMAT.md`, the charter demoted, stages 2 and 3 struck. Its gate is not ours to close. |

Everything phases 0 through 5 called for is built. What remains is phase 6's gate, which is not ours to close: a scene we did not found shipping its Issue #2.

## Why this document exists

Three findings, in the order they landed.

**The field is crowded where we are strong and empty where we are absent.** A survey of the current tools — Pocket Zine, Dirty Little Zine, snipzine, TypeKitty, Zineroo, Minibook, Zine Creator, `virgilvox/zine-maker`, pdfimpose, BookletImposer — found at least eight browser tools that lay out an eight-page one-sheet zine, several of them local-first and free, one of them freemium with a print-shop tier. One-page-zine imposition is a packaged Python library with a documented API. Dithering is the single most contested niche on the board: one free tool ships fourteen styles, eight error-diffusion algorithms among them, against our one. Being a better one-sheet editor is not available as a strategy, and being a better dither shop is worse.

What none of them do — checked by feature list and keyword across every tool above — is a **publication**: numbered issues, an archive, multiple contributors, an editor who assembles rather than authors. The one product that does that, Letterloop, does it over email for five dollars a month, keeps the archive on its own servers, and added a print-ready PDF export. It holds the digital lane of our own wedge. The paper lane, the ownership, and the continuity are unoccupied.

**We had all of it and deleted it.** On 30 July 2026 the first three commits produced a sixteen-view clickable prototype: the desk with a tray of five bylined submissions and cut-with-restore, the scene page with a shelf of three back issues and a skill ledger, a fully written Issue №03 with six typed pieces, the rounds, the public stoop, the start-a-scene onboarding, and a ten-line view whose entire content is "THERE IS NO FEED." On 25 August, `d937b61` deleted ten of those views and added six. Sixteen became six, and five of the six are the notebook. Every gap the survey found is sitting in `git show 18249b1:src/views/`.

**The charter is guarding a building we have not built.** Seven articles, a court of five, dues bands, dissolution clauses, a protocol namespace — roughly eight thousand words of governance against 1,780 lines of software used by two people. Every article defends against a failure mode that only exists if we build the institution the articles govern. That is the observation this plan is built on.

## The destination

Stoop is a **press**, a **format**, and an **address convention**. It is not a platform and not a cooperative.

A format cannot be sold. Nobody advertises on a file layout. Nobody acquires a directory structure. AGPL plus plain files plus relative links is stronger capture-resistance than an elected court, and it costs nothing to operate and nobody's Tuesday evening to govern. Article III is trying to legislate what the artifact can simply be.

The concrete object at the end of the route:

> **A single HTML file that is a press for a periodical, and that rides inside every issue it prints.**

You open the press. You make Issue 01. You export `nightbus-01.html`. That file is the reading view, the imposed sheet, the shelf of back issues, and a working press for Issue 02. You hand it to whoever has the desk next. They read it, make Issue 02 inside it, and hand it back. The archive travels with the publication; the tool travels with the archive.

Credible exit stops being a policy and becomes a file. The fork guarantee becomes "send it to someone." Portable addressing works with no address at all, because the issue is its own host. And it is the one thing on the board a competitor cannot bolt on, because it requires the whole application to be small enough to fit inside its own output.

That is why the size discipline matters. The app was 61,612 bytes when this was written and is about 235,000 built, 78,500 gzipped, now that it carries a desk, a shelf, an imposition solver, a QR encoder, a PDF writer, a paste-up and its own typeface. Measured on a real exported issue, the press is a flat 232 KB and each dithered photograph is about 82 KB, so an issue of plain text is almost entirely press and a full eight-page issue with a photograph on every page is about 892 KB, of which the press is about a quarter. Both numbers are held by `test/08-weight.js`, against an issue it publishes and weighs rather than against an assertion, and check.sh ratchets the built fragment at 256 KB, derived from the same megabyte ceiling. Every law in `check.sh` that reads as asceticism — zero external requests, reproducible outputs, the ratchet, no CDN — is the engineering requirement for a press that fits in its own product. The constraints were built first. This plan is what they were for.

## What this supersedes

`DESIGN.md` stages the work as: Stage 0 hand tools, Stage 1 the scene tool, Stage 2 federation, Stage 3 the cooperative. This plan keeps Stage 0, absorbs the useful half of Stage 1, and retires Stages 2 and 3.

The lexicons, the rounds registry, the vouch records, the POSSE bridges, the flagship host, the court, the treasury, and the membership roll are not deferred. They are struck. If the format spreads, federation is somebody else's to build, and `DESIGN.md` is there for them.

`CHARTER.md` is demoted from **the law** to **a constitution in the box**: a template a scene adopts if it ever grows enough to need one. Article III moves to where it is already enforceable and already enforced — the license, and the mechanical laws in `check.sh`. That file does more constitutional work in seventy lines than Article VI will ever do.

The gate is unchanged and this plan lives inside it. `CONTRIBUTING.md` says Stage 0 "may grow whatever a scene of two needs to actually publish," and that everything a second scene would touch is what waits. Phases 0 through 4 below are all things a scene of two needs in order to publish. None of them require the gate to open.

## The phases

What follows is the plan as it was proposed, kept in its original tense. The table above says what became of each one; the file paths below are the ones that existed when it was written.

## Phase 0 — Make the press honest

The application cannot hold two issues. `state.press` is a single object with no issue list anywhere in `src/js/`, so compiling №02 overwrites №01. The compile step takes the five newest log entries regardless of what already shipped, so the second issue reprints the first. And `.panel .body` ends in `overflow: hidden`, so copy past the panel silently disappears.

The project's only respected metric is whether the first scene ships Issue #2, and the press has no memory of Issue #1. Nothing else in this plan matters until that is false.

The work: `state.issues[]` with archive-on-compile and back issues that reprint identically; a compile window bounded by the last issue's timestamp instead of a fixed count; a per-panel fit meter that names the overflow in words rather than eating it. Delete the todos view — it feeds no issue, and it currently wastes panel 5, a centre-spread page, on a checklist.

**Gate:** Issue 01 and Issue 02 exist in the app at the same time, and both reprint byte-identically after the other was made.

## Phase 1 — Pieces, not panels

Every tool in the survey is a canvas: you place objects on a page. That is why none of them can do a second issue — there is no content, only layout.

A piece is an id, a title, a body, a byline, a kind (essay, photos, mix, log, recipe, letters — the six the prototype's Issue №03 already used), images, and a timestamp. The log, journal, and projects stop being destinations and become **sources that mint pieces**. Panels stop being content and become **slots that pieces flow into**. The projects view collapses into a piece kind.

This is the pivot the whole plan rests on, and it is already specified: `tool/SPEC.md` puts pieces in `cycle/` as files and builds an issue three ways from one source. This pulls that model down into Stage 0, where it can be tested against real issues rather than imagined ones.

**Gate:** the same issue renders into two different formats without a word being retyped.

## Phase 2 — The desk

Restore `13-the-desk.html` at n=2, from the design already in git.

The tray holds submitted pieces. Cutting is cut-with-restore, because the prototype got this exactly right the first time: cuts are conversations, not deletions — the maker keeps the piece and it can run next cycle. The editor's note is a text box. BUILD assembles. The editor alternates by issue parity, odd and even, which at two people is cleaner than rotation and preserves the rule that exactly one person holds the final cut.

Then the bell: a cycle with a drop date and a countdown. A deadline is not an engagement metric; it is the thing that makes zines ship, and it is the mechanism the whole publication loop in `DESIGN.md` hangs from.

**Gate:** an issue assembled by a person who did not write all of it.

## Phase 3 — The two substrates

`DESIGN.md` promises an issue is one source rendered twice and neither rendering is the real one. Stage 0 ships only the sheet.

Add the reading view: vertical, phone-shaped, no imposition, from the same pieces. Then replace `PRESET_A` and `PRESET_B` with a computed imposition — a function of page count, paper, orientation, and duplex — and add A4 and saddle-stitch. A4 because letter-only excludes most of the world; saddle-stitch because the eight-panel budget is roughly twelve hundred words and a scene that outgrows it should not have to leave. These are table stakes, not differentiation: the survey found them everywhere, sometimes behind a paywall, once as a Python library with seven schemas.

`check.sh` law 5 changes from comparing two literal arrays to comparing the hand kit against the solver.

**Gate:** one person reads the issue on a phone while another folds the same issue off a sheet.

## Phase 4 — The self-carrying issue

The keystone.

Export `<scene>-<NN>.html`: a single file containing the reading view, the imposed sheet, the shelf of every prior issue, and a working press for the next one. The press must fit inside its own output, and `check.sh` gets a new law that proves it on every commit.

Alongside it, the piece bundle: a contributor opens the issue file, writes a piece, exports a few-kilobyte `piece-<name>-<slug>.html`, and sends it however people already send things. The editor drops it in the tray. That is multi-contributor publishing with zero infrastructure, and per the survey it is the gap nobody fills.

This is sneakernet publishing. The digital object propagates exactly the way the paper does — hand to hand, because somebody chose to hand it over.

**Gate:** Issue 02 is made by someone who never visited a URL. They only ever had the file.

## Phase 5 — The paper is the network

The two substrates have to point at each other or the loop is open.

A hand-rolled QR code on the back cover — a few hundred lines, no external request, no library. The issue's address in text beside it. Tear-off tabs, the flyer idiom, printable. And a minimal PDF writer: text plus 1-bit images is a narrow enough problem to write by hand, and it makes the sheet byte-exact instead of hostage to a print dialog, which means an issue can be mailed to a copy shop.

Built as described, with one correction the work made obvious: tear-off tabs do not belong on a zine's back cover, because tearing one off would destroy the zine. They belong on a flyer, which is the only object in `DESIGN.md` that travels between scenes anyway, so the press writes one of those too.

**Gate:** somebody who found the paper opened the archive.

## Phase 6 — Give it away

The format leaves home.

Write the convention as a specification someone else can implement without reading our source: the issue file layout, the piece format, the address shape, the imposition. Demote the charter to the template it should be. Strike Stages 2 and 3 from `DESIGN.md`. Put the press somewhere people find it.

**Gate:** a scene neither of us founded ships Issue 02.

This gate is not in our control, and that is correct. It is the only honest test of whether any of this was worth building.

## The laws that enforce it

The distinctive thing about this repository is that its rules are executable. A plan that is not mechanized is a wish, so each phase lands with its law.

- **The archive law.** Two issues coexist and both reprint identically. Phase 0.
- **The nothing-is-clipped law.** No issue content is ever silently dropped; overflow is reported, never eaten. Phase 0.
- **The one-source law.** Both renderings of an issue derive from the same pieces; a build where they disagree fails. Phase 3.
- **The solver law.** Law 5 compares the hand kit against the computed imposition rather than a hardcoded pair. Phase 3.
- **The self-carrying law.** The exported issue contains a working press, and the press is a flat cost beside the work it carries. Phase 4.
- **The portability law.** Zero absolute URLs in any built output, so the directory survives being moved to another host, a thumb drive, or a tarball. Already the rule in `DESIGN.md` and `tool/SPEC.md`; now checked. Phase 4.
- **The archive-integrity law.** An issue built at version N still renders at version N+1. A self-carrying archive that breaks its own back issues is worse than no archive. Phase 4.

And the one already written in `CONTRIBUTING.md` that governs all of them: no capability that does not end in paper.

## What never gets built

Stated so that it does not have to be relitigated: the cooperative, the court, dues, the membership roll, the vouch computation, AT Protocol lexicons, the rounds registry, POSSE bridges, the flagship host, the solar instance as infrastructure rather than an idea. Accounts of any kind. Cloud sync. A hosted service. A template gallery, a public directory, a submission queue with a number on it, or any surface that counts anything.

Room skins stay deleted. They are the social product, not the press.

## What could go wrong

**The keystone is unproven.** Nothing in the survey does the self-carrying issue, which is the argument for building it and also the reason nobody has shown it works. If the press grows past roughly 150 KB it stops being reasonable to ride inside every issue. The size law is the mitigation and it has to be enforced from Phase 0, not added at Phase 4.

**Phase 6 is not in our hands.** A format spreads or it does not, and no amount of building moves that. The plan has to be worth doing if it stops at Phase 5 with two people and a copier, and it is.

**Deleting todos will hurt.** It is the view most used daily and the one least connected to publishing. Losing it is a real cost paid for focus, and the honest framing is that it belongs to a different product.

**Letterloop could ship a one-sheet export.** They have the recurring issues, the archive, and the print PDF already. What they cannot ship without abandoning their business is the file that needs no server — a subscription cannot hand you the press.

**Editor burnout at n=2** remains open in `DESIGN.md` and this plan does not solve it. The bell helps; alternating helps; neither is proof.

## The order, at a glance

| Phase | Ships | Gate |
|---|---|---|
| 0 | The shelf, the compile window, the fit meter | Two issues coexist and reprint identically |
| 1 | Pieces as the content model | One issue, two formats, nothing retyped |
| 2 | The desk, the bell, alternating editors | An issue assembled by someone who did not write it all |
| 3 | Reading view, imposition solver, A4, saddle-stitch | Read on a phone, folded from paper, same issue |
| 4 | The self-carrying issue, piece bundles | An issue made by someone who only ever had the file |
| 5 | QR, tear-tabs, the PDF writer | A stranger found the paper and opened the archive |
| 6 | The specification, the demotion, the giving away | A scene we did not found ships Issue 02 |

Phases 0 through 2 are the ones that make the founding gate reachable, and none of them need anything the repository does not already have. Phase 4 is the one that makes the rest of it unnecessary.
