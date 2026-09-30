// ---------- the catalogue card ----------
// Every issue carries the record zine librarians are standardising on, the
// twelve xZINECOREx elements: title, creators, publisher, contributors,
// date of publication, physical description, language, place, subjects,
// see-also, freedoms and restrictions, and a union id left blank for a
// library to fill. Six are read off the issue itself. The rest are typed
// once at the desk and stay for the next issue. The card rides in the file's
// head as JSON-LD so a hosted issue is machine-readable, prints as a
// COLOPHON block, goes to the site as a catalogue and a feed of issue drops,
// and the back cover carries a line to write back to.

function cardFields() {
  return [['place', 'PLACE', 'Where it is made'],
    ['language', 'LANGUAGE', 'English'],
    ['subjects', 'SUBJECTS', 'What it is about, comma separated'],
    ['rights', 'RIGHTS', 'What may be done with it: copy it, quote it, credit it'],
    ['seeAlso', 'SEE ALSO', 'Related zines, a distro, a link'],
    ['unionId', 'UNION ID', 'Left blank; a library fills it in']];
}

// Only the typed elements, only as strings, only so long. Runs on what a
// backup or a file says the card is, before any of it reaches the page.
function cleanCard(raw) {
  var out = {};
  if (!raw || typeof raw !== 'object') return out;
  cardFields().forEach(function (f) {
    var v = raw[f[0]];
    if (typeof v === 'string' && v.trim()) out[f[0]] = v.trim().slice(0, 200);
  });
  return out;
}

function cardState() {
  if (!state.card || typeof state.card !== 'object') state.card = {};
  return state.card;
}

function cardTyped() {
  var t = cleanCard(cardState());
  return Object.keys(t).length ? t : null;
}

// What an issue gets at the bell: the typed elements as they stood, so the
// card on the shelf says what was true when it shipped.
function cardAtBell(issue) {
  var t = cardTyped();
  if (t) issue.card = t;
}

function isoDay(ts) { return new Date(ts || Date.now()).toISOString().slice(0, 10); }

// The page as a librarian measures it: trimmed size, page count and how it
// is bound, in the paper's own units.
function physicalOf(formatId) {
  var f = formatOf(formatId);
  var size = pageSize(formatId);
  var pw = parseFloat(size.pw), ph = parseFloat(size.ph);
  var dims = f.paper === 'a4'
    ? Math.round(pw / 72 * 25.4) + ' × ' + Math.round(ph / 72 * 25.4) + ' mm'
    : +(pw / 72).toFixed(2) + ' × ' + +(ph / 72).toFixed(2) + ' in';
  var bound = f.kind === 'onecut' ? 'one sheet folded and cut'
    : (f.pages / 4) + ' sheet' + (f.pages > 4 ? 's' : '') + ' saddle-stitched';
  return dims + ', ' + f.pages + ' pages, ' + bound;
}

function coverPhotoId(issue) {
  var cover = (issue.panels || [])[0] || {};
  var el = (cover.els || []).filter(function (e) { return e && e.kind === 'photo' && e.photo; })[0];
  return cover.photo || (el && el.photo) || null;
}

// Who made it, by what they did: the editor and whoever wrote are the
// creators; whoever only photographed is a contributor.
function cardPeople(issue, ctx) {
  var words = [], photos = [];
  var who = (ctx && ctx.nameFn) || nameOf;
  var roster = (ctx && ctx.people) || people;
  var add = function (list, id) {
    if (!id || id === 'anon') return;
    var names = id === 'both' ? roster.map(function (p) { return p.name; }) : [who(id)];
    names.forEach(function (n) { if (list.indexOf(n) < 0) list.push(n); });
  };
  (issue.pieces || []).forEach(function (p) {
    if (String(p.body || '').trim()) add(words, p.byline);
    if (p.photo) add(photos, p.byline);
  });
  var rootOf = function (id) { return (photoMeta[id] && photoMeta[id].root) || id; };
  var shown = {};
  (issue.panels || []).forEach(function (p) {
    if (p && p.photo) shown[rootOf(p.photo)] = 1;
    (p && p.els || []).forEach(function (e) { if (e && e.photo) shown[rootOf(e.photo)] = 1; });
  });
  state.logs.forEach(function (l) { if (l.photo && shown[rootOf(l.photo)]) add(photos, l.author); });
  var editor = who(issue.editor);
  var creators = [editor].concat(words.filter(function (n) { return n !== editor; }));
  return { editor: editor, creators: creators,
    contributors: photos.filter(function (n) { return creators.indexOf(n) < 0; }) };
}

