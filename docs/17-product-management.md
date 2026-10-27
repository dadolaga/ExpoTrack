# 17 — Gestione prodotti

> **ExpoTrack** · Specifica funzionale e tecnica · Versione proposta v1  
> **File:** `docs/17-product-management.md`  
> **Prerequisiti:** `07-stands-config.md`, `06-categories-config.md`, `08-products-config.md`, `10-questionnaires-config.md`, `12-database.md`, `13-backend-api.md`, `14-frontend-ui.md`, `16-stand-management.md`  
> **Segue:** `docs/18-questionnaire-engine.md`

---

## 1. Scopo e confini

Questo documento descrive il ciclo di vita di un **prodotto osservato durante una fiera**: dalla creazione presso uno stand alla modifica, valutazione, raccolta di foto, compilazione del questionario, confronto e successiva esportazione. Il progetto pilota è **EICMA 2026**, ma ogni prodotto appartiene a un evento e a un profilo, senza presupporre che il catalogo sia limitato alle moto.

Il prodotto è **un'osservazione personale**, non un articolo del catalogo editoriale degli espositori e non un acquisto o una transazione economica. Non è previsto `config/products.json`: i prodotti nascono dall'interfaccia, sono memorizzati in IndexedDB e, quando possibile, sincronizzati con PostgreSQL.

### 1.1 Requisiti consolidati

- Profilo selezionato senza account (`me`, `father`, o profilo dinamico); prodotti isolati logicamente per profilo.
- Ogni prodotto appartiene a **un solo evento**, **uno stand** e **una sola categoria/sottocategoria**.
- La categoria è scelta manualmente e diventa **immutabile dal primo Salva esplicito**, anche offline.
- Nome obbligatorio; prezzo singolo facoltativo; valutazione generale indipendente facoltativa da 1 a 10; preferito sì/no; note libere; più fotografie.
- Questionario facoltativo, derivato dal profilo e dalla categoria del prodotto, senza domande comuni o obbligatorie.
- Autosalvataggio della **bozza locale** a ogni cambiamento; **Salva** conferma il dato localmente e lo inserisce nella coda di sincronizzazione.
- Modifica di campi consentiti e cancellazione con conferma.
- Confronto affiancato **solo desktop**, fra prodotti della stessa categoria.
- Ricerca e filtri; accesso dal dettaglio stand e dalla sezione Prodotti.
- Foto e record confermati consultabili offline dopo la corretta persistenza locale.
- Conflitti sullo stesso profilo da dispositivi diversi gestiti manualmente, preservando entrambe le versioni.

### 1.2 Fuori ambito

- E-commerce, ordini, pagamento, carrelli, stock e magazzino.
- Scansione automatica di codici a barre o identificazione AI.
- Import di prodotti da file o da siti dei produttori.
- Riconciliazione automatica di prodotti apparentemente identici osservati in stand diversi.
- Comparazione mobile affiancata (potrà essere valutata in una versione futura).
- Mappe, itinerari o navigazione nei padiglioni.
- Cambiamento della categoria di un prodotto già confermato.

---

## 2. Vocabolario di dominio

| Termine | Definizione |
|---|---|
| Prodotto | Osservazione creata da un profilo in uno stand durante un evento. |
| Stand di origine | Stand editoriale condiviso oppure stand personale creato dal profilo. |
| Categoria | ID stabile nel JSON globale delle categorie, uno per prodotto. |
| Bozza | Modifiche locali non ancora confermate tramite Salva. |
| Salvato sul dispositivo | Dato confermato in IndexedDB, con mutazione in outbox. |
| Sincronizzato | Mutazione accettata dal server e presente in PostgreSQL. |
| Valutazione generale | Voto opzionale 1–10 sul prodotto, distinto dalle risposte ai questionari. |
| Preferito | Flag booleano per il profilo proprietario. |
| Foto | File multimediale con metadati e gestione upload separata. |
| Conflitto | Modifica locale basata su revisione non più corrente sul server. |

**Distinzioni cruciali:** la priorità 1–10 è dello **stand** e non del prodotto; il voto 1–10 è del **prodotto**; una risposta di tipo `rating` a una domanda è una terza valutazione indipendente. Il prezzo osservato non equivale a una spesa sostenuta.

---

## 3. Modello dei dati

### 3.1 Tipo TypeScript di dominio

```ts
type ProfileId = string;
type EventId = string;
type CategoryId = string;
type ProductId = string; // UUID generabile offline

type StandRef =
  | { source: "catalog"; eventId: EventId; standId: string }
  | { source: "personal"; eventId: EventId; standId: string };

interface ObservedProduct {
  id: ProductId;
  profileId: ProfileId;
  eventId: EventId;
  stand: StandRef;
  name: string;
  categoryId: CategoryId;
  price: { amountMinor: number; currency: "EUR" } | null;
  rating: number | null; // intero 1..10
  favorite: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
  revision: number | null; // null finché non sincronizzato
  deletedAt: string | null;
}
```

La rappresentazione `amountMinor` in centesimi è **una proposta tecnica** coerente con `12-database.md`. In un sistema che supporti importi oltre il range sicuro di JavaScript, usare una stringa decimale validata invece di `number`. La valuta iniziale è EUR; l'estensione multivaluta richiede una decisione esplicita.

### 3.2 Dati non incorporati nel record principale

Le foto e le risposte al questionario sono entità collegate, con revisioni, persistenza e sincronizzazione proprie. Non salvare blob fotografici in un campo JSON del prodotto.

