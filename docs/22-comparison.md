# ExpoTrack — 22. Confronto prodotti (desktop)

> **Percorso logico:** `docs/22-comparison.md`  
> **Stato:** specifica funzionale e tecnica; non implementazione  
> **Versione proposta:** v1  
> **Documenti collegati:** `08-products-config.md`, `10-questionnaires-config.md`, `12-database.md`, `13-backend-api.md`, `14-frontend-ui.md`, `17-product-management.md`, `18-questionnaire-engine.md`, `19-offline-storage.md`, `20-synchronization.md`, `21-photo-management.md`  
> **Documento successivo:** `23-export.md`

---

## 1. Scopo

La funzione **Confronta prodotti** consente di esaminare fianco a fianco i prodotti osservati durante una fiera. È progettata per il **desktop**, mentre lo smartphone rimane il dispositivo principale per raccogliere informazioni, compilare questionari e scattare foto agli stand.

Il confronto deve aiutare a distinguere le caratteristiche effettivamente registrate: nome, stand, prezzo, valutazione, preferiti, note, fotografie e risposte al questionario. **Non deve inventare specifiche tecniche, prezzi o valutazioni mancanti** né assegnare automaticamente un vincitore.

Il confronto si svolge **solo tra prodotti appartenenti alla stessa categoria esatta**, dello **stesso profilo** e dello **stesso evento**. La categoria assegnata a un prodotto resta immutabile dopo il primo salvataggio locale, come definito nel documento `17-product-management.md`.

### 1.1 Obiettivi di esperienza utente

1. Scegliere facilmente due o più prodotti confrontabili dalla lista prodotti.
2. Aprire una tabella leggibile su uno schermo desktop.
3. Scorrere colonne e sezioni senza perdere i nomi dei prodotti.
4. Riconoscere immediatamente dati assenti, valori uguali e differenze.
5. Leggere le risposte dei questionari senza confondere versioni o tipi di domanda.
6. Consultare le fotografie già disponibili localmente o recuperabili dal server.
7. Continuare a confrontare i dati salvati anche senza Internet.
8. Tornare alla scheda prodotto per eventuali correzioni senza perdere inutilmente la selezione.

### 1.2 Fuori ambito per la v1

- Confronto tra categorie diverse, anche se appartengono allo stesso ramo dell'albero.
- Confronto tra profili diversi, ad esempio prodotti registrati da `me` e `father`.
- Confronto tra eventi diversi.
- Motore di raccomandazione automatica o classifica ponderata.
- Analisi delle caratteristiche non registrate dall'utente.
- Comparazione mediante riconoscimento visivo delle foto.
- Confronto con cataloghi o prezzi online.
- Modifica inline di prezzo, voto, note e risposte nella tabella.
- Collaborazione simultanea o condivisione pubblica della sessione.
- Esportazione diretta della tabella comparativa come nuova funzione: le esportazioni generali saranno specificate in `23-export.md`.

---

## 2. Principi non negoziabili

| Regola | Comportamento |
|---|---|
| Categoria identica | `categoryId` deve coincidere esattamente per tutti i prodotti |
| Profilo identico | `profileId` uguale a quello attivo |
| Evento identico | `eventId` uguale a quello selezionato |
| Solo prodotti confermati | Escludere le bozze non salvate |
| Dati personali isolati | Nessun dato di altri profili nella comparazione |
| Nessun dato inventato | Visualizzare `Non indicato` quando un campo manca |
| Voto indipendente | `rating` prodotto non deriva dal questionario |
| Prezzo facoltativo | `null` non equivale a zero euro |
| Foto opzionali | Non bloccare il confronto se non ci sono immagini |
| Offline | Usare lo stato locale confermato disponibile in IndexedDB |
| Sync non bloccante | I dati salvati localmente ma ancora da sincronizzare sono confrontabili |
| Conflitti trasparenti | Segnalare chiaramente le informazioni in conflitto |

---

## 3. Accesso alla funzione

### 3.1 Punto d'ingresso principale

Nella sezione **Prodotti**, su desktop, ciascuna scheda o riga mostra una casella **Seleziona per confronto**. Un comando **Confronta selezionati** si abilita quando sono stati scelti almeno due prodotti compatibili.

Il pulsante non deve sembrare disponibile quando la selezione non è valida. Quando il primo prodotto viene selezionato, i prodotti di categorie incompatibili possono essere disabilitati con una spiegazione accessibile: «Puoi confrontare solo prodotti della categoria Caschi integrali».

### 3.2 Accesso dal dettaglio prodotto

Un'azione **Confronta con altri prodotti** apre la lista filtrata sulla categoria esatta del prodotto corrente, preselezionando il prodotto di partenza. La preselezione non deve causare l'apertura automatica della comparazione con un solo elemento.

### 3.3 Accesso da uno stand

La sezione prodotti di uno stand può offrire **Confronta**. L'utente può poi scegliere altri prodotti della stessa categoria anche se registrati in stand diversi, purché appartengano allo stesso profilo ed evento.

### 3.4 Mobile

Il confronto affiancato è **desktop-only** nella v1. Su smartphone, i dati e le schede prodotto rimangono accessibili, ma non si deve mostrare una tabella orizzontale illeggibile come funzione principale.

Proposta: mostrare un messaggio breve «Il confronto affiancato è disponibile su desktop», senza impedire la normale consultazione dei prodotti. Una futura modalità mobile a due schede non fa parte del requisito attuale.

### 3.5 Tablet e soglia responsive

**Proposta da validare:** abilitare la funzione da una larghezza utile di circa **1024 CSS px**. Non equiparare automaticamente «tablet» a «desktop»: la decisione dipende dallo spazio realmente disponibile e dalla leggibilità. La soglia esatta andrà verificata nei test visivi.

---

## 4. Selezione dei prodotti

### 4.1 Regole di selezione

- Minimo: **2 prodotti**.
- Massimo: **4 prodotti** in una sessione, **proposta UX** da validare. Il limite non è un vincolo del dominio; può essere cambiato senza modificare i record.
- Il primo prodotto determina la categoria esatta richiesta.
- Le successive selezioni devono rispettare categoria, profilo ed evento.
- Non è possibile selezionare due volte lo stesso `productId`.
- I prodotti eliminati non possono essere selezionati.
- I prodotti non ancora confermati con **Salva** non compaiono.

