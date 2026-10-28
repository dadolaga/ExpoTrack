# 13 — Backend API di ExpoTrack

## Aggiornamento mobile — risposte A1–A9

**Contratto vigente per il web mobile da fiera:** [specifica UI mobile, risposte A1–A9](27_Specifiche_UI_Mobile.md#10-risposte-di-revisione-recepite). Questo aggiornamento prevale sui paragrafi, diagrammi, pseudocodice e casi di test precedenti incompatibili. In particolare, gli esempi con `drafts`, conferma finale «Salva», dettaglio mobile 08, foto stand o scelta manuale del conflitto descrivono la progettazione precedente e non vanno implementati nel mobile. Le parti compatibili e le funzioni desktop/post-fiera mantengono il proprio ambito.

Le API ricevono mutazioni valide generate automaticamente; nessuna attesa del pulsante Salva. LWW per record in ordine server: baseRevision obsoleta su record vivo non richiede scelta manuale. Update contro tombstone viene respinto e resta recuperabile con nuovo ID. Idempotenza, validazione e hash foto restano vincolanti. Budget e checklist richiedono lettura/mutazione sincronizzabile; nessun endpoint foto stand.


> **Documento:** `docs/13-backend-api.md`  
> **Progetto:** ExpoTrack — PWA privata, multi-fiera, offline-first  
> **Stato:** specifica tecnica proposta per la v1, **non implementazione**  
> **Dipendenze:** `03-app-config.md`, `04-profiles-config.md`, `06-categories-config.md`, `07-stands-config.md`, `08-products-config.md`, `09-interests-config.md`, `10-questionnaires-config.md`, `11-visit-statuses-config.md`, `12-database.md`  
> **Prossimo:** `14-frontend-ui.md`

---

## 1. Obiettivo

Definire un contratto HTTP coerente tra il frontend Next.js/React e il backend di ExpoTrack. Il backend deve distribuire la configurazione editoriale, conservare i dati dinamici in PostgreSQL, gestire le fotografie e sincronizzare i dispositivi offline senza perdere modifiche o sovrascrivere conflitti.

Il progetto è destinato inizialmente a **EICMA 2026**, ma ogni endpoint deve considerare un `eventId` per supportare altre fiere. Gli utenti scelgono un profilo (`me`, `father` o un profilo dinamico) **senza login o PIN**. La selezione di un profilo non costituisce autenticazione e non deve essere presentata come una misura di sicurezza.

### 1.1 Principi vincolanti

- JSON editoriali come fonte delle definizioni condivise; non modificabili attraverso API utente.
- PostgreSQL come archivio server dei dati dinamici confermati.
- Salvataggio mobile automatico locale e outbox per valori validi, senza modalità bozza o conferma Salva finale; input invalidi conservati localmente secondo §5.1 del documento 27.
- Salvataggio mobile automatico locale e outbox per valori validi, senza modalità bozza o conferma Salva finale; input invalidi conservati localmente secondo §5.1 del documento 27.
- Il primo Salva di un prodotto blocca la categoria **anche se offline**.
- Stand editoriali condivisi; stand creati nell'app privati del profilo creatore.
- Priorità 1–10, note, cose da vedere, stati di visita e prodotti separati per profilo.
- Concorrenza mobile LWW per record in ordine di accettazione server; revisioni monotone, idempotenza e protezione delle tombstone.
- Retry idempotenti e gestione esplicita delle eliminazioni.
- Nessun endpoint per mappe, percorsi, importazione dati o acquisti.

### 1.2 Convenzioni proposte

Le route illustrate usano `/api/v1/...` e gli **handler di Next.js App Router** (`app/api/v1/.../route.ts`). La scelta è consigliata ma non già approvata; l'implementazione potrà adattare i percorsi preservando semantica, validazione e test.

| Aspetto | Proposta |
|---|---|
| Protocollo | HTTPS via Cloudflare Tunnel, rete locale secondo deploy |
| Payload | JSON UTF-8, tranne upload media |
| Prefisso | `/api/v1` |
| Identità dinamiche | UUID generati dal client offline |
| Versioni record | `revision` server-side crescente |
| Mutazioni offline | Endpoint batch di sincronizzazione |
| Idempotenza | `operationId` per ogni mutazione |
| Errori | Oggetto JSON strutturato con codice stabile |
| Date | ISO 8601 UTC |
| Importi | Interi in unità minime, valuta `EUR` (proposta) |
| Paginazione | Cursor per grandi collezioni |

---

## 2. Confini architetturali

```text
Browser/PWA
  ├─ React / Next.js UI
  ├─ IndexedDB: snapshot, record, bozze, outbox, conflitti
  └─ Service worker: shell e cache offline
            │ HTTPS quando disponibile
            ▼
Next.js API handlers
  ├─ Validazione e regole di dominio
  ├─ Loader e versionamento JSON editoriali
  ├─ API di bootstrap / lettura / sincronizzazione
  ├─ Gestione conflitti e idempotenza
  └─ Metadati / upload fotografie
            │
            ├─ PostgreSQL: dati dinamici e revisioni
            └─ Volume media persistente: file fotografie
```

Il backend **non** deve tentare di ricevere bozze a ogni battitura. Il frontend salva le bozze in IndexedDB e invia soltanto le operazioni confermate.

### 2.1 Servizi di dominio suggeriti

- `EditorialConfigService`: carica e valida configurazioni JSON, calcola versione/hash.
- `ProfileService`: profili iniziali e dinamici, attivazione e cancellazione.
- `StandService`: stand editoriali, stand personali, validazione riferimenti.
- `InterestService`: priorità e cose da vedere, overlay su seed JSON.
- `VisitService`: stati, note e foto per stand.
- `ProductService`: prodotti, categoria immutabile, preferiti e valutazioni.
- `QuestionnaireService`: selezione definizioni per profilo/categoria e validazione risposte.
- `PhotoService`: upload, storage, metadati, cancellazione e disponibilità.
- `SyncService`: operazioni idempotenti, revisioni, pull incrementale e conflitti.

Questi sono **confini logici**, non un obbligo di creare nove classi o nove microservizi.

---

## 3. Risorse editoriali e dati personali

| Risorsa | Origine | Lettura | Modifica via API |
|---|---|---|---|
| Eventi, padiglioni, categorie | JSON | Tutti i profili | No |
| Stand catalogo | JSON evento | Tutti i profili | No |
| Profili iniziali | JSON | Tutti i profili | No eliminazione |
| Interessi iniziali | JSON per profilo | Profilo selezionato | Solo override dinamici |
| Questionari | JSON per profilo/categoria | Profilo selezionato | No |
| Profili dinamici | PostgreSQL | Client | Sì |
| Stand personali | PostgreSQL | Profilo proprietario | Sì |
| Stato visita e note stand | PostgreSQL | Profilo interessato | Sì |
| Override interessi | PostgreSQL | Profilo interessato | Sì |
| Prodotti e risposte | PostgreSQL | Profilo interessato | Sì |
| Fotografie | Volume + metadati DB | Profilo interessato | Sì |

**Privacy logica, non isolamento autenticato:** senza login, un visitatore in grado di aprire l'app può cambiare profilo. L'API deve almeno impedire collegamenti incoerenti (per esempio prodotto di `me` associato a stand privato di `father`), ma non può verificare chi sia realmente la persona.

---

## 4. Convenzioni HTTP

### 4.1 Header

```http
Accept: application/json
Content-Type: application/json
X-ExpoTrack-Client-Version: 1.0.0
X-ExpoTrack-Config-Hash: sha256:...
```

Per le mutazioni singole online si può usare:

```http
Idempotency-Key: <operation-uuid>
If-Match: "<revision>"
```

**Proposta preferita:** normalizzare tutte le modifiche confermate in operazioni `SyncOperation` con `operationId` e `baseRevision`, anche se l'utente è online. Questo evita due sistemi di scrittura con semantiche diverse. Gli endpoint CRUD diretti possono essere facciate dello stesso servizio di dominio, non percorsi di scrittura indipendenti.

### 4.2 Date, null e omissioni

- Timestamp in UTC ISO 8601, ad esempio `2026-10-27T10:00:00.000Z`.
- Campo omesso: nessuna modifica nel payload di patch.
- `null`: cancellazione esplicita del valore, solo dove consentito.
- Array vuoto: valore intenzionalmente vuoto, non dato mancante.
- Prezzo `0`: valore valido, diverso da prezzo assente.
- Priorità mancante: diversa da priorità `1`.
- Nessuna riga di stato visita: stato effettivo `to_visit`.

### 4.3 Paginazione

Per collezioni dinamiche potenzialmente lunghe:

```json
{
  "items": [],
  "nextCursor": null
}
```

Il cursor deve essere opaco e stabile rispetto all'ordinamento scelto. Non usare `offset` come unico meccanismo di sincronizzazione incrementale.

---

## 5. Catalogo degli endpoint proposti

| Metodo | Percorso | Funzione |
|---|---|---|
| `GET` | `/api/v1/health` | Stato di disponibilità di base |
| `GET` | `/api/v1/bootstrap` | Snapshot editoriale + dati iniziali |
| `GET` | `/api/v1/events` | Eventi configurati |
| `GET` | `/api/v1/events/:eventId/catalog` | Stand, padiglioni, categorie dell'evento |
| `GET` | `/api/v1/profiles` | Profili disponibili |
| `POST` | `/api/v1/profiles` | Creazione profilo dinamico |
| `PATCH` | `/api/v1/profiles/:profileId` | Modifica profilo dinamico |
| `DELETE` | `/api/v1/profiles/:profileId` | Eliminazione confermata profilo dinamico |
| `GET` | `/api/v1/profiles/:profileId/events/:eventId/stands` | Vista stand del profilo |
| `POST` | `/api/v1/profiles/:profileId/events/:eventId/personal-stands` | Stand personale |
| `PATCH` | `/api/v1/profiles/:profileId/events/:eventId/personal-stands/:standId` | Modifica stand personale |
| `DELETE` | `/api/v1/profiles/:profileId/events/:eventId/personal-stands/:standId` | Eliminazione stand personale |
| `PUT` | `/api/v1/profiles/:profileId/events/:eventId/stand-states/:standRef` | Stato/note visita |
| `PUT` | `/api/v1/profiles/:profileId/events/:eventId/interests/:standRef` | Override interessi |
| `GET` | `/api/v1/profiles/:profileId/events/:eventId/products` | Lista prodotti |
| `POST` | `/api/v1/profiles/:profileId/events/:eventId/products` | Crea prodotto |
| `GET` | `/api/v1/profiles/:profileId/events/:eventId/products/:productId` | Dettaglio prodotto |
| `PATCH` | `/api/v1/profiles/:profileId/events/:eventId/products/:productId` | Modifica prodotto |
| `DELETE` | `/api/v1/profiles/:profileId/events/:eventId/products/:productId` | Elimina prodotto |
| `GET` | `/api/v1/profiles/:profileId/questionnaires` | Questionari applicabili |
| `PUT` | `/api/v1/profiles/:profileId/events/:eventId/products/:productId/answers` | Risposte questionario |
| `POST` | `/api/v1/media/uploads` | Inizializza upload |
| `PUT` | `/api/v1/media/uploads/:uploadId/content` | Trasferisci file |
| `POST` | `/api/v1/media/uploads/:uploadId/complete` | Completa upload |
| `GET` | `/api/v1/media/:photoId` | Legge media autorizzato dal perimetro logico |
| `DELETE` | `/api/v1/media/:photoId` | Rimuove riferimento media |
| `POST` | `/api/v1/sync/push` | Invio operazioni confermate |
| `GET` | `/api/v1/sync/pull` | Cambiamenti server dal cursor |
| `GET` | `/api/v1/sync/conflicts` | Conflitti pendenti |
| `POST` | `/api/v1/sync/conflicts/:conflictId/resolve` | Risoluzione manuale |

**Nota importante:** la tabella è un catalogo di risorse e possibili route, **non** una decisione di implementare ogni scrittura due volte. Per la v1 è preferibile usare `sync/push` come **unico percorso effettivo delle mutazioni offline/online** e mantenere eventuali endpoint CRUD come wrapper coerenti o rinviarli. Le operazioni di upload binario restano dedicate.

---

## 6. Bootstrap editoriale

### 6.1 `GET /api/v1/bootstrap`

Restituisce le informazioni necessarie a inizializzare l'app e cache locali. Non deve includere tutte le foto né i dati personali di ogni profilo.

Esempio illustrativo:

```json
{
  "schemaVersion": 1,
  "configHash": "sha256:example",
  "generatedAt": "2026-10-27T10:00:00.000Z",
  "app": {
    "name": "ExpoTrack",
    "defaultLocale": "it-IT",
    "defaultEventId": "eicma-2026"
  },
  "events": [
    { "id": "eicma-2026", "name": "EICMA 2026", "enabled": true }
  ],
  "profiles": [
    { "id": "me", "name": "Io", "source": "config", "enabled": true },
    { "id": "father", "name": "Papà", "source": "config", "enabled": true }
  ],
  "catalog": {
    "categories": [],
    "pavilions": [],
    "stands": []
  }
}
```

**Il payload è un esempio parziale**, non sostituisce gli schemi dei documenti `03`–`07`. In particolare, colori, icone, budget e altri campi configurati devono essere conservati nel contratto effettivo.

### 6.2 Cache e versionamento

- Validare **tutti** i file JSON prima di pubblicare uno snapshot.
- Calcolare hash canonico della configurazione editoriale rilevante.
- Consentire richieste condizionali con `ETag`/`If-None-Match`.
- Restituire `304 Not Modified` quando appropriato.
- Pubblicare uno snapshot **atomico**: il client non deve mescolare categorie nuove con stand vecchi incompatibili.
- Mantenere il precedente snapshot valido se un aggiornamento fallisce.
- Non inventare stand, padiglioni o posizioni EICMA 2026.

### 6.3 Dati personali iniziali

Gli interessi e i questionari sono **per profilo**. Per ridurre esposizione inutile e payload, il client può caricarli dopo la selezione del profilo tramite endpoint dedicati o una variante del bootstrap parametrizzata.

**Da definire:** forma definitiva di questa seconda fase, rispettando l'assenza di autenticazione e la separazione logica dei profili.

---

## 7. Profili

### 7.1 Elenco

`GET /api/v1/profiles` combina profili configurati e dinamici, conservando ID stabili e indicazione dell'origine.

```json
{
  "items": [
    { "id": "me", "name": "Io", "source": "config", "enabled": true },
    { "id": "father", "name": "Papà", "source": "config", "enabled": true }
  ]
}
```

### 7.2 Creazione dinamica

```http
POST /api/v1/profiles
Content-Type: application/json
Idempotency-Key: <uuid>
```

```json
{
  "id": "usr-<uuid>",
  "name": "Visitatore aggiuntivo",
  "color": "#455A64",
  "icon": "user-round"
}
```

Il server deve validare nome, colore, icona, collisioni ID e origine. Il profilo creato dall'app non ha interessi o questionari JSON iniziali: **non generare configurazioni fittizie**.

### 7.3 Modifica ed eliminazione

- Profilo JSON: non eliminabile tramite API utente.
- Profilo dinamico: modificabile ed eliminabile, con doppia conferma **in UI**.
- La conferma UI non è un controllo server: l'API deve comunque applicare le regole di dominio e la gestione delle dipendenze.
- Disabilitare un profilo non deve cancellarne i dati.
- Eliminare un profilo richiede gestione di prodotti, stand, foto, bozze locali e operazioni pendenti; **non implementare una cascata cieca**.

**Scelta aperta:** se la cancellazione profilo sia soft delete recuperabile o processo irreversibile con retention; definire in `16`, `20`, `25`.

---

## 8. Stand editoriali e personali

### 8.1 Vista unificata

`GET /api/v1/profiles/:profileId/events/:eventId/stands` può restituire una vista composta da:

1. stand editoriali dell'evento;
2. stand personali del profilo;
3. stato visita effettivo;
4. priorità e cose da vedere effettive;
5. eventuali conteggi prodotti.

```json
{
  "items": [
    {
      "ref": { "source": "catalog", "standId": "demo-stand" },
      "name": "Stand dimostrativo",
      "categories": [],
      "hall": null,
      "booth": null,
      "priority": null,
      "whatToSee": [],
      "visitStatus": "to_visit",
      "productCount": 0
    }
  ]
}
```

**Esempio fittizio**: non rappresenta uno stand verificato. La vista può essere composta direttamente nel client usando catalogo + record dinamici, per ridurre traffico e preservare il funzionamento offline. In quel caso l'endpoint aggregato è opzionale.

### 8.2 Stand personale

I campi editabili sono nome, descrizione, categorie, padiglione e booth, se validi. Il server deve verificare `ownerProfileId` e `eventId`.

Non consentire `DELETE` di uno stand editoriale; un riferimento `source=catalog` non è sufficiente per autorizzare la mutazione.

### 8.3 Riferimenti in URL

**Evitare una stringa ambigua** come `standRef=abc:def` senza schema. Proposta: usare parametri separati `standSource` e `standId`, oppure un identificatore codificato e validato. Il contratto finale deve specificare encoding, lunghezze e normalizzazione.

---

## 9. Stati di visita

### 9.1 Valori ammessi

```ts
type VisitStatus = "to_visit" | "visited" | "revisit";
```

Etichette UI: **Da visitare**, **Visitato**, **Da rivedere**.

### 9.2 Stato implicito

L'assenza di un record per profilo/evento/stand equivale a `to_visit`. Non serve creare un record per ogni stand all'avvio.

### 9.3 Scrittura

```json
{
  "standRef": { "source": "catalog", "standId": "demo-stand" },
  "visitStatus": "revisit",
  "notes": "Tornare per un'altra prova."
}
```

La modifica è **personale**: aggiornare lo stato per `me` non deve cambiare quello di `father`.

L'API deve accettare modifiche confermate con revisione, non sovrascrivere note concorrenti e non cambiare priorità o prodotti come effetto collaterale.

---

## 10. Interessi personali

### 10.1 Seed e override

La priorità e la lista `whatToSee` iniziali provengono da `config/interests/<profileId>.json` per i profili editoriali. Le modifiche dell'app sono **override** dinamici.

Il server deve distinguere:

- assenza di override: usare il seed;
- priorità impostata: valore intero 1–10;
- priorità esplicitamente cancellata: **non** ripristinare il seed;
- lista sostituita: usare il nuovo elenco;
- lista esplicitamente svuotata: **non** ripristinare il seed.

### 10.2 Esempio di override

```json
{
  "standRef": { "source": "catalog", "standId": "demo-stand" },
  "priority": { "mode": "set", "value": 9 },
  "whatToSee": {
    "mode": "replace",
    "items": ["Provare il prodotto", "Chiedere informazioni"]
  }
}
```

Il formato è **proposto**, da verificare con `09-interests-config.md`; non considerarlo un secondo schema indipendente. Le modalità `inherit`, `set`, `clear` e `replace` devono avere semantica documentata e testata.

### 10.3 Validazione

- Priorità intera da 1 a 10 se impostata.
- Elementi `whatToSee` stringhe non vuote dopo trim.
- Riferimento stand valido nel profilo/evento.
- Un override non modifica mai il file JSON.
- Un aggiornamento del seed non sovrascrive un override personale già confermato.

---

## 11. Prodotti

### 11.1 Creazione

Esempio logico di input:

```json
{
  "id": "9ad81ca7-faa5-4a7a-9620-333333333333",
  "standRef": { "source": "catalog", "standId": "demo-stand" },
  "name": "Casco dimostrativo",
  "categoryId": "helmets",
  "price": { "amountMinor": 29900, "currency": "EUR" },
  "rating": 8,
  "isFavorite": true,
  "notes": "Buona vestibilità"
}
```

Gli identificativi e i dati sono **fittizi**; lo stand e la categoria devono esistere nel catalogo attivo. Il client genera l'ID offline.

### 11.2 Regole

| Campo | Regola |
|---|---|
| `name` | Obbligatorio, non vuoto |
| `standRef` | Obbligatorio, valido per profilo/evento |
| `categoryId` | **Esattamente uno**, scelto manualmente |
| `categoryId` dopo primo Salva | **Immutabile**, anche se primo Salva offline |
| `price` | Facoltativo; non negativo; `0` distinto da assente |
| `rating` | Facoltativo; intero 1–10 |
| `isFavorite` | Booleano, default `false` |
| `notes` | Testo facoltativo |
| `photos` | Riferimenti a più foto, facoltativi |
| `answers` | Domande facoltative configurate per profilo/categoria |

### 11.3 Aggiornamento

Non includere `categoryId` nell'input di modifica. L'API deve rifiutarlo anche se un client malevolo o obsoleto lo inserisce.

```json
{
  "name": "Casco dimostrativo aggiornato",
  "price": null,
  "rating": 9,
  "isFavorite": false
}
```

Un `price: null` indica cancellazione intenzionale del prezzo, non `0`.

**Scelta aperta:** se lo stand di origine possa essere cambiato dopo il primo Salva. La proposta prudente in `08-products-config.md` è mantenerlo immutabile; non fissare un comportamento diverso qui.

### 11.4 Eliminazione

L'eliminazione deve essere idempotente, con tombstone e gestione delle fotografie collegate. Il frontend richiede conferma; il backend non deve eliminare altri prodotti o lo stand.

### 11.5 Liste

Parametri di query proposti:

```http
GET /api/v1/profiles/me/events/eicma-2026/products?categoryId=helmets&favorite=true&sort=rating&direction=desc
```

Filtri supportati: nome, categoria, stand, preferiti. Ordinamenti: prezzo e valutazione crescente/decrescente. Per valori mancanti, proposta: in fondo in entrambi i sensi.

La UI può effettuare ricerca e filtro **localmente** per l'uso offline; le API di lista devono comunque restituire dati coerenti.

---

## 12. Questionari e risposte

### 12.1 Lettura definizioni

`GET /api/v1/profiles/:profileId/questionnaires` restituisce soltanto le definizioni configurate per quel profilo. Non generare questionari comuni, domande di fallback o valori precompilati.

Tipi di domanda:

- testo;
- numero;
- sì/no;
- scelta singola;
- scelta multipla;
- voto 1–10.

**Tutte le domande sono facoltative.**

### 12.2 Selezione per categoria

Il questionario applicabile dipende dal profilo e dalla categoria/sottocategoria del prodotto. L'ereditarietà dalle categorie padre è una **decisione aperta**; proposta corrente: matching esatto, da allineare a `10-questionnaires-config.md`.

### 12.3 Scrittura risposte

```json
{
  "questionnaireId": "helmet-review-demo",
  "questionnaireVersion": 1,
  "answers": {
    "comfort": 9,
    "fit": "Buona"
  }
}
```

**Solo esempio illustrativo**: ID, domande e opzioni devono esistere nella definizione effettiva. L'API deve verificare che le risposte corrispondano al tipo e alle opzioni ammesse, ma non richiedere che tutte le domande siano compilate.

### 12.4 Versionamento storico

Le risposte salvate devono restare interpretabili se la definizione JSON cambia. Si raccomanda uno snapshot/versione della definizione usata, come descritto in `12-database.md`.

Non eliminare risposte vecchie soltanto perché una domanda è stata rimossa dalla configurazione corrente.

---

## 13. Gestione fotografie

### 13.1 Flusso a due fasi

1. Il client salva il file in locale, associandolo al prodotto/stand e al profilo.
2. L'utente preme **Salva**; il record e l'intenzione di caricare il media entrano nella coda locale.
3. Quando online, il client inizializza un upload.
4. Trasferisce il binario in modo idempotente o riprendibile, se supportato.
5. Il server valida contenuto, dimensioni e riferimenti.
6. Il client completa l'upload e riceve `photoId`/revisione.
7. La fotografia risulta sincronizzata, senza perdere la copia offline necessaria.

### 13.2 Inizializzazione

```json
{
  "photoId": "56b42b8f-4444-4444-8444-444444444444",
  "profileId": "me",
  "eventId": "eicma-2026",
  "owner": {
    "type": "product",
    "productId": "9ad81ca7-faa5-4a7a-9620-333333333333"
  },
  "mimeType": "image/jpeg",
  "byteSize": 1843200,
  "sha256": "<digest>"
}
```

L'upload di una foto stand usa un riferimento allo stand anziché `productId`. Il server verifica che il proprietario logico del media corrisponda al profilo del record.

### 13.3 Sicurezza dei file

- Limite dimensione configurato e verificato lato server.
- Verifica del tipo reale, non soltanto dell'estensione.
- Nomi storage opachi, nessun path fornito direttamente dall'utente.
- Protezione da traversal e upload malevoli.
- Nessuna esposizione pubblica del volume media.
- Pulizia di upload incompleti senza eliminare media ancora referenziati.
- Gestione EXIF/metadata privacy da definire in `21-photo-management.md`.

### 13.4 Coerenza upload/record

Se un prodotto viene eliminato mentre una foto è in upload, non associare la foto a un record eliminato senza gestire il conflitto. La transazione SQL e il filesystem non sono una singola transazione atomica: prevedere stati temporanei e un job di riconciliazione.

---

## 14. Protocollo di sincronizzazione

### 14.1 Scopo

Il protocollo deve permettere a un dispositivo di inviare modifiche confermate offline e recuperare quelle fatte su altri dispositivi, mantenendo consistenza e risolvendo manualmente i conflitti.

La sincronizzazione **non** avviene automaticamente a ogni carattere digitato e non è garantita quando il browser è chiuso.

### 14.2 `POST /api/v1/sync/push`

Esempio:

```json
{
  "clientId": "device-demo-01",
  "configHash": "sha256:example",
  "operations": [
    {
      "operationId": "0b12d945-1111-4111-8111-111111111111",
      "profileId": "me",
      "eventId": "eicma-2026",
      "entityType": "product",
      "entityId": "9ad81ca7-faa5-4a7a-9620-333333333333",
      "action": "create",
      "baseRevision": null,
      "payload": {
        "standRef": { "source": "catalog", "standId": "demo-stand" },
        "name": "Casco dimostrativo",
        "categoryId": "helmets",
        "isFavorite": false
      }
    }
  ]
}
```

Il payload è **illustrativo** e non sostituisce il modello prodotto completo. `clientId` serve a identificare il dispositivo nel protocollo, **non autentica l'utente**.

### 14.3 Risposta per operazione

```json
{
  "results": [
    {
      "operationId": "0b12d945-1111-4111-8111-111111111111",
      "status": "applied",
      "entityId": "9ad81ca7-faa5-4a7a-9620-333333333333",
      "revision": 1,
      "serverUpdatedAt": "2026-10-27T10:00:00.000Z"
    }
  ]
}
```

Stati suggeriti: `applied`, `already_applied`, `conflict`, `rejected`, `dependency_pending`. Un batch può avere **successi parziali**: il client deve marcare come sincronizzate soltanto le operazioni confermate.

### 14.4 Idempotenza

Il server registra `operationId` e hash canonico del payload. Ripetere lo stesso ID con lo stesso contenuto restituisce il risultato originale; riutilizzarlo con contenuto diverso produce errore.

La registrazione idempotenza e la modifica dati devono avvenire in una **transazione SQL coerente**. Non registrare un successo prima che il commit sia completato.

### 14.5 Dipendenze

Esempio: creare uno stand personale offline e poi un prodotto collegato a esso.

- Entrambi ricevono ID stabili già offline.
- L'outbox registra la dipendenza del prodotto dalla creazione dello stand.
- Il client invia nell'ordine corretto o il server risponde `dependency_pending`.
- Non scartare il prodotto perché la dipendenza non è ancora stata sincronizzata.

### 14.6 Revisione ottimistica

- `baseRevision` uguale alla revisione corrente: applicare e incrementare.
- Revisione diversa: **conflitto**, senza sovrascrittura automatica.
- Entità già eliminata: conflitto/tombstone, non ricreazione implicita.
- Record nuovo: `baseRevision: null` e ID ancora inesistente, salvo retry idempotente.

### 14.7 Batch e limiti

Definire un massimo di operazioni e dimensione del batch. I file binari devono essere trasferiti tramite endpoint media, non incorporati come base64 in `sync/push`.

Per batch molto grandi, suddividere preservando dipendenze e ordinamento per entità.

---

## 15. Recupero incrementale: `GET /api/v1/sync/pull`

### 15.1 Parametri

```http
GET /api/v1/sync/pull?profileId=me&eventId=eicma-2026&cursor=<opaque>&limit=100
```

### 15.2 Risposta

```json
{
  "changes": [
    {
      "sequence": 105,
      "entityType": "product",
      "entityId": "9ad81ca7-faa5-4a7a-9620-333333333333",
      "action": "upsert",
      "revision": 3,
      "payload": {
        "name": "Casco dimostrativo",
        "categoryId": "helmets",
        "isFavorite": true
      }
    }
  ],
  "nextCursor": "opaque-next-cursor",
  "hasMore": false
}
```

**Importante:** i payload mostrati sono parziali. Il protocollo deve decidere esplicitamente se inviare snapshot completi delle entità o patch; per semplicità e resilienza si propongono **snapshot completi per entità**, esclusi i binari delle foto.

### 15.3 Cursor e tombstone

Il cursor non deve essere un semplice timestamp client. Si propone una sequenza monotona server-side per le modifiche, associata a profilo/evento o a un log globale filtrato.

Le eliminazioni devono comparire nel feed come **tombstone**, così i dispositivi offline non ripristinano record eliminati.

### 15.4 Bootstrap di un secondo dispositivo

Un dispositivo nuovo deve ottenere uno snapshot completo dei dati dinamici del profilo/evento e poi proseguire con un cursor. Snapshot e cursor devono rappresentare un **punto consistente**, per non perdere modifiche intervenute durante il caricamento.

### 15.5 Cursor scaduto

Se lo storico delle modifiche è stato compattato, il server deve restituire un errore specifico (per esempio `SYNC_CURSOR_EXPIRED`) e guidare a una risincronizzazione completa **senza cancellare outbox e bozze locali**.

---

## 16. Concorrenza LWW e risposte di errore

La policy mobile è **LWW per record nell’ordine di accettazione server**, con revisioni monotone assegnate in transazione. Una revisione di base obsoleta su un record vivo non apre una scelta manuale: l’ultima nuova mutazione valida accettata prevale come record intero, senza merge per campo. Il timestamp del telefono è solo diagnostico. Vincoli di dominio e integrità restano applicati.

Il retry della stessa `operationId` e dello stesso payload restituisce l’esito già registrato, senza diventare una nuova scrittura; stesso ID con hash diverso è errore. Il client serializza le operazioni dello stesso record e non sovrascrive modifiche locali più recenti quando applica una conferma o un pull remoto.

Un update contro una tombstone viene respinto senza resuscitare il record. Conservare payload e riferimenti media necessari al recupero; offrire «Recupera come nuovo elemento», con nuovo ID e dipendenze valide. Nessun dialogo «versione locale/versione server» per i normali aggiornamenti concorrenti. Conservare audit per diagnosi senza promettere recupero automatico di ogni versione storica.

Per update valido su record vivo restituire esito applicato con nuova revisione; per retry identico l’esito originale. Per update su tombstone restituire codice stabile `RECORD_DELETED` e riferimento/revisione cancellata, senza applicare la scrittura. Non usare `409`/`REVISION_CONFLICT` come flusso manuale obbligatorio per revisioni obsolete ordinarie. Restano errori espliciti per integrità, categoria/stand immutabili, profilo/riferimenti invalidi e idempotency key riusata con payload diverso.

Endpoint di budget e checklist devono preservare semantica override seed, appartenenza profilo/categoria per budget e profilo/evento/stand per checklist. La serializzazione HTTP va coordinata con le mutazioni outbox del documento 20.

## 17. Contratto errori

### 17.1 Struttura proposta

```json
{
  "error": {
    "code": "CATEGORY_IMMUTABLE",
    "message": "La categoria non può essere modificata dopo il primo salvataggio.",
    "details": {
      "field": "categoryId"
    },
    "requestId": "req-demo-123"
  }
}
```

I messaggi devono essere comprensibili, ma i client devono basarsi sui **codici stabili**, non confrontare stringhe tradotte.

### 17.2 HTTP status

| HTTP | Uso |
|---|---|
| `200` | Lettura/modifica riuscita |
| `201` | Creazione riuscita |
| `204` | Eliminazione senza corpo, se coerente col protocollo |
| `304` | Snapshot non modificato |
| `400` | JSON o parametri malformati |
| `404` | Risorsa inesistente o non disponibile nel perimetro |
| `409` | Conflitto di revisione, idempotenza o dipendenza |
| `410` | Cursor scaduto o risorsa non più disponibile, se scelto |
| `413` | Upload/payload troppo grande |
| `415` | Tipo media non supportato |
| `422` | Validazione semantica fallita |
| `429` | Rate limit |
| `500` | Errore interno |
| `503` | Servizio temporaneamente indisponibile |

Non esporre stack trace, query SQL, segreti o percorsi filesystem nelle risposte.

### 17.3 Codici applicativi

| Codice | Descrizione |
|---|---|
| `VALIDATION_ERROR` | Dati non validi |
| `UNKNOWN_EVENT` | Evento non definito |
| `UNKNOWN_CATEGORY` | Categoria sconosciuta |
| `UNKNOWN_CATALOG_STAND` | Stand editoriale non trovato |
| `PROFILE_SCOPE_MISMATCH` | Riferimenti incoerenti col profilo |
| `EVENT_SCOPE_MISMATCH` | Riferimenti incoerenti con l'evento |
| `CATALOG_STAND_READ_ONLY` | Mutazione editoriale vietata |
| `CONFIG_PROFILE_NOT_DELETABLE` | Eliminazione profilo JSON vietata |
| `CATEGORY_IMMUTABLE` | Categoria prodotto già confermata |
| `INVALID_PRICE` | Prezzo non valido |
| `INVALID_RATING` | Valutazione non valida |
| `QUESTIONNAIRE_NOT_APPLICABLE` | Questionario non previsto |
| `QUESTIONNAIRE_VERSION_MISMATCH` | Versione non compatibile |
| `REVISION_CONFLICT` | Modifica concorrente |
| `ENTITY_DELETED` | Entità già eliminata |
| `IDEMPOTENCY_KEY_REUSED` | Chiave riutilizzata con payload diverso |
| `SYNC_DEPENDENCY_PENDING` | Dipendenza non sincronizzata |
| `SYNC_CURSOR_EXPIRED` | Necessario nuovo snapshot |
| `EDITORIAL_SNAPSHOT_INCOMPATIBLE` | Configurazione non compatibile |
| `UPLOAD_INVALID` | File non valido |
| `UPLOAD_TOO_LARGE` | Dimensione oltre limite |
| `MEDIA_NOT_FOUND` | Media non disponibile |

---

## 18. Sicurezza del backend

### 18.1 Assenza di autenticazione interna

La v1 **non autentica** gli utenti. Non dichiarare che i dati di un profilo siano protetti dagli altri profili solo perché l'API usa `profileId`.

Cloudflare Tunnel offre il collegamento, **non** un controllo di accesso. Valutare Cloudflare Access per proteggere l'applicazione da accessi esterni non autorizzati; la scelta va trattata in `25-security.md`.

### 18.2 Protezioni necessarie anche in un'app privata

- PostgreSQL non esposto pubblicamente.
- Credenziali e secret soltanto sul server.
- Validazione rigorosa di tutti i parametri e payload.
- Query parametrizzate, nessuna interpolazione SQL di input.
- Limiti a payload, upload e batch sync.
- Protezione da path traversal e file malevoli.
- Non fidarsi di `profileId`, `eventId`, `standRef` o `categoryId` inviati dal client per la **coerenza** dei dati.
- Errori senza dati sensibili.
- Logging con `requestId` e senza contenuti personali non necessari.
- Protezioni CSRF e cookie coerenti con l'eventuale architettura di accesso scelta.
- Rate limiting proporzionato, anche se l'app è privata.

### 18.3 Controlli di origine

Se il frontend e le API condividono la stessa origin, preferire same-origin e non abilitare CORS permissivo indiscriminato. L'eventuale uso di Cloudflare Access richiede la gestione dei suoi meccanismi d'identità separatamente dalla selezione profilo.

---

## 19. Logging e osservabilità

Registrare almeno:

- request ID e endpoint;
- durata e status HTTP;
- errori di validazione aggregati;
- operazioni sync ricevute, applicate, in conflitto o rifiutate;
- backlog delle operazioni e dei conflitti;
- upload incompleti o falliti;
- versione/hash della configurazione editoriale;
- stato delle migrazioni e connessione PostgreSQL.

Non loggare fotografie, questionari completi, note personali o payload integrali come impostazione predefinita. Redigere una policy di retention dei log.

---

## 20. Deploy Docker e rete

L'API è parte dell'app Next.js ospitata su server privato Debian/Linux. PostgreSQL e media storage devono usare volumi persistenti. Il servizio database deve essere raggiungibile solo sulla rete Docker appropriata.

```text
Internet / dispositivi
       │
Cloudflare Tunnel
       │
Next.js ExpoTrack (UI + API)
       ├── PostgreSQL (rete privata Docker)
       └── Volume media persistente
```

Il deploy deve includere backup di **database e file media**, test di ripristino e aggiornamenti compatibili con client offline. Dettagli in `24-deployment.md`.

---

## 21. Strategia di test

### 21.1 Test contratti e configurazione

| ID | Scenario | Risultato atteso |
|---|---|---|
| API-01 | Bootstrap con JSON validi | Snapshot coerente |
| API-02 | JSON editoriale invalido | Errore esplicito, nessuna pubblicazione parziale |
| API-03 | `If-None-Match` corrispondente | `304` |
| API-04 | Evento inesistente | Errore `UNKNOWN_EVENT` |
| API-05 | Stand senza padiglione | Valido, nessuna posizione inventata |
| API-06 | Stand con categoria sconosciuta | Configurazione rifiutata |
| API-07 | Questionario non definito | Nessun questionario restituito |
| API-08 | Questionario di altro profilo | Non applicato automaticamente |

### 21.2 Test profili, stand e interessi

| ID | Scenario | Risultato atteso |
|---|---|---|
| API-09 | Creazione profilo dinamico | ID stabile, nessun seed fittizio |
| API-10 | Eliminazione profilo JSON | Rifiutata |
| API-11 | Disabilitazione profilo | Dati preservati |
| API-12 | Stand personale di `me` | Non compare nella vista `father` |
| API-13 | Prodotto su stand personale altrui | Rifiutato |
| API-14 | Eliminazione stand editoriale | Rifiutata |
| API-15 | Priorità 1 e 10 | Accettate |
| API-16 | Priorità 0 e 11 | Rifiutate |
| API-17 | Priorità cancellata volontariamente | Seed non ripristinato |
| API-18 | Lista `whatToSee` svuotata | Resta vuota |
| API-19 | Stato assente | `to_visit` effettivo |
| API-20 | Stato `revisit` per un profilo | Altro profilo invariato |

### 21.3 Test prodotti e questionari

| ID | Scenario | Risultato atteso |
|---|---|---|
| API-21 | Prodotto senza nome | Rifiutato |
| API-22 | Prodotto senza categoria | Rifiutato |
| API-23 | Prima creazione prodotto | Categoria salvata |
| API-24 | Patch tenta cambiare categoria | `CATEGORY_IMMUTABLE` |
| API-25 | Prezzo assente | Valido |
| API-26 | Prezzo zero | Valido e distinto da assente |
| API-27 | Prezzo negativo | Rifiutato |
| API-28 | Rating 1 e 10 | Validi |
| API-29 | Rating 0, 11 o decimale | Rifiutato |
| API-30 | Domande tutte vuote | Salvataggio valido |
| API-31 | Risposta con opzione inesistente | Rifiutata |
| API-32 | Definizione questionario aggiornata | Risposte storiche interpretabili |
| API-33 | Preferito di `me` | Non modifica `father` |
| API-34 | Eliminazione prodotto | Tombstone, stand preservato |

### 21.4 Test sincronizzazione

| ID | Scenario | Risultato atteso |
|---|---|---|
| API-35 | Push valido | Applicato e revisionato |
| API-36 | Retry identico | `already_applied`, nessun duplicato |
| API-37 | Stesso ID operazione, payload diverso | Errore idempotenza |
| API-38 | Batch con una operazione invalida | Esiti individuali coerenti |
| API-39 | Prodotto dipende da stand non ancora creato | Dipendenza pendente |
| API-40 | Revisione obsoleta | Conflitto, niente overwrite |
| API-41 | Risoluzione manuale | Nuova revisione |
| API-42 | Risoluzione su revisione ormai cambiata | Nuovo conflitto |
| API-43 | Pull incrementale | Nessuna modifica persa |
| API-44 | Cursor scaduto | Risnapshot senza cancellare outbox |
| API-45 | Eliminazione su altro dispositivo | Tombstone propagata |
| API-46 | Modifiche di profili diversi | Nessun conflitto improprio |
| API-47 | Client con hash editoriale vecchio | Compatibilità verificata |

### 21.5 Test media, sicurezza e operatività

| ID | Scenario | Risultato atteso |
|---|---|---|
| API-48 | Upload JPEG valido | Media persistente |
| API-49 | Upload troppo grande | Rifiutato |
| API-50 | MIME dichiarato falso | Rifiutato |
| API-51 | Path traversal nel nome file | Nessuna scrittura fuori volume |
| API-52 | Foto di prodotto eliminato | Nessuna associazione inconsistente |
| API-53 | Upload interrotto e ritentato | Nessun duplicato |
| API-54 | Database indisponibile | Errore gestito, nessun falso successo |
| API-55 | Backup database senza media | Restore test segnala incompletezza |
| API-56 | Request non valida | Nessuno stack trace esposto |
| API-57 | Profilo selezionato senza login | Limite di sicurezza documentato |
| API-58 | API same-origin | CORS non inutilmente aperto |

---

## 22. Decisioni aperte e punti di integrazione

| Decisione | Proposta | Da consolidare in |
|---|---|---|
| Unica via di scrittura | `sync/push` per mutazioni confermate | `13`, `20` |
| Endpoint CRUD | Wrapper dello stesso dominio o rimandati | `13`, `16`, `17` |
| Versione API | `/api/v1` | `13`, `24` |
| Bootstrap personale | Seconda fase dopo scelta profilo | `13`, `14` |
| Formato override interessi | `inherit/set/clear/replace` | `09`, `13` |
| Formato denaro | `amountMinor` e `EUR` | `08`, `12`, `13` |
| Categoria prodotto | Immutabile dal primo Salva | **Confermato** |
| Stand di origine prodotto | Proposta immutabile | `08`, `17` |
| Ereditarietà questionario | Matching esatto proposto | `10`, `18` |
| Versione risposte | Snapshot definizione | `10`, `12`, `18` |
| Upload foto | Tre fasi + retry | `13`, `21` |
| Limiti upload | Da misurare sul dispositivo | `21` |
| Cursor pull | Sequenza server monotona | `12`, `20` |
| Retention tombstone | Da definire | `20` |
| Eliminazione stand con prodotti | Blocco prudente proposto | `16`, `17` |
| Protezione perimetrale | Cloudflare Access possibile | `25` |
| Export PDF/JSON | Da valutare lato client/server | `23` |

**Regola di progetto:** i contratti proposti qui non devono introdurre un secondo significato per campi già descritti nei documenti `03`–`12`. In caso di divergenza, risolverla esplicitamente prima di generare codice.

---

## 23. Criteri di accettazione

- [ ] API versionate e validate con contratti TypeScript/schema runtime.
- [ ] Snapshot editoriali coerenti, cacheabili e mai inventati.
- [ ] Dati dinamici separati per profilo/evento.
- [ ] Nessuna mutazione degli stand editoriali tramite UI/API.
- [ ] Stand personali limitati al profilo proprietario sul piano logico.
- [ ] Stato `to_visit` predefinito senza riga obbligatoria.
- [ ] Priorità 1–10 e cancellazioni volontarie degli interessi preservate.
- [ ] Prodotti con singola categoria immutabile dopo primo Salva locale.
- [ ] Prezzo facoltativo, voto generale indipendente e preferiti personali.
- [ ] Questionari solo se configurati per profilo/categoria, tutte le domande facoltative.
- [ ] Foto multiple, upload robusti e media non esposti direttamente.
- Salvataggio mobile automatico locale e outbox per valori validi, senza modalità bozza o conferma Salva finale; input invalidi conservati localmente secondo §5.1 del documento 27.
- [ ] Push idempotente con revisione e risultati per operazione.
- [ ] Pull incrementale con tombstone e cursor consistente.
- Concorrenza mobile LWW per record in ordine di accettazione server; revisioni monotone, idempotenza e protezione delle tombstone.
- [ ] Errori strutturati, niente stack trace o segreti.
- [ ] PostgreSQL accessibile solo privatamente.
- [ ] Limiti dell'assenza di autenticazione documentati.
- [ ] Compatibilità dei client offline durante gli aggiornamenti.
- [ ] Test contrattuali, integrazione, sync, media e sicurezza superati.

---

## 24. Prossimo documento

**`docs/14-frontend-ui.md`** descriverà la UI mobile-first: selezione iniziale del profilo, navigazione inferiore fissa, dashboard, liste stand/prodotti, moduli con bozze, fotografie, questionari, indicatori di sync, accessibilità e adattamento desktop per il confronto prodotti.

Non implementare ancora route o componenti: questo documento è la **specifica di progettazione**, da usare nella futura chat di sviluppo.
