# 09 — Configurazione degli interessi personali (`config/interests/<profileId>.json`)

> **Progetto:** ExpoTrack · **Schema proposto:** v1 · **Stato:** specifica tecnica da confermare  
> **Riferimenti:** `03-app-config.md`, `04-profiles-config.md`, `06-categories-config.md`, `07-stands-config.md`, `08-products-config.md`  
> **Successivo:** `10-questionnaires-config.md`

---

## 1. Obiettivo

Gli interessi indicano **quali stand una persona vuole vedere**, **quanto sono importanti** e **cosa vuole osservare o chiedere** durante la visita. Sono specifici per profilo e per evento; non devono modificare il catalogo editoriale degli espositori e non sono un sistema di prenotazioni o di itinerari.

I file iniziali previsti sono:

```text
config/
├── app.json
├── profiles.json
├── events/
│   └── eicma-2026-stands.json
└── interests/
    ├── me.json
    └── father.json
```

Gli ID `me` e `father` sono i due profili iniziali. Il nome del file è una convenzione pratica: il collegamento affidabile è sempre l'**ID interno del profilo**, verificato dal loader. Gli interessi di un profilo creato nell'app possono partire vuoti ed essere registrati come dati dinamici, senza creare un file JSON.

### 1.1 Requisiti confermati

- Un profilo può assegnare **una priorità intera da 1 a 10** a ogni stand.
- La priorità di un profilo è indipendente da quella degli altri.
- Ogni profilo può avere una lista di **cose da vedere** per stand, espressa come stringhe libere.
- Lo stesso stand può essere importante per entrambi i profili, con priorità e obiettivi differenti.
- Gli stand non presenti nel file interessi rimangono comunque consultabili nel catalogo generale.
- I nuovi stand creati durante la visita sono **privati del profilo creatore**.
- Lo stato di visita è distinto dagli interessi: `da visitare`, `visitato`, `da rivedere`.
- L'utente può aggiornare le proprie preferenze nell'app, anche offline.
- Le modifiche sono autosalvate in bozza, ma vengono confermate tramite **Salva** e poi sincronizzate.
- Non sono previsti mappe, navigazione o itinerari.

### 1.2 Distinzione fondamentale

| Dato | Dove si trova | Natura |
|---|---|---|
| Nome, padiglione, categorie di uno stand editoriale | `config/events/<eventId>-stands.json` | Catalogo condiviso |
| Priorità iniziale, cose da vedere iniziali | `config/interests/<profileId>.json` | Seed editoriale per profilo |
| Priorità modificata dall'utente | IndexedDB + PostgreSQL | Dato dinamico personale |
| Cose da vedere modificate dall'utente | IndexedDB + PostgreSQL | Dato dinamico personale |
| Stato di visita | IndexedDB + PostgreSQL | Dato dinamico personale |
| Note, foto e prodotti osservati | IndexedDB + PostgreSQL/storage media | Dato dinamico personale |

**Non scrivere** le modifiche dell'utente nei file JSON distribuiti con l'app.

---

## 2. Schema JSON proposto

### 2.1 Esempio minimo

```json
{
  "schemaVersion": 1,
  "profileId": "me",
  "events": []
}
```

Questo file è valido: il profilo non ha ancora interessi iniziali. Il catalogo stand rimane accessibile.

### 2.2 Esempio illustrativo completo

```json
{
  "schemaVersion": 1,
  "profileId": "me",
  "events": [
    {
      "eventId": "eicma-2026",
      "stands": [
        {
          "standId": "demo-suzuki",
          "priority": 10,
          "whatToSee": [
            "Salire sulla moto che mi interessa",
            "Verificare altezza della sella e posizione di guida",
            "Chiedere disponibilità e accessori"
          ]
        },
        {
          "standId": "demo-helmets",
          "priority": 8,
          "whatToSee": [
            "Provare più taglie e modelli",
            "Verificare comfort e chiusura"
          ]
        }
      ]
    }
  ]
}
```

