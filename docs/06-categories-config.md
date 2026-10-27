# 06 — Configurazione delle categorie (`config/categories.json`)

> **Progetto:** ExpoTrack · **Contratto proposto:** versione `1` · **Stato:** specifica tecnica per la v1  
> **Documenti precedenti:** [`00-overview.md`](00-overview.md), [`01-architecture.md`](01-architecture.md), [`02-project-structure.md`](02-project-structure.md), [`03-app-config.md`](03-app-config.md), [`04-profiles-config.md`](04-profiles-config.md), [`05-pavilions-config.md`](05-pavilions-config.md)  
> **Documento successivo:** [`07-stands-config.md`](07-stands-config.md)

---

## 1. Obiettivo

`config/categories.json` definisce il **catalogo editoriale condiviso delle categorie e sottocategorie** utilizzate da ExpoTrack. Le categorie servono a classificare stand, prodotti osservati, budget personali e questionari. Il catalogo è configurabile tramite JSON e non contiene dati personali.

Le categorie formano un **albero a profondità arbitraria**, anche se nell'uso pratico si prevedono due o tre livelli. Non è necessario creare file separati per ogni livello.

### 1.1 Requisiti funzionali confermati

1. Ogni categoria ha un identificativo stabile e un nome leggibile.
2. Una categoria può avere una categoria padre (`parentId`) oppure essere di primo livello.
3. L'ordinamento editoriale (`sortOrder`) è facoltativo; in assenza si usa l'ordine alfabetico.
4. **Uno stand può appartenere a più categorie** contemporaneamente.
5. **Ogni prodotto appartiene a una sola categoria o sottocategoria**, scelta manualmente al momento della creazione.
6. **La categoria del prodotto diventa immutabile dopo il primo salvataggio esplicito**; non deve essere modificabile neppure tramite API o sincronizzazione.
7. I questionari sono definiti **per profilo e categoria/sottocategoria**, mai come questionari comuni a tutti.
8. I budget dei profili possono riferirsi a categorie e sottocategorie, senza budget totale.
9. Le categorie devono poter essere usate per filtrare stand, prodotti ed esportazioni.
10. Il sistema deve funzionare offline dopo il primo caricamento della configurazione.

### 1.2 Confini

Questo file non contiene prodotti, note, priorità degli stand, risposte ai questionari, budget, prezzi o fotografie. Non definisce neppure quali domande porre: il motore questionari e le definizioni personali sono trattati nei documenti `10` e `18`.

---

## 2. Collocazione nel progetto

```text
ExpoTrack/
├── README.md
├── docs/
│   ├── 06-categories-config.md       ← questo documento
│   ├── 07-stands-config.md
│   ├── 08-products-config.md
│   ├── 10-questionnaires-config.md
│   └── 17-product-management.md
└── config/
    ├── app.json
    ├── profiles.json
    ├── categories.json              ← file descritto qui
    ├── events/
    │   └── eicma-2026-stands.json
    └── questionnaires/
        ├── me.json
        └── father.json
```

`app.json` fa riferimento al catalogo tramite `configFiles.categories`. Nella v1, il file è **globale all'app** e può essere riutilizzato tra eventi. L'eventuale introduzione futura di categorie specifiche per evento richiederà un'evoluzione esplicita dello schema, non una modifica implicita.

---

## 3. Contratto JSON proposto

### 3.1 Esempio minimo valido

```json
{
  "schemaVersion": 1,
  "categories": []
}
```

Un catalogo vuoto è **strutturalmente valido** per bootstrap e test, ma non consente di registrare prodotti: la scelta di una categoria è obbligatoria. In un evento reale deve essere presente almeno una categoria utilizzabile prima di abilitare la creazione dei prodotti.

### 3.2 Esempio gerarchico illustrativo

```json
{
  "schemaVersion": 1,
  "categories": [
    {
      "id": "motorcycles",
      "name": "Moto",
      "sortOrder": 10
    },
    {
      "id": "naked-motorcycles",
      "name": "Naked",
      "parentId": "motorcycles",
      "sortOrder": 10
    },
    {
      "id": "touring-motorcycles",
      "name": "Touring",
      "parentId": "motorcycles",
      "sortOrder": 20
    },
    {
      "id": "rider-equipment",
      "name": "Abbigliamento e protezioni",
      "sortOrder": 20
    },
    {
      "id": "helmets",
      "name": "Caschi",
      "parentId": "rider-equipment",
      "sortOrder": 10
    },
    {
      "id": "full-face-helmets",
      "name": "Caschi integrali",
      "parentId": "helmets"
    },
    {
      "id": "modular-helmets",
      "name": "Caschi modulari",
      "parentId": "helmets"
    },
    {
      "id": "motorcycle-gloves",
      "name": "Guanti moto",
      "parentId": "rider-equipment",
      "sortOrder": 20
    }
  ]
}
```

