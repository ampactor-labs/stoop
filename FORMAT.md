# The Format

What a stoop issue is, written so somebody can implement it without reading our source. `CHARTER.md` is a constitution a scene may adopt; `DESIGN.md` is the machine we imagined; `PLAN.md` is the route. This file is the only part that has to outlive us.

Three things are specified here: the **issue file**, the **imposition**, and the **address**. Nothing else is required of an implementation, and an implementation that handles these is a stoop press whoever wrote it.

Everything is plain text. There is no protocol, no registry, no server, and nothing to join.

## 1. The issue file

An issue is one HTML document. Opening it in a browser shows the issue. There is no other requirement on the presentation, and no requirement that it be pretty.

The document carries its data in a single element:

```html
<script type="application/json" id="stoop-seed">{ … }</script>
```

The element MUST be parsed before any script that reads it. Putting it first in `<body>` satisfies this. Within the JSON, every `</` MUST be escaped as `<\/` so the payload cannot close its own tag.

A conforming reader finds that element, parses it, and renders the issue. A conforming writer produces it. A file with no such element is not a stoop issue, and a reader should say so rather than guess.

### The seed

```json
{
  "stoop": "issue",
  "version": 1,
  "no": "03",
  "people": [ { "id": "a", "name": "Moss" }, { "id": "k3f2p", "name": "Yuki" } ],
  "zine": "NIGHT BUS",
  "address": "example.org/stoop/nightbus",
  "issues": [ … ],
  "cycle": { "no": "04", "editor": "b", "bell": 1789000000000 },
  "photos": { "ph_abc123": "data:image/png;base64,…" },
  "open": "#shelf",
  "read": "03"
}
```

- `stoop` is `"issue"` or `"piece"`. Readers MUST ignore any other value.
- `version` is this specification's version. A reader that does not know a version SHOULD refuse rather than misread.
- `issues` carries every issue up to and including `no`, oldest first. A reader handed issue three gets issues one and two with it, because an archive that only holds its newest entry is a stream with extra steps.
- `cycle` describes the issue the recipient would make next. `no` is `no + 1`, zero-padded to at least two digits; `editor` follows the parity rule in §4. It is computed from the issue in the file, never inherited from the sender's own shelf.
- `photos` maps photo ids to data URIs. Every id referenced by any panel or piece in the file MUST appear here; a file that references a photo it does not carry is malformed.
- `open` and `read` are hints about what to show first. Readers MAY ignore both.

- `people` is the scene's roster, in order. Authorship is stored as an `id`, never as a spelling, so renaming somebody does not orphan their past work. A scene is however many people it is; two is not a limit.
- `zine` is what goes on the cover and the flyer.

**Ids must not collide between scenes.** `a` and `b` are conventional for a founding pair, but anybody added afterwards SHOULD be given a random id, because two scenes both handing out `c` would merge two different people the first time they traded a piece.

A reader MUST merge an incoming roster by id rather than overwriting its own, and MUST NOT drop a byline it does not recognise: an id with no matching person belongs to somebody real on another device, and the reader SHOULD seat them under a placeholder name rather than reassigning their work. A file opened on a machine with nothing of its own SHOULD adopt the roster the file carries, or the names in it are refused as already taken.

Earlier files carry `"names": { "a": …, "b": … }` instead. Readers SHOULD accept both.

### An issue

```json
{
  "no": "03",
  "title": "POWER CUTS",
  "format": "fold8",
  "hand": "A",
  "editor": "a",
  "note": "Four pieces this cycle, one cut (mine).",
  "ts": 1788000000000,
  "panels": [ { "h": "…", "body": "…", "photo": "ph_abc123" }, … ],
  "pieces": [ … ]
}
```

`panels` has exactly as many entries as the format has pages, in reading order: index 0 is page 1, the front cover; the last index is the back cover. `h` is the heading, `body` is plain text with newlines significant, `photo` is a photo id or `null`.

An issue is **immutable once published**. `panels` is what shipped, and a reader reprinting issue three MUST use issue three's own `format` and `hand`, not whatever the reader is currently set to. Implementations that merge archives MUST keep the copy already held and discard the incoming one when both carry the same `no`.

### A piece

```json
{
  "id": "pc_m4x9a2",
  "kind": "essay",
  "byline": "a",
  "title": "The Seam",
  "body": "The sodium lamps are going over to LED…",
  "photo": null,
  "cut": false,
  "ts": 1787900000000
}
```

`kind` is one of `essay`, `photos`, `log`, `mix`, `recipe`, `letters`. Implementations MAY add kinds; readers MUST treat an unknown kind as `essay` rather than dropping the piece.

