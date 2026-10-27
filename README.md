# ExpoTrack

> Applicazione privata, mobile-first e offline-first per pianificare e documentare visite a fiere, esposizioni ed eventi.  
> **Evento pilota:** EICMA 2026. **Stato:** base Next.js e devcontainer con PostgreSQL disponibili; funzionalità applicative da implementare.

## Avvio dello sviluppo

Aprire il repository in VS Code, eseguire **Dev Containers: Reopen in Container**
e, terminata l'installazione automatica delle dipendenze, lanciare `npm run dev`
nel terminale del container. L'app è disponibile su **http://localhost:3000**.

Il devcontainer usa [Docker Compose](.devcontainer/compose.yaml) per avviare
l'ambiente Node.js e PostgreSQL 17 con dati persistenti. `DATABASE_URL` è già
configurata nel container applicativo.

Per prerequisiti, avvio senza container e comandi di verifica, vedere
[la guida allo sviluppo](docs/development.md).

## 1. Obiettivo

ExpoTrack permette a più persone di consultare un catalogo di espositori, organizzare i propri interessi, registrare visite e prodotti osservati, compilare questionari personalizzati e consultare i risultati dopo l'evento.

Il progetto **non è limitato a EICMA**: la configurazione degli eventi deve consentire in futuro di gestire altre fiere senza riscrivere la logica applicativa. EICMA 2026 è il primo evento e il riferimento per la versione iniziale.

Il progetto è destinato a un gruppo ristretto di persone, su un server privato. L'app non prevede login o PIN interni nella prima versione. **Attenzione:** Cloudflare Tunnel non è un sistema di autorizzazione: senza Cloudflare Access o altra protezione, chi conosce l'URL può accedere ai dati e selezionare qualsiasi profilo.

## 2. Principi vincolanti

1. **Configurazione autorevole:** cataloghi, categorie, profili iniziali, interessi e questionari editoriali sono definiti da JSON separati, validati e versionati. PostgreSQL ne mantiene una copia operativa aggiornata; i campi senza personalizzazioni seguono automaticamente il config, quelli personalizzati seguono le regole di riconciliazione del §5.
2. **Profili indipendenti:** note, fotografie, prodotti registrati, preferiti, stati di visita e risposte sono separati per profilo.
3. **Catalogo condiviso, scoperte private:** gli stand importati dai JSON sono visibili a tutti; gli stand creati da un profilo nell'app restano visibili solo a quel profilo.
4. **Offline-first:** consultazione e raccolta dati devono funzionare senza rete, dopo la necessaria preparazione/cache iniziale.
5. **Salvataggio esplicito:** le modifiche in corso vengono conservate come bozze locali; solo il pulsante **Salva** conferma i dati e li mette in coda per la sincronizzazione.
6. **Nessuna perdita silenziosa:** gli aggiornamenti del config sui campi non personalizzati si applicano automaticamente. Le modifiche personali sono preservate; solo cambiamenti incompatibili sullo stesso campo richiedono una scelta, conservando tutte le versioni necessarie. I conflitti di revisione tra dispositivi restano soggetti a risoluzione manuale.
7. **Un prodotto, una categoria:** la categoria/sottocategoria viene scelta manualmente e non è modificabile dopo il primo salvataggio.
8. **Questionari solo se configurati:** nessuna domanda comune obbligatoria e nessun questionario creato automaticamente.
9. **Nessun percorso interno:** l'app non calcola itinerari o percorsi tra stand.
10. **Documentazione implementabile:** ogni modulo ha una specifica dedicata in `docs/`, con contratti, regole, esempi, validazioni e criteri di accettazione.

## 3. Stack e distribuzione

| Ambito | Scelta |
|---|---|
| Frontend e API | Next.js, React, TypeScript |
| UI | Tailwind CSS e componenti personalizzati, senza shadcn/MUI |
| Database server | PostgreSQL: catalogo importato dai JSON e dati dinamici personali |
| Archiviazione offline | IndexedDB |
| Installabilità | Progressive Web App (PWA) |
| Deployment | Docker su server Linux/Debian |
| Accesso remoto | Cloudflare Tunnel |
| Accesso applicativo v1 | Nessun login e nessun PIN |
| Protezione futura | Cloudflare Access, da valutare in una fase successiva |