### 4.2 Selezione incompatibile

Se un utente tenta di aggiungere un prodotto incompatibile, non svuotare automaticamente la selezione. Mostrare la causa e mantenere i prodotti già scelti.

**Esempio:** un casco integrale non è confrontabile con un casco modulare se i due prodotti sono assegnati a `full-face-helmets` e `modular-helmets`, anche se entrambi sono figli della categoria `helmets`.

### 4.3 Selezione persistente o temporanea?

**Proposta:** la selezione è **temporanea e locale alla sessione UI**, non un dato di business da sincronizzare con PostgreSQL. Può sopravvivere alla navigazione interna durante la sessione, ma non è necessario salvarla permanentemente o sincronizzarla tra dispositivi.

La selezione va azzerata al cambio di profilo o evento. Se un prodotto selezionato viene eliminato, rimuoverlo dalla selezione e avvisare l'utente.

### 4.4 Modifica della selezione

Nella vista comparativa devono essere disponibili:

- **Rimuovi** dalla comparazione, senza eliminare il prodotto.
- **Aggiungi prodotto** della stessa categoria, entro il limite previsto.
- **Riordina colonne**, preferibilmente con pulsanti accessibili «Sposta a sinistra/destra», oltre all'eventuale drag-and-drop.
- **Torna ai prodotti** mantenendo filtri e contesto della navigazione corrente, quando possibile.

### 4.5 Stati di selezione

| Stato | Comportamento |
|---|---|
| Nessun prodotto | Invito a selezionare prodotti |
| Un prodotto | Comando Confronta disabilitato |
| Due o più compatibili | Confronta abilitato |
| Selezione al massimo | Disabilitare ulteriori aggiunte con spiegazione |
| Prodotto eliminato | Rimuovere l'ID e rivalidare |
| Cambio categoria della vista | Non reinterpretare le categorie dei prodotti |
| Cambio profilo | Azzerare selezione e dati in memoria del profilo precedente |
| Cambio evento | Azzerare selezione |
| Sync in corso | Non bloccare il confronto |

---

## 5. Modello dei dati per la comparazione

Il confronto è una **vista derivata**, non una nuova entità persistente. Utilizza i prodotti e le relative informazioni già salvati.

### 5.1 Contratti TypeScript proposti

```ts
export type ProductId = string;
export type ProfileId = string;
export type EventId = string;
export type CategoryId = string;

export interface ComparisonSelection {
  profileId: ProfileId;
  eventId: EventId;
  categoryId: CategoryId;
  productIds: ProductId[];
}

export interface ComparisonProduct {
  id: ProductId;
  profileId: ProfileId;
  eventId: EventId;
  categoryId: CategoryId;
  name: string;
  stand: {
    source: "catalog" | "personal";
    id: string;
    displayName: string;
    hallLabel?: string | null;
    boothLabel?: string | null;
  };
  priceAmountMinor: number | null;
  priceCurrency: "EUR" | null;
  rating: number | null;
  isFavorite: boolean;
  notes: string | null;
  photos: ComparisonPhoto[];
  questionnaire: ComparisonQuestionnaire | null;
  revision: string;
  syncState: "synced" | "pending" | "failed" | "conflict";
  deletedAt: string | null;
}

export interface ComparisonPhoto {
  id: string;
  thumbnailUrl?: string;
  fullUrl?: string;
  localBlobAvailable: boolean;
  remoteAvailable: boolean;
  syncState: "local" | "uploading" | "synced" | "failed";
}

export interface ComparisonQuestionnaire {
  questionnaireId: string;
  version: number;
  definitionSnapshot: QuestionnaireDefinitionSnapshot;
  answers: Record<string, unknown>;
}

export interface QuestionnaireDefinitionSnapshot {
  questions: Array<{
    id: string;
    label: string;
    type: "text" | "number" | "boolean" | "singleChoice" |
          "multipleChoice" | "rating";
    options?: Array<{ value: string; label: string }>;
  }>;
}
```

Questi tipi sono **contratti illustrativi**, da allineare ai nomi effettivi già stabiliti nei documenti `08`, `10`, `12`, `13`, `17` e `18`. Non introdurre una seconda definizione incompatibile del prodotto.

### 5.2 Cosa non deve essere duplicato

La comparazione non deve creare copie indipendenti e modificabili di:

- nome, categoria, prezzo e voto del prodotto;
- note e preferiti;
- fotografie;
- risposte ai questionari;
- nomi degli stand e categorie editoriali.

Un eventuale modello `ComparisonViewModel` è un **read model calcolato** dalla fonte locale confermata.

### 5.3 Numeri e importi

Il prezzo è rappresentato in centesimi (`priceAmountMinor`), non in floating point. Il formatter UI lo visualizza in `it-IT`, ad esempio `8.390,00 €`. Un valore `null` si visualizza come **Non indicato** e non partecipa a minimi, massimi o differenze numeriche.

### 5.4 Categoria

Il confronto utilizza l'**ID categoria esatto**, non il nome e non l'antenato comune. Rinomine editoriali con ID invariato non invalidano la selezione.

---

## 6. Validazione della comparazione

### 6.1 Funzione pura

```ts
interface ComparisonValidation {
  valid: boolean;
  reason?:
    | "TOO_FEW_PRODUCTS"
    | "TOO_MANY_PRODUCTS"
    | "DUPLICATE_PRODUCT"
    | "PROFILE_MISMATCH"
    | "EVENT_MISMATCH"
    | "CATEGORY_MISMATCH"
    | "PRODUCT_DELETED"
    | "PRODUCT_MISSING";
}

function validateComparison(
  products: ComparisonProduct[],
  selection: ComparisonSelection,
  maxProducts = 4
): ComparisonValidation {
  if (selection.productIds.length < 2) {
    return { valid: false, reason: "TOO_FEW_PRODUCTS" };
  }
  if (selection.productIds.length > maxProducts) {
    return { valid: false, reason: "TOO_MANY_PRODUCTS" };
  }
  if (new Set(selection.productIds).size !== selection.productIds.length) {
    return { valid: false, reason: "DUPLICATE_PRODUCT" };
  }

  const byId = new Map(products.map((p) => [p.id, p]));
  for (const id of selection.productIds) {
    const product = byId.get(id);
    if (!product) return { valid: false, reason: "PRODUCT_MISSING" };
    if (product.deletedAt) {
      return { valid: false, reason: "PRODUCT_DELETED" };
    }
    if (product.profileId !== selection.profileId) {
      return { valid: false, reason: "PROFILE_MISMATCH" };
    }
    if (product.eventId !== selection.eventId) {
      return { valid: false, reason: "EVENT_MISMATCH" };
    }
    if (product.categoryId !== selection.categoryId) {
      return { valid: false, reason: "CATEGORY_MISMATCH" };
    }
  }
  return { valid: true };
}
```

