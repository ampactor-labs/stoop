# Design

The machine, whole, as it was imagined before a scene had shipped anything.

**Superseded in part.** `PLAN.md` retires Stages 2 and 3 below — the lexicons, the rounds registry, vouch records, POSSE bridges, the flagship host, the court and the treasury are struck, not deferred. The argument is that a format is harder to capture than an institution is, and cheaper to keep honest. What survives is this file's account of the objects and the loops, which the working press in `index.html` implements at n=2, and `FORMAT.md` specifies for anybody who wants to implement it themselves.

CHARTER.md is a constitution a scene may adopt; this is what runs under it. The organizing rule for everything below: every object must live inside at least one loop, and a proposed feature that joins no loop does not ship.

## Refusals

The system is defined by what it will not contain, so the refusals come first.

No feed. No infinite scroll. No follower counts, like tallies, view counts, or trending. No recommendation engine. No quote-post across scenes; no dunk mechanic at all. No DMs (the group chat already exists and is good; Stoop is the porch, the group chat is the backstage, and we compose with it rather than replace it). No video hosting (link out; video is the cost center and the attention sink that would quietly reintroduce everything refused above). No global search and no global namespace of content, because nothing global exists to search. No read receipts, no presence surveillance, no red badge counts. No time-on-site anything.

Two consequences worth naming. First, the expensive parts of modern social infrastructure (relays, global indexes, ranking services, video CDNs) exist to serve global surfaces; with no global surface, the whole system runs at porch-light wattage, which is what makes the economics of CHARTER Article V honest. Second, the engagement mechanics that under-16 laws now enumerate are absent by construction, not by compliance effort; keeping it that way is a standing design invariant.

## Objects

**Room.** A member's page: a place, not a profile row. Skinnable with real HTML/CSS inside a sandbox, one optional autoplay track (rights-clear only: your band, netlabels, CC audio; everything else links out), an about, a shelf of current obsessions, the crew rail (eight slots, chosen by hand, agonized over, reborn from the Top 8), a guestbook, and the light. Technically a signed data repo compiled to static HTML; exportable whole at any moment (CHARTER III.5); useful at n=1 as a personal site that syndicates outward.

**Light.** Manual presence. You turn it on when you are sitting on the stoop and open to visitors; you turn it off when you are not. Never automatic, never inferred, never logged. The status dot encodes on the blue/orange axis (orange lit, grey off), never red/green, and color is never the sole carrier.

**Scene.** The group: vouched members, soft cap near 150, no floor at all, a shared aesthetic (skins), a calendar, a corkboard, a commons, a zine, and a public stoop where anyone can knock. Scenes fork when they outgrow themselves, and the fork carries a copy of the commons with it.

Two is the expected founding size, and the design owes it first-class treatment rather than tolerance. Two people ship on a deadline; eight people with no habit miss the first bell. Every mechanism below has to work at n=2 or it does not work: the vouch count scales down (CHARTER I.1), the editor alternates instead of rotating, the commons starts as two names in a skill ledger, and the corkboard sits empty until somebody staples to it, which is a state and not a failure. Growth happens one person at a time, and the pitch to person three is a stack of back issues rather than an invitation to a blank thing.

**Piece.** A unit of work submitted for an issue: essay, photo set, mix, repair log, recipe, comic, one-liner. Pieces belong to their maker and appear in issues by inclusion, not by posting into a void.

**Issue.** The heart. Each scene publishes its zine on a rhythm it chooses; submissions accumulate through the cycle; the editor of the cycle assembles, sequences, and writes the editor's note; the issue drops at the set hour, whole. It is finite and everyone reads the same object. Issues archive to the shelf.

An issue is one source rendered twice, and neither rendering is the real one. The reading view is a page you open on a phone at the bus stop; the sheet is the same content imposed for a printer, folded, handed to somebody. Screen and paper are equal substrates, which is a constraint with teeth: nothing goes in an issue that cannot survive being printed. No hover, no embeds, no autoplay, nothing that needs a network to mean something. The screen aesthetic is already 1-bit, so riso and photocopier are the same job.

The paper budget is real and worth stating: one letter sheet folded to eight panels holds roughly twelve hundred words, and a scene that wants more publishes a saddle-stitched signature instead of pretending the limit isn't there. The limit is also an editor's best friend.

**Editor.** A rotating role, cycle by cycle, like dish duty in a co-op house. At two people it alternates, odd issues and even issues, which is cleaner than rotation and keeps the rule that exactly one person holds the final cut on any given issue. The algorithm is a neighbor with a name who owes the room dinner-table accountability. Scenes may tip editors from the treasury (CHARTER V.2).

**Shelf.** The archive: issues, court records, quest documentation. Memory instead of stream. Streams forget; shelves remember.

**Flyer.** The only object that travels between scenes, and therefore the only virality in the system: an invitation. A show, a skill-share, a work day, a call for collaborators. Signed by its scene; carries time, place (at whatever precision the scene chooses; "ask a member" is a valid address), and provenance.

**Staple.** The act of posting a flyer to another scene's corkboard, permitted only by that scene's standing consent (CHARTER II.5). Gossip structurally cannot travel; an invitation can.

