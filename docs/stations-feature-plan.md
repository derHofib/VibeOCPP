# Ladestationen — Funktions- und Design-Plan

Status: Planung, noch nicht umgesetzt. Grundlage für Inkrement 8 (siehe
`architecture-proposal.md` §11). Löst die `PlaceholderPage` unter
`frontend/src/pages/placeholder-page.tsx` für `/stations` ab.

## 0. Woher die Daten kommen

Entscheidung aus §9/§10: Lesezugriff läuft **nicht** über unser Backend,
sondern direkt per GraphQL gegen unsere eigene, read-only Hasura-Instanz
(`hasura/metadata`), die CitrineOS-Cores Postgres spiegelt. Jede
schreibende Aktion (Remote-Kommandos, Konfigurationsänderungen) geht
weiterhin ausschließlich über das BFF.

Die folgenden Felder sind gegen den echten `citrineos-core`-Quellcode
verifiziert (`packages/core/src/dal/layers/sequelize/model/Location/*.ts`,
Commit `61622a07`), nicht angenommen:

| Tabelle (Hasura) | Relevante Felder | Herkunft |
|---|---|---|
| `ChargingStations` | `ocppConnectionName`, `isOnline`, `protocol`, `latestOcppMessageTimestamp`, `chargePointVendor`, `chargePointModel`, `chargePointSerialNumber`, `firmwareVersion`, `coordinates` (Point), `locationId` | `ChargingStation.ts` |
| `Locations` | `name`, `address`, `city`, `postalCode`, `country`, `coordinates`, `timeZone` | `Location.ts` |
| `Evses` | `evseId` (eMI3), `evseTypeId` (OCPP-2.x-Zähler), `physicalReference`, `removed` | `Evse.ts` |
| `Connectors` | `status` (`ConnectorStatusEnumType`), `type`, `format`, `errorCode`, `powerType`, `maximumPowerWatts`, `maximumAmperage`, `timestamp`, `info`, `vendorId` | `Connector.ts` |
| `LatestStatusNotifications` | Verweis auf die aktuellste `StatusNotification` je Station (für Live-Status ohne Aggregation über die volle Historie) | `LatestStatusNotification.ts` |
| `Boots` | letzter BootNotification-Zeitpunkt/-Grund je Station | bereits gemappt |
| `Transactions` / `TransactionEvents` | aktive/abgeschlossene Ladevorgänge je Station | bereits gemappt |
| `Certificates`, `VariableAttributes` | Zertifikatsstatus, Gerätekonfiguration | bereits gemappt, nur SuperAdmin/Admin |

**Status-Werte sind real, nicht angenommen** — `ConnectorStatusEnumType`
(OCPP 2.0.1/2.1, `packages/types/src/ocpp/model/2.0.1/enums/index.ts:678`):
genau fünf Werte — `Available`, `Occupied`, `Reserved`, `Unavailable`,
`Faulted`. OCPP 1.6 kennt zusätzlich `Preparing`, `Charging`,
`SuspendedEVSE`, `SuspendedEV`, `Finishing` — das UI muss beide Sets
abbilden, da unser Testserver aktuell 1.6 und 2.0.1 parallel unterstützen
könnte (siehe Backend-Notiz unten).

Noch offen, vor der Umsetzung zu klären: der GraphQL-Client im Frontend
(Query-Bibliothek, Subscription-Transport, JWT-Handshake gegen Hasura)
existiert noch nicht — das ist der erste technische Schritt, nicht Teil
dieses Dokuments (siehe „Nächste Schritte" unten).

## 1. Was andere CSMS-Oberflächen zeigen (Recherche)

Zur Einordnung, nicht zum Kopieren — Quellen unten:

- **CitrineOS' eigenes Operator-UI** (`citrineos-operator-ui`, React +
  Refine + Hasura — dieselbe Architektur, die wir für den Lese-Pfad
  gewählt haben) zeigt laut Release-Notes: Stationsliste mit
  Online-Status- und aktive-Transaktion-Toggles, Force-Disconnect,
  EVSE-/Connector-Ebene getrennt, Koordinaten je Station, Firmware-Version
  in der Übersicht, ein Konfigurations-Tab mit Protokoll-Auswahl und
  Paginierung, Meter-Value-Charts, ein OCPP-Log-Tab mit Datums-/
  Aktions-Filtern, Tarif-Anzeige im Transaktions-Detail, wählbare/
  filterbare Tabellenspalten.
- **SteVe** (ältester verbreiteter Open-Source-OCPP-Server): Stationsliste
  nach Heartbeat-Status, Connector- und Reservierungs-Verwaltung,
  Transaktions-/Reservierungs-Historie — bewusst schlank gehalten.