L'esempio descrive **una possibile tassonomia**, non un catalogo definitivo degli interessi dell'utente né un elenco completo degli espositori EICMA. Gli ID `helmets` e `motorcycle-gloves` sono compatibili con gli esempi di budget del documento `04`.

### 3.3 Schema dei campi

| Percorso | Tipo | Obbligatorio | Regola |
|---|---|---|---|
| `schemaVersion` | intero | Sì | Deve essere `1` per il contratto corrente |
| `categories` | array | Sì | Può essere vuoto; ogni elemento è un oggetto |
| `categories[].id` | stringa | Sì | ID globale stabile e univoco, in formato slug |
| `categories[].name` | stringa | Sì | Nome leggibile e non vuoto |
| `categories[].parentId` | stringa | No | ID di una categoria esistente, diversa da sé stessa |
| `categories[].sortOrder` | intero | No | Posizione editoriale tra categorie sorelle |

**Politica proposta:** rifiutare i campi sconosciuti per individuare errori di battitura, coerentemente con `03`, `04` e `05`. Non aggiungere campi come `questions`, `price`, `budget` o `products` alle categorie.

---

## 4. Identificativi e regole di stabilità

### 4.1 ID univoci globali

Gli ID sono univoci nell'intero `categories.json`, non soltanto tra i figli dello stesso padre. Per esempio, `helmets` può comparire una sola volta.

Formato proposto: slug in minuscolo, lettere `a-z`, numeri `0-9` e trattino. Esempi validi: `helmets`, `full-face-helmets`, `category-2027`.

Regex di riferimento:

```regex
^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$
```

Il limite di 64 caratteri è una **proposta tecnica** da applicare in modo uniforme ai JSON e alle API.

### 4.2 Nome modificabile, ID stabile

È possibile rinominare `Caschi` in `Caschi moto` mantenendo `id: "helmets"`: prodotti, questionari, budget e stand continuano a puntare alla stessa categoria.

**Non rinominare un ID** per ragioni puramente estetiche. Se un ID deve cambiare, serve una migrazione esplicita che aggiorni tutti i riferimenti e preservi i dati già raccolti, inclusi quelli offline.

### 4.3 Identificatori non dipendenti dalla lingua

Usare ID tecnici stabili, non derivati dinamicamente dal nome visualizzato. Il testo può essere in italiano; gli ID possono essere in inglese per coerenza con il codice.

---

## 5. Gerarchia delle categorie

### 5.1 Radici e figli

Una categoria **senza `parentId`** è una radice. Una categoria con `parentId` è figlia della categoria indicata.

```text
Moto                              [motorcycles]
├── Naked                         [naked-motorcycles]
└── Touring                       [touring-motorcycles]

Abbigliamento e protezioni        [rider-equipment]
├── Caschi                        [helmets]
│   ├── Caschi integrali          [full-face-helmets]
│   └── Caschi modulari           [modular-helmets]
└── Guanti moto                   [motorcycle-gloves]
```

La profondità non deve essere codificata a due livelli: una categoria può avere figli che a loro volta hanno figli.

### 5.2 Validazioni dell'albero

Il loader deve rifiutare:

- `parentId` inesistente;
- `parentId` uguale all'ID della categoria;
- cicli diretti o indiretti (`A → B → C → A`);
- ID duplicati;
- nodi con nomi vuoti.

L'ordine degli elementi nell'array JSON **non** deve influire sulla costruzione dell'albero. Un figlio può comparire prima del padre nel file.

### 5.3 Nodi intermedi e foglie

**Proposta v1:** permettere di assegnare un prodotto a **qualunque nodo**, compresi quelli con figli. Questa scelta è coerente con il requisito «una categoria o sottocategoria» e permette di registrare un prodotto anche quando non è nota una classificazione più specifica.

