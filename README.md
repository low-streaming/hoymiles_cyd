# Hoymiles CYD Nulleinspeisung & Premium Dashboard

Willkommen zur **Hoymiles CYD** Home Assistant Custom Integration!  
Dieses Modul bietet eine direkte Schnittstelle und intelligente Regelung (Zero-Export) für Hoymiles-Wechselrichter, ergänzt um ein atemberaubendes, mobiles Premium-Dashboard im Neon-Glassmorphism-Design.

---

## 🌟 Highlights & Features (v1.1.0)

- **Premium Flow-Dashboard**: Eine wunderschöne, interaktive „Mobile-First“ Ansicht der Energieflüsse.
  - Live animierte Ströme verdeutlichen auf einen Blick, ob Solarstrom gerade die Batterie lädt, ins Haus fließt oder ins Netz exportiert wird.
  - Hover- und Tooltips für detaillierte Sensor-Analysen (optimiert für Touch).
- **Intelligente Nulleinspeisung (Zero Export Manager)**: Regelt deinen Wechselrichter dynamisch je nach aktuellem Hausverbrauch, sodass kein kostbarer Strom ins Netz verschenkt wird.
- **Batterie-Schutz-Management**: Konfiguriere eigene untere (Abschalt-SOC) und obere (Restart-SOC) Limits zum schonenden Umgang mit deiner Batterie, damit Nulleinspeisung die Zellen nie tiefenentlädt.
- **Zusatzverbraucher-Tracking**: Binde gezielt große Geräte (z.B. Wärmepumpen, Wasserboiler oder Krypto-Miner) live in den Energiefluss ein und lass sie auf Wunsch intelligent in die Nulleinspeisung hochrechnen.
- **Grundlast-Modus (Plugs)**: Alternativer Betriebsmodus, bei dem feste "Smart Plugs" die Referenz für den Inverter bilden – ideal, wenn man noch keinen Zählersensor hat.

---

## 🚀 Installation & Einrichtung

1. **Dateien kopieren**: Kopiere den Ordner `custom_components/hoymiles_cyd/` in das Verzeichnis `config/custom_components/` deines Home Assistants.
2. **Dashboard-Panel integrieren**: Das Dashboard wird als Panel in deiner HA-Oberfläche nutzbar sein. Der Code für das JS-Frontend liegt in `hoymiles-cyd-panel.js`.
3. **Konfiguration**: Nach einem Neustart von Home Assistant kann die "Hoymiles CYD" Integration in den Einstellungen ➝ "Geräte & Dienste" hinzugefügt und detailliert konfiguriert werden.

---

## 🛠 Konfiguration über das Panel

Mit der neuen App-UI kannst du das Modul komplett "on the fly" verwalten:

1. **Dashboard-Tab**: Hier siehst du die Live-Ströme (Solar, Haus, Netz, Batterie). Oben rechts ist der Master-Mode der Integration zu sehen.
2. **Einstellungen-Tab**:
   - **Steuerung**: Wähle zwischen `ZEN (Automatik)` am Hauptzähler und `Grundlast (Plugs)`.
   - **Intelligenz**: Definiere deinen „Ziel-Bezug am Zähler“ (z.B. 10W Puffer) und die absolute Limitierung deines Wechselrichters.
   - **Batterie**: Hier schaltest du die Schutzautomatik ein und definierst die kritischen %, bei denen die Entladung stopt.
   - **Zusatzverbraucher**: Aktiviere einzelne Plugs (Geräte) und füge sie dem Fluss und/oder der automatischen Nulleinspeisung hinzu.
3. **Hilfe-Tab**: Eine interaktive kleine Dokumentation, wie genau und ab welchem Grenzwert Sensoren triggern (z.B. 5 Watt für "aktiven Fluss").

---

## 📜 Version History

* **v1.1.0** (Aktuell): Komplett überarbeitetes Dashboard (Glassmorphism & Neon-Effekte), korrekte Energiefluss-Animationen (Strich-Verläufe statt Blurs), verbesserter Batterieschutz im Backend, Refaktorierung der Backend-Logger.
* **v1.0.3**: Bugfixes für Nulleinspeisung-Berechnung und Integration der Backend-API.

---
*Mit Liebe und viel Strom entwickelt für die Hoymiles-Community.*
