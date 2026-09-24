# The press's faces

Two typefaces ship inside the press, and nothing else does.

- `anton-press.woff` is [Anton](https://github.com/google/fonts/tree/main/ofl/anton) by Vernon Adams (`OFL-Anton.txt`). Every headline, stencil, stamp and cover number.
- `knewave-press.woff` is [Knewave](https://github.com/google/fonts/tree/main/ofl/knewave) by Tyler Finck (`OFL-Knewave.txt`). The marker voice: a fat felt-tip, which is what a marker on a paste-up is.

Both are under the SIL Open Font License, which permits bundling and embedding on condition that the licence travels with the font; it does. Body text stays in Courier, which every PDF reader carries.

Each file is a subset: printable ASCII, Latin-1, the typographic punctuation people actually type, and, for Anton, №. Hinting, layout and name tables are dropped, and the result is wrapped as WOFF, which is the same TrueType with each table compressed. To regenerate them:

    pip install fonttools
    pyftsubset Anton-Regular.ttf --output-file=anton-press.woff --flavor=woff \
      --unicodes=U+0020-007E,U+00A0-00FF,U+2013-2014,U+2018-2019,U+201C-201D,U+2022,U+2026,U+2116 \
      --no-hinting --drop-tables+=GSUB,GPOS,GDEF,DSIG,kern,morx,prop,FFTM --name-IDs= --notdef-outline
    pyftsubset Knewave-Regular.ttf --output-file=knewave-press.woff --flavor=woff \
      --unicodes=U+0020-007E,U+00A0-00FF,U+2013-2014,U+2018-2019,U+201C-201D,U+2022,U+2026 \
      --no-hinting --drop-tables+=GSUB,GPOS,GDEF,DSIG,kern,morx,prop,FFTM --name-IDs= --notdef-outline

`build.sh` base64-encodes each into a `@font-face` rule in the page's stylesheet, so the fonts are files inside one file and the page makes no request for them. The PDF writer reads the same bytes back out of the stylesheet, unpacks each table, lays them end to end as TrueType again, and embeds that as a `FontFile2`, so the paper is set in exactly the faces the screen was. `test/10-typeface.js` holds it to that, table for table.