Esempio: un casco può essere classificato come `helmets` se non si vuole scegliere `full-face-helmets` o `modular-helmets`.

Non imporre l'obbligo di scegliere sempre una foglia senza una decisione funzionale esplicita.

### 5.4 Categorie con lo stesso nome

Si possono avere nomi simili sotto padri differenti, purché gli ID siano univoci. La UI deve mostrare il **percorso completo** quando il nome da solo sarebbe ambiguo.

Esempio di presentazione: `Abbigliamento e protezioni / Caschi / Caschi integrali`.

---

## 6. Ordinamento

### 6.1 Regola proposta

L'ordinamento viene applicato **tra fratelli dello stesso padre**, non globalmente a tutti i nodi:

1. categorie con `sortOrder` definito, in ordine crescente;
2. a parità di `sortOrder`, ordine alfabetico naturale di `name`;
3. categorie senza `sortOrder`, dopo quelle con ordine esplicito, in ordine alfabetico naturale.

Per la localizzazione italiana usare, dove opportuno, `Intl.Collator("it-IT", { numeric: true, sensitivity: "base" })`.

### 6.2 `sortOrder` non deve essere unico

Due categorie sorelle possono avere lo stesso `sortOrder`; in quel caso si usa il nome come criterio secondario. È consigliabile distanziare i valori (`10`, `20`, `30`) per poter inserire nuove categorie senza rinumerare tutto.

### 6.3 Coerenza tra schermate

Il selettore categoria, i filtri, il confronto desktop e gli export devono usare la stessa gerarchia e lo stesso ordinamento, salvo esigenze esplicite della schermata.

---

## 7. Collegamento agli stand

### 7.1 Più categorie per stand

Ogni stand del catalogo può avere un array di ID categoria:

```json
{
  "id": "stand-demo",
  "name": "Espositore dimostrativo",
  "categories": ["helmets", "motorcycle-gloves"]
}
```

È un esempio fittizio. Il contratto completo del catalogo stand è definito in `07-stands-config.md`.

Regole:

- ogni ID nell'array deve esistere in `categories.json`;
- niente duplicati nello stesso array;
- lo stand può appartenere a categorie di rami diversi;
- il fatto che uno stand appartenga a una categoria **non impone** la categoria dei suoi prodotti;
- gli stand privati creati nell'app seguono le stesse regole di validazione, senza diventare pubblici agli altri profili.

### 7.2 Categoria padre e discendenti nei filtri

**Proposta v1:** quando si filtra per una categoria padre, includere gli stand assegnati direttamente al padre **oppure a qualsiasi suo discendente**.

Esempio: selezionare `Abbigliamento e protezioni` deve trovare uno stand associato a `Caschi integrali`.

Se uno stand appartiene a due sottocategorie dello stesso ramo, deve comparire **una sola volta** nei risultati.

### 7.3 Categoria assente in uno stand

Il catalogo stand ha un array `categories` secondo il requisito generale, ma non è ancora stato deciso se un array vuoto sia valido. La policy precisa sarà definita in `07-stands-config.md`. Non introdurre una categoria inventata solo per soddisfare un campo obbligatorio.

---

## 8. Collegamento ai prodotti

### 8.1 Una sola categoria

Ogni prodotto osservato ha un singolo `categoryId`:

```json
{
  "name": "Casco dimostrativo",
  "categoryId": "full-face-helmets"
}
```

Questo frammento è **illustrativo**, non il modello completo del prodotto. Il prodotto deve anche essere collegato a uno stand e a un profilo, secondo `08-products-config.md` e `12-database.md`.

Non usare un array `categories` sul prodotto.

### 8.2 Scelta manuale

L'utente deve scegliere la categoria durante la creazione del prodotto. È possibile precompilare un suggerimento quando lo stand appartiene a una sola categoria, ma **la scelta deve essere esplicita** e confermata prima del primo salvataggio.

Non classificare automaticamente il prodotto sulla base del nome dello stand, di una foto o di una domanda del questionario.

### 8.3 Immutabilità dopo il primo salvataggio

Una volta che l'utente preme **Salva** per la prima volta:

- `categoryId` diventa immutabile;
- la UI mostra la categoria come sola lettura;
- le API rifiutano tentativi di modifica;
- la sincronizzazione rifiuta operazioni che cambiano la categoria;
- una modifica offline non deve poter aggirare il vincolo.