- **Kommerzielle CSMS (Ampeco, ChargePoint, Elinta u. a.)**, laut
  Branchen-Guides: Online/Offline- und Alarm-Status netzwerkweit,
  Remote-Start/Stop/Reset/Verfügbarkeits-Änderung, Firmware-Rollout mit
  Status-Tracking, Auslastungs-/Energie-Reports, Störungs-/Ticket-Workflow,
  Kartenansicht als gleichwertige Alternative zur Liste.

Deckt sich mit dem, was der ursprüngliche Auftrag schon vorgesehen hatte
(Kartenansicht + Tabellenansicht gleichwertig, Live-Updates, RFID/
Firmware/Zertifikate als eigene Bereiche) — die Recherche bestätigt vor
allem die Priorisierung: **Statusübersicht und Remote-Aktionen zuerst,
Firmware-Rollout und Reports später** (siehe Phasenplan unten).

## 2. Funktionsumfang — Phase 1 (dieses Inkrement)

### 2.1 Stationsliste (`/stations`)
- Tabelle **und** Kartenansicht als gleichwertige, umschaltbare Alternativen
  (Kartenansicht nutzt `coordinates` aus `ChargingStations`/`Locations` —
  MapLibre/OSM statt Google Maps, um keine weitere Abhängigkeit mit
  Lizenzkosten einzuführen; Kartenanbieter ist ohnehin laut §9 über
  Settings konfigurierbar).
- Spalten: Stations-ID (`ocppConnectionName`), Standort (`Location.name`),
  Online-Status (`isOnline`, als Badge — nicht zu verwechseln mit dem
  Connector-Status), OCPP-Version (`protocol`), Hersteller/Modell,
  Firmware-Version, Anzahl Connectors nach Status (kleine Statusleiste
  statt einer einzelnen Zahl — mehrere Connectors pro Station können
  unterschiedliche Status haben).
- Filter: Standort, Online/Offline, OCPP-Version, Connector-Status,
  Freitextsuche (Stations-ID/Hersteller/Modell).
- Live-Aktualisierung per GraphQL-Subscription auf `LatestStatusNotifications`
  und `ChargingStations.isOnline` — kein Polling, mit sichtbarem
  Verbindungsindikator (WS verbunden/getrennt), wie im Original-Auftrag
  gefordert.

### 2.2 Stations-Detailseite (`/stations/:id`)
Tab-Struktur (verlinkt aus der Liste):

1. **Übersicht** — Stammdaten (Hersteller, Modell, Seriennummer,
   Firmware, Protokoll, letzter Boot aus `Boots`, letzte Nachricht aus
   `latestOcppMessageTimestamp`), Standort mit Mini-Karte.
2. **Connectors/EVSEs** — je EVSE seine Connectors mit Live-Status,
   max. Leistung/Spannung/Ampere, letzter Fehlercode+Klartext (`info`).
3. **Transaktionen** — Ladevorgänge dieser Station (aktive zuerst),
   verlinkt auf die bereits bestehende Transaktions-Ansicht (Inkrement 9).
