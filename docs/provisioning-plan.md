# Standort- & Ladepunkt-Verwaltung — Plan

Status: Phase 1 ist umgesetzt (`backend/src/locations`, `backend/src/unknown-chargers`,
`frontend/src/pages/locations-page.tsx`). Phase 2a/2b (siehe unten) stehen noch aus —
**offene Entscheidung: welche zuerst, oder beide.**

## 0. Ziel

Standorte, Stationen (mit vorab vergebener ChargeBox-ID) und Ladepunkte
(Steckertyp, Socket/Cable) lassen sich in VibeOCPP anlegen, bevor eine
Ladesäule sich das erste Mal verbindet — statt nur widerzuspiegeln, was
CitrineOS zufällig schon kennt.

## 1. Begriffsmodell

| VibeOCPP | CitrineOS (verifiziert) |
|---|---|
| Standort | `Location` |
| Station (ChargeBox-ID) | `ChargingStation` (`ocppConnectionName`) |
| Ladepunkt (Steckertyp, Format) | `Evse` + `Connector` (`type`, `format`: Socket/Cable) |

CitrineOS legt nie im Voraus etwas an — `ChargingStation`/`Evse`/`Connector`
entstehen erst durch eine echte `BootNotification`/`StatusNotification`
(verifiziert: `BootNotificationRequestOcpp2Handler.ts`). Die Planungsdaten
leben deshalb ausschließlich in VibeOCPPs eigener `product-db`
(`Location`, `PlannedStation`, `PlannedConnector`, `UnknownCharger`) und
werden nur per `chargeboxId == ocppConnectionName` abgeglichen — nie in
CitrineOS' eigene Tabellen geschrieben.

## 2. Phase 1 — umgesetzt

- `POST /locations`, `/locations/:id/stations`, `/stations/:id/connectors`
- `StationReconciliationService`: bei jedem `BootNotification`-Webhook-Event
  Abgleich gegen `PlannedStation.chargeboxId` — Treffer → Status
  `Planned` → `Linked`, kein Treffer → Eintrag in `UnknownCharger`
- `GET/POST/DELETE /unknown-chargers` — Zuordnen (korrigiert die
  ChargeBox-ID einer bestehenden Station) oder Ignorieren
- Frontend: `/locations` (Admin+) mit Reitern "Standorte" und
  "Unknown Charger"
- Keine technische Zugriffskontrolle — jede ChargeBox-ID kommt weiterhin
  durch (`securityProfile 0`), Unknown Charger ist reine Sichtbarkeit

## 3. Phase 2a — CitrineOS' eigener BootConfig-Endpunkt (nicht gebaut)

Echtes, bereits vorhandenes CitrineOS-Feature, verifiziert im Quellcode:

```
PUT /data/configuration/bootConfig?tenantId=<id>&ocppConnectionName=<chargeboxId>
Body: { status: "Accepted" | "Pending" | "Rejected", ... }
```

(`ConfigurationDataApi.putBootConfig`, `packages/core/src/modules/Configuration/src/module/DataApi.ts`)

Lässt sich pro ChargeBox-ID vorab setzen, **bevor** die Station sich
meldet — CitrineOS entscheidet dann beim echten Boot anhand dieses
gespeicherten Werts. Kein Passwort nötig, kleinerer Eingriff als 2b.
Ließe sich an `LocationsService.createStation` anhängen (ruft beim Anlegen
einer `PlannedStation` automatisch `putBootConfig` mit `status: "Pending"`
oder `"Rejected"` für alles, was nicht auf der Liste steht — Kehrseite:
erfordert eine Warteschlange/Default-Policy für unbekannte IDs, die sich
noch nie gemeldet haben).

## 4. Phase 2b — echtes securityProfile 1 (nicht gebaut)

Passwort pro Station, HTTP-Basic-Auth auf OCPP-Ebene. Erfordert einen
echten Provisionierungs-Workflow: Passwort erzeugen (z. B. beim Anlegen
der `PlannedStation`), sicher anzeigen/exportieren, bevor die Säule sich
zum ersten Mal meldet. Größerer Umbau als 2a; das Datenmodell
(`PlannedStation`) ist aber bereits so angelegt, dass ein optionales
`password`-Feld ohne Migration-Bruch ergänzt werden kann.

## Quellen

- `docs/architecture-proposal.md`, `docs/stations-feature-plan.md`
- citrineos-core, Commit `61622a07d44dffa855de10c233f034fc822146d9`
  (`ConfigurationDataApi.putBootConfig`, `BootNotificationRequestOcpp2Handler.ts`)