**Attenzione:** `demo-suzuki` e `demo-helmets` sono **ID fittizi**, non stand EICMA verificati. Il JSON diventa valido nel progetto soltanto se tali ID esistono nel catalogo dell'evento. Le frasi sono esempi di possibili obiettivi, non una lista definitiva di interessi da attribuire al profilo.

### 2.3 Esempio per il secondo profilo

```json
{
  "schemaVersion": 1,
  "profileId": "father",
  "events": [
    {
      "eventId": "eicma-2026",
      "stands": [
        {
          "standId": "demo-suzuki",
          "priority": 6,
          "whatToSee": ["Valutare accessori e finiture"]
        }
      ]
    }
  ]
}
```

Il medesimo `standId` può comparire in più file interessi: **non è un duplicato**, perché appartiene a profili diversi.

---

## 3. Definizione dei campi

| Percorso | Tipo | Obbligatorio | Vincoli |
|---|---|---|---|
| `schemaVersion` | intero | Sì | `1` |
| `profileId` | stringa | Sì | ID di un profilo configurato valido |
| `events` | array | Sì | Può essere vuoto |
| `events[].eventId` | stringa | Sì | Evento definito in `app.json` |
| `events[].stands` | array | Sì | Può essere vuoto |
| `events[].stands[].standId` | stringa | Sì | Stand editoriale dell'evento |
| `events[].stands[].priority` | intero | No | Se presente, da `1` a `10` |
| `events[].stands[].whatToSee` | array di stringhe | No | Default `[]`; nessuna stringa vuota |

### 3.1 Perché `events[]` e non un solo `eventId`

Un profilo può partecipare a più fiere, mantenendo un solo file di interessi iniziali. La struttura per evento evita che uno stand di una fiera venga confuso con uno stand avente lo stesso ID in un'altra fiera.

**Proposta tecnica da confermare:** usare un solo file per profilo contenente più eventi. Un'alternativa è un file per coppia `(profileId, eventId)`; il resto del dominio deve comunque utilizzare entrambe le chiavi. La prima opzione è coerente con la struttura già prevista (`me.json`, `father.json`).

### 3.2 `profileId`

È un ID tecnico, **non** il nome visualizzato. Deve corrispondere al profilo per il quale il file viene caricato. Non dedurre l'identità dal solo nome del file senza controllarne il contenuto.

Se il file `me.json` dichiara `"profileId": "father"`, il loader deve segnalare un'incoerenza anziché assegnare gli interessi al profilo sbagliato.

### 3.3 `standId`

Si riferisce a uno stand **editoriale** del catalogo `events/<eventId>-stands.json`. La chiave logica è `(eventId, standId)`.

Gli stand personali creati nell'app non sono inseriti in questo JSON: i loro interessi sono dati dinamici associati al proprietario.

### 3.4 `priority`

- Valori validi: interi `1`–`10`.
- `1` è una priorità bassa, `10` è massima.
- Il campo è facoltativo: **non impostata** è diverso da `1`.
- `0`, `11`, numeri decimali, stringhe numeriche e `null` non sono validi nella proposta v1.
- Non confondere la priorità dello stand con la valutazione generale `1`–`10` di un prodotto osservato.

### 3.5 `whatToSee`

È una lista ordinata di obiettivi testuali, per esempio:

```json
{
  "standId": "demo-helmets",
  "whatToSee": [
    "Provare il casco",
    "Controllare la visibilità laterale",
    "Chiedere informazioni sulle taglie"
  ]
}
```

La lista può essere vuota. Non è un questionario: non definisce tipi di risposta, valori obbligatori, scelte o punteggi. Le domande strutturate appartengono esclusivamente ai file `config/questionnaires/<profileId>.json`.

**Proposta:** mantenere l'ordine delle stringhe così come definito nel JSON; la UI può consentire di riordinarle come dato personale, se questa funzione verrà implementata.