```ts
interface ProductPhotoRef {
  id: string;
  productId: ProductId;
  profileId: ProfileId;
  eventId: EventId;
  mimeType: string;
  byteSize: number;
  localBlobKey?: string;
  remoteStorageKey?: string;
  syncStatus: "local" | "uploading" | "synced" | "failed";
}

interface ProductQuestionnaireRef {
  productId: ProductId;
  questionnaireId: string;
  questionnaireVersion: number;
  answers: Record<string, unknown>;
}
```

Gli identificatori delle domande e le relative definizioni devono essere validati con `10-questionnaires-config.md`; la gestione approfondita è in `18-questionnaire-engine.md`.

### 3.3 Proprietà immutabili e modificabili

| Campo | Creazione | Dopo primo Salva | Motivazione |
|---|---|---|---|
| `id` | Generato localmente | Immutabile | Identità/sync |
| `profileId` | Dal profilo attivo | Immutabile | Isolamento |
| `eventId` | Evento corrente | Immutabile | Perimetro |
| `stand` | Stand scelto | **Proposta:** immutabile | Integrità delle osservazioni |
| `categoryId` | Scelta manuale | **Immutabile, requisito** | Questionari e confronti |
| `name` | Obbligatorio al Salva | Modificabile | Correzioni |
| `price` | Facoltativo | Modificabile/azzerabile | Prezzo osservato |
| `rating` | Facoltativo | Modificabile/rimuovibile | Giudizio |
| `favorite` | Default `false` | Modificabile | Preferenze |
| `notes` | Default vuoto | Modificabili | Annotazioni |
| Foto | 0..N | Aggiungibili/rimuovibili | Documentazione |
| Risposte | Facoltative | Modificabili | Valutazione strutturata |

**Decisione aperta:** l'immutabilità dello stand dopo il primo Salva è consigliata, ma non era un requisito esplicitamente confermato. Se si decide di permettere lo spostamento, va specificata la gestione di proprietà, foto, filtri e sync. Non introdurre una funzione di riassegnazione senza decisione.

---

## 4. Relazioni e isolamento per profilo

Ogni prodotto è personale: anche se due profili osservano lo stesso modello presso lo stesso stand, i prodotti sono due record indipendenti. Un profilo non può modificare il prodotto dell'altro attraverso i normali flussi UI.

**Limite di sicurezza:** poiché non esiste autenticazione interna, la selezione del profilo fornisce isolamento **logico e organizzativo**, non prova dell'identità reale. Cloudflare Tunnel non equivale ad autenticazione; valutare Cloudflare Access per proteggere l'app privata.

### 4.1 Collegamento allo stand

- Uno stand `catalog` deve esistere nello snapshot editoriale dell'evento.
- Uno stand `personal` deve esistere, appartenere allo stesso profilo e non essere eliminato.
- La scheda prodotto mostra il nome corrente dello stand; non duplicarlo come campo autoritativo.
- Se il nome dello stand cambia senza cambiare ID, il collegamento rimane valido.
- Se una configurazione elimina uno stand ancora referenziato, non cancellare automaticamente i prodotti: usare la strategia di migrazione/compatibilità.

### 4.2 Collegamento alla categoria

La categoria deve esistere in `categories.json`, con ID globale stabile. È ammessa una categoria padre o foglia **se il modello categorie consente la selezione di nodi non foglia**; questa scelta va verificata nel documento `06-categories-config.md` prima di finalizzare la UI.

Le sottocategorie non sono categorie multiple: il prodotto ha un solo `categoryId`, e la gerarchia serve a navigazione, filtri e aggregazione.

---

## 5. Punti di ingresso e navigazione

### 5.1 Da uno stand

Nel dettaglio stand, azione primaria **Aggiungi prodotto**. Il modulo apre con evento e stand già selezionati. Il profilo è quello attivo e non modificabile dal modulo.

### 5.2 Dalla sezione Prodotti

Nella tab Prodotti, pulsante **Nuovo prodotto**. Prima del primo Salva l'utente deve scegliere uno stand valido e una categoria. La lista degli stand include quelli editoriali visibili e quelli personali del profilo corrente.

### 5.3 Da dashboard

I contatori prodotti e preferiti aprono la lista prodotti con filtro pertinente. I filtri di navigazione possono essere trasmessi come stato temporaneo, ma quando la sezione viene riaperta autonomamente si applica la regola generale di **reset di filtri e ordinamenti**.

### 5.4 Indietro e cambio profilo

Se esiste una bozza non confermata, avvisare prima di lasciare il modulo. La bozza rimane associata al profilo/evento/prodotto originari, anche quando si cambia profilo.

---

## 6. Flusso di creazione

1. L'utente seleziona profilo ed evento.
2. Apre uno stand oppure avvia **Nuovo prodotto** dalla sezione Prodotti.
3. Il client genera un UUID offline e crea una bozza locale.
4. L'utente inserisce il nome e seleziona **manualmente** una categoria.
5. Può aggiungere prezzo, voto, preferito, note, foto e risposte facoltative.
6. Ogni modifica aggiorna la bozza in IndexedDB.
7. L'utente preme **Salva**.
8. Il client valida nome, categoria, stand, valori numerici e riferimenti.
9. Una transazione IndexedDB conferma prodotto, dati associati e mutazione in outbox secondo il loro ordine di dipendenza.
10. La UI mostra **Salvato sul dispositivo**; il prodotto compare immediatamente nelle liste.
11. Se la rete è disponibile, la sync tenta di inviare i dati al server.
12. Solo dopo conferma server la UI mostra **Sincronizzato**.