L'implementazione di ORM, validazione degli schemi, gestione delle immagini, versionamento delle API e strategia di cache sarà dettagliata nei documenti tecnici dedicati; non è ancora una scelta definitiva.

## 4. Modello funzionale

### 4.1 Eventi, padiglioni e stand

- Un evento contiene padiglioni e stand; padiglione e numero di stand sono opzionali quando non verificati.
- Ogni stand del catalogo può appartenere a più categorie e possiede un identificativo stabile.
- I dati descrittivi comuni (nome, categorie, padiglione, posizione, descrizione) sono definiti nel catalogo JSON dell'evento e importati in PostgreSQL; le API distribuiscono la versione pubblicata e il client la conserva offline.
- La priorità personale è un intero da **1 a 10**, assegnato allo **stand** e non alla singola categoria.
- Per ciascun profilo, uno stand ha stato **da visitare**, **visitato** o **da rivedere**; note e fotografie dello stand sono facoltative.
- Ricerca e filtri: nome, categoria, padiglione, priorità e stato di visita. Ordinamento per priorità, nome e padiglione, crescente/decrescente.
- I filtri e gli ordinamenti **si azzerano alla riapertura** dell'app.
- Gli stand aggiunti dall'interfaccia sono privati al profilo creatore e modificabili/eliminabili, con conferma prima dell'eliminazione.

### 4.2 Profili

- I profili iniziali, ad esempio `me` e `father`, sono configurati nei JSON, con `id` stabile, nome, colore, icona e stato di abilitazione.
- È possibile creare altri profili direttamente dall'interfaccia. Partono senza interessi e senza questionari; vedono il catalogo comune e possono registrare dati personali.
- I profili creati dall'app sono modificabili (es. nome e colore) ed eliminabili con **doppia conferma**. La cancellazione comprende i dati personali associati.
- I profili disabilitati tramite configurazione non compaiono nel selettore ma i loro dati vengono mantenuti.
- Il profilo attivo viene ricordato sul dispositivo e può essere cambiato dalla sezione **Profilo**.
- Nome e colore del profilo attivo sono sempre visibili nell'intestazione.
- La selezione del profilo **non è autenticazione né autorizzazione**.

### 4.3 Prodotti osservati

- I prodotti inseriti durante la visita sono **dati personali dinamici**, non voci obbligatorie del catalogo statico.
- Ogni prodotto appartiene a uno stand e a **una sola** categoria/sottocategoria scelta manualmente.
- Dopo il primo salvataggio, categoria e sottocategoria sono bloccate.
- Campi previsti: nome, eventuale prezzo unico, voto complessivo facoltativo **1–10**, preferito sì/no, note libere facoltative, più fotografie facoltative, risposte al questionario applicabile.
- Prodotti modificabili ed eliminabili, con conferma prima dell'eliminazione.
- Due viste: prodotti all'interno dello stand e **lista generale personale**.
- Lista generale: ricerca per nome; filtri per categoria, stand e preferiti; ordinamenti per prezzo e voto.
- **Confronto affiancato solo su desktop**, per prodotti della stessa categoria, con prezzi, voti e risposte.

### 4.4 Questionari

- Le definizioni sono separate **per profilo e categoria/sottocategoria**, tramite JSON.
- **Non esiste un questionario globale/comune** applicato a tutti i prodotti.
- Tipi di risposta: testo, numero, sì/no, scelta singola, scelta multipla, voto 1–10.
- Tutte le domande sono facoltative.
- Se non esiste un questionario per quella combinazione profilo/categoria, la sezione non viene mostrata.
- Le risposte sono dati dinamici personali e non modificano i JSON delle domande.
- I profili creati dall'app non ricevono questionari automatici: possono usarli solo dopo la configurazione di un JSON dedicato.

### 4.5 Dashboard e navigazione

- All'avvio, dopo l'eventuale selezione iniziale del profilo, si apre **sempre la dashboard personale**.
- La dashboard mostra conteggi e avanzamento degli stand da visitare, visitati, da rivedere, prodotti e preferiti.
- I riepiloghi sono cliccabili e aprono liste con i filtri corrispondenti.
- Su smartphone: barra inferiore fissa con **Dashboard, Stand, Prodotti, Profilo**.
- L'intestazione mostra sempre profilo attivo e stato di connessione/sincronizzazione.