**Nota di sicurezza:** questa validazione è necessaria in UI, ma non autorizza l'accesso a dati server. Il backend deve applicare i controlli del proprio contratto, tenendo conto che la v1 non dispone di autenticazione interna.

### 6.2 Quando rivalidare

- Prima di abilitare il pulsante Confronta.
- All'apertura della pagina comparativa.
- Dopo un cambio di profilo/evento.
- Dopo aggiornamenti da IndexedDB o sincronizzazione.
- Dopo l'eliminazione di un prodotto.
- Dopo un aggiornamento di catalogo che renda un riferimento non risolvibile.

---

## 7. Layout desktop

### 7.1 Struttura generale

```text
┌──────────────────────────────────────────────────────────────────────┐
│ ExpoTrack   Profilo: Io   Evento: EICMA 2026   Stato sync           │
├──────────────────────────────────────────────────────────────────────┤
│ Prodotti / Confronta                                                  │
│ Confronto: Caschi integrali         [Aggiungi] [Torna ai prodotti]   │
├────────────────┬────────────────────┬────────────────────┬───────────┤
│ Campo          │ Prodotto A         │ Prodotto B         │ Prodotto C│
├────────────────┼────────────────────┼────────────────────┼───────────┤
│ Foto           │ [immagine]         │ [immagine]         │ [immagine]│
│ Stand          │ Stand A            │ Stand B            │ Stand C   │
│ Prezzo         │ 299,00 €           │ Non indicato       │ 349,00 €  │
│ Valutazione    │ 8/10               │ 7/10               │ —         │
│ Preferito      │ Sì                 │ No                 │ Sì        │
│ Note           │ ...                │ ...                │ ...       │
├────────────────┼────────────────────┼────────────────────┼───────────┤
│ QUESTIONARIO: Sicurezza                                               │
│ Domanda X      │ Risposta A         │ Risposta B         │ Risposta C│
│ Domanda Y      │ Non compilata      │ Risposta B         │ ...       │
└────────────────┴────────────────────┴────────────────────┴───────────┘
```

Questo wireframe è **dimostrativo**: nomi, prezzi e risposte sono fittizi e non rappresentano dati EICMA verificati.

### 7.2 Colonna etichette

La prima colonna contiene i nomi dei campi e deve rimanere leggibile durante lo scorrimento orizzontale. **Proposta:** colonna sinistra sticky; intestazioni prodotti sticky durante lo scorrimento verticale. Verificare z-index, ombre e focus nei test di accessibilità.

### 7.3 Colonne prodotto

Ogni colonna mostra:

- nome prodotto;
- stand di provenienza;
- miniatura principale, se presente;
- pulsante per aprire il dettaglio;
- pulsante per rimuovere dalla selezione;
- stato di sincronizzazione se rilevante.

Larghezza minima consigliata: **260–300 CSS px**, da confermare con i test. Non comprimere testi e fotografie fino a renderli inutilizzabili.

### 7.4 Scorrimento

Per tre o quattro prodotti, consentire uno scorrimento orizzontale **all'interno della tabella**, mantenendo la pagina navigabile. Non imporre uno scroll orizzontale dell'intero sito.

### 7.5 Sezioni

Organizzare il contenuto in blocchi chiaramente distinguibili:

1. **Panoramica**: nomi, foto, stand, preferiti.
2. **Valutazione e prezzo**.
3. **Note personali**.
4. **Questionario**, se esiste almeno una definizione applicabile o una risposta storica pertinente.

Se nessun prodotto ha foto, la riga fotografie può essere omessa o mostrare un placeholder discreto. Se nessuno ha questionario, **non mostrare una sezione questionario vuota**.

---

## 8. Presentazione dei campi principali

### 8.1 Nome

Mostrare il nome salvato dall'utente, senza rinominarlo o normalizzarlo in modo distruttivo. Per nomi lunghi consentire a capo e accesso al testo completo.

### 8.2 Stand

Mostrare il nome corrente dello stand risolto dal catalogo o dagli stand personali. Se il riferimento editoriale non è più disponibile, mostrare un'etichetta esplicita «Stand non disponibile nel catalogo» e preservare il riferimento storico, senza inventare un nome.

### 8.3 Padiglione e posizione

Visualizzare solo se presenti e validati. **Non inventare numeri di padiglione o stand EICMA 2026**. L'assenza deve essere mostrata come «Non indicato» o omessa in modo coerente.

### 8.4 Prezzo

- `null`: «Non indicato».
- `0`: `0,00 €`, senza trattarlo come mancante.
- Prezzo positivo: formattazione locale.
- Un solo prezzo per prodotto nella v1.
- Non assumere che un prezzo registrato sia quello attuale del produttore.

### 8.5 Voto

Mostrare `N/10` se disponibile; altrimenti «Non valutato». Non calcolare una media automatica delle risposte al questionario e non sostituirla al voto generale.

### 8.6 Preferito

Mostrare un'icona e un'etichetta testuale («Preferito» / «Non preferito»). Non affidarsi solo al colore.

### 8.7 Note

Mostrare le note personali, preservando interruzioni di riga. Per note molto lunghe, proposta: anteprima con pulsante **Espandi**; il testo integrale deve essere consultabile senza cambiare prodotto.

### 8.8 Stato sync

Una colonna può riportare un indicatore discreto: «Salvato sul dispositivo», «Sincronizzato», «Errore di sincronizzazione», «Conflitto da risolvere». Il confronto non deve fingere che una modifica pendente sia già sul server.

---

## 9. Fotografie nel confronto

### 9.1 Immagine principale