### 3.6 Record senza priorità né obiettivi

Un elemento con soltanto `standId` non aggiunge alcuna informazione rispetto al catalogo. Si propone di **rifiutarlo** nel validatore editoriale oppure segnalarlo come warning, per evitare righe inutili. La politica definitiva va confermata.

---

## 4. Risoluzione del profilo e dell'evento

### 4.1 Caricamento iniziale

1. Il loader legge e valida `app.json`.
2. Carica i profili iniziali da `profiles.json`.
3. Carica i cataloghi stand per gli eventi disponibili.
4. Per ogni profilo configurato, legge il file interessi previsto, **se presente**.
5. Verifica `profileId`, `eventId` e tutti gli `standId`.
6. Produce uno snapshot editoriale coerente per il client.
7. Il client unisce gli interessi iniziali alle eventuali modifiche personali già persistite.

**Scelta proposta:** l'assenza di un file interessi per un profilo configurato è lecita e significa nessun interesse iniziale. Non inventare priorità o cose da vedere.

### 4.2 Profilo disabilitato

Se `enabled: false` in `profiles.json`, gli interessi iniziali e i dati personali devono restare conservati. Disabilitare un profilo non significa eliminare preferenze, prodotti o stati di visita.

### 4.3 Profilo creato dall'app

Un nuovo profilo dinamico parte con **nessun interesse iniziale** e può impostare priorità e cose da vedere durante l'utilizzo. Non deve ereditare automaticamente `me.json` o `father.json`.

### 4.4 Cambio evento

La lista degli interessi mostrata deve essere filtrata per `(profileId, eventId)`. Il cambio evento non deve cancellare o sovrascrivere le preferenze di quello precedente.

---

## 5. Modello di precedenza: seed JSON e modifiche personali

Questa è una decisione particolarmente importante perché i file JSON possono cambiare dopo che l'utente ha già visitato la fiera.

### 5.1 Regola proposta: override per singolo campo

Per ogni coppia `(profileId, eventId, standRef)`:

- Se non esiste una modifica personale salvata, mostrare il valore iniziale del JSON.
- Se l'utente ha salvato una modifica personale a `priority`, usare **la sua priorità**.
- Se l'utente ha salvato una modifica personale a `whatToSee`, usare **la sua lista**.
- Se l'utente ha esplicitamente cancellato la priorità o svuotato la lista, conservare l'**override vuoto**: non ripristinare il seed.
- Non sovrascrivere una modifica personale quando arriva una nuova versione del JSON.

Questo richiede di distinguere **campo mai modificato** da **campo modificato intenzionalmente a vuoto**.

### 5.2 Esempi

| Seed JSON | Override personale | Valore mostrato |
|---|---|---|
| Priorità `9` | Nessuno | `9` |
| Priorità `9` | Priorità `6` | `6` |
| Priorità `9` | Priorità esplicitamente rimossa | Non impostata |
| Lista `['A', 'B']` | Nessuno | `['A', 'B']` |
| Lista `['A', 'B']` | Lista `['A', 'C']` | `['A', 'C']` |
| Lista `['A', 'B']` | Lista vuota salvata | `[]` |

### 5.3 Perché non fondere automaticamente le liste

Se il seed aggiunge una nuova voce e l'utente aveva già modificato la lista, una fusione automatica potrebbe reintrodurre attività rimosse intenzionalmente o creare duplicati. La proposta v1 è **sostituzione completa della lista personale** quando esiste un override.

Un eventuale pulsante «Ripristina valori iniziali» può cancellare l'override per il campo selezionato, tornando al seed corrente. È una **proposta facoltativa**, non un requisito già confermato.

### 5.4 Aggiornamenti del seed

| Evento | Comportamento proposto |
|---|---|
| Il JSON cambia priorità, utente non l'ha mai modificata | Mostrare nuova priorità |
| Il JSON cambia priorità, utente ha un override | Mantenere override |
| Il JSON aggiunge un obiettivo, nessun override | Mostrare lista aggiornata |
| Il JSON aggiunge un obiettivo, lista personale modificata | Mantenere lista personale |
| Il JSON rimuove uno stand già visitato | Non cancellare dati personali; migrazione/riferimento storico |

