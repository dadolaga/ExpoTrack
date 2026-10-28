# ExpoTrack — 15. Dashboard

## Aggiornamento mobile — risposte A1–A9

**Contratto vigente per il web mobile da fiera:** [specifica UI mobile, risposte A1–A9](27_Specifiche_UI_Mobile.md#10-risposte-di-revisione-recepite). Questo aggiornamento prevale sui paragrafi, diagrammi, pseudocodice e casi di test precedenti incompatibili. In particolare, gli esempi con `drafts`, conferma finale «Salva», dettaglio mobile 08, foto stand o scelta manuale del conflitto descrivono la progettazione precedente e non vanno implementati nel mobile. Le parti compatibili e le funzioni desktop/post-fiera mantengono il proprio ambito.

Esattamente quattro statistiche: stand di interesse da visitare, visitati, da rivedere, prodotti registrati validi. Fino a cinque stand di interesse con priorità e stato to_visit/revisit, ordinati priorità decrescente/nome/ID. Niente cambio evento qui né altre statistiche; budget da Profilo e 05. Contatore sync totale dispositivo, foto comprese una sola volta.


> **Documento:** `docs/15-dashboard.md`  
> **Progetto:** ExpoTrack, PWA privata offline-first per fiere; prima fiera EICMA 2026  
> **Stato:** specifica funzionale e tecnica proposta, non implementazione  
> **Dipendenze:** `03-app-config.md`, `04-profiles-config.md`, `06-categories-config.md`, `07-stands-config.md`, `08-products-config.md`, `09-interests-config.md`, `11-visit-statuses-config.md`, `12-database.md`, `13-backend-api.md`, `14-frontend-ui.md`  
> **Successivo:** `16-stand-management.md`

---

## 1. Scopo e principi

La Dashboard è la prima schermata dopo la scelta del profilo. Deve rispondere rapidamente a quattro domande: **quanti stand mi interessano ancora**, **quali devo rivedere**, **quanti prodotti ho registrato** e **quali prodotti ho segnato come preferiti**. È una vista di lavoro, non una pagina pubblicitaria o una mappa della fiera.

Principi irrinunciabili:

1. **Personale:** tutti i dati operativi sono riferiti al profilo attivo e all'evento attivo. I dati di `me` non devono mescolarsi con quelli di `father`.
2. **Offline-first:** i contatori funzionano con i dati locali confermati, anche senza rete. Le bozze non confermate non devono alterare le statistiche.
3. **Navigabile:** ogni contatore che rappresenta una collezione apre una lista già filtrata, senza inventare nuovi percorsi o mappe.
4. **Trasparente:** l'utente distingue dati locali salvati, sincronizzazione in corso, errori e conflitti.
5. **Coerente:** la Dashboard usa gli stessi selettori, regole di conteggio e filtri delle pagine Stand e Prodotti.
6. **Mobile-first:** schermata leggibile su Galaxy S25 e altri telefoni; su desktop le stesse informazioni sono disposte in griglia.
7. **Nessun requisito geografico:** ExpoTrack v1 non comprende mappe, percorsi, itinerari o stime di cammino.

### 1.1 Cosa non fa

La Dashboard non modifica direttamente i file JSON, non autentica gli utenti, non invia bozze al server, non genera raccomandazioni automatiche su stand non selezionati e non inventa ubicazioni degli espositori EICMA 2026. Non mostra statistiche di altri profili per impostazione predefinita.

---

## 2. Perimetro dei dati

Una Dashboard è sempre identificata da una coppia:

```ts
type DashboardScope = {
  profileId: string;
  eventId: string;
};
```

Il profilo viene selezionato dall'utente al primo avvio e ricordato sul dispositivo; l'evento predefinito proviene da `app.json`, ma l'architettura deve permettere più fiere. Il cambio profilo o evento invalida la vista e ricalcola **tutte** le statistiche.

### 2.1 Catalogo e interessi personali non sono la stessa cosa

Il catalogo JSON può contenere molti stand. La Dashboard deve misurare il **percorso personale**, non considerare automaticamente tutti gli espositori come stand «da visitare».

**Definizione proposta di stand monitorato:** uno stand incluso negli interessi iniziali del profilo, aggiunto esplicitamente agli interessi nell'app, creato personalmente nell'app oppure sul quale il profilo ha salvato uno stato di visita, una nota o un prodotto. L'inclusione per effetto di uno stato/note/prodotto evita che un'attività reale sparisca dai contatori, ma è una scelta da armonizzare con `09-interests-config.md`.

Per rendere questa regola robusta è consigliato un campo logico `tracked`/`isInterested` o una funzione derivata centralizzata; **non** dedurlo esclusivamente dall'esistenza di una riga `profile_stand_states`, perché lo stato `to_visit` può essere implicito.

Se un interesse seed viene rimosso volontariamente, una tombstone deve impedire che riappaia al prossimo aggiornamento del JSON. Un prodotto già salvato non deve essere cancellato: la gestione della visibilità dello stand va esplicitata nell'interfaccia.

### 2.2 Origini dei dati

| Dato | Origine | Regola |
|---|---|---|
| Profilo attivo | Preferenza locale + profili configurati/dinamici | Non è autenticazione |
| Evento attivo | `app.json` + scelta utente | ID stabile |
| Stand editoriali | JSON dell'evento | Catalogo condiviso |
| Stand personali | IndexedDB / PostgreSQL | Visibili solo al profilo proprietario |
| Interessi iniziali | `config/interests/<profileId>.json` | Seed, con override locali |
| Priorità e cose da vedere | Seed + override personali | Le modifiche confermate prevalgono |
| Stato visita | Stato personale | Default effettivo `to_visit` |
| Prodotti | Record dinamici personali | Escludere tombstone |
| Preferiti | `isFavorite` sui prodotti | Per profilo/evento |
| Budget per categoria | Profilo JSON + eventuali override | Nessun budget complessivo obbligatorio |
| Sincronizzazione | Outbox, cursor e conflitti locali | Stato visibile senza falsi successi |

---

## 3. Layout e gerarchia visiva

### 3.1 Smartphone

Ordine verticale raccomandato:

1. Header compatto con nome ExpoTrack, fiera e profilo attivo (nome, colore, eventuale icona).
2. Stato di sincronizzazione discreto ma leggibile; se ci sono errori o conflitti, evidenza e azione.
3. Titolo «La mia fiera» o «Dashboard» e breve contesto evento.
4. **Griglia 2×2** di contatori: Da visitare, Visitati, Da rivedere, Prodotti.
5. Contatore o riquadro «Preferiti» facilmente accessibile.
6. Sezione «Priorità alte» con stand monitorati più importanti non ancora visitati (opzionale v1, ma utile).
7. Sezione «Budget per categoria» **solo** se almeno un budget è configurato.
8. Azioni rapide contestuali per aprire Stand o Prodotti.
9. Navigazione inferiore fissa: **Dashboard · Stand · Prodotti · Profilo**.

Evitare card enormi, caroselli non necessari e scroll orizzontale. La barra inferiore deve rispettare le safe area dei dispositivi.

### 3.2 Desktop

Utilizzare una griglia più ampia con massimo contenuto leggibile, senza cambiare il significato dei numeri. Eventuali dettagli supplementari devono essere un miglioramento progressivo, non funzionalità indispensabili accessibili soltanto da desktop.

### 3.3 Accessibilità

Ogni card cliccabile deve avere nome e azione espliciti, ad esempio «12 stand da visitare, apri la lista filtrata». Non usare il colore come unica distinzione degli stati. Prevedere focus visibile, target touch adeguati, contrasto, supporto tastiera e annunci non invasivi dei cambi di stato della sincronizzazione.

---

## 4. Contratto dei contatori

### 4.1 Stand monitorati

Sia `S` l’insieme degli stand unici e attivi di interesse effettivo del profilo/evento, dopo seed JSON e override. La presenza di una nota/prodotto/stato non implica interesse; nuovo stand personale inizializzato di interesse. Identificare per origine/evento/ID, senza duplicare.

Per ogni stand `s`, definire:

```ts
type VisitStatus = "to_visit" | "visited" | "revisit";

function effectiveVisitStatus(
  savedStatus: VisitStatus | null | undefined,
): VisitStatus {
  return savedStatus ?? "to_visit";
}
```

I tre stati sono **mutuamente esclusivi**. La stessa visita non può essere contemporaneamente «Visitato» e «Da rivedere».

### 4.2 Formule

```text
standsToVisit = count(s ∈ S | status(s) = "to_visit")
standsVisited = count(s ∈ S | status(s) = "visited")
standsToRevisit = count(s ∈ S | status(s) = "revisit")
standsTracked = |S|

INVARIANTE:
standsToVisit + standsVisited + standsToRevisit = standsTracked
```

Il contatore «Da rivedere» è distinto da «Da visitare»: non sommare implicitamente le due categorie nel numero visualizzato come «Da visitare».

### 4.3 Prodotti

```text
productsTotal = count(prodotti attivi del profilo/evento)
productsFavorites = count(prodotti attivi con isFavorite = true)
```

Il voto generale `rating` 1–10 **non** determina il preferito: `isFavorite` è indipendente. Un prodotto con voto 10 può non essere preferito; uno preferito può non avere voto.

Prodotti cancellati (tombstone) sono esclusi. Prodotti salvati solo localmente, con operazione di sync pendente, **sono inclusi**: sono dati confermati. Input iniziali incompleti e prodotti pianificati non raccolti **non** sono inclusi.

### 4.4 Budget

Budget disponibili nell’uso in fiera via Profilo → 11a e nel contesto prodotto 05. Non aggiungere ulteriori statistiche alla Dashboard, che resta di quattro card. Non sommare prezzi osservati come spesa né creare budget totale. Matching categoria esatta; override personali per profilo/categoria condivisi tra eventi.

## 5. Navigazione dalle statistiche

| Card | Destinazione | Filtro preimpostato |
|---|---|---|
| Da visitare | Stand | `visitStatus=to_visit`, `trackedOnly=true` |
| Visitati | Stand | `visitStatus=visited`, `trackedOnly=true` |
| Da rivedere | Stand | `visitStatus=revisit`, `trackedOnly=true` |
| Prodotti | Prodotti | Profilo/evento correnti, nessun altro filtro |
| Preferiti | Prodotti | `favoritesOnly=true` |
| Priorità alte | Stand | Stand specifico o lista con priorità alta |
| Budget categoria | Prodotti | `categoryId=<id>` e discendenti solo se previsto dai filtri |

I filtri iniziali trasmessi dalla Dashboard sono **intenzionali** e visibili all'arrivo. La regola generale già concordata «reset dei filtri quando si riapre una lista» deve essere interpretata così:

- navigazione normale dal menu Stand/Prodotti → filtri resettati;
- navigazione da una card Dashboard → applicare il filtro della card;
- successiva riapertura normale → tornare ai filtri di default.

Non memorizzare permanentemente i filtri della Dashboard come preferenze globali.

### 5.1 Parametri URL proposti

```text
/stands?status=to_visit&tracked=1
/stands?status=visited&tracked=1
/stands?status=revisit&tracked=1
/products
/products?favorite=1
/products?category=helmets
```

Gli URL sono **esempi di contratto**, non rotte già implementate. Il profilo attivo non va considerato un segreto né un meccanismo di autorizzazione.

### 5.2 Stato zero

Una card con valore `0` resta leggibile. Può essere cliccabile per aprire una lista vuota con messaggio appropriato, senza generare errore o nascondere la funzione.

---

## 6. Cinque stand prioritari

Candidati: stand di interesse nel contesto attivo, priorità assegnata e stato `to_visit` o `revisit`; escludere visitati e priorità assente. Ordinare priorità decrescente, poi nome e ID. Mostrare al massimo cinque, meno se i candidati sono meno, senza riempitivi. Logo/fallback, nome, posizione verificata o non disponibile, priorità e stato testuali. Tap apre 04.

## 7. Cose da vedere: semantica

`whatToSee: string[]` è una lista di obiettivi testuali per lo stand. **Non è automaticamente una checklist completabile** e non genera domande di questionario. La Dashboard può mostrarne un'anteprima, senza inventare uno stato «fatto/non fatto» che il modello dati non possiede.

Per introdurre in futuro checkbox per singolo obiettivo servirebbero ID stabili per gli elementi, stato personale di completamento, regole di sync e migrazioni: fuori dalla v1 salvo decisione esplicita.

---

## 8. Stato di sincronizzazione

La Dashboard deve sempre consentire di capire **dove si trovano i dati**.

| Stato UI | Condizione | Messaggio consigliato |
|---|---|---|
| `synced` | Nessuna operazione pendente, ultimo sync riuscito | «Sincronizzato» |
| `local_saved` | Dati confermati localmente, sync ancora pendente | «Salvato sul dispositivo» |
| `syncing` | Invio/ricezione in corso | «Sincronizzazione in corso» |
| `offline` | Rete non disponibile | «Offline · dati disponibili sul dispositivo» |
| `failed` | Operazioni non sincronizzate per errore | «Sincronizzazione non riuscita» |
| `conflict` | Uno o più conflitti irrisolti | «Conflitti da risolvere» |
| `initial_loading` | Nessuno snapshot locale disponibile | «Preparazione dei dati» |

**Precedenza proposta:** `conflict` > `failed` > `offline` > `syncing` > `local_saved` > `synced`. Lo stato offline non deve nascondere conflitti già noti.

### 8.1 Azioni

- «Sincronizza ora»: tenta la sync delle operazioni confermate.
- «Dettagli»: apre la vista con numero di operazioni pendenti, errori e conflitti.
- «Risolvi»: apre la procedura di risoluzione manuale dei conflitti.

Non affermare «Sincronizzato» soltanto perché `navigator.onLine` è `true`. La connettività apparente non prova il successo dell'API.

### 8.2 Dopo la riapertura

Se l'app è stata chiusa offline, deve leggere i record locali e mostrare contatori senza attendere la rete. Non promettere sincronizzazione in background a browser chiuso.

---

## 9. Stati di caricamento, vuoto ed errore

### 9.1 Primo avvio senza cache e senza rete

Mostrare un messaggio chiaro: la prima inizializzazione richiede una connessione per scaricare configurazioni e dati iniziali. Non mostrare contatori a zero come se fossero dati veri.

### 9.2 Profilo nuovo

Mostrare contatori `0` per prodotti e preferiti; gli stand monitorati possono essere zero se il profilo non ha interessi seed né dati personali. Invito contestuale: «Apri il catalogo stand e aggiungi i tuoi interessi».

### 9.3 Errore di caricamento parziale

Se un dataset non è disponibile, non sostituirlo con zero senza spiegazione. Preferire un segnaposto «—» e un avviso, mantenendo visibili i dati affidabili già caricati.

### 9.4 Configurazione editoriale invalida

Conservare l'ultimo snapshot valido, se presente, e segnalare che la configurazione non è stata aggiornata. Non cancellare cache, outbox o bozze.

### 9.5 Record in conflitto

Finché il conflitto è irrisolto, la Dashboard deve indicare chiaramente che alcune modifiche non sono ancora condivise. **Proposta:** contatori basati sull'ultima versione locale confermata, con avviso che i valori potrebbero differire fra dispositivi. Evitare di sommare entrambe le versioni dello stesso record.

---

## 10. Calcolo dei dati: un solo selettore di dominio

La logica non deve essere duplicata nei componenti visivi.

```ts
type DashboardMetrics = {
  scope: { profileId: string; eventId: string };
  standsTracked: number;
  standsToVisit: number;
  standsVisited: number;
  standsToRevisit: number;
  productsTotal: number;
  productsFavorites: number;
  calculatedAt: string;
  source: "local";
};

function calculateDashboardMetrics(input: {
  trackedStandRefs: readonly string[];
  statusByStandRef: ReadonlyMap<string, VisitStatus>;
  activeProducts: readonly {
    id: string;
    isFavorite: boolean;
  }[];
  scope: DashboardScope;
}): DashboardMetrics {
  const uniqueStandRefs = [...new Set(input.trackedStandRefs)];
  const statuses = uniqueStandRefs.map(
    ref => input.statusByStandRef.get(ref) ?? "to_visit"
  );

  return {
    scope: input.scope,
    standsTracked: uniqueStandRefs.length,
    standsToVisit: statuses.filter(s => s === "to_visit").length,
    standsVisited: statuses.filter(s => s === "visited").length,
    standsToRevisit: statuses.filter(s => s === "revisit").length,
    productsTotal: input.activeProducts.length,
    productsFavorites: input.activeProducts.filter(p => p.isFavorite).length,
    calculatedAt: new Date().toISOString(),
    source: "local",
  };
}
```

**Nota:** lo snippet presume che i record siano **già filtrati** per profilo/evento e tombstone, e che `trackedStandRefs` sia già costruito applicando la semantica di interesse personale. Non passare il catalogo intero senza filtri.

### 10.1 Chiavi stand non ambigue

Per evitare collisioni fra stand personali/editoriali e fiere diverse, usare una rappresentazione canonica:

```ts
type StandRef = {
  eventId: string;
  source: "catalog" | "personal";
  standId: string;
};

function standRefKey(ref: StandRef): string {
  return JSON.stringify([ref.eventId, ref.source, ref.standId]);
}
```

La rappresentazione è illustrativa: non concatenare campi con delimitatori che potrebbero comparire negli ID senza escaping.

### 10.2 Invarianti da controllare

```ts
metrics.standsTracked ===
  metrics.standsToVisit +
  metrics.standsVisited +
  metrics.standsToRevisit;

metrics.productsFavorites <= metrics.productsTotal;
```

Se un'invariante fallisce, è un problema di dominio/dati, non un motivo per correggere silenziosamente i numeri nella UI.

---

## 11. Aggiornamento reattivo

I contatori devono aggiornarsi quando:

- cambia il profilo o l'evento;
- viene aggiunto/rimosso un interesse personale;
- viene creato/eliminato uno stand personale;
- cambia uno stato visita;
- viene creato/eliminato un prodotto;
- cambia il flag preferito;
- arriva un aggiornamento server compatibile;
- si risolve un conflitto.

**Non** aggiornare le statistiche con una bozza non salvata. Quando l'utente preme **Salva**, l'aggiornamento deve avvenire subito dopo il commit locale, senza attendere la risposta server.

### 11.1 Evitare contatori divergenti

Non mantenere contatori incrementali separati come unica fonte di verità. Ricavarli dai record attivi tramite selettori, eventualmente con cache invalidabile. Per una piccola app privata, la correttezza è più importante della micro-ottimizzazione.

### 11.2 Transazioni

Se un salvataggio modifica insieme un prodotto e la sua outbox, la Dashboard deve vedere uno stato coerente dopo la transazione IndexedDB, non una fase intermedia con prodotto visibile ma operazione mancante.

---

## 12. Proposta di struttura componenti

```text
src/
├── app/
│   └── (app)/
│       └── dashboard/
│           └── page.tsx
├── features/
│   └── dashboard/
│       ├── components/
│       │   ├── DashboardHeader.tsx
│       │   ├── MetricsGrid.tsx
│       │   ├── MetricCard.tsx
│       │   ├── PriorityStandsPreview.tsx
│       │   ├── CategoryBudgetsPreview.tsx
│       │   ├── DashboardEmptyState.tsx
│       │   └── SyncStatusSummary.tsx
│       ├── hooks/
│       │   └── useDashboardData.ts
│       ├── selectors/
│       │   ├── selectTrackedStands.ts
│       │   ├── calculateDashboardMetrics.ts
│       │   └── selectPriorityStands.ts
│       └── types.ts
└── shared/
    └── components/
        └── BottomNavigation.tsx
```

I percorsi sono **proposti**, non una modifica effettiva alla struttura del repository. Verificare la coerenza con `02-project-structure.md` prima di implementarli.

### 12.1 Responsabilità

- `page.tsx`: composizione della pagina e controllo del perimetro.
- `useDashboardData`: lettura reattiva di IndexedDB e stato di disponibilità.
- `selectTrackedStands`: unificazione delle origini e applicazione di interessi/tombstone.
- `calculateDashboardMetrics`: funzione pura e testabile.
- `MetricsGrid`: presentazione e navigazione, nessuna logica di conteggio.
- `SyncStatusSummary`: stato sync proveniente dal modulo sincronizzazione, non da euristiche UI.

---

## 13. Contratti TypeScript suggeriti

```ts
interface DashboardStandPreview {
  ref: StandRef;
  name: string;
  priority: number | null;
  visitStatus: VisitStatus;
  hallName: string | null;
  categories: string[];
  whatToSeePreview: string[];
}

interface CategoryBudgetPreview {
  categoryId: string;
  categoryName: string;
  budgetAmountMinor: number;
  currency: "EUR";
  productCount: number;
}

type DashboardLoadState =
  | { kind: "loading" }
  | { kind: "ready"; metrics: DashboardMetrics }
  | { kind: "stale"; metrics: DashboardMetrics; reason: string }
  | { kind: "error"; reason: string };
```

La tipizzazione della moneta in `number` è accettabile in UI soltanto se i valori restano nell'intervallo intero sicuro JavaScript; lato DB è previsto `bigint`. Per importi superiori, usare serializzazione decimale e conversione controllata.

---

## 14. Privacy e assenza di login

Il profilo selezionato è una **preferenza di visualizzazione**, non un'identità verificata. Chi accede all'app può potenzialmente selezionare un altro profilo. Non presentare il cambio profilo come misura di privacy o autorizzazione.

Il Cloudflare Tunnel fornisce connettività, non autenticazione. Un eventuale Cloudflare Access è un controllo di perimetro distinto e va valutato nel documento `25-security.md`.

Non registrare note, risposte ai questionari o nomi di fotografie nei log di analytics. Non sono necessari servizi analytics esterni per la Dashboard privata.

---

## 15. Performance

### 15.1 Obiettivi qualitativi

- Primo rendering con dati locali disponibili senza attendere la rete.
- Nessun caricamento delle foto originali per disegnare i contatori.
- Calcolo delle statistiche con selettori memoizzati o query IndexedDB indicizzate.
- Nessuna query server a ogni apertura se lo snapshot locale è già valido.
- Gestione di decine/centinaia di stand e prodotti senza scatti percepibili.

### 15.2 Aggiornamenti

Usare sottoscrizioni agli store locali o invalidazione mirata, non polling continuo. Quando si sincronizzano molti record, applicare batch coerenti e ricalcolare al termine della transazione.

### 15.3 Caricamento delle anteprime

Per gli stand prioritari usare solo testo e metadati. Le foto, se introdotte in futuro nella Dashboard, devono essere miniature e caricate in modo differito.

---

## 16. Esempi funzionali

### 16.1 Profilo «Io»

**Dati puramente dimostrativi, non dati EICMA verificati:** 6 stand monitorati, di cui 3 da visitare, 2 visitati e 1 da rivedere; 4 prodotti salvati, di cui 2 preferiti.

La Dashboard visualizza `3 / 2 / 1 / 4 / 2` nelle rispettive card. Premendo «Da rivedere» si apre la lista Stand con un solo risultato. Le priorità 10 e 9, se associate a stand non ancora visitati, compaiono in «Da vedere per primi».

### 16.2 Profilo «Papà»

Lo stesso stand editoriale può essere `visited` per `me` e `to_visit` per `father`. Il cambio profilo aggiorna immediatamente i contatori, le anteprime e le destinazioni dei link. Non si deve vedere il prodotto preferito del profilo precedente.

### 16.3 Nuovo prodotto offline

Il profilo crea un prodotto mentre non c'è rete. Prima di Salva, la Dashboard non cambia. Dopo Salva, `productsTotal` aumenta immediatamente di uno e compare «Salvato sul dispositivo». Dopo il sync riuscito, il numero resta invariato e lo stato diventa «Sincronizzato».

### 16.4 Conflitto

Due dispositivi modificano lo stesso stato stand a partire dalla stessa revisione. La Dashboard del dispositivo B può mostrare il proprio ultimo stato confermato localmente, ma deve segnalare «Conflitto da risolvere» e non dichiarare sincronizzazione completata.

### 16.5 Catalogo senza interessi

Il JSON dell'evento contiene 100 stand; il profilo nuovo non ha interessi né attività. La Dashboard mostra **0 stand monitorati**, non 100 «Da visitare». La pagina Stand continua a permettere di sfogliare il catalogo completo.

---

## 17. Gestione delle priorità

Le priorità degli stand sono numeri interi da **1 a 10**, dove 10 indica l'interesse più alto. Non vanno confuse con:

- voto 1–10 di un prodotto;
- risposte rating 1–10 di un questionario;
- stato di visita;
- preferito di un prodotto.

Uno stand può essere di priorità 10 e già visitato: rimane nei conteggi «Visitati» ma non necessariamente nella sezione «Da vedere per primi». Una priorità mancante è `null`, non zero.

---

## 18. Budget: specifica prudente

### 18.1 Quando mostrare la sezione

Solo se il profilo ha almeno un budget configurato e la categoria esiste ancora nello snapshot editoriale valido. Non mostrare un contenitore vuoto senza significato.

### 18.2 Rappresentazione

Esempio illustrativo:

```text
Caschi integrali       Budget: € 350
Guanti moto            Budget: € 150
```

Nessun budget globale, nessuna somma automatica dei budget di categorie annidate. Il numero di prodotti salvati nella categoria può essere un indicatore aggiuntivo, purché la regola di inclusione delle sottocategorie sia coerente con la pagina Prodotti.

### 18.3 Prezzo non equivale a spesa

Il prezzo di un prodotto osservato in fiera è un'informazione raccolta, non una transazione. La Dashboard non deve presentare la somma dei prezzi come denaro «speso» senza una funzione separata di acquisto, non prevista nella v1.

---

## 19. Errori e telemetria locale

Eventi tecnici utili per debug, senza inviare contenuti personali:

- fallimento lettura IndexedDB;
- snapshot JSON non valido;
- contatori con invarianti violate;
- errore di sincronizzazione;
- conflitto rilevato;
- fallimento di navigazione;
- quota locale esaurita.

Non tracciare nomi di prodotti, note, questionari o fotografie in log accessibili a terzi. Se si usa logging server, applicare redazione dei payload.

---

## 20. Matrice dei test funzionali

| ID | Scenario | Risultato atteso |
|---|---|---|
| DASH-01 | Primo accesso con profilo selezionato | Dashboard del profilo corretto |
| DASH-02 | Cambio da `me` a `father` | Tutti i contatori ricalcolati |
| DASH-03 | Cambio evento | Dati dell'evento selezionato |
| DASH-04 | Catalogo con 100 stand, zero interessi | Zero stand monitorati |
| DASH-05 | Stand in interessi seed | Incluso nei monitorati |
| DASH-06 | Stand personale appena salvato | Incluso nei monitorati |
| DASH-07 | Stand con prodotto ma senza seed | Gestito dalla regola monitorati |
| DASH-08 | Stand senza stato esplicito | `to_visit` |
| DASH-09 | Stato `visited` | Solo contatore Visitati |
| DASH-10 | Stato `revisit` | Solo contatore Da rivedere |
| DASH-11 | Stato `to_visit` | Solo contatore Da visitare |
| DASH-12 | Doppio riferimento allo stesso stand | Conteggiato una volta |
| DASH-13 | Stand personale eliminato | Escluso dopo regole di integrità |
| DASH-14 | Prodotto salvato | Aumenta Prodotti |
| DASH-15 | Prodotto solo in bozza | Non aumenta Prodotti |
| DASH-16 | Prodotto con sync pendente | Incluso in Prodotti |
| DASH-17 | Prodotto eliminato | Escluso da Prodotti |
| DASH-18 | Preferito impostato | Aumenta Preferiti |
| DASH-19 | Preferito rimosso | Diminuisce Preferiti |
| DASH-20 | Voto 10 ma non preferito | Non aumenta Preferiti |
| DASH-21 | Card Da visitare | Apre lista filtrata corretta |
| DASH-22 | Card Visitati | Apre lista filtrata corretta |
| DASH-23 | Card Da rivedere | Apre lista filtrata corretta |
| DASH-24 | Card Prodotti | Apre lista prodotti del profilo |
| DASH-25 | Card Preferiti | Apre prodotti preferiti |
| DASH-26 | Menu Stand dopo filtro Dashboard | Filtri resettati |
| DASH-27 | Menu Prodotti dopo filtro Preferiti | Filtri resettati |
| DASH-28 | Card con valore zero | Navigazione e stato vuoto corretti |
| DASH-29 | Priorità 10 e 1 | 10 prima di 1 |
| DASH-30 | Priorità mancante | Nessun valore 0 inventato |
| DASH-31 | Stand già visitato con priorità 10 | Escluso dai prossimi da vedere |
| DASH-32 | `whatToSee` | Mostrata come testo, non checklist |
| DASH-33 | Padiglione sconosciuto | Nessuna posizione inventata |
| DASH-34 | Budget non configurati | Sezione nascosta |
| DASH-35 | Budget per categoria | Valore corretto, senza totale fittizio |
| DASH-36 | Prezzo prodotto | Non indicato come spesa effettiva |
| DASH-37 | App offline con cache | Contatori disponibili |
| DASH-38 | Primo avvio offline senza cache | Messaggio inizializzazione, non zeri |
| DASH-39 | Modifica bozza | Contatori invariati |
| DASH-40 | Salva offline | Contatori aggiornati subito |
| DASH-41 | Sync riuscito | Numeri invariati, stato sincronizzato |
| DASH-42 | Sync fallito | Dati locali visibili e avviso |
| DASH-43 | Conflitto aperto | Indicatore conflitto visibile |
| DASH-44 | Due versioni dello stesso record | Non sommate |
| DASH-45 | Aggiornamento JSON invalido | Ultimo snapshot valido preservato |
| DASH-46 | Dato parziale indisponibile | Segnaposto, non falso zero |
| DASH-47 | Stato online senza API raggiungibile | Non dichiarare sincronizzato |
| DASH-48 | Tap ripetuto su Sincronizza | Nessuna duplicazione operazioni |
| DASH-49 | Profilo cambiato durante sync | Nessuna contaminazione UI |
| DASH-50 | Eliminazione seed interesse con override | Nessuna resurrezione involontaria |
| DASH-51 | Invariante somma stati | Sempre uguale agli stand monitorati |
| DASH-52 | Invariante preferiti | Preferiti ≤ prodotti |
| DASH-53 | Navigazione tastiera | Tutte le card raggiungibili |
| DASH-54 | Screen reader | Etichette e azioni comprensibili |
| DASH-55 | Viewport mobile piccolo | Nessuno scroll orizzontale |
| DASH-56 | Safe area mobile | Bottom nav non copre contenuti |
| DASH-57 | Tema/colore profilo | Contrasto e testo leggibili |
| DASH-58 | Riavvio browser | Profilo ricordato e dati offline |
| DASH-59 | Foto pesanti nel catalogo | Contatori senza caricare originali |
| DASH-60 | Dataset medio/grande | UI reattiva e senza duplicati |

---

## 21. Test unitari di dominio

### 21.1 Set minimo

```ts
const statuses = new Map([
  ["a", "to_visit"],
  ["b", "visited"],
  ["c", "revisit"],
]);

// tracked = ["a", "b", "c", "c", "d"]
// "d" non ha stato e quindi è to_visit
// Risultato: tracked=4, toVisit=2, visited=1, revisit=1.
```

Verificare inoltre:

- lista stand vuota;
- lista prodotti vuota;
- duplicati e tombstone;
- preferiti non superiori ai prodotti;
- stand catalogo omonimi ma ID differenti;
- stand con stesso ID testuale in eventi diversi;
- profili differenti con lo stesso stand;
- cambio rapido profilo/evento;
- ordinamento stabile a parità di priorità;
- budget categorie padre/figlia senza doppia somma.

### 21.2 Test di integrazione

Simulare IndexedDB con record locali e outbox; verificare che una modifica in bozza non cambi i contatori, mentre un commit locale sì. Simulare una risposta server conflittuale senza sovrascrivere i dati locali.

### 21.3 Test end-to-end

Percorso principale: selezione profilo → Dashboard → card Da visitare → dettaglio stand → cambio stato → Salva offline → ritorno Dashboard → contatore aggiornato → ritorno online → sync riuscito.

Percorso alternativo: Dashboard → Preferiti → prodotto → modifica preferito → Salva → ritorno Dashboard → numero aggiornato.

---

## 22. Criteri di accettazione

- [ ] Dashboard visibile subito dopo la scelta profilo.
- [ ] Ogni dato è limitato al profilo e all'evento correnti.
- [ ] Il catalogo completo non viene confuso con gli interessi personali.
- [ ] Gli stand monitorati sono contati una sola volta.
- [ ] Le tre categorie di visita sono esclusive ed esaustive per gli stand monitorati.
- [ ] L'assenza di uno stato esplicito equivale a `to_visit`.
- [ ] Prodotti e preferiti escludono le tombstone e le bozze non salvate.
- [ ] I prodotti confermati offline sono inclusi nei contatori.
- [ ] Ogni card apre la lista pertinente con filtro visibile.
- [ ] La navigazione normale ripristina i filtri predefiniti.
- [ ] Le priorità personali non sono confuse con voti prodotto o questionari.
- [ ] La lista `whatToSee` non è trattata come checklist senza modello dedicato.
- [ ] I budget sono mostrati solo per categoria e non come spesa effettiva.
- [ ] Nessuna posizione EICMA è inventata.
- [ ] Lo stato di sync distingue salvataggio locale e sincronizzazione server.
- [ ] I conflitti sono visibili e non risolti automaticamente.
- [ ] La Dashboard resta utilizzabile offline dopo il bootstrap.
- [ ] Le bozze non confermate non alterano le statistiche.
- [ ] Le modifiche confermate aggiornano i numeri senza aspettare la rete.
- [ ] La UI è mobile-first, accessibile e senza scroll orizzontale.
- [ ] I test di conteggio, navigazione, offline e cambio profilo sono superati.

---

## 23. Decisioni ancora aperte

| Questione | Proposta attuale | Impatto |
|---|---|---|
| Quali stand sono monitorati? | Seed + aggiunti esplicitamente + personali + attività confermata | Coerenza Dashboard/Stand |
| Rimozione interesse con prodotti esistenti | Preservare prodotti e consentire accesso allo stand | Integrità storica |
| Priorità alte: `revisit` vs `to_visit` | Pari priorità ordinare per nome; nessun peso nascosto | Anteprima |
| Budget e prezzi | Mostrare budget; non chiamare i prezzi «spesa» | UX e correttezza |
| Budget padre/figlia | Nessuna somma automatica | Aggregazioni |
| Stato in caso di conflitto | Mostrare ultimo locale confermato con avviso | UX sync |
| Numero stand in anteprima | 3–5, con Vedi tutti | Responsive |
| Eventuali grafici | Non necessari in v1 | Complessità |

Queste decisioni vanno riconciliate con i documenti di dominio prima dell'implementazione. In particolare, la definizione di «stand monitorato» deve essere identica nella Dashboard e nella pagina Stand.

---

## 24. Collegamenti alla documentazione successiva

- **`16-stand-management.md`**: gestione catalogo, interessi, filtri, stati, note e stand personali.
- **`17-product-management.md`**: creazione prodotti, preferiti, categoria immutabile e prezzi.
- **`19-offline-storage.md`**: lettura reattiva IndexedDB, transazioni e gestione quota.
- **`20-synchronization.md`**: outbox, revisione, indicatori e conflitti.
- **`22-comparison.md`**: confronto prodotti su desktop, distinto dalla Dashboard.
- **`23-export.md`**: esportazioni JSON/PDF per profilo.
- **`26-testing.md`**: test end-to-end e criteri globali.

**Il prossimo documento da produrre è `docs/16-stand-management.md`.**
