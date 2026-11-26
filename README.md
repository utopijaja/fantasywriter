# FantasyWriter

Schreibprogramm für Bücher mit Designs, Bildern und PDF/EPUB-Export.

FantasyWriter ist eine Desktop-App (Electron) für Linux. Du schreibst Kapitel, verwaltest Notizen und Bilder, baust eine Welt mit Figuren, Orten, Karten und einer Zeitleiste und exportierst dein Buch als PDF oder EPUB. Designs lassen sich selbst anlegen oder aus Firefox-Themes übernehmen.

## Voraussetzungen

- Node.js (mit npm)
- Linux (aktuell wird als AppImage und tar.gz gebaut)

## Entwicklung

```sh
npm install
npm start
```

## Paket bauen

```sh
npm run dist
```

Die fertigen Dateien liegen unter `dist/` und gehören nicht ins Repository.

## Wo deine Bücher liegen

Deine Bibliothek liegt nicht im Projektordner, sondern unter Dokumente/FantasyWriter (bzw. dem Dokumentenordner deines Systems). Einstellungen und eigene Designs liegen im Electron-Benutzerordner der App.

## Lizenz

Dieses Programm ist freie Software: Du darfst es unter den Bedingungen der [GNU General Public License, Version 3](https://www.gnu.org/licenses/gpl-3.0.html) oder — nach deiner Wahl — jeder späteren Version nutzen, weitergeben und verändern. Der vollständige Lizenztext steht in der Datei [`LICENSE`](LICENSE).
