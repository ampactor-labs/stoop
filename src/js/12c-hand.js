// ---------- handing on ----------
// Everything that leaves the device leaves here: an issue file, a piece, a
// PDF, plates, a site, a backup, a calendar entry. On a phone the system's
// share sheet is how things leave (AirDrop to the person in front of you,
// Messages, Mail, Files), and a download lands in a folder nobody opens; so
// on a phone that can share files, a file is shared. Anywhere else it is
// saved as it always was.

function saveBlob(name, blob) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}

function shareable(file) {
  try {
    return !!(navigator.share && navigator.canShare && window.matchMedia &&
      matchMedia('(pointer: coarse)').matches && navigator.canShare({ files: [file] }));
  } catch (e) { return false; }
}

// note, when given, rides along as the share's text: who the file is for.
// A share needs a tap it can call its own, and a PDF or a zip can take
// longer to write than a tap lasts; then the toast offers a fresh one.
function handOver(name, blob, note) {
  var file = null;
  try { file = new File([blob], name, { type: blob.type || 'application/octet-stream' }); } catch (e) {}
  if (!file || !shareable(file)) { saveBlob(name, blob); return; }
  var data = { files: [file], title: name };
  if (note) data.text = note;
  var fallback = function (e) { if (!e || e.name !== 'AbortError') saveBlob(name, blob); };
  navigator.share(data).catch(function (e) {
    if (e && e.name === 'AbortError') return;
    toast(name + ' is ready.', function () { navigator.share(data).catch(fallback); }, 'SHARE');
  });
}

// Where pieces go: the scene's contact, if it has one, in words.
function contactLine() {
  var c = String(state.contact || '').trim();
  return c ? 'Send it to ' + c + '.' : '';
}
