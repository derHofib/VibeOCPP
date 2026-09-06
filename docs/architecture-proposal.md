# Architekturvorschlag: CSMS-Backend + Operator-Frontend auf CitrineOS

Status: **Entscheidungen getroffen (siehe Abschnitt 10), Implementierung läuft.**

Grundlage: Quellcode-Analyse von `citrineos/citrineos-core` (Commit `main`, Fastify/TS-Monorepo)
und `citrineos/citrineos-payment` (Python/FastAPI). Keine Live-Introspektion einer laufenden
Instanz — die Testumgebung ist aus dieser Sandbox nicht erreichbar, siehe Hinweis unten.

---

## 0. Wichtiger Vorbehalt

Diese Sandbox hat keinen Netzwerkzugriff auf deine lokale/private CitrineOS-Testumgebung
(Ports 8080/8090/8081/8082/5432/5672 sind von hier aus nicht erreichbar). Alles unten beruht
auf dem tatsächlichen Quellcode beider Repos — nicht auf Vermutung, aber auch nicht auf
Beobachtung deiner konkreten Konfiguration (aktive Security-Profile, evtl. eigene
Docker-Compose-Anpassungen, Datenmenge). Wo relevant, weise ich darauf hin, was du an deiner
Instanz noch verifizieren solltest, bevor wir loslegen.

---

## 1. Zentrale Erkenntnis aus dem Quellcode

**CitrineOS hat zwei verschiedene Integrationsebenen mit unterschiedlicher Stabilitätsgarantie:**

| Kanal | Zweck | Öffentlicher Contract? |
|---|---|---|
| REST Data API (`/data/...`) | CRUD auf Domänendaten (Stationen, Tarife, Zertifikate, Variablen, Boot-Config) | Ja — Swagger-dokumentiert, versioniert |
| REST Message API (`/ocpp/<version>/...`) | OCPP-Kommandos an Stationen senden | Ja — Swagger-dokumentiert |
| **Subscriptions** (`POST /data/ocpprouter/subscription`) + **Callback-URLs** | Webhook-Push bei Verbindung/Nachrichten/Antworten | Ja — explizit für externe Konsumenten vorgesehen |
| RabbitMQ (headers-Exchange `citrineos`) | Internes Transportmittel zwischen CitrineOS-eigenen Modulen | **Nein** — kein deklarierter öffentlicher Contract, rohes internes Envelope-Format |
| Hasura/GraphQL (Port 8090) | Read-Layer für `apps/operator-ui` (offizielles UI) | Faktisch ja (stabile DB-Views), aber die *Metadata-Config* liegt im citrineos-core-Repo selbst |

**Konsequenz für unsere Architektur:** Wir binden uns **nicht** direkt an RabbitMQ (das ist
CitrineOS-internes Transportmittel, kein stabiler Contract — ein `git pull upstream` könnte
das Envelope-Format brechen, ohne dass es als Breaking Change zählt). Stattdessen nutzen wir
die **Subscription-/Callback-API**, die genau für diesen Zweck existiert.

Für den Hasura-Layer bauen wir **eine eigene, zweite Hasura-Instanz** in unserem eigenen
Compose-Stack, mit eigener Metadata (Permissions, JWT-Auth, Relationships), die read-only
gegen dieselbe Postgres-DB wie CitrineOS läuft. Das kopiert keinen Code, patcht nichts, und
lässt sich unabhängig vom `citrineos-core`-Repo pflegen. (Alternative: das offizielle
`apps/operator-ui`-Setup nachbauen und dessen Hasura mitverwenden — verwerfe ich, weil das
Metadata-Verzeichnis Teil des citrineos-core-Repos ist und uns wieder an dessen Struktur
koppelt.)

---

## 2. Service-Topologie

