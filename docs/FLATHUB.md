# FantasyWriter auf Flathub

Dieses Dokument beschreibt, was für eine Einreichung bei Flathub noch von Hand zu tun ist. Ziel ist, dass FantasyWriter in Bazzite über die App-Verwaltung (Discover bzw. die Bazaar-Oberfläche, beide lesen Flathub) installierbar wird. Bazzite selbst hat keinen eigenen Store-Eintrag: sichtbar wird die App, sobald sie auf Flathub veröffentlicht ist.

**Auf flathub/flathub wird von hier aus nichts geöffnet.** Den Pull Request legt Julian selbst an und gibt ihn frei.

## Was schon im Repository liegt

- App-ID `io.github.utopijaja.FantasyWriter`
- Desktop-Datei `packaging/flatpak/io.github.utopijaja.FantasyWriter.desktop`
- AppStream-Metainfo `packaging/flatpak/io.github.utopijaja.FantasyWriter.metainfo.xml` (Name, Kurztext und Beschreibung auf Deutsch und Englisch, `project_license` GPL-3.0-or-later, `metadata_license` CC0-1.0, OARS-`content_rating`, Release 0.1.1, Links zum GitHub-Repository)
- Icons unter `packaging/flatpak/icons/hicolor/` in 16, 32, 48, 64, 128, 256 und 512 px
- Manifest `packaging/flatpak/io.github.utopijaja.FantasyWriter.yml` (Runtime `org.freedesktop.Platform` 26.08, BaseApp `org.electronjs.Electron2.BaseApp` 26.08, Node-SDK-Erweiterung node22)
- `packaging/flatpak/generated-sources.json` von `flatpak-node-generator`, damit `npm ci` ohne Netz läuft (npm-Pakete und die Electron-Zip für x86_64, aarch64 und arm)
- Startskript `packaging/flatpak/fantasywriter.sh` (zypak)

Die Metainfo-Lizenz CC0-1.0 gilt nur für die Metadaten-Datei, nicht für das Programm. Das Programm bleibt GPL-3.0-or-later.

## Icon

`build/icon.png` und `assets/icon.png` sind PNG mit 512×512 Pixeln. Das erfüllt die Flathub-Vorgabe (mindestens 128 px, sinnvoll 256 oder 512). Eine SVG-Fassung gibt es nicht. Die kleineren Größen sind aus der 512-px-Vorlage heruntergerechnet. Ein SVG wäre schärfer in Zwischengrößen, ist aber nicht nötig, solange die 512-px-PNG erhalten bleibt.

## Wo die App Daten ablegt

Unter Flatpak setzt die Laufzeit `XDG_CONFIG_HOME` auf `~/.var/app/io.github.utopijaja.FantasyWriter/config`. Die App legt Einstellungen und Designs nach `…/config/FantasyWriter` (`app.setPath('userData', …)` in `main.js`, sobald `FLATPAK_ID` gesetzt ist). Der Zwischenspeicher von Chromium folgt `XDG_CACHE_HOME`, also `~/.var/app/io.github.utopijaja.FantasyWriter/cache`.

Die Bibliothek bleibt, wie in der README beschrieben, im Dokumente-Ordner unter `FantasyWriter`. Dafür gibt es nur die Berechtigung `xdg-documents/FantasyWriter:create`, nicht das ganze Home.

Außerhalb von Flatpak ändert sich nichts: Dokumente/FantasyWriter und der bisherige Electron-Ordner. Der Starter fürs AppImage wird in der Sandbox nicht angelegt, weil Flatpak Desktop-Datei und Icon selbst ausliefert.

## Sandbox