// ctx, when given, is the scene the issue belongs to as a file's seed names
// it (its name, address and roster); without it, this scene.
function cardOf(issue, ctx) {
  var typed = cleanCard(issue.card || (ctx && !ctx.own ? {} : cardState()));
  var zine = (ctx && ctx.zine) || state.zine || 'STOOP ZINE';
  var head = String(issue.title || (issue.panels && issue.panels[0] && issue.panels[0].h) || '').trim();
  var who = cardPeople(issue, ctx);
  var url = ctx ? distroUrl({ address: ctx.address, issue: issue }) : issueUrl(issue.no);
  var c = {
    title: zine + ' №' + issue.no + (head && head !== zine ? ': ' + head : ''),
    no: issue.no, publisher: zine, url: url, date: isoDay(issue.ts),
    editor: who.editor, creators: who.creators, contributors: who.contributors,
    physical: physicalOf(issue.format), pages: formatOf(issue.format).pages,
    image: url && coverPhotoId(issue) ? url + 'cover.jpg' : '',
    place: typed.place || '', language: typed.language || '', rights: typed.rights || '',
    seeAlso: typed.seeAlso || '', unionId: typed.unionId || '',
    subjects: (typed.subjects || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean)
  };
  c.blurb = String(issue.note || '').trim() ||
    (c.pages + ' pages, edited by ' + c.editor + ', ' + c.date + '.');
  return c;
}

// The draft on the press, read the way the bell will read it.
function draftIssue() {
  var ps = pressState();
  var ranIds = Array.isArray(ps.ran) ? ps.ran.map(function (r) { return r.id; }) : null;
  return { no: ps.issue, title: ps.panels[0] && ps.panels[0].h, format: ps.format, editor: cycleState().editor,
    ts: Date.now(), panels: ps.panels,
    pieces: livePieces().filter(function (p) { return !ranIds || ranIds.indexOf(p.id) >= 0; }) };
}