### 4.6 Offline, bozze e sincronizzazione

- I dati necessari alla visita devono essere disponibili offline dopo il caricamento iniziale.
- Le bozze sono salvate localmente a ogni modifica, ma non sono considerate dati confermati.
- **Salva** conferma il record localmente e, se necessario, lo inserisce nella coda di sincronizzazione verso PostgreSQL.
- Le fotografie salvate devono rimanere consultabili offline; la gestione di spazio, cache e trasferimenti sarà specificata separatamente.
- Al ritorno della connessione la sincronizzazione riparte automaticamente; esiste anche un comando manuale.
- Indicatore persistente: sincronizzato, offline, in attesa, errore. Le bozze non salvate hanno indicazione distinta.
- In caso di conflitto tra dispositivi, l'utente sceglie quale versione mantenere: nessuna sovrascrittura automatica.

### 4.7 Esportazione

- **Per singolo profilo**, senza mescolare dati di persone diverse.
- **JSON:** esportazione dei dati del profilo; **nessuna importazione/ripristino dei dati personali da JSON** nella v1.
- **PDF riassuntivo:** tabella dei prodotti raggruppati per categoria e sottocategoria.
- **PDF dettagliato:** schede prodotto con foto, note e domande/risposte.
- È possibile esportare tutto o selezionare categorie.
- **Nessun Excel**.

## 5. Architettura delle configurazioni

### 5.1 Fonte autorevole e copia operativa

**Il config è la fonte autorevole dei dati editoriali.** I JSON versionati definiscono eventi, padiglioni, catalogo stand, categorie, profili iniziali, interessi iniziali e questionari. PostgreSQL ne mantiene una **copia operativa aggiornata tramite importazione**, utilizzabile dalle API e collegabile ai dati personali tramite vincoli referenziali.

La separazione tra configurazione e dati raccolti è logica: entrambi possono risiedere nel database, con proprietà e regole di aggiornamento distinte.

| Tipo di dato | Fonte autorevole | Persistenza e aggiornamento |
|---|---|---|
| Eventi, padiglioni, categorie, stand editoriali | JSON | Tabelle PostgreSQL importate, con ID stabili e riferimenti validati |
| Profili iniziali | JSON | Copia PostgreSQL distinta dai profili creati nell'app; abilitazione gestita dal config |
| Interessi e budget iniziali, se configurati | JSON | Valori base importati, separati dagli override personali per campo |
| Questionari | JSON versionati | Definizioni importate; conservazione delle versioni usate dalle risposte |
| Etichette, colori e impostazioni solo grafiche | JSON | Possono restare nella configurazione senza una tabella per ogni proprietà |
| Profili dinamici, stand personali, prodotti, note, foto, stati, risposte, preferiti e override | App | IndexedDB e PostgreSQL secondo le regole di sincronizzazione; file fotografici nello storage media |

I JSON si modificano nel processo editoriale; le API utente non li riscrivono. Le tabelle editoriali non sono una seconda fonte da modificare manualmente. Le personalizzazioni sono ammesse soltanto per i campi che l'app consente già di modificare: questa architettura non rende modificabili nome, posizione o categorie di uno stand condiviso, né identificativi o regole strutturali.

### 5.2 Importazione e pubblicazione

1. Leggere e validare l'intero insieme dei JSON, inclusi riferimenti, identificativi, versioni e compatibilità con i dati già raccolti.
2. Confrontare la nuova configurazione con l'ultima importata e preparare gli inserimenti, gli aggiornamenti, i ritiri e gli eventuali conflitti personali.
3. Importare in una transazione PostgreSQL il catalogo coerente e i metadati di riconciliazione. Se la validazione o la transazione fallisce, mantenere la precedente versione pubblicata.
4. Registrare versione/hash dello snapshot e valori base necessari al confronto. Ripetere l'importazione dello stesso snapshot non deve duplicare record, revisioni o segnalazioni di conflitto.
5. Le API leggono la versione pubblicata in PostgreSQL. Il client aggiorna atomicamente il catalogo in IndexedDB, conservando bozze, modifiche confermate, foto, operazioni pendenti e conflitti.