| Berechtigung | Wofür |
| --- | --- |
| `--share=ipc` | Portale: Datei wählen, Papierkorb, Links öffnen. Ohne ipc erreichen die Portale den Sitzungsbus nicht. |
| `--socket=wayland` und `--socket=fallback-x11` | Fenster. Wayland, wenn die Sitzung es hat, sonst X11. Nicht beides dauerhaft. |
| `--device=dri` | GPU-Prozess von Chromium. Ohne dri zeichnet Electron nur in Software. |
| `--share=network` | Firefox-Designs von addons.mozilla.org laden und die Hunspell-Wörterbücher der Rechtschreibprüfung nachladen. Sonst kein Netzverkehr. |
| `--filesystem=xdg-documents/FantasyWriter:create` | Die Bibliothek ist ein Ordner aus JSON und Bildern, den die App direkt liest und schreibt. Dafür taugt das Dokumenten-Portal nicht. Import, Export und die Bildauswahl laufen über den Dateidialog und das Portal (`GTK_USE_PORTAL=1`), dafür braucht es keinen weiteren Dateizugriff. |

Nicht freigegeben: Home, Host, PulseAudio, der ganze Dokumente-Ordner, Firefox-Profile. Die automatische Suche nach installierten Firefox-Designs unter `~/.mozilla` und `~/.var/app/org.mozilla.firefox` findet in der Sandbox nichts. Ein Design lässt sich weiter über den Dateidialog (`.xpi`) oder über einen Add-on-Link importieren.

`ELECTRON_TRASH=gio` legt gelöschte Bücher über das Papierkorb-Portal ab. `ELECTRON_OZONE_PLATFORM_HINT=auto` wählt Wayland oder X11 passend zur Sitzung.

## Was vor der Einreichung noch fehlt

### Echte Screenshots

Flathub lehnt grafische Apps ohne mindestens einen echten Screenshot ab. Die Einträge in der Metainfo sind Platzhalter und zeigen auf Dateien, die es nicht gibt. `appstreamcli validate` meldet deshalb `screenshot-image-not-found`. Anleitung: `docs/screenshots/TODO.md`. Die Bild-URLs müssen auf einen Git-Tag oder Commit zeigen, nicht auf `main`.

### Englische Oberfläche

Flathub verlangt eine vollständige englische Lokalisierung der Oberfläche, nicht nur von Desktop-Datei und Metainfo. Die App-Oberfläche ist deutsch. Eine maschinelle Übersetzung darf dafür nicht verwendet werden. Die englischen Texte muss ein Mensch schreiben, bevor die Einreichung sinnvoll ist.

### Release taggen

Es gibt noch kein Git-Tag. Flathub soll einen festen Commit bauen, nicht den lokalen Ordner. Nachdem Screenshots und die englische Oberfläche im Repository sind: Tag setzen (zum Beispiel `v0.1.1`) und SHA notieren.

Im Manifest für den Flathub-Pull-Request den Quellenblock `type: dir` ersetzen durch:

```yaml
      - type: git
        url: https://github.com/utopijaja/fantasywriter.git
        tag: v0.1.1
        commit: <voller SHA des Tags>
```

`generated-sources.json` bleibt als zweite Quelle. Die Datei muss im Flathub-Branch neben dem Manifest liegen, weil flatpak-builder sie relativ zum Manifest einliest und nicht aus dem Git-Checkout der App.

Die App-ID endet auf `FantasyWriter`, das GitHub-Repository heißt `fantasywriter`. Flathub leitet daraus `https://github.com/utopijaja/FantasyWriter` ab. GitHub behandelt die Großschreibung als dieselbe Adresse. Falls die Prüfung den exakten Namen verlangt, das im Pull Request kurz begründen.

`generated-sources.json` neu bauen, wenn sich `package-lock.json` ändert. Das Verzeichnis `node_modules` darf dabei nicht existieren:

```sh
flatpak-node-generator npm package-lock.json \
  -o packaging/flatpak/generated-sources.json \
  --electron-node-headers \
  --node-sdk-extension org.freedesktop.Sdk.Extension.node22//26.08
```

### Manifest von einem Menschen

Flathub nimmt keine Manifeste an, die eine KI geschrieben oder mitgeschrieben hat. Die Dateien in diesem Branch sind eine Vorbereitung im App-Repository. Julian prüft das Manifest, versteht jede Berechtigung und reicht nur den Stand ein, für den er selbst einsteht. Ein Agent darf den Flathub-Pull-Request nicht öffnen, keine Commit-Nachricht dafür schreiben und nicht auf Review-Kommentare antworten.

