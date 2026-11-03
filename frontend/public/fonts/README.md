# Self-hosted fonts

Served from `/fonts/` by the frontend container; `src/styles/global.css` declares them with `@font-face` and `font-display: swap`. No request goes to a third party.

| File family | Weights | Source |
|---|---|---|
| Cormorant Garamond (upright) | 600, 700 | `@fontsource/cormorant-garamond` 5.3.0, latin subset |
| Space Grotesk | 500, 600, 700 | `@fontsource/space-grotesk` 5.3.0, latin subset |
| Inter | 400, 500, 600 | `@fontsource/inter` 5.3.0, latin subset |

The files are the `*-latin-<weight>-normal.woff2` builds from the packages' `files/` folder. The licences are the SIL Open Font License 1.1 (`OFL-*.txt`, copied from each package). No font package is a runtime dependency.

To update: download the same package version with `npm pack`, copy the matching files, and check that the licence still declares no Reserved Font Name.
