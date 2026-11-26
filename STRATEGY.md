# FantasyWriter Strategy

## Vision

<!-- vision: author-approved 2026-11-26 -->

`FantasyWriter` existiert, damit ein Mensch ein Buch an seinem eigenen Schreibtisch schreibt, die Bibliothek auf der eigenen Maschine behaelt und sie als PDF oder EPUB mitnimmt.
Es dient einer schreibenden Person, die Kapitel, Notizen, Bilder, eine Welt aus Figuren, Orten, Karten und einer Zeitleiste sowie Designs will, ohne ein Konto zu eroeffnen.
Es besitzt genau eines: den lokalen Schreibplatz.

### Die Bibliothek liegt auf der Maschine

Ein Buch liegt im Dokumente-Ordner des Systems, unter FantasyWriter, nicht im Projektbaum und nicht in einer Anbieter-Cloud.
Einstellungen und eigene Designs liegen im Benutzerordner der App.
Die App ist ein Desktop-Programm, das man auf dem eigenen Rechner startet; eine Funktion, die ein Konto oder eine gehostete Bibliothek verlangt, wird abgelehnt.
Ein Export schreibt Dateien, die die schreibende Person selbst kopieren, sichern oder mit anderen Werkzeugen veroeffentlichen kann.
Ohne Netz muss sich ein vorhandenes Buch oeffnen und speichern lassen.
Ein gewaehlter Ordner zum Sichern oder ein Export ersetzt eine eingebaute Cloud.

### Freie Software, zuerst lokal

Das Programm ist freie Software unter GPL-3.0-or-later, und das Repository ist oeffentlich.
Eine Aenderung, die den Quellcode schliessen, eine proprietaere Ausgabe einfuehren oder eine vorhandene Funktion an einen bezahlten Dienst binden wuerde, wird abgelehnt.
Geld darf ueber Spenden, Support, einen bezahlten Store-Eintrag oder neue bezahlte Zusatzfunktionen kommen, solange der Quellcode GPL bleibt; ein Store-Eintrag lohnt sich nur, wenn er wenig kostet.
Was jemand schreibt, bleibt dessen Text; die App erhebt keinen Anspruch auf das Manuskript und laedt es nicht zu eigenen Zwecken hoch.

### Ein Schreibprogramm fuer Linux, auf Deutsch

Der zuerst unterstuetzte Desktop ist Linux, ausgeliefert als AppImage und tar.gz.
Eine Verteilung ueber Flathub ist willkommen, wenn sie dieselben lokalen Pfade behaelt und die Sandbox nur so weit oeffnet, wie die Uebernahme eines Firefox-Designs es braucht: Lesezugriff auf das, was Firefox betrifft, nicht auf das ganze Home-Verzeichnis.
Das Programm ist ein deutsches Produkt, und die Oberflaeche folgt der Systemsprache: auf einem deutschen System ist Deutsch Standard, auf einem englischen darf es Englisch sein.
Eine zweite Sprache ersetzt Deutsch nicht als Sprache des Produkts und wird nicht als ungepruefte Maschinenuebersetzung der Oberflaeche ausgeliefert.
Windows- und macOS-Paketierungen sind nicht ausgeschlossen, kommen aber erst spaeter, wenn dieses Ziel ausdruecklich uebernommen wird; Electron allein begruendet sie nicht.

### Gestaltung und Handwerk bleiben bei der schreibenden Person

Designs darf man selbst anlegen oder aus Firefox-Themes uebernehmen, die man bereits besitzt.
Es gibt keine vom Projekt betriebene Online-Galerie fuer Designs.
Bilder gehoeren in das Buch, das jemand schreibt, als Material, das diese Person eingefuegt hat, nicht als erzeugter Ersatz fuer das Schreiben.
Rechtschreibung und Silbentrennung duerfen lokale Daten nutzen; Woerterbuecher duerfen bei der Installation oder beim ersten Start aus dem Netz geladen werden und muessen nicht aktuell sein.
Das Programm startet auch ohne Netz, mit mindestens einem Woerterbuch, und ein Netzaufruf ist nie der einzige Weg, ein Buch zu oeffnen oder zu speichern.

### Scope

FantasyWriter ist kein Cloud-Schreibdienst, kein Editor fuer mehrere Autoren gleichzeitig und kein KI-Autor.
Es ist keine App, die zuerst fuers Handy gebaut wird, und kein Windows- oder macOS-Produkt, bevor diese Ziele ausdruecklich uebernommen werden.
Browser-Profile, der Rest des Home-Verzeichnisses und der Manuskripttext verlassen die Maschine nicht, ausser die schreibende Person exportiert sie.
Nur eine anonyme Versionszaehlung darf hinausgehen: ohne Manuskript, ohne Geraete-ID, abschaltbar und in der App und im README offen genannt.

Eine Aenderung passt, wenn sie das lokale Schreiben, Gestalten, den Weltbau oder den Export vertieft, die Bibliothek auf der Platte laesst, die GPL erhaelt oder einer Linux-Nutzerin hilft, dasselbe Programm zu installieren, ohne der Sandbox mehr zu geben, als die Uebernahme eines Firefox-Designs braucht.
Eine Aenderung soll widerstanden werden, wenn sie das Manuskript auf einen Server legt, ein Konto verlangt, den Text anstelle der Autorin erzeugt, die Lizenz schliesst, das deutsche Produkt durch eine nur-englische Oberflaeche ersetzt oder mehr vom Home-Verzeichnis oeffnet, als die Uebernahme eines Firefox-Designs braucht, um einen Komfort zu gewinnen, den ein Export oder ein gewaehlter Ordner schon deckt.
