# Screenshots für Flathub

Flathub nimmt grafische Apps nur mit mindestens einem echten Screenshot an. Die Einträge in `packaging/flatpak/io.github.utopijaja.FantasyWriter.metainfo.xml` sind Platzhalter. Die verlinkten PNGs gibt es noch nicht, und `raw/main/…` wäre selbst mit echten Dateien die falsche Adresse: Flathub will einen direkten Bild-Link auf einen Git-Tag oder Commit, nicht auf einen Branch.

## Was fehlt

Zwei Aufnahmen der laufenden App, als PNG, ohne persönliche Buchtexte:

1. `bibliothek.png` – Bibliothek, möglichst das Hauptfenster.
2. `editor.png` – ein Kapitel im Editor.

Sinnvolle Größe: Fenster etwa 1600×900 oder das tatsächliche Fenster, seitenverhältnisnah 16:9. Keine Mockups und keine Fremdaufnahmen.

## Danach im Metainfo eintragen

Die Platzhalter-URLs (`placeholder-bibliothek.png`, `placeholder-editor.png`) durch Adressen in dieser Form ersetzen:

```text
https://raw.githubusercontent.com/utopijaja/fantasywriter/<tag-oder-commit>/docs/screenshots/bibliothek.png
https://raw.githubusercontent.com/utopijaja/fantasywriter/<tag-oder-commit>/docs/screenshots/editor.png
```

Die Bildunterschriften auf Deutsch und Englisch so ändern, dass sie das Bild beschreiben und nicht mehr „PLATZHALTER“ enthalten.

`appstreamcli validate` und der Flathub-Linter laden die Bilder. Solange die URLs ins Leere zeigen, schlägt die Screenshot-Prüfung fehl. Das ist gewollt, bis die echten Dateien im getaggten Stand liegen.