**Non** creare automaticamente un prodotto server quando il modulo viene aperto. La bozza non è un prodotto confermato.

### 6.1 Esempio di prodotto fittizio

```json
{
  "id": "5f3e30bb-2e2e-4a90-8e0a-c98411b8c46f",
  "profileId": "me",
  "eventId": "eicma-2026",
  "stand": {
    "source": "catalog",
    "eventId": "eicma-2026",
    "standId": "demo-stand"
  },
  "name": "Prodotto dimostrativo",
  "categoryId": "naked-motorcycles",
  "price": { "amountMinor": 759000, "currency": "EUR" },
  "rating": 8,
  "favorite": true,
  "notes": "Verificare ergonomia e posizione in sella"
}
```

**Esempio puramente illustrativo:** `demo-stand` non è uno stand EICMA verificato, né un padiglione/numero stand ufficiale. Il prezzo non è un listino verificato e non va caricato come dato reale.

---

## 7. Validazione dei campi

### 7.1 Nome

- Obbligatorio al primo Salva e ai salvataggi successivi.
- Applicare `trim()`; una stringa di soli spazi è invalida.
- Proposta: lunghezza massima 200 caratteri Unicode dopo normalizzazione; definire limite comune client/server.
- Non dedurre il nome da foto o da stand; l'utente lo inserisce.

### 7.2 Categoria

- Esattamente una, scelta esplicitamente.
- Validare ID contro lo snapshot editoriale corrente.
- La categoria non può essere alterata da richieste API, modifiche IndexedDB successive o replay di operazioni.
- Una modifica della categoria **prima** del primo Salva è consentita.
- Dopo il primo Salva, se è stata scelta la categoria sbagliata, il flusso prudente è **creare un nuovo prodotto** e cancellare quello errato con conferma. Non duplicare automaticamente foto o note senza una funzione esplicita.

### 7.3 Prezzo

- Facoltativo: `null` significa **non rilevato**.
- `0` è un valore valido e distinto da assente.
- Non accettare valori negativi, `NaN`, `Infinity` o più di due cifre decimali in EUR.
- In input UI italiano, visualizzare `1.234,50 €`; serializzare in centesimi.
- Non calcolare conversioni valuta o sconti impliciti.
- Non sommare prezzi come se fossero spese effettive.

### 7.4 Voto

- Facoltativo: `null` indica nessuna valutazione.
- Solo interi nell'intervallo inclusivo 1–10.
- Rimuovere un voto significa riportarlo a `null`, non a `0`.
- Il voto generale non è media automatica delle risposte del questionario.

### 7.5 Preferito

- Booleano `true`/`false`, default `false`.
- Non influenza automaticamente il voto o la priorità dello stand.
- Se aggiornato con azione rapida, deve rispettare la semantica di Salva: **proposta v1** di salvare esplicitamente l'azione rapida come commit locale confermato, con feedback chiaro; alternativa è richiedere il pulsante Salva nel dettaglio. Decidere in UI prima di implementare.

### 7.6 Note

- Campo testo multilinea, facoltativo, può essere vuoto.
- Preservare gli a capo.
- Proposta: limite 20.000 caratteri per prevenire payload anomali.
- Non interpretare HTML inserito dall'utente come markup eseguibile.

### 7.7 Foto

- Zero o più, senza numero massimo fissato nel requisito.
- Definire limiti tecnici per dimensione e formati supportati in `21-photo-management.md`.
- Non considerare una foto salvata offline se il blob non è stato scritto correttamente nello storage locale.

---

## 8. Editor e stati dell'interfaccia

### 8.1 Layout mobile-first

Proposta di ordine dei campi:

1. Intestazione con nome stand, evento e profilo attivo.
2. Nome prodotto.
3. Categoria/sottocategoria con gerarchia navigabile.
4. Prezzo (opzionale).
5. Valutazione 1–10 (opzionale).
6. Preferito.
7. Note.
8. Fotografie.
9. Questionario, se disponibile.
10. Azioni **Salva** e **Annulla/Indietro**.

Il pulsante Salva deve essere raggiungibile facilmente su smartphone, senza coprire i controlli o la navigazione inferiore. Evitare componenti pesanti: React/Next.js, TypeScript, Tailwind e componenti personalizzati.

### 8.2 Categoria bloccata

Dopo il primo Salva, mostrare la categoria come testo o selettore disabilitato, con spiegazione breve: «La categoria non può essere modificata dopo il primo salvataggio».

### 8.3 Stato dati

Mostrare in modo comprensibile:

- **Bozza**: modifiche non confermate.
- **Salvato sul dispositivo**: commit IndexedDB riuscito, sync pendente.
- **Sincronizzazione in corso**.
- **Sincronizzato**: conferma server.
- **Errore di sincronizzazione**: dato locale conservato.
- **Conflitto da risolvere**: versioni disponibili.

Non confondere «connessione disponibile» con «dato sincronizzato».

### 8.4 Errori di validazione

Errori accanto al campo; focus sul primo campo non valido. Non cancellare i dati inseriti. Per errori IndexedDB, mostrare messaggio esplicito senza affermare che il dato è salvato.

---

## 9. Elenco prodotti

### 9.1 Contenuto della scheda

Ogni scheda mostra almeno nome, categoria, stand, eventuale prezzo, voto, preferito, anteprima foto se presente e stato di sync quando rilevante.

### 9.2 Filtri

