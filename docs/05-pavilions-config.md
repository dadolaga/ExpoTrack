# 05 — Configurazione dei padiglioni (`config/pavilions.json`)

> **Progetto:** ExpoTrack · **Contratto proposto:** versione `1` · **Stato:** specifica tecnica per la v1  
> **Documenti precedenti:** [`00-overview.md`](00-overview.md), [`01-architecture.md`](01-architecture.md), [`02-project-structure.md`](02-project-structure.md), [`03-app-config.md`](03-app-config.md), [`04-profiles-config.md`](04-profiles-config.md)  
> **Documento successivo:** [`06-categories-config.md`](06-categories-config.md)

---

## 1. Obiettivo

`config/pavilions.json` definisce l'elenco **editoriale dei padiglioni o delle aree espositive** delle fiere gestite da ExpoTrack. Serve a collegare gli stand a una posizione organizzativa, mostrare etichette comprensibili e permettere ricerca, filtro e ordinamento.

Non è una mappa navigabile: ExpoTrack **non pianifica percorsi**, non calcola distanze e non fornisce indicazioni turn-by-turn. L'eventuale posizione di uno stand è un dato descrittivo e può essere sconosciuta.

Il file è **condiviso tra i profili**, mentre lo stato di visita di uno stand e le note restano personali.

### 1.1 Requisiti confermati

- L'app può essere usata per **fiere diverse da EICMA**.
- Gli stand sono filtrabili per **padiglione**.
- Gli stand sono ordinabili anche per **padiglione**.
- Ogni stand del catalogo può avere `hall` e `booth` facoltativi.
- Non bisogna inventare padiglioni o numeri di stand non verificati.
- Il catalogo degli stand è condiviso; preferenze e stati visita sono personali.
- I nuovi stand creati durante la visita sono **privati del profilo** che li crea.
- Filtri e ordinamenti tornano ai valori predefiniti alla riapertura dell'app.

### 1.2 Decisione di modellazione proposta

Per gestire più eventi senza confondere due padiglioni con lo stesso numero, il file mantiene un array di **aree espositive collegate a un `eventId`**. Ogni area ha un ID tecnico univoco **nell'ambito dell'evento**.

In questa specifica:

- `pavilion` è il termine tecnico per padiglione/area;
- `eventId` collega l'area alla fiera;
- `id` identifica l'area all'interno della fiera;
- `name` è il nome mostrato all'utente;
- `sortOrder` consente un ordine editoriale facoltativo.

È una proposta coerente con `03-app-config.md`, che punta a un unico file `config/pavilions.json` per tutti gli eventi. Non richiede un file per fiera.

---

## 2. Collocazione

```text
ExpoTrack/
├── README.md
├── docs/
│   ├── 05-pavilions-config.md
│   └── 07-stands-config.md
└── config/
    ├── app.json
    ├── pavilions.json                  ← questo documento
    ├── categories.json
    └── events/
        └── eicma-2026-stands.json
```

`app.json` contiene il percorso del file tramite `configFiles.pavilions`. Le informazioni dei singoli stand sono definite **solo** nei cataloghi stand dell'evento, non replicate nel file dei padiglioni.

---

## 3. Struttura JSON

### 3.1 Esempio minimo, senza dati inventati

```json
{
  "schemaVersion": 1,
  "pavilions": []
}
```

L'array vuoto è **valido**. Consente di iniziare lo sviluppo anche quando le posizioni ufficiali degli stand non sono ancora disponibili.

Gli stand possono comunque essere mostrati e filtrati come **«Padiglione non indicato»**.

### 3.2 Esempio illustrativo con un evento fittizio

```json
{
  "schemaVersion": 1,
  "pavilions": [
    {
      "eventId": "fiera-demo-2027",
      "id": "hall-a",
      "name": "Padiglione A",
      "code": "A",
      "sortOrder": 10,
      "description": "Area espositiva principale"
    },
    {
      "eventId": "fiera-demo-2027",
      "id": "outdoor",
      "name": "Area esterna",
      "code": "EXT",
      "sortOrder": 90
    }
  ]
}
```

