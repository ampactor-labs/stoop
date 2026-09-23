// ---------- identity ----------
// A scene is however many people it is. Entries are stored against a stable
// id, never a spelling, so renaming somebody leaves their past work attached
// to them. Ids for anyone added after the founding pair are random rather than
// sequential, because two scenes both handing out "c" would collide the first
// time they traded a piece.
var STORAGE_KEY = 'stoop_data_v4';
// The id of the payload an exported issue carries. It lives here, with the
// other storage keys, because the store reads it while the app is still
// starting up: a var assigned further down the bundle is hoisted but empty by
// then, and the archive silently would not arrive.
var SEED_ID = 'stoop-seed';
var PEOPLE_KEY = 'stoop_people';
var NAMES_KEY = 'stoop_names';
var AUTHOR_KEY = 'stoop_active_author';

function defaultPeople() { return [{ id: 'a', name: 'me' }]; }

var people = (function () {
  try {
    var raw = JSON.parse(localStorage.getItem(PEOPLE_KEY));
    if (Array.isArray(raw) && raw.length) {
      var ok = raw.filter(function (p) { return p && p.id && p.name; });
      if (ok.length) return ok;
    }
    var old = JSON.parse(localStorage.getItem(NAMES_KEY));
    if (old && old.a && old.b) {
      return [{ id: 'a', name: String(old.a) }, { id: 'b', name: String(old.b) }];
    }
  } catch (e) {}
  // An issue file opened on a machine that has never seen this app brings its
  // own roster. Defaulting first would take the ids a and b, and the names
  // arriving in the file would be refused as already present.
  try {
    var seed = readSeed();
    if (seed && Array.isArray(seed.people) && seed.people.length) {
      var carried = seed.people.filter(function (p) { return p && p.id && p.name; });
      if (carried.length) return carried;
    }
  } catch (e) {}
  return defaultPeople();
})();

function savePeople() {
  try { localStorage.setItem(PEOPLE_KEY, JSON.stringify(people)); } catch (e) {}
}
function personIds() { return people.map(function (p) { return p.id; }); }
// 'both' means made together: "Both" for a pair, "Together" otherwise, and
// not offered to a scene of one.
function authorIds() { return people.length > 1 ? personIds().concat('both') : personIds(); }
function personById(id) {
  return people.filter(function (p) { return p.id === id; })[0] || null;
}
function nameOf(id) {
  if (id === 'both') return people.length === 2 ? 'Both' : 'Together';
  var p = personById(id);
  return p ? p.name : 'Someone';
}
function addPerson(name) {
  var p = { id: 'p' + Math.random().toString(36).slice(2, 7), name: (name || 'Someone').trim() || 'Someone' };
  people.push(p);
  savePeople();
  return p;
}

// Storage can throw (private windows, blocked site data).
var currentAuthor = (function () {
  try { return localStorage.getItem(AUTHOR_KEY) || 'a'; } catch (e) { return 'a'; }
})();
function rememberAuthor() {
  try { localStorage.setItem(AUTHOR_KEY, currentAuthor); } catch (e) {}
}

// Every byline in the store must belong to somebody on the roster, or a name
// is lost the moment a piece arrives from another copy of the app.
function ensurePeople() {
  var seen = {};
  personIds().forEach(function (id) { seen[id] = 1; });
  var found = {};
  function note(id) { if (id && id !== 'both' && !seen[id]) found[id] = 1; }
  (state.logs || []).forEach(function (l) { note(l.author); });
  (state.pieces || []).forEach(function (p) { note(p.byline); });
  (state.issues || []).forEach(function (i) {
    note(i.editor);
    (i.pieces || []).forEach(function (p) { note(p.byline); });
  });
  var added = Object.keys(found);
  added.forEach(function (id) { people.push({ id: id, name: 'Someone' }); });
  if (added.length) savePeople();
  if (authorIds().indexOf(currentAuthor) < 0) currentAuthor = people[0].id;
  return added.length;
}

// A roster arriving from a backup or a piece bundle is merged by id: a rename
// on their device does not overwrite what this one calls them.
function mergePeople(incoming) {
  if (!Array.isArray(incoming)) return 0;
  var have = {};
  personIds().forEach(function (id) { have[id] = 1; });
  var added = 0;
  incoming.forEach(function (p) {
    if (!p || !p.id || !p.name || have[p.id]) return;
    people.push({ id: String(p.id), name: String(p.name) });
    have[p.id] = 1;
    added++;
  });
  if (added) savePeople();
  return added;
}