- Ricerca per nome prodotto.
- Evento corrente.
- Categoria/sottocategoria; selezionare una categoria padre può includere i discendenti secondo la regola definita in `06-categories-config.md`.
- Stand.
- Preferiti.
- Con voto / senza voto, se utile.
- Con prezzo / senza prezzo, se utile.

Non introdurre filtri non supportati dal modello dati (es. disponibilità a magazzino).

### 9.3 Ordinamenti

Proposta: nome A–Z/Z–A, prezzo crescente/decrescente, voto crescente/decrescente, più recenti/meno recenti. Per valori nulli, collocarli **sempre in fondo** in entrambe le direzioni; usare ID come tie-breaker per ordine deterministico.

I filtri e l'ordinamento tornano ai valori predefiniti quando si riapre la sezione autonomamente, come previsto nella progettazione dell'interfaccia.

### 9.4 Empty state

- Nessun prodotto registrato: invito ad aggiungerne uno.
- Nessun risultato dei filtri: pulsante per azzerare i filtri.
- Offline senza catalogo iniziale: messaggio che il bootstrap richiede una prima connessione.

### 9.5 Dati cancellati

I prodotti con tombstone non compaiono nell'elenco normale, ma la loro eliminazione deve propagarsi ai dispositivi offline durante la sync.

---

## 10. Dettaglio prodotto

Il dettaglio è la fonte UI per consultare tutti i dati confermati:

- nome, categoria, stand ed evento;
- prezzo, voto generale, preferito e note;
- galleria fotografica;
- questionario compilato, se presente;
- stato di sincronizzazione e possibili conflitti;
- azioni **Modifica** ed **Elimina**.

Non mostrare risposte inventate quando il questionario non è stato compilato. Se il JSON della categoria non definisce un questionario per il profilo, omettere del tutto la relativa sezione, invece di mostrare un modulo vuoto.

### 10.1 Dati derivati

La UI può mostrare il percorso gerarchico della categoria, ad esempio `Moto › Naked`, ma non deve memorizzarlo come unica fonte della categoria: usare `categoryId`.

### 10.2 Prodotto associato a stand non più disponibile

Mostrare un'indicazione di riferimento storico/non risolto, mantenendo nome prodotto, note e foto. Non eliminare automaticamente il record.

---

## 11. Modifica prodotto

1. Caricare il record confermato e la sua revisione.
2. Creare o riaprire una bozza locale separata.
3. Consentire modifica dei campi ammessi; categoria bloccata.
4. Autosalvare la bozza mentre l'utente digita.
5. Con **Salva**, validare e confermare localmente.
6. Inserire una mutazione in outbox con la revisione base.
7. Mostrare immediatamente la nuova versione locale.
8. Sincronizzare quando possibile; se la revisione server è cambiata, avviare il flusso di conflitto.

**Proposta:** bloccare anche il riferimento allo stand, per coerenza con il dato osservato. La scelta è da approvare.

### 11.1 Nessuna modifica effettiva

Se il contenuto normalizzato è identico alla versione confermata, evitare una mutazione inutile e chiudere la bozza in modo sicuro.

### 11.2 Modifiche a foto e questionario

Foto e risposte possono richiedere operazioni separate e dipendenti. L'interfaccia deve mostrare un risultato coerente: prodotto salvato localmente non significa automaticamente foto già caricata sul server.

---

## 12. Eliminazione e recuperabilità

### 12.1 Conferma

Il comando **Elimina prodotto** deve aprire una conferma che nomini il prodotto e spieghi che note, risposte e foto associate non saranno più accessibili normalmente.

### 12.2 Comportamento offline

- La cancellazione viene confermata in IndexedDB e inserita in outbox.
- Il prodotto scompare dalle liste normali.
- Il server riceve una tombstone, non un semplice hard delete immediato.
- Un dispositivo che torna online non deve ripristinare il prodotto cancellato per errore.

### 12.3 Foto e risposte

La pulizia dei media deve rispettare conflitti, upload pendenti e politiche di retention. Non eliminare definitivamente i file prima che la cancellazione sia sicura e sincronizzata.

### 12.4 Eliminazione di stand personali

**Raccomandazione:** impedire la cancellazione di uno stand personale che contiene prodotti attivi, finché non viene definita una procedura esplicita per spostamento/eliminazione dei prodotti. Non introdurre una cancellazione a cascata silenziosa.

### 12.5 Ripristino

Un pulsante «Annulla» immediato o un cestino non sono requisiti v1. Se introdotti, richiedono specifica di retention, sincronizzazione e conflitti; non promettere il recupero dopo una cancellazione definitiva.

---

## 13. Questionari associati ai prodotti

### 13.1 Selezione della definizione

Il questionario è scelto in base a **profilo attivo + categoria del prodotto**, secondo i JSON `config/questionnaires/<profileId>.json`. La categoria del prodotto non cambia, quindi la selezione non deve cambiare in seguito a una modifica del nome o del prezzo.

La regola proposta è il **matching esatto** di categoria, senza ereditarietà automatica dai genitori, finché non viene approvata un'altra decisione.

### 13.2 Tipi di domanda

| Tipo | Valore | Note |
|---|---|---|
| Testo | Stringa | Facoltativa |
| Numero | Numero finito | Eventuali limiti da JSON |
| Sì/No | Booleano o assente | `false` non equivale ad assente |
| Scelta singola | ID opzione | Validare contro definizione |
| Scelta multipla | Array ID opzioni | Nessun duplicato |
| Voto 1–10 | Intero o assente | Indipendente dal voto generale |

### 13.3 Versionamento