Se un prodotto ha più foto, mostrare una miniatura principale e un contatore (per esempio «+3 foto»). La scelta della foto principale può essere la prima nell'ordinamento definito dal modulo fotografie; non introdurre una seconda regola incoerente.

### 9.2 Galleria

Un clic apre un visualizzatore con navigazione tra le foto **del prodotto selezionato**. L'utente può tornare alla comparazione senza perdere l'ordine delle colonne.

### 9.3 Disponibilità offline

- Blob locale disponibile: mostrare l'immagine.
- Foto remota non presente in cache e dispositivo offline: placeholder «Foto non disponibile offline».
- Foto in caricamento: mostrare l'immagine locale se già salvata e lo stato upload.
- Foto eliminata: non mostrarla come attiva.
- Foto danneggiata: messaggio non bloccante e possibilità di continuare.

### 9.4 Dimensioni e prestazioni

Caricare miniature, non tutti gli originali contemporaneamente. Evitare decodifiche massive di immagini per quattro colonne. La gestione dei blob e della cache deve seguire `21-photo-management.md`.

### 9.5 Privacy

Non esporre URL permanenti pubblici per le foto. Rispettare i limiti della protezione perimetrale descritti in `25-security.md`.

---

## 10. Motore di confronto dei questionari

Questa è la parte più delicata: i questionari sono **specifici per profilo e categoria**, possono evolvere nel tempo e tutte le domande sono facoltative.

### 10.1 Identificazione della definizione

Per ogni prodotto, recuperare:

- `questionnaireId`;
- versione della definizione;
- snapshot delle domande e delle opzioni applicabili al momento del salvataggio;
- risposte effettivamente confermate.

Non reinterpretare automaticamente una risposta vecchia usando soltanto il JSON corrente.

### 10.2 Domande equivalenti

Due risposte sono direttamente confrontabili quando coincidono **identità semantica e tipo della domanda**. Come regola tecnica prudente, utilizzare la stessa coppia `(questionnaireId, questionId)` e verificare che il tipo e le opzioni siano compatibili.

Non unire domande perché hanno etichette simili: «Comfort» potrebbe riferirsi a scale differenti.

### 10.3 Definizioni differenti o versioni diverse

Se una domanda è stata rinominata senza cambiare significato, il versionamento può consentire una comparazione, ma deve essere supportato da una migrazione editoriale esplicita. In assenza di tale garanzia:

- mostrare le risposte sotto le rispettive versioni;
- segnalare che **non sono direttamente confrontabili**;
- non calcolare differenze numeriche tra scale incompatibili.

### 10.4 Matrice delle domande

**Proposta v1:** usare l'unione delle chiavi delle domande presenti negli snapshot dei prodotti selezionati, mantenendo l'ordine editoriale della prima definizione e aggiungendo in fondo le domande non presenti in quella definizione.

Se una domanda manca per un prodotto, la cella deve mostrare «Domanda non prevista», **non** «Non compilata».

Se la domanda esiste ma la risposta manca, mostrare «Non compilata».

### 10.5 Distinzioni fondamentali

| Situazione | Etichetta |
|---|---|
| Nessun questionario associato | `Questionario non disponibile` |
| Domanda assente nella definizione del prodotto | `Domanda non prevista` |
| Domanda presente senza risposta | `Non compilata` |
| Risposta booleana `false` | `No` |
| Risposta numerica `0` valida | `0` |
| Scelta multipla vuota esplicitamente salvata | `Nessuna opzione selezionata` |
| Risposta non interpretabile per definizione mancante | `Risposta storica non interpretabile` + avviso |

### 10.6 Tipi supportati

| Tipo | Visualizzazione | Regola |
|---|---|---|
| Testo | Testo completo/espandibile | Nessuna comparazione semantica automatica |
| Numero | Numero formattato | Confrontare solo se unità e significato coincidono |
| Sì/No | `Sì` / `No` | `false` non è dato mancante |
| Scelta singola | Etichetta dell'opzione | Usare snapshot delle opzioni |
| Scelta multipla | Elenco delle opzioni selezionate | Ordine stabile, non inventare ranking |
| Rating 1–10 | `N/10` | Indipendente dal voto generale del prodotto |

### 10.7 Numero e unità

Non dedurre che due campi numerici abbiano la stessa unità solo perché sono numeri. Se il modello questionario non prevede unità esplicite, non mostrare automaticamente un delta numerico. L'eventuale supporto a `unit` deve essere una decisione coordinata con `10-questionnaires-config.md`.

### 10.8 Opzioni rinominate

La risposta può contenere un valore stabile (`value`) mentre l'etichetta cambia. Mostrare l'etichetta della versione in cui la risposta è stata registrata, salvo migrazione esplicita che ne garantisca l'equivalenza.

### 10.9 Dati orfani

Se un `questionId` non è più nella definizione corrente, ma esiste nello snapshot storico, visualizzarlo con il suo nome storico. Se lo snapshot è assente o corrotto, preservare il valore grezzo in modalità diagnostica, senza spacciarlo per una risposta validata.

---

## 11. Algoritmo di allineamento delle domande

### 11.1 Modello derivato

```ts
interface ComparisonQuestionRow {
  key: string;
  label: string;
  type: string;
  values: Array<{
    productId: string;
    status:
      | "answered"
      | "unanswered"
      | "not_applicable"
      | "incompatible"
      | "unreadable";
    displayValue: string | null;
    rawValue?: unknown;
    questionnaireVersion?: number;
  }>;
}
```

### 11.2 Procedura proposta

1. Validare la selezione di prodotti.
2. Recuperare gli snapshot delle definizioni e le risposte confermate.
3. Creare una chiave di allineamento basata su identità questionario/domanda.
4. Verificare compatibilità di tipo e opzioni, senza basarsi sulla sola etichetta.
5. Costruire l'unione delle domande, preservando un ordine stabile.
6. Per ogni prodotto/domanda classificare lo stato: risposta, vuoto, non prevista, incompatibile, non interpretabile.
7. Formattare i valori con i metadati della definizione corretta.
8. Generare il read model da renderizzare senza modificare i record originali.

### 11.3 Pseudocodice