**Guestbook.** Comments as visits. Signing a guestbook is leaving a trace at someone's place, under your name, where they live. The register is different from replying at someone, and the register is the point.

**Vouch.** Two members stake their listed names to bring in a human. The vouch record travels with the member; sybil pairs are cheap in theory and expensive in practice because scenes admit members (the network does not), scenes are small enough that everyone is seen, and your name sits on what you vouched for.

**Rounds.** Discovery by walking: webring edges between consenting rooms, scene directories that read like a flyer wall, guestbook traces where you have been. Serendipity via edges, not ranking.

**Commons.** The scene's accumulated capability: a wiki, the skill ledger (who can teach what), the tool library, and quests: collective real-world projects (fix ten bikes, feed the block, record the compilation) whose documentation becomes issue material.

## The graph

```mermaid
graph LR
  M[member] -- owns --> R[room]
  M -- belongs to --> S[scene]
  M -- submits --> P[piece]
  M -- vouches --> M
  E[editor, rotating] -- assembles --> I[issue]
  P --> I
  S -- publishes --> I
  I -- archives to --> SH[shelf]
  S -- posts --> F[flyer]
  F -- stapled to --> S2[other scenes]
  S -- keeps --> C[commons]
  C -- runs --> Q[quests]
  Q -- documented as --> P
  V[visitor] -- signs --> G[guestbook]
  G --> R
  R -- webring --> R2[other rooms]
```

## The loops

The connections are the design. Each loop closes back on lived life; that closure is what "pointed at the physical world" means mechanically.

1. **Publication.** Live, make, submit; the editor assembles; the issue drops at the bell hour; everyone reads the same finite object; the guestbooks fill; the talk feeds the next cycle. Anticipation replaces compulsion. The notification is a church bell, not a slot machine.
2. **Invitation.** A scene posts a flyer; staples carry it to consenting corkboards; humans end up in a room together; the documentation comes back as pieces; the issue makes the next flyer easier to say yes to. The only thing that spreads is the thing that gathers.
3. **Trust.** Vouched members do work; work earns the standing to vouch; names-on-vouches make trust a form of social collateral rather than a CAPTCHA. In a majority-bot internet, this loop is the moat.
4. **Commons.** Quests teach skills; the ledger records who can now teach them; capability compounds; bigger quests become possible. Forks copy the commons, so the federation's growth mechanism is also its knowledge transfer mechanism.
5. **Energy.** The watt budget keeps what a scene serves small and static; small is the identity; the identity is the politics; the politics keep costs near zero; the dues surplus flows to tools and shows; the shows feed the invitation loop. Constraint, style, money, and meaning are one circuit.

## Rhythm

Notification policy, exhaustively: issue drop, guestbook signature, knock at the stoop, flyer stapled to your corkboard, vouch request. Nothing else exists to notify about. All five are batchable and default to the scene's own cadence. No red dots; a bell schedule.

The cycle is the clock of the whole system. A scene choosing weekly lives weekly; a scene choosing monthly lives monthly. Nothing anywhere refreshes.

## Trust and moderation

Intra-scene moderation is a dinner-party problem and stays one: scene norms, editor discretion within an issue, membership decisions by the scene's own process (CHARTER II.1). Inter-scene friction is handled at the staple layer first (revoke consent, unstaple, done) and by the court for what remains (CHARTER VI). The court's record goes on the shelf, readable whole.

The public stoop (CHARTER II.4) is the anti-clique valve: vouching may be selective, reachability may not. Every scene has a door, and anyone can knock at it.

What is public is decided per surface, not per scene. Issues are public, because a zine nobody outside can read is a diary. The stoop is public, because a scene with no door is a clique. Rooms are public only if their member says so. The membership roll is not public, and the tooling defaults it closed (CHARTER I.3): a small scene doing tenant organizing has a threat model that a book club does not, and the safe default costs the book club nothing.

## Addressing

Every issue has a permanent address, because an address is what you can text to somebody, and a zine you cannot hand over is not doing its job. The shape:

```
<host>/stoop/<scene>/            the scene's public stoop, and its shelf
<host>/stoop/<scene>/03/         issue №03, reading view
<host>/stoop/<scene>/03/sheet    the same issue, imposed for a printer
<host>/stoop/<scene>/latest/     alias for the newest issue
```

No scene is published at that shape yet. The Stage 0 app in this repo prints the sheet; the addresses above are what a published scene will look like once one exists, and `press/` plus the app's press are the two hands that make the paper in the meantime.

Numbers, not slugs. Titles change and get argued about; the number is the spine, and the title lives on the cover where it belongs. Zero-padded so the shelf sorts itself.

Links inside a scene are relative, always. That one rule is what makes CHARTER II.6 real: the built scene is a directory, and a directory that never names its own host can be copied to another host, or onto a thumb drive, or into a tarball in a shoebox, and every link still works. The canonical scene is its repository. Whatever renders it at whatever domain is a mirror, including ours, including the flagship, and the day a scene wants its own domain the move is `cp -r` and a DNS record.

