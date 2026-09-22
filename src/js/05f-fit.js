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
  var words = original.split(/\s+/).filter(Boolean);
  if (!words.length) return 0;
  var lo = 0, hi = words.length;
  while (lo < hi) {
    var mid = Math.ceil((lo + hi) / 2);
    body.innerText = words.slice(0, mid).join(' ');
    if (body.scrollHeight <= body.clientHeight + 1) lo = mid; else hi = mid - 1;
  }
  body.innerText = original;
  return words.length - lo;
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
