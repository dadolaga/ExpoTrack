# 07 — Catalogo degli stand (`config/events/<eventId>-stands.json`)

> **Progetto:** ExpoTrack · **Contratto proposto:** versione `1` · **Stato:** specifica tecnica per la v1  
> **Documenti di riferimento:** [`00-overview.md`](00-overview.md), [`01-architecture.md`](01-architecture.md), [`02-project-structure.md`](02-project-structure.md), [`03-app-config.md`](03-app-config.md), [`04-profiles-config.md`](04-profiles-config.md), [`05-pavilions-config.md`](05-pavilions-config.md), [`06-categories-config.md`](06-categories-config.md)  
> **Documento successivo:** [`08-products-config.md`](08-products-config.md)

---

## 1. Obiettivo e confini

Il file `config/events/eicma-2026-stands.json` rappresenta il **catalogo editoriale condiviso degli espositori/stand** per EICMA 2026. Il progetto deve poter caricare cataloghi analoghi per altre fiere senza modificare il codice.

Ogni record descrive **uno stand identificabile**: nome, categorie, descrizione facoltativa, padiglione e posizione soltanto se verificati. Il catalogo è comune a tutti i profili, ma le informazioni raccolte durante la visita restano personali.

### 1.1 Requisiti confermati

- Ogni stand ha **ID stabile** e **nome**.
- Padiglione (`hall`) e codice posizione (`booth`) sono **facoltativi**.
- Uno stand può appartenere a **più categorie**.
- La descrizione è facoltativa.
- Il catalogo degli stand iniziali viene configurato tramite JSON.
- Le posizioni non devono essere inventate: se non verificate, omettere i campi.
- Per ciascun profilo esiste **una priorità personale da 1 a 10**, configurabile inizialmente tramite il relativo JSON interessi.
- Gli elementi **«cosa vedere»** sono personali, non proprietà condivise dello stand.
- Stato personale: **da visitare** (predefinito), **visitato**, **da rivedere**.
- Note testuali e più fotografie possono essere associate allo stand per profilo.
- L'utente può creare **nuovi stand privati**, visibili solo al profilo creatore.
- Gli stand creati nell'app sono modificabili ed eliminabili con conferma.
- Gli stand editoriali **non possono essere eliminati dall'interfaccia**.
- Ricerca per nome; filtri per categoria, padiglione, priorità e stato; ordinamento per priorità, nome e padiglione, crescente/decrescente.
- I filtri e gli ordinamenti si resettano quando si riapre l'app.
- L'app **non** gestisce mappe, navigazione o itinerari.

### 1.2 Separazione editoriale/dinamica

| Informazione | Origine e persistenza |
|---|---|
| ID, nome, categorie, descrizione, padiglione, booth di uno stand condiviso | JSON catalogo evento |
| Priorità iniziale e cosa vedere per `me` o `father` | JSON interessi del profilo |
| Priorità aggiornata durante la visita | IndexedDB/PostgreSQL, per profilo |
| Stato di visita | IndexedDB/PostgreSQL, per profilo |
| Note e foto | IndexedDB/PostgreSQL + storage media, per profilo |
| Prodotti osservati | IndexedDB/PostgreSQL, per profilo e stand |
| Stand aggiunto dall'utente | IndexedDB/PostgreSQL, **privato del profilo** |

**Non** scrivere le modifiche utente dentro il catalogo JSON.

---

## 2. Posizione e collegamenti

```text
ExpoTrack/
├── README.md
├── docs/
│   ├── 07-stands-config.md
│   ├── 09-interests-config.md
│   ├── 16-stand-management.md
│   └── 17-product-management.md
└── config/
    ├── app.json
    ├── pavilions.json
    ├── categories.json
    ├── events/
    │   └── eicma-2026-stands.json       ← questo documento
    └── interests/
        ├── me.json
        └── father.json
```

Il percorso del catalogo evento è dichiarato in `app.json` mediante `events[].standsFile`. Il catalogo non deve cercare autonomamente quale evento rappresenta attraverso il nome del file: il loader lo associa all'`eventId` che lo referenzia.

### 2.1 Un file per evento

Esempio concettuale:

```json
{
  "events": [
    {
      "id": "eicma-2026",
      "name": "EICMA 2026",
      "standsFile": "events/eicma-2026-stands.json",
      "enabled": true
    }
  ]
}
```

Questo frammento è **parziale**: il file `app.json` completo include anche altri campi obbligatori descritti in `03-app-config.md`.