Memorizzare `questionnaireId`, `questionnaireVersion` e snapshot/versione della definizione per poter leggere le risposte storiche anche dopo modifiche al JSON. Non cancellare risposte solo perché una domanda è stata rinominata o rimossa.

### 13.4 Nessun questionario

Se il profilo/categoria non ha una definizione, non mostrare un questionario generico. Il prodotto resta pienamente utilizzabile.

### 13.5 Salvataggio

Le risposte sono facoltative. Le modifiche a risposte seguono lo stesso principio di **bozza locale → Salva esplicito → sincronizzazione**. Il documento `18-questionnaire-engine.md` definirà il contratto dettagliato.

---

## 14. Fotografie dei prodotti

### 14.1 Acquisizione

Da smartphone, scegliere file dalla galleria o fotocamera se il browser lo consente. L'app non deve dipendere esclusivamente da API fotografiche non supportate.

### 14.2 Persistenza

Dopo **Salva**, la foto deve avere metadati e blob persistiti localmente. Solo in seguito può essere caricata sul server. Evitare di conservare l'unica copia del file in memoria React.

### 14.3 Relazione e ordinamento

Ogni foto appartiene al prodotto e al profilo. Proposta: campo `sortOrder` per un ordine manuale futuro; se non previsto nella v1, usare un ordinamento stabile per data/ID. Non assumere che l'ordine di upload coincida con quello scelto dall'utente.

### 14.4 Errori

- Foto non valida: errore puntuale, senza perdere gli altri campi.
- Quota IndexedDB esaurita: non segnalare «foto salvata».
- Upload fallito: foto disponibile localmente, stato pendente/errore visibile.
- Eliminazione durante upload: cancellazione coordinata con outbox.

Formati, limiti, compressione, miniature e privacy EXIF saranno specificati in `21-photo-management.md`.

---

## 15. Confronto prodotti

### 15.1 Vincoli

Il confronto affiancato è disponibile **su desktop** e solo tra prodotti con **identico `categoryId`**, non semplicemente appartenenti allo stesso ramo gerarchico. Questa è l'interpretazione prudente di «stessa categoria».

### 15.2 Selezione

L'utente seleziona due o più prodotti della stessa categoria dal proprio profilo/evento. Proposta UI: 2–4 colonne su desktop, da verificare con larghezze reali. Non confrontare automaticamente prodotti di profili diversi.

### 15.3 Righe di confronto

- Nome prodotto.
- Stand.
- Prezzo (se presente).
- Valutazione generale.
- Preferito.
- Note.
- Fotografia principale.
- Risposte alle domande del questionario, se compatibili.

### 15.4 Dati mancanti

Visualizzare `Non indicato` per campi assenti; non trattare `null` come zero. Se due prodotti usano versioni diverse di un questionario, indicare la differenza e non associare domande solo in base all'etichetta visibile.

### 15.5 Non è una classifica automatica

Non generare un «migliore» automaticamente da prezzo e voto: l'utente decide quali fattori pesano di più. Eventuali punteggi aggregati sono una funzionalità futura da specificare.

---

## 16. Dashboard, budget ed esportazione

### 16.1 Dashboard

- **Numero prodotti:** conta i prodotti attivi del profilo/evento.
- **Preferiti:** conta quelli con `favorite=true`.
- I contatori si aggiornano subito dopo un commit locale riuscito.
- Le bozze non confermate **non** entrano nei conteggi.

### 16.2 Budget

I budget, se configurati, sono per categoria/sottocategoria nel profilo. Il prezzo osservato può essere confrontato con il budget come informazione, ma **non è una spesa**. Non sottrarre automaticamente il prezzo dal budget.

### 16.3 Export

L'esportazione per profilo JSON/PDF deve includere prodotti confermati, prezzi/voti se presenti, note, foto disponibili e risposte ai questionari. L'utente può scegliere tutte o alcune categorie. Non esportare bozze come dati confermati senza un'esplicita funzione dedicata.

L'esportazione deve chiarire se esistono mutazioni locali non sincronizzate: il dispositivo può avere dati più recenti del server.

---

## 17. Persistenza IndexedDB e PostgreSQL

### 17.1 Store locali

Il prodotto confermato risiede nello store `products`; le bozze in `drafts`; le mutazioni in `outbox`; i metadati foto in `photo_metadata`, i blob in `photo_blobs`; le risposte in `answer_sets`.

### 17.2 Tabella server

La tabella `products` proposta in `12-database.md` contiene UUID, profilo, evento, riferimento stand discriminato, nome, categoria, prezzo in centesimi, voto, preferito, note, timestamp, revisione e tombstone.

### 17.3 Indici

Indici server consigliati per `(profile_id,event_id)`, categoria, stand e preferiti. Indici IndexedDB analoghi per liste offline. Non dipendere da query al server per aprire un prodotto già salvato localmente.

### 17.4 Snapshot editoriali

Il prodotto contiene ID, non copie autoritative di nomi di categorie e stand. I nomi sono risolti dal catalogo locale validato; se il catalogo cambia, preservare gli ID storici o gestire migrazioni esplicite.

---

## 18. Sincronizzazione

### 18.1 Operazione di creazione

```ts
interface ProductUpsertOperation {
  operationId: string;
  profileId: string;
  eventId: string;
  entityType: "product";
  entityId: string;
  action: "upsert";
  baseRevision: number | null;
  payload: ObservedProduct;
  queuedAt: string;
}
```

Questo è un **modello concettuale**, non il contratto HTTP definitivo: verificare naming e forma delle risposte in `13-backend-api.md`.

