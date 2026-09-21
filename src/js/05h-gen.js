// ---------- generation ----------
// How many times this has been through the copier. Nought is the master;
// three is the copy somebody's cousin made of the copy they found in a
// laundromat. On screen it is an SVG filter that frays edges and throws
// toner; on paper it is speckle over every panel and dust in the
// photographs, drawn from the same seed on every machine.
var GEN_LABEL = ['GEN 0 · master', 'GEN 1 · a copy', 'GEN 2 · copy of a copy', 'GEN 3 · laundromat'];

function genOf(ps) {
  var g = parseInt(ps && ps.gen, 10);
  return g >= 0 && g <= 3 ? g : 0;
}

function renderGen() {
  var ps = pressState();
  var g = genOf(ps);
  var btn = document.getElementById('genbtn');
  if (btn) { btn.textContent = GEN_LABEL[g]; btn.classList.toggle('on', g > 0); }
  var run = document.querySelector('#sheetzone .pages');
  if (run) run.setAttribute('data-gen', String(g));
}

function cycleGen() {
  var ps = pressState();
  ps.gen = (genOf(ps) + 1) % 4;
  savePress();
  renderGen();
  toast(GEN_LABEL[genOf(ps)]);
}

// Deterministic speckle for one panel: a list of tiny rects in 0..1 space.
function speckle(gen, seed) {
  var out = [];
  if (!gen) return out;
  var n = gen * gen * 28;
  for (var i = 0; i < n; i++) {
    var r = hash32(seed + ':' + i);
    out.push({ x: (r % 1000) / 1000, y: ((r >>> 10) % 1000) / 1000, s: 0.4 + ((r >>> 20) % 5) * 0.35 });
  }
  return out;
}

document.addEventListener('click', function (ev) {
  if (ev.target.closest && ev.target.closest('#genbtn')) cycleGen();
});
