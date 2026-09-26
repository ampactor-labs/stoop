# A tour of the press

This is the long description of the app, drawer by drawer. The
[README](../README.md) has the short version, and [`FORMAT.md`](../FORMAT.md)
specifies the files it writes.

The app has one surface, **the press**, which shows the issue as pages. Four
drawers open over it: **the desk**, **the shelf**, **the scraps** you wrote
down, and **the scene**, which holds who writes and how the issue travels. Two
buttons in the top bar send an issue out of the app: **paper** and **hand it
on**.

## Writing things down

Writing goes in at two places. **The scraps** keep anything worth keeping: a
line, a page or a photograph. Once a cycle, the desk pulls in whatever is new
since the last issue. A scrap with a title, or a long one, becomes a piece of
its own, and the short ones run together as one log column. The desk also takes
a piece submitted straight to it.

A piece is a title, a byline, a kind and a body. Anything can go in unsigned,
as zines always allowed. The roster in the scene drawer takes as many people as
write for the zine. A byline that arrives in a piece file from somebody else's
copy keeps their name.

## The desk and the bell

Whoever has **the desk** this cycle reads the tray, cuts what will not run,
writes the editor's note, and rings the bell. A cut piece stays with its maker
and can run next cycle.

The bell puts the issue on the shelf whole and hands the desk to the next
person on the roster. Alone, the desk is always yours. At two people it
alternates, and at four it comes back to you every fourth issue. The bell can
go into anybody's calendar as a file, with a reminder the day before. The shelf
says when this browser was last backed up, because until then the browser
holds the only copy.

## The press

**The press** shows the issue as pages (cover, facing spreads, back cover),
right way up, in the order a reader sees them. **Paper** shows the imposition:
the arrangement of pages on the printed sheet so that they come out in order
once the sheet is folded, cut or stapled. There are six formats:

| Format                                   | Paper      |
| ---------------------------------------- | ---------- |
| One sheet, eight panels, one cut         | Letter, A4 |
| Saddle-stitch, 8 pages on 2 sheets       | Letter     |
| Saddle-stitch, 12 pages on 3 sheets      | Letter     |
| Saddle-stitch, 16 pages on 4 sheets      | Letter, A4 |

Saddle-stitch means the sheets nest inside each other and are stapled through
the fold. The imposition is computed from the page count and the paper, so
changing format re-flows the same pieces without anyone retyping a word. A
panel clips what will not fit, because a printer would clip it too, and the fit
meter says how many words are cut off so they do not vanish unnoticed.

## The paste-up

On top of the pages sits **the paste-up**: a zine page treated as a board that
somebody glued things onto before it went through the copier. Drop a cutting
on any panel and drag it anywhere, at any angle, over anything. A cutting can
be:

- text in five voices: typewriter, headline, a fat felt-tip marker, stencil
  with the bridges cut through it, and a ransom note cut letter by letter from
  four faces;
- a photograph;
- a rule or a block;
- a stamp: FREE, TAKE ONE, PHOTOCOPY THIS, a №, an arrow, a star, tape, a
  staple, or a barcode that scans nothing, black on white or knocked out.

**GEN** sets how many times the issue has been through the copier, from GEN 0
(the master) to GEN 3 (laundromat). The wear it draws is seeded, so it prints
the same on every machine.

Every cutting is stored as a fraction of its panel rather than as a
measurement, so a collage survives a change of format the same way a paragraph
does. Drag to move, double-click to type, use the arrow keys to nudge, Ctrl-D
to duplicate, and undo all the way back. A cutting dragged across the gutter
lands on both pages of the spread, on screen and on paper. A faint line on each
page shows where a home printer stops reaching. A piece too long for its page
runs on to the next page, with a line saying where it went.

All of it prints where you put it. A cutting records the lines its own browser
broke it into, and the PDF sets those lines in the same face. The press carries
its two typefaces inside itself: Anton for headlines and Knewave for the
marker, both under the SIL Open Font License. Each is cut down to Latin and
embedded in every issue file and every PDF the press writes, so a line on paper
matches the line on screen glyph for glyph, even on a machine that has never
had the fonts. [`src/fonts/README.md`](../src/fonts/README.md) has the subset
commands.

## The shelf

**The shelf** keeps every issue as it shipped, with its own pages, format and
fold, so a back issue reprints correctly whatever the current draft is set to.
The desk only pulls in scraps written since the last issue shipped, so issue
two cannot reprint issue one.

## What comes out

Paper comes out four ways:

- a browser print;
- a PDF written by the app itself at exact paper size, which leaves a print
  dialog nothing to rescale, and which a copy shop accepts;
- a flyer with tear-off tabs;
- a single HTML file that is the issue, the archive behind it, and a working
  press for the next issue.

That last file is what the project is built around. Open it on a machine that
has never seen this app and it shows the issue as it was made, page by page,
with the text one tap away. From it you can make the next issue and hand that
on. It carries every back issue too, each as its cover only, so the file does
not grow with the shelf until it is too big to send.

The shelf also makes the site that the back covers point at: every issue as the
page its code leads to, with a PDF of each beside it, zipped for Neocities,
Netlify Drop, any static host or a thumb drive.

## Photographs

Photos are dithered to 1-bit on intake: each pixel becomes pure black or pure
white, and grey is made from the density of black dots. A page-sized photo then
costs tens of kilobytes and is already in the form a photocopier reproduces.
The device keeps a small greyscale original, so a dark phone photo can be made
lighter afterwards, or screened as halftone dots or hard copier contrast
instead of grain. The original never leaves the device.

## The back cover and sync

The back cover carries the scene's address as text and as a QR code generated
on the page. Sync is a file: importing one merges by id and keeps the newer
copy of anything held in both, and a merge never overwrites a published issue.