```ts
function buildQuestionRows(
  products: ComparisonProduct[]
): ComparisonQuestionRow[] {
  const rows = new Map<string, ComparisonQuestionRow>();

  for (const product of products) {
    const questionnaire = product.questionnaire;
    if (!questionnaire) continue;

    for (const question of questionnaire.definitionSnapshot.questions) {
      const key = `${questionnaire.questionnaireId}:${question.id}`;
      if (!rows.has(key)) {
        rows.set(key, {
          key,
          label: question.label,
          type: question.type,
          values: [],
        });
      }
    }
  }

  // Passaggio successivo: per ciascuna riga e ciascun prodotto,
  // verificare presenza, tipo, compatibilità delle opzioni,
  // distinguere risposta assente da risposta false/0 e formattare.
  // Non implementare qui un merge implicito di definizioni divergenti.
  return [...rows.values()];
}
```

Il codice è **intenzionalmente parziale**: la funzione definitiva deve rispettare il motore e gli schemi stabiliti in `18-questionnaire-engine.md`.

---

## 12. Evidenziazione delle differenze

### 12.1 Principio

Evidenziare differenze **osservabili**, senza dedurre che una caratteristica sia migliore.

Esempi:

- Prezzo A inferiore a B: differenza numerica, non giudizio complessivo.
- Rating A maggiore di B: differenza nel voto personale, non qualità oggettiva.
- Preferito sì/no: differenza di preferenza.
- Scelte questionario diverse: evidenziare la differenza senza attribuire un vincitore.

### 12.2 Regole consigliate

- Colore **non** come unico segnale: aggiungere icone, testo o pattern.
- Non evidenziare un dato mancante come «peggiore».
- Non calcolare percentuali o medie su dati insufficienti.
- Per valori testuali, mostrare differenza di contenuto solo come stato «Diverso», non come analisi linguistica.
- Per risposte multiple, mostrare gli insiemi di opzioni; non considerare l'ordine una differenza se l'ordine non ha significato.

### 12.3 Opzione «Mostra solo differenze»

**Proposta UX:** filtro temporaneo che nasconde le righe identiche **solo quando tutte le celle sono confrontabili**. Le righe con dati mancanti, definizioni incompatibili o errori devono restare visibili o essere chiaramente recuperabili.

La funzione è opzionale nella v1 e va validata con utenti reali.

---

## 13. Prezzi: confronti numerici corretti

### 13.1 Formattazione

```ts
function formatPrice(amountMinor: number | null): string {
  if (amountMinor === null) return "Non indicato";
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(amountMinor / 100);
}
```

### 13.2 Minimo e massimo

Se si desidera evidenziare il prezzo minimo, considerare **solo** i prodotti con prezzo valorizzato. Se un solo prodotto ha prezzo, evitare di chiamarlo «il più economico» rispetto a prodotti senza prezzo.

### 13.3 Differenza

Una differenza tra A e B può essere calcolata solo se entrambi hanno prezzi validi nella stessa valuta. Il risultato è informativo; non implica che i prodotti abbiano caratteristiche equivalenti.

### 13.4 Prezzi osservati

Il prezzo registrato è quello annotato dall'utente durante la visita. Non aggiornarlo automaticamente con informazioni esterne.

---

## 14. Ordinamento e disposizione colonne

### 14.1 Ordine iniziale

Preservare l'ordine di selezione dei prodotti, anziché riordinare automaticamente per prezzo o rating.

### 14.2 Riordino manuale

L'utente può spostare le colonne. Questa modifica riguarda **solo la presentazione** e non altera i dati del prodotto.

### 14.3 Ordinamento rapido opzionale

Proposta per un futuro miglioramento: ordinare colonne per prezzo crescente, voto decrescente o nome. Nella v1 è sufficiente l'ordine manuale; evitare di aggiungere un secondo sistema di ordinamento poco chiaro.

### 14.4 Accessibilità

Ogni azione di riordino deve essere possibile da tastiera. Un drag-and-drop, se introdotto, non può essere l'unica interazione disponibile.

---

## 15. Navigazione e gestione dello stato UI

### 15.1 Parametri di navigazione

**Proposta:** conservare la selezione in uno store React locale alla sessione o in un contesto di navigazione, non nel database.

Non mettere note, risposte, fotografie o altri dati personali in query string. Se si usano URL con soli ID prodotto, validarli sempre contro profilo/evento e valutare la privacy della cronologia browser.

### 15.2 Ritorno al dettaglio

Aprire il dettaglio prodotto preservando il contesto della comparazione. Se il prodotto viene modificato e salvato, al ritorno il confronto deve rileggere la versione locale confermata.

### 15.3 Bozze non salvate

Una bozza del prodotto aperta in un'altra schermata non deve essere mostrata come dato confermato. Se il prodotto viene salvato, la vista comparativa si aggiorna dopo il commit locale.

### 15.4 Cambio profilo

Il cambio profilo deve:

1. interrompere la visualizzazione del confronto precedente;
2. cancellare la selezione in memoria;
3. invalidare le query personali;
4. caricare solo i dati del nuovo profilo;
5. evitare flash di informazioni appartenenti al profilo precedente.

---

## 16. Funzionamento offline

### 16.1 Origine dei dati

Il confronto legge i **record confermati presenti in IndexedDB** e gli snapshot editoriali locali. Non deve dipendere da una richiesta server al momento dell'apertura.

### 16.2 Prodotti pendenti

Un prodotto creato offline e confermato con **Salva** può essere confrontato immediatamente con gli altri. Mostrare lo stato «In attesa di sincronizzazione», senza disabilitare la funzione.

### 16.3 Risposte ai questionari

Usare le risposte e gli snapshot salvati localmente. Se una definizione manca dalla cache, non sostituirla silenziosamente con un questionario diverso.

### 16.4 Foto

Le foto disponibili come blob locale si mostrano; le foto soltanto remote non devono bloccare la tabella.

### 16.5 Aggiornamento dati dopo sync

Quando una sincronizzazione aggiorna un prodotto, rigenerare il read model. Non sovrascrivere la selezione senza necessità.

### 16.6 Conflitti

Se un prodotto è in conflitto, la tabella può mostrare la **versione locale confermata** con un avviso esplicito. Non mescolare campi di due versioni concorrenti senza scelta dell'utente.

La risoluzione vera e propria avviene nel flusso dedicato di `20-synchronization.md`.

---

## 17. Stato di caricamento, vuoto ed errore