### 18.2 Dipendenze

Se il prodotto è associato a uno stand personale appena creato offline, sincronizzare **prima lo stand** e poi il prodotto. Analogamente, le foto e le risposte possono dipendere dall'esistenza server del prodotto.

### 18.3 Idempotenza

Ogni mutazione ha un `operationId` univoco. Un retry con stesso ID e stesso payload non deve creare duplicati; stesso ID con payload diverso è errore.

### 18.4 Revisioni

Il server applica concorrenza ottimistica. Se la revisione base è obsoleta, il client conserva la versione locale e quella server, senza scegliere automaticamente.

### 18.5 Offline e app chiusa

Il salvataggio locale funziona senza rete. La sync automatica si tenta quando la PWA è attiva e online; **non promettere** sincronizzazione in background quando browser/app sono chiusi.

---

## 19. Conflitti tra dispositivi

### 19.1 Esempio

- A e B aprono lo stesso prodotto alla revisione 4.
- A cambia voto da 7 a 8 e sincronizza: revisione 5.
- B modifica note offline e salva sulla base della revisione 4.
- Al sync B riceve un conflitto: mostrare entrambe le versioni, non sovrascrivere il voto di A.

### 19.2 Risoluzione manuale

Mostrare differenze di nome, prezzo, voto, preferito, note e riferimenti media. L'utente può scegliere una versione o comporre manualmente un risultato **solo se il flusso di risoluzione lo supporta esplicitamente**. La risoluzione è una nuova mutazione basata sulla revisione server corrente.

### 19.3 Conflitti con eliminazioni

Se un dispositivo elimina il prodotto mentre un altro lo modifica, non ricrearlo automaticamente. Presentare il conflitto e preservare la modifica locale finché non viene deciso come procedere.

### 19.4 Foto

Le foto sono entità con ciclo di vita proprio: due upload indipendenti possono essere entrambi validi, ma non introdurre merge automatici non previsti dal protocollo. Gestire l'associazione al prodotto e i tombstone.

---

## 20. API e validazione server

### 20.1 Operazioni richieste

Il backend deve supportare almeno:

- elenco prodotti per profilo/evento con filtri/paginazione;
- lettura singolo prodotto;
- creazione;
- modifica con revisione;
- eliminazione con revisione;
- sincronizzazione delle operazioni offline;
- gestione dei metadati foto e relativi upload;
- lettura/salvataggio risposte questionario;
- consultazione/risoluzione conflitti.

I percorsi esatti sono definiti in `13-backend-api.md`: **non introdurre qui un secondo contratto REST divergente**.

### 20.2 Controlli obbligatori

Il server deve validare anche se il client ha già validato:

1. formato UUID e identificatori;
2. profilo ed evento esistenti;
3. stand editoriale o personale valido nel perimetro;
4. categoria esistente;
5. categoria immutabile per record esistente;
6. nome non vuoto;
7. prezzo e voto nei limiti;
8. proprietà delle foto/risposte;
9. revisione attesa;
10. idempotenza della mutazione;
11. compatibilità dello snapshot editoriale.

### 20.3 Errori significativi

| Codice proposto | Risposta UI |
|---|---|
| `INVALID_PRODUCT_NAME` | Correggere il nome. |
| `UNKNOWN_CATEGORY` | Categoria non più disponibile; verificare configurazione. |
| `CATEGORY_IMMUTABLE` | La categoria non può essere modificata. |
| `UNKNOWN_CATALOG_STAND` | Stand non riconosciuto. |
| `PROFILE_SCOPE_MISMATCH` | Prodotto non nel profilo corrente. |
| `INVALID_PRICE` | Inserire un importo valido. |
| `INVALID_RATING` | Voto tra 1 e 10. |
| `REVISION_CONFLICT` | Risolvere il conflitto. |
| `ENTITY_DELETED` | Prodotto eliminato altrove. |
| `LOCAL_STORAGE_QUOTA_EXCEEDED` | Impossibile salvare localmente. |
| `PHOTO_UPLOAD_FAILED` | Foto locale in attesa di nuovo tentativo. |

I nomi sono indicativi e vanno riconciliati con la nomenclatura API comune.

---

## 21. Esempi di casi d'uso

### 21.1 Moto provata presso uno stand

Un profilo crea un prodotto nella categoria `naked-motorcycles`, annota ergonomia, prezzo visto e valutazione personale, aggiunge foto della posizione in sella e risponde a domande della propria categoria. Il tutto è disponibile offline dopo Salva.

### 21.2 Guanti moto

Un altro profilo registra guanti nella categoria `motorcycle-gloves`, con note sulla vestibilità e fotografie. Se il suo JSON questionari prevede domande per i guanti, il modulo le mostra; non vengono visualizzate domande per moto o caschi.

### 21.3 Nessun prezzo

Il profilo fotografa un prodotto senza cartellino prezzo: `price=null`, non `0 €`. Il prodotto può essere votato e preferito ugualmente.

### 21.4 Più prodotti nello stesso stand

Lo stesso profilo può registrare più prodotti collegati al medesimo stand, anche nella stessa categoria. Non deduplicare per nome, perché due osservazioni potrebbero essere legittimamente distinte.

### 21.5 Stesso prodotto, profili diversi

`me` e `father` possono creare record distinti sul medesimo modello, con voti, note, foto e questionari differenti. La dashboard di ciascuno conta soltanto i propri prodotti.

### 21.6 Errore categoria