**Distinzione importante:** durante la compilazione della **bozza non ancora salvata**, la categoria può essere cambiata. L'immutabilità scatta al primo salvataggio esplicito, anche se il dispositivo è offline e la sincronizzazione server non è ancora avvenuta.

Se un prodotto è stato classificato erroneamente dopo il salvataggio, la soluzione v1 è **creare un nuovo prodotto nella categoria corretta** ed eventualmente eliminare il vecchio con conferma, non modificare `categoryId`.

### 8.4 Filtri dei prodotti

La lista generale dei prodotti deve poter filtrare per categoria, stand e preferiti. Si propone che il filtro su un nodo padre includa anche i prodotti delle sottocategorie discendenti, coerentemente con il filtro stand.

Un prodotto viene conteggiato una sola volta, anche quando il filtro include più livelli della gerarchia.

---

## 9. Collegamento ai questionari

I questionari sono **specifici per profilo e categoria/sottocategoria**. Due profili possono avere domande e opzioni di risposta completamente diverse per la stessa categoria.

Esempio concettuale:

```text
Profilo me + categoria full-face-helmets
  → domande dedicate a me per i caschi integrali

Profilo father + categoria full-face-helmets
  → domande dedicate a father per i caschi integrali
```

Se non esiste un questionario per la coppia `(profileId, categoryId)`, la sezione **non compare**. Non generare domande generiche e non copiare quelle di altri profili.

### 9.1 Ereditarietà dei questionari

**Questione aperta da risolvere in `10-questionnaires-config.md`:** una definizione su una categoria padre si applica automaticamente ai figli?

Per evitare comportamenti non richiesti, la **proposta prudente per la v1 è il matching esatto** su `categoryId`: un questionario su `helmets` non appare automaticamente su `full-face-helmets`.

Un eventuale fallback al padre dovrà essere esplicito, documentato e testato. Non implementarlo implicitamente.

### 9.2 Categoria e risposte esistenti

Rinominare una categoria mantenendo il suo ID non altera le risposte. Rimuovere o spostare un nodo già usato può cambiare la visualizzazione dei questionari: richiede compatibilità o migrazione esplicita.

---

## 10. Collegamento ai budget

I budget personali sono definiti in `config/profiles.json`, **non** in `categories.json`. Ogni budget punta a un `categoryId` esistente.

Esempio:

```json
{
  "categoryId": "helmets",
  "amount": 350,
  "currency": "EUR"
}
```

L'importo è un riferimento personale e **non** un budget complessivo della fiera. Non deve essere scalato automaticamente quando si registra un prodotto: osservare un prodotto non equivale ad acquistarlo.

### 10.1 Budget su padre e figlio

Può esistere un budget per `helmets` e un altro per `full-face-helmets`.

**Proposta da confermare:** usare prima il budget della categoria esatta; se assente, cercare il budget del più vicino antenato. Se non esiste alcun budget, non mostrare un valore artificiale pari a zero.

Questa scelta deve essere definita definitivamente insieme a `17-product-management.md`, mantenendo i calcoli monetari in centesimi interi o in un tipo decimale appropriato.

---

## 11. Categorie e supporto multi-evento

Nella struttura attuale `categories.json` è condiviso da tutti gli eventi. Questa soluzione semplifica l'app e consente di riutilizzare categorie come `Caschi`, `Guanti`, `Moto` in fiere differenti.

### 11.1 Conseguenze

- gli ID categoria sono **globali**;
- gli stand di ogni evento possono riferirsi alle stesse categorie;
- i prodotti restano separati per `(profileId, eventId)` anche quando condividono il `categoryId`;
- i questionari sono legati al profilo e alla categoria, secondo il contratto da definire; l'eventuale specificità per evento è ancora aperta.

### 11.2 Categorie specifiche di un evento

Se una fiera futura richiede categorie non pertinenti alle altre, nella v1 si possono comunque aggiungere al catalogo globale. **Da decidere in futuro:** un campo facoltativo di ambito evento o cataloghi per evento. Non introdurre ora `eventId` nel modello categoria senza una decisione esplicita, perché cambierebbe il contratto di `03-app-config.md`.

---

## 12. Validazione strutturale e referenziale

### 12.1 Regole del file