La gestione di riferimenti rimossi e conflitti è approfondita in `20-synchronization.md`.

---

## 6. Distinguere interessi, stati e note

Gli interessi non rappresentano automaticamente una visita effettuata.

| Concetto | Significato | Valore iniziale |
|---|---|---|
| Priorità | Quanto è importante lo stand per il profilo | Non impostata, salvo seed |
| Cosa vedere | Attività/obiettivi personali presso lo stand | Lista vuota, salvo seed |
| Stato visita | Da visitare / visitato / da rivedere | Da visitare |
| Note | Annotazioni durante la visita | Vuote |
| Foto | Immagini raccolte | Nessuna |
| Prodotti | Prodotti osservati | Nessuno |

La priorità non determina automaticamente lo stato: uno stand con priorità `10` può essere ancora «da visitare». Uno stand con priorità non impostata può essere «visitato».

**Non inserire** `visitStatus`, `notes`, `photos`, `products`, `visitedAt` o risposte ai questionari nel file degli interessi.

---

## 7. Comportamento nell'interfaccia

### 7.1 Dettaglio stand

Per lo stand aperto, l'app deve mostrare la priorità e la lista «cosa vedere» del **profilo attivo**. La modifica deve essere possibile anche per stand editoriali, senza rendere modificabili nome, padiglione o categorie del catalogo condiviso.

### 7.2 Priorità

Un controllo può permettere di selezionare `1`–`10` e, se previsto, di rimuovere una priorità esistente. Deve essere chiaro che «non impostata» è diverso dal minimo.

### 7.3 Lista «cosa vedere»

L'utente può aggiungere, modificare e rimuovere voci testuali. Le modifiche rimangono una bozza fino a **Salva**. Le voci non sono obbligatorie e non sono domande strutturate.

### 7.4 Lista stand

La priorità personale può essere visualizzata sulla scheda dello stand e usata per filtrare e ordinare. La ricerca e gli altri filtri devono operare sull'unione di stand editoriali e stand personali **visibili al profilo**.

### 7.5 Filtri

Sono confermati filtri per nome, categoria, padiglione, priorità e stato. **Proposta di semantica per priorità:** filtro per valore esatto o intervallo configurabile in UI; il dettaglio del controllo verrà definito in `14-frontend-ui.md`.

### 7.6 Ordinamento

Ordinare per priorità crescente/decrescente. **Proposta:** stand senza priorità in fondo in entrambe le direzioni, con spareggio per nome. Gli ordinamenti e filtri si **resettano alla riapertura** dell'app.

### 7.7 Dashboard

La dashboard può evidenziare gli stand importanti, ma i contatori confermati restano basati sugli stati di visita e sui prodotti del profilo attivo. Non contare automaticamente uno stand con priorità come «visitato».

---

## 8. Stand personali

Uno stand aggiunto durante la fiera:

- appartiene a `profileId` e `eventId`;
- è visibile solo al profilo proprietario;
- può avere priorità e cose da vedere personali;
- non deve essere aggiunto al catalogo JSON condiviso;
- non deve essere referenziato nei seed `config/interests/*.json`;
- può essere modificato/eliminato secondo `16-stand-management.md`.

La stessa logica di dominio delle priorità e delle liste può essere riutilizzata per stand editoriali e personali. Il riferimento deve distinguere le due origini:

```ts
type StandRef = {
  source: "catalog" | "personal";
  standId: string;
};
```

La chiave completa comprende anche evento e profilo. Gli ID degli stand personali devono essere univoci anche offline.

---

## 9. Bozze, salvataggio e sincronizzazione

### 9.1 Macchina degli stati