| Situazione | UI |
|---|---|
| Nessun prodotto selezionato | «Seleziona almeno due prodotti da confrontare» |
| Un prodotto | «Aggiungi un altro prodotto della stessa categoria» |
| Categoria con un solo prodotto | «Non ci sono altri prodotti confrontabili» |
| Prodotti compatibili | Tabella comparativa |
| Foto assente | Placeholder neutro |
| Foto solo remota, offline | «Foto non disponibile offline» |
| Prezzo assente | «Non indicato» |
| Voto assente | «Non valutato» |
| Questionario assente | Omettere la sezione se assente per tutti |
| Risposta assente | «Non compilata» |
| Domanda non prevista | «Domanda non prevista» |
| Versioni incompatibili | Avviso e celle non comparabili |
| Prodotto eliminato | Rimuovere dalla selezione, avvisare |
| Sync in errore | Banner non bloccante |
| IndexedDB non disponibile | Errore con indicazione di recupero |

I messaggi devono essere in italiano e coerenti con le altre schermate.

---

## 18. Componenti frontend suggeriti

```text
features/comparison/
├── components/
│   ├── CompareSelectionBar.tsx
│   ├── ComparisonPage.tsx
│   ├── ComparisonTable.tsx
│   ├── ComparisonProductHeader.tsx
│   ├── ComparisonSection.tsx
│   ├── ComparisonValueCell.tsx
│   ├── ComparisonQuestionnaireSection.tsx
│   ├── ComparisonPhotoPreview.tsx
│   ├── ComparisonStatusNotice.tsx
│   └── ComparisonEmptyState.tsx
├── hooks/
│   ├── useComparisonSelection.ts
│   └── useComparisonData.ts
├── services/
│   ├── validateComparison.ts
│   ├── buildComparisonModel.ts
│   ├── alignQuestionnaireAnswers.ts
│   └── formatComparisonValues.ts
└── types.ts
```

La struttura è **indicativa** e deve essere riconciliata con `02-project-structure.md` prima di creare directory o codice.

### 18.1 Responsabilità

- `CompareSelectionBar`: conteggio e azioni sulla selezione.
- `ComparisonTable`: struttura accessibile, sticky e scroll.
- `ComparisonProductHeader`: intestazione prodotto e azioni.
- `ComparisonQuestionnaireSection`: matrice domande, versioni e differenze.
- `useComparisonSelection`: stato UI temporaneo.
- `useComparisonData`: lettura reattiva da IndexedDB e catalogo.
- `validateComparison`: invarianti pure.
- `alignQuestionnaireAnswers`: normalizzazione di presentazione senza mutazioni.

### 18.2 Componenti custom

Usare **React + TypeScript + Tailwind CSS e componenti personalizzati**, come da architettura scelta. Non introdurre MUI o shadcn/ui soltanto per la tabella.

---

## 19. Accessibilità

### 19.1 Semantica tabellare

Usare una vera tabella HTML dove possibile (`table`, `thead`, `tbody`, `th`, `td`) con intestazioni di colonna e riga collegate correttamente. Non simulare una tabella con soli `div` senza motivazione.

### 19.2 Tastiera

Tutte le azioni devono essere accessibili da tastiera:

- selezione prodotti;
- aggiunta/rimozione;
- riordino colonne;
- apertura dettagli e galleria;
- espansione note;
- navigazione nello scroll orizzontale.

### 19.3 Screen reader

Le celle devono essere associate al nome del campo e del prodotto. Non annunciare soltanto «8» ma «Valutazione, Prodotto A, 8 su 10» quando necessario.

### 19.4 Contrasto e focus

Non affidarsi solo al rosso/verde per differenze, preferiti o errori. Focus visibile e contrasto adeguato anche con colonne sticky.

### 19.5 Zoom

Verificare zoom browser 200% e dimensioni del testo maggiorate: la tabella può scorrere, ma non deve perdere azioni essenziali.

---

## 20. Prestazioni

### 20.1 Dimensioni del confronto

Il limite proposto di quattro prodotti mantiene leggibile la vista. Non richiedere al server una query complessa se tutti i dati sono già disponibili localmente.

### 20.2 Caricamento progressivo

- Recuperare prima metadati e testi.
- Caricare miniature solo quando visibili.
- Aprire originali solo su richiesta.
- Memoizzare la trasformazione dei questionari quando gli input non cambiano.

### 20.3 Aggiornamenti reattivi

Una modifica confermata a un prodotto deve invalidare solo i dati interessati, senza rimontare inutilmente l'intera applicazione.

### 20.4 Evitare lavoro superfluo

Non eseguire OCR, riconoscimento immagini, ricerche web o confronti AI nel percorso di rendering.

---

## 21. Sicurezza e privacy

La funzione usa dati personali del profilo selezionato. È fondamentale ricordare che **la selezione del profilo non costituisce autenticazione**. La protezione effettiva dell'app privata dipende dal perimetro di accesso e dalla configurazione di sicurezza.

Regole:

- nessuna esposizione di note o risposte nella query string;
- nessuna cache condivisa tra profili senza chiavi distinte;
- nessun caricamento automatico di foto su servizi esterni;
- nessuna telemetria contenente note o risposte personali per impostazione predefinita;
- nessun URL pubblico permanente ai file;
- sanitizzazione/escaping del testo visualizzato;
- nessuna esecuzione di HTML inserito nelle note;
- attenzione alla persistenza dei dati sul browser condiviso.

---

## 22. Interazioni con altri moduli

### 22.1 Prodotti

La funzione non modifica il modello prodotto e rispetta l'immutabilità di `categoryId`.

### 22.2 Stand

Mostra stand e posizione, se noti; può confrontare prodotti di stand differenti.

### 22.3 Questionari

Usa risposte confermate e snapshot storici, non il solo questionario corrente.

### 22.4 Foto

Usa miniature e disponibilità offline secondo il modulo fotografie.

### 22.5 Sincronizzazione

Visualizza lo stato di sync e gestisce cambiamenti in arrivo senza risolvere conflitti automaticamente.

### 22.6 Dashboard

Un eventuale collegamento «Confronta preferiti» è **un'estensione proposta**, non un requisito della dashboard v1. Se introdotto, deve filtrare prima per categoria esatta.

