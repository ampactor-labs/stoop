#!/usr/bin/env bash
# The repo's laws, checkable. Run before committing; CI runs it on push.
set -euo pipefail
cd "$(dirname "$0")"
fail=0

# 1. Build drift: committed outputs must be reproducible from src/.
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
OUT_ROOT="$tmp" bash build.sh >/dev/null
for f in artifact/index.html artifact/press.html index.html press/index.html; do
  if ! diff -q "$tmp/$f" "$f" >/dev/null 2>&1; then
    echo "FAIL: $f drifts from src/ (rebuild and commit, or fix src/)"
    fail=1
  fi
done

# 2. Source ceiling: no src file over 300 lines (split at the next natural boundary).
while IFS= read -r f; do
  n=$(wc -l < "$f")
  if [ "$n" -gt 300 ]; then
    echo "FAIL: $f is $n lines (ceiling 300)"
    fail=1
  fi
done < <(find src -type f)

# 3. The external-request law: shipped pages make zero requests to any host.
hits=$(grep -RlnE 'src="http|href="http|url\(http|@import' src/ || true)
if [ -n "$hits" ]; then
  echo "FAIL: external reference in src/:"
  echo "$hits"
  fail=1
fi

# 4. Badge honesty: the page-weight claim in the footer matches reality.
actual_kb=$(( $(wc -c < artifact/index.html) / 1024 ))
claimed_kb=$(grep -o '[0-9]* KB' src/footer.html | head -1 | grep -o '[0-9]*')
delta=$(( actual_kb - claimed_kb ))
if [ "${delta#-}" -gt 3 ]; then
  echo "FAIL: footer claims ${claimed_kb} KB, artifact is ${actual_kb} KB"
  fail=1
fi

# 5. Imposition agreement: the app's press and the hand kit in press/ must
# fold the same way. Two presses that disagree is a stack of ruined paper.
for hand in A B; do
  lower=$(printf '%s' "$hand" | tr 'AB' 'ab')
  kit=$(grep -oE "preset$hand=\[[0-9, ]+\]" src/press.html | tr -d ' ' | sed "s/preset$hand=//")
  app=$(grep -oE "PRESET_$hand = \[[0-9, ]+\]" src/js/04-impose.js | tr -d ' ' | sed "s/PRESET_$hand=//")
  if [ -z "$kit" ] || [ -z "$app" ]; then
    echo "FAIL: could not read imposition preset $hand from src/press.html or src/js/04-impose.js"
    fail=1
  elif [ "$kit" != "$app" ]; then
    echo "FAIL: imposition mismatch on fold $hand — kit $kit, app $app"
    fail=1
  fi
  : "$lower"
done

# 6. What a file weighs is not a law. There used to be a ceiling here, and
# it was a rule this project made for itself, not one anything needed: it
# held an issue under a megabyte and so held every photograph to black and
# white. The press says its own size in its footer (law 4), and
# test/08-weight.js checks that a file carries each thing once and nothing
# it does not need, which is the part that was ever worth guarding.

# 8. Portability: built output names no host, so a scene directory survives
# being copied to another host, a thumb drive, or a tarball.
if grep -qE '(src|href)="https?:' artifact/index.html artifact/press.html; then
  echo "FAIL: built output contains an absolute URL"
  fail=1
fi

# 7. Licenses present (charter III.4), including the font's: the OFL permits
# bundling on condition that it travels with the face.
if [ ! -f LICENSE ] || [ ! -f LICENSE-docs ] || [ ! -f src/fonts/OFL-Anton.txt ] || [ ! -f src/fonts/OFL-Knewave.txt ]; then
  echo "FAIL: LICENSE, LICENSE-docs or a font licence in src/fonts missing"
  fail=1
fi

# 9. The page carries its own face. An issue file that set its headlines in
# whatever the reader's machine had would reflow the moment it was handed on.
if ! grep -q '@font-face{font-family:Anton' artifact/index.html || ! grep -q '@font-face{font-family:Knewave' artifact/index.html; then
  echo "FAIL: the built page does not carry its typefaces"
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "check: all laws hold"
fi
exit "$fail"