**Importante:** `fiera-demo-2027`, `Padiglione A` e `Area esterna` sono dati **fittizi** per spiegare la sintassi, non informazioni reali su EICMA 2026. Questo esempio è valido rispetto al contratto soltanto se `fiera-demo-2027` è presente in `config/app.json`.

### 3.3 Esempio con EICMA senza attribuire padiglioni reali

```json
{
  "schemaVersion": 1,
  "pavilions": []
}
```

Prima di popolare l'elenco reale di EICMA 2026 occorre consultare una planimetria o un elenco ufficiale aggiornato. **Non derivare i padiglioni dai cataloghi di anni precedenti.**

---

## 4. Definizione dei campi

| Campo | Tipo | Obbligatorio | Significato |
|---|---|---|---|
| `schemaVersion` | intero | Sì | Versione schema, `1` |
| `pavilions` | array | Sì | Elenco delle aree di tutti gli eventi |
| `pavilions[].eventId` | stringa | Sì | ID evento presente in `app.json` |
| `pavilions[].id` | stringa | Sì | ID stabile dell'area nell'evento |
| `pavilions[].name` | stringa | Sì | Nome da mostrare |
| `pavilions[].code` | stringa | No | Sigla o codice breve, se ufficialmente noto |
| `pavilions[].description` | stringa | No | Descrizione facoltativa |
| `pavilions[].sortOrder` | intero | No | Posizione editoriale, ordine crescente |

### 4.1 `eventId`

È la chiave verso `config/app.json → events[].id`. Permette di usare gli stessi codici di padiglione in fiere diverse senza collisioni.

Esempio:

```json
{
  "eventId": "fiera-demo-2027",
  "id": "hall-a",
  "name": "Padiglione A"
}
```

Se `eventId` non esiste, il validatore deve segnalare un errore. Non mostrare un padiglione sotto un altro evento come fallback.

### 4.2 `id`

È una chiave **tecnica**, distinta dal nome mostrato. Formato proposto: slug minuscolo con lettere, numeri e trattini.

Esempi: `hall-a`, `hall-12`, `outdoor-west`.

La coppia `(eventId, id)` deve essere univoca. Due fiere diverse possono avere entrambe un `hall-a`.

**Non cambiare un ID** quando viene modificato soltanto il nome ufficiale dell'area: gli stand potrebbero già riferirsi a quell'ID.

### 4.3 `name`

È il testo visibile in filtri, dettagli stand e liste. Deve essere una stringa non vuota. Esempi illustrativi: `Padiglione A`, `Area esterna`.

Non dedurre `name` da `id`: i codici tecnici possono essere poco leggibili.

### 4.4 `code`

Campo facoltativo per il codice espositivo, per esempio `A` o `12`. Non è necessariamente uguale a `id`.

**Regola proposta:** non imporre unicità a `code`, perché le convenzioni delle fiere possono variare; richiedere invece unicità della coppia `(eventId, id)`.

### 4.5 `description`

Testo editoriale facoltativo. Può spiegare la natura di un'area, ma non deve contenere indicazioni non verificate, orari o informazioni che cambiano rapidamente senza una fonte aggiornata.

### 4.6 `sortOrder`

Numero intero facoltativo per decidere l'ordine di visualizzazione dei padiglioni. Esempio: `10`, `20`, `30`, così da poter inserire successivamente nuove aree tra due valori.

Se manca, l'app usa un ordinamento naturale del nome/codice, definito al §8. Non attribuire un ordine fisico ai padiglioni se non è conosciuto.

---

## 5. Collegamento tra padiglioni e stand

### 5.1 Contratto consigliato

Nel catalogo stand, il campo già previsto `hall` può contenere **l'ID del padiglione**, non il nome libero:

```json
{
  "id": "stand-demo",
  "name": "Espositore dimostrativo",
  "hall": "hall-a",
  "booth": "A01",
  "categories": ["demo"]
}
```

L'esempio è **fittizio** e presuppone che `hall-a` sia definito in `pavilions.json` per l'evento dello stand e che `demo` esista tra le categorie.

L'evento dello stand è determinato dal file catalogo caricato per quell'evento, come previsto da `03-app-config.md`.