```text
Visualizzazione seed/override confermato
            │
            ▼
     Modifica dell'utente
            │
            ▼
    Bozza autosalvata locale
            │
       [pulsante Salva]
            │
            ▼
  Validazione e transazione IndexedDB
            │
            ▼
  Override personale confermato + operazione sync
            │
       Rete disponibile?
         /         \
       sì           no
       │             │
       ▼             ▼
  Sincronizza     In attesa
       │             │
       ▼             └──► Sincronizza quando online
  Confermato server
```

La bozza **non** deve essere sincronizzata. Il pulsante **Salva** deve funzionare offline se IndexedDB è disponibile.

### 9.2 Persistenza di un override

È opportuno memorizzare esplicitamente quali campi sono stati sovrascritti, per esempio:

```json
{
  "profileId": "me",
  "eventId": "eicma-2026",
  "standRef": { "source": "catalog", "standId": "demo-helmets" },
  "overrides": {
    "priority": { "isOverridden": true, "value": null },
    "whatToSee": { "isOverridden": true, "value": [] }
  }
}
```

Questo è **solo un esempio di modello persistito**, non il formato di `config/interests/me.json`. `null` per la priorità indica una rimozione **esplicita** nel modello dinamico; nei seed la priorità opzionale viene invece omessa.

### 9.3 Atomicità

Il salvataggio locale confermato e l'inserimento dell'operazione nella coda devono essere **atomici** per evitare modifiche salvate ma mai sincronizzabili.

### 9.4 Errori

- Errore di validazione: non confermare, mantenere la bozza.
- Errore IndexedDB: non dichiarare «salvato», mantenere quanto possibile la bozza.
- Offline: mostrare «salvato localmente / in attesa di sincronizzazione».
- Errore server: mantenere override e operazione pendente; consentire retry.
- Conflitto: preservare entrambe le versioni e chiedere una scelta manuale.

### 9.5 Due dispositivi

Se due dispositivi modificano le preferenze **dello stesso profilo e stand**, non applicare una strategia silenziosa last-write-wins. La risoluzione manuale deve permettere di confrontare le versioni e scegliere quale mantenere. La gestione di un eventuale merge per singolo campo è **da decidere** in `20-synchronization.md`.

---

## 10. Validazione editoriale

### 10.1 Controlli strutturali

| ID | Controllo | Esito |
|---|---|---|
| INT-001 | JSON sintatticamente valido | Errore se invalido |
| INT-002 | Root oggetto | Errore se invalido |
| INT-003 | `schemaVersion === 1` | Errore se invalido |
| INT-004 | `profileId` stringa non vuota | Errore se invalido |
| INT-005 | `events` array | Errore se invalido |
| INT-006 | `eventId` valido | Errore se invalido |
| INT-007 | Nessun `eventId` duplicato nel file | Errore |
| INT-008 | `stands` array | Errore se invalido |
| INT-009 | `standId` stringa non vuota | Errore se invalido |
| INT-010 | Nessun `standId` duplicato nello stesso evento | Errore |
| INT-011 | `priority` intero 1–10 se presente | Errore |
| INT-012 | `whatToSee` array di stringhe se presente | Errore |
| INT-013 | Ogni voce non vuota dopo trim | Errore |
| INT-014 | Nessun riferimento a stand personale nei seed | Errore |
| INT-015 | Campi sconosciuti rifiutati (proposta) | Errore |

### 10.2 Validazioni incrociate

- `profileId` deve esistere tra i profili configurati.
- Il nome del file e il `profileId` devono essere coerenti.
- Ogni `eventId` deve essere definito in `app.json`.
- Ogni `standId` deve essere presente nel catalogo **di quell'evento**.
- Il catalogo stand e i suoi riferimenti a padiglioni/categorie devono essere già validati.
- Non assumere che un file di interessi sia obbligatorio per ogni profilo.

### 10.3 Duplicati nelle liste