Flathub kann Einreichungen mit sehr kurzer Entwicklungsgeschichte ablehnen. FantasyWriter hat bisher einen einzigen Commit. Das im Pull Request nicht beschönigen.

## Lokal bauen und installieren

Flathub-Remote einmalig:

```sh
flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
```

Bauen und ins Benutzer-Flatpak installieren (lädt Runtime, SDK, Electron-BaseApp und die Node-Erweiterung):

```sh
flatpak-builder --user --install --install-deps-from=flathub --force-clean \
  build-dir packaging/flatpak/io.github.utopijaja.FantasyWriter.yml
flatpak run io.github.utopijaja.FantasyWriter
```

Dabei prüfen:

- Das Fenster öffnet sich unter Wayland und, falls vorhanden, unter einer X11-Sitzung.
- Ein neues Buch liegt unter Dokumente/FantasyWriter und überlebt einen Neustart.
- Einstellungen liegen unter `~/.var/app/io.github.utopijaja.FantasyWriter/config/FantasyWriter`, nicht unter `~/.config`.
- Bild wählen, PDF exportieren und EPUB exportieren gehen über den Dateidialog und können außerhalb der Bibliothek speichern.
- Ein Firefox-Design per Datei und per Add-on-Link importieren. Die automatische Profilsuche bleibt leer. Das ist die Sandbox, kein Absturz.
- Rechtschreibung: beim ersten Mal braucht sie Netz, weil Electron die Wörterbücher nachlädt.

Prüfbefehle für die Metadaten:

```sh
desktop-file-validate packaging/flatpak/io.github.utopijaja.FantasyWriter.desktop
appstreamcli validate --explain packaging/flatpak/io.github.utopijaja.FantasyWriter.metainfo.xml
flatpak run --command=flatpak-builder-lint org.flatpak.Builder \
  manifest packaging/flatpak/io.github.utopijaja.FantasyWriter.yml
```

`desktop-file-validate` ist ohne Ausgabe in Ordnung. `appstreamcli` und `flatpak-builder-lint appstream` bleiben rot, solange die Screenshot-Platzhalter nicht durch erreichbare Bilder ersetzt sind (`screenshot-image-not-found`). `flatpak-builder-lint manifest` prüft das Manifest selbst. `type: dir` darin ist nur für den lokalen Bau. Flathub baut nicht den Entwicklerrechner, deshalb gilt für die Einreichung der Git-Quellenblock oben.

## Einreichung bei Flathub

Erst wenn Screenshots, englische Oberfläche, Tag und ein von Julian geprüfter Manifest-Stand stehen.

1. `https://github.com/flathub/flathub` forken. „Copy the master branch only“ nicht ankreuzen, sonst fehlt der Branch `new-pr`.
2. Fork klonen und auf `new-pr` gehen:

```sh
git clone --branch new-pr git@github.com:<github-name>/flathub.git
cd flathub
git checkout -b fantasywriter new-pr
```

3. In diesen Branch legen:
   - `io.github.utopijaja.FantasyWriter.yml` – das Manifest aus `packaging/flatpak/`, mit Git-Quelle statt `type: dir` (siehe oben)
   - `generated-sources.json` – dieselbe Datei wie `packaging/flatpak/generated-sources.json`
4. Commit, push, Pull Request **gegen den Branch `new-pr`** von `flathub/flathub`, nicht gegen `master`. Titel: `Add io.github.utopijaja.FantasyWriter`.
5. Im Text die Berechtigungen begründen (Tabelle oben) und auf die Platzhalter hinweisen, die dann schon ersetzt sein müssen. Julian gibt den Request frei und beantwortet die Review-Kommentare selbst.
6. Nach der Review einen Testbau mit dem Kommentar `bot, build` anstoßen, installieren und die Punkte aus „Lokal bauen“ noch einmal gegen den Testbau prüfen.

Die Prüfenden sind freiwillig. Ein Merge legt unter der Flathub-Organisation ein eigenes Repository an und lädt zur Mitarbeit ein. Erst der veröffentlichte Build erscheint auf flathub.org und damit in Bazzite.