Ein separater Docker-Compose-Stack, komplett getrennt vom bestehenden Testaufbau:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Eigener Compose-Stack (neu)                                        │
│                                                                       │
│  ┌──────────────┐   ┌───────────────┐   ┌────────────────────────┐ │
│  │  Frontend     │──▶│  BFF-Backend  │──▶│  Product-DB (Postgres) │ │
│  │  React/Vite   │   │  NestJS/TS    │   │  users, roles, settings,│ │
│  └──────────────┘   │               │   │  audit_log, testsuite_*,│ │
│         │            │               │   │  tenants (Phase-1: 1)   │ │
│         │            │               │   └────────────────────────┘ │
│         │            │        │                                     │
│         │            │        ├──REST──▶ CitrineOS Data/Message API │
│         │            │        ├──Webhook◀── CitrineOS Subscriptions │
│         │            │        └──REST──▶ citrineos-payment API      │
│         │                                                            │
│         └──GraphQL/WS (JWT)──▶ ┌──────────────┐                    │
│                                 │  Eigene       │──▶ (read-only DB   │
│                                 │  Hasura-      │     Rolle gegen    │
│                                 │  Instanz      │     CitrineOS-DB)  │
│                                 └──────────────┘                    │
└─────────────────────────────────────────────────────────────────────┘
                    │ REST/Webhook/DB (read, geteilte payment_*-Tabellen)
                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Bestehender CitrineOS-Stack (UNVERÄNDERT, git pull upstream bleibt  │
│  schmerzfrei)                                                        │
│                                                                       │
│  citrine (Data+Message API :8080, WS :8081/:8082) · graphql-engine   │
│  (:8090, deren EIGENE Hasura für apps/operator-ui, nutzen wir NICHT) │
│  · ocpp-db (Postgres) · RabbitMQ · MinIO                             │
│                                                                       │
│  + citrineos-payment (Python/FastAPI) — separater Container,         │
│    verbindet sich zwingend mit derselben ocpp-db (s. Punkt 4)        │
│  + Directus — vom citrineos-payment-Code als Hard-Dependency          │
│    vorausgesetzt (s. Punkt 4, offener Punkt)                         │
└─────────────────────────────────────────────────────────────────────┘
```

**Backend-Framework-Empfehlung: NestJS (TypeScript).** Begründung: gleiche Sprache wie
CitrineOS selbst (erleichtert das Lesen von dessen Typen/Schemas), eingebaute Module für
Guards/RBAC, WebSocket-Gateways, Config-Module, Interceptors (praktisch für das Audit-Log als
Cross-Cutting Concern), gute Testbarkeit. Alternative wäre Express/Fastify pur oder ein
Python-Stack — sag Bescheid, falls du eine andere Präferenz hast, sonst gehe ich mit NestJS.

---

## 3. Datenmodell & Datenhoheit

**Drei getrennte logische Datenbanken auf ggf. einem Postgres-Server:**

1. **`citrine`** (bestehend, unverändert) — Source of Truth für OCPP-Domänendaten (Stationen,
   Transaktionen, MeterValues, Boot, Variablen, Zertifikate, Tarife-für-OCPP). Wir schreiben
   hier **nie direkt per SQL**, nur über die Data/Message API.
2. **`citrine`, Tabellen mit `payment_`-Prefix** (bestehend durch citrineos-payment) — siehe
   Punkt 4, das ist eine harte Kopplung, die wir nicht auflösen können, ohne citrineos-payment
   zu patchen.
3. **`csms_product`** (neu, unsere Produkt-DB) — Benutzer, Rollen, Settings (verschlüsselt),
   Audit-Log, Testsuite-Reports, Live-Message-Monitor-Aufzeichnungen (sofern wir sie
   persistieren wollen), `tenants`-Tabelle (Phase 1: genau eine Zeile), Vorbereitung für
   Fahrerportal (Spalten/Enum-Werte angelegt, keine Endpunkte/UI).

Wo unser Frontend Domänendaten braucht (Stationsname, Live-Status, Transaktionshistorie),
lesen wir **nie** direkt aus `citrine` per SQL-Join gegen `csms_product`, sondern:
- für Live-Reads/Subscriptions: über unsere eigene Hasura-Instanz (GraphQL, read-only)
- für Schreibaktionen: über die CitrineOS Data/Message API

`tenantId` ziehen wir konsequent durch unser eigenes Schema (jede Tabelle in `csms_product`,
jede Query), auch wenn Phase 1 nur einen Tenant kennt. CitrineOS selbst kennt bereits
`tenantId` als Konzept (Data-API-Querystring-Parameter, eigene `Tenants`/`TenantPartners`-
Tabellen laut Hasura-Metadata) — das erleichtert eine spätere echte Multi-Tenancy, weil wir
uns an ein bereits vorhandenes Konzept anlehnen statt eins zu erfinden.

---

## 4. Payment-Integration (citrineos-payment)

**Was der Code bereits leistet** (siehe Analyse): Scan&Charge (QR-Code am Display via
`SetDisplayMessage`) und Web-Portal-Checkout, Stripe Connect (Standard-Accounts, Direct
Charges), vollständige Preisberechnung (Energie+Zeit+Session+Steuer+Fee) in
`model/transaction_summary.py`, Event-Konsum über RabbitMQ, RemoteStart nach Zahlung über die
Message API.

**Was wir NICHT neu bauen:** die Stripe-Checkout-/Payment-Link-Logik, die Preisberechnung, den
RabbitMQ-Consumer für Transaction-Events innerhalb des Payment-Flows.

**Drei Punkte, die die Kopplung enger machen, als der ursprüngliche Prompt-Rahmen
("eigene Produkt-DB getrennt von CitrineOS-Domänendaten") vorsieht — mit Vorschlag:**

1. **citrineos-payment liest per SQLAlchemy direkt aus `citrine`-Tabellen** (`Evses`,
   `Transactions`, `MessageInfos`), nicht nur über REST. Das ist Upstream-Design, nicht
   unsere Entscheidung, und wir patchen citrineos-payment nicht. Konsequenz: der
   Payment-Container braucht Netzwerk-/DB-Zugriff auf dieselbe Postgres-Instanz wie
   CitrineOS-Core, nicht nur auf dessen REST-API. Das ist eine Ausnahme von "kein direkter
   DB-Zugriff", die wir bewusst als Upstream-Gegebenheit akzeptieren — unser **eigenes**
   BFF greift trotzdem nie direkt auf `citrine` zu.

2. **citrineos-payment hat keine Admin-API** für Operators/Locations/Evses/Connectors/
   Tarife — nur Lese-Endpunkte fürs Checkout-Frontend (`GET /evses/{id}`, `/locations/{id}`,
   `/tariffs/{id}`) und `POST /checkouts/`. Es gibt keinen Weg, Tarife oder Stripe-Konfiguration
   über eine API zu pflegen. **Vorschlag:** Unser BFF schreibt für diese Entitäten direkt in
   die `payment_*`-Tabellen derselben `citrine`-DB (dasselbe Schema, das der Payment-Container
   ohnehin selbst per `Base.metadata.create_all` anlegt). Das ist kein Patch am
   citrineos-payment-Code, sondern Nutzung seines öffentlichen (wenn auch undokumentierten)
   Datenschemas — die einzig praktikable Option ohne Fork. Dein SuperAdmin-Tarif-UI (Punkt 2
   deiner Anforderung) landet also in dieser DB, nicht in unserer `csms_product`-DB.

3. **Directus ist aktuell eine Hard-Dependency beim Start**, unabhängig vom
   `CITRINEOS_SCAN_AND_CHARGE`-Feature-Flag: `main.py` instanziiert `DirectusIntegration`
   synchron und wirft eine Exception, wenn der Login fehlschlägt — der Payment-Container
   startet also gar nicht ohne erreichbares Directus, selbst wenn du nur den
   Web-Portal-Checkout ohne QR-Code-Scan-Flow nutzen willst. Das ist ein Bug/eine
   Design-Entscheidung im Upstream-Code, kein Implementierungsdetail, das wir umgehen können,
   ohne zu patchen. **Vorschlag:** Wir nehmen Directus als weiteren Container in unseren
   Compose-Stack auf (Bootstrap-Admin via `ADMIN_EMAIL`/`ADMIN_PASSWORD`-Env), ausschließlich
   für den QR-Code-Datei-Upload — kein eigenständiges CMS für uns, kein Zugriff durch normale
   Nutzer.

   Zusätzlich: die Quittungsseite des Payment-Frontends (`Receipt.js`) ruft einen
   `GET /receipts/{sessionId}`-Endpunkt, der im Backend nicht existiert — dieser Teil des
   Checkout-Flows ist im aktuellen citrineos-payment-Release unvollständig. Das würde uns
   betreffen, wenn wir dieses Checkout-Frontend an Endkunden zeigen.

**Frage an dich (siehe unten, Rückfrage 2):** Soll Phase 1 den vollen Scan&Charge-Flow
(QR-Code am Ladepunkt-Display) umfassen, oder reicht zunächst Web-Portal-Checkout (Link/QR
extern bereitgestellt, kein `SetDisplayMessage`)? Directus brauchen wir in beiden Fällen wegen
des Startup-Bugs, aber der Funktionsumfang, den wir im Betreiber-UI dafür abbilden müssen,
unterscheidet sich.

---

## 5. Settings-Layer (Konfiguration raus aus der `.env`)

**Nur echte Bootstrap-Werte bleiben in `.env`:**
- Produkt-DB-Connection-String (`csms_product`)
- JWT/Session-Secret
- Master-Encryption-Key (AES-256-GCM, für Secrets in der `settings`-Tabelle)

**Alles andere in einer versionierten `settings`-Tabelle** (`csms_product`):
```
settings(id, tenant_id, category, key, value_json, value_encrypted, type, version,
         updated_by, updated_at)