**Proposta:** consentire stringhe ripetute solo se intenzionali, ma segnalare come warning le voci identiche dopo normalizzazione. Non eliminare automaticamente righe: l'utente potrebbe volerle mantenere in posizioni diverse.

### 10.4 Errori leggibili

```text
CONFIG_UNKNOWN_INTEREST_STAND
File: config/interests/me.json
Campo: $.events[0].stands[2].standId
Problema: "stand-sconosciuto" non esiste nel catalogo "eicma-2026".
```

```text
CONFIG_INVALID_INTEREST_PRIORITY
File: config/interests/father.json
Campo: $.events[0].stands[1].priority
Problema: atteso un intero tra 1 e 10; ricevuto 11.
```

```text
CONFIG_INTEREST_PROFILE_MISMATCH
File: config/interests/me.json
Campo: $.profileId
Problema: il file è associato a "me" ma dichiara "father".
```

---

## 11. Tipi TypeScript proposti

### 11.1 Seed JSON

```ts
export interface StandInterestSeed {
  standId: string;
  priority?: number;
  whatToSee?: string[];
}

export interface EventInterestSeed {
  eventId: string;
  stands: StandInterestSeed[];
}

export interface InterestsConfig {
  schemaVersion: 1;
  profileId: string;
  events: EventInterestSeed[];
}
```

Questi tipi non sostituiscono la validazione runtime e i controlli incrociati.

### 11.2 Vista applicativa normalizzata

```ts
export interface EffectiveStandInterest {
  profileId: string;
  eventId: string;
  standRef: {
    source: "catalog" | "personal";
    standId: string;
  };
  priority: number | null;
  whatToSee: string[];
}
```

`priority: null` nella **vista normalizzata** significa «nessuna priorità effettiva», anche se nei JSON editoriali si rappresenta omettendo il campo.

### 11.3 Risoluzione degli override

```ts
interface FieldOverride<T> {
  isOverridden: boolean;
  value: T;
}

function resolveField<T>(seedValue: T, override?: FieldOverride<T>): T {
  return override?.isOverridden ? override.value : seedValue;
}
```

Esempio concettuale: non è codice completo per IndexedDB, migrazioni o conflitti. Un override `value: []` deve rimanere valido e non essere trattato come assenza.

---

## 12. Implementazione consigliata

```text
src/lib/config/
├── interests-schema.ts
├── interests-loader.server.ts
└── validate-references.server.ts

src/features/stands/
├── domain/
│   ├── interest-types.ts
│   ├── interest-rules.ts
│   └── effective-interests.ts
├── data/
│   └── interest-repository.ts
├── components/
│   ├── StandPriorityControl.tsx
│   ├── WhatToSeeList.tsx
│   └── StandInterestEditor.tsx
└── hooks/
    └── useStandInterests.ts

src/lib/offline/
├── draft-store.ts
└── indexeddb.ts

src/lib/sync/
└── sync-queue.ts
```

I nomi sono suggerimenti; la struttura finale deve essere coerente con `02-project-structure.md` e non richiede file vuoti creati in anticipo.

### 12.1 Funzione di risoluzione

La logica di lettura dovrebbe:

1. individuare il profilo e l'evento attivi;
2. caricare il seed per lo stand editoriale, se esiste;
3. caricare gli override personali salvati;
4. risolvere i singoli campi secondo la regola di precedenza;
5. restituire la vista normalizzata;
6. sovrapporre un'eventuale bozza **solo nell'editor**, senza alterare il valore confermato.

### 12.2 Indicizzazione

Per evitare scansioni ripetute dei file JSON, indicizzare i seed per `(profileId, eventId, standId)`. Per gli override usare una chiave che includa anche l'origine dello stand.

### 12.3 API

Gli endpoint definitivi saranno descritti in `13-backend-api.md`. Le operazioni concettuali sono:

- leggere gli interessi effettivi del profilo/evento;
- salvare un override di priorità;
- salvare una lista «cosa vedere»;
- rimuovere un override per tornare al seed, **solo se la funzione sarà approvata**;
- sincronizzare le operazioni offline;
- risolvere conflitti manualmente.