The two substrates point at each other. The printed back cover carries the issue's URL; the reading view carries a link to the sheet. Somebody who finds the paper can get the archive, and somebody who finds the archive can make paper.

## Data and federation

A scene is a git repository of plain files, and that is the whole data layer. Rooms are directories, pieces are files, issues are built artifacts committed back in, the guestbook is an append-only file per room, the commons is a wiki directory. This one decision pays for most of the charter: credible exit (III.5) is `git clone`, open everything (III.4) is the format being readable in a text editor, the fork guarantee (II.3) is a fork, and the audit trail is `git log`.

Federation rides on top of that and is optional. AT Protocol lexicons under a `town.stoop.*` namespace (`room`, `light`, `scene`, `piece`, `issue`, `flyer`, `staple`, `vouch`, `guestbook.entry`) let scenes announce themselves to each other and let rooms syndicate outward; members' repos can live on any PDS. None of it is load-bearing. A scene that never touches a protocol still has rooms, issues, a shelf, a corkboard, and paper, which is the test any federation layer has to pass before it earns its complexity.

Stoop needs no relay and no appview at global scale, because there is no global surface to serve; the rounds run on an opt-in registry, which is a text file's worth of infrastructure.

Bridges: POSSE outward to the dying networks (a room can syndicate); read-bridges from ActivityPub where a scene wants them. Stoop rides rails that Free Our Feeds is independently working to keep billionaire-proof, and adds nothing to the protocol layer that would require trusting us.

## Energy and aesthetic

Budget first for the site, and never for the zine. The pages a scene serves stay light; no video; static output. The zine itself carries its photographs as they were taken, in colour, because a tool that decides for the people making a zine that their photographs will be black and white is not saving anyone anything; the copier's own looks, grain and halftone dots and hard contrast, are one tap away for anybody who wants them. A scene's whole presence should serve from a machine drawing single-digit watts, Low-tech Magazine style, and the flagship's battery meter renders in the header as an honest instrument. In long rain the solar instance goes down, and that is a feature: a memento that the network is a physical thing on one physical planet.

Accessibility rides the same choices: type sets in high contrast by default; color never carries meaning alone; meaning-bearing color pairs sit on the blue/orange axis, never red/green; captions are zine culture already.

## Economics

CHARTER Article V holds the law; the numbers that make it real: a 25-member scene at sliding-scale dues around $3 pools about $75 monthly against single-digit hosting costs, and the surplus is the point: editor tips, the tool library, the print run, the show.

At the other end of the range, a scene of two costs nothing. Static files on a host that already exists, a copier at the library, a box of paper. The dues machinery switches on when there is a bill, and until then the scene's economics are a stack of paper and somebody's Friday evening. A design that only makes sense with a treasury is a design that cannot start. Cohost's autopsy (30K users, 2,630 payers, $17K monthly deficit) is the boundary condition this design is built to never approach: no salaries at the start, no island infrastructure ever, costs pinned to the watt budget.

## Growth and measurement

Growth is mitosis and hand-to-hand vouching. There is no growth team and nothing for one to optimize; noplace took $19M of venture money into the nostalgia lane, which by the enshittification cycle means that lane is pre-tainted, and this system is unfundable by construction instead. Slow is the cost and the point: zines spread hand to hand.

What we measure, since engagement is unconstitutional: the Issue #2 rate (scenes that ship a second issue; the founding gate), median issues per scene-year, quest completions, ledger growth (skills newly teachable), flyers that ended with humans in a room. A scene going quiet is not churn; it is a scene resting. The system must never learn what a DAU is.

## Staging

Written before any of it existed. Kept because the reasoning is still worth reading, and marked because the route changed.

- **Stage 0, one scene, hand tools.** Two people, a folded sheet, and a directory of static files at a real address. Gate: Issue #2 ships. *This is where the project is, and the tooling turned out to be worth building properly: see `PLAN.md`.*
- **Stage 1, the scene tool.** The composer, the editor's board, issue build, the room editor, corkboard, shelf. *The desk, the issue build and the shelf exist in the app now. The room editor and skin sandbox are struck — they are the social product, not the press.*
- **Stage 2, federation.** ~~The lexicons, vouch records, rounds registry, credible-exit export, POSSE bridges.~~ **Struck.** Credible exit is a file (`FORMAT.md` §1); the rest belongs to whoever picks the format up.
- **Stage 3, the cooperative.** ~~Charter ratified, court seated, flagship host.~~ **Struck.** A format cannot be sold, advertised on, or acquired, which is what Article III was reaching for by other means.

## Open questions

The name of the system (an argument to have with the people who will live in it, and one the addressing scheme buys time on: `<host>/stoop/<scene>/` names the scene in the path and the software only in the prefix, so a scene can be named tonight while the project's name stays unsettled until the lexicons need it). Editor burnout in low-labor scenes, and whether tipped editing changes the character of the role. The court is designed on paper and untested anywhere. Vouch collusion at the margins, held today by scene-scale visibility, unproven at federation scale. The under-16 posture needs real counsel before anyone points a school at this. Whether an autoplay track in 2026 is love or menace; the answer is probably a play button that remembers you pressed it last time. And whether the first scene ships Issue #2, which outranks every other question in this file.