4. **Konfiguration** — `VariableAttributes` (nur SuperAdmin/Admin),
   read-only in Phase 1 (Schreiben käme über GetVariables/SetVariables,
   siehe „Fehlt noch im Backend" unten).
5. **Zertifikate** — `Certificates`-Status (nur SuperAdmin/Admin).
6. **OCPP-Nachrichten** — gefilterte Sicht auf den bereits gebauten
   Live-Monitor (Inkrement 7b), vorbelegt mit dieser Station.

### 2.3 Remote-Aktionen auf der Detailseite
Bereits im Backend vorhanden (Inkrement 2) und im UI verdrahtbar:

- RemoteStart / RemoteStop (SuperAdmin/Admin/Mitarbeiter)
- Reset (SuperAdmin/Admin)
- TriggerMessage (SuperAdmin/Admin)

## 3. Fehlt noch im Backend (gegen echten CitrineOS-Quellcode geprüft)

CitrineOS' Message-API unterstützt deutlich mehr Aktionen, als unser BFF
aktuell verdrahtet (`backend/src/citrineos/citrineos-commands.controller.ts`
hat nur die vier oben genannten). Real vorhanden und für eine vollwertige
Stations-Detailseite relevant, aber noch **nicht** im Backend angebunden:

| Aktion | Wofür | Rollen-Vorschlag |
|---|---|---|
| `UnlockConnector` | Connector manuell entriegeln (klassischer Support-Fall: Stecker klemmt) | Mitarbeiter+ |
| `ChangeAvailability` | Station/Connector für Wartung außer Betrieb nehmen | Admin+ |
| `ReserveNow` / `CancelReservation` | Connector für einen Fahrer reservieren | Admin+ |
| `ClearCache` | Authorization-Cache der Station leeren | Admin+ |
| `GetLog` (2.x) / `GetDiagnostics` (1.6) | Diagnose-Logs von der Station anfordern | SuperAdmin/Admin |
| `UpdateFirmware` | Firmware-Rollout anstoßen | SuperAdmin — separates Feature, siehe Phase 2 |
| `SetChargingProfile` | Smart-Charging-Limits setzen | Phase 2, hängt von Tarif-/Lastmanagement ab |

Diese sechs bis sieben neuen Endpunkte sind ein eigenes kleines
Backend-Inkrement (Controller + DTOs + Audit-Log-Einträge, analog zu den
bestehenden vier), bevor die entsprechenden UI-Buttons auf der
Detailseite scharf geschaltet werden können. Ohne das bleiben
„Entriegeln"/„Wartungsmodus"/„Logs anfordern" in der UI grau mit einem
Hinweis, nicht stillschweigend weggelassen.

## 4. Design

**Nicht** die drei Farb-/Layout-Experimente aus der Canvas-Exploration
(Leitstand/Klarwerk/Volt) — die waren eine Stilfrage für das Gesamtprodukt
und noch nicht entschieden. Die Stationsliste wird nach dem aktuell
**tatsächlich implementierten** Design-System gebaut
(`frontend/src/styles/tokens.css`, `frontend/src/components/ui/*`),
damit sie sich nahtlos neben Benutzer/Einstellungen/Testsuite/Monitor/
Infrastruktur einfügt. Sobald eine Richtung aus der Canvas-Exploration
final gewählt wird, ziehen alle Seiten gemeinsam um — nicht nur diese.

Konkret:
- Listenansicht: bestehende `Table`-Komponente, Status als `StatusBadge`
  (Farbe **und** Icon, wie schon in Users/Ops/Testsuite) — für den
  Online/Offline-Status der Station separat von den bis zu mehreren
  Connector-Status pro Zeile (kleine Badge-Gruppe statt einer Sammelzahl).
- Kartenansicht: gleicher Seitenkopf/Filterleiste wie die Tabelle, nur der
  Inhaltsbereich tauscht Tabelle gegen Karte — Umschalter als Segmented
  Control neben den Filtern (Muster wie das Sprach-/Theme-Toggle im
  Header).
- Detailseite: Tabs im gleichen Stil wie die bestehenden Settings-Tabs
  (`settings-page.tsx`), damit ein Muster für „Tabs mit Rand oben" im
  ganzen Produkt gilt statt zwei verschiedenen Tab-Stilen.
- Leerer/Ladezustand: Skeleton-Zeilen statt Spinner (wie in der
  ursprünglichen Anforderung), da die Stationsliste die erste Seite mit
  potenziell echten, sichtbaren Ladezeiten (Live-Subscription-Aufbau)
  ist.

## 5. Reihenfolge (Vorschlag)

1. GraphQL-Client im Frontend aufsetzen (Transport, JWT gegen Hasura,
   Query-Layer) — technische Grundlage, keine sichtbare Änderung.
2. Stationsliste (Tabelle) mit Live-Status, ohne Karte, ohne Filter —
   kleinster sinnvoller Schnitt, gegen den echten Testserver verifizierbar.
3. Filter + Kartenansicht dazu.
4. Detailseite mit Übersicht/Connectors/Zertifikate/Konfiguration
   (read-only) + den vier bestehenden Remote-Aktionen.
5. Die sechs-sieben fehlenden Backend-Aktionen (Tabelle oben) als eigenes
   Backend-Inkrement, danach in der Detailseite scharf schalten.
6. Firmware-Rollout mit Status-Tracking als eigenes, größeres Feature
   (bewusst nicht Teil dieses Inkrements — siehe Roadmap im Flyer).

## Quellen (Recherche, nicht Code-Grundlage)

- [citrineos/citrineos-operator-ui](https://github.com/citrineos/citrineos-operator-ui) — Releases-Historie
- [citrineos/citrineos-core](https://github.com/citrineos/citrineos-core) — Datenmodell (verifiziert, siehe Tabelle oben)
- [steve-community/steve](https://github.com/steve-community/steve)
- [AMPECO — The OCPP Handbook (2026)](https://www.ampeco.com/guides/complete-ocpp-guide/)
