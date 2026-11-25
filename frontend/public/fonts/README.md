# Self-hosted fonts

Served from `/fonts/` by the frontend container; `src/styles/global.css` declares them with `@font-face` and `font-display: optional` (ADR 0028). No request goes to a third party.

| File family           | Weights       | Source                                                  |
| --------------------- | ------------- | ------------------------------------------------------- |
| Big Shoulders Display | 800, 900      | `@fontsource/big-shoulders-display` 5.3.0, latin subset |
| Archivo               | 400, 600, 700 | `@fontsource/archivo` 5.3.0, latin subset               |

The files are the `*-latin-<weight>-normal.woff2` builds from the packages' `files/` folder. The licences are the SIL Open Font License 1.1 (`OFL-*.txt`, copied from each package). No font package is a runtime dependency.

To update: download the same package version with `npm pack`, copy the matching files, and check that the licence still declares no Reserved Font Name.