### 22.7 Esportazione

Il documento `23-export.md` stabilirà se e come includere dati comparativi negli export. Non assumere che il PDF generale debba riprodurre automaticamente la tabella di confronto.

---

## 23. Esempi di casi d'uso

### 23.1 Due caschi integrali

L'utente registra due caschi con categoria `full-face-helmets`, prezzo e note. Da desktop seleziona entrambi e apre la tabella. Il prezzo inferiore è visibile, ma non viene indicato un vincitore automatico.

### 23.2 Tre moto naked

Tre prodotti della categoria `naked-motorcycles` possono essere confrontati anche se provengono da stand diversi. Il confronto mostra foto, voto generale e risposte del questionario personale associato alla categoria.

### 23.3 Questionari di versioni diverse

Un prodotto ha risposte alla versione 1, un altro alla versione 2. Una domanda aggiunta solo nella versione 2 appare come «Domanda non prevista» per il primo prodotto. Una domanda modificata semanticamente viene marcata incompatibile anziché confrontata come identica.

### 23.4 Prodotto salvato offline

Un prodotto creato e salvato durante la fiera senza rete compare nel confronto sullo stesso dispositivo. Lo stato è «In attesa di sincronizzazione».

### 23.5 Padre e figlio

Il profilo `me` e `father` registrano prodotti simili. La comparazione resta separata per profilo: non unisce le loro valutazioni, anche quando il nome commerciale coincide.

### 23.6 Prezzo mancante

Prodotto A costa `300,00 €`; prodotto B ha `null`. La tabella mostra «Non indicato» per B e non lo considera gratuito o più economico.

---

## 24. Test funzionali: selezione

| ID | Scenario | Esito atteso |
|---|---|---|
| CMP-001 | Nessun prodotto selezionato | Confronta disabilitato |
| CMP-002 | Un solo prodotto | Confronta disabilitato |
| CMP-003 | Due prodotti stessa categoria | Confronta abilitato |
| CMP-004 | Tre prodotti stessa categoria | Confronto valido |
| CMP-005 | Quattro prodotti stessa categoria | Confronto valido, se limite approvato |
| CMP-006 | Quinto prodotto | Blocco con messaggio, se limite 4 |
| CMP-007 | Categorie diverse | Selezione incompatibile rifiutata |
| CMP-008 | Categoria padre e figlia | Non confrontabili |
| CMP-009 | Stessa categoria, eventi diversi | Non confrontabili |
| CMP-010 | Stessa categoria, profili diversi | Non confrontabili |
| CMP-011 | Stesso ID prodotto selezionato due volte | Nessun duplicato |
| CMP-012 | Prodotto eliminato | Rimosso dalla selezione |
| CMP-013 | Prodotto in bozza non salvata | Escluso |
| CMP-014 | Prodotto salvato offline | Selezionabile |
| CMP-015 | Cambio profilo | Selezione azzerata |
| CMP-016 | Cambio evento | Selezione azzerata |
| CMP-017 | Rimozione da confronto | Prodotto non eliminato |
| CMP-018 | Riordino colonne | Dati immutati |
| CMP-019 | Apertura da dettaglio | Prodotto preselezionato |
| CMP-020 | Apertura da stand | Altri stand stessa categoria ammessi |

---

## 25. Test funzionali: dati e questionari

| ID | Scenario | Esito atteso |
|---|---|---|
| CMP-021 | Prezzo `null` | «Non indicato» |
| CMP-022 | Prezzo `0` | `0,00 €` |
| CMP-023 | Prezzo con centesimi | Formattazione `it-IT` |
| CMP-024 | Voto `null` | «Non valutato» |
| CMP-025 | Voto `1` | `1/10` |
| CMP-026 | Voto `10` | `10/10` |
| CMP-027 | Preferito `true` | Etichetta corretta |
| CMP-028 | Preferito `false` | Non confuso con dato assente |
| CMP-029 | Note multilinea | Interruzioni preservate |
| CMP-030 | Nome prodotto lungo | Testo accessibile |
| CMP-031 | Stand senza padiglione | Nessuna posizione inventata |
| CMP-032 | Stand editoriale rinominato | ID e collegamento invariati |
| CMP-033 | Questionario assente su tutti | Sezione omessa |
| CMP-034 | Questionario presente senza risposte | «Non compilata» |
| CMP-035 | Risposta booleana `false` | «No» |
| CMP-036 | Risposta numerica `0` | `0` |
| CMP-037 | Domanda assente in uno snapshot | «Domanda non prevista» |
| CMP-038 | Domanda aggiunta in versione nuova | Nessuna risposta inventata |
| CMP-039 | Domanda con stesso nome ma ID diverso | Nessun merge per etichetta |
| CMP-040 | Stesso ID ma tipo incompatibile | Avviso di incompatibilità |
| CMP-041 | Opzione rinominata | Etichetta storica preservata |
| CMP-042 | Scelta multipla | Elenco completo e stabile |
| CMP-043 | Risposta testuale lunga | Espandibile |
| CMP-044 | Snapshot mancante | Errore esplicito, nessuna reinterpretazione |
| CMP-045 | Voto questionario e voto generale | Due campi distinti |
| CMP-046 | Prezzo presente solo in una colonna | Nessun minimo ingannevole |
| CMP-047 | Differenze solo testuali | Nessun vincitore dedotto |
| CMP-048 | Domanda numerica senza unità coerenti | Nessun delta arbitrario |

---

## 26. Test funzionali: offline, foto e interfaccia