L'utente salva un casco nella categoria `motorcycle-gloves`. Dopo il Salva non può cambiare la categoria; può creare un nuovo prodotto nella categoria corretta e cancellare il precedente con conferma.

---

## 22. Accessibilità e UX

- Etichette esplicite per tutti i campi e pulsanti.
- Input prezzo con tastiera numerica adeguata su mobile, senza affidarsi solo al tipo HTML `number` per il parsing locale.
- Selettore voto accessibile da tastiera e lettori di schermo, con valore numerico pronunciabile.
- Stato preferito distinguibile senza dipendere solo dal colore.
- Anteprime foto con testo alternativo generico quando non esiste descrizione.
- Conferme di eliminazione con focus gestito correttamente.
- Messaggi di salvataggio/sync annunciati in modo non invasivo.
- Nessun dato perso per cambio orientamento, sospensione app o navigazione involontaria.
- Pulsanti touch con dimensioni adeguate e contrasto leggibile.
- Evitare scroll orizzontale nell'editor mobile; confronto affiancato riservato a desktop.

---

## 23. Osservabilità e diagnostica

Registrare in modo strutturato **senza esporre note personali o foto nei log**:

- creazioni/modifiche/eliminazioni confermate;
- fallimenti di validazione per codice;
- errori di IndexedDB e quota;
- lunghezza della coda outbox;
- durata e risultato sincronizzazioni;
- conflitti aperti/risolti;
- upload foto falliti;
- migrazioni di catalogo incompatibili.

Non registrare il contenuto completo dei questionari nei log applicativi ordinari.

---

## 24. Strategia di test

### 24.1 Creazione e validazione

| ID | Scenario | Atteso |
|---|---|---|
| PR-01 | Nuovo prodotto con nome, stand, categoria | Salva locale riuscito |
| PR-02 | Nome vuoto | Salva bloccato, bozza conservata |
| PR-03 | Nome di soli spazi | Errore sul campo |
| PR-04 | Categoria assente | Salva bloccato |
| PR-05 | Stand assente dalla creazione globale | Salva bloccato |
| PR-06 | Stand personale di altro profilo | Rifiutato |
| PR-07 | Categoria inesistente | Rifiutata |
| PR-08 | Categoria modificata prima del primo Salva | Consentito |
| PR-09 | Categoria modificata dopo primo Salva | Vietato client e server |
| PR-10 | Prezzo non indicato | `null` |
| PR-11 | Prezzo zero | Valido, distinto da assente |
| PR-12 | Prezzo negativo | Rifiutato |
| PR-13 | Prezzo con oltre due decimali | Rifiutato/validazione esplicita |
| PR-14 | Prezzo in formato italiano | Convertito correttamente in centesimi |
| PR-15 | Voto 1 o 10 | Accettato |
| PR-16 | Voto 0 o 11 | Rifiutato |
| PR-17 | Voto assente | `null`, non zero |
| PR-18 | Preferito senza voto | Consentito |
| PR-19 | Note multilinea | A capo preservati |
| PR-20 | Due prodotti con stesso nome | Consentiti |

### 24.2 Liste e navigazione

| ID | Scenario | Atteso |
|---|---|---|
| PR-21 | Creazione dal dettaglio stand | Stand precompilato |
| PR-22 | Creazione da Prodotti | Scelta stand obbligatoria |
| PR-23 | Cambio profilo | Prodotti e bozze isolati |
| PR-24 | Cambio evento | Prodotti filtrati per evento |
| PR-25 | Ricerca nome | Risultati corretti |
| PR-26 | Filtro categoria padre | Regola discendenti coerente |
| PR-27 | Filtro preferiti | Solo flag true |
| PR-28 | Ordinamento prezzo con null | Null in fondo |
| PR-29 | Riapertura lista | Filtri/ordinamento resettati |
| PR-30 | Contatore dashboard dopo Salva | Aggiornato subito |
| PR-31 | Contatore con bozza non salvata | Non cambia |
| PR-32 | Prodotto eliminato | Non compare nelle liste |

### 24.3 Offline e sincronizzazione

| ID | Scenario | Atteso |
|---|---|---|
| PR-33 | Bozza offline | Persistita in IndexedDB |
| PR-34 | Chiude editor con bozza | Avviso, bozza conservata |
| PR-35 | Salva offline | Record e outbox atomici |
| PR-36 | Quota storage esaurita | Nessun falso successo |
| PR-37 | App riaperta offline | Prodotto disponibile |
| PR-38 | Sync dopo riconnessione | Server riceve record |
| PR-39 | Retry stesso operationId | Nessun duplicato |
| PR-40 | Sync stand personale e prodotto | Ordine dipendenze rispettato |
| PR-41 | Due dispositivi modificano stesso prodotto | Conflitto manuale |
| PR-42 | Conflitto locale/server | Entrambe le versioni preservate |
| PR-43 | Modifica concorrente con eliminazione | Nessuna resurrezione automatica |
| PR-44 | App chiusa | Nessuna falsa promessa di sync background |
| PR-45 | JSON stand aggiornato con stesso ID | Collegamento conservato |
| PR-46 | Stand JSON rimosso | Prodotto non cancellato silenziosamente |

### 24.4 Foto, questionari, confronto, export