---

## 3. Contratto JSON proposto

### 3.1 Esempio minimo valido

```json
{
  "schemaVersion": 1,
  "stands": []
}
```

Un catalogo vuoto è **tecnicamente valido**: l'app può avviarsi anche se non sono ancora disponibili dati verificati. Deve però mostrare uno stato vuoto comprensibile, non inventare espositori.

### 3.2 Esempio completo con dati fittizi

```json
{
  "schemaVersion": 1,
  "stands": [
    {
      "id": "demo-motorcycles",
      "name": "Moto Demo",
      "description": "Espositore dimostrativo di motociclette.",
      "hall": "hall-a",
      "booth": "A01",
      "categories": [
        "motorcycles",
        "motorcycle-accessories"
      ]
    },
    {
      "id": "demo-helmets",
      "name": "Caschi Demo",
      "categories": [
        "helmets"
      ]
    }
  ]
}
```

**Tutti i nomi, codici, categorie e posizioni sono fittizi.** Questo esempio è valido soltanto se `hall-a` è definito per l'evento in `pavilions.json` e gli ID categoria esistono in `categories.json`. Non è una lista di stand reali di EICMA 2026.

### 3.3 Esempio realistico di informazione incompleta

```json
{
  "schemaVersion": 1,
  "stands": [
    {
      "id": "espositore-da-verificare",
      "name": "Espositore da verificare",
      "categories": []
    }
  ]
}
```

L'array `categories: []` è una **proposta tecnica** per consentire una catalogazione provvisoria senza attribuire categorie non verificate. Se lo stand non è ancora identificato con certezza, è preferibile non inserirlo nel catalogo editoriale fino alla verifica. Il nome qui è un segnaposto illustrativo, non un espositore reale.

---

## 4. Campi e validazione

| Percorso | Tipo | Obbligatorio | Regole |
|---|---|---|---|
| `schemaVersion` | intero | Sì | `1` |
| `stands` | array | Sì | Anche vuoto |
| `stands[].id` | stringa | Sì | Slug stabile, univoco **nell'evento** |
| `stands[].name` | stringa | Sì | Non vuoto, leggibile |
| `stands[].description` | stringa | No | Testo libero editoriale |
| `stands[].hall` | stringa | No | ID padiglione valido nell'evento |
| `stands[].booth` | stringa | No | Codice stand, non necessariamente numerico |
| `stands[].categories` | array di stringhe | Sì | ID categoria validi, senza duplicati; vuoto consentito per v1 proposta |

### 4.1 ID

L'ID è una chiave tecnica stabile. Si propone uno slug minuscolo composto da lettere, numeri e trattini, ad esempio `brand-name`, `brand-name-2`, `brand-name-accessories`.

La coppia `(eventId, standId)` deve identificare univocamente uno stand editoriale. Non usare il nome come chiave: un espositore può cambiare denominazione senza cambiare identità.

**Scelta da formalizzare:** in presenza di più stand dello stesso espositore, assegnare un ID distinto a ogni stand oppure usare un record unico. La scelta consigliata è **un record per posizione/stand effettivamente visitabile**, perché note, stato visita e prodotti sono associati allo stand; ma non duplicare automaticamente espositori senza informazioni verificate.

### 4.2 Nome

`name` è il nome mostrato nell'interfaccia e cercato dalla ricerca testuale. Deve essere non vuoto dopo trim.

Nomi uguali possono essere leciti per stand distinti: l'unicità è dell'ID, non del nome. In caso di omonimia la UI può mostrare padiglione/codice quando disponibili.

### 4.3 Descrizione

`description` è un riassunto editoriale di ciò che propone l'espositore. Non deve contenere promesse o dettagli non verificati. Se sconosciuta, **ometterla**.

Non sostituire automaticamente una descrizione mancante con informazioni generiche su un marchio.

### 4.4 Padiglione e codice stand

`hall` fa riferimento a `pavilions[].id` **per lo stesso evento**, secondo `05-pavilions-config.md`.

`booth` è un codice testuale facoltativo: può contenere lettere, numeri, trattini o altre convenzioni ufficiali. Non convertirlo in numero, perché si perderebbero zeri iniziali e prefissi.

| `hall` | `booth` | Presentazione |
|---|---|---|
| Presente, valido | Presente | Padiglione e posizione |
| Presente, valido | Assente | Solo padiglione |
| Assente | Presente | Posizione nota, padiglione non indicato |
| Assente | Assente | Posizione non disponibile |