settings_history(... gleiche Felder, für Rollback)
```
- Typisierte Werte (string/number/bool/json/secret) mit Zod-Schema-Validierung pro Key.
- `value_encrypted = true` → Wert liegt AES-verschlüsselt vor, API gibt ihn maskiert zurück
  (`stripe_api_key: "sk_live_••••1234"`), niemals im Klartext, außer beim expliziten
  „aufdecken"-Call mit erneuter Passwortbestätigung + Audit-Eintrag.
- Config-Service hält einen In-Memory-Cache, invalidiert per DB-Trigger/NOTIFY oder
  Polling-Intervall (Sekunden) → Laufzeit-Reload ohne Neustart für alles, was nicht
  Container-Env ist (z. B. Stripe-Key-Wechsel: sofort aktiv; Postgres-Pool-Size-Änderung:
  Neustart nötig, wird im UI als "Neustart erforderlich" markiert).
- „Verbindung testen"-Buttons rufen serverseitig einen echten Health-Check gegen den
  jeweiligen Dienst auf (z. B. Stripe `GET /v1/balance`, CitrineOS `GET /data/.../systemconfig`,
  SMTP `NOOP`), Ergebnis + Latenz zurück, kein Secret im Response-Body.

Die 12 Konfigurationsbereiche aus deiner Anforderung bilden sich 1:1 auf `category`-Werte in
dieser Tabelle ab; „Infrastruktur" (Punkt 9) und „Datenbank/Backup" (Punkt 10) sind
Sonderfälle ohne Settings-Charakter, dazu Punkt 7.

---

## 6. Rollenmodell & Auth

- JWT-basierte Session (Access + Refresh Token), Rollen `SuperAdmin | Admin | Mitarbeiter`
  als Enum in `csms_product.users`, plus **nicht genutzter** vierter Wert `Driver` bereits im
  Enum angelegt (Vorbereitung Fahrerportal, keine Auth-Flows/Endpunkte dafür in Phase 1).
- Serverseitige Durchsetzung über NestJS Guards + eine zentrale Policy-Definition (Aktion →
  erlaubte Rollen), nicht verteilt über einzelne Controller. UI blendet zusätzlich aus, aber
  das ist nur UX, nie die Sicherheitsgrenze.
- Jede privilegierte Aktion (Settings-Änderung, Benutzerverwaltung, Remote-Kommando an
  Station, Firmware-Rollout, Zertifikatsänderung, RFID-Whitelist-Änderung, Backup/Restore)
  läuft durch einen Audit-Interceptor: wer, wann, was, alter/neuer Wert (als JSON-Diff),
  IP/User-Agent.

---

## 7. Infrastruktur-Tab (Container-Status, Logs, Restarts)

**Sicherheitsrelevante Entscheidung, noch offen — siehe Rückfrage 3.** Zwei Optionen:

**A) Dediziertes Ops-Agent-Microservice (empfohlen).** Ein minimaler eigener Service mit
Zugriff auf den Docker-Socket, der **ausschließlich** eine feste Whitelist von Aktionen als
eigene, typisierte Endpunkte exponiert (`POST /ops/restart/{service}` mit `service` aus einer
Enum-Liste, `GET /ops/status`, `GET /ops/logs/{service}?since=...`) — kein generischer
Shell-/Exec-Zugriff, kein beliebiger Docker-Befehl. Das BFF selbst bekommt **keinen**
Docker-Socket-Zugriff, sondern spricht nur mit diesem Agenten. Größerer Implementierungsaufwand,
aber deutlich kleinerer Blast-Radius, falls das BFF (das öffentlich über HTTPS erreichbar ist)
kompromittiert wird.

**B) BFF bekommt Docker-Socket direkt gemountet.** Einfacher zu bauen, aber jede
Remote-Code-Execution-Lücke im BFF wäre dann gleichbedeutend mit vollem Docker-Host-Zugriff.

Ich empfehle A, auch wenn es mehr Aufwand ist — bei einem Produkt, das produktiv
Ladeinfrastruktur steuert, ist der Docker-Socket im öffentlich erreichbaren Service ein zu
großes Risiko für den Zeitgewinn.

---

## 8. OCPP-Controller-Testsuite

- Ausführung: BFF sendet die Sequenz (`BootNotification` wird nicht aktiv gesendet, das macht
  die Station selbst — aber `Heartbeat`-Trigger, `GetVariables`/`GetConfiguration`,
  `RemoteStart`/`RemoteStop`, `Reset`, `DataTransfer` etc.) über die CitrineOS Message API.
- Antworten/Ereignisse (inkl. `StatusNotification`, `TransactionEvent`/`StartTransaction`,
  `MeterValues`, die die Station **von sich aus** sendet) fängt das BFF über eine **eigene
  Subscription** (`POST /data/ocpprouter/subscription`, `onMessage`) für die Dauer des
  Testlaufs ab und matched sie per Korrelation (Aktion + Zeitfenster + Station-Identifier;
  die Message-API liefert nur die Zustellbestätigung, nicht die OCPP-Antwort selbst — das
  ist ein wichtiger Unterschied zur Prompt-Annahme "Request/Response inkl. Timing" auf HTTP-
  Ebene, faktisch läuft das über den Subscription-Kanal asynchron mit).
- Jeder Schritt: rohe OCPP-Payload (Request+Response), Timing, Pass/Fail/Nicht unterstützt,
  Klartext-Fehler (z. B. `FormatViolation` → "Die Station hat `idTag` bei StartTransaction
  nicht akzeptiert").
- Ergebnis-Speicherung: `csms_product.testsuite_runs` + `testsuite_steps`, referenziert
  Hersteller/Modell/Firmware/OCPP-Version (freie Texteingabe oder aus dem `BootNotification`-
  Payload der Station übernommen, falls vorhanden).
- Live-Message-Monitor ist technisch dieselbe Subscription-Infrastruktur, nur dauerhaft statt
  testlaufgebunden, mit Filter/Export — als eigenständiges Feature unabhängig von der
  Testsuite nutzbar.

---

## 9. Frontend

React + TS + Vite + Tailwind + shadcn/ui-Basis mit eigenen Design-Tokens (keine
Standard-shadcn-Optik). TanStack Query (Server-State) + TanStack Table. react-i18next,
Deutsch Standard, Englisch von Anfang an. Dark Mode. Kartenansicht (Google Maps oder
MapLibre/OSM, je nach Settings-Konfiguration) + gleichwertige Tabellenansicht.

**Live-Updates — offene Entscheidung, siehe Rückfrage 1:**

**A) Frontend spricht für Reads/Subscriptions direkt mit unserer eigenen Hasura-Instanz**
(GraphQL over WebSocket, JWT-Auth-Mode, unsere Rollen SuperAdmin/Admin/Mitarbeiter auf
Hasura-Rollen mit Row-/Column-Permissions gemappt). Vorteil: Hasura übernimmt Subscriptions
nativ, kein eigener WebSocket-Gateway-Code nötig, sehr performant. Nachteil: zweiter
Vertrauensanker neben dem BFF (Hasura muss dieselben JWTs validieren, Permissions müssen in
zwei Systemen — NestJS-Guards fürs BFF, Hasura-Permissions fürs GraphQL — konsistent gehalten
werden).

**B) Alles läuft über einen WebSocket-Gateway im BFF**, das BFF abonniert seinerseits Hasura
oder die CitrineOS-Subscriptions und reicht Updates gefiltert an autorisierte Clients weiter.
Vorteil: eine einzige Autorisierungsstelle. Nachteil: mehr Code, das BFF wird zum
Skalierungs-Flaschenhals für Live-Daten.

Ich tendiere zu A für reine Lesedaten/Live-Status (Standard-Pattern, Hasura ist genau dafür
gebaut) und B nur für alles, was eine Aktion auslöst (Remote-Kommandos, Settings-Änderungen) —
aber das ist eine Architekturentscheidung mit Sicherheitsimplikationen, die ich nicht
stillschweigend treffen möchte.

---

## 10. Entscheidungen

1. **Live-Read-Pfad: A — direkt gegen eigene Hasura-Instanz.** Frontend liest Live-/Listendaten
   per JWT direkt aus unserer eigenen, read-only Hasura-Instanz (Subscriptions). Alle
   Schreibaktionen weiterhin ausschließlich über das BFF. Hasura-Rollen/Permissions und
   BFF-Guards müssen bei jeder Rollenänderung konsistent gehalten werden — das dokumentieren
   wir an einer Stelle (`hasura/metadata`), nicht redundant gepflegt.
2. **Payment-Scope: voller Scan&Charge inkl. Display-QR-Code.** Phase 1 bildet den kompletten
   Flow ab (`SetDisplayMessage`-Integration, QR-Code am Ladepunkt-Display). Directus wird als
   Container mitgeführt (Bootstrap-Admin via Env, kein Nutzerzugriff). Entsprechend mehr
   Testaufwand gegen reale Displays/Stationen — wird im Betreiber-Dashboard als eigener
   Monitoring-Bereich sichtbar.
3. **Infrastruktur-Tab: dedizierter Ops-Agent mit Whitelist.** Eigener Service mit
   Docker-Socket-Zugriff, exponiert ausschließlich eine feste Aktionsliste. Das BFF bekommt
   selbst keinen Docker-Zugriff.

Alle übrigen Punkte oben sind die Arbeitsgrundlage für die Implementierung.

## 11. Umsetzungsplan (Inkremente)

1. **Fundament** ✅ erledigt: Monorepo-Grundgerüst, Produkt-DB-Schema, Settings-Layer
   mit Verschlüsselung, Auth/JWT, Rollen-Guards, Audit-Log — mit Tests. Docker-Compose für den
   eigenen Stack (Postgres + Backend), noch ohne Frontend/Payment/Hasura/Ops-Agent.
2. **CitrineOS-Integrationsschicht** ✅ erledigt: typisierte Clients für Data-API
   (`CitrineOsDataApiService`) und Message-API (`CitrineOsMessageApiService`, mit
   RemoteStart/RemoteStop/Reset/TriggerMessage als erste konkrete Kommandos),
   Settings-getriebene Verbindungskonfiguration (Kategorie `citrineos`, keine `.env`-Werte),
   Subscription-Sync (idempotent, gegen Duplikate abgesichert), Webhook-Empfänger mit
   Shared-Secret-Prüfung (CitrineOS signiert seine Callbacks nicht) und
   `citrineos_message_log`-Tabelle als Grundlage für Live-Monitor/Testsuite. RBAC differenziert
   zwischen unkritischen (RemoteStart/Stop: SuperAdmin/Admin/Mitarbeiter) und störenden Aktionen
   (Reset/TriggerMessage: SuperAdmin/Admin). Getestet gegen einen echten HTTP-Server (Fake
   CitrineOS in den E2E-Tests) — nicht gegen die echte CitrineOS-Instanz, da diese aus der
   Sandbox nicht erreichbar ist; vor dem produktiven Einsatz gegen die reale Instanz verifizieren.
3. **Testsuite-Feature + Live-Message-Monitor** ✅ erledigt (Backend-Logik, kein Frontend):
   fester Schrittkatalog (`testsuite-step-catalog.ts`) mit drei Schrittarten — `trigger`
   (TriggerMessage senden, auf die eigenständige Folgenachricht der Station warten),
   `command` (CSMS-Kommando senden, Antwort über eine pro-Schritt-`callbackUrl` korrelieren —
   im citrineos-core-Quellcode verifiziert: CitrineOS schlüsselt den Callback exakt über die
   OCPP-`messageId`, präziser als Aktionsnamen-Matching) und `observe` (nur warten, für
   Aktionen wie Authorize/TransactionEvent, die die Station nur bei echter Bedienung sendet).
   Hintergrund-Ausführung pro Lauf (Fire-and-forget im Prozess, kein Job-Queue — überlebt
   keinen Neustart, für dieses Inkrement bewusst akzeptiert). Kompatibilitätsmatrix
   (neuester Lauf je Hersteller/Modell/Firmware/OCPP-Version) sowie Live-Message-Monitor mit
   Filtern (Station/Aktion/Richtung/Zeitraum) und CSV-Export, aufbauend auf
   `citrineos_message_log` aus Inkrement 2. Getestet inkl. eines echten Laufs gegen einen
   simulierten CitrineOS-HTTP-Server (Trigger-, Command- und Skip-Ergebnisse alle verifiziert).
4. **Payment-Integration** ✅ erledigt: direkter SQL-Zugriff (kein Prisma — fremdes, nicht von
   uns migriertes Schema) auf citrineos-payments eigene `payment_*`-Tabellen für
   Operators/Locations/Evses/Connectors/Tariffs (dort existiert keine Admin-API, siehe §4 oben),
   read-only für Checkouts. Verbindung settings-gesteuert (`payment.databaseUrl`, verschlüsselt),
   Tabellenpräfix konfigurierbar (Default `payment_`, wie citrineos-payments eigenes
   `DB_TABLE_PREFIX`). Spaltennamen/Typen 1:1 aus `db/init_db.py` übernommen (Integer-PKs, keine
   UUIDs — anders als der Rest unseres Schemas). RBAC: Admin+SuperAdmin (Rollentabelle: „Admin
   verwaltet Standorte, Stationen, Tarife"), Mitarbeiter kein Zugriff. `docker-compose.yml` bindet
   citrineos-payment + Directus optional über ein `payment`-Profil ein (kein offizielles
   Docker-Image gefunden, Build aus lokalem Checkout). Getestet gegen ein Postgres-Schema, das
   exakt citrineos-payments SQLAlchemy-Modelle nachbildet (kein Zugriff auf eine echte
   citrineos-payment-Instanz aus der Sandbox).
5. **Eigene Hasura-Instanz** ✅ erledigt: read-only Metadata (`hasura/metadata`) für 15
   CitrineOS-Core-Tabellen, Namen/Relationen 1:1 aus CitrineOS' eigener Hasura-Metadata
   übernommen, keine Insert/Update/Delete-Permissions irgendwo — jede Schreibaktion bleibt beim
   BFF. Access-Token trägt jetzt zusätzlich den `https://hasura.io/jwt/claims`-Claim
   (`AuthService.issueTokenPair`), sodass dasselbe Login-Token auch GraphQL-Reads
   authentisiert — Entscheidung A aus Abschnitt 9. `citrineosTenantId`-Filter ist bewusst ein
   Literal (Phase 1: ein CitrineOS-Tenant), keine Session-Variable. Tatsächlich gegen eine
   echte `hasura/graphql-engine:v2.40.3.cli-migrations-v3`-Instanz getestet (nicht nur
   YAML-validiert) — dabei zwei echte Bugs gefunden und behoben: `admin` ist ein von Hasura
   reserviertes Rollenwort (→ `csms_admin`, `toHasuraRole()`-Mapping im Backend), und eine
   `VariableAttributes`-Relation auf eine nicht exponierte `Components`-Tabelle wurde entfernt.
   Details und Grenzen (kein Test gegen eine echte CitrineOS-DB) in `hasura/README.md`.