### 5.2 Perché non usare il nome del padiglione in `hall`

Usare `"hall": "Padiglione A"` rende più difficili:

- rinomina di un'area;
- controllo dei riferimenti;
- filtri coerenti;
- localizzazione futura;
- collegamento a più eventi.

Un ID stabile evita questi problemi. L'interfaccia deve **risolvere l'ID nel nome**.

### 5.3 Campo `booth`

`booth` identifica la posizione o lo stand **all'interno** del padiglione. È facoltativo e rimane nel record dello stand, non nel record del padiglione.

Esempio:

```json
{
  "hall": "hall-a",
  "booth": "A01"
}
```

Non assumere che `booth` sia numerico: alcune fiere usano lettere, combinazioni o codici articolati.

**Regola proposta:** consentire `booth` anche senza `hall`, se il codice è noto ma il padiglione non è verificato. In quel caso la UI mostra il codice e segnala «Padiglione non indicato».

### 5.4 Informazioni incomplete

| `hall` | `booth` | UI |
|---|---|---|
| Presente e valido | Presente | Nome padiglione + codice stand |
| Presente e valido | Assente | Solo nome padiglione |
| Assente | Presente | «Padiglione non indicato» + codice stand |
| Assente | Assente | «Posizione non disponibile» |
| Presente ma sconosciuto | Qualsiasi | Errore di validazione per stand editoriali |

I campi vuoti, `null` e stringhe con soli spazi **non sono equivalenti** all'assenza: per la v1 proposta, omettere il campo se non si conosce il dato.

---

## 6. Stand creati manualmente durante la fiera

Gli stand creati nell'app sono privati del profilo che li ha creati. Il loro riferimento al padiglione deve rispettare lo stesso contratto:

- `eventId` della fiera corrente;
- `profileId` del proprietario;
- `hall` facoltativo, scelto da elenco validato;
- `booth` facoltativo;
- nome e altre informazioni dello stand.

### 6.1 Padiglione sconosciuto

Se il visitatore non conosce il padiglione, deve poter **salvare lo stand senza selezionarlo**. Non obbligare a scegliere un valore arbitrario.

### 6.2 Padiglione non ancora in catalogo

Nella v1 si propone di **non permettere di creare nuovi padiglioni direttamente dall'app**. L'utente può registrare lo stand senza padiglione; l'amministratore aggiornerà successivamente `pavilions.json`.

Questa è una **scelta tecnica proposta**, non una decisione già confermata. L'aggiunta manuale di nuovi **stand** resta pienamente supportata.

### 6.3 Modifiche ed eliminazioni

Uno stand creato manualmente può essere modificato o eliminato dal profilo proprietario secondo le regole del modulo stand. Cambiare `hall` o `booth` di uno stand manuale non deve modificare il catalogo globale dei padiglioni.

---

## 7. Gestione di più fiere

### 7.1 Catalogo unico, aree distinte per evento

Il file può contenere padiglioni di più fiere:

```json
{
  "schemaVersion": 1,
  "pavilions": [
    {
      "eventId": "fiera-demo-2027",
      "id": "hall-a",
      "name": "Padiglione A"
    },
    {
      "eventId": "altra-demo-2028",
      "id": "hall-a",
      "name": "Padiglione A"
    }
  ]
}
```

Entrambi gli eventi dell'esempio devono essere definiti in `app.json`. Gli ID locali coincidono, ma la chiave composta `(eventId, id)` è differente.

### 7.2 Selezione evento

Il client deve usare soltanto i padiglioni con `eventId` uguale all'evento attivo. Non deve mostrare nel filtro padiglioni di fiere differenti.

### 7.3 Eventi disabilitati

Se un evento viene disabilitato in `app.json`, i suoi padiglioni **non devono essere eliminati automaticamente**. Possono restare nel file per compatibilità con dati precedenti.

---

## 8. Ricerca, filtri e ordinamento

### 8.1 Filtro padiglione

La lista degli stand deve supportare:

- **Tutti i padiglioni**;
- ciascun padiglione disponibile per l'evento;
- **Padiglione non indicato**.