`cut` marks a piece the editor did not run. **A cut is not a deletion.** The piece stays with its maker and may run in a later issue; an implementation that discards cut pieces is not conforming.

A file with `"stoop": "piece"` carries `pieces` and `photos` and nothing else. That is how a contributor sends work to whoever holds the desk: export, send it however people already send things, and the recipient merges it. Merging by `id` makes importing the same file twice a no-op.

## 2. The imposition

Pages are numbered in reading order from 1. A sheet is a grid of slots; a slot holds one page and is either upright or rotated 180°.

### One sheet, eight pages, one cut

Four columns by two rows, printed on one side. Slot order is left to right along the top row, then the bottom row. The top row prints upside down.

```
hand A:  5 4 3 2  /  6 7 8 1
hand B:  2 3 4 5  /  1 8 7 6
```

Hand B is hand A with each row reversed. The two hands are the two folding handednesses; which one a given pair of hands and printer needs is discovered by folding a numbered test sheet, not by reasoning. **An implementation MUST offer a numbered test sheet**, because printers and folding hands vary and a shuffled fold wastes paper and trust.

Fold: in half the long way and unfold; in half the short way, then each outer edge back to the middle crease, and unfold; in half the short way again and cut along the centre crease across the middle two panels only, stopping at the quarter creases; unfold, fold the long way with the slit along the top, push the ends together until the slit opens into a diamond and then a four-winged plus; wrap the wings around the front cover.

### Saddle stitch

For a page count `n` rounded up to a multiple of four, sheet `k` (counting from zero) carries, two pages to a side:

```
front of sheet k:   [ n - 2k , 1 + 2k ]
back  of sheet k:   [ 2 + 2k , n - 1 - 2k ]
```

Print both sides, nest the sheets in order, staple twice through the spine. No rotation is applied.

### Format names

`format` in an issue is one of `fold8`, `fold8a4` (one sheet, eight panels, one cut) or `saddle8`, `saddle12`, `saddle16`, `saddle16a4` (a stitched signature of that many pages). `hand` is `"A"` or `"B"` and is meaningful only for the one-cut formats. An implementation MAY define others; a reader that does not know a format SHOULD say so rather than impose the pages wrongly.

### Paper

Letter is 11 × 8.5 inches, A4 is 297 × 210 mm, both landscape. An implementation SHOULD support both; supporting only one excludes most of the world or most of North America, and neither is a good trade.

### On PDF

An implementation MAY write the imposed sheet as a PDF, and the reference one does, because a print dialog negotiates margins and scale somewhere the press cannot see and a zine that comes out at 94% does not fold. Nothing in this specification requires it: the imposition above is the contract, and a sheet is a sheet however it reaches the paper.

### The budget

One letter sheet folded to eight panels holds roughly twelve hundred words. An implementation MUST NOT silently discard text that does not fit — it must say how much will not print. Clipping is acceptable; clipping in silence is not. This is the one requirement here that is about honesty rather than geometry, and it is the one most worth keeping.

## 3. The address

```
<host>/stoop/<scene>/          the scene's public door, and its shelf
<host>/stoop/<scene>/03/       issue three, reading view
<host>/stoop/<scene>/03/sheet  the same issue, imposed for a printer
<host>/stoop/<scene>/latest/   an alias for the newest issue
```

Numbers, not slugs: titles get argued about and change, the number is the spine, and zero-padding makes the shelf sort itself.

**Links inside a scene are relative, always.** That single rule is what makes a scene portable: a directory that never names its own host can be copied to another host, a thumb drive, or a tarball in a shoebox, and every link still works. Built output that contains an absolute URL is not conforming.

An issue that has an address SHOULD print it on the back cover, as text and as a QR code (byte mode, error correction L is sufficient). An issue with no address simply carries none. The paper points at the archive and the archive points at the paper, or the loop is open.

## 4. The cycle

A scene publishes on a rhythm it chooses. Exactly one person holds the final cut on any given issue.

With two people the chair alternates by parity: odd issue numbers to the first, even to the second. With more, rotate. The rule underneath is that the editor is a person with a name who owes the room dinner-table accountability, not a procedure.

The bell is the moment the issue drops. It is a deadline, not a metric, and it is the mechanism the whole thing hangs from.

## 5. What conformance does not require

No account system. No server. No database. No network access of any kind — an issue file that fetches something is not conforming, because the whole point is a file that works in a room with no internet, on a laptop that will be thrown away, in ten years.

No federation, no protocol namespace, no registry, and no permission from anybody, including us.

## 6. On copying this

The software is AGPL-3.0-or-later; this document is CC BY-SA 4.0. Implement it, fork it, rename it, and do not ask. The point of specifying it is that you do not need us for any of it.