Per dati editoriali, un `hall` sconosciuto è un **errore di validazione**, non un valore da sostituire silenziosamente.

### 4.5 Categorie multiple

`categories` contiene zero o più ID definiti in `config/categories.json`, ad esempio:

```json
{
  "categories": ["motorcycles", "motorcycle-accessories"]
}
```

Uno stand può vendere o mostrare prodotti di categorie diverse. La classificazione dello stand **non impone** automaticamente la categoria dei prodotti osservati: l'utente sceglie manualmente **una sola categoria/sottocategoria** per ciascun prodotto.

**Regola da definire in `06-categories-config.md` e `16-stand-management.md`:** se il filtro per categoria debba includere automaticamente gli stand classificati solo nelle sottocategorie discendenti. La logica di filtro deve essere unica e testata.

### 4.6 Campi sconosciuti

Per la v1 si propone di rifiutare campi JSON non documentati, coerentemente con `03`–`06`. Aggiunte future (per esempio sito ufficiale o contatto) richiederanno uno schema aggiornato e validazione, non campi ad hoc introdotti senza contratto.

---

## 5. Cosa non inserire nel catalogo

Non inserire questi campi dentro gli oggetti di `stands`:

| Campo o gruppo | Motivo |
|---|---|
| `priority` | Priorità diversa per ogni profilo |
| `whatToSee` | Interessi personali, definiti in JSON separati |
| `visitStatus` | Stato personale dinamico |
| `visitedAt` | Dato della visita |
| `notes` | Note personali |
| `photos` | Foto raccolte durante la visita |
| `products` | Prodotti osservati dinamici |
| `isFavorite` | Proprietà dei prodotti personali, non dello stand |
| `questionnaire` | Questionari per profilo/categoria |
| `profileId` | Il catalogo è condiviso |
| `createdBy` | Campo applicabile agli stand dinamici, non a quelli editoriali |

Il catalogo non è il database dell'app. Deve poter essere versionato in Git e distribuito in sola lettura.

---

## 6. Catalogo condiviso e stand privati

### 6.1 Origine e visibilità

ExpoTrack usa due tipi di stand:

1. **Catalogo editoriale:** definito nel JSON e visibile a tutti i profili che consultano l'evento.
2. **Stand dinamico personale:** creato nell'app e visibile **soltanto al profilo creatore**.

Entrambi devono apparire nella stessa lista stand del profilo attivo, ma conservare l'informazione di origine per stabilire quali operazioni sono ammesse.

### 6.2 Modello applicativo unificato proposto

```ts
export type StandSource = "catalog" | "personal";

export interface StandView {
  id: string;
  eventId: string;
  source: StandSource;
  ownerProfileId?: string;
  name: string;
  description?: string;
  hall?: string;
  booth?: string;
  categories: string[];
}
```

`source`, `eventId` e `ownerProfileId` sono campi del **modello applicativo normalizzato**. Non sono obbligatori nel singolo record JSON, perché l'evento deriva dal file caricato e gli stand editoriali non hanno proprietario.

### 6.3 Identificativi e collisioni

Per distinguere in modo sicuro le origini, si propone un identificatore logico composto da:

- evento;
- origine (`catalog`/`personal`);
- ID stand;
- profilo proprietario per stand personali.

Un semplice `standId` isolato potrebbe non essere sufficiente a distinguere uno stand privato da uno editoriale con lo stesso nome o ID.

Per gli stand creati offline, generare identificativi univoci, per esempio UUID/ULID. **Non** derivare l'ID dal nome digitato dall'utente.

### 6.4 Operazioni consentite

| Operazione | Stand editoriale | Stand personale |
|---|---|---|
| Visualizzare | Sì | Solo profilo proprietario |
| Cercare/filtrare | Sì | Solo profilo proprietario |
| Modificare stato personale | Sì | Sì |
| Modificare priorità personale | Sì | Sì |
| Aggiungere note/foto | Sì | Sì |
| Collegare prodotti | Sì | Sì |
| Modificare nome/descrizione condivisi | No, solo JSON | Sì, proprietario |
| Modificare `hall`/`booth` condivisi | No, solo JSON | Sì, proprietario |
| Eliminare lo stand dall'app | **No** | Sì, con conferma |

Non trasformare uno stand editoriale in personale per aggirare il divieto di eliminazione.

### 6.5 Creazione di uno stand personale

Flusso proposto:

1. Aprire **Stand**.
2. Selezionare **Aggiungi stand**.
3. Inserire un nome obbligatorio.
4. Selezionare zero o più categorie, se note.
5. Inserire eventualmente descrizione, padiglione e codice.
6. Premere **Salva**.
7. Salvare localmente il record e aggiungere l'operazione alla coda di sincronizzazione.
8. Rendere lo stand visibile solo nel profilo attivo.

Le modifiche prima di **Salva** sono **bozze**: devono essere autosalvate localmente, ma non sincronizzate.

### 6.6 Eliminazione di uno stand personale

L'eliminazione richiede conferma e deve gestire i prodotti e le fotografie eventualmente associati.

**Da definire in `12-database.md`, `16-stand-management.md` e `20-synchronization.md`:** impedire l'eliminazione finché esistono prodotti, eliminare a cascata dopo conferma esplicita oppure consentire una riassegnazione. Non adottare una cancellazione a cascata silenziosa.

---

## 7. Interessi, priorità e cose da vedere

### 7.1 Separazione dal catalogo

Il file `config/interests/me.json` o `config/interests/father.json` associa interessi **a un profilo**. Uno stesso stand può avere priorità diverse per persone diverse.

Esempio **puramente illustrativo** della relazione logica:

```text
Stand editoriale: demo-motorcycles
  ├── Profilo me: priorità 9, cosa vedere ["Modello A"]
  └── Profilo father: priorità 6, cosa vedere ["Accessori"]
```

Il formato JSON esatto degli interessi sarà definito in `09-interests-config.md`: **non** usare questa rappresentazione testuale come schema.

### 7.2 Priorità 1–10

- Ogni profilo può assegnare **una** priorità a uno stand.
- I valori ammessi sono interi da `1` a `10`.
- Non confondere priorità e voto generale di un prodotto: sono due valutazioni diverse.
- Se una priorità non è stata impostata, l'interfaccia deve distinguerla da `1`.

**Da definire:** posizione degli stand senza priorità nell'ordinamento crescente/decrescente; si propone di mostrarli in fondo in entrambi i casi.

### 7.3 Cosa vedere

`whatToSee` è una lista personale di stringhe testuali, non un elenco obbligatorio di prodotti.

Esempi illustrativi: «Salire sulla moto», «Provare un casco», «Chiedere informazioni sugli scarichi».

Questi elementi **non devono essere condivisi automaticamente** con altri profili e non sono domande di questionario.

### 7.4 Modifiche in app

Se l'utente cambia priorità o aggiunge un elemento durante la visita, la modifica viene salvata come dato dinamico per quel profilo. Non si modifica il JSON di interessi.

La precedenza fra seed editoriale aggiornato e modifica personale già salvata sarà definita in `09-interests-config.md`. Non sovrascrivere preferenze personali con nuovi seed senza una regola esplicita.

---

## 8. Stato visita, note e fotografie

### 8.1 Stato visita

Ogni stand, per ogni profilo ed evento, ha uno stato:

- **da visitare** — valore predefinito;
- **visitato**;
- **da rivedere**.

La rappresentazione tecnica proposta è:

```ts
export type StandVisitStatus =
  | "to_visit"
  | "visited"
  | "revisit";
```

La scelta dei nomi interni sarà formalizzata in `11-visit-statuses-config.md`. La UI mostra sempre le etichette italiane.

### 8.2 Per profilo, non per catalogo

Uno stand può essere «visitato» per un profilo e «da visitare» per un altro. La dashboard calcola i contatori usando il profilo e l'evento attivi.

L'assenza di un record di visita equivale allo stato predefinito, **non** alla mancanza dello stand.

### 8.3 Note

Le note sono testo libero personale. Devono poter essere modificate offline, con bozza persistente e salvataggio esplicito.

### 8.4 Foto

Uno stand può avere **più foto facoltative**, appartenenti al profilo che le ha raccolte. Devono restare disponibili offline dopo il salvataggio locale nei limiti delle capacità del dispositivo.

I file fotografici non vanno nel JSON editoriale. La gestione dei media sarà definita in `21-photo-management.md`.

---

## 9. Prodotti collegati agli stand

Un prodotto osservato è un record personale dinamico che fa riferimento allo stand in cui è stato visto.

### 9.1 Vincoli

