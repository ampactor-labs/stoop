// ---------- router ----------
var views = document.querySelectorAll('section[data-view]');
var navs = document.querySelectorAll('[data-nav]');

function showView() {
  var h = (location.hash || '#log').slice(1).split('/')[0];
  var hit = false;
  views.forEach(function (v) {
    var on = v.getAttribute('data-view') === h;
    v.classList.toggle('on', on);
    if (on) hit = true;
  });
  if (!hit) {
    h = 'log';
    views.forEach(function (v) { v.classList.toggle('on', v.getAttribute('data-view') === 'log'); });
  }
  navs.forEach(function (a) { a.classList.toggle('here', a.getAttribute('data-nav') === h); });
  document.body.classList.toggle('landing', h === 'issue');
  if (h === 'issue') renderLanding();
  if (h === 'press') renderPress();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', showView);

// ---------- events ----------
function hit(target, sel) { return target.closest ? target.closest(sel) : null; }

document.addEventListener('click', function (e) {
  var t = e.target;
  var el;

  // Arming a photo turns every panel into a drop target for one click.
  if ((el = hit(t, '[data-traypic]'))) { armPhoto(el.getAttribute('data-traypic')); return; }
  if (armedPhoto && (el = hit(t, '.panel'))) {
    e.preventDefault();
    if (placePhoto(Number(el.getAttribute('data-page')))) return;
  }
  if ((el = hit(t, '[data-delpanelpic]'))) {
    pressState().panels[Number(el.getAttribute('data-delpanelpic')) - 1].photo = null;
    savePress(); renderPress(); return;
  }

  if (hit(t, '#landmake')) return leaveLanding('#desk');
  if (hit(t, '#landown')) return startOwn();
  if (hit(t, '#landshelf')) return leaveLanding('#shelf');

  if (hit(t, '#authortoggle')) return toggleAuthor();
  if (hit(t, '#logaddbtn')) return addLog();
  if (hit(t, '#photobtn')) return document.getElementById('photofile').click();
  if ((el = hit(t, '[data-dellog]'))) {
    var lid = el.getAttribute('data-dellog');
    state.logs = state.logs.filter(function (l) { return l.id !== lid; });
    saveState(); sweepPhotos(); renderLogs(); renderTray(); return;
  }
  if ((el = hit(t, '[data-logfilter]'))) {
    activeLogFilter = el.getAttribute('data-logfilter');
    document.querySelectorAll('[data-logfilter]').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-logfilter') === activeLogFilter);
    });
    return renderLogs();
  }

  if (hit(t, '#projectaddbtn')) return addProject();
  if ((el = hit(t, '[data-delproject]'))) {
    var pid = el.getAttribute('data-delproject');
    state.projects = state.projects.filter(function (p) { return p.id !== pid; });
    saveState(); return renderProjects();
  }

  if (hit(t, '#journaladdbtn')) return addJournal();
  if ((el = hit(t, '[data-deljournal]'))) {
    var jid = el.getAttribute('data-deljournal');
    state.journal = state.journal.filter(function (j) { return j.id !== jid; });
    saveState(); return renderJournal();
  }

  // ---------- the desk ----------
  if (hit(t, '#piecesubmitbtn')) return submitPiece();
  if (hit(t, '#drawsourcesbtn')) return draftFromSources();
  if (hit(t, '#savebellbtn')) return saveBell();
  if ((el = hit(t, '[data-cutpiece]'))) return cutPiece(el.getAttribute('data-cutpiece'), true);
  if ((el = hit(t, '[data-restorepiece]'))) return cutPiece(el.getAttribute('data-restorepiece'), false);
  if ((el = hit(t, '[data-droppiece]'))) return dropPiece(el.getAttribute('data-droppiece'));
  if (hit(t, '#compileissuebtn')) return compileIssue();
  if (hit(t, '#buildissuebtn')) return buildIssue();

  // ---------- the shelf ----------
  if ((el = hit(t, '[data-readissue]'))) return readIssue(el.getAttribute('data-readissue'));
  if ((el = hit(t, '[data-reprintissue]'))) return reprintIssue(el.getAttribute('data-reprintissue'));
  if ((el = hit(t, '[data-exportissue]'))) return exportIssueFile(el.getAttribute('data-exportissue'));
  if ((el = hit(t, '[data-pdfissue]'))) {
    var iss = issueByNo(el.getAttribute('data-pdfissue'));
    if (iss) savePdf(iss.panels, iss.format, iss.hand, issueUrl(iss.no), iss.no,
      sceneSlug() + '-' + iss.no + '.pdf');
    return;
  }
  if ((el = hit(t, '[data-piecebundle]'))) return exportPieceBundle(el.getAttribute('data-piecebundle'));
  if (hit(t, '#closereader')) return readIssue(openIssueNo);

  if (hit(t, '#printzinebtn')) return printDraft();
  if (hit(t, '#pdfzinebtn')) {
    capturePanels();
    if (!confirmSheet('Save a PDF')) return;
    var ps = pressState();
    return savePdf(ps.panels, ps.format, ps.hand, issueUrl(ps.issue), ps.issue,
      sceneSlug() + '-' + ps.issue + '.pdf');
  }
  if (hit(t, '#flyerbtn')) {
    capturePanels();
    if (!confirmSheet('Make a flyer')) return;
    var fps = pressState();
    var cover = fps.panels[0] || {};
    return saveFlyer(cover.h, fps.issue, issueUrl(fps.issue), cover.photo,
      sceneSlug() + '-' + fps.issue + '-flyer.pdf');
  }
  if (hit(t, '#clearzinebtn')) return clearSheet();
  if (hit(t, '#swaplayoutbtn')) return swapLayout();
  if (hit(t, '#testsheetbtn')) return printTestSheet();

  if (hit(t, '#exportbtn')) return exportBackup();
  if (hit(t, '#bundlebtn')) return document.getElementById('bundlefile').click();
  if (hit(t, '#mergebtn')) { document.getElementById('importfile').dataset.mode = 'merge'; return document.getElementById('importfile').click(); }
  if (hit(t, '#replacebtn')) { document.getElementById('importfile').dataset.mode = 'replace'; return document.getElementById('importfile').click(); }
  if (hit(t, '#savenamesbtn') || hit(t, '#savenamesbtn2') || hit(t, '#savezinebtn')) {
    var zn = document.getElementById('zinename');
    if (zn && zn.value.trim()) state.zine = zn.value.trim();
    return saveNameFields();
  }
  if (hit(t, '#addpersonbtn')) {
    var np = document.getElementById('newperson');
    if (!np || !np.value.trim()) { toast('Give them a name first'); return; }
    addPerson(np.value.trim());
    np.value = '';
    renderAll();
    toast('Added. They can hold the desk like anybody else.');
    return;
  }
  if ((el = hit(t, '[data-delperson]'))) {
    var pid = el.getAttribute('data-delperson');
    people = people.filter(function (x) { return x.id !== pid; });
    savePeople();
    ensurePeople();
    renderAll();
    return;
  }
  if (hit(t, '#emptybtn')) return startEmpty();
  if (hit(t, '#resetbtn')) return resetData();
});

