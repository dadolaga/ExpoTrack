# 21 — Gestione delle fotografie

## Aggiornamento mobile — risposte A1–A9

**Contratto vigente per il web mobile da fiera:** [specifica UI mobile, risposte A1–A9](27_Specifiche_UI_Mobile.md#10-risposte-di-revisione-recepite). Questo aggiornamento prevale sui paragrafi, diagrammi, pseudocodice e casi di test precedenti incompatibili. In particolare, gli esempi con `drafts`, conferma finale «Salva», dettaglio mobile 08, foto stand o scelta manuale del conflitto descrivono la progettazione precedente e non vanno implementati nel mobile. Le parti compatibili e le funzioni desktop/post-fiera mantengono il proprio ambito.

Solo foto prodotto, nessuna entità foto stand. Originale sempre conservato, anteprime derivate senza sostituirlo; nessun numero massimo arbitrario. Blob/metadati persistiti automaticamente prima di dichiarare successo, upload dopo dipendenze prodotto, senza Salva finale. Principale ed eliminazione autosalvate; conferma distruttiva. Niente Informazioni foto. LWW metadati; hash discordanti sono errori integrità.


> **Progetto:** ExpoTrack · **Documento:** `docs/21-photo-management.md` · **Stato:** specifica tecnica proposta, non implementazione  
> **Documenti correlati:** `08-products-config.md`, `12-database.md`, `13-backend-api.md`, `14-frontend-ui.md`, `16-stand-management.md`, `17-product-management.md`, `19-offline-storage.md`, `20-synchronization.md`.  
> **Prossimo:** `docs/22-comparison.md`.

## 1. Scopo e principi

Fotografie personali associate esclusivamente a prodotti, nel contesto profilo/evento. L’utente le aggiunge in 05/06; nessuna foto stand, account interno o condivisione pubblica. Gli originali sono conservati; miniature e derivati di visualizzazione non li sostituiscono. Il salvataggio locale è automatico e distinto dal caricamento server.

### 1.1 Invarianti

1. Ogni foto ha ID stabile, un prodotto proprietario e profilo/evento coerenti.
2. Blob e metadati sono salvati localmente subito; nessuna modalità bozza o Salva finale.
3. Upload automatico solo quando il prodotto valido e le dipendenze sono disponibili sul server.
4. Retry idempotenti e hash impediscono duplicati e sostituzione silenziosa del binario.
5. Quota insufficiente non produce falso successo; dati già persistiti non sono cancellati.
6. Modifica principale ed eliminazione producono operazioni locali; azioni distruttive confermate.
7. Conservare riferimenti necessari a sync/recupero finché la pulizia non è sicura.
8. Nessuna sync garantita a PWA chiusa o persistenza assoluta contro cancellazione dei dati del browser.

## 2. Esperienza utente

### 2.1 Aggiunta e visualizzazione

Dal prodotto: «Scatta foto» o «Dalla galleria», con fallback compatibile col browser e permessi. Selezione, verifica formato/decodifica, preparazione anteprime, transazione locale blob/metadati/outbox e feedback reale. Non attendere un’azione Salva prodotto. Se il prodotto è ancora incompleto, conservare il blob locale e aspettare dati minimi validi prima di inviare riferimenti server.

Griglia con principale, viewer accessibile a schermo intero, zoom dove supportato, ritorno all’editor 05. Azioni solo imposta principale ed elimina con conferma; rimuovere «Informazioni». Nessun numero massimo arbitrario. Se si elimina la principale scegliere la prima residua per data di aggiunta, o rimuovere il riferimento se la griglia è vuota.

### 2.2 Stati

| Stato | Significato e azione |
|---|---|
| `local_saved` | Blob persistito, apribile offline |
| `upload_pending` | Attesa di rete/dipendenze o turno in coda |
| `uploading` | Progresso reale, senza bloccare navigazione |
| `synced` | File e riferimenti confermati dal server |
| `upload_failed` | File locale conservato; errore e riprova |
| `recovery_required` | Proprietario cancellato, riferimenti conservati per recupero |
| `deleted_pending` | Eliminazione locale confermata, tombstone da sincronizzare |

Il contatore foto pendenti è sottoinsieme delle operazioni globali, non un totale da sommare di nuovo. Una foto remota non è disponibile offline finché il file non è realmente scaricato sul dispositivo.

## 3. Associazione e perimetro dei dati

### 3.1 Proprietari consentiti

Una fotografia è collegata esattamente a uno tra:

- `stand`: riferimento `(profileId, eventId, standSource, standId)`;
- `product`: riferimento `(profileId, eventId, productId)`.

La foto di uno stand editoriale appartiene al **profilo**, non al catalogo globale. Una foto di prodotto eredita il profilo e l'evento del prodotto; non è sufficiente fidarsi dei campi forniti dal client.

### 3.2 Regole di coerenza

- `profileId` ed `eventId` non possono essere modificati dopo il primo Salva.
- Il proprietario della foto non può essere cambiato implicitamente modificando la UI.
- Un prodotto eliminato non deve lasciare foto orfane accessibili pubblicamente.
- Uno stand personale di un altro profilo non è un proprietario valido.
- La cancellazione di uno stand dal proprio elenco di interessi **non** cancella le sue fotografie.
- La cancellazione di una categoria editoriale non deve distruggere le foto di prodotti già salvati.

### 3.3 Tipi TypeScript proposti

```ts
type PhotoOwner =
  | {
      type: "stand";
      profileId: string;
      eventId: string;
      standSource: "catalog" | "personal";
      standId: string;
    }
  | {
      type: "product";
      profileId: string;
      eventId: string;
      productId: string;
    };

type PhotoSyncState =
  | "draft"
  | "local_saved"
  | "upload_pending"
  | "uploading"
  | "synced"
  | "upload_failed"
  | "conflict"
  | "deleted_pending";

interface PhotoMetadata {
  id: string;                     // UUID generato offline
  owner: PhotoOwner;
  mimeType: string;
  byteSize: number;
  width?: number;
  height?: number;
  sha256?: string;
  localBlobId?: string;
  serverStorageKey?: string;       // solo metadato interno, non URL pubblico
  originalFilename?: string;      // informativo, mai usato come path
  createdAt: string;
  updatedAt: string;
  revision: number | null;
  syncState: PhotoSyncState;
  deletedAt?: string | null;
}
```

`originalFilename` è facoltativo e non deve essere esposto in export se contiene informazioni personali indesiderate. `serverStorageKey` non dovrebbe essere consegnato direttamente al browser: l'API restituisce piuttosto un identificativo foto e un endpoint di lettura autorizzato dal perimetro applicativo.

## 4. Formati e compatibilità

### 4.1 Input

L'app può incontrare JPEG, PNG, WebP, HEIC/HEIF e altri formati prodotti da smartphone. **`accept="image/*"` non garantisce che il browser sappia decodificare ogni file selezionato.**

Politica proposta:

- JPEG: supportato.
- PNG: supportato, utile per screenshot e testi.
- WebP: supportato dove il browser sa decodificarlo.
- HEIC/HEIF: non promettere supporto universale; verificare e mostrare messaggio se non decodificabile, oppure implementare una conversione esplicita e testata.
- SVG: non accettare come fotografia v1, per ridurre rischi di contenuti attivi e complessità.
- GIF animate: fuori ambito; eventualmente rifiutare o importare un fotogramma con consenso esplicito.

### 4.2 Verifiche

Non fidarsi soltanto dell'estensione o del `File.type`. Controllare:

1. dimensione in byte entro il limite configurato;
2. formato tramite magic bytes/decoder affidabile;
3. immagine decodificabile;
4. dimensioni pixel entro soglie anti-bomba di decompressione;
5. tipo MIME consentito per la rappresentazione finale;
6. eventuale scansione/validazione server prima della pubblicazione nell'archivio media.

La verifica lato client migliora l'esperienza, ma il server **deve ripeterla**.

## 5. Compressione, orientamento e qualità

### 5.1 Obiettivo

Ridurre spazio e traffico mantenendo leggibili scritte su cartellini, schede tecniche, prezzi e dettagli dei prodotti. La compressione eccessiva può rendere inutili le fotografie scattate in fiera.

### 5.2 Parametri iniziali proposti

| Uso | Formato consigliato | Dimensione proposta | Note |
|---|---|---|---|
| Miniatura | WebP/JPEG | lato lungo ~320–480 px | Per liste e griglie |
| Visualizzazione | WebP/JPEG | lato lungo ~1600–2200 px | Da validare su testi piccoli |
| Originale | Formato di origine | Conservazione opzionale | Impatto significativo sullo storage |

I valori sono **punti di partenza da misurare**, non vincoli approvati. Per foto con testi minuti potrebbe essere necessario conservare più risoluzione.

### 5.3 Pipeline proposta

```text
File selezionato
  → verifica preliminare
  → decodifica e orientamento
  → rimozione metadati non necessari
  → generazione preview
  → eventuale derivata compressa
  → persistenza bozza IndexedDB
  → Salva esplicito
  → persistenza confermata + outbox
  → upload e verifica server
  → miniature server opzionali
```

### 5.4 EXIF e privacy

Per impostazione predefinita, **non conservare coordinate GPS** nelle immagini derivate. I metadati EXIF possono contenere posizione, data, modello dispositivo e altri dettagli. L’originale è conservato e può includere EXIF: documentarlo; le derivate escludono coordinate GPS. Non usare i dati di geolocalizzazione per costruire mappe o itinerari.

### 5.5 Gestione della qualità

- Evitare ricompressioni ripetute dello stesso file.
- Conservare l'orientamento corretto anche senza metadati EXIF.
- Non ritagliare l'immagine completa: il ritaglio è solo nella miniatura UI.
- Per testo, usare confronti visivi su cartellini reali prima di fissare il livello di compressione.
- Se la compressione fallisce, consentire fallback controllato al formato originale se supportato e nei limiti.

## 6. Storage locale IndexedDB

### 6.1 Store

`photo_metadata`, `photo_blobs`, `outbox`, `sync_meta`; nessuno store drafts. Le foto sono collegate soltanto al prodotto nel contesto profilo/evento. Mantenerle recuperabili se il prodotto non è ancora valido o l’upload è bloccato da una dipendenza.

### 6.2 Persistenza automatica

Ogni foto acquisita/selezionata salva automaticamente originale, metadati e operazione locale, senza attendere «Salva prodotto». Stato di upload distinto da salvataggio locale. I metadati si inviano solo con proprietario valido; non scartare blob già acquisiti perché la compilazione prodotto non è ancora completa.

### 6.3 Atomicità

Preparare originale e anteprime fuori transazione; poi transazione breve su metadati, blob e outbox. Solo dopo commit mostrare successo. In caso di quota insufficiente mantenere il contesto e proporre riprova, senza cancellazioni silenziose. «Informazioni» foto non è un’azione prevista. Rimuovendo la principale scegliere la prima residua in ordine di aggiunta o nessuna se griglia vuota.

### 6.4 Limiti browser

- Quota di storage variabile per browser/dispositivo.
- Possibile eliminazione dei dati locali da parte del browser o dell'utente.
- Modalità privata con capacità ridotta o dati effimeri.
- Browser mobile che sospende tab o operazioni in background.
- Disponibilità di `navigator.storage.persist()` e `estimate()` non uniforme.

Il sistema deve verificare errori reali, non basarsi soltanto su stime. Una foto non ancora sincronizzata merita un avviso più evidente se lo spazio è critico.

## 7. Upload e sincronizzazione

### 7.1 Separazione metadati e binario

Il protocollo deve evitare di inserire immagini base64 dentro il normale payload JSON di sync. I binari viaggiano tramite endpoint media dedicati; l'outbox contiene metadati, identificativi e dipendenze.

### 7.2 Dipendenze

Per una foto di prodotto creato offline:

1. confermare il prodotto localmente;
2. registrare l'operazione prodotto nell'outbox;
3. confermare la foto localmente;
4. attendere la conferma del prodotto server, se l'API la richiede;
5. caricare il file con `photoId` stabile;
6. associare/committare i metadati sul server;
7. aggiornare lo stato locale a `synced`.

Il prodotto deve rimanere visibile anche se l'upload fotografico non è ancora completato.

### 7.3 Endpoint proposti

| Metodo | Percorso indicativo | Scopo |
|---|---|---|
| `POST` | `/api/photos/uploads` | Inizializzare upload idempotente |
| `PUT` | `/api/photos/uploads/{uploadId}/content` | Trasferire file o chunk |
| `POST` | `/api/photos/uploads/{uploadId}/complete` | Verificare e confermare |
| `GET` | `/api/photos/{photoId}` | Leggere metadati |
| `GET` | `/api/photos/{photoId}/content` | Recuperare contenuto |
| `GET` | `/api/photos/{photoId}/thumbnail` | Recuperare miniatura |
| `DELETE` | `/api/photos/{photoId}` | Richiedere eliminazione versionata |

Sono endpoint **proposti**, da allineare con `13-backend-api.md`; non presumono implementazione già esistente.

### 7.4 Contratto di inizializzazione (esempio)

```json
{
  "operationId": "00000000-0000-4000-8000-000000000101",
  "photoId": "00000000-0000-4000-8000-000000000102",
  "owner": {
    "type": "product",
    "profileId": "me",
    "eventId": "eicma-2026",
    "productId": "00000000-0000-4000-8000-000000000103"
  },
  "mimeType": "image/jpeg",
  "byteSize": 1234567,
  "sha256": "<sha256-esadecimale-calcolato-dal-client>"
}
```

Gli UUID sono fittizi e il campo hash è illustrativo. Il server verifica appartenenza, evento, tipo, dimensione e limiti; restituisce un `uploadId` opaco. Nessun percorso fisico del server deve comparire nella risposta.

### 7.5 Idempotenza

- Stesso `photoId` e stessa operazione: nessun duplicato.
- Stesso `operationId` con contenuto diverso: errore.
- Timeout dopo upload riuscito: il client interroga/riprova e recupera l'esito.
- Upload incompleto: file temporaneo non visibile come foto confermata.
- Hash differente da quello dichiarato: rifiuto, non pubblicazione.

### 7.6 Upload resumable

Per fotografie di dimensioni contenute, una v1 può adottare upload singolo con retry completo. L'upload a chunk/resumable è un **miglioramento possibile**, da scegliere se i test in fiera mostrano interruzioni frequenti o file troppo grandi. Non dichiarare ripresa dal byte esatto se non è stata implementata.

### 7.7 Retry

Usare backoff progressivo con jitter, limiti ragionevoli e ripresa quando l'app torna attiva o online. Un errore permanente di validazione non deve causare retry infiniti. L'app chiusa potrebbe non sincronizzare nulla fino alla riapertura.

## 8. Download e disponibilità offline

### 8.1 Priorità delle sorgenti

Per una foto richiesta dalla UI:

1. se esiste un blob locale valido, usarlo;
2. altrimenti, se online, richiedere il contenuto al server e valutarne la cache;
3. se offline e assente localmente, mostrare placeholder esplicito «Foto non disponibile offline»;
4. non mostrare immagini sbagliate o appartenenti ad altri profili come fallback.

### 8.2 Foto da un secondo dispositivo

Una foto sincronizzata da telefono A può essere visibile come **metadato** sul telefono B senza che B ne abbia ancora scaricato il blob. Definire una strategia:

- miniature scaricate su richiesta;
- foto complete scaricate all'apertura;
- eventuale opzione futura «Rendi disponibili offline» per una selezione di foto.

Non promettere che tutte le foto remote siano automaticamente offline su tutti i dispositivi: il costo in memoria può essere elevato.

### 8.3 URL temporanei

Se si usano `URL.createObjectURL(blob)` per anteprime, revocarli quando non servono più. Non memorizzare object URL in IndexedDB: non sono identificativi persistenti.

### 8.4 Cache PWA

La cache del service worker è adatta agli asset dell'app e, con cautela, a risorse media; la fonte primaria per blob personali offline è **IndexedDB**. Evitare caching indiscriminato di URL media con parametri o permessi variabili. Proteggere la separazione dei profili anche nelle cache.

## 9. Eliminazione e recupero

### 9.1 Eliminazione di una foto confermata

1. Richiedere conferma.
2. Registrare localmente la tombstone o `deleted_pending`.
3. Nascondere la foto dalle viste ordinarie.
4. Accodare l'operazione di eliminazione con `baseRevision`.
5. Sincronizzare quando possibile.
6. Conservare i file finché la procedura non garantisce che non servano per conflitti o recupero.

### 9.2 Foto solo in bozza

La rimozione dalla bozza non è una cancellazione server. Se il blob non è referenziato da altre bozze, può essere rimosso con pulizia controllata.

### 9.3 Eliminazione prodotto

Il prodotto e le foto collegate hanno una relazione di ciclo di vita. Il server deve evitare che l'eliminazione del prodotto lasci media accessibili senza proprietario. È consigliata una procedura transazionale per metadati e tombstone, seguita da garbage collection dei file fisici.

### 9.4 Eliminazione stand personale

Come da `16-stand-management.md`, la raccomandazione prudente è **bloccare l'eliminazione di uno stand personale se esistono prodotti associati**, salvo decisione esplicita differente. La gestione delle fotografie stand deve essere inclusa nella conferma e nelle regole di pulizia.

### 9.5 Garbage collection

Un job server può rimuovere:

- upload temporanei scaduti e mai confermati;
- derivati non referenziati;
- file di record eliminati oltre la retention concordata;
- file orfani identificati tramite verifica di consistenza.

Non eliminare file riferiti da conflitti irrisolti, upload in corso o operazioni ancora recuperabili. La durata della retention resta da definire.

## 10. Concorrenza, integrità e recupero foto

La policy mobile è **LWW per record nell’ordine di accettazione server**, con revisioni monotone assegnate in transazione. Una revisione di base obsoleta su un record vivo non apre una scelta manuale: l’ultima nuova mutazione valida accettata prevale come record intero, senza merge per campo. Il timestamp del telefono è solo diagnostico. Vincoli di dominio e integrità restano applicati.

Il retry della stessa `operationId` e dello stesso payload restituisce l’esito già registrato, senza diventare una nuova scrittura; stesso ID con hash diverso è errore. Il client serializza le operazioni dello stesso record e non sovrascrive modifiche locali più recenti quando applica una conferma o un pull remoto.

Un update contro una tombstone viene respinto senza resuscitare il record. Conservare payload e riferimenti media necessari al recupero; offrire «Recupera come nuovo elemento», con nuovo ID e dipendenze valide. Nessun dialogo «versione locale/versione server» per i normali aggiornamenti concorrenti. Conservare audit per diagnosi senza promettere recupero automatico di ogni versione storica.

Il binario confermato di una foto è immutabile per `photoId`/hash. File differente con stesso ID è errore di integrità, mai sovrascrittura LWW del blob. Una nuova foto riceve nuovo UUID. Upload su prodotto eliminato non pubblica il file e conserva localmente il riferimento recuperabile.

## 11. Sicurezza

### 11.1 Minacce principali

- file malevolo mascherato da JPEG;
- immagini enormi o decompression bomb;
- path traversal nel nome file;
- esposizione di media tramite URL pubblici o directory statiche;
- accesso trasversale tra profili;
- upload non limitati e saturazione disco;
- EXIF con dati personali;
- URL cache di immagini sensibili;
- file temporanei mai rimossi.

### 11.2 Contromisure

- Verifica server del contenuto e limiti su byte e pixel.
- Nomi di storage generati dal server, non da input utente.
- Directory/volume media fuori dalla cartella pubblica di Next.js.
- Endpoint che verificano l'appartenenza logica al profilo e all'entità.
- Header corretti (`Content-Type`, `Content-Disposition`, `X-Content-Type-Options: nosniff`).
- Non eseguire SVG o altri formati attivi come fotografie.
- Limiti di upload e rate limiting ragionevoli.
- Logging di errori senza contenuto binario o metadati sensibili.
- Backup e accessi ai volumi protetti.

### 11.3 Assenza di autenticazione

La v1 non prevede login/PIN. **Non è possibile garantire privacy forte tra persone** che accedono all'app e possono selezionare liberamente un profilo. I controlli `profileId` prevengono errori logici, non impersonificazione. Cloudflare Tunnel da solo non autentica gli utenti; Cloudflare Access è un'opzione di protezione del perimetro da valutare.

## 12. Storage server e backup

### 12.1 Layout indicativo

```text
/data/expotrack/
├── postgres/
├── media/
│   └── <profile-id>/<event-id>/<photo-uuid>/
│       ├── display.jpg
│       └── thumbnail.webp
├── upload-staging/
└── backups/
```

I percorsi sono esempi interni, non URL e non obbligano a conservare l'originale. Gli identificativi devono essere validati e normalizzati; idealmente i percorsi derivano da UUID controllati dal server.

### 12.2 Metadati PostgreSQL

Conforme a `12-database.md`: tabella `photos` con `id`, `profile_id`, `event_id`, `owner_type`, riferimenti stand/prodotto, `storage_key`, MIME, dimensione, hash, revisione, timestamp e tombstone. Il database conserva metadati; il binario risiede nel volume persistente.

### 12.3 Consistenza database/file

Il filesystem e PostgreSQL non condividono una transazione ACID. Usare una macchina a stati:

1. upload in staging;
2. verifica di dimensione/hash/formato;
3. spostamento atomico nel volume media, se supportato;
4. conferma del record DB;
5. job di riconciliazione per eventuali file orfani o record incompleti.

Il dettaglio dell'ordine deve evitare che un record `synced` punti a un file inesistente.

### 12.4 Backup e restore

Il backup deve includere **PostgreSQL e media**, con una procedura coerente e test di ripristino. Salvare soltanto il database non basta. Prevedere controllo degli hash di un campione di file dopo il restore e verifica che foto di stand/prodotti siano nuovamente accessibili.

## 13. Limiti operativi da configurare

Non sono stati approvati valori numerici definitivi. Si raccomanda una configurazione server **non esposta come JSON editoriale modificabile liberamente dal client** per:

| Parametro | Scopo | Decisione |
|---|---|---|
| Dimensione massima file | Prevenire saturazione | Da misurare |
| Dimensione pixel massima | Prevenire decompression bomb | Da definire |
| Formati MIME consentiti | Sicurezza/compatibilità | JPEG, PNG, WebP proposti |
| Dimensione massima miniatura | Prestazioni | ~320–480 px proposti |
| Dimensione massima visualizzazione | Leggibilità/storage | ~1600–2200 px proposti |
| Qualità compressione | Bilanciamento | Da testare su testi piccoli |
| Numero upload concorrenti | Rete e memoria | Da misurare |
| Retention upload temporanei | Pulizia | Da definire |
| Retention tombstone/media | Conflitti e recupero | Da definire |
| Quota per profilo/evento | Prevenire saturazione | Opzionale |

Il frontend può ricevere questi limiti dal bootstrap API, ma il server rimane autoritativo.

## 14. Accessibilità e usabilità

- Pulsanti con etichette leggibili e aree touch adeguate.
- Miniature con descrizioni accessibili; per foto caricate dall'utente, eventuale campo descrizione/alt è una **funzionalità opzionale** da decidere.
- Galleria utilizzabile da tastiera su desktop.
- Focus ripristinato dopo chiusura del visualizzatore.
- Indicazioni di caricamento non basate soltanto sul colore.
- Errori leggibili e azioni di riprova esplicite.
- Nessuna dipendenza da gesture complesse per eliminare o aprire una foto.
- Rispettare preferenze di riduzione delle animazioni.

## 15. Prestazioni

### 15.1 Lista e galleria

- Caricare miniature, non originali, nelle liste.
- Lazy loading delle immagini fuori viewport.
- Evitare di decodificare molte immagini ad alta risoluzione simultaneamente.
- Liberare URL temporanei e risorse al cambio schermata/profilo.
- Paginare o virtualizzare gallerie molto grandi solo se necessario.

### 15.2 Compressione lato client

L'elaborazione può occupare memoria e bloccare il thread principale. Preferire operazioni asincrone e, dove supportato, worker/OffscreenCanvas; prevedere fallback. Su smartphone meno potenti, testare foto di grandi dimensioni e più selezioni consecutive.

### 15.3 Rete mobile

La sincronizzazione non deve impedire l'uso dell'app. Upload paralleli controllati, retry progressivi e stato chiaro. Evitare il download automatico di tutte le foto originali su un nuovo dispositivo.

## 16. Esempi end-to-end

### 16.1 Foto stand offline

1. Profilo `me` apre uno stand catalogo.
2. Seleziona due fotografie.
3. Le anteprime vengono conservate in bozza locale.
4. Preme **Salva**.
5. IndexedDB conferma metadati, blob e operazioni outbox.
6. Le foto appaiono nella galleria anche in modalità aereo.
7. Quando torna online, il client carica i file.
8. Il server verifica i file e restituisce le revisioni.
9. L'interfaccia mostra «Sincronizzata».

### 16.2 Foto prodotto creato offline

1. Profilo `father` crea un prodotto e sceglie la categoria.
2. Aggiunge una foto del prodotto e una del cartellino prezzo.
3. Preme **Salva**: prodotto e foto sono disponibili offline.
4. La sync crea il prodotto sul server.
5. Solo dopo la conferma del riferimento necessario, la sync carica le fotografie.
6. Se una foto fallisce, il prodotto resta salvato e l'altra foto può risultare sincronizzata.

### 16.3 App chiusa durante upload

1. Una foto è già confermata localmente.
2. L'upload inizia ma il browser viene chiuso.
3. Alla riapertura, il client legge l'outbox e controlla lo stato remoto.
4. Se il server ha già confermato l'operazione, la riconosce tramite idempotenza.
5. Altrimenti ritenta l'upload senza creare una seconda foto.

### 16.4 Memoria insufficiente

1. L'utente seleziona un'immagine molto grande.
2. La scrittura in IndexedDB fallisce.
3. L'app mostra errore di spazio e **non** conferma il salvataggio.
4. La bozza non viene cancellata se ancora recuperabile.
5. L'app propone di liberare spazio o scegliere un file più piccolo, senza promettere recuperi impossibili.

### 16.5 Foto visibile da un altro dispositivo

1. Il telefono A sincronizza una foto.
2. Il telefono B scarica i metadati del medesimo profilo.
3. B mostra una miniatura remota, se online.
4. Se B perde rete prima di scaricare il blob completo, l'apertura offline può mostrare «Non disponibile offline».
5. Non dichiarare la foto completa disponibile offline fino a quando il blob non è effettivamente persistito su B.

## 17. Codici di errore suggeriti

| Codice | Significato | Comportamento UI |
|---|---|---|
| `PHOTO_UNSUPPORTED_FORMAT` | Formato non decodificabile/consentito | Scegli altra foto |
| `PHOTO_TOO_LARGE` | File oltre limite | Riduci o sostituisci |
| `PHOTO_TOO_MANY_PIXELS` | Dimensioni pixel eccessive | Mostra limite |
| `PHOTO_CORRUPT` | Decodifica fallita | Riprova con altro file |
| `PHOTO_HASH_MISMATCH` | Integrità fallita | Non confermare upload |
| `PHOTO_OWNER_INVALID` | Proprietario inesistente/non coerente | Correggi collegamento |
| `PHOTO_PROFILE_MISMATCH` | Profilo incoerente | Blocca operazione |
| `PHOTO_UPLOAD_INCOMPLETE` | Upload non terminato | Riprova |
| `PHOTO_STORAGE_FULL` | Storage server esaurito | Conserva copia locale |
| `LOCAL_STORAGE_QUOTA_EXCEEDED` | Quota IndexedDB esaurita | Non dichiarare salvato |
| `PHOTO_REVISION_CONFLICT` | Modifica concorrente | Risoluzione manuale |
| `PHOTO_DELETED` | Tombstone server | Non ricreare automaticamente |
| `PHOTO_NOT_AVAILABLE_OFFLINE` | Blob non presente sul dispositivo | Placeholder chiaro |
| `PHOTO_IDEMPOTENCY_CONFLICT` | Stesso ID, payload diverso | Errore di integrità |

## 18. Piano di test funzionale

| ID | Scenario | Esito atteso |
|---|---|---|
| PH-01 | Scatto da fotocamera supportata | Anteprima disponibile |
| PH-02 | Selezione dalla galleria | Anteprima disponibile |
| PH-03 | Selezione multipla | Foto distinte |
| PH-04 | JPEG valido | Accettato |
| PH-05 | PNG valido | Accettato |
| PH-06 | WebP valido | Accettato se supportato |
| PH-07 | HEIC non decodificabile | Messaggio chiaro |
| PH-08 | SVG mascherato da JPEG | Rifiutato |
| PH-09 | File corrotto | Rifiutato |
| PH-10 | File troppo grande | Rifiutato senza crash |
| PH-11 | Dimensioni pixel eccessive | Rifiutato |
| PH-12 | Orientamento EXIF | Anteprima corretta |
| PH-13 | Immagine con testo piccolo | Leggibile dopo elaborazione |
| PH-14 | Foto aggiunta alla bozza | Nessun upload |
| PH-15 | Foto rimossa dalla bozza | Nessuna eliminazione server |
| PH-16 | Chiusura modulo con bozza | Bozza preservata se possibile |
| PH-17 | Salva offline | Blob e metadati confermati |
| PH-18 | Riapertura offline | Foto confermata visibile |
| PH-19 | Salva fallisce | Nessun falso successo |
| PH-20 | Foto stand catalogo profilo `me` | Isolata logicamente |
| PH-21 | Foto stesso stand profilo `father` | Archivio distinto |
| PH-22 | Foto stand personale di altro profilo | Operazione rifiutata |
| PH-23 | Foto prodotto | Riferimento corretto |
| PH-24 | Prodotto offline non ancora sincronizzato | Upload rispetta dipendenze |
| PH-25 | Upload completato | Stato `synced` |
| PH-26 | Timeout dopo conferma server | Retry idempotente |
| PH-27 | Stesso operation ID, file differente | Errore |
| PH-28 | Hash errato | Rifiuto server |
| PH-29 | Upload interrotto | Recupero senza duplicati |
| PH-30 | Browser chiuso | Ripresa alla riapertura |
| PH-31 | Errore permanente MIME | Niente retry infinito |
| PH-32 | Server offline | Foto locale ancora visibile |
| PH-33 | Secondo dispositivo con solo metadati | Placeholder offline corretto |
| PH-34 | Download foto completa | Cache locale valida |
| PH-35 | Cambio profilo | Nessuna foto errata mostrata |
| PH-36 | Eliminazione foto in bozza | Solo asset temporaneo rimosso |
| PH-37 | Eliminazione foto salvata | Conferma e tombstone |
| PH-38 | Eliminazione offline | Propagazione successiva |
| PH-39 | Retry eliminazione | Nessun effetto duplicato |
| PH-40 | Eliminazione prodotto con foto | Nessun file pubblico orfano |
| PH-41 | Rimozione stand dagli interessi | Foto preservate |
| PH-42 | Conflitto eliminazione/upload | Versioni preservate |
| PH-43 | Rinomina stand JSON | Foto ancora associate |
| PH-44 | Rimozione ID editoriale | Nessuna cancellazione silenziosa |
| PH-45 | Storage browser quasi pieno | Avviso e gestione errori |
| PH-46 | Modalità privata | Limiti segnalati |
| PH-47 | Miniature in lista lunga | Nessun caricamento massivo originali |
| PH-48 | Object URL dopo chiusura galleria | Risorse liberate |
| PH-49 | EXIF GPS nella derivata | Rimosso secondo policy |
| PH-50 | Nome file `../...` | Nessun path traversal |
| PH-51 | File con MIME ingannevole | Verifica server fallisce |
| PH-52 | Accesso URL media diretto | Nessuna directory pubblica |
| PH-53 | Ripristino DB e media | Foto accessibili |
| PH-54 | Restore solo DB | Incoerenza rilevata |
| PH-55 | Upload temporaneo scaduto | Garbage collection sicura |
| PH-56 | Conflitto irrisolto | File necessari conservati |
| PH-57 | Navigazione da tastiera | Galleria utilizzabile |
| PH-58 | Stato upload non basato solo sul colore | Accessibile |
| PH-59 | Foto con orientamento verticale | Visualizzazione completa |
| PH-60 | Foto con testo su cartellino | Dettaglio leggibile |

## 19. Test non funzionali e criteri misurabili

Prima dell'implementazione definire un set di dispositivi reali, almeno un Android recente e un dispositivo con memoria limitata, oltre a browser desktop. Misurare:

- tempo di preparazione di foto da 3, 8 e 15 MB;
- picco memoria durante selezione multipla;
- occupazione IndexedDB prima/dopo compressione;
- qualità leggibile di cartellini e schede tecniche;
- tempo di apertura galleria con 10, 50 e 200 foto;
- affidabilità con rete intermittente e modalità aereo;
- durata del caricamento su rete mobile lenta;
- correttezza di backup e restore;
- numero di duplicati dopo retry forzati: **zero**.

I target numerici definitivi devono essere scelti dopo le misurazioni: non inventare SLA non richiesti.

## 20. Criteri di accettazione

- [ ] Foto aggiungibili a stand e prodotti, con un solo proprietario logico.
- [ ] Foto e metadati isolati per profilo ed evento.
- [ ] Input fotocamera/galleria con fallback compatibile.
- [ ] File verificati sia lato client sia lato server.
- [ ] Orientamento corretto e testi leggibili.
- [ ] Policy EXIF esplicita e GPS escluso dalle derivate.
- [ ] Miniature separate dalle versioni di visualizzazione.
- [ ] Bozze fotografiche locali non sincronizzate prima di **Salva**.
- [ ] Commit locale atomico di metadati, blob e outbox.
- [ ] Foto confermate consultabili offline sul dispositivo che le ha salvate.
- [ ] Nessun falso successo se IndexedDB fallisce.
- [ ] Upload indipendente dai dati testuali ma con dipendenze corrette.
- [ ] Retry idempotenti senza duplicati.
- [ ] Upload incompleti non pubblicati.
- [ ] Foto remote non dichiarate offline prima del download effettivo.
- [ ] Eliminazioni versionate e non distruttive prima della conferma.
- [ ] Conflitti senza sovrascritture automatiche.
- [ ] Nessuna esposizione diretta dei file del volume Docker.
- [ ] Backup coerente di PostgreSQL e media, restore testato.
- [ ] Errori e limiti storage gestiti in modo comprensibile.
- [ ] Galleria accessibile su smartphone e desktop.

## 21. Decisioni aperte

| Tema | Raccomandazione iniziale | Impatto |
|---|---|---|
| Conservazione originali | Confermata: originale sempre conservato, derivate per UI | Storage, qualità, privacy |
| HEIC/HEIF | Fallback con errore chiaro, conversione solo se testata | Compatibilità iPhone |
| Formato derivato | JPEG o WebP in base al browser | Compatibilità e dimensioni |
| Dimensione massima file | Da misurare | Storage e rete |
| Dimensioni/qualità compressione | Test su cartellini con testo piccolo | Utilità in fiera |
| Limite foto per entità | Nessun limite arbitrario finché non misurato | UX e quote |
| Upload a chunk | Non obbligatorio in v1 | Complessità sync |
| Download offline su secondo dispositivo | On demand, opzione dedicata futura | Spazio locale |
| Retention tombstone/media | Da definire con sync e backup | Recuperabilità |
| Descrizione/alt per foto | Campo opzionale futuro | Accessibilità |
| Conflitti su metadati foto | Manuali, come le altre entità | UI e DB |
| Eliminazione stand con prodotti/foto | Blocco prudente finché non definita policy | Integrità |
| Cloudflare Access | Valutare per limitare l'accesso | Sicurezza |

## 22. Raccordo con gli altri documenti

- **`12-database.md`**: tabella `photos`, vincoli sul proprietario, revisioni e tombstone.
- **`13-backend-api.md`**: endpoint media, errori, idempotenza e validazione server.
- **`14-frontend-ui.md`**: galleria, form, stati e messaggi.
- **`16-stand-management.md`**: fotografie stand personali e catalogo.
- **`17-product-management.md`**: foto prodotti, salvataggio e cancellazioni.
- **`19-offline-storage.md`**: object store IndexedDB, quote, bozze e commit.
- **`20-synchronization.md`**: dipendenze outbox, retry, conflitti e sync dei media.
- **`23-export.md`**: selezione e incorporazione di immagini nei PDF e JSON esportati.
- **`24-deployment.md`**: volumi Docker, spazio disco e backup.
- **`25-security.md`**: accesso ai file, validazione e privacy.
- **`26-testing.md`**: test automatici e manuali della pipeline foto.

## 23. Prossimo documento

**`docs/22-comparison.md`** descriverà il confronto desktop affiancato tra prodotti della **stessa categoria**, con prezzi, valutazioni, fotografie, note e risposte ai questionari. Il confronto dovrà utilizzare i dati confermati localmente, distinguere gli stati di sincronizzazione e non creare valutazioni automatiche non richieste.