Il filtro agisce sia sugli stand del catalogo globale sia su quelli creati dal profilo attivo, senza rendere visibili stand privati di altri profili.

### 8.2 Ricerca testuale

La ricerca principale degli stand è per nome, secondo i requisiti confermati. Un eventuale matching anche su codice padiglione o codice stand è un miglioramento facoltativo da formalizzare in `14-frontend-ui.md`.

### 8.3 Ordinamento per padiglione

Regola **proposta** per l'ordinamento crescente:

1. padiglioni con `sortOrder` esplicito, in ordine numerico crescente;
2. padiglioni senza `sortOrder`, in ordine naturale di `name`;
3. stand senza padiglione in fondo;
4. a parità di padiglione, ordinare per nome dello stand.

Per l'ordine decrescente invertire la sequenza dei padiglioni, mantenendo preferibilmente quelli senza posizione in fondo. La specifica UI definitiva può affinare il comportamento.

### 8.4 Ordinamento naturale

Un confronto naturale considera `Padiglione 2` prima di `Padiglione 10`, evitando il semplice ordinamento lessicografico. In JavaScript è possibile usare `Intl.Collator("it-IT", { numeric: true, sensitivity: "base" })`.

**Non** usare un ordinamento numerico ingenuo: i codici possono includere lettere e aree esterne.

### 8.5 Persistenza dei filtri

I filtri e gli ordinamenti non devono essere ripristinati dalla sessione precedente quando si riapre l'app. Un clic su una statistica della dashboard può aprire una lista già filtrata **nella sessione corrente**.

---

## 9. Validazione

### 9.1 Regole strutturali

| ID | Controllo | Esito |
|---|---|---|
| PAV-001 | JSON sintatticamente valido | Errore se invalido |
| PAV-002 | Root oggetto | Errore se invalido |
| PAV-003 | `schemaVersion === 1` | Errore se invalido |
| PAV-004 | `pavilions` array, anche vuoto | Errore se invalido |
| PAV-005 | Ogni elemento è oggetto | Errore se invalido |
| PAV-006 | `eventId`, `id`, `name` non vuoti | Errore se invalido |
| PAV-007 | `(eventId, id)` univoco | Errore se duplicato |
| PAV-008 | `eventId` presente in `app.json` | Errore se sconosciuto |
| PAV-009 | `id` nel formato slug supportato | Errore se invalido |
| PAV-010 | `code` stringa non vuota, se presente | Errore se invalido |
| PAV-011 | `description` stringa, se presente | Errore se invalido |
| PAV-012 | `sortOrder` intero, se presente | Errore se invalido |

**Politica proposta:** rifiutare proprietà sconosciute, coerentemente con i documenti `03` e `04`.

### 9.2 Validazione incrociata con gli stand

Per ogni stand editoriale con `hall`:

1. identificare `eventId` del catalogo stand;
2. cercare `(eventId, hall)` in `pavilions.json`;
3. rifiutare il catalogo se il riferimento non esiste.

Per gli stand manuali il server deve applicare la stessa validazione sul `hall` fornito, se presente.

### 9.3 Errori leggibili

```text
CONFIG_DUPLICATE_PAVILION
File: config/pavilions.json
Campo: $.pavilions[3].id
Problema: il padiglione "hall-a" è già definito per l'evento "fiera-demo-2027".
```

```text
CONFIG_UNKNOWN_EVENT
File: config/pavilions.json
Campo: $.pavilions[0].eventId
Problema: l'evento "evento-inesistente" non compare in app.json.
```

```text
CONFIG_UNKNOWN_PAVILION
File: config/events/eicma-2026-stands.json
Campo: $.stands[4].hall
Problema: il riferimento "hall-x" non esiste per l'evento "eicma-2026".
```

I percorsi JSON e il nome esatto dell'array degli stand nell'ultimo esempio sono illustrativi: lo schema del catalogo stand sarà formalizzato in `07-stands-config.md`.

---

## 10. Tipi TypeScript proposti