| ID | Verifica | Comportamento |
|---|---|---|
| CAT-001 | JSON sintatticamente valido | Errore se invalido |
| CAT-002 | Root oggetto | Errore se invalido |
| CAT-003 | `schemaVersion === 1` | Errore se invalido |
| CAT-004 | `categories` array | Errore se invalido |
| CAT-005 | Ogni elemento è un oggetto | Errore se invalido |
| CAT-006 | `id` non vuoto e in formato slug | Errore se invalido |
| CAT-007 | ID univoci globalmente | Errore se duplicati |
| CAT-008 | `name` stringa non vuota | Errore se invalido |
| CAT-009 | `parentId` stringa valida se presente | Errore se invalido |
| CAT-010 | `parentId` esistente | Errore se sconosciuto |
| CAT-011 | `parentId !== id` | Errore se autoreferenziale |
| CAT-012 | Nessun ciclo nell'albero | Errore se ciclico |
| CAT-013 | `sortOrder` intero se presente | Errore se invalido |
| CAT-014 | Nessuna proprietà sconosciuta | Errore, politica proposta |

### 12.2 Riferimenti incrociati

Il validatore completo deve verificare anche:

- `profiles[].budgets[].categoryId` esistente;
- `stands[].categories[]` contenente solo ID esistenti;
- definizioni dei questionari riferite a categorie esistenti;
- record dinamici di prodotti con `categoryId` valido rispetto allo snapshot applicabile;
- nessun cambio silenzioso di `categoryId` su prodotti già salvati.

Le regole dei record dinamici vanno applicate **anche lato server**, non solo nel form React.

### 12.3 Esempi di errore

```text
CONFIG_DUPLICATE_CATEGORY
File: config/categories.json
Campo: $.categories[4].id
Problema: l'ID "helmets" è già presente.
```

```text
CONFIG_UNKNOWN_PARENT
File: config/categories.json
Campo: $.categories[2].parentId
Problema: la categoria padre "missing-category" non esiste.
```

```text
CONFIG_CATEGORY_CYCLE
File: config/categories.json
Problema: ciclo rilevato: a → b → c → a.
```

```text
PRODUCT_CATEGORY_IMMUTABLE
Campo: categoryId
Problema: la categoria di un prodotto già salvato non può essere modificata.
```

---

## 13. Modelli TypeScript proposti

```ts
export interface CategoryConfigItem {
  id: string;
  name: string;
  parentId?: string;
  sortOrder?: number;
}

export interface CategoriesConfig {
  schemaVersion: 1;
  categories: CategoryConfigItem[];
}
```

Sono tipi statici: i dati letti dal JSON e le richieste API devono essere **validati a runtime**.

### 13.1 Modello derivato per la UI

```ts
export interface CategoryNode extends CategoryConfigItem {
  children: CategoryNode[];
  depth: number;
  pathIds: string[];
  pathNames: string[];
}
```

`children`, `depth`, `pathIds` e `pathNames` sono **dati calcolati**, non campi da duplicare nel JSON.

### 13.2 Funzioni di dominio suggerite

```ts
function validateCategoryTree(categories: CategoryConfigItem[]): void;
function buildCategoryTree(categories: CategoryConfigItem[]): CategoryNode[];
function getCategoryAncestors(id: string): string[];
function getCategoryDescendants(id: string): string[];
function isCategoryInSubtree(categoryId: string, selectedId: string): boolean;
function getCategoryDisplayPath(id: string): string;
```

Le firme sono illustrative. Le funzioni devono gestire in modo deterministico riferimenti mancanti, duplicati e cicli, evitando ricorsione infinita.

### 13.3 Complessità

Per cataloghi di dimensione non banale, costruire una mappa `id → categoria` e un indice `parentId → figli`. Evitare di scansionare tutto l'array a ogni rendering. Calcolare una sola volta gli alberi per ogni snapshot di configurazione valido.

---

## 14. Struttura del codice suggerita

```text
src/lib/config/
├── categories-schema.ts
├── categories-loader.server.ts
└── validate-references.server.ts

src/features/categories/
├── domain/
│   ├── category-types.ts
│   ├── category-tree.ts
│   └── category-rules.ts
├── components/
│   ├── CategoryPicker.tsx
│   ├── CategoryFilter.tsx
│   └── CategoryBreadcrumb.tsx
└── hooks/
    └── useCategories.ts

tests/
├── unit/categories/
└── integration/categories/
```

