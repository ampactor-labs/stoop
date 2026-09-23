// ---------- landing ----------
// Somebody scanned the back of a zine, or was handed the file. What they were
// holding was paper, so what they get is the issue and nothing else: no
// header, no tabs, no shelf, no settings. At the end of it the press they are
// already holding offers itself, because that is the whole point of the file.
// The issue being held is the one in the file, named from the file's roster,
// whatever this device's own shelf keeps.
var landingSeed;
function fileIssue() {
  if (landingSeed === undefined) landingSeed = readSeed();
  var seed = landingSeed;
  if (!seed || seed.stoop !== 'issue') return null;
  var no = seed.read || seed.no;
  return (seed.issues || []).filter(function (i) { return i && i.no === no; })[0] || null;
}

function fileNameOf(id) {
  var roster = (landingSeed && landingSeed.people) || [];
  var p = roster.filter(function (x) { return x && x.id === id; })[0];
  return p ? String(p.name) : nameOf(id);
}

function landingIssue() {
  var held = fileIssue();
  if (held && (!openIssueNo || openIssueNo === held.no)) return held;
  var no = openIssueNo || (state.issues.length ? state.issues[state.issues.length - 1].no : null);
  return no ? issueByNo(no) : null;
}

function landingUrl(iss) {
  var held = fileIssue();
  var addr = held === iss && landingSeed.address;
  if (!addr) return issueUrl(iss.no);
  addr = String(addr).replace(/\/+$/, '');
  return (/^https?:\/\//.test(addr) ? addr : 'https://' + addr) + '/' + iss.no + '/';
}

function renderLanding() {
  var box = document.getElementById('landing');
  if (!box) return;
  var iss = landingIssue();
  if (!iss) { box.innerHTML = ''; return; }
  var next = cycleState().no;
  box.innerHTML = readingHtml(iss, null, iss === fileIssue() ? fileNameOf : null) +
    '<div class="landing-tail">' +
    '<p class="landing-note">This file is the zine, every issue before it, and the press that made it. ' +
    'No server, no account. You are holding the whole thing.</p>' +
    '<div class="landing-verbs">' +
    '<button class="btn done big" id="landmake">MAKE №' + esc(next) + '</button>' +
    '<button class="btn big" id="landown">START YOUR OWN</button>' +
    '<button class="btn quiet big" id="landshelf">THE SHELF</button>' +
    '</div></div>';
}

function leaveLanding(hash) {
  document.body.classList.remove('landing');
  location.hash = hash;
}

// Your own zine, on the press you were handed. The issue that got you here is
// cleared rather than kept, so your first file carries only your own work and
// not somebody else's №01 in its archive.
function startOwn() {
  var own = stateFromSeed ? 0 : state.logs.length + state.pieces.length + state.issues.length;
  if (!confirm('Start your own zine on this device? Everything stored here is cleared' +
    (own ? ', including the ' + state.issues.length + ' issue(s), ' + state.pieces.length +
      ' piece(s) and ' + state.logs.length + ' scrap(s) this device already had' : '') +
    ', so the first file you hand on carries only your own work.')) return;
  people = defaultPeople().slice(0, 1);
  savePeople();
  forgetUndo();
  state = normalize({ cycle: { no: '01', bell: Date.now() + 6048e5, editor: people[0].id } });
  saveState();
  sweepPhotos();
  renderAll();
  leaveLanding('#desk');
  toast('Yours. Name it under settings whenever you like.');
}