// The card laid out as a cutting, the way a colophon reads at the foot of a
// back page. A union id left blank prints as a line for the library's pen.
function colophonText(issue) {
  var c = cardOf(issue || draftIssue());
  var lines = [c.title, 'Edited by ' + c.editor + '.'];
  var wrote = c.creators.filter(function (n) { return n !== c.editor; });
  if (wrote.length) lines[1] += ' Words by ' + wrote.join(', ') + '.';
  if (c.contributors.length) lines[1] += ' Photographs by ' + c.contributors.join(', ') + '.';
  lines.push('Published by ' + c.publisher + (c.place ? ', ' + c.place : '') + ', ' + c.date + '.');
  lines.push(c.physical + '.');
  var about = [];
  if (c.language) about.push('In ' + c.language);
  if (c.subjects.length) about.push('Subjects: ' + c.subjects.join(', '));
  if (about.length) lines.push(about.join('. ') + '.');
  if (c.rights) lines.push(c.rights);
  if (c.seeAlso) lines.push('See also: ' + c.seeAlso);
  if (c.url) lines.push(c.url.replace(/^https?:\/\//, ''));
  lines.push('Union ID: ' + (c.unionId || '________'));
  return lines.join('\n');
}

// schema.org's PublicationIssue inside a Periodical, which is what a
// crawler, a library's harvester or a link unfurler reads.
function cardJsonLd(issue, ctx) {
  var c = cardOf(issue, ctx);
  var person = function (n) { return { '@type': 'Person', name: n }; };
  var out = {
    '@context': 'https://schema.org', '@type': 'PublicationIssue',
    issueNumber: c.no, name: c.title, datePublished: c.date, description: c.blurb,
    isPartOf: { '@type': 'Periodical', name: c.publisher,
      publisher: { '@type': 'Organization', name: c.publisher } },
    editor: person(c.editor), author: c.creators.map(person),
    numberOfPages: c.pages, size: c.physical
  };
  if (c.contributors.length) out.contributor = c.contributors.map(person);
  if (c.url) { out.url = c.url; out.isPartOf.url = c.url.replace(/[^\/]*\/$/, ''); }
  if (c.image) out.image = c.image;
  if (c.language) out.inLanguage = c.language;
  if (c.place) out.locationCreated = { '@type': 'Place', name: c.place };
  if (c.subjects.length) out.keywords = c.subjects.join(', ');
  if (c.rights) out.conditionsOfAccess = c.rights;
  if (c.seeAlso) out.citation = c.seeAlso;
  if (c.unionId) out.identifier = c.unionId;
  return out;
}

// Into the head of a file being written: the card as JSON-LD and the tags a
// shared link needs to unfurl. A page that was itself opened from a file
// carries the old card, which goes before the new one is written.
function stampCard(doc, seed) {
  var head = doc.querySelector('head');
  if (!head) return;
  head.querySelectorAll('#stoop-card, meta[data-card]').forEach(function (n) { n.parentNode.removeChild(n); });
  var no = seed && (seed.read || seed.no);
  var iss = seed && seed.stoop === 'issue' && (seed.issues || []).filter(function (i) { return i && i.no === no; })[0];
  if (!iss) return;
  var ctx = { zine: seed.zine, address: seed.address, people: seed.people || [], own: seedIsOurs(seed),
    nameFn: distroNameFn({ people: seed.people || [] }) };
  var c = cardOf(iss, ctx);
  var meta = function (key, content) {
    if (!content) return;
    var m = document.createElement('meta');
    m.setAttribute(key.indexOf(':') > 0 ? 'property' : 'name', key);
    m.setAttribute('content', content);
    m.setAttribute('data-card', '');
    head.appendChild(m);
  };
  meta('description', c.blurb);
  meta('og:title', c.title);
  meta('og:type', 'article');
  meta('og:description', c.blurb);
  meta('og:url', c.url);
  meta('og:image', c.image);
  var s = document.createElement('script');
  s.type = 'application/ld+json';
  s.id = 'stoop-card';
  s.textContent = JSON.stringify(cardJsonLd(iss, ctx)).replace(/<\//g, '<\\/');
  head.appendChild(s);
}

// ---------- the desk ----------
function renderCard() {
  var box = document.getElementById('cardfields');
  if (!box) return;
  var card = cardState();
  if (!box.children.length) {
    box.innerHTML = cardFields().map(function (f) {
      return '<label class="sub" for="card-' + f[0] + '">' + f[1] + '</label>' +
        '<input type="text" class="text-input" id="card-' + f[0] + '" data-card="' + f[0] + '" maxlength="200" placeholder="' + esc(f[2]) + '">';
    }).join('');
  }
  cardFields().forEach(function (f) {
    var input = document.getElementById('card-' + f[0]);
    if (input && document.activeElement !== input) input.value = card[f[0]] || '';
  });
  var c = cardOf(draftIssue());
  var derived = document.getElementById('cardderived');
  if (derived) {
    derived.textContent = c.title + ' · edited by ' + c.editor +
      (c.creators.length > 1 ? ', words by ' + c.creators.slice(1).join(', ') : '') +
      (c.contributors.length ? ', photographs by ' + c.contributors.join(', ') : '') +
      ' · ' + c.publisher + ' · ' + c.date + ' · ' + c.physical + '.';
  }
}

function saveCard(quiet) {
  var got = {};
  document.querySelectorAll('[data-card]').forEach(function (i) { got[i.getAttribute('data-card')] = i.value; });
  state.card = cleanCard(got);
  saveState();
  renderCard();
  if (!quiet) toast('The card is kept. It rides in the file, prints as a COLOPHON block and stays for the next issue.');
}

// Somebody typed the back cover's write-back line into a phone. The page
// they land on is the issue file at #reply: the press is already theirs, so
// it opens at the piece form, asks who is writing, and ends at SEND.
function replyFromPaper() {
  askWho();
  var kind = document.getElementById('piecekind');
  if (kind) kind.value = 'letters';
  var held = fileIssue();
  document.body.classList.remove('landing');
  location.hash = '#desk';
  setTimeout(function () {
    var t = document.getElementById('piecetitle');
    if (t) t.focus();
    toast('Writing back' + (held ? ' to №' + held.no : '') +
      '. SEND in the tray when it is done, and it goes to whoever holds the desk.');
  }, 60);
}
window.addEventListener('hashchange', function () { if (location.hash === '#reply') replyFromPaper(); });

document.addEventListener('click', function (ev) {
  if (ev.target.closest && ev.target.closest('#savecardbtn')) saveCard(false);
});
document.addEventListener('change', function (ev) {
  if (ev.target.hasAttribute && ev.target.hasAttribute('data-card')) saveCard(true);
});
document.addEventListener('keydown', function (ev) {
  if (ev.key === 'Enter' && ev.target.hasAttribute && ev.target.hasAttribute('data-card')) { ev.preventDefault(); saveCard(false); }
});