È una struttura **proposta**; creare solo i moduli necessari. La logica di dominio deve essere riutilizzabile da UI, API, export e test.

---

## 15. Caricamento e uso offline

1. Il server legge `app.json` e risolve `configFiles.categories`.
2. Carica `categories.json` e valida struttura, unicità e albero.
3. Valida i riferimenti da profili, stand e questionari.
4. Genera uno snapshot editoriale coerente e versionato.
5. Il client memorizza lo snapshot in IndexedDB dopo il primo caricamento online.
6. In assenza di rete, usa la configurazione valida già memorizzata.
7. Una nuova configurazione viene applicata **atomicamente** soltanto dopo validazione completa.

Se l'utente non ha mai caricato l'app e non esiste cache offline, mostrare un errore esplicito. Non sostituire una configurazione mancante con categorie inventate.

### 15.1 Bozze e categorie

La bozza di un prodotto deve conservare il `categoryId` scelto anche offline. Al primo **Salva**, il record diventa confermato localmente e la categoria viene bloccata, anche se la sincronizzazione è ancora pendente.

### 15.2 Aggiornamento mentre esistono prodotti

Se un amministratore rimuove una categoria usata da prodotti o questionari:

- non cancellare i prodotti;
- non spostarli automaticamente in un'altra categoria;
- non cancellare le risposte;
- non riscrivere le bozze;
- applicare una migrazione documentata o mantenere un riferimento storico leggibile.

La strategia di compatibilità tra snapshot è da definire nei documenti `12-database.md`, `19-offline-storage.md` e `20-synchronization.md`.

---

## 16. UI e accessibilità

### 16.1 Selettore categoria per prodotto

Su smartphone è consigliato un selettore gerarchico che permetta di navigare dalle categorie radice alle sottocategorie. Deve sempre essere possibile capire **quale categoria esatta** si sta selezionando.

- Non basarsi solo su rientri o colori.
- Mostrare il percorso completo prima di salvare.
- Consentire ricerca testuale per nome categoria.
- Distinguere categorie con nomi simili tramite il percorso.
- Dopo il salvataggio, mostrare la categoria in sola lettura.

La progettazione visuale definitiva è in `14-frontend-ui.md`.

### 16.2 Filtri

Nei filtri stand/prodotti, un nodo padre include i discendenti secondo la proposta del §7.2. L'utente deve poter azzerare il filtro. Filtri e ordinamenti **non persistono** alla riapertura dell'app.

### 16.3 Esportazioni

L'export JSON e i due formati PDF devono poter includere tutte le categorie o soltanto quelle selezionate. Il raggruppamento deve rispettare la gerarchia e mostrare etichette comprensibili. Il formato preciso è definito in `23-export.md`.

### 16.4 Confronto prodotti

Il confronto affiancato è previsto **solo desktop** e soltanto tra prodotti della **stessa categoria**. Interpretazione proposta per la v1: **stesso `categoryId` esatto**, non semplicemente stesso ramo dell'albero. In questo modo i questionari confrontati sono omogenei.

Un eventuale confronto tra categorie sorelle deve essere una funzionalità esplicita futura, non un comportamento implicito.

---

## 17. Scenari di test