function saveBell() {
  var el = document.getElementById('bellinput');
  if (!el || !el.value) return;
  var parts = el.value.split('-');
  cycleState().bell = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 19, 0).getTime();
  saveState();
  renderDesk();
  toast('The bell is set');
}

document.addEventListener('keydown', function (e) {
  if (e.key !== 'Enter') return;
  if (e.target.id === 'loginput') { e.preventDefault(); addLog(); }
  else if (e.target.id === 'piecetitle') { e.preventDefault(); submitPiece(); }
  else if (e.target.id === 'addressinput' || e.target.id === 'zinename' ||
    e.target.hasAttribute('data-personid')) {
    e.preventDefault(); saveNameFields();
  }
  else if (e.target.id === 'newperson') {
    e.preventDefault();
    if (e.target.value.trim()) { addPerson(e.target.value.trim()); e.target.value = ''; renderAll(); }
  }
});

document.addEventListener('change', function (e) {
  if (e.target.id === 'formatsel') setFormat(e.target.value);
});

// Panel edits save on a debounce so the caret is never yanked mid-word.
var panelTimer = null;
document.addEventListener('input', function (e) {
  if (!e.target.closest || !e.target.closest('#sheetzone')) return;
  clearTimeout(panelTimer);
  panelTimer = setTimeout(capturePanels, 400);
});
document.addEventListener('focusout', function (e) {
  if (e.target.closest && e.target.closest('#sheetzone')) capturePanels();
});

var photoInput = document.getElementById('photofile');
if (photoInput) {
  photoInput.addEventListener('change', function (e) {
    var files = e.target.files;
    if (!files || !files.length) return;
    intakePhotos(files).then(function (ids) {
      if (ids.length) addLog(ids);
      renderTray();
    });
    e.target.value = '';
  });
}

var importInput = document.getElementById('importfile');
if (importInput) {
  importInput.addEventListener('change', function (e) {
    if (e.target.files && e.target.files[0]) {
      handleImportFile(e.target.files[0], e.target.dataset.mode || 'merge');
    }
    e.target.value = '';
  });
}

var bundleInput = document.getElementById('bundlefile');
if (bundleInput) {
  bundleInput.addEventListener('change', function (e) {
    if (e.target.files && e.target.files[0]) handleBundleFile(e.target.files[0]);
    e.target.value = '';
  });
}

// ---------- boot ----------
function fillFormats() {
  var sel = document.getElementById('formatsel');
  if (!sel) return;
  sel.innerHTML = FORMAT_IDS.map(function (id) {
    return '<option value="' + id + '">' + esc(FORMATS[id].label) + '</option>';
  }).join('');
  sel.value = pressState().format;
}

function fillSettings() {
  var addr = document.getElementById('addressinput');
  if (addr && document.activeElement !== addr) addr.value = state.address || '';
  var zn = document.getElementById('zinename');
  if (zn && document.activeElement !== zn) zn.value = state.zine || '';
}

// Photos load before the first paint so renders stay synchronous; the app is
// usable either way, so a failed store degrades to text rather than a blank page.
photoLoadAll().then(function () {
  hydrateFromSeed(readSeed());
  fillFormats();
  fillSettings();
  renderAll();
  fillSettings();
  showView();
});
