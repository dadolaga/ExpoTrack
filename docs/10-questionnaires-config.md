# 10 — Configurazione dei questionari personali

## Aggiornamento mobile — risposte A1–A9

**Contratto vigente per il web mobile da fiera:** [specifica UI mobile, risposte A1–A9](27_Specifiche_UI_Mobile.md#10-risposte-di-revisione-recepite). Questo aggiornamento prevale sui paragrafi, diagrammi, pseudocodice e casi di test precedenti incompatibili. In particolare, gli esempi con `drafts`, conferma finale «Salva», dettaglio mobile 08, foto stand o scelta manuale del conflitto descrivono la progettazione precedente e non vanno implementati nel mobile. Le parti compatibili e le funzioni desktop/post-fiera mantengono il proprio ambito.

Risposte facoltative autosalvate localmente e sincronizzate senza Salva/bozze. Nome canonico del rating: rating_1_10, con normalizzazione dell’alias storico rating in lettura. Restano sei tipi; nessuna domanda generica o commento accessorio non configurato. Default operativo: matching esatto categoria/profilo, nessuna ereditarietà implicita.


> **Progetto:** ExpoTrack · **Documento:** `docs/10-questionnaires-config.md` · **Schema proposto:** v1  
> **File interessati:** `config/questionnaires/me.json`, `config/questionnaires/father.json` e, in futuro, altri profili  
> **Dipendenze:** `04-profiles-config.md`, `06-categories-config.md`, `08-products-config.md`, `09-interests-config.md`  
> **Segue:** `11-visit-statuses-config.md` · **Motore runtime:** `18-questionnaire-engine.md`

---

## 1. Obiettivo

Definire un formato JSON modulare che consenta a ogni profilo di preparare **domande diverse per ciascuna categoria o sottocategoria di prodotto**. Durante la visita, il questionario compare nella scheda di un prodotto **soltanto se esiste una definizione applicabile al profilo attivo e alla categoria scelta**. Non esiste un questionario generale, comune o obbligatorio.

Questo documento descrive il **contratto editoriale** delle domande. Le risposte compilate sono **dati dinamici personali**, salvati in IndexedDB e sincronizzati in PostgreSQL; non vengono scritte nei JSON editoriali.

### 1.1 Decisioni già confermate

- I questionari sono **specifici del profilo e della categoria/sottocategoria**.
- `me` e `father` possono avere **domande e opzioni completamente differenti**, anche nella stessa categoria.
- Tutte le domande sono **facoltative**.
- Tipi ammessi: **testo libero, numero, sì/no, scelta singola, scelta multipla, valutazione 1–10**.
- Senza un questionario configurato, **non compare alcuna sezione questionario** e non si generano domande di default.
- Le risposte appartengono al prodotto e al profilo.
- Il **voto generale 1–10 del prodotto** è distinto dalle domande con risposta 1–10.
- La categoria del prodotto è **scelta manualmente e immutabile dopo il primo salvataggio locale confermato**.
- Salvataggio mobile automatico locale e outbox per valori validi, senza modalità bozza o conferma Salva finale; input invalidi conservati localmente secondo §5.1 del documento 27.
- Aggiornamenti di configurazione non devono cancellare silenziosamente risposte storiche.

### 1.2 Questione aperta principale

Non è ancora stata concordata l'**ereditarietà dei questionari fra categorie padre e figlie**. Questo documento propone, come **default tecnico v1**, il **matching esatto del `categoryId`**, senza eredità implicita. È una proposta da confermare prima di implementare `18-questionnaire-engine.md`.

---

## 2. Collocazione e responsabilità

```text
ExpoTrack/
├── config/
│   ├── app.json
│   ├── profiles.json
│   ├── categories.json
│   ├── questionnaires/
│   │   ├── me.json                  # domande editoriali del profilo me
│   │   └── father.json              # domande editoriali del profilo father
│   └── events/
│       └── eicma-2026-stands.json
├── docs/
│   ├── 10-questionnaires-config.md
│   └── 18-questionnaire-engine.md
└── src/
    ├── lib/config/
    └── features/questionnaires/
```

I file sono **per profilo**, non per prodotto e non per stand. Un questionario si applica alla categoria selezionata del prodotto; non dipende dalle categorie multiple dello stand.

| Dato | Dove vive |
|---|---|
| Identità del profilo | `profiles.json` o record dinamico del profilo |
| Gerarchia delle categorie | `categories.json` |
| Definizioni delle domande | `questionnaires/<profileId>.json` |
| Categoria del prodotto | Record prodotto dinamico |
| Risposte compilate | IndexedDB/PostgreSQL, associate al prodotto |
| Versione della definizione utilizzata | Metadato delle risposte/prodotto, da definire nel motore |
| Fotografie e note del prodotto | Dati dinamici del prodotto |

**Non creare** `config/questionnaires/common.json`, `default.json` o un questionario globale di fallback: contraddirebbero il requisito.

---

## 3. Formato JSON proposto

### 3.1 Esempio minimo valido: nessun questionario

```json
{
  "schemaVersion": 1,
  "profileId": "me",
  "questionnaires": []
}
```

Il file vuoto è valido. La sezione questionario rimane nascosta per tutte le categorie di quel profilo. Anche **l'assenza completa del file** deve essere trattata come «nessun questionario configurato», purché non sia stato dichiarato esplicitamente come obbligatorio da un futuro manifesto: non bloccare l'app per un profilo senza domande.

### 3.2 Esempio completo illustrativo per `me`

```json
{
  "schemaVersion": 1,
  "profileId": "me",
  "questionnaires": [
    {
      "id": "me-helmets-integral-v1",
      "categoryId": "helmets-integral",
      "version": 1,
      "title": "Valutazione casco integrale",
      "description": "Domande personali da compilare durante la prova.",
      "questions": [
        {
          "id": "comfort",
          "label": "Quanto è comodo?",
          "type": "rating_1_10"
        },
        {
          "id": "weight_grams",
          "label": "Peso dichiarato (grammi)",
          "type": "number",
          "min": 0,
          "max": 5000,
          "step": 1
        },
        {
          "id": "visor_notes",
          "label": "Note sulla visiera",
          "type": "text",
          "placeholder": "Annotazioni facoltative"
        },
        {
          "id": "pinlock_included",
          "label": "Pinlock incluso?",
          "type": "boolean"
        },
        {
          "id": "fit",
          "label": "Come calza?",
          "type": "single_choice",
          "options": [
            { "id": "tight", "label": "Stretto" },
            { "id": "right", "label": "Giusto" },
            { "id": "loose", "label": "Largo" }
          ]
        },
        {
          "id": "features",
          "label": "Caratteristiche interessanti",
          "type": "multiple_choice",
          "options": [
            { "id": "sun_visor", "label": "Visierino parasole" },
            { "id": "emergency_release", "label": "Sistema di sgancio guanciali" },
            { "id": "ventilation", "label": "Ventilazione regolabile" }
          ]
        }
      ]
    }
  ]
}
```

**Esempio inventato per illustrare lo schema**, non una selezione definitiva di domande o categorie. `helmets-integral` deve essere presente in `categories.json` per superare la validazione incrociata.

### 3.3 Esempio differente per `father`

```json
{
  "schemaVersion": 1,
  "profileId": "father",
  "questionnaires": [
    {
      "id": "father-helmets-integral-v1",
      "categoryId": "helmets-integral",
      "version": 1,
      "title": "Prova casco",
      "questions": [
        { "id": "glasses_compatible", "label": "Comodo con gli occhiali?", "type": "boolean" },
        { "id": "first_impression", "label": "Prima impressione", "type": "text" }
      ]
    }
  ]
}
```

I due profili condividono l'ID di categoria, **non le domande**. Il motore non deve unire automaticamente le domande dei due file.

---

## 4. Schema dei campi

### 4.1 Radice

| Campo | Tipo | Obbligatorio | Regola |
|---|---|---|---|
| `schemaVersion` | intero | Sì | `1` per questo contratto |
| `profileId` | stringa | Sì | ID stabile del profilo proprietario |
| `questionnaires` | array | Sì | Zero o più definizioni |

### 4.2 Questionario

| Campo | Tipo | Obbligatorio | Regola |
|---|---|---|---|
| `id` | stringa | Sì | ID stabile della definizione; unico nel file |
| `categoryId` | stringa | Sì | Categoria/sottocategoria esistente |
| `version` | intero | Sì | Intero positivo, incrementato per modifiche incompatibili |
| `title` | stringa | Sì | Non vuota |
| `description` | stringa | No | Testo descrittivo facoltativo |
| `questions` | array | Sì | Una o più domande, ordine editoriale |

**Regola proposta v1:** al massimo **un questionario attivo per `categoryId` nello stesso file di profilo**. Il versionamento storico è gestito tramite snapshot/versioni delle definizioni, non mantenendo più versioni attive nello stesso array.

### 4.3 Domanda

| Campo | Tipo | Obbligatorio | Regola |
|---|---|---|---|
| `id` | stringa | Sì | Unico all'interno del questionario, stabile nel tempo |
| `label` | stringa | Sì | Testo della domanda, non vuoto |
| `type` | enum | Sì | Uno dei sei tipi del §5 |
| `helpText` | stringa | No | Indicazioni facoltative |
| `placeholder` | stringa | No | Solo `text` (proposta) |
| `min` | numero | No | Solo `number` |
| `max` | numero | No | Solo `number` |
| `step` | numero | No | Solo `number`, maggiore di zero |
| `options` | array | Condizionale | Obbligatorio per scelta singola/multipla |

**Non prevedere `required: true`**: tutte le domande sono facoltative. Per evitare ambiguità, il validatore v1 rifiuta `required` anche se impostato a `false`; l'opzionalità è una regola di dominio.

### 4.4 Opzione di scelta

| Campo | Tipo | Obbligatorio | Regola |
|---|---|---|---|
| `id` | stringa | Sì | ID stabile, univoco nella domanda |
| `label` | stringa | Sì | Testo non vuoto |

Non usare l'etichetta come valore persistito: se si cambia «Giusto» in «Calza bene», la risposta `right` deve rimanere riconoscibile.

---

## 5. Tipi di domanda e forma delle risposte

Il tipo dichiarato nel JSON controlla la UI, la validazione e la serializzazione della risposta. **La risposta non è nel JSON di configurazione**; i seguenti esempi mostrano soltanto il valore dinamico associato all'ID della domanda.

### 5.1 `text` — testo libero

```json
{ "id": "impression", "label": "Impressioni", "type": "text", "placeholder": "Scrivi qui" }
```

Risposta di esempio: `"Comodo anche dopo alcuni minuti"`.

- Input multilinea proposto; lunghezza massima da definire in UI/backend.
- Stringa vuota significa risposta non compilata, non un errore.
- Non interpretare il testo come HTML eseguibile; effettuare escaping in visualizzazione e PDF.
- `placeholder` non è un valore predefinito e non deve essere salvato come risposta.

### 5.2 `number` — numero

```json
{ "id": "weight_grams", "label": "Peso (g)", "type": "number", "min": 0, "max": 5000, "step": 1 }
```

Risposta di esempio: `1450`.

- `min`, `max` e `step` sono facoltativi e hanno senso solo per questo tipo.
- Se `min` e `max` esistono, `min <= max`.
- `step` deve essere positivo e finito.
- Valori `NaN`, `Infinity` e stringhe non numeriche non sono validi.
- La UI italiana può accettare la virgola decimale, ma deve normalizzare in modo non ambiguo.
- **Non** usare automaticamente `0` come risposta non compilata: `0` è un valore effettivo.
- Unità di misura nel `label`/`helpText`; un campo `unit` strutturato è un'estensione da valutare.

### 5.3 `boolean` — sì/no

```json
{ "id": "pinlock_included", "label": "Pinlock incluso?", "type": "boolean" }
```

Risposta di esempio: `true` o `false`.

- Tre stati UI: **non risposto**, **sì**, **no**.
- Non confondere `false` con assenza della risposta.
- Non pre-selezionare «No».
- Un controllo a tre stati o radio con scelta iniziale vuota è preferibile a uno switch che parte da `false`.

### 5.4 `single_choice` — scelta singola

```json
{
  "id": "fit",
  "label": "Vestibilità",
  "type": "single_choice",
  "options": [
    { "id": "tight", "label": "Stretto" },
    { "id": "right", "label": "Giusto" },
    { "id": "loose", "label": "Largo" }
  ]
}
```

Risposta di esempio: `"right"`.

- Una sola opzione, oppure nessuna.
- Almeno due opzioni distinte nella proposta v1.
- Persistenza per **ID opzione**, non etichetta.
- L'utente deve poter cancellare una selezione già effettuata.

### 5.5 `multiple_choice` — scelta multipla

```json
{
  "id": "features",
  "label": "Caratteristiche",
  "type": "multiple_choice",
  "options": [
    { "id": "ventilation", "label": "Ventilazione" },
    { "id": "sun_visor", "label": "Visierino" }
  ]
}
```

Risposta di esempio: `["ventilation", "sun_visor"]`.

- Zero o più ID opzione distinti.
- Nessun elemento duplicato.
- Validare che ogni ID appartenga alle opzioni della domanda.
- Ordine di visualizzazione stabilito dal JSON, non dall'ordine di clic.
- Array vuoto può essere normalizzato come «non risposto»; definire una sola convenzione nel motore.

### 5.6 `rating_1_10` — valutazione specifica

```json
{ "id": "comfort", "label": "Comfort", "type": "rating_1_10" }
```

Risposta di esempio: `9`.

- Valori ammessi: **interi da 1 a 10**, oppure non compilato.
- `0`, `11`, decimali e stringhe arbitrarie non sono validi.
- Il valore non modifica automaticamente `product.rating`.
- Se ci sono più domande di valutazione, non calcolare una media automatica senza una decisione esplicita.

### 5.7 Riepilogo tipi

| Tipo | Valore persistito | Stato non compilato | Proprietà aggiuntive |
|---|---|---|---|
| `text` | stringa | assente/null | `placeholder` |
| `number` | numero finito | assente/null | `min`, `max`, `step` |
| `boolean` | `true` / `false` | assente/null | nessuna |
| `single_choice` | ID opzione | assente/null | `options` |
| `multiple_choice` | array ID opzioni | assente/null o `[]` normalizzato | `options` |
| `rating_1_10` | intero 1–10 | assente/null | nessuna |

**Proposta di normalizzazione:** omettere dalle risposte confermate gli ID delle domande non compilate, invece di scrivere `null` ovunque. In lettura, assenza della chiave significa «non risposto». La forma finale del payload è in `18-questionnaire-engine.md`.

---

## 6. Identificativi stabili e versioni

### 6.1 ID questionario

`questionnaires[].id` identifica una definizione editoriale. Deve essere unico nel file del profilo e stabile per le revisioni compatibili.

L'esempio `me-helmets-integral-v1` include una versione nel nome solo per leggibilità; **non è obbligatorio** inserire `v1` nell'ID. Anzi, se si prevede di incrementare `version`, è più semplice usare un ID stabile come `me-helmets-integral`.

### 6.2 ID domanda

Ogni domanda ha un ID tecnico stabile **nel proprio questionario**. Cambiare il testo di `label` non deve cambiare l'ID. Non riutilizzare un vecchio ID per una domanda dal significato diverso.

### 6.3 ID opzione

Le opzioni hanno ID stabili. Modificare un'etichetta è compatibile quando il significato rimane invariato. Eliminare o reinterpretare un'opzione già usata può richiedere migrazione o visualizzazione storica.

### 6.4 Versione della definizione

`version` è un intero positivo della singola definizione, distinto da `schemaVersion` del file:

- `schemaVersion` cambia quando cambia il **formato del JSON**.
- `version` cambia quando evolve il **contenuto del questionario** in modo da richiedere tracciamento.

**Proposta:** incrementare `version` quando si aggiungono/rimuovono domande, cambiano tipi o opzioni; mantenere la stessa versione solo per correzioni editoriali che non alterano il significato delle risposte. La politica esatta deve essere definita prima di gestire dati storici reali.

### 6.5 Non cancellare le risposte storiche

Una risposta salvata deve essere interpretabile anche se il questionario attuale cambia. È raccomandato conservare almeno `questionnaireId`, `questionnaireVersion` e ID domanda/opzione usati; per massima robustezza, uno snapshot immutabile della definizione o un registro versionato server-side.

La scelta tecnica definitiva, inclusi i costi di storage, spetta a `12-database.md`, `18-questionnaire-engine.md` e `20-synchronization.md`.

---

## 7. Associazione profilo–categoria

### 7.1 Risoluzione del profilo

Il motore seleziona **solo** il file corrispondente al `profileId` attivo. Non cerca domande negli altri profili, non le unisce e non ne crea di generiche.

Esempio:

```text
Profilo me + categoria helmets-integral
    → cerca in questionnaires/me.json
Profilo father + categoria helmets-integral
    → cerca in questionnaires/father.json
```

### 7.2 Risoluzione categoria: default proposto

**Matching esatto:** una definizione con `categoryId: "helmets"` si applica ai prodotti con categoria `helmets`, ma **non** automaticamente a `helmets-integral`.

Motivo: evita di mostrare domande inappropriate e rende prevedibile la regola «questionario per profilo e categoria/sottocategoria».

**Non è una decisione già confermata.** Alternative da discutere in `18-questionnaire-engine.md`:

1. ereditare dal padre più vicino solo se manca il questionario esatto;
2. comporre domande padre + figlio, risolvendo duplicati;
3. configurare esplicitamente la politica di eredità nel JSON.

La v1 **non deve implementare una delle alternative senza approvazione**.

### 7.3 Più definizioni per la stessa categoria

Nel contratto proposto, è un errore: `profileId` + `categoryId` deve individuare **al massimo una definizione attiva**. Non scegliere «la prima» silenziosamente.

### 7.4 Nessun questionario

Se non c'è definizione applicabile:

- la scheda prodotto rimane utilizzabile;
- non compare un pannello vuoto «Questionario»;
- non vengono create risposte fittizie;
- nome, prezzo, voto generale, preferito, note e foto restano disponibili.

---

## 8. Profili dinamici creati nell'app

Un profilo creato dall'interfaccia parte **senza questionari**. Non eredita quelli di `me` o `father`.

In futuro, un amministratore potrà predisporre un JSON dedicato a un profilo dinamico **solo se** esiste una procedura di risoluzione esplicita tra ID dinamico e file editoriale. Non assumere che ogni profilo dinamico abbia automaticamente un file con il suo nome.

### 8.1 Questione architetturale da risolvere

I file iniziali `me.json` e `father.json` sono noti al deploy. Per i profili creati offline, il loro ID può non esistere al momento della build.

Proposte possibili:

- **Manifest editoriale** dei questionari, con associazioni esplicite `profileId → path` e caricamento a runtime;
- convenzione `config/questionnaires/<profileId>.json`, con scansione server controllata e validazione;
- nessun questionario editoriale per profili dinamici nella v1, fino a un'estensione amministrativa.

**Da scegliere** in `10-questionnaires-config.md`/`13-backend-api.md` prima di sviluppare il loader. Per il pilot EICMA con `me` e `father`, i due file noti sono sufficienti.

---

## 9. Relazione con stand, prodotti e interessi

### 9.1 Stand con più categorie

Uno stand può essere classificato in più categorie, ma questo **non** significa mostrare tutti i questionari di quelle categorie quando si registra un prodotto.

La categoria del prodotto è scelta manualmente; il motore consulta **quella sola categoria** secondo la regola di matching stabilita.

### 9.2 Categoria immutabile del prodotto

Dopo il primo salvataggio locale confermato, `categoryId` non cambia. Il questionario associato non deve passare improvvisamente a un'altra categoria perché lo stand è stato riclassificato nel JSON editoriale.

### 9.3 Interessi personali

Le liste «cosa vedere» e le priorità 1–10 degli stand sono definite in `config/interests/<profileId>.json`. Non sono questionari e non devono essere trasformate automaticamente in domande.

### 9.4 Voto generale

Il voto complessivo `product.rating` (1–10) è indipendente da una domanda `rating_1_10` come «Comfort». Un prodotto può avere il voto generale senza alcun questionario, oppure risposte al questionario senza voto generale.

---

## 10. Comportamento dell'interfaccia

### 10.1 Creazione del prodotto

1. L'utente sceglie uno stand.
2. Inserisce il nome del prodotto.
3. Seleziona **una categoria**.
4. Il motore risolve `profileId + categoryId`.
5. Se trova un questionario, mostra le domande nell'ordine del JSON.
6. Se non lo trova, **non mostra** la sezione.
7. Tutte le domande possono rimanere vuote.
8. La bozza viene autosalvata localmente a ogni modifica.
9. Con **Salva**, il prodotto e le risposte vengono confermati localmente e accodati per la sync.

### 10.2 Modifica del prodotto

- La categoria è visualizzata ma non modificabile.
- Le risposte già date vengono ricaricate.
- Si possono aggiornare o cancellare risposte, senza cambiare la categoria.
- La modifica non è sincronizzata finché non viene confermata con **Salva**.
- Se il questionario è cambiato, preservare le risposte storiche; non forzarle dentro il nuovo schema senza una migrazione.

### 10.3 Campi opzionali

Ogni domanda deve avere uno stato «non compilato» raggiungibile anche dopo aver inserito una risposta. Evitare controlli che trasformino automaticamente l'assenza in `false`, `0` o nella prima opzione.

### 10.4 Mobile-first e accessibilità

- Etichette complete, `helpText` vicino al controllo.
- Scelte singole e multiple con aree touch sufficienti.
- Rating 1–10 accessibile da tastiera e lettori di schermo.
- Errori vicini al campo e riepilogo degli errori se necessario.
- Non usare il colore come unico indicatore di selezione.
- Nessuna domanda obbligatoria nascosta o con asterisco.
- Stato della bozza e stato di sincronizzazione separati.

---

## 11. Validazione della configurazione

### 11.1 Controlli strutturali

| ID | Regola | Errore |
|---|---|---|
| QCFG-001 | JSON valido, root oggetto | Errore di parsing/schema |
| QCFG-002 | `schemaVersion === 1` | Versione non supportata |
| QCFG-003 | `profileId` presente e valido | Profilo invalido |
| QCFG-004 | `questionnaires` array | Schema invalido |
| QCFG-005 | ID questionario univoci nel file | Duplicato |
| QCFG-006 | Categoria esistente | Riferimento sconosciuto |
| QCFG-007 | Una definizione attiva per categoria/profilo | Duplicato |
| QCFG-008 | `version` intero positivo | Versione invalida |
| QCFG-009 | Titolo non vuoto | Titolo invalido |
| QCFG-010 | `questions` array non vuoto | Domande mancanti |
| QCFG-011 | ID domanda univoci nel questionario | Duplicato |
| QCFG-012 | Label domanda non vuota | Etichetta invalida |
| QCFG-013 | Tipo tra i sei consentiti | Tipo sconosciuto |
| QCFG-014 | `options` solo per scelta singola/multipla | Campo incompatibile |
| QCFG-015 | Scelte con almeno due opzioni | Opzioni insufficienti |
| QCFG-016 | ID opzioni univoci | Duplicato |
| QCFG-017 | `min`, `max`, `step` solo su `number` | Campo incompatibile |
| QCFG-018 | `min <= max`, `step > 0` | Intervallo invalido |
| QCFG-019 | Nessuna domanda obbligatoria | `required` non supportato |
| QCFG-020 | Proprietà sconosciute rifiutate (proposta) | Campo non supportato |

### 11.2 Validazione incrociata

Il loader deve verificare:

- che il profilo sia quello atteso per il file;
- che la categoria esista nel catalogo globale;
- che non esistano definizioni attive duplicate per lo stesso `categoryId` nel profilo;
- che gli ID domanda e opzione siano univoci nei rispettivi ambiti;
- che i riferimenti ai profili dinamici seguano la politica decisa nel §8.

### 11.3 Proprietà condizionali

Si propone uno schema discriminato per `type`:

- `text`: ammette `placeholder`;
- `number`: ammette `min`, `max`, `step`;
- `boolean`: nessuna proprietà specifica;
- `single_choice` e `multiple_choice`: richiedono `options`;
- `rating_1_10`: nessuna proprietà specifica.

`helpText` è comune a tutti i tipi. Un campo non pertinente va **rifiutato**, non ignorato silenziosamente.

### 11.4 Messaggi di errore

```text
CONFIG_DUPLICATE_QUESTION
File: config/questionnaires/me.json
Campo: $.questionnaires[0].questions[3].id
Problema: l'ID "comfort" è già utilizzato in questo questionario.
```

```text
CONFIG_UNKNOWN_CATEGORY
File: config/questionnaires/father.json
Campo: $.questionnaires[0].categoryId
Problema: la categoria "unknown-category" non è presente in categories.json.
```

```text
CONFIG_INVALID_OPTIONS
File: config/questionnaires/me.json
Campo: $.questionnaires[0].questions[2].options
Problema: una domanda single_choice richiede almeno due opzioni con ID distinti.
```

Non pubblicare una nuova configurazione invalida. Se l'app è già in uso, conservare l'ultimo snapshot valido e segnalare l'errore amministrativo.

---

## 12. Validazione delle risposte

Le risposte vanno validate sia **in locale** sia **sul server**, rispetto alla definizione/versione applicabile. Il client non è una fonte attendibile.

| Tipo | Accettare | Rifiutare |
|---|---|---|
| `text` | Stringa, oppure assente | Oggetto/array come risposta testuale |
| `number` | Numero finito nei limiti | Stringa arbitraria, `NaN`, fuori range |
| `boolean` | `true`, `false`, assente | `0`, `1`, `"yes"` senza conversione esplicita |
| `single_choice` | ID opzione esistente, assente | ID sconosciuto, array |
| `multiple_choice` | Array di ID opzione distinti | ID sconosciuti, duplicati, scalare |
| `rating_1_10` | Intero 1–10, assente | 0, 11, decimale, testo |

### 12.1 Domande non compilate

L'assenza della risposta **non è un errore**. Non eseguire validazioni `required` su alcun tipo.

### 12.2 Risposte a domande non più presenti

Non eliminarle automaticamente. Possono essere storiche, legate a una versione precedente. Il motore deve distinguerle dalle risposte valide per il questionario corrente e decidere come mostrarle in lettura/esportazione.

### 12.3 Sicurezza dei contenuti

- Escape del testo libero in React e negli export.
- Nessun HTML/JS eseguibile proveniente da `label`, `description`, `helpText` o risposte.
- Limiti ragionevoli di dimensione per testo e numero di opzioni, da fissare nel motore.
- Il server deve validare anche riferimenti a profilo, prodotto, evento e categoria.

---

## 13. Modello TypeScript consigliato

```ts
export type QuestionType =
  | "text"
  | "number"
  | "boolean"
  | "single_choice"
  | "multiple_choice"
  | "rating_1_10";

export interface QuestionOption {
  id: string;
  label: string;
}

interface QuestionBase {
  id: string;
  label: string;
  helpText?: string;
}

export type QuestionDefinition =
  | (QuestionBase & { type: "text"; placeholder?: string })
  | (QuestionBase & { type: "number"; min?: number; max?: number; step?: number })
  | (QuestionBase & { type: "boolean" })
  | (QuestionBase & { type: "single_choice"; options: QuestionOption[] })
  | (QuestionBase & { type: "multiple_choice"; options: QuestionOption[] })
  | (QuestionBase & { type: "rating_1_10" });

export interface QuestionnaireDefinition {
  id: string;
  categoryId: string;
  version: number;
  title: string;
  description?: string;
  questions: QuestionDefinition[];
}

export interface ProfileQuestionnairesConfig {
  schemaVersion: 1;
  profileId: string;
  questionnaires: QuestionnaireDefinition[];
}
```

I tipi sono **solo contratti statici**: servono anche parser e validazione runtime, idealmente con uno schema discriminato per `type`.

### 13.1 Risposte tipizzate

```ts
type AnswerValue =
  | string
  | number
  | boolean
  | string[];

interface ProductQuestionnaireAnswers {
  productId: string;
  profileId: string;
  questionnaireId: string;
  questionnaireVersion: number;
  values: Record<string, AnswerValue>;
}
```

Questa è una **proposta semplificata**. Il tipo `AnswerValue` da solo non garantisce che una stringa sia associata a una domanda `text` anziché a `single_choice`: la validazione deve consultare la definizione della domanda. La persistenza definitiva verrà stabilita in `12-database.md` e `18-questionnaire-engine.md`.

### 13.2 Resolver proposto

```ts
function findQuestionnaire(
  config: ProfileQuestionnairesConfig | undefined,
  profileId: string,
  categoryId: string
): QuestionnaireDefinition | undefined {
  if (!config || config.profileId !== profileId) return undefined;
  return config.questionnaires.find(q => q.categoryId === categoryId);
}
```

Questa funzione implementa **solo il matching esatto proposto**, non una decisione definitiva sull'ereditarietà. In produzione il resolver deve inoltre usare uno snapshot validato e gestire versioni/storico.

---

## 14. Caricamento, cache e offline

### 14.1 Bootstrap

1. Caricare `app.json`, profili e categorie.
2. Individuare i file questionario previsti per i profili iniziali.
3. Validare schema e riferimenti incrociati.
4. Pubblicare uno snapshot editoriale coerente.
5. Conservare la configurazione necessaria in IndexedDB.

La posizione del file deve essere risolta **dal server**, non da un URL arbitrario fornito dall'utente.

### 14.2 Primo avvio offline

Se non esiste alcuno snapshot in cache e non è disponibile la rete, l'app non deve fingere che i questionari siano vuoti: deve segnalare che la configurazione iniziale non è ancora stata caricata. Dopo un bootstrap valido, l'assenza di una definizione specifica significa invece **nessun questionario configurato**.

### 14.3 Compilazione offline

Le risposte devono essere modificabili offline. L'autosalvataggio riguarda la **bozza**; premere **Salva** conferma il prodotto e le risposte localmente e registra l'operazione pendente per la sincronizzazione.

Non promettere background sync con app completamente chiusa su tutti i browser.

### 14.4 Aggiornamenti della configurazione

Un nuovo JSON può aggiungere o modificare domande. Non sostituire lo snapshot prima di validarlo completamente. Conservare i dati storici e la possibilità di leggere risposte basate su una definizione precedente.

---

## 15. Sincronizzazione e conflitti

### 15.1 Oggetto della sincronizzazione

Si sincronizzano **risposte e prodotti**, non le definizioni editoriali modificate dall'utente. I JSON sono distribuiti dal server come configurazione.

### 15.2 Conflitto sullo stesso prodotto

Se due dispositivi modificano le risposte dello stesso prodotto/profilo, non applicare un last-write-wins silenzioso. Conservare entrambe le versioni e permettere la scelta manuale, come previsto dal requisito generale.

### 15.3 Conflitto fra versioni di questionario

Se un dispositivo offline compila il questionario v1 mentre il server ha pubblicato v2, il server deve poter riconoscere `questionnaireId` e `questionnaireVersion`. Non rifiutare e cancellare semplicemente le risposte vecchie: segnalare compatibilità o conflitto e offrire un percorso di risoluzione.

Le regole dettagliate sono demandate a `18-questionnaire-engine.md` e `20-synchronization.md`.

---

## 16. Visualizzazione e confronto desktop

Il confronto tra prodotti è disponibile **solo su desktop** e soltanto per prodotti della **stessa categoria**.

Per il questionario:

- mostrare una riga per domanda identificata da ID stabile;
- mostrare il valore di ciascun prodotto;
- per risposte mancanti, usare «Non indicato», non `0` o `No`;
- per scelta multipla, mostrare le etichette delle opzioni;
- per definizioni/versioni diverse, segnalare la differenza invece di allineare domande soltanto perché hanno lo stesso testo;
- non confondere le valutazioni 1–10 delle domande con il voto generale del prodotto.

La UI finale è specificata in `22-comparison.md`.

---

## 17. Export JSON e PDF

Gli export sono **per profilo** e possono comprendere tutte o alcune categorie.

### 17.1 JSON

Includere le risposte ai questionari dei prodotti esportati, insieme a riferimenti sufficienti per interpretarle (ID domanda, definizione/versione, eventualmente etichette o snapshot). **Non è prevista importazione JSON**.

### 17.2 PDF dettagliato

Per ogni prodotto, mostrare le domande e le risposte effettivamente disponibili, oltre a foto e note. Le domande non compilate possono essere omesse o indicate come «Non risposto», secondo l'opzione di layout da definire in `23-export.md`.

### 17.3 PDF riepilogativo

La modalità riepilogativa resta una tabella per categoria/sottocategoria; non è obbligatorio includere tutte le risposte nella tabella, che diventerebbe illeggibile. La modalità dettagliata è quella dedicata alle domande/risposte.

Non includere mai le risposte di altri profili.

---

## 18. Struttura di implementazione suggerita

```text
src/lib/config/
├── questionnaires-schema.ts
├── questionnaires-loader.server.ts
└── validate-references.server.ts

src/features/questionnaires/
├── domain/
│   ├── questionnaire-types.ts
│   ├── questionnaire-resolver.ts
│   ├── answer-validation.ts
│   └── questionnaire-versioning.ts
├── components/
│   ├── QuestionnaireSection.tsx
│   ├── QuestionField.tsx
│   ├── TextQuestion.tsx
│   ├── NumberQuestion.tsx
│   ├── BooleanQuestion.tsx
│   ├── SingleChoiceQuestion.tsx
│   ├── MultipleChoiceQuestion.tsx
│   └── RatingQuestion.tsx
└── data/
    └── questionnaire-repository.ts

tests/
├── unit/questionnaires/
└── fixtures/questionnaires/
```

La struttura è illustrativa. Evitare di duplicare la logica di validazione in sei componenti: il dominio deve centralizzare le regole e la UI limitarsi a visualizzare/gestire input.

---

## 19. Test di accettazione

| ID | Scenario | Risultato atteso |
|---|---|---|
| Q-T01 | File valido con `questionnaires: []` | Accettato |
| Q-T02 | Profilo senza file dedicato | Nessuna sezione questionario |
| Q-T03 | Profilo `me` con domande, `father` senza | Solo `me` vede quelle domande |
| Q-T04 | Stessa categoria, domande diverse per due profili | Definizioni indipendenti |
| Q-T05 | Categoria prodotto senza definizione | Sezione nascosta |
| Q-T06 | Domanda `text` non compilata | Salva consentito |
| Q-T07 | Domanda `number` non compilata | Salva consentito |
| Q-T08 | Domanda `boolean` non compilata | Non diventa `false` |
| Q-T09 | Domanda `boolean` risposta «No» | Persistita come `false` |
| Q-T10 | Scelta singola non compilata | Nessuna prima opzione automatica |
| Q-T11 | Scelta multipla vuota | Nessun errore |
| Q-T12 | Rating domanda 1 | Valido |
| Q-T13 | Rating domanda 10 | Valido |
| Q-T14 | Rating domanda 0 o 11 | Rifiutato |
| Q-T15 | Rating domanda decimale | Rifiutato |
| Q-T16 | Numero sotto `min` | Rifiutato |
| Q-T17 | Numero sopra `max` | Rifiutato |
| Q-T18 | `step <= 0` | Configurazione rifiutata |
| Q-T19 | `min > max` | Configurazione rifiutata |
| Q-T20 | Scelta senza `options` | Configurazione rifiutata |
| Q-T21 | Opzioni con ID duplicati | Configurazione rifiutata |
| Q-T22 | ID domanda duplicati | Configurazione rifiutata |
| Q-T23 | Due questionari attivi stessa categoria/profilo | Configurazione rifiutata |
| Q-T24 | Categoria sconosciuta | Configurazione rifiutata |
| Q-T25 | `required: true` | Configurazione rifiutata |
| Q-T26 | Campo specifico incompatibile con `type` | Configurazione rifiutata |
| Q-T27 | Cambio categoria durante bozza iniziale | Questionario ricalcolato, bozza gestita |
| Q-T28 | Cambio categoria dopo primo Salva | Rifiutato |
| Q-T29 | Modifica risposte offline | Bozza locale persistente |
| Q-T30 | Uscita con bozza non confermata | Avviso e bozza conservata |
| Q-T31 | Salva offline | Risposte confermate e sync pendente |
| Q-T32 | Aggiornamento JSON con nuovo testo label | ID risposta preservato |
| Q-T33 | Rimozione domanda usata storicamente | Risposta storica conservata |
| Q-T34 | Nuova versione incompatibile | Non cancellare risposte precedenti |
| Q-T35 | Conflitto due dispositivi | Risoluzione manuale |
| Q-T36 | Confronto desktop, stessa categoria | Risposte confrontabili |
| Q-T37 | Confronto mobile | Non disponibile |
| Q-T38 | Export PDF dettagliato | Domande/risposte corrette |
| Q-T39 | Export JSON profilo | Nessun dato di altri profili |
| Q-T40 | Profilo dinamico senza JSON | Nessun questionario ereditato |
| Q-T41 | Risposta sconosciuta al server | Rifiuto o gestione storico versionato |
| Q-T42 | Configurazione nuova invalida | Ultimo snapshot valido preservato |
| Q-T43 | Risposta rating 9 e voto generale 7 | Entrambi conservati indipendenti |
| Q-T44 | Domanda multipla con ID opzione inesistente | Risposta invalida |
| Q-T45 | `false` e risposta assente | Distinguibili in UI/export |
| Q-T46 | App offline dopo bootstrap | Questionario disponibile in cache |

---

## 20. Decisioni da confermare prima dell'implementazione

| Tema | Proposta documentata | Stato |
|---|---|---|
| Matching categorie | Solo `categoryId` esatto | **Da confermare** |
| Ereditarietà padre/figlio | Nessuna in v1 | **Da confermare** |
| Nome campi | `schemaVersion`, `profileId`, `questionnaires`, `questions` | **Proposta** |
| Tipi tecnici | `text`, `number`, `boolean`, `single_choice`, `multiple_choice`, `rating_1_10` | **Proposta** |
| Domande obbligatorie | Nessuna, vietare `required` | **Requisito confermato + scelta schema** |
| Questionario per categoria | Massimo uno attivo per profilo | **Proposta** |
| Versionamento | `version` per definizione e snapshot storico | **Proposta** |
| Domande non compilate | Chiavi assenti nella mappa risposte | **Proposta** |
| `number` con limiti | `min`, `max`, `step` facoltativi | **Proposta** |
| Set opzioni | Almeno due, ID stabili | **Proposta** |
| File per profili dinamici | Manifest/scansione o rinvio | **Aperto** |
| Versioni vecchie | Preservare risposte e definizioni storiche | **Principio confermato; meccanismo aperto** |
| Limiti testo/opzioni | Limiti tecnici da fissare | **Aperto** |
| Politica campi sconosciuti | Rifiuto in validazione | **Proposta** |

Il documento fornisce un contratto implementabile, ma **non considera approvate** le scelte ancora aperte.

---

## 21. Criteri di completamento

- [ ] Esiste un formato JSON per profilo con schema validato.
- [ ] `me` e `father` possono avere questionari diversi per la stessa categoria.
- [ ] Le domande sono definite solo per categorie/sottocategorie specifiche.
- [ ] Nessun questionario generale viene creato o usato come fallback.
- [ ] Tutte le domande sono facoltative e possono essere svuotate.
- [ ] Sono supportati esattamente i sei tipi richiesti.
- [ ] Gli ID di domande/opzioni sono stabili e validati.
- [ ] Il motore non confonde voto generale e rating delle domande.
- [ ] I questionari non compaiono senza definizione applicabile.
- [ ] Le risposte sono dati personali del prodotto, non modifiche al JSON.
- [ ] La categoria del prodotto resta immutabile dopo il primo Salva.
- Salvataggio mobile automatico locale e outbox per valori validi, senza modalità bozza o conferma Salva finale; input invalidi conservati localmente secondo §5.1 del documento 27.
- [ ] Le versioni storiche non vengono cancellate silenziosamente.
- Concorrenza mobile LWW per record in ordine di accettazione server; revisioni monotone, idempotenza e protezione delle tombstone.
- [ ] Il confronto desktop gestisce risposte mancanti e versioni diverse.
- [ ] L'export PDF dettagliato può mostrare domande e risposte.
- [ ] I test coprono configurazione, validazione, offline e isolamento profili.

---

## 22. Prossimo documento

**[`11-visit-statuses-config.md`](11-visit-statuses-config.md)** definirà gli stati di visita degli stand: **da visitare**, **visitato** e **da rivedere**, transizioni, valori di default, persistenza personale, filtri, dashboard, offline e sincronizzazione.

**Nota architetturale:** come per i prodotti, il titolo «config» non implica automaticamente un file JSON statico di stato visita. Gli stati scelti dagli utenti sono **dati dinamici**. L'eventuale configurabilità editoriale delle etichette è una decisione separata.