```ts
export interface PavilionConfigItem {
  eventId: string;
  id: string;
  name: string;
  code?: string;
  description?: string;
  sortOrder?: number;
}

export interface PavilionsConfig {
  schemaVersion: 1;
  pavilions: PavilionConfigItem[];
}
```

Il tipo TypeScript **non sostituisce** la validazione runtime del JSON.

### 10.1 Chiave composta

```ts
export function pavilionKey(eventId: string, pavilionId: string): string {
  return `${eventId}:${pavilionId}`;
}
```

Questo è un esempio concettuale. Se gli ID ammettessero `:`, occorrerebbe un encoding non ambiguo; con gli slug proposti il separatore è sicuro.

### 10.2 Risoluzione del nome

```ts
export function findPavilion(
  pavilions: PavilionConfigItem[],
  eventId: string,
  pavilionId: string
): PavilionConfigItem | undefined {
  return pavilions.find(
    (item) => item.eventId === eventId && item.id === pavilionId
  );
}
```

La funzione illustra la semantica, non è un loader completo né un'ottimizzazione definitiva. In produzione, per cataloghi estesi, è possibile costruire una mappa indicizzata.

---

## 11. Moduli applicativi suggeriti

```text
src/lib/config/
├── pavilions-schema.ts
├── pavilions-loader.server.ts
└── validate-references.server.ts

src/features/events/
├── domain/
│   └── pavilion-types.ts
├── data/
│   └── pavilion-catalog.ts
└── components/
    └── PavilionLabel.tsx

src/features/stands/
├── components/
│   ├── PavilionFilter.tsx
│   └── StandLocation.tsx
└── domain/
    └── stand-sort.ts
```

Questa suddivisione è **indicativa**: non creare file vuoti solo per rispettare l'albero.

### 11.1 Loader

Il caricamento segue il processo definito in `03-app-config.md`:

1. leggere `app.json`;
2. risolvere `configFiles.pavilions`;
3. leggere e validare `pavilions.json`;
4. controllare gli eventi referenziati;
5. caricare i cataloghi stand;
6. validare i riferimenti `hall`;
7. pubblicare uno snapshot coerente per il client;
8. memorizzarlo offline in IndexedDB.

Non esporre al browser percorsi del filesystem server.

---

## 12. Offline e sincronizzazione

### 12.1 Catalogo editoriale

I padiglioni sono dati di configurazione e vengono distribuiti come parte dello **snapshot editoriale versionato**. Dopo il primo caricamento, devono essere disponibili offline.

Quando cambia `pavilions.json`:

- validare il nuovo snapshot completo;
- aggiornarlo in modo atomico;
- non cancellare note, prodotti o stati di visita;
- non sostituire una configurazione valida con una invalida.

### 12.2 Stand personali

Se un utente crea uno stand offline e gli assegna un `hall`, il record deve memorizzare l'ID dell'area e l'evento. Il salvataggio esplicito inserisce l'operazione nella coda; la bozza non si sincronizza.

### 12.3 Padiglione rimosso o rinominato

- **Rinominare `name`** mantenendo l'ID è compatibile.
- **Cambiare `id`** può rompere i riferimenti degli stand.
- **Rimuovere un padiglione** già referenziato richiede una migrazione o una politica di compatibilità.

Non trasformare automaticamente un riferimento sconosciuto in un altro padiglione. In presenza di dati locali preesistenti, segnalare il problema e preservare il dato originale finché non viene risolto.

---

## 13. Accessibilità e presentazione

- Mostrare nomi comprensibili, non solo codici tecnici.
- Non usare colori per distinguere i padiglioni: il colore identifica già i profili.
- Se la posizione manca, usare testo esplicito.
- Il filtro deve essere utilizzabile su smartphone e da tastiera.
- Evitare etichette troppo lunghe o tronche senza modo di leggere il testo completo.
- In vista stand, mostrare padiglione e `booth` solo se effettivamente conosciuti.
- Nessun collegamento a mappe o navigazione deve essere creato automaticamente.

---

## 14. Test consigliati