// ---------- helpers ----------
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function uid(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function fmtDay(ts) {
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric' });
}
function fmtStamp(ts) {
  var d = new Date(ts);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric' }) + ' · ' +
    d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' });
}
function toast(msg) {
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(t._h);
  t._h = setTimeout(function () { t.style.display = 'none'; }, 2400);
}

// ---------- seed ----------
var seedTs = Date.now();
var defaultData = {
  logs: [],
  projects: [],
  journal: [],
  // Two pieces in the tray so the desk has something to show. Cut them.
  pieces: [
    { id: 'pc1', kind: 'essay', byline: 'a', title: 'The Seam',
      body: 'The sodium lamps are going over to LED one block at a time, and you can stand on the line: orange behind you, white ahead.',
      photo: null, cut: false, ts: seedTs - 2e5 },
    { id: 'pc2', kind: 'log', byline: 'a', title: 'Workbench, Week Two',
      body: 'Trued the rear wheel. The seatpost finally moved, by way of penetrating oil and a personal grudge.',
      photo: null, cut: false, ts: seedTs - 1e5 }
  ],
  issues: [],
  cycle: { no: '01', bell: seedTs + 6048e5, editor: 'a' },
  address: '',
  zine: 'STOOP ZINE',
  press: null
};

// ---------- migration ----------
// v2 stored display names as authors and dates as pre-formatted strings.
var AUTHOR_MAP = { Suds: 'a', Partner: 'b', Together: 'both', Both: 'both' };

function migrate(data) {
  var fallback = Date.now();
  // Keep whatever id a record carries. A byline this device has never seen
  // belongs to a real person on some other device, and ensurePeople() gives
  // them a seat rather than filing their work under somebody else's name.
  function fixAuthor(v) {
    if (AUTHOR_MAP[v]) return AUTHOR_MAP[v];
    return (typeof v === 'string' && v) ? v : 'a';
  }
  function fixTs(item) {
    if (typeof item.ts !== 'number') { item.ts = fallback; fallback -= 6e4; }
    return item;
  }
  (data.logs || []).forEach(function (l) { l.author = fixAuthor(l.author); fixTs(l); });
  // Older notebooks kept a journal and a list of projects beside the log.
  // They were one idea; they arrive as scraps with a title and keep their ids.
  var have = {};
  data.logs.forEach(function (l) { have[l.id] = 1; });
  (data.journal || []).forEach(function (j) {
    if (!j || have[j.id]) return;
    data.logs.push(fixTs({ id: j.id, author: fixAuthor(j.author), tag: 'scrap', title: j.title || '', text: j.body || '', ts: j.ts }));
  });
  (data.projects || []).forEach(function (p) {
    if (!p || have[p.id]) return;
    data.logs.push(fixTs({ id: p.id, author: 'a', tag: 'scrap', title: p.title || '', text: p.desc || '', ts: p.ts }));
  });
  data.journal = [];
  data.projects = [];
  (data.pieces || []).forEach(function (pc) {
    pc.byline = fixAuthor(pc.byline);
    pc.title = typeof pc.title === 'string' && pc.title ? pc.title : 'Untitled';
    pc.body = typeof pc.body === 'string' ? pc.body : '';
    fixTs(pc);
  });
  (data.issues || []).forEach(fixTs);
  return data;
}

// Accept anything shaped like a backup; fill in what is missing rather than
// rejecting the file, so a partial import cannot leave the app unrenderable.
// A null record must not sink the store.
function records(list) {
  return Array.isArray(list) ? list.filter(function (x) { return x && typeof x === 'object'; }) : [];
}

function normalize(raw) {
  var out = {
    logs: records(raw && raw.logs),
    projects: records(raw && raw.projects),
    journal: records(raw && raw.journal),
    pieces: records(raw && raw.pieces),
    issues: records(raw && raw.issues),
    cycle: (raw && raw.cycle) || { no: '01', bell: Date.now() + 6048e5, editor: 'a' },
    address: (raw && raw.address) || '',
    zine: (raw && raw.zine) || 'STOOP ZINE',
    press: (raw && raw.press) || null
  };
  return migrate(out);
}

// True when this device's work came out of the file it was opened from.
var stateFromSeed = false;
var state = (function () {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalize(JSON.parse(raw));
    var v3 = localStorage.getItem('stoop_data_v3');
    if (v3) { toast('Upgraded your notebook — the shelf is new'); return normalize(JSON.parse(v3)); }
    var old = localStorage.getItem('stoop_data_v2');
    if (old) { toast('Upgraded your notes from the older format'); return normalize(JSON.parse(old)); }
  } catch (e) {}
  // An exported issue carries its own archive. Opened on a device with nothing
  // of its own, the file is the publication; opened on one that already has
  // work, the seed merges later rather than replacing anything.
  var seed = readSeed();
  if (seed) {
    stateFromSeed = true;
    return normalize({
      issues: seed.issues || [], pieces: seed.pieces || [],
      cycle: seed.cycle, address: seed.address || '', zine: seed.zine || 'STOOP ZINE'
    });
  }
  return JSON.parse(JSON.stringify(defaultData));
})();

ensurePeople();

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    toast('Could not save — device storage is full');
  }
}
