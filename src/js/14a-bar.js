// ---------- the bar ----------
// The zine's name, where it is shown and where it is changed. Split from boot
// only for the line ceiling.
function renderBar() {
  var z = document.getElementById('barzine');
  if (z && document.activeElement !== z) z.textContent = state.zine || 'STOOP ZINE';
}

// The name is edited where it is shown. It lands on the cover, the flyer and
// every file this press writes, the moment you leave the field.
function commitBarName() {
  var z = document.getElementById('barzine');
  if (!z) return;
  var name = z.textContent.replace(/\s+/g, ' ').trim().slice(0, 40);
  if (!name) { renderBar(); return; }
  if (name === state.zine) return;
  state.zine = name;
  var ps = pressState();
  if (ps.panels[0]) ps.panels[0].h = name;
  saveState();
  renderAll();
  toast(name);
}
document.addEventListener('focusout', function (e) { if (e.target.id === 'barzine') commitBarName(); });
document.addEventListener('keydown', function (e) {
  if (e.target.id !== 'barzine') return;
  if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
  if (e.key === 'Escape') { renderBar(); e.target.blur(); }
});