| ID | Scenario | Atteso |
|---|---|---|
| PR-47 | Aggiunta più foto | Tutte collegate al prodotto |
| PR-48 | Foto salvata offline | Blob leggibile senza rete |
| PR-49 | Upload foto fallito | Foto locale conservata |
| PR-50 | Foto non valida | Errore senza perdita del modulo |
| PR-51 | Questionario assente | Sezione omessa |
| PR-52 | Questionario con tutte domande vuote | Salvataggio consentito |
| PR-53 | Risposta sì/no false | Distinta da assente |
| PR-54 | Versione questionario cambiata | Risposte storiche interpretabili |
| PR-55 | Voto domanda e voto prodotto | Indipendenti |
| PR-56 | Confronto desktop stessa categoria | Consentito |
| PR-57 | Confronto categorie diverse | Bloccato |
| PR-58 | Confronto mobile | Non presenta affiancamento desktop |
| PR-59 | Export prodotto con foto/risposte | Dati confermati inclusi |
| PR-60 | Export con bozza non confermata | Bozza esclusa |

### 24.5 Eliminazione, sicurezza, accessibilità

| ID | Scenario | Atteso |
|---|---|---|
| PR-61 | Elimina prodotto | Conferma obbligatoria |
| PR-62 | Annulla eliminazione | Prodotto invariato |
| PR-63 | Elimina offline | Tombstone in outbox |
| PR-64 | Stand personale con prodotti | Eliminazione bloccata secondo proposta |
| PR-65 | Richiesta prodotto di altro profilo | Perimetro validato |
| PR-66 | Modifica categoryId via API | Rifiutata |
| PR-67 | HTML inserito nelle note | Non eseguito |
| PR-68 | Navigazione editor da tastiera | Utilizzabile |
| PR-69 | Stato preferito senza colore | Comprensibile |
| PR-70 | Errore salvataggio locale | Feedback chiaro e bozza conservata |

---

## 25. Criteri di accettazione

- [ ] Prodotto creato solo tramite interazione utente, mai tramite `products.json`.
- [ ] Profilo, evento e stand correttamente associati.
- [ ] Nome e categoria obbligatori al primo Salva.
- [ ] Categoria selezionata manualmente e bloccata dopo primo Salva, anche offline.
- [ ] Prezzo facoltativo, zero distinto da assente, formato monetario corretto.
- [ ] Voto generale facoltativo e limitato a interi 1–10.
- [ ] Preferito e note modificabili senza alterare categoria.
- [ ] Foto multiple associate e disponibili offline dopo persistenza riuscita.
- [ ] Questionario mostrato solo se definito per profilo/categoria.
- [ ] Risposte facoltative e versionate.
- [ ] Bozze autosalvate, non sincronizzate prima di Salva.
- [ ] Salva locale atomico con outbox e feedback accurato.
- [ ] Prodotti visibili immediatamente dopo commit locale.
- [ ] Lista filtrabile e ordinabile con reset alla riapertura.
- [ ] Dashboard aggiornata senza conteggiare bozze.
- [ ] Eliminazione confermata, propagata con tombstone.
- [ ] Nessuna cancellazione a cascata silenziosa.
- [ ] Sync idempotente e dipendenze rispettate.
- [ ] Conflitti manuali con versioni preservate.
- [ ] Confronto desktop limitato alla stessa categoria.
- [ ] Export JSON/PDF per profilo con prodotti confermati.
- [ ] Test funzionali, offline, concorrenza, accessibilità superati.

---

## 26. Decisioni aperte

| Decisione | Proposta attuale | Impatto |
|---|---|---|
| Stand modificabile dopo primo Salva? | No, per integrità | API, UX, migrazioni |
| Categorie padre selezionabili? | Sì se consentito da `06` | Selettore e confronti |
| Valore massimo prezzo | Limite applicativo da definire | Validazione |
| Valute oltre EUR | Non nella v1 | DB, export, UI |
| Preferito da lista | Commit locale esplicito per tap | UX, outbox |
| Numero foto e dimensioni | Da definire in `21` | Quota, upload |
| Numero massimo prodotti in confronto | Proposta 2–4 desktop | Layout |
| Confronto categorie sorelle | No, solo stesso `categoryId` | Regole di confronto |
| Questionari ereditati da categorie padre | No per default | `10`, `18` |
| Copia/duplica prodotto | Non prevista in v1 | Categoria immutabile |
| Ripristino prodotti cancellati | Non previsto in v1 | Tombstone, retention |
| Riassegnazione prodotto a stand diverso | Non prevista | Integrità referenziale |

Le proposte non ancora approvate non devono essere implementate come scelte irreversibili senza una revisione incrociata dei documenti.

---

## 27. Dipendenze e prossimo documento

- `08-products-config.md`: definizione funzionale del prodotto dinamico e assenza di `products.json`.
- `10-questionnaires-config.md`: schema JSON delle domande per profilo/categoria.
- `12-database.md`: entità persistenti, revisioni, outbox e tombstone.
- `13-backend-api.md`: endpoint e contratto di sincronizzazione.
- `14-frontend-ui.md`: componenti, layout mobile e navigazione.
- `15-dashboard.md`: statistiche e collegamenti rapidi.
- `16-stand-management.md`: origine dei prodotti, gestione stand e cancellazioni.
- `18-questionnaire-engine.md`: rendering, validazione, versionamento e persistenza risposte.
- `19-offline-storage.md` e `20-synchronization.md`: transazioni locali, coda e conflitti.
- `21-photo-management.md`: compressione, media e upload.
- `22-comparison.md`: confronto desktop dettagliato.
- `23-export.md`: esportazione JSON/PDF.

**Prossimo:** `docs/18-questionnaire-engine.md`, dedicato al motore di rendering dei questionari, ai sei tipi di risposta, alle regole di validazione, alle modifiche delle definizioni e alla compatibilità offline.