- Ogni prodotto appartiene a un profilo e a un evento.
- Ogni prodotto è collegato a **uno stand**.
- Ogni prodotto ha **una sola categoria/sottocategoria**, scelta manualmente e immutabile dopo il primo salvataggio.
- La categoria del prodotto può essere diversa dalle categorie editoriali dello stand: la scelta è dell'utente.
- Il prodotto può avere nome, prezzo singolo facoltativo, voto generale 1–10 facoltativo, preferito, note, foto e risposte a un questionario personale quando disponibile.
- I prodotti sono visibili sia nel dettaglio stand sia nella lista personale generale.

### 9.2 Integrità del riferimento

Il collegamento prodotto → stand deve includere abbastanza informazioni per distinguere:

- evento;
- stand editoriale o personale;
- proprietario dello stand personale, quando pertinente.

Un prodotto non deve poter essere collegato a uno stand privato di un altro profilo.

### 9.3 Aggiornamento del catalogo

Rinominare uno stand editoriale mantenendo lo stesso ID **non deve scollegare** i prodotti già registrati.

Se uno stand editoriale viene rimosso dal catalogo, i prodotti già associati non devono sparire: è necessaria una strategia esplicita di migrazione o conservazione di riferimenti storici.

---

## 10. Ricerca, filtri e ordinamento

### 10.1 Ricerca per nome

La ricerca deve trovare stand editoriali e personali del profilo attivo. Si propone:

- confronto senza distinzione maiuscole/minuscole;
- normalizzazione degli accenti per facilitare la ricerca;
- matching parziale del nome.

La ricerca non deve mostrare stand privati di altri profili.

### 10.2 Filtri combinabili

| Filtro | Comportamento |
|---|---|
| Categoria | Stand che appartengono alla categoria selezionata, con eventuali discendenti secondo regola categorie |
| Padiglione | Stand con `hall` selezionato |
| Priorità | Priorità personale dello stand |
| Stato visita | Stato del profilo attivo |
| Nome | Ricerca testuale |

I filtri devono poter essere combinati. **Proposta:** AND tra filtri di gruppi diversi, OR fra più valori selezionati nello stesso gruppo, se la UI prevede selezione multipla. La semantica definitiva è responsabilità di `14-frontend-ui.md` e `16-stand-management.md`.

### 10.3 Ordinamenti

- priorità personale crescente/decrescente;
- nome crescente/decrescente;
- padiglione crescente/decrescente.

Per il padiglione usare la logica di `05-pavilions-config.md`; per il nome usare ordinamento naturale con locale italiana.

**Proposta:** stand senza priorità e senza padiglione in fondo, indipendentemente dalla direzione. Non confondere «priorità mancante» con priorità minima.

### 10.4 Filtri temporanei

Quando si riapre ExpoTrack, ricerca, filtri e ordinamento devono tornare ai default. Il profilo selezionato, invece, resta memorizzato sul dispositivo.

### 10.5 Dashboard

La dashboard personale può mostrare contatori per stand da visitare, visitati e da rivedere. Toccando un contatore si apre la lista stand con il relativo filtro attivo nella sessione corrente.

I conteggi devono includere gli stand personali del profilo, senza includere quelli degli altri profili.

---

## 11. Validazione del catalogo

### 11.1 Controlli strutturali

| ID | Regola | Errore |
|---|---|---|
| STAND-001 | JSON sintatticamente valido | File invalido |
| STAND-002 | Root oggetto | Schema invalido |
| STAND-003 | `schemaVersion === 1` | Versione non supportata |
| STAND-004 | `stands` array | Schema invalido |
| STAND-005 | Ogni elemento è un oggetto | Record invalido |
| STAND-006 | `id` presente e valido | ID invalido |
| STAND-007 | ID univoci nello stesso evento | Duplicato |
| STAND-008 | `name` non vuoto | Nome invalido |
| STAND-009 | `description` stringa, se presente | Descrizione invalida |
| STAND-010 | `hall` valido per evento, se presente | Padiglione sconosciuto |
| STAND-011 | `booth` stringa non vuota, se presente | Posizione invalida |
| STAND-012 | `categories` array | Categorie invalide |
| STAND-013 | ID categoria esistenti | Categoria sconosciuta |
| STAND-014 | Nessuna categoria duplicata nello stesso stand | Duplicato |
| STAND-015 | Campi sconosciuti rifiutati (proposta) | Campo non supportato |

### 11.2 Validazione incrociata

Il loader conosce l'evento attraverso `app.json` e deve verificare:

