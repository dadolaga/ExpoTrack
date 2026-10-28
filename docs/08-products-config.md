# 08 — Modello dei prodotti osservati (`products`)

## Aggiornamento mobile — risposte A1–A9

**Contratto vigente per il web mobile da fiera:** [specifica UI mobile, risposte A1–A9](27_Specifiche_UI_Mobile.md#10-risposte-di-revisione-recepite). Questo aggiornamento prevale sui paragrafi, diagrammi, pseudocodice e casi di test precedenti incompatibili. In particolare, gli esempi con `drafts`, conferma finale «Salva», dettaglio mobile 08, foto stand o scelta manuale del conflitto descrivono la progettazione precedente e non vanno implementati nel mobile. Le parti compatibili e le funzioni desktop/post-fiera mantengono il proprio ambito.

Unica descrizione personale description, senza cronologia e senza limite funzionale UI. Ogni prodotto apre l’editor 05; nessun dettaglio 08. Autosalvataggio locale e outbox automatica per valori validi, senza bozze o Salva finale. Categoria e riferimento stand bloccati alla prima registrazione valida; voto facoltativo e rimuovibile. Duplicazione salva una copia con nuovo ID e senza foto.


> **Progetto:** ExpoTrack · **Versione del contratto proposta:** `1` · **Stato:** specifica funzionale e tecnica v1  
> **Documenti precedenti:** [`00-overview.md`](00-overview.md), [`01-architecture.md`](01-architecture.md), [`02-project-structure.md`](02-project-structure.md), [`03-app-config.md`](03-app-config.md), [`04-profiles-config.md`](04-profiles-config.md), [`05-pavilions-config.md`](05-pavilions-config.md), [`06-categories-config.md`](06-categories-config.md), [`07-stands-config.md`](07-stands-config.md)  
> **Documento successivo:** [`09-interests-config.md`](09-interests-config.md)

---

## 1. Scopo e principio fondamentale

ExpoTrack permette di registrare **prodotti osservati durante una fiera**, associandoli a uno stand e al profilo che li ha raccolti. I prodotti sono personali, modificabili e consultabili sia nella scheda dello stand sia in una lista generale.

**Non esiste l'obbligo di un file `config/products.json`.** Il nome `08-products-config.md` segue la convenzione dell'indice documentale, ma il prodotto osservato è un **record dinamico** conservato in **IndexedDB** sul dispositivo e sincronizzato con **PostgreSQL** sul server.

Il catalogo degli stand resta editoriale e condiviso; i prodotti non diventano automaticamente condivisi solo perché sono stati registrati presso uno stand comune.

### 1.1 Requisiti già confermati

- Un prodotto è collegato a **uno stand** e appartiene a **un solo profilo** e **un solo evento**.
- Ogni prodotto ha **esattamente una categoria o sottocategoria**, selezionata manualmente.
- La categoria è **immutabile dopo il primo salvataggio confermato**.
- Il nome è obbligatorio.
- È previsto **un solo prezzo facoltativo**, non prezzi separati di listino/fiera.
- È prevista una **valutazione generale facoltativa da 1 a 10**, indipendente dalle risposte al questionario.
- Ogni prodotto può essere contrassegnato come **preferito**.
- Note libere, **più fotografie facoltative** e risposte a questionari personali sono supportate.
- Un questionario appare **solo** quando esiste una definizione JSON per **quel profilo e quella categoria/sottocategoria**; nessuna domanda generica.
- L'utente può modificare i campi consentiti o eliminare un prodotto con conferma.
- I prodotti sono visibili nel dettaglio dello stand e in una **lista personale generale**.
- Ricerca per nome; filtri per categoria, stand e preferiti; ordinamento per prezzo e valutazione.
- Confronto affiancato di prodotti della **stessa categoria** soltanto su **desktop**, non su smartphone.
- Salvataggio mobile automatico locale e outbox per valori validi, senza modalità bozza o conferma Salva finale; input invalidi conservati localmente secondo §5.1 del documento 27.
- La sincronizzazione automatica parte quando torna la rete; è disponibile anche il comando manuale.
- Concorrenza mobile LWW per record in ordine di accettazione server; revisioni monotone, idempotenza e protezione delle tombstone.

### 1.2 Cosa è fuori ambito

Non sono previsti: carrello, checkout, gestione degli acquisti, inventario, scorte, pagamento, catalogo e-commerce globale, importazione JSON, comparazione mobile o gestione automatica dei prezzi di listino.

---

## 2. Terminologia

| Termine | Significato |
|---|---|
| **Prodotto** | Oggetto osservato e registrato dal visitatore |
| **Profilo** | Persona selezionata nell'app; non è un account autenticato |
| **Evento** | Fiera corrente, ad esempio `eicma-2026` |
| **Stand di origine** | Stand editoriale o personale presso cui è stato osservato il prodotto |
| **Categoria** | Nodo selezionato dall'utente nell'albero di `categories.json` |
| **Valutazione generale** | Singolo voto opzionale 1–10 |
| **Questionario** | Domande configurate per profilo e categoria, separate dal voto generale |
| **Bozza** | Modifiche locali non ancora confermate con Salva |
| **Record salvato** | Stato locale confermato e inserito nella coda di sync |
| **Preferito** | Contrassegno booleano personale del prodotto |

---

## 3. Posizione nell'architettura

```text
ExpoTrack/
├── config/
│   ├── app.json
│   ├── categories.json
│   ├── events/
│   │   └── eicma-2026-stands.json
│   └── questionnaires/
│       ├── me.json
│       └── father.json
├── src/
│   ├── features/
│   │   └── products/
│   │       ├── components/
│   │       ├── domain/
│   │       ├── data/
│   │       └── hooks/
│   └── lib/
│       ├── offline/
│       ├── sync/
│       └── db/
└── docs/
    ├── 08-products-config.md
    ├── 17-product-management.md
    ├── 18-questionnaire-engine.md
    └── 23-export.md
```

La struttura è indicativa: i dettagli concreti del repository sono in [`02-project-structure.md`](02-project-structure.md).

### 3.1 Separazione delle responsabilità

| Componente | Responsabilità |
|---|---|
| JSON categorie | Elenco e gerarchia delle categorie disponibili |
| JSON stand | Catalogo degli stand editoriali |
| JSON questionari | Definizione delle domande per profilo/categoria |
| IndexedDB | Prodotti salvati, bozze, fotografie offline e coda di sync |
| PostgreSQL | Persistenza condivisa tra dispositivi dello stesso profilo |
| Storage media | Contenuti binari delle fotografie |
| API Next.js | Validazione, sincronizzazione, controllo dei riferimenti e conflitti |
| UI React | Creazione, modifica, ricerca, preferiti, dettaglio e confronto desktop |

---

## 4. Modello logico del prodotto

### 4.1 Campi principali

| Campo logico | Tipo | Obbligatorio | Regole |
|---|---|---|---|
| `id` | stringa | Sì | Identificativo univoco generato dall'app |
| `profileId` | stringa | Sì | Profilo proprietario |
| `eventId` | stringa | Sì | Evento di appartenenza |
| `standRef` | oggetto | Sì | Riferimento a uno stand valido e visibile al profilo |
| `name` | stringa | Sì | Nome non vuoto |
| `categoryId` | stringa | Sì | Una categoria esistente, scelta manualmente |
| `price` | valore monetario | No | Prezzo singolo, non negativo |
| `rating` | intero | No | Da 1 a 10 |
| `isFavorite` | booleano | Sì | Default `false` |
| `notes` | stringa | No | Note personali libere |
| `photoIds` | array di stringhe | No | Zero o più riferimenti a fotografie |
| `answers` | collezione | No | Risposte alle sole domande configurate |
| `createdAt` | timestamp | Sì | Creazione del record |
| `updatedAt` | timestamp | Sì | Ultima modifica confermata |
| `revision` | token/versione | Sì lato sync | Controllo concorrenza |

**Nota:** la forma esatta di `answers`, `photoIds`, `revision` e degli importi sarà finalizzata nei documenti dedicati. Non è opportuno fissare prematuramente uno schema SQL o API.

### 4.2 Esempio illustrativo di record applicativo

```json
{
  "id": "prd-018f7b6a-demo",
  "profileId": "me",
  "eventId": "eicma-2026",
  "standRef": {
    "source": "catalog",
    "standId": "stand-demo"
  },
  "name": "Casco integrale dimostrativo",
  "categoryId": "helmets-integral",
  "price": {
    "amountMinor": 29900,
    "currency": "EUR"
  },
  "rating": 8,
  "isFavorite": true,
  "notes": "Vestibilità comoda; chiedere disponibilità taglie.",
  "photoIds": [],
  "answers": {},
  "createdAt": "2026-10-27T10:00:00.000Z",
  "updatedAt": "2026-10-27T10:00:00.000Z",
  "revision": "local-1"
}
```

**Tutti i dati sono fittizi.** `stand-demo` e `helmets-integral` devono esistere nei rispettivi cataloghi affinché il record sia effettivamente valido. L'ID e la revisione sono segnaposto illustrativi; `amountMinor` è una **proposta tecnica**, non un formato già approvato.

### 4.3 Perché non un catalogo prodotti statico

L'utente scopre e registra i prodotti durante la visita: nome, prezzo, impressioni, fotografie e risposte possono variare da persona a persona. Un file editoriale comune imporrebbe modifiche al repository per ogni osservazione e rischierebbe di mescolare dati personali.

**Conclusione:** `products` è un'entità dinamica. Gli eventuali elenchi di prodotti da vedere appartengono agli **interessi dello stand**, non a un catalogo obbligatorio di prodotti.

---

## 5. Identità, proprietà e riferimenti

### 5.1 ID del prodotto

Generare l'ID al momento della creazione locale, prima della sincronizzazione, con un metodo che eviti collisioni anche tra dispositivi offline (per esempio UUID v4 o UUID v7).

L'ID deve rimanere invariato per l'intera vita del prodotto, comprese modifiche, sincronizzazioni e conflitti.

### 5.2 Ambito del profilo

Ogni lettura e scrittura deve essere associata a `profileId` ed `eventId`. Il profilo attivo determina la lista mostrata e il proprietario dei nuovi prodotti.

**La separazione per profilo non equivale ad autenticazione.** Nella v1 chi può aprire l'app può selezionare un altro profilo. Le limitazioni di sicurezza sono trattate in [`25-security.md`](25-security.md).

### 5.3 Riferimento allo stand

Si propone:

```ts
type StandReference = {
  source: "catalog" | "personal";
  standId: string;
};
```

Il riferimento è sempre interpretato nel contesto di `eventId` e `profileId`.

- Se `source === "catalog"`, lo stand deve esistere nel catalogo dell'evento.
- Se `source === "personal"`, lo stand deve esistere tra quelli privati **dello stesso profilo**.
- Non consentire un prodotto collegato a uno stand personale di un altro profilo.

Lo schema definitivo delle chiavi e delle foreign key è in [`12-database.md`](12-database.md).

### 5.4 Eliminazione o modifica dello stand

Rinominare uno stand mantenendo l'ID non deve scollegare i prodotti. Se lo stand viene eliminato, i prodotti collegati **non devono scomparire silenziosamente**.

La politica esatta (blocco, riassegnazione o cancellazione esplicita e confermata) è ancora da definire in `16-stand-management.md` e `17-product-management.md`.

---

## 6. Nome del prodotto

Il nome è obbligatorio e deve essere verificato dopo aver rimosso gli spazi iniziali e finali.

Regole proposte:

- stringa non vuota;
- lunghezza massima configurata nello schema applicativo (proposta: 200 caratteri);
- consentire lettere, numeri, punteggiatura e caratteri Unicode;
- non richiedere un nome unico: due prodotti possono avere lo stesso nome;
- non usare il nome come ID o come riferimento al questionario.

La UI deve mostrare un errore comprensibile se il campo è vuoto e non consentire il primo salvataggio confermato.

---

## 7. Categoria: una sola e immutabile

### 7.1 Selezione manuale

Ogni prodotto deve avere **esattamente un `categoryId`**. L'utente lo sceglie nell'albero definito in `config/categories.json`.

Lo stand può appartenere a più categorie, ma **non** bisogna copiare automaticamente la prima categoria dello stand sul prodotto.

### 7.2 Quando diventa immutabile

| Stato | Comportamento |
|---|---|
| Creazione, prima di Salva | La categoria può essere cambiata liberamente |
| Bozza autosalvata | La categoria può essere cambiata: non è ancora confermata |
| Primo Salva completato in IndexedDB | La categoria diventa immutabile |
| Record in attesa di sync | La categoria rimane immutabile |
| Record sincronizzato | La categoria rimane immutabile |
| Modifica successiva | Categoria visibile ma non modificabile |

**La soglia è il primo salvataggio locale confermato**, non la prima sincronizzazione online.

### 7.3 Enforcement

La UI deve bloccare il campo dopo il primo salvataggio, ma **non basta**: la regola deve essere verificata anche nel dominio, nel repository locale e nell'API/server.

Esempio di controllo:

```ts
function validateCategoryChange(
  previous: { categoryId: string } | null,
  next: { categoryId: string }
): void {
  if (previous && previous.categoryId !== next.categoryId) {
    throw new Error("La categoria del prodotto non è modificabile dopo il salvataggio.");
  }
}
```

Il confronto deve avvenire contro la versione persistita, non soltanto contro uno stato React che può essere alterato.

### 7.4 Categoria rimossa dal JSON

Se una categoria precedentemente usata viene rimossa, il prodotto non deve essere eliminato e non deve ricevere automaticamente una categoria diversa.

Occorre una politica di migrazione o conservazione storica, da specificare nei documenti categorie, database e sincronizzazione.

### 7.5 Domande del questionario

La categoria determina quale questionario personale è applicabile. Proprio per questo la categoria è immutabile dopo il salvataggio: cambiarla potrebbe invalidare risposte già registrate.

**Non definire qui** se un questionario su una categoria padre si applichi alle sottocategorie: la regola di matching/ereditarietà è ancora aperta e sarà decisa in `10-questionnaires-config.md` e `18-questionnaire-engine.md`.

---

## 8. Prezzo singolo facoltativo

### 8.1 Semantica

Un prodotto può avere **un solo prezzo**, oppure nessuno.

Non introdurre campi separati `listPrice`, `fairPrice`, `discountedPrice` o `originalPrice`.

Il prezzo è un dato osservato dall'utente; non implica un acquisto e non viene sottratto dai budget personali.

### 8.2 Rappresentazione proposta

Per evitare errori di floating point, è consigliato memorizzare importi in **unità minime intere**:

```json
{
  "price": {
    "amountMinor": 29900,
    "currency": "EUR"
  }
}
```

Il valore rappresenta **299,00 €**. In UI l'utente può digitare `299,00`, ma il dominio normalizza a `29900` centesimi.

Questa è una proposta, da allineare a `12-database.md` e `13-backend-api.md`.

### 8.3 Validazione

- Il prezzo può essere assente.
- Se presente, non può essere negativo.
- Non accettare `NaN`, `Infinity`, stringhe arbitrarie o importi non interpretabili.
- Per la v1 si propone `EUR`.
- Non interpretare `0` come prezzo mancante: **zero è un valore distinto da assente**.
- Mostrare l'importo secondo la locale `it-IT`.

### 8.4 Ordinamento per prezzo

I prodotti senza prezzo devono rimanere visibili. Proposta: ordinarli **in fondo** sia in crescente sia in decrescente.

Non inventare un prezzo pari a zero per ordinare record senza prezzo.

### 8.5 Budget di riferimento

Se il profilo dispone di un budget per la categoria, la UI può mostrare la differenza con il prezzo registrato. L'eventuale fallback dal nodo figlio al padre **non è ancora deciso**.

Non usare il budget come limite bloccante al salvataggio.

---

## 9. Valutazione generale 1–10

### 9.1 Campo indipendente

`rating` è un voto **complessivo** del prodotto. È facoltativo e non deve essere calcolato automaticamente dalla media delle risposte al questionario.

- intero da **1 a 10**;
- `null`/assenza significa **non valutato**;
- zero non è valido;
- i valori decimali non sono validi nella proposta v1.

### 9.2 Questionari e voto generale

Esempio:

```text
Valutazione generale: 8/10
Questionario personale:
  - Comfort: 9/10
  - Peso percepito: 7/10
  - Note sulla visiera: "Buona visuale"
```

L'esempio illustra una possibile compilazione: le domande effettive **non sono predefinite** e possono variare per profilo e categoria.

La valutazione generale rimane indipendente anche se non esiste alcun questionario.

### 9.3 Ordinamento per valutazione

Proposta: prodotti non valutati in fondo, sia in crescente sia in decrescente. A parità di voto, ordinare per nome per avere risultati stabili.

---

## 10. Preferiti

`isFavorite` è un booleano personale, con default `false`.

- Può essere modificato dopo il salvataggio.
- Può essere mostrato nella lista generale e nella scheda stand.
- Può essere usato come filtro.
- Contribuisce al contatore dei preferiti della dashboard.
- Non è una proprietà condivisa dello stand o del prodotto tra profili.

Il cambio di preferito è una **modifica di un record personale**: deve seguire le regole di salvataggio e sincronizzazione. La UI può mostrare un'anteprima immediata, ma deve distinguere eventuali modifiche non confermate.

---

## 11. Note libere

Le note sono facoltative e personali. Devono supportare testo multilinea.

Comportamento:

1. l'utente scrive;
2. la bozza viene autosalvata localmente;
3. il pulsante **Salva** conferma la modifica;
4. il record confermato viene accodato per la sincronizzazione.

In caso di uscita dalla schermata con modifiche non confermate, mostrare un avviso **senza perdere la bozza**.

Non inserire le note nel JSON editoriale dello stand o in quello dei questionari.

---

## 12. Fotografie multiple

### 12.1 Requisiti

- Zero o più foto per prodotto.
- Le foto sono personali e collegate al prodotto.
- Devono poter essere aggiunte durante la visita, anche offline.
- Dopo il salvataggio locale devono essere consultabili offline.
- La sincronizzazione dei media può avvenire quando torna la rete.
- Le foto non devono essere serializzate come blob/base64 dentro il catalogo JSON.

### 12.2 Modello concettuale

```ts
interface ProductPhotoReference {
  id: string;
  productId: string;
  profileId: string;
  localState: "local" | "pending" | "synced" | "error";
}
```

Questo è un esempio illustrativo. La struttura reale deve includere le informazioni necessarie per MIME type, dimensioni, hash, storage e sincronizzazione, secondo `21-photo-management.md`.

### 12.3 Eliminazione e conflitti

Eliminare una foto non deve cancellare accidentalmente altre fotografie o note. La cancellazione definitiva sul server richiede un'operazione sincronizzata coerente.

La gestione di foto aggiunte su due dispositivi, versioni e conflitti sarà specificata in `20-synchronization.md` e `21-photo-management.md`.

---

## 13. Risposte ai questionari

### 13.1 Regola di disponibilità

Un questionario può essere visualizzato **soltanto** se è definito nei JSON editoriali per la combinazione **profilo + categoria/sottocategoria** applicabile.

Se non esiste, **non mostrare alcuna sezione questionario** e non generare domande di default.

### 13.2 Tipi supportati

Le definizioni dei questionari potranno usare:

- testo libero;
- numero;
- sì/no;
- scelta singola;
- scelta multipla;
- valutazione 1–10.

Tutte le domande sono **facoltative**. Non bloccare il salvataggio di un prodotto perché una risposta manca.

### 13.3 Indipendenza delle definizioni

Due profili possono avere questionari diversi per la stessa categoria: non cambiano solo le risposte, ma anche le **domande e le opzioni**.

Le risposte appartengono al prodotto e al profilo, non al file JSON editoriale.

### 13.4 Aggiornamenti del questionario

Se una domanda viene rinominata, rimossa o modificata dopo la visita, non cancellare le risposte precedenti senza una politica di compatibilità. È opportuno associare alle risposte ID domanda stabili e una versione della definizione.

Le regole definitive sono in `10-questionnaires-config.md` e `18-questionnaire-engine.md`.

---

## 14. Creazione di un prodotto

### 14.1 Punto di ingresso

L'utente può avviare la creazione dal **dettaglio di uno stand**. Nella lista generale dei prodotti può essere disponibile un comando **Aggiungi prodotto**, purché richieda la selezione esplicita di uno stand.

### 14.2 Flusso

1. Verificare il profilo e l'evento attivi.
2. Selezionare lo stand, se non già noto.
3. Inserire il nome del prodotto.
4. Selezionare manualmente una categoria/sottocategoria.
5. Compilare facoltativamente prezzo, valutazione, preferito e note.
6. Aggiungere eventualmente fotografie.
7. Mostrare un questionario **solo se configurato**.
8. Autosalvare le modifiche in una **bozza locale**.
9. Alla pressione di **Salva**, validare i campi.
10. Salvare il prodotto confermato in IndexedDB.
11. Nella stessa transazione logica, registrare l'operazione nella coda di sincronizzazione.
12. Bloccare definitivamente la categoria per quel prodotto.
13. Mostrare lo stato di sincronizzazione separatamente dall'esito del salvataggio locale.

### 14.3 Salvataggio offline

Se la rete non è disponibile, **Salva** deve comunque funzionare, purché IndexedDB sia disponibile e il record sia valido.

Non mostrare «sincronizzato» se il record è soltanto salvato localmente. Lo stato corretto è **in attesa di sincronizzazione**.

### 14.4 Errori

Se la transazione IndexedDB fallisce, il record non deve essere considerato confermato e la bozza deve essere preservata, per quanto possibile.

Se il server rifiuta la sincronizzazione, il record locale non deve essere cancellato: mostrare errore e consentire retry o risoluzione.

---

## 15. Modifica di un prodotto

### 15.1 Campi modificabili

| Campo | Dopo il primo Salva |
|---|---|
| Nome | Modificabile |
| Stand di origine | **Da definire**: proposta di mantenerlo fisso per coerenza storica |
| Categoria | **Immutabile** |
| Prezzo | Modificabile |
| Valutazione generale | Modificabile |
| Preferito | Modificabile |
| Note | Modificabili |
| Foto | Aggiungibili/rimovibili |
| Risposte | Modificabili, se il questionario è disponibile |

### 15.2 Campo stand

Il requisito confermato impone un collegamento allo stand, ma non specifica se sia possibile riassegnare il prodotto dopo la creazione. **Proposta:** rendere lo stand immutabile dopo il primo salvataggio, come scelta prudente per mantenere la provenienza; la decisione va confermata in `17-product-management.md`.

### 15.3 Bozze in modifica

La bozza deve essere separata dalla versione confermata. Se l'utente abbandona la schermata, la bozza rimane recuperabile. Se cambia profilo, non deve comparire nel profilo successivo.

---

## 16. Eliminazione

### 16.1 Conferma

L'eliminazione richiede una conferma esplicita. Il messaggio deve chiarire che verranno coinvolti anche note, risposte e fotografie associate.

### 16.2 Offline e multi-dispositivo

Se l'eliminazione avviene offline, deve essere registrata come operazione pendente e sincronizzata in seguito. Un altro dispositivo potrebbe avere una versione più recente dello stesso prodotto: la risoluzione deve evitare cancellazioni silenziose.

**Proposta tecnica:** usare tombstone/versioni per propagare le eliminazioni. La politica di conservazione e pulizia definitiva verrà definita in `12-database.md`, `20-synchronization.md` e `21-photo-management.md`.

### 16.3 Nessuna cancellazione accidentale

Eliminare un prodotto **non** deve eliminare lo stand collegato né altri prodotti dello stesso stand.

---

## 17. Lista generale dei prodotti

### 17.1 Visibilità

La sezione **Prodotti** nella navigazione mobile mostra tutti i prodotti del **profilo attivo e dell'evento attivo**, indipendentemente dallo stand.

Gli stand personali di altri profili non devono apparire, così come i loro prodotti.

### 17.2 Ricerca e filtri

| Funzione | Regola |
|---|---|
| Ricerca per nome | Case-insensitive; matching parziale |
| Filtro categoria | Categoria selezionata, con eventuali discendenti secondo regole del modulo categorie |
| Filtro stand | Prodotti collegati allo stand selezionato |
| Filtro preferiti | Solo `isFavorite === true` |
| Combinazione filtri | Proposta: AND tra filtri diversi |
| Ordinamento prezzo | Crescente/decrescente |
| Ordinamento valutazione | Crescente/decrescente |

Le regole esatte del filtro sulle categorie padre/figlie sono da allineare a `06-categories-config.md`.

### 17.3 Ordinamenti stabili

Per prodotti con prezzo o valutazione assenti, si propone di mostrarli **in fondo** in entrambe le direzioni. A parità di valore, usare il nome e infine l'ID per rendere il risultato deterministico.

### 17.4 Reset dei filtri

I filtri e gli ordinamenti non devono essere ripristinati dopo la riapertura dell'app. Un filtro aperto dalla dashboard può essere applicato durante la sessione corrente.

---

## 18. Dettaglio dello stand

Nel dettaglio di uno stand, la sezione prodotti deve mostrare soltanto i prodotti:

- del profilo attivo;
- dell'evento attivo;
- collegati a quello stand.

L'elenco può includere nome, categoria, prezzo, voto e preferito quando disponibili.

Dal dettaglio deve essere possibile aprire la scheda prodotto, modificarla e aggiungerne una nuova.

Se uno stand non ha prodotti registrati, mostrare uno stato vuoto utile e il comando di aggiunta, senza simulare prodotti suggeriti.

---

## 19. Confronto tra prodotti

### 19.1 Disponibilità

Il confronto affiancato è previsto **solo su desktop**. Su mobile la funzionalità non deve essere presentata come disponibile.

### 19.2 Vincolo categoria

Si possono confrontare soltanto prodotti con lo **stesso `categoryId`**. La regola più sicura è confrontare l'ID esatto, non categorie genericamente simili.

### 19.3 Campi del confronto

| Campo | Confrontabile |
|---|---|
| Nome | Sì |
| Stand | Sì |
| Prezzo singolo | Sì, se presente |
| Valutazione generale | Sì, se presente |
| Risposte al questionario | Sì, quando disponibili |
| Preferito | Può essere indicato |
| Note | Eventuale espansione |
| Foto | Eventuale anteprima |

Le domande possono variare tra profili. Poiché la lista è personale, il confronto usa il questionario del profilo attivo e deve gestire domande mancanti o risposte non compilate.

### 19.4 Valori mancanti

Non sostituire i dati assenti con `0`, `No` o una risposta inventata. Mostrare **«Non indicato»** o equivalente.

La UI definitiva è descritta in `22-comparison.md`.

---

## 20. Dashboard ed export

### 20.1 Dashboard

Il numero di prodotti e il numero di preferiti sono calcolati **per profilo ed evento**.

Toccando il contatore dei prodotti si apre la lista generale; toccando i preferiti si apre la lista filtrata per preferiti.

### 20.2 Export JSON

L'export è **per profilo** e può includere tutti i prodotti o soltanto quelli di categorie selezionate, secondo `23-export.md`.

Non è prevista importazione/ripristino JSON nella v1.

### 20.3 Export PDF

Due modalità confermate:

1. **Riepilogo** con tabelle raggruppate per categoria/sottocategoria.
2. **Dettaglio** con schede prodotto, fotografie, note e domande/risposte.

Non è previsto export Excel.

### 20.4 Privacy del perimetro

L'export non deve includere dati di altri profili. L'assenza di autenticazione resta un limite di sicurezza dell'app: selezionare un profilo non prova l'identità dell'utente.

---

## 21. Validazioni del dominio

### 21.1 Regole obbligatorie

| ID | Regola |
|---|---|
| PRD-001 | `id` univoco |
| PRD-002 | `profileId` esistente |
| PRD-003 | `eventId` esistente |
| PRD-004 | `standRef` esistente e coerente con profilo/evento |
| PRD-005 | `name` non vuoto |
| PRD-006 | `categoryId` presente e valido |
| PRD-007 | Una sola categoria |
| PRD-008 | Categoria immutabile dopo primo Salva |
| PRD-009 | Prezzo assente oppure valido e non negativo |
| PRD-010 | Rating assente oppure intero 1–10 |
| PRD-011 | `isFavorite` booleano |
| PRD-012 | Note testuali se presenti |
| PRD-013 | Foto riferite al prodotto/profilo corretti |
| PRD-014 | Risposte coerenti con questionario applicabile |
| PRD-015 | Aggiornamento condizionato alla revisione |
| PRD-016 | Nessuna perdita silenziosa in caso di conflitto |

### 21.2 Validazione in più livelli

**UI:** feedback immediato sui campi.

**Dominio locale:** regole indipendenti dai componenti React.

**Repository IndexedDB:** transazioni atomiche, vincoli e gestione delle revisioni locali.

**API server:** validazione completa di payload e riferimenti; il client non è una fonte attendibile.

**Database:** vincoli di integrità e versionamento, nei limiti delle possibilità dello schema.

---

## 22. Gestione delle revisioni e dei conflitti

### 22.1 Concorrenza

Scenario: due dispositivi aprono lo stesso prodotto dello stesso profilo e modificano note o voto prima di sincronizzarsi.

Non applicare **last-write-wins** silenzioso.

### 22.2 Flusso proposto

1. Ogni modifica confermata è associata a una revisione di base.
2. Il server controlla che la revisione sia ancora corrente.
3. Se non lo è, restituisce un conflitto con entrambe le versioni.
4. Il client conserva le due versioni e mostra un'interfaccia di confronto.
5. L'utente sceglie quale versione mantenere.
6. La risoluzione genera una nuova revisione sincronizzabile.

Non cancellare la versione perdente prima della risoluzione. I dettagli di API, storage e interfaccia sono in `20-synchronization.md`.

### 22.3 Indicatore di stato

La UI distingue:

- Salvataggio mobile automatico locale e outbox per valori validi, senza modalità bozza o conferma Salva finale; input invalidi conservati localmente secondo §5.1 del documento 27.
- **salvato localmente, sync in attesa**;
- **sincronizzato**;
- **errore di sync**;
- **conflitto da risolvere**.

Il fatto che un prodotto sia consultabile offline non implica che sia già presente sul server.

---

## 23. Modello TypeScript suggerito

```ts
export type StandRef = {
  source: "catalog" | "personal";
  standId: string;
};

export interface Money {
  amountMinor: number;
  currency: "EUR";
}

export interface ObservedProduct {
  id: string;
  profileId: string;
  eventId: string;
  standRef: StandRef;
  name: string;
  categoryId: string;
  price?: Money;
  rating?: number;
  isFavorite: boolean;
  notes?: string;
  photoIds: string[];
  // Forma definitiva delle risposte da definire nel motore questionari
  answers: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  revision: string;
}
```

Questa interfaccia è **illustrativa**. La forma definitiva di `answers`, `revision` e `Money` richiede i contratti dei moduli dedicati.

### 23.1 Creazione

```ts
export type CreateProductInput = {
  standRef: StandRef;
  name: string;
  categoryId: string;
  price?: Money;
  rating?: number;
  isFavorite?: boolean;
  notes?: string;
};
```

`profileId` ed `eventId` devono essere acquisiti dal contesto attivo e validati. Non fidarsi ciecamente di un ID di profilo fornito da un componente o payload.

### 23.2 Aggiornamento

```ts
export type UpdateProductInput = Partial<{
  name: string;
  price: Money | null;
  rating: number | null;
  isFavorite: boolean;
  notes: string;
}>;
```

`categoryId` è volutamente assente. È necessario anche il controllo runtime/server, perché un payload JSON può contenere proprietà aggiuntive.

### 23.3 Vincoli monetari

Se si usa `amountMinor`, verificare che sia un **intero sicuro** (`Number.isSafeInteger`) e non negativo. Evitare conversioni con arrotondamenti impliciti non documentati.

---

## 24. Struttura dei moduli consigliata

<details>
<summary>Esempio della progettazione precedente: gestione bozze superata nel mobile (non implementare)</summary>

```text
src/features/products/
├── components/
│   ├── ProductList.tsx
│   ├── ProductCard.tsx
│   ├── ProductDetails.tsx
│   ├── ProductForm.tsx
│   ├── ProductFilters.tsx
│   ├── ProductRating.tsx
│   ├── ProductPhotos.tsx
│   └── ProductDeleteDialog.tsx
├── domain/
│   ├── product-types.ts
│   ├── product-validation.ts
│   ├── product-rules.ts
│   ├── product-filters.ts
│   └── product-sort.ts
├── data/
│   └── product-repository.ts
└── hooks/
    ├── useProducts.ts
    └── useProductDraft.ts

src/lib/offline/
├── indexeddb.ts
└── draft-store.ts

src/lib/sync/
├── sync-queue.ts
└── conflict-resolution.ts
```

</details>

I nomi sono indicativi e vanno armonizzati con `02-project-structure.md`. Non creare file vuoti solo per rispettare questo elenco.

---

## 25. Test di accettazione

| ID | Scenario | Risultato atteso |
|---|---|---|
| T-PRD-01 | Creazione senza nome | Errore, bozza preservata |
| T-PRD-02 | Creazione senza categoria | Errore, bozza preservata |
| T-PRD-03 | Cambio categoria prima del primo Salva | Consentito |
| T-PRD-04 | Cambio categoria dopo Salva locale | Rifiutato |
| T-PRD-05 | Payload API tenta cambio categoria | Rifiutato |
| T-PRD-06 | Stand editoriale valido | Collegamento consentito |
| T-PRD-07 | Stand personale del profilo | Collegamento consentito |
| T-PRD-08 | Stand personale di altro profilo | Collegamento rifiutato |
| T-PRD-09 | Prezzo assente | Valido |
| T-PRD-10 | Prezzo zero | Valido, distinto da assente |
| T-PRD-11 | Prezzo negativo | Errore |
| T-PRD-12 | Rating assente | Valido |
| T-PRD-13 | Rating 1 | Valido |
| T-PRD-14 | Rating 10 | Valido |
| T-PRD-15 | Rating 0 o 11 | Errore |
| T-PRD-16 | Rating decimale | Errore per v1 proposta |
| T-PRD-17 | Preferito modificato | Stato aggiornato solo nel profilo |
| T-PRD-18 | Questionario non configurato | Sezione nascosta |
| T-PRD-19 | Questionario configurato | Domande corrette per profilo/categoria |
| T-PRD-20 | Domande lasciate vuote | Salvataggio consentito |
| T-PRD-21 | Foto multiple offline | Persistenti dopo Salva |
| T-PRD-22 | Bozza senza Salva | Non entra nella coda sync |
| T-PRD-23 | Salva offline | Record + operazione pendente |
| T-PRD-24 | Errore IndexedDB | Nessun falso successo |
| T-PRD-25 | Ritorno online | Retry della coda |
| T-PRD-26 | Due dispositivi modificano lo stesso prodotto | Conflitto manuale |
| T-PRD-27 | Cambio profilo | Nessuna contaminazione di dati |
| T-PRD-28 | Lista generale | Prodotti di tutti gli stand del profilo/evento |
| T-PRD-29 | Filtro preferiti | Solo preferiti del profilo |
| T-PRD-30 | Ricerca nome | Matching case-insensitive |
| T-PRD-31 | Sort prezzo con prezzo mancante | Mancanti in fondo (proposta) |
| T-PRD-32 | Sort voto con voto mancante | Mancanti in fondo (proposta) |
| T-PRD-33 | Confronto desktop stessa categoria | Consentito |
| T-PRD-34 | Confronto categorie diverse | Impedito |
| T-PRD-35 | Confronto su smartphone | Non disponibile |
| T-PRD-36 | Eliminazione prodotto | Conferma richiesta |
| T-PRD-37 | Eliminazione prodotto | Stand e altri prodotti preservati |
| T-PRD-38 | Rinomina stand editoriale | Prodotto ancora collegato |
| T-PRD-39 | Export JSON | Solo profilo attivo |
| T-PRD-40 | Export PDF dettagliato | Foto, note e risposte se presenti |
| T-PRD-41 | Riapertura app | Filtri resettati |
| T-PRD-42 | Statistiche dashboard | Conteggi corretti per profilo/evento |

---

## 26. Decisioni tecniche ancora aperte

| Tema | Proposta attuale | Documento che deve finalizzarla |
|---|---|---|
| Formato monetario | `amountMinor` in centesimi, `EUR` | `12-database.md`, `13-backend-api.md` |
| Identificativi | UUID/ULID generati offline | `12-database.md` |
| Forma delle risposte | Mappa per ID domanda/versione | `10-questionnaires-config.md`, `18-questionnaire-engine.md` |
| Riferimento stand | Oggetto `source` + `standId` | `12-database.md` |
| Stand modificabile dopo Salva | Proposta: no | `17-product-management.md` |
| Ereditarietà questionario | **Non definita** | `10`, `18` |
| Budget padre/figlio | **Non definito** | `06`, `17` |
| Categorie senza più definizione | Migrazione o riferimento storico | `12`, `20` |
| Eliminazione stand con prodotti | Da decidere | `16`, `17` |
| Foto offline | IndexedDB + storage media | `19`, `21` |
| Revisione/conflitti | Optimistic concurrency e scelta manuale | `13`, `20` |
| Ordinamento dei mancanti | In fondo | `17` |
| Limite di lunghezza nome | Proposta: 200 caratteri | `17` |
| Dimensioni massime foto | Da definire | `21` |

Le proposte non devono essere interpretate come approvazioni automatiche.

---

## 27. Criteri di completamento

- [ ] I prodotti sono record dinamici, non un catalogo JSON statico obbligatorio.
- [ ] Ogni prodotto ha ID, profilo, evento, stand, nome e una categoria.
- [ ] La categoria è scelta manualmente e bloccata dopo il primo Salva.
- [ ] Il prezzo è singolo e facoltativo.
- [ ] La valutazione generale è facoltativa e indipendente dal questionario.
- [ ] I preferiti sono personali.
- [ ] Note, fotografie e risposte sono personali e funzionano offline.
- [ ] Non vengono generate domande in assenza di JSON dedicato.
- [ ] Il prodotto compare sia nello stand sia nella lista generale.
- [ ] Ricerca, filtri e ordinamento funzionano.
- [ ] Il confronto è disponibile solo su desktop e per stessa categoria.
- Salvataggio mobile automatico locale e outbox per valori validi, senza modalità bozza o conferma Salva finale; input invalidi conservati localmente secondo §5.1 del documento 27.
- [ ] Il primo Salva offline è possibile.
- Concorrenza mobile LWW per record in ordine di accettazione server; revisioni monotone, idempotenza e protezione delle tombstone.
- [ ] L'eliminazione richiede conferma.
- [ ] L'export è per profilo e supporta JSON/PDF, non Excel.
- [ ] Nessun dato personale viene trasferito ad altri profili per errore.

---

## 28. Prossimo documento

**[`09-interests-config.md`](09-interests-config.md)** definirà i file `config/interests/me.json` e `config/interests/father.json`: priorità personali 1–10, liste «cosa vedere», riferimenti agli stand, precedenza tra valori editoriali e modifiche salvate, gestione degli stand personali e validazione.

**Nota:** nessun `config/products.json` deve essere creato sulla base di questo documento. Le entità prodotto saranno implementate nel database e nella memoria offline.
