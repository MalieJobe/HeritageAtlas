# GEDCOM test fixtures

## royal92.ged

The canonical real-world GEDCOM test dataset: **Denis R. Reid's "European Royalty"**
genealogy (HEAD: `SOUR PAF 2.2`, `FILE ROYALS.GED`, dated 20 NOV 1992).

- **3010 individuals, 1422 families**, ~458 KB.
- Rich content for round-trip testing: BIRT/DEAT/BURI/CHR events, MARR/DIV in
  families, place names, titles, and approximate/range date qualifiers (ABT/BEF/AFT).
- Declared charset is ANSEL, but this particular file is pure ASCII (no high bytes),
  so it decodes cleanly as UTF-8.

Used as the gold-standard fixture for GEDCOM import/export round-trip tests
(`src/lib/gedcom/`).

### Provenance & licensing

The file carries its own in-file grant from the author: _"You may make this Royal
GEDCOM available to whomever."_ — effectively public domain / freely
redistributable. It is the de-facto standard test file across open-source GEDCOM
parsers.

Vendored from the curated collection
[arbre-app/public-gedcoms](https://github.com/arbre-app/public-gedcoms)
(`files/royal92.ged`).