1. il file esiste sotto `config/` e non contiene traversal;
2. ogni `hall` fa riferimento a `(eventId, pavilionId)` valido;
3. ogni categoria esiste in `categories.json`;
4. gli ID stand sono univoci nel catalogo evento;
5. i file interessi non puntano a stand inesistenti, secondo la politica definita in `09-interests-config.md`.

### 11.3 Errori espliciti

```text
CONFIG_DUPLICATE_STAND
File: config/events/eicma-2026-stands.json
Campo: $.stands[5].id
Problema: l'ID "demo-helmets" è già presente in questo evento.
```

```text
CONFIG_UNKNOWN_PAVILION
File: config/events/eicma-2026-stands.json
Campo: $.stands[2].hall
Problema: "hall-x" non esiste per l'evento "eicma-2026".
```

```text
CONFIG_UNKNOWN_CATEGORY
File: config/events/eicma-2026-stands.json
Campo: $.stands[1].categories[0]
Problema: la categoria "categoria-inesistente" non è definita.
```

Non ignorare un record invalido senza segnalarlo. Per la v1 si propone un **bootstrap fail-fast** su configurazioni editoriali incoerenti.

---

## 12. Aggiornamenti editoriali e stabilità dei dati

### 12.1 Modifiche compatibili

Sono generalmente compatibili, a ID invariato:

- modifica di `name`;
- modifica di `description`;
- correzione verificata di `hall`/`booth`;
- aggiunta di categorie;
- aggiunta di nuovi stand.

Le modifiche non devono alterare note, prodotti, fotografie, priorità o stati personali.

### 12.2 Modifiche potenzialmente incompatibili

- cambio di `id`;
- rimozione di uno stand già referenziato;
- fusione di due stand;
- suddivisione di uno stand in più record;
- spostamento di un record a un altro evento.

Queste operazioni richiedono una **migrazione esplicita**, con salvaguardia dei riferimenti e dei dati offline.

### 12.3 Provenienza e verificabilità

Prima di pubblicare il catalogo EICMA 2026:

- verificare gli espositori su fonti aggiornate;
- non attribuire padiglioni o booth non verificati;
- non dedurre automaticamente categorie da una conoscenza generica del marchio;
- annotare internamente la fonte e la data di verifica nel processo editoriale.

**Scelta aperta:** aggiungere al contratto campi opzionali `sourceUrl`/`verifiedAt`, oppure mantenere un registro di verifica separato. Non includerli nello schema v1 finché non è stabilita la politica di aggiornamento.

---

## 13. Offline-first

### 13.1 Bootstrap e cache

Dopo il primo caricamento online, il catalogo validato deve essere disponibile offline tramite lo snapshot editoriale e IndexedDB.

In assenza di rete:

- la lista stand funziona con il catalogo in cache;
- filtri e ricerca funzionano localmente;
- gli stand personali sono letti da IndexedDB;
- note, foto, prodotti e stati personali possono essere modificati;
- le bozze sono autosalvate, ma **non** sincronizzate prima del pulsante **Salva**.

### 13.2 Sincronizzazione

Gli stand editoriali non vengono modificati dal client. Le operazioni sincronizzate riguardano:

- stand personali creati/modificati/eliminati;
- stati visita;
- priorità e interessi personali;
- note e fotografie;
- prodotti associati.

Il motore deve gestire retry idempotenti e conflitti **manuali** per modifiche concorrenti sullo stesso profilo da più dispositivi.

### 13.3 Aggiornamento catalogo offline

Quando arriva un nuovo snapshot:

1. validarlo completamente;
2. verificare compatibilità dei riferimenti;
3. aggiornare atomicamente la cache;
4. preservare bozze e dati personali;
5. segnalare eventuali incompatibilità senza perdita silenziosa.

Non garantire la sincronizzazione con app completamente chiusa su ogni browser.

---

## 14. API e database

### 14.1 Distinzione fra lettura e mutazioni

Il server distribuisce il catalogo editoriale come parte del bootstrap, ma le mutazioni degli utenti devono passare da API dedicate a record dinamici.

Esempi di operazioni da specificare in `13-backend-api.md`:

- ottenere il catalogo per evento;
- creare uno stand personale;
- modificare/eliminare uno stand personale;
- aggiornare stato e priorità per profilo;
- salvare note e riferimenti foto;
- ottenere prodotti di uno stand.

Non fissare ora URL, metodi o payload definitivi.

### 14.2 Chiavi logiche

