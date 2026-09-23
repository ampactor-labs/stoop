// ---------- the fit meter ----------
// A press that silently eats a paragraph is not a press. Every panel is
// measured against its own box and the words that will not print are counted
// and named, on the panel and in one line above the sheet. Split from the
// press only for the line ceiling; it reads and writes the same sheet.

// ---------- the fit meter ----------
// The panel clips what does not fit, because a printer will too — but it must
// not do so silently. Binary search the word list for the last line that fits:
// about nine reflows per over-full panel, on demand rather than per keystroke.
function measureOverflow(body) {
  if (body.scrollHeight <= body.clientHeight + 1) return 0;
  var original = body.innerText;
  // Trials keep the typed line breaks, or paragraphs go uncounted.
  var ends = [];
  var re = /\S+/g;
  var m;
  while ((m = re.exec(original))) ends.push(m.index + m[0].length);
  if (!ends.length) return 0;
  var lo = 0, hi = ends.length;
  while (lo < hi) {
    var mid = Math.ceil((lo + hi) / 2);
    body.innerText = original.slice(0, ends[mid - 1]);
    if (body.scrollHeight <= body.clientHeight + 1) lo = mid; else hi = mid - 1;
  }
  body.innerText = original;
  return ends.length - lo;
}

function checkFit() {
  var zone = document.getElementById('sheetzone');
  if (!zone) return 0;
  var active = document.activeElement;
  var total = 0;
  zone.querySelectorAll('.panel').forEach(function (el) {
    var body = el.querySelector('.body');
    var warn = el.querySelector('.fitwarn');
    if (!body || !warn) return;
    if (el.contains(active)) return;
    var over = measureOverflow(body);
    total += over;
    el.classList.toggle('over', over > 0);
    warn.textContent = over > 0 ? over + ' word' + (over === 1 ? '' : 's') + ' over' : '';
  });
  var meter = document.getElementById('fitmeter');
  if (meter) {
    meter.textContent = total > 0
      ? total + ' word' + (total === 1 ? '' : 's') + ' will not print. Cut, or move them to another page.'
      : '';
    meter.classList.toggle('bad', total > 0);
  }
  return total;
}

// ---------- what the sheet is ----------
// Ringing the bell leaves a fresh draft, so say so before paper is spent on
// it. Cuttings count as content; the cover's heading is just the zine's name.
function sheetIsBlank() {
  return pressState().panels.every(function (p, i) {
    return i === 0 ? !String(p.body || '').trim() && !p.photo && !(p.els || []).length : !panelHasWork(p);
  });
}

function pressStatus() {
  var el = document.getElementById('pressstatus');
  if (!el) return;
  var ps = pressState();
  var last = lastPublished();
  var blank = sheetIsBlank();
  var spare = (ps.spare || []).filter(panelHasWork).length;
  var said = [];
  if (spare) {
    said.push(spare + ' page' + (spare === 1 ? '' : 's') + ' did not fit this format and ' +
      (spare === 1 ? 'is' : 'are') + ' set aside, not lost \u2014 pick a bigger format to bring ' +
      (spare === 1 ? 'it' : 'them') + ' back.');
  }
  if (last) {
    said.push((blank ? 'This sheet is empty. ' : '') +
      'You are looking at the draft for issue \u2116' + ps.issue + '.' +
      ' Issue \u2116' + last.no + ' is published \u2014 print that one from the shelf.');
  }
  el.textContent = said.join(' ');
  el.classList.toggle('bad', !!spare || (!!last && blank));
}