| ID | Scenario | Risultato atteso |
|---|---|---|
| TEST-CAT-01 | JSON minimo con array vuoto | Strutturalmente valido |
| TEST-CAT-02 | Due categorie con stesso ID | Errore |
| TEST-CAT-03 | Nome categoria vuoto | Errore |
| TEST-CAT-04 | `parentId` inesistente | Errore |
| TEST-CAT-05 | Categoria padre uguale a sé stessa | Errore |
| TEST-CAT-06 | Ciclo indiretto su tre categorie | Errore |
| TEST-CAT-07 | Figlio prima del padre nell'array | Albero costruito correttamente |
| TEST-CAT-08 | Gerarchia a quattro livelli | Supportata |
| TEST-CAT-09 | Ordinamento senza `sortOrder` | Alfabetico naturale |
| TEST-CAT-10 | `sortOrder` duplicato tra fratelli | Ordinamento secondario per nome |
| TEST-CAT-11 | Stand con due categorie valide | Valido |
| TEST-CAT-12 | Stand con categoria inesistente | Errore di validazione |
| TEST-CAT-13 | Filtro categoria padre sugli stand | Include i discendenti, senza duplicati |
| TEST-CAT-14 | Prodotto con un solo `categoryId` | Valido |
| TEST-CAT-15 | Prodotto senza categoria al salvataggio | Salvataggio rifiutato |
| TEST-CAT-16 | Cambio categoria durante bozza | Consentito |
| TEST-CAT-17 | Cambio categoria dopo Salva offline | Rifiutato |
| TEST-CAT-18 | Cambio categoria tramite API | Rifiutato |
| TEST-CAT-19 | Cambio categoria tramite sincronizzazione | Rifiutato |
| TEST-CAT-20 | Profilo senza questionario per categoria | Nessuna sezione questionario |
| TEST-CAT-21 | Questionario di altro profilo | Non mostrato |
| TEST-CAT-22 | Rinomina categoria con stesso ID | Dati e riferimenti preservati |
| TEST-CAT-23 | Rimozione categoria referenziata | Nessuna perdita silenziosa |
| TEST-CAT-24 | Budget riferito a categoria inesistente | Errore di configurazione |
| TEST-CAT-25 | Uso offline dopo bootstrap | Categorie disponibili |
| TEST-CAT-26 | Snapshot nuovo invalido | Snapshot precedente mantenuto |
| TEST-CAT-27 | Confronto di prodotti con ID categoria diversi | Non consentito nella v1 proposta |
| TEST-CAT-28 | Export con selezione di un ramo | Include prodotti delle categorie selezionate secondo le regole export |

---

## 18. Decisioni tecniche da confermare

| Tema | Proposta | Documento di approfondimento |
|---|---|---|
| Catalogo vuoto | Valido per bootstrap, non per registrare prodotti | `06`, `17` |
| ID | Slug globalmente univoci | `06` |
| Assegnazione prodotto | Consentita anche a categorie non foglia | `08`, `17` |
| Filtri su categoria padre | Includere tutti i discendenti | `14`, `16`, `17` |
| Questionari su categorie padre | **Nessuna ereditarietà implicita**, matching esatto | `10`, `18` |
| Budget su categoria padre | Fallback all'antenato più vicino, da confermare | `04`, `17` |
| Confronto prodotti | Stesso `categoryId` esatto | `22` |
| Categorie specifiche per evento | Non previste nel contratto v1 | `03`, `06` |
| Gestione rimozione ID | Migrazione esplicita o storico | `12`, `20` |
| Campi sconosciuti | Rifiuto dal validatore | `03`, `06` |

Le decisioni di questa tabella **non devono essere spacciate per requisiti già approvati**. Il documento propone un comportamento concreto per rendere possibile l'implementazione, lasciando visibili le scelte da finalizzare.

---

## 19. Criteri di accettazione

- [ ] `config/categories.json` è indipendente da prodotti, questionari e budget.
- [ ] Il file supporta categorie radice e sottocategorie a profondità arbitraria.
- [ ] Gli ID sono univoci e i riferimenti `parentId` sono validati.
- [ ] I cicli gerarchici vengono rifiutati.
- [ ] L'ordine editoriale e quello alfabetico funzionano.
- [ ] Uno stand può appartenere a più categorie.
- [ ] Un prodotto può avere **esattamente una categoria**.
- [ ] La categoria del prodotto è modificabile nella bozza ma **immutabile dopo il primo Salva**.
- [ ] L'immutabilità è garantita anche da API e sincronizzazione.
- [ ] Questionari e budget fanno riferimento a ID categoria validi.
- [ ] Non vengono creati questionari comuni o automatici.
- [ ] I filtri per categoria funzionano su stand e prodotti.
- [ ] La configurazione è utilizzabile offline dopo il primo bootstrap.
- [ ] Gli aggiornamenti editoriali non cancellano dati personali.
- [ ] L'export e il confronto rispettano le regole di categoria definite.

---

## 20. Prossimo documento

**[`07-stands-config.md`](07-stands-config.md)** definirà `config/events/eicma-2026-stands.json`: ID e nomi degli espositori, padiglioni e codici stand facoltativi, descrizioni, associazione a più categorie, validazioni, informazioni verificate e distinzione fra catalogo condiviso e stand personali creati durante la visita.

**Nota operativa:** questo README specifica il contratto; la creazione di `config/categories.json` reale verrà effettuata separatamente, quando saranno stati definiti gli ID delle categorie da usare nei cataloghi e nei questionari.