| Entità | Chiave concettuale |
|---|---|
| Stand editoriale | `(eventId, standId)` |
| Stand personale | ID univoco + `eventId` + `ownerProfileId` |
| Stato di visita | `profileId` + `eventId` + riferimento stand |
| Priorità personale | `profileId` + `eventId` + riferimento stand |
| Prodotto | ID univoco + `profileId` + `eventId` + riferimento stand |

Lo schema SQL definitivo, le foreign key e le politiche di eliminazione sono demandati a `12-database.md`.

### 14.3 Assenza di autenticazione

L'API deve verificare coerenza dei riferimenti e dell'ambito profilo/evento, ma nella v1 **non esiste una prova di identità**. Un `profileId` ricevuto dal client non equivale ad autenticazione.

Cloudflare Tunnel non rende il sito privato da solo. Le misure di protezione e l'eventuale Cloudflare Access sono trattati in `25-security.md`.

---

## 15. UI e accessibilità

### 15.1 Scheda stand

Una scheda può mostrare:

- nome;
- categorie;
- padiglione/booth se noti;
- priorità personale se impostata;
- stato visita personale;
- indicazione dello stand personale, se pertinente.

La descrizione può comparire nel dettaglio, evitando schede troppo dense su smartphone.

### 15.2 Dettaglio stand

Il dettaglio deve permettere:

- consultare informazioni editoriali;
- aggiornare lo stato visita;
- gestire priorità e cose da vedere personali;
- aggiungere/modificare note;
- aggiungere più fotografie;
- vedere e creare prodotti osservati.

I campi editoriali non diventano modificabili solo perché il profilo può aggiungere note.

### 15.3 Accessibilità

- pulsanti e filtri etichettati;
- colori non usati come unico indicatore di priorità/stato;
- informazioni mancanti indicate testualmente;
- supporto tastiera e focus visibile;
- conferma prima di eliminazioni;
- avviso e conservazione delle bozze non confermate.

---

## 16. Tipi TypeScript proposti

```ts
export interface CatalogStand {
  id: string;
  name: string;
  description?: string;
  hall?: string;
  booth?: string;
  categories: string[];
}

export interface EventStandsConfig {
  schemaVersion: 1;
  stands: CatalogStand[];
}
```

L'evento è determinato dal contesto di caricamento del file.

### 16.1 Separare le preferenze personali

```ts
export type VisitStatus = "to_visit" | "visited" | "revisit";

export interface ProfileStandState {
  profileId: string;
  eventId: string;
  standRef: {
    source: "catalog" | "personal";
    standId: string;
  };
  priority?: number;
  status: VisitStatus;
  notes?: string;
}
```

Il tipo è **illustrativo**: per gli stand personali il riferimento potrebbe richiedere ulteriori attributi o un ID globale. I dettagli sono di competenza dei documenti database e API.

### 16.2 Moduli suggeriti

```text
src/lib/config/
├── stands-schema.ts
├── stands-loader.server.ts
└── validate-references.server.ts

src/features/stands/
├── components/
│   ├── StandList.tsx
│   ├── StandCard.tsx
│   ├── StandDetails.tsx
│   ├── StandForm.tsx
│   ├── StandFilters.tsx
│   └── StandVisitControls.tsx
├── domain/
│   ├── stand-types.ts
│   ├── stand-rules.ts
│   └── stand-filters.ts
├── data/
│   └── stand-repository.ts
└── hooks/
    └── useStands.ts
```

Non creare file vuoti solo per replicare la struttura proposta.

---

## 17. Test e scenari di accettazione