Il flusso è **JSON → importazione PostgreSQL → API → IndexedDB**. Gli aggiornamenti editoriali devono arrivare anche ai client già inizializzati; i dati personali seguono il proprio protocollo di sincronizzazione.

### 5.3 Riconciliazione per singolo campo

**Se un campo non è stato personalizzato, il database e la vista effettiva devono seguire automaticamente il config.** Non basta chiedersi se il record sia stato modificato: una nota aggiunta a uno stand non deve bloccare l'aggiornamento del suo nome o del padiglione.

Per i campi personalizzabili conservare separatamente il valore editoriale corrente, l'eventuale override personale esplicito e la versione/il valore base da cui quella personalizzazione deriva. Non dedurre l'esistenza di una modifica personale dalla sola differenza di valore o da `updated_at`.

| Situazione del singolo campo | Comportamento |
|---|---|
| Nuovo dato presente nel config | Importarlo, senza creare personalizzazioni fittizie |
| Nessun override personale | Applicare automaticamente il nuovo valore del config, anche se altri campi del record hanno dati personali |
| Override presente, config invariato per quel campo | Mantenere il valore personale, senza segnalare conflitti |
| Config e override convergono allo stesso valore | Nessun conflitto; mantenere la provenienza e l'override esplicito |
| Config e personalizzazione cambiano diversamente lo stesso campo rispetto alla base | Aggiornare la base editoriale nel DB, conservare l'override come valore effettivo e segnalare un conflitto da risolvere |
| Cancellazione personale esplicita (`null`, lista vuota o modalità `clear`) | Trattarla come override intenzionale, mai come assenza di modifica |
| Dato creato soltanto nell'app | Non modificarlo durante l'importazione del config |

Il confronto usa **base precedente, nuovo valore del config e valore personale**. Per ciascun override, la base di confronto resta quella della modifica o dell'ultima riconciliazione accettata: un'importazione ripetuta non deve cancellare o generare di nuovo lo stesso conflitto. Le liste personali sono trattate come un unico campo; non unire automaticamente elementi che l'utente potrebbe aver rimosso intenzionalmente.

Esempio: priorità iniziale `8`, personalizzata a `6`; una modifica del nome dello stand si applica senza conflitti e lascia la priorità a `6`. Se il config cambia anche la priorità da `8` a `9`, PostgreSQL registra `9` come nuova base, mantiene `6` come valore personale e propone la scelta. Senza personalizzazione, il valore effettivo passa direttamente a `9`.