Il server non deve scrivere nei file JSON durante queste operazioni.

---

## 13. Compatibilità e migrazioni

### 13.1 Rinomina dello stand

Se cambia `name` ma l'ID resta invariato, gli interessi devono continuare a riferirsi allo stesso stand.

### 13.2 Cambio ID dello stand

È una modifica potenzialmente incompatibile: può rompere seed, override, stati visita, note e prodotti. Richiede una migrazione esplicita, non una sostituzione automatica basata sul nome.

### 13.3 Stand rimosso dal catalogo

Il loader editoriale deve segnalare i seed che referenziano stand inesistenti. Per i dati dinamici già raccolti, preservare le informazioni finché non viene definita una migrazione o una strategia di riferimento storico.

### 13.4 Rimozione di un profilo configurato

Disabilitare il profilo è diverso dal rimuoverlo. `enabled: false` mantiene i dati; rimuovere l'ID dal JSON può rendere orfani i file interessi e richiede un intervento esplicito.

### 13.5 Evoluzione dello schema

`schemaVersion` identifica la forma del file, non la versione dell'app né la data della fiera. Nuovi campi incompatibili richiedono aggiornamento dello schema, del validatore e dei test.

---

## 14. Sicurezza e separazione

- I file interessi sono **configurazione editoriale**, non password o dati di autenticazione.
- L'utente può selezionare liberamente i profili disponibili nella v1.
- `profileId` è un identificatore di ambito dati, **non una prova di identità**.
- Cloudflare Tunnel da solo non limita l'accesso al sito.
- La UI non deve mostrare gli override di un profilo quando è attivo un altro.
- La coda di sincronizzazione e le bozze devono restare associate al profilo originale anche dopo un cambio profilo.
- Le API devono verificare coerenza dei riferimenti e non consentire di collegare interessi a stand personali altrui; questo controllo non sostituisce l'autenticazione.
- Non aggiungere PIN o login interni senza una nuova decisione di progetto.

---

## 15. Test di accettazione

| ID | Scenario | Risultato atteso |
|---|---|---|
| T-INT-01 | File con `events: []` | Valido |
| T-INT-02 | Priorità `1` | Valida |
| T-INT-03 | Priorità `10` | Valida |
| T-INT-04 | Priorità `0`, `11`, `7.5` | Errore |
| T-INT-05 | Priorità omessa | Non impostata |
| T-INT-06 | `whatToSee: []` | Valido |
| T-INT-07 | Voce composta solo da spazi | Errore |
| T-INT-08 | Due record stesso stand/evento | Errore |
| T-INT-09 | Stesso stand in due profili | Valido, valori indipendenti |
| T-INT-10 | Stesso stand ID in eventi diversi | Valido, ambiti separati |
| T-INT-11 | Evento inesistente | Errore |
| T-INT-12 | Stand editoriale inesistente | Errore |
| T-INT-13 | `profileId` incoerente col file | Errore |
| T-INT-14 | Profilo senza file interessi | Catalogo disponibile, seed vuoto |
| T-INT-15 | Profilo dinamico nuovo | Nessun interesse ereditato |
| T-INT-16 | Seed priorità 9, nessun override | Mostra 9 |
| T-INT-17 | Seed 9, override 6 | Mostra 6 |
| T-INT-18 | Seed 9, override rimozione esplicita | Nessuna priorità |
| T-INT-19 | Seed lista A/B, override lista vuota | Lista vuota |
| T-INT-20 | Aggiornamento seed con override esistente | Override preservato |
| T-INT-21 | Aggiornamento seed senza override | Nuovo seed visibile |
| T-INT-22 | Modifica non confermata | Solo bozza locale |
| T-INT-23 | Salva offline | Override confermato + sync pendente |
| T-INT-24 | Errore IndexedDB | Non mostrare falso successo |
| T-INT-25 | Ritorno online | Operazione sincronizzabile |
| T-INT-26 | Conflitto tra due dispositivi | Scelta manuale, entrambe le versioni preservate |
| T-INT-27 | Cambio profilo con bozza | Bozza conservata nel profilo originale |
| T-INT-28 | Stand personale con interessi | Visibile solo al proprietario |
| T-INT-29 | Stand priorità 10 non visitato | Stato resta «da visitare» |
| T-INT-30 | Ordinamento priorità | Valori corretti, mancanti distinti |
| T-INT-31 | Riapertura app | Filtri e ordinamento resettati |
| T-INT-32 | Disabilitazione profilo | Dati e seed conservati |
| T-INT-33 | Rinomina stand senza cambio ID | Interessi preservati |
| T-INT-34 | Rimozione stand referenziato | Errore/migrazione, nessuna perdita silenziosa |
| T-INT-35 | File con campo sconosciuto | Errore, se policy strict approvata |
| T-INT-36 | Nessun questionario configurato | Gli interessi non generano domande |