6. **Ops-Agent-Service** ✅ erledigt: eigenständiges, minimal gehaltenes Microservice
   (`ops-agent/`, eigenes Package/eigener Dockerfile), das als einziger Dienst im gesamten Stack
   Docker-Socket-Zugriff bekommt — `backend` selbst nie. Genau drei Aktionen gegen eine feste
   Liste von fünf bekannten Service-Namen (`ALLOWED_SERVICES` in `src/whitelist.ts`, 1:1
   `docker-compose.yml`-Servicenamen): Status, Logs, Restart — keine generische
   Shell-/Exec-Route, jede `:service`-Angabe wird gegen die Whitelist geprüft, bevor sie
   `dockerode` überhaupt erreicht (genau die im ursprünglichen Auftrag geforderte „keine
   beliebige Shell-Ausführung, nur eine fest definierte Whitelist von Aktionen"). Container werden
   über das `com.docker.compose.service`-Label gefunden, nie über einen selbst gebauten
   Containernamen. Kein öffentlicher Port in `docker-compose.yml` — nur über das interne
   Compose-Netz von `backend` erreichbar, zusätzlich per Shared-Secret authentisiert
   (`OPS_AGENT_SHARED_SECRET`, Bootstrap-`.env`-Wert wie die JWT-Secrets: der Ops-Agent hat
   keinerlei Datenbankzugriff, könnte also gar keinen `settings`-Eintrag lesen). Backend-seitig
   `backend/src/ops/` (`OpsController`/`OpsAgentClient`) — SuperAdmin-only, `restart`
   `@Audited()`. Getestet mit gemocktem `dockerode` (kein laufender Docker-Daemon in dieser
   Sandbox — siehe §0): Whitelist-Ablehnung inkl. Shell-Metazeichen/Pfad-Traversal-Versuchen,
   konstante-Zeit-Secret-Prüfung, Label-basiertes Container-Lookup, Demuxing des rohen
   Docker-Log-Streams. `pnpm build`/`pnpm lint` grün. Nicht verifiziert: gegen einen echten
   Docker-Daemon bzw. die tatsächliche `docker-compose.yml`-Verkabelung (Labels, Netzwerk,
   Read-only-Socket-Mount) — vor Produktivbetrieb mit einem echten `docker compose up` prüfen.
   Details in `ops-agent/README.md`.
7a. **Frontend (React/Vite) — Grundgerüst** ✅ erledigt: Vite + TS +
   Tailwind v4 mit eigenem Design-Token-Set (`frontend/src/styles/tokens.css` — bewusst nicht die
   Standard-shadcn-Optik), eigene UI-Primitiven (Button/Input/Card/StatusBadge, CVA-basiert wie
   shadcn generiert, aber selbst geschrieben). `AuthProvider` implementiert den vollen
   Login/Refresh/Logout-Flow gegen `/auth/*` (Access-Token im Speicher, Refresh-Token in
   `localStorage`, ein gemeinsamer In-Flight-Refresh bei parallelen 401ern, stiller
   Session-Resume nach Reload). RBAC-gesteuertes Routing (`ProtectedRoute` + `lib/roles.ts`,
   spiegelt `backend/src/common/roles.enum.ts`) blendet Nav-Punkte aus und leitet bei
   unzureichender Rolle um — reine UI-Bequemlichkeit, jede privilegierte Aktion bleibt
   serverseitig durch die BFF-Guards abgesichert. react-i18next mit DE/EN (Browser-Erkennung,
   persistiert), Dark Mode über `data-theme`-Attribut mit System-Fallback. Domänenansichten waren
   zu diesem Zeitpunkt noch `PlaceholderPage`-Stubs — Routing/Guards/Nav bereits vollständig
   verdrahtet. Getestet: 24 Unit-Tests, `pnpm build`/`pnpm lint` grün, zusätzlich end-to-end in
   einem echten Chromium (Playwright) gegen einen echten laufenden Backend-/Postgres-Prozess
   verifiziert (Login als SuperAdmin/Mitarbeiter, Nav-Sichtbarkeit je Rolle, Redirect bei
   SuperAdmin-Route als Mitarbeiter, Dark Mode, DE/EN-Umschaltung).
7b. **Frontend — Fachansichten** ✅ erledigt (bis auf Stationen/Transaktionen): fünf der sieben
   Nav-Punkte sind jetzt echte, gegen die realen REST-Endpunkte des Backends verdrahtete Seiten
   (`frontend/src/pages/`, `frontend/src/api/`), alle über TanStack Query:
   - **Benutzer** — Liste, Anlegen (wählbare Zielrollen richten sich nach der Rolle des
     angemeldeten Nutzers, spiegelt `ALLOWED_TARGET_ROLES` im Backend), Aktivieren/Deaktivieren.
   - **Einstellungen** — Kategorien werden dynamisch aus `GET /settings` als Tabs gerendert (nicht
     hartkodiert — serverseitig existieren bisher nur `citrineos` und `payment`), Schlüssel
     hinzufügen/bearbeiten, Geheimnisse maskiert. Bewusst nicht gebaut: Rollback auf eine frühere
     Version — dafür fehlt im Backend ein Endpoint, der die Versionshistorie überhaupt auflistet
     (`POST /settings/rollback/:id` verlangt eine Versionsnummer "auf Verdacht"); vor einer
     Rollback-UI müsste das Backend das erst nachliefern.
   - **Testsuite** — Lauf starten, Läufe auflisten, Schritt-für-Schritt-Detailansicht, die während
     `status: running` per Polling live aktualisiert (Ausführung läuft serverseitig im
     Hintergrund).
   - **Live-Monitor** — filterbare OCPP-Nachrichtenliste (5s-Polling), CSV-Export (Download über
     den authentisierten Client als Blob, da ein reiner `<a href>` kein Bearer-Token mitschicken
     kann).
   - **Infrastruktur** — je eine Karte pro Whitelist-Dienst (Status, Logs auf Anfrage, Restart),
     15s-Status-Polling.
   - **Stationen/Transaktionen** bleiben `PlaceholderPage`-Stubs: sie brauchen den in §9/§10
     entschiedenen Live-Lese-Pfad (GraphQL/Subscriptions gegen die eigene Hasura-Instanz), dessen
     Client-Anbindung noch nicht existiert — bewusst nicht blind gebaut, da in dieser Sandbox nie
     echte CitrineOS-Daten zum Testen verfügbar waren.

   Neue UI-Primitiven: `Table`, `Select`, `Textarea`, `Dialog` (kapselt das native `<dialog>`-
   Element für Fokus-Trap/Escape-to-close statt beides selbst zu bauen).

   Getestet: 32 Unit-Tests (u. a. Settings-Gruppierung, Users-/Ops-Seiten gegen eine gemockte
   API), `pnpm build`/`pnpm lint`/`pnpm typecheck:test` grün. Zusätzlich end-to-end gegen einen
   echten laufenden Backend-/Postgres-Prozess verifiziert: einen echten Benutzer über den
   Dialog angelegt und die Listenaktualisierung beobachtet, eine echte (vorbestehende)
   Settings-Kategorie mit maskiertem Geheimnis angezeigt, einen echten Testsuite-Lauf gegen eine
   absichtlich unkonfigurierte Station gestartet und die Schritt-Tabelle live per Polling
   aktualisiert gesehen — inklusive des Klartext-Fehlers, mit dem jeder Schritt fehlschlug
   ("CitrineOS connection is not configured yet…"), was bestätigt, dass die
   Klartext-Fehler-Anforderung aus §9 tatsächlich bis in die UI durchschlägt, nicht nur in der
   API-Antwort steckt. Leere Zustände für Settings/Testsuite/Monitor ohne Daten geprüft; die
   Infrastruktur-Seite zeigt einen sauberen Fehlerzustand statt abzustürzen, wenn der Ops-Agent
   nicht erreichbar ist (hier erwartet — kein Docker-Daemon in dieser Sandbox — vor
   Produktivbetrieb gegen einen echten Ops-Agent erneut prüfen). Details in `frontend/README.md`.
7c. **Frontend — Ladestationen (Live-Lese-Pfad)** ✅ erledigt für die Listenansicht, Rest gemäß
   `docs/stations-feature-plan.md`: `frontend/src/lib/graphql-client.ts` +
   `use-graphql-subscription.ts` sind die erste Anbindung an die eigene, read-only
   Hasura-Instanz — `graphql-request` für einzelne Queries, `graphql-ws` für Live-Subscriptions,
   beide über denselben Access-Token wie der REST-Client (`AuthProvider` ruft
   `configureGraphqlClient` neben `configureApiClient`). Der WebSocket-Auth-Handshake folgt
   Hasuras eigener Konvention (`connectionParams: { headers: { Authorization: ... } }`) — im
   Code kommentiert, weil das kein `graphql-ws`-Standard ist, sondern Hasura-spezifisch.
   `/stations` liest jetzt live aus `ChargingStations` (verschachtelt über `Evses` → `Connectors`,
   da `ChargingStations` selbst keine direkte Connectors-Relation hat — gegen die echten
   Hasura-Metadata-Dateien geprüft, nicht angenommen), mit sichtbarem
   Verbindungsindikator (verbinde/live/getrennt) statt Polling. Nur die Listenansicht, noch ohne
   Karte/Filter/Detailseite (siehe Plan). Transaktionen bleibt vorerst `PlaceholderPage`.

   Getestet: 47 Unit-Tests insgesamt (u. a. GraphQL-Client-Header/Hasura-Connection-Params,
   `useGraphqlSubscription`-Zustandsübergänge, gemockter `graphql-ws`). Zusätzlich — da in dieser
   Sandbox nie eine echte CitrineOS-Instanz erreichbar war — gegen einen echten
   `hasura/graphql-engine:v2.40.3.cli-migrations-v3`-Container verifiziert: ein
   Postgres-Stub mit exakt dem Schema/den Relationen aus `hasura/metadata` für die vier
   betroffenen Tabellen, eine JWT im echten `AuthService`-Format, die tatsächliche
   `STATIONS_LIST_SUBSCRIPTION`-Query gegen die echten `graphql-ws`/`graphql-request`-Versionen
   aus `package.json` — eine direkte Postgres-Änderung am Connector-Status kam ohne erneute
   Anfrage live über die offene Subscription an, danach dasselbe noch einmal durch die tatsächlich
   gerenderte `StationsPage` in einem echten Browser bestätigt (Status-Badge aktualisierte sich
   ohne Reload). Details in `frontend/README.md` und `docs/stations-feature-plan.md`.

Jedes Inkrement wird einzeln committet und ist für sich lauffähig/testbar.
