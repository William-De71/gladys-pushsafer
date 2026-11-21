# Pushsafer

## Überblick

Diese Integration sendet die Benachrichtigungen von Gladys als
[Pushsafer](https://www.pushsafer.com)-Pushes an die Telefone, Tablets und
Computer, auf denen die Pushsafer-App installiert ist (iOS, Android, Windows,
Browser). Jeder Gladys-Benutzer wählt sein Gerät oder seine Gerätegruppe; der
Administrator gibt den privaten Schlüssel des Pushsafer-Kontos einmal für das
ganze Haus ein.

Außerdem bietet sie:

- das **Aussehen der Benachrichtigungen**: Titel, Symbol, Ton, Vibration,
  Priorität (bis zu den kritischen Hinweisen von iOS) und Aufbewahrungsdauer;
- die von Gladys angehängten **Kamerabilder**, direkt in der
  Benachrichtigung;
- zwei **Szenenauslöser**: Push nicht gesendet, API-Aufrufe fast
  aufgebraucht;
- eine **Szenenaktion**: einen Push an ein beliebiges Gerät oder eine Gruppe
  senden, mit eigenem Titel, Priorität, Ton, Symbol, Farbe, Link und
  Wiederholung bis zum Lesen;
- zwei **Dashboard-Widgets**: das Pushsafer-Konto und die letzten Pushes.

![Die zwei Widgets der Integration: das Pushsafer-Konto mit den verbleibenden API-Aufrufen und die letzten Pushes von Gladys (generierte Illustration, kein Screenshot)](https://raw.githubusercontent.com/William-De71/gladys-pushsafer/main/docs/assets/widgets.de.png)

Transport: **Cloud**. Texte und Bilder laufen über die Pushsafer-API
(`www.pushsafer.com`) und dann über die Benachrichtigungsdienste von Apple,
Google oder Microsoft.

## Voraussetzungen

- Gladys Assistant **5.3.0** oder neuer.
- Ein **Pushsafer-Konto** (kostenlose Registrierung auf pushsafer.com) und
  die Pushsafer-App auf jedem Gerät, das die Benachrichtigungen empfangen
  soll.
- **API-Aufrufe**: Jeder Push an ein Gerät verbraucht einen API-Aufruf (ein
  Push an 3 Geräte verbraucht 3). Pro Gerät gibt es ein kleines
  Gratiskontingent; danach kosten 1.000 Aufrufe 0,99 €, zu kaufen im
  Pushsafer-Dashboard.

## Konfiguration

1. Öffnen Sie in Gladys **Integrationen → Pushsafer → Konfiguration**.
2. Kopieren Sie den im Pushsafer-Dashboard angezeigten **privaten Schlüssel**
   (Private Key) oder einen Alias-Schlüssel in die Konfiguration.
3. Geben Sie den **Benutzernamen oder die E-Mail** des Pushsafer-Kontos ein:
   zum Senden optional, damit kann die Integration den Schlüssel prüfen und
   die Geräte auflisten.
4. Wählen Sie bei Bedarf das Aussehen der Benachrichtigungen und speichern
   Sie.
5. Klicken Sie auf **Verbindung testen**: Sie listet Geräte und Gruppen mit
   ihren IDs auf. **Test-Push senden** prüft die ganze Kette.
6. Jeder Benutzer öffnet den Block **Mein Konto** auf derselben Seite und
   gibt sein **Gerät oder seine Gruppe** ein: `a` für alle Geräte, eine
   Geräte-ID (`52`), mehrere IDs (`52|65`) oder eine Gruppe (`gs12`).

| Feld                         | Verwendung                                                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Privater Schlüssel           | Der private Schlüssel des Dashboards oder ein Alias-Schlüssel, verschlüsselt gespeichert                   |
| Benutzername oder E-Mail     | Optional: um den Schlüssel zu prüfen und Geräte und Gruppen aufzulisten                                    |
| Titel                        | Über jeder Benachrichtigung (standardmäßig `Gladys`)                                                       |
| Symbol                       | 1 bis 181 (1 = die Pushsafer-Glocke); leer = das Standardsymbol                                            |
| Ton                          | 0 = lautlos, 1 bis 62; leer = der Ton des Geräts                                                           |
| Vibration                    | Kurz, mittel, lang (iOS und Android); leer = die Einstellung des Geräts                                    |
| Priorität                    | Niedrigste bis höchste; hoch und höchste umgehen „Nicht stören“                                            |
| Löschen nach (Minuten)       | Die Pushsafer-App löscht die Nachricht nach dieser Zeit; 0 = nie                                           |
| Warnung bei wenigen Aufrufen | Unter dieser Zahl verbleibender Aufrufe löst „API-Aufrufe fast aufgebraucht“ einmal aus (standardmäßig 20) |

Die Symbole und Töne stehen auf der
[API-Seite von Pushsafer](https://www.pushsafer.com/en/pushapi_ext).

## Verwendung

### Benachrichtigungen

Jede Gladys-Benachrichtigung an einen Benutzer mit eingetragenem Gerät geht
als Push hinaus: Alarme, Szenenaktionen „Nachricht senden“, die Antworten von
Gladys. Ein an die Nachricht angehängtes Bild (ein Kamerabild) erscheint in
der Benachrichtigung.

Die Priorität **höchste** umgeht „Nicht stören“; unter iOS wird sie zum
kritischen Hinweis, wenn das für die Pushsafer-App erlaubt ist (Einstellungen
→ Mitteilungen → Pushsafer). Verwenden Sie sie nur für Alarme.

### Szenenauslöser

| Auslöser                      | Wann er auslöst                                                                                            | Variablen                          |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Push nicht gesendet           | Beim ersten Fehler einer Benachrichtigung, danach erst wieder, nachdem ein Push durchging (keine Schleife) | Grund, HTTP-Status, Fehler, Gerät  |
| API-Aufrufe fast aufgebraucht | Die verbleibenden API-Aufrufe sind unter die Schwelle gefallen; erneut erst nach einem Aufladen darüber    | verbleibende API-Aufrufe, Schwelle |

Pushsafer meldet die verbleibenden API-Aufrufe nur beim Senden eines Pushs:
Die Integration kennt sie nach dem ersten Push.

### Szenenaktionen

- **Pushsafer-Push senden**: ein Gerät oder eine Gruppe, ein Text
  (Szenenvariablen erlaubt) und bei Bedarf Titel, Priorität, Ton, Symbol,
  Symbolfarbe, ein Link, eine Aufbewahrungsdauer und eine
  Wiederholung alle N Sekunden, bis der Push in der App geöffnet wird (jede
  Wiederholung verbraucht einen API-Aufruf). Gibt die IDs der Nachrichten und
  die verbleibenden API-Aufrufe zurück.

### Szenenbeispiele

- _Wenn der Wassermelder Wasser erkennt_ → einen Pushsafer-Push an die
  Gruppe `gs12` senden, mit der Priorität **höchste**, dem Ton 25 (Sirenen)
  und einer Wiederholung alle 60 Sekunden bis zum Lesen.
- _Wenn die API-Aufrufe fast aufgebraucht sind_ → dem Administrator eine
  E-Mail senden: „Nur noch {{triggerEvent.data.api_calls_left}}
  Pushsafer-API-Aufrufe“.
- _Wenn ein Push nicht gesendet wurde_ → den Alarm über einen anderen Kanal
  (SMS, E-Mail) mit `{{triggerEvent.data.reason}}` senden.

### Dashboard-Widgets

- **Pushsafer**: verbleibende API-Aufrufe (orange nahe der Schwelle, rot
  darunter), die Pushes des Monats, der Status des Schlüssels, Geräte und
  Gruppen, die Schwelle und der letzte Fehler.
- **Pushsafer-Pushes**: die letzten Pushes von Gladys, gesendet oder nicht;
  tippen Sie einen an, um ihn ganz zu lesen, mit Gerät und Grund eines
  Fehlers.

## Fehlerbehebung

- **„Pushsafer lehnt den Schlüssel ab“**: Kopieren Sie den privaten Schlüssel
  erneut aus dem Dashboard und prüfen Sie Benutzernamen oder E-Mail des
  Kontos.
- **„Gerät abgelehnt“**: Die ID gehört nicht zum Konto, oder das Gerät wurde
  gelöscht; „Verbindung testen“ listet die gültigen IDs auf.
- **„Keine API-Aufrufe mehr“**: Kaufen Sie API-Aufrufe im
  Pushsafer-Dashboard.
- **Der Push kommt ohne Ton an**: Priorität „niedrig“ oder „niedrigste“, Ton
  0 oder „Nicht stören“ mit der Priorität „normal“.
- **Ein Push kam zweimal an**: Wenn Pushsafer nicht antwortet, versucht es
  die Integration ein weiteres Mal, und der erste Versuch war manchmal schon
  durchgegangen.
- **Protokolle**: Integrationen → Pushsafer → Registerkarte Überwachung. Der
  private Schlüssel erscheint dort nie.