| ID | Scenario | Risultato atteso |
|---|---|---|
| T-ST-01 | Catalogo `stands: []` | Valido, UI con stato vuoto |
| T-ST-02 | Due stand con stesso ID nello stesso evento | Errore |
| T-ST-03 | Stesso ID in eventi diversi | Valido |
| T-ST-04 | Nome vuoto | Errore |
| T-ST-05 | `hall` assente | Stand visibile |
| T-ST-06 | `booth` assente | Stand visibile |
| T-ST-07 | `hall` inesistente | Errore di validazione |
| T-ST-08 | Categoria sconosciuta | Errore |
| T-ST-09 | Categorie duplicate | Errore |
| T-ST-10 | Stand con due categorie valide | Visibile in entrambe |
| T-ST-11 | Stand senza categorie | Valido per proposta v1 |
| T-ST-12 | Ricerca per nome, maiuscole diverse | Stand trovato |
| T-ST-13 | Filtro per padiglione | Solo stand del padiglione |
| T-ST-14 | Filtro stato «visitato» | Solo stand visitati dal profilo |
| T-ST-15 | Priorità `1` e `10` | Ordinamento corretto |
| T-ST-16 | Priorità mancante | Non trattata come `1` |
| T-ST-17 | Due profili sullo stesso stand | Stati e priorità indipendenti |
| T-ST-18 | Stand creato da `me` | Non visibile a `father` |
| T-ST-19 | Stand personale creato offline | Presente localmente e sincronizzabile |
| T-ST-20 | Modifica prima di Salva | Solo bozza, nessuna sync |
| T-ST-21 | Salva offline | Record confermato + operazione pendente |
| T-ST-22 | Eliminazione stand editoriale da UI | Vietata |
| T-ST-23 | Eliminazione stand personale | Conferma richiesta |
| T-ST-24 | Stand personale con prodotti | Nessuna perdita silenziosa |
| T-ST-25 | Rinominare stand editoriale, stesso ID | Note/prodotti preservati |
| T-ST-26 | Rimuovere ID stand usato | Richiede migrazione |
| T-ST-27 | Aggiornamento catalogo invalido | Snapshot precedente mantenuto |
| T-ST-28 | Riapertura app | Filtri e sort resettati |
| T-ST-29 | Dashboard → stand da rivedere | Lista filtrata correttamente |
| T-ST-30 | Conflitto due dispositivi, stesso profilo | Risoluzione manuale |
| T-ST-31 | Prodotto collegato a stand di altro profilo | Operazione rifiutata |
| T-ST-32 | Offline dopo bootstrap | Catalogo e ricerca disponibili |

---

## 18. Decisioni aperte

Queste sono **proposte tecniche**, non decisioni già approvate:

| Tema | Proposta | Documento proprietario |
|---|---|---|
| `categories` vuoto | Consentito per catalogazione incompleta | `06`, `07` |
| Schema JSON esatto | `schemaVersion`, `stands`, campi della tabella §4 | `07` |
| Granularità record | Uno stand per posizione visitabile | `07`, `16` |
| ID stand | Slug per editoriali, UUID/ULID per personali | `07`, `12` |
| Classificazione multi-categoria | Filtro discendenti secondo gerarchia | `06`, `16` |
| Priorità mancante | In fondo negli ordinamenti | `09`, `16` |
| Modifiche agli interessi iniziali | Precedenza dei dati personali | `09` |
| Eliminazione stand con prodotti | Blocco, riassegnazione o cascata esplicita | `12`, `16`, `20` |
| Provenienza dei dati | Metadati di verifica o registro editoriale | `07` |
| Rimozione stand editoriali | Migrazione/riferimenti storici | `12`, `20` |
| API di gestione | Contratti e endpoint definitivi | `13` |

Non introdurre nuovi campi o comportamenti senza aggiornare lo schema e i test.

---

## 19. Criteri di completamento

- [ ] Un file JSON per evento, individuato da `app.json`.
- [ ] Catalogo condiviso indipendente dai profili.
- [ ] ID stabili e validati.
- [ ] Nome obbligatorio; padiglione, booth e descrizione facoltativi.
- [ ] Nessuna posizione non verificata inserita automaticamente.
- [ ] Stand classificabili in più categorie.
- [ ] Nessuna priorità, stato, nota o foto personale dentro il catalogo.
- [ ] Stand personali isolati per profilo.
- [ ] Stand editoriali non eliminabili dall'app.
- [ ] Ricerca, filtri e ordinamento previsti e testati.
- [ ] Catalogo consultabile offline dopo bootstrap.
- [ ] Bozze distinte da record salvati e sincronizzati.
- [ ] Prodotti collegati allo stand corretto senza mescolare profili.
- [ ] Modifiche editoriali non cancellano dati personali.
- [ ] Conflitti concorrenti gestiti manualmente.
- [ ] Supporto per eventi diversi da EICMA senza cambiare il dominio.

---

## 20. Prossimo documento

**[`08-products-config.md`](08-products-config.md)** definirà il modello dei **prodotti osservati**, che sono record dinamici e personali: campi, prezzo unico facoltativo, valutazione generale 1–10, preferiti, note, fotografie, collegamento allo stand, categoria immutabile, validazioni e casi limite.

Il titolo del documento contiene «config» per continuità con l'indice, **ma non richiede un `config/products.json`**: i prodotti saranno persistiti in IndexedDB e PostgreSQL.
