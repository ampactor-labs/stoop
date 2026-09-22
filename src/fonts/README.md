# The press's face

`anton-press.ttf` is [Anton](https://github.com/google/fonts/tree/main/ofl/anton) by Vernon Adams, under the SIL Open Font License (`OFL.txt` alongside). It is the one typeface the press ships: every headline, stencil, marker, stamp and cover number on every page, on every machine, in every issue file the press writes, and embedded in every PDF. Body text stays in Courier, which every PDF reader carries and every machine has.

The file is a subset, not the whole font: printable ASCII, Latin-1, the typographic punctuation people actually type, and №. Hinting, layout and name tables are dropped. That is why it is 15 KB where Anton is 170 KB. To regenerate it:

    pip install fonttools
    pyftsubset Anton-Regular.ttf --output-file=anton-press.ttf \
      --unicodes=U+0020-007E,U+00A0-00FF,U+2013-2014,U+2018-2019,U+201C-201D,U+2022,U+2026,U+2116 \
      --no-hinting --drop-tables+=GSUB,GPOS,GDEF,DSIG,kern,morx,prop,FFTM --name-IDs= --notdef-outline

`build.sh` base64-encodes it into a `@font-face` rule in the page's stylesheet, so the font is one file inside one file and the page makes no request for it. The PDF writer reads those same bytes back out of the stylesheet and embeds them as a `FontFile2`, so the paper is set in exactly the face the screen was.

The OFL permits bundling and embedding. It forbids selling the font on its own and requires this licence to travel with it, which it does.
