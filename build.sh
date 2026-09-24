#!/usr/bin/env bash
# Assemble shipped artifacts from src/. The SQLite rule: develop as parts,
# ship as one file. Outputs are generated; edit src/, never the outputs.
#
# The src/js parts are concatenated inside a single IIFE emitted here, so
# they share one scope without any module plumbing: parts on disk, one
# function at rest.
#
#   artifact/index.html  app fragment (no doctype; the claude.ai publisher wraps it)
#   artifact/press.html  press fragment (same shape)
#   index.html           full document for GitHub Pages and local opening
#   press/index.html     full document, same treatment
#
# OUT_ROOT overrides the output prefix (check.sh builds to a temp dir).
set -euo pipefail
cd "$(dirname "$0")"
export LC_ALL=C
OUT_ROOT="${OUT_ROOT:-.}"

emit_app_fragment() {
  cat src/meta.html
  printf '<style>\n'
  # The press's two faces, base64 into @font-face rules: fonts inside a
  # stylesheet inside a page, so the page asks nobody for them. WOFF is the
  # same TrueType with each table compressed; the PDF writer reads these same
  # bytes back out of the stylesheet, unpacks them and embeds them.
  printf '@font-face{font-family:Anton;font-display:block;src:url(data:font/woff;base64,%s) format("woff")}\n' \
    "$(base64 -w0 src/fonts/anton-press.woff)"
  printf '@font-face{font-family:Knewave;font-display:block;src:url(data:font/woff;base64,%s) format("woff")}\n' \
    "$(base64 -w0 src/fonts/knewave-press.woff)"
  # Comments stay in src/ and out of every issue file, as with the script.
  cat src/base.css src/forms.css src/views.css src/paste.css src/phone.css | perl -0pe 's{/\*.*?\*/}{}gs'
  printf '</style>\n\n'
  cat src/chrome.html
  printf '\n<main>\n\n'
  cat src/views/*.html
  printf '</main>\n'
  cat src/footer.html
  printf '<script>\n(function(){\n'
  # Whole-line comments stay in src/, for whoever works on the press. They
  # are dropped here because every issue file carries the press, and every
  # reader would pay for them again in every file.
  cat src/js/*.js | sed -E '/^[[:space:]]*\/\//d'
  printf '\n})();\n</script>\n'
}

wrap_doc() { # $1 fragment-file  $2 description  $3 out-file
  local title_line
  title_line=$(grep -m1 '^<title>' "$1")
  {
    printf '<!doctype html>\n<html lang="en">\n<head>\n'
    printf '<meta charset="utf-8">\n'
    printf '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
    printf '<meta name="description" content="%s">\n' "$2"
    printf '%s\n' "$title_line"
    printf '</head>\n<body>\n'
    sed '0,/^<title>/{/^<title>/d;}' "$1"
    printf '</body>\n</html>\n'
  } > "$3"
}

mkdir -p "$OUT_ROOT/artifact" "$OUT_ROOT/press"

emit_app_fragment > "$OUT_ROOT/artifact/index.html"
cp src/press.html "$OUT_ROOT/artifact/press.html"

wrap_doc "$OUT_ROOT/artifact/index.html" \
  "A press for a periodical: submit pieces, assemble an issue at the desk, impose it for paper, and keep every back issue on the shelf. Each exported issue carries the press inside it. Local-first, no accounts, no server." \
  "$OUT_ROOT/index.html"

wrap_doc "$OUT_ROOT/artifact/press.html" \
  "Print-and-fold kit for a first zine: one letter sheet, eight pages, one cut." \
  "$OUT_ROOT/press/index.html"

echo "built: artifact/index.html artifact/press.html index.html press/index.html (root: $OUT_ROOT)"