| ID | Scenario | Risultato atteso |
|---|---|---|
| TEST-PAV-01 | Array `pavilions: []` | Valido |
| TEST-PAV-02 | Due aree con stesso ID e stesso evento | Errore |
| TEST-PAV-03 | Stesso ID in eventi diversi | Valido |
| TEST-PAV-04 | Evento sconosciuto | Errore |
| TEST-PAV-05 | Nome vuoto | Errore |
| TEST-PAV-06 | `sortOrder` non intero | Errore |
| TEST-PAV-07 | Stand con `hall` valido | Nome risolto |
| TEST-PAV-08 | Stand editoriale con `hall` inesistente | Errore di validazione |
| TEST-PAV-09 | Stand senza `hall` | Visibile, posizione non indicata |
| TEST-PAV-10 | Stand con `booth` ma senza `hall` | Visibile, codice mantenuto |
| TEST-PAV-11 | Filtro «Padiglione non indicato» | Solo stand senza `hall` |
| TEST-PAV-12 | Filtro padiglione | Include catalogo e stand personali del profilo |
| TEST-PAV-13 | Cambio evento | Nessun padiglione dell'altro evento |
| TEST-PAV-14 | Cambio profilo | Catalogo padiglioni condiviso, stand privati separati |
| TEST-PAV-15 | Ordinamento naturale | `Padiglione 2` precede `Padiglione 10` |
| TEST-PAV-16 | Riapertura app | Filtri tornano ai default |
| TEST-PAV-17 | Aggiornamento nome, ID invariato | Riferimenti preservati |
| TEST-PAV-18 | Aggiornamento JSON invalido | Snapshot precedente conservato |
| TEST-PAV-19 | Uso offline dopo bootstrap | Nomi padiglioni disponibili |
| TEST-PAV-20 | Nuovo stand manuale senza padiglione | Salvataggio consentito |

---

## 15. Scelte ancora aperte

Questa specifica non considera già confermate le seguenti proposte:

| Tema | Proposta | Documento coinvolto |
|---|---|---|
| Struttura multi-evento | Un solo file con `eventId` su ogni area | `03`, `05` |
| Nomi esatti dei campi | `pavilions`, `code`, `sortOrder` | `05` |
| Padiglioni senza dati | Array vuoto ammesso | `05`, `07` |
| `hall` negli stand | ID del padiglione, non nome libero | `07-stands-config.md` |
| Creazione padiglioni dall'app | Non prevista nella v1 | `16-stand-management.md` |
| Ordinamento | `sortOrder`, poi nome naturale | `14-frontend-ui.md` |
| Gestione ID rimossi | Migrazione esplicita | `12-database.md`, `20-synchronization.md` |
| Fonte ufficiale EICMA | Da verificare prima di popolare il catalogo | `07-stands-config.md` |

Non inventare padiglioni, codici stand, coordinate, mappe o associazioni agli espositori per completare il JSON.

---

## 16. Criteri di accettazione

- [ ] `config/pavilions.json` è separato dai cataloghi stand.
- [ ] Il file supporta zero o più padiglioni e più eventi.
- [ ] Ogni area è identificata dalla coppia `(eventId, id)`.
- [ ] I riferimenti agli eventi sono validati.
- [ ] Gli stand possono omettere `hall` e `booth`.
- [ ] Gli stand con `hall` noto mostrano il nome corretto.
- [ ] Gli stand con padiglione sconosciuto non vengono inventati o assegnati automaticamente.
- [ ] Filtri e ordinamenti per padiglione funzionano.
- [ ] Gli stand privati di altri profili restano invisibili.
- [ ] La configurazione è disponibile offline dopo il bootstrap.
- [ ] Rinominare un padiglione non altera i riferimenti.
- [ ] Rimuovere ID usati non causa perdita silenziosa di dati.
- [ ] L'app non implementa mappe, percorsi o navigazione non richiesti.

---

## 17. Prossimo documento

**[`06-categories-config.md`](06-categories-config.md)** definirà `config/categories.json`: categorie e sottocategorie a gerarchia libera, ID stabili, `parentId`, ordinamento, appartenenza degli stand a più categorie e selezione manuale di **una sola categoria/sottocategoria per prodotto**, immutabile dopo il primo salvataggio.
