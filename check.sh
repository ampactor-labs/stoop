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

# 6. The press's fixed cost. Every issue this app exports carries the app
# inside it, so the app's size is paid again in every issue file anyone sends.
#
# The number that actually matters is the issue file, and check.sh cannot build
# one — that needs a browser. So the real ceiling lives in test/08-weight.js,
# which publishes an issue and weighs it: a full eight-page issue with a
# photograph on every page stays under a megabyte. This check guards the one
# term of that sum that is cheap to measure here, the part identical in every
# issue whether it carries photographs or not.
#
# The ratchet is derived from the ceiling rather than chosen. A megabyte less
# eight photographs at about 83 KB each leaves 360 KB for the press, rounded
# down to 256 KB so the margin is real. Past that, the press could reach the
# ceiling on its own, which is the point at which the file stops being a zine
# with a press inside it. Measured today the press is about 190 KB and a full
# issue about 850 KB.
bytes=$(wc -c < artifact/index.html)
if [ "$bytes" -gt 262144 ]; then
  echo "FAIL: press is $((bytes / 1024)) KB; the ratchet is 256 KB (test/08-weight.js holds the issue-file ceiling)"
  fail=1
fi

# 8. Portability: built output names no host, so a scene directory survives
# being copied to another host, a thumb drive, or a tarball.
if grep -qE '(src|href)="https?:' artifact/index.html artifact/press.html; then
  echo "FAIL: built output contains an absolute URL"
  fail=1
fi

# 7. Licenses present (charter III.4), including the font's: the OFL permits
# bundling on condition that it travels with the face.
if [ ! -f LICENSE ] || [ ! -f LICENSE-docs ] || [ ! -f src/fonts/OFL.txt ]; then
  echo "FAIL: LICENSE, LICENSE-docs or src/fonts/OFL.txt missing"
  fail=1
fi

# 9. The page carries its own face. An issue file that set its headlines in
# whatever the reader's machine had would reflow the moment it was handed on.
if ! grep -q '@font-face{font-family:Anton' artifact/index.html; then
  echo "FAIL: the built page does not carry its typeface"
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "check: all laws hold"
fi
exit "$fail"
