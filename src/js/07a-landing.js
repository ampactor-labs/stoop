// ---------- landing ----------
// Somebody scanned the back of a zine, or was handed the file. What they were
// holding was paper, so what they get is the issue and nothing else: no
// header, no tabs, no shelf, no settings. At the end of it the press they are
// already holding offers itself, because that is the whole point of the file.
function landingIssue() {
  var no = openIssueNo || (state.issues.length ? state.issues[state.issues.length - 1].no : null);
  return no ? issueByNo(no) : null;
}

function renderLanding() {
  var box = document.getElementById('landing');
  if (!box) return;
  var iss = landingIssue();
  if (!iss) { box.innerHTML = ''; return; }
  var next = cycleState().no;
  box.innerHTML = readingHtml(iss) +
    '<div class="landing-tail">' +
    '<p class="landing-note">' + esc(iss.title || 'This issue') +
    ' was made with the press it is carried in. This file is the issue, every issue before it, ' +
    'and a working press. Nothing was uploaded, nobody signed up, and the copy you are reading ' +
    'is the whole thing.</p>' +
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
  if (!confirm('Start your own zine on this device? The issue you were handed is cleared, ' +
    'so the first file you hand on carries only your own work.')) return;
  people = defaultPeople().slice(0, 1);
  savePeople();
  state = normalize({ cycle: { no: '01', bell: Date.now() + 6048e5, editor: people[0].id } });
  saveState();
  sweepPhotos();
  renderAll();
  leaveLanding('#desk');
  toast('Yours. Name it under settings whenever you like.');
}