| ID | Scenario | Esito atteso |
|---|---|---|
| CMP-049 | Apertura offline dopo bootstrap | Dati locali disponibili |
| CMP-050 | Prodotto con sync pendente | Confrontabile e segnalato |
| CMP-051 | Conflitto di prodotto | Versione mostrata identificabile |
| CMP-052 | Foto blob locale | Miniatura visibile offline |
| CMP-053 | Foto soltanto remota offline | Placeholder corretto |
| CMP-054 | Foto non presente | Nessun errore bloccante |
| CMP-055 | Foto danneggiata | Messaggio e confronto funzionante |
| CMP-056 | Più foto | Galleria consultabile |
| CMP-057 | Chiusura galleria | Selezione preservata |
| CMP-058 | Salva modifiche in altra scheda | Confronto aggiornato |
| CMP-059 | Bozza non salvata | Non appare nella tabella |
| CMP-060 | Aggiornamento configurazione | Riferimenti stabili rispettati |
| CMP-061 | Desktop ampio | Colonne leggibili |
| CMP-062 | Larghezza ridotta | Scroll confinato alla tabella |
| CMP-063 | Smartphone | Messaggio desktop-only coerente |
| CMP-064 | Navigazione tastiera | Tutti i controlli accessibili |
| CMP-065 | Zoom 200% | Nessuna azione essenziale persa |
| CMP-066 | Screen reader | Intestazioni associate alle celle |
| CMP-067 | Contrasto elevato | Differenze comprensibili |
| CMP-068 | Cambio profilo rapido | Nessun flash di dati altrui |
| CMP-069 | Eliminazione mentre tabella aperta | Selezione rivalidata |
| CMP-070 | Storage locale indisponibile | Errore chiaro e recuperabile |

---

## 27. Test di integrazione e proprietà

### 27.1 Proprietà invarianti

- Tutti i prodotti di una comparazione valida hanno lo stesso `(profileId, eventId, categoryId)`.
- L'ordine delle colonne non cambia gli ID, i prezzi o le risposte.
- Il confronto non scrive direttamente su `products`, `answer_sets`, `photos` o `outbox`.
- Un valore `null` non viene trasformato in `0`.
- Una risposta `false` non viene trasformata in «Non compilata».
- Le definizioni storiche non vengono rimpiazzate senza migrazione.
- La rimozione di una colonna non elimina il prodotto.

### 27.2 Test con database locale

1. Inserire due prodotti validi in IndexedDB.
2. Aprire il confronto offline.
3. Modificare e salvare uno dei prodotti.
4. Verificare l'aggiornamento della colonna.
5. Forzare un conflitto da sincronizzazione.
6. Verificare che il confronto segnali la situazione senza unire versioni.
7. Risolvere il conflitto nel flusso dedicato.
8. Verificare l'aggiornamento della tabella dopo il nuovo commit.

### 27.3 Test visivi

Verificare almeno larghezze indicative **1024, 1280, 1440 e 1920 CSS px**, oltre a zoom elevato. La disponibilità della funzione dipende dalla larghezza utile e dall'esito dei test, non dal nome del dispositivo.

---

## 28. Criteri di accettazione

- [ ] Confronto disponibile su desktop e non presentato come tabella principale su smartphone.
- [ ] Selezione di almeno due prodotti.
- [ ] Categoria **esattamente identica**.
- [ ] Stesso profilo e stesso evento.
- [ ] Nessuna selezione di prodotti eliminati o bozze non confermate.
- [ ] Nessuna modifica ai prodotti causata dal semplice confronto.
- [ ] Nomi, stand, prezzi, voti, preferiti, note e fotografie visualizzati.
- [ ] Prezzi assenti distinti da prezzi zero.
- [ ] Voto generale indipendente dai rating del questionario.
- [ ] Questionari allineati in modo sicuro e versionato.
- [ ] Domanda non prevista distinta da domanda non compilata.
- [ ] `false`, `0` e lista vuota preservati correttamente.
- [ ] Nessuna equivalenza inventata tra questionari incompatibili.
- [ ] Nessuna specifica o posizione stand inventata.
- [ ] Supporto a dati confermati offline e non ancora sincronizzati.
- [ ] Foto locali visualizzabili offline.
- [ ] Foto remote mancanti gestite senza bloccare la pagina.
- [ ] Stato dei conflitti visibile, senza merge automatico.
- [ ] Colonne riordinabili con controlli accessibili.
- [ ] Tabelle leggibili con scorrimento e intestazioni appropriate.
- [ ] Nessuna perdita della selezione durante apertura/chiusura foto.
- [ ] Cambio profilo/evento invalida correttamente i dati precedenti.
- [ ] Almeno i 70 scenari funzionali elencati coperti da test appropriati.

---

## 29. Decisioni ancora aperte

| Questione | Proposta iniziale | Impatto |
|---|---|---|
| Numero massimo colonne | 4 prodotti | UX, performance |
| Soglia desktop | Circa 1024 CSS px | Responsive |
| Selezione persistente | Solo sessione UI | Navigazione |
| Riordino | Pulsanti sinistra/destra, drag opzionale | Accessibilità |
| Differenze | Evidenziazione neutra | Presentazione |
| Mostra solo differenze | Opzionale | UX |
| Allineamento questionari storici | Identità e compatibilità rigorose | Integrità semantica |
| Prezzo minimo | Evidenziare solo con almeno 2 prezzi | UX |
| Comparazione esportabile | Da decidere in `23-export.md` | PDF/JSON |
| Comparazione su tablet | Dipende da larghezza utile | Responsive |
| Categoria padre/figlia | **Non** confrontabili nella v1 | Dominio |

Non trasformare le proposte in requisiti immutabili senza una verifica con il resto della documentazione e con le preferenze dell'utente.

---

## 30. Tracciabilità e documento successivo

| Documento | Collegamento |
|---|---|
| `06-categories-config.md` | Identità categorie e gerarchia |
| `08-products-config.md` | Modello dei prodotti dinamici |
| `10-questionnaires-config.md` | Tipi e versionamento delle domande |
| `12-database.md` | Persistenza e revisioni |
| `13-backend-api.md` | Lettura e sincronizzazione dei dati |
| `14-frontend-ui.md` | Navigazione e componenti responsive |
| `17-product-management.md` | Creazione, modifica, cancellazione |
| `18-questionnaire-engine.md` | Interpretazione delle risposte |
| `19-offline-storage.md` | IndexedDB e cache |
| `20-synchronization.md` | Conflitti e operazioni pendenti |
| `21-photo-management.md` | Miniature, blob e disponibilità offline |
| `23-export.md` | Export JSON/PDF per profilo |
| `25-security.md` | Protezione dei dati e accesso privato |
| `26-testing.md` | Piano di test complessivo |

**Prossimo:** `docs/23-export.md` — esportazione dei dati per profilo in **JSON e PDF**, scelta delle categorie, riepiloghi e schede prodotto con fotografie, note e risposte ai questionari. **Non sono previsti Excel o importazioni** nella v1.