La risoluzione permette di **seguire il config** (rimuovendo l'override), **conservare la personalizzazione** (riconoscendo la nuova base) o salvare un nuovo valore personale valido. Deve essere una mutazione versionata: se nel frattempo cambia il config o il dato personale, rivalutare il conflitto. Il ripristino dei valori del config deve essere una scelta esplicita; l'uguaglianza occasionale dei valori non cancella l'intenzione dell'utente.

Questa riconciliazione riguarda **config e personalizzazioni**. I conflitti di revisione tra modifiche personali provenienti da dispositivi diversi restano manuali. Al ritorno online, distinguere questi casi dagli errori di compatibilità: una modifica offline conserva la propria base, non sovrascrive l'intero record con il vecchio catalogo e non viene scartata perché nel frattempo è stato importato un nuovo config.

### 5.4 Rimozioni, storico e compatibilità

- Gli ID editoriali sono stabili: rinominare un oggetto ne aggiorna gli attributi; cambiare ID richiede una migrazione esplicita. Non associare oggetti in base al solo nome.
- Un elemento rimosso da una configurazione valida viene **ritirato dal catalogo corrente**, conservando la riga storica e i collegamenti. Non eliminare a cascata prodotti, note, foto, risposte o override. Gli eventuali riferimenti editoriali ancora attivi devono essere corretti o migrati prima della pubblicazione.
- L'assenza di dati personali sul server non prova che non esistano modifiche ancora offline: il ritiro non autorizza una cancellazione fisica immediata. I dati storici restano consultabili; le operazioni pendenti si accettano se compatibili, altrimenti si conservano con un errore esplicito e un percorso di risoluzione.
- Disabilitare o ritirare un profilo editoriale non cancella i suoi dati personali e non permette all'override di riabilitarlo.
- Le nuove definizioni dei questionari valgono per i nuovi usi; le risposte esistenti conservano la versione immutabile di domande e opzioni con cui sono state salvate. Cambiamenti incompatibili richiedono una migrazione esplicita e non reinterpretano automaticamente le vecchie risposte.
- Un config invalido o una modifica strutturale incompatibile senza migrazione blocca la pubblicazione. Un conflitto su una preferenza personale viene invece registrato senza impedire l'importazione degli aggiornamenti editoriali validi.

**Verifiche richieste all'implementazione:** aggiornamento automatico senza override; aggiornamento indipendente dei campi; conservazione degli override vuoti; nessun conflitto per valori convergenti; conflitto solo sul campo modificato diversamente; importazione ripetibile; ritiro con riferimenti offline preservati; questionari storici leggibili; rollback dell'importazione fallita; rivalutazione di risoluzioni divenute obsolete.

**Precedenza documentale:** queste decisioni sono vincolanti e sostituiscono le indicazioni precedenti che limitano PostgreSQL ai soli dati dinamici o rendono opzionale la copia relazionale del catalogo. Le specifiche correlate, in particolare [`01-architecture`](docs/01-architecture.md), [`09-interests-config`](docs/09-interests-config.md), [`12-database`](docs/12-database.md), [`13-backend-api`](docs/13-backend-api.md) e [`19-offline-storage`](docs/19-offline-storage.md), devono essere allineate prima dell'implementazione.

### Struttura documentale prevista

```text
ExpoTrack/
├── README.md                         # Questo documento: visione e indice
├── docs/                             # Specifiche tecniche modulari
│   ├── 00-overview.md
│   ├── 01-architecture.md
│   ├── 02-project-structure.md
│   ├── 03-app-config.md
│   ├── 04-profiles-config.md
│   ├── 05-pavilions-config.md
│   ├── 06-categories-config.md
│   ├── 07-stands-config.md
│   ├── 08-products-config.md
│   ├── 09-interests-config.md
│   ├── 10-questionnaires-config.md
│   ├── 11-visit-statuses-config.md
│   ├── 12-database.md
│   ├── 13-backend-api.md
│   ├── 14-frontend-ui.md
│   ├── 15-dashboard.md
│   ├── 16-stand-management.md
│   ├── 17-product-management.md
│   ├── 18-questionnaire-engine.md
│   ├── 19-offline-storage.md
│   ├── 20-synchronization.md
│   ├── 21-photo-management.md
│   ├── 22-comparison.md
│   ├── 23-export.md
│   ├── 24-deployment.md
│   ├── 25-security.md
│   └── 26-testing.md
└── config/                           # File di esempio/iniziali, da creare per step
    ├── app.json
    ├── profiles.json
    ├── pavilions.json
    ├── categories.json
    ├── events/
    │   └── eicma-2026-stands.json
    ├── interests/
    │   ├── me.json
    │   └── father.json
    └── questionnaires/
        ├── me.json
        └── father.json
```

**Nota sui nomi:** questo albero è la struttura *proposta* per la documentazione e i file di esempio, non indica che siano già stati creati. I nomi e i percorsi dei JSON saranno fissati nelle rispettive specifiche. `products-config` descriverà il modello e le eventuali configurazioni di prodotto, **non** un catalogo statico obbligatorio di prodotti osservati. Analogamente, gli stati di visita personali saranno memorizzati nel database: un eventuale JSON degli stati può solo descrivere le opzioni, non sostituire i dati dinamici.

## 6. Indice dei documenti da realizzare

| Ordine | Documento | Contenuto |
|---|---|---|
| 00 | `docs/00-overview.md` | Scenari d'uso, ambito e regole generali |
| 01 | `docs/01-architecture.md` | Componenti, flussi, confini tra configurazione e dati |
| 02 | `docs/02-project-structure.md` | Struttura reale del repository e convenzioni |
| 03 | `docs/03-app-config.md` | Schema di `app.json`, eventi e impostazioni globali |
| 04 | `docs/04-profiles-config.md` | Profili iniziali JSON e profili creati dall'app |
| 05 | `docs/05-pavilions-config.md` | Padiglioni e riferimenti |
| 06 | `docs/06-categories-config.md` | Gerarchia categorie/sottocategorie |
| 07 | `docs/07-stands-config.md` | Catalogo stand per evento |
| 08 | `docs/08-products-config.md` | Modello prodotto, campi e vincoli |
| 09 | `docs/09-interests-config.md` | Priorità e interessi per profilo |
| 10 | `docs/10-questionnaires-config.md` | Questionari per profilo e categoria |
| 11 | `docs/11-visit-statuses-config.md` | Stati visita e loro transizioni |
| 12 | `docs/12-database.md` | Schema PostgreSQL, versioni e relazioni |
| 13 | `docs/13-backend-api.md` | Endpoint, payload, validazioni e conflitti |
| 14 | `docs/14-frontend-ui.md` | Design system e navigazione responsive |
| 15 | `docs/15-dashboard.md` | Widget, calcoli e collegamenti ai filtri |
| 16 | `docs/16-stand-management.md` | Catalogo, stand personali, filtri e note |
| 17 | `docs/17-product-management.md` | Inserimento, modifica, filtri e vincoli |
| 18 | `docs/18-questionnaire-engine.md` | Rendering dinamico e risposte |
| 19 | `docs/19-offline-storage.md` | IndexedDB, bozze, PWA e cache |
| 20 | `docs/20-synchronization.md` | Coda, retry, conflitti e stato |
| 21 | `docs/21-photo-management.md` | Foto multiple, offline e storage |
| 22 | `docs/22-comparison.md` | Confronto prodotti desktop |
| 23 | `docs/23-export.md` | JSON e due modalità PDF |
| 24 | `docs/24-deployment.md` | Docker, server e Cloudflare Tunnel |
| 25 | `docs/25-security.md` | Rischi, protezioni e Cloudflare Access futuro |
| 26 | `docs/26-testing.md` | Test unitari, integrazione, offline ed E2E |

Ogni documento dovrà riportare: **scopo, decisioni vincolanti, dati e contratti, validazioni, flussi, errori/casi limite, indicazioni di implementazione, esempi e criteri di accettazione**. I documenti dovranno fare riferimento tra loro anziché duplicare regole in modo incoerente.

## 7. Ordine di lavoro

1. Consolidare questo `README.md` come fonte delle decisioni funzionali.
2. Scrivere **un documento `docs/` per volta**, seguendo l'ordine dell'indice.
3. Quando viene definito lo schema di un JSON, creare il relativo **esempio valido** in `config/`.
4. Dopo le specifiche di configurazione, definire database, API, UI, offline e sincronizzazione.
5. Implementare e verificare per moduli, usando i criteri di accettazione dei documenti.

**Regola di avanzamento:** non considerare definitiva una struttura JSON finché il documento corrispondente non ne definisce campi obbligatori/facoltativi, tipi, valori ammessi, default, riferimenti, esempi validi e gestione degli errori.

## 8. Punti tecnici da definire nei documenti dedicati

Questi elementi **non richiedono nuove decisioni funzionali**, ma vanno progettati prima di scrivere il relativo codice:

- Gestione di più eventi e identificativi globali.
- Formato definitivo dei JSON e relativa validazione.
- Strategia di migrazione delle configurazioni e dei dati.
- Persistenza e disponibilità offline delle fotografie.
- Sincronizzazione delle eliminazioni e risoluzione dei conflitti.
- Protezione dell'URL e dei dati, considerata l'assenza di autenticazione interna.
- Limiti di archiviazione dei dispositivi e gestione della prima installazione offline.
- Strategia di generazione PDF con immagini e contenuti lunghi.

## 9. Fuori ambito per la prima versione

- Account, password, PIN e permessi applicativi per utente.
- Cloudflare Access come requisito obbligatorio iniziale (possibile estensione futura).
- Percorsi, mappe e navigazione tra stand.
- Importazione o ripristino dei dati personali da JSON tramite l'interfaccia utente; l'importazione editoriale del config in PostgreSQL è invece parte dell'architettura.
- Esportazione Excel.
- Confronto prodotti su smartphone.
- Questionari generati automaticamente per nuovi profili.