---

## 16. Decisioni aperte

| Tema | Proposta | Da finalizzare in |
|---|---|---|
| Forma dei file | Un file per profilo, array per eventi | `09` |
| Campi esatti | `schemaVersion`, `profileId`, `events`, `stands`, `standId`, `priority`, `whatToSee` | `09` |
| File interessi mancante | Valido, seed vuoto | `09` |
| Record senza priorità e lista | Warning o errore | `09` |
| Precedenza | Override personale per singolo campo | `09`, `20` |
| Lista personale | Sostituisce integralmente quella del seed | `09` |
| Rimozione override | Possibile «Ripristina valori iniziali» | `14`, `16` |
| Priorità non impostata nell'ordinamento | Sempre in fondo | `14`, `16` |
| Filtro priorità | Valore esatto o intervallo | `14` |
| Conflitti su campi diversi | Scelta manuale; merge da valutare | `20` |
| Gestione stand editoriali rimossi | Migrazione o riferimenti storici | `12`, `20` |
| Rifiuto campi sconosciuti | Validazione strict | `09` |

Le proposte vanno considerate **decisioni implementative da confermare**, non requisiti già approvati.

---

## 17. Criteri di completamento

- [ ] Esistono schemi e validatori runtime per gli interessi.
- [ ] Ogni file dichiara il proprio `profileId`.
- [ ] Ogni riferimento a evento e stand editoriale è validato.
- [ ] Priorità `1`–`10` facoltativa e distinta da «non impostata».
- [ ] `whatToSee` è una lista libera e non un questionario.
- [ ] Seed iniziali separati dalle modifiche personali.
- [ ] Override espliciti vuoti non vengono persi.
- [ ] Modifiche JSON non sovrascrivono preferenze personali già salvate.
- [ ] Profili diversi possono avere priorità e liste diverse per lo stesso stand.
- [ ] Profili creati dall'app partono senza seed e senza questionari generici.
- [ ] Stand personali restano privati del creatore.
- [ ] Bozze autosalvate, Salva esplicito e sincronizzazione offline rispettati.
- [ ] Conflitti concorrenti risolti manualmente.
- [ ] Filtri e ordinamento si resettano alla riapertura.
- [ ] Nessun dato di visita viene scritto nei file JSON editoriali.

---

## 18. Prossimo documento

**`10-questionnaires-config.md`** definirà i JSON `config/questionnaires/me.json` e `config/questionnaires/father.json`: associazione esclusiva **profilo + categoria/sottocategoria**, tipi di domanda, opzioni, identificativi stabili, domande tutte facoltative, versionamento, validazione e soprattutto la regola — ancora da decidere — di eventuale ereditarietà tra categorie padre e figlie.

**Nota:** in questo passaggio è stata creata **solo la specifica Markdown**, non i file JSON definitivi `me.json` e `father.json`: gli ID degli stand reali devono prima essere verificati e approvati.
