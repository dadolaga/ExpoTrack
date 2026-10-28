# 11 — Stati di visita degli stand (`visit-statuses`)

## Aggiornamento mobile — risposte A1–A9

**Contratto vigente per il web mobile da fiera:** [specifica UI mobile, risposte A1–A9](27_Specifiche_UI_Mobile.md#10-risposte-di-revisione-recepite). Questo aggiornamento prevale sui paragrafi, diagrammi, pseudocodice e casi di test precedenti incompatibili. In particolare, gli esempi con `drafts`, conferma finale «Salva», dettaglio mobile 08, foto stand o scelta manuale del conflitto descrivono la progettazione precedente e non vanno implementati nel mobile. Le parti compatibili e le funzioni desktop/post-fiera mantengono il proprio ambito.

Stati soltanto to_visit, visited, revisit e sempre sullo stand nel contesto profilo/evento. Non interessato è assenza di interesse, non quarto stato. Cambi manuali autosalvati; prodotto/checklist non marcano visitato automaticamente. I tre conteggi Dashboard riguardano gli stand di interesse; top 5 esclude visitati e priorità assente.


> **ExpoTrack · Specifica tecnica v1 · Contratto proposto, non implementazione**  
> **Documenti collegati:** `04-profiles-config.md`, `07-stands-config.md`, `09-interests-config.md`, `12-database.md`, `13-backend-api.md`, `15-dashboard.md`, `16-stand-management.md`, `19-offline-storage.md`, `20-synchronization.md`.  
> **Prossimo documento:** `12-database.md`.

---

## 1. Scopo

Definire gli **stati personali di visita** degli stand, i passaggi consentiti, la persistenza offline, il rapporto con dashboard e filtri, e la gestione dei conflitti fra dispositivi. Lo stato risponde alla domanda **«A che punto sono con questo stand?»** e non descrive lo stand nel catalogo condiviso.

La v1 prevede **esattamente tre stati**, già concordati:

1. **Da visitare** — lo stand non è stato contrassegnato come visitato o da rivedere.
2. **Visitato** — l'utente considera conclusa la visita allo stand.
3. **Da rivedere** — l'utente vuole tornarci o approfondirlo.

Non introdurre ulteriori stati, ad esempio «in corso», «saltato», «annullato», «preferito» o «prenotato», senza una decisione esplicita. Preferiti e priorità sono concetti diversi e non devono essere incorporati nello stato.

### 1.1 Requisiti confermati

- Stato **per profilo, per evento, per stand**; non condiviso tra persone.
- Stato iniziale **da visitare**.
- L'utente può cambiare lo stato di uno stand editoriale o personale visibile al proprio profilo.
- Dashboard con conteggi separati per **da visitare**, **visitato**, **da rivedere**; ogni contatore apre una lista filtrata.
- Lista stand filtrabile per stato, combinabile con categoria, padiglione, priorità e ricerca.
- Bozze locali autosalvate, ma sincronizzazione solo dopo **Salva**.
- Salvataggio e consultazione offline; sincronizzazione automatica al ritorno online e manuale su richiesta.
- Conflitti sullo stesso profilo da più dispositivi **risolti manualmente**, conservando entrambe le versioni.
- Nessun login interno, PIN o sistema di autorizzazione per profilo nella v1.
- I filtri e gli ordinamenti si resettano alla riapertura dell'app.

### 1.2 Cosa non fa questo documento

Non definisce la grafica completa delle schermate, le tabelle SQL definitive, gli endpoint API esatti o l'algoritmo completo di sincronizzazione: questi contratti appartengono ai documenti successivi. Qui si fissano invarianti e comportamenti osservabili.

---

## 2. Vocabolario e codici

### 2.1 Enumerazione proposta

| Codice persistito | Etichetta italiana | Significato | Default |
|---|---|---|---|
| `to_visit` | Da visitare | Nessuna visita conclusa o ritorno richiesto | **Sì** |
| `visited` | Visitato | Visita considerata conclusa | No |
| `revisit` | Da rivedere | È necessario tornare o approfondire | No |

La scelta dei codici inglesi è **proposta tecnica** coerente con i documenti precedenti; le etichette italiane sono le stringhe visualizzate nella v1. Il codice persistito deve essere stabile, indipendente dalla traduzione dell'interfaccia.

```ts
export const VISIT_STATUSES = ["to_visit", "visited", "revisit"] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

export const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  to_visit: "Da visitare",
  visited: "Visitato",
  revisit: "Da rivedere",
};
```

### 2.2 Assenza di record

**Regola proposta:** se uno stand è visibile al profilo ma non esiste un record dinamico di stato, il suo **stato effettivo** è `to_visit`.

Questo evita di creare migliaia di righe al bootstrap e garantisce che gli stand aggiunti al catalogo compaiano subito nel conteggio «Da visitare». L'assenza del record non deve essere interpretata come uno stato sconosciuto o come un errore.

Distinguere rigorosamente:

- **Stato effettivo:** il valore mostrato, sempre uno dei tre codici.
- **Override persistito:** un valore esplicitamente salvato dall'utente; può anche essere `to_visit`.
- **Bozza:** selezione non ancora confermata con Salva.

Un override `to_visit` esplicito e l'assenza di override hanno lo stesso stato effettivo, ma possono differire per audit, sincronizzazione e gestione dei conflitti. Non cancellare automaticamente l'override senza una politica esplicita.

---

## 3. Dove risiedono i dati

| Informazione | Origine | Mutabile dall'utente? |
|---|---|---|
| ID e nome stand | Catalogo JSON evento o stand personale dinamico | Solo stand personali |
| Priorità 1–10 | Seed JSON interessi + override personale | Sì |
| Lista «cosa vedere» | Seed JSON interessi + override personale | Sì |
| Stato di visita | **Record dinamico personale** | **Sì** |
| Note/foto stand | Record e media personali | Sì |
| Prodotti osservati | Record dinamici personali | Sì |

**Non aggiungere** `visitStatus` ai record di `config/events/eicma-2026-stands.json` o a `config/interests/me.json`/`father.json`. Lo stato non è un'informazione editoriale iniziale per la v1.

Il titolo del file `11-visit-statuses-config.md` è una convenzione della documentazione: **non implica la creazione di `config/visit-statuses.json`**. I tre stati possono essere un'enumerazione nel codice, salvo futura necessità di renderli configurabili.

---

## 4. Identità dello stato

### 4.1 Chiave logica

Ogni stato appartiene alla combinazione:

- `profileId` — profilo selezionato;
- `eventId` — fiera attiva;
- `standRef` — riferimento univoco allo stand.

Lo stand può essere **editoriale** oppure **personale**. Un semplice `standId` non è sufficiente se si possono avere collisioni tra eventi o origini.

```ts
type StandRef = {
  source: "catalog" | "personal";
  standId: string;
};

type VisitStatusIdentity = {
  profileId: string;
  eventId: string;
  standRef: StandRef;
};
```

Il record di uno stand personale è accessibile soltanto nell'ambito del suo `ownerProfileId`. Il server deve verificare la coerenza dei riferimenti, pur non potendo attestare l'identità reale della persona nella v1 senza autenticazione.

### 4.2 Isolamento

Esempio illustrativo:

| Evento | Stand | Profilo | Stato effettivo |
|---|---|---|---|
| `eicma-2026` | `demo-stand` | `me` | Visitato |
| `eicma-2026` | `demo-stand` | `father` | Da visitare |
| `altra-fiera-demo` | `demo-stand` | `me` | Da rivedere |

I nomi sono fittizi: l'esempio mostra soltanto la separazione dei dati. Cambiare profilo o evento **non** deve trasferire uno stato all'altro.

---

## 5. Modello dati proposto

```ts
export interface StandVisitState {
  profileId: string;
  eventId: string;
  standRef: {
    source: "catalog" | "personal";
    standId: string;
  };
  status: "to_visit" | "visited" | "revisit";
  updatedAt: string;
  revision: string;
}
```

`updatedAt` e `revision` sono metadati tecnici di sincronizzazione. La rappresentazione definitiva sarà definita in `12-database.md` e `20-synchronization.md`. L'assenza di un record vale `to_visit`, quindi non è necessario generare preventivamente un record per ogni stand.

### 5.1 Esempio di record salvato

```json
{
  "profileId": "me",
  "eventId": "eicma-2026",
  "standRef": {
    "source": "catalog",
    "standId": "demo-stand"
  },
  "status": "revisit",
  "updatedAt": "2026-10-27T10:00:00.000Z",
  "revision": "example-revision"
}
```

`demo-stand` e `example-revision` sono segnaposto **non reali**. Non copiare questa revisione letterale in un'implementazione.

### 5.2 Invarianti

1. Un solo stato **effettivo** per combinazione profilo/evento/stand.
2. Il valore deve appartenere all'enumerazione prevista.
3. Il riferimento allo stand deve essere valido e visibile al profilo.
4. Il cambio di stato non modifica il catalogo condiviso.
5. Il cambio di stato non modifica automaticamente priorità, note, fotografie o prodotti.
6. Il cambio di stato non crea o elimina automaticamente prodotti.
7. Il salvataggio locale deve essere atomico rispetto all'inserimento dell'operazione nella coda di sincronizzazione.
8. I conflitti non devono essere risolti silenziosamente con last-write-wins.

---

## 6. Transizioni consentite

### 6.1 Matrice delle transizioni

**Proposta:** tutte le transizioni tra i tre stati sono consentite. Non esiste una macchina a stati irreversibile: l'utente può correggere una selezione o cambiare idea.

| Da \ A | Da visitare | Visitato | Da rivedere |
|---|---|---|---|
| Da visitare | Nessun cambiamento | Consentita | Consentita |
| Visitato | Consentita | Nessun cambiamento | Consentita |
| Da rivedere | Consentita | Consentita | Nessun cambiamento |

Questa è una **scelta proposta**, non un requisito esplicitamente confermato. Non imporre che uno stand passi prima da `visited` per poter essere segnato `revisit`: può essere necessario tornarci anche dopo un primo passaggio incompleto.

### 6.2 Significato di «Da rivedere»

`revisit` è uno **stato alternativo**, non una sottocategoria di `visited`. Di conseguenza, nella dashboard i tre conteggi sono **mutuamente esclusivi** e la loro somma corrisponde al numero degli stand visibili nell'evento/profilo.

Se in futuro servisse sapere se uno stand «da rivedere» è già stato visitato almeno una volta, occorrerebbe un dato storico separato, non una reinterpretazione silenziosa del codice.

### 6.3 Cambio senza effetti collaterali

Se un utente cambia `visited → to_visit`, le note e le foto rimangono. Se cambia `revisit → visited`, i prodotti osservati rimangono. Lo stato è una proprietà del progresso della visita, non un comando per cancellare dati.

---

## 7. Interazione nella scheda stand

### 7.1 Visualizzazione

Mostrare lo stato corrente con un'etichetta leggibile. Il colore può rafforzare la distinzione ma **non** deve essere l'unico segnale. Preferire un controllo con le tre opzioni esplicite.

Su mobile il controllo deve essere raggiungibile senza precisione eccessiva; su desktop deve funzionare anche con tastiera.

### 7.2 Flusso di modifica

1. L'utente apre lo stand.
2. La UI mostra lo stato **confermato localmente**.
3. L'utente sceglie un altro stato.
4. Il nuovo valore entra nella **bozza locale**, con autosalvataggio della bozza.
5. La UI segnala «Modifiche non salvate».
6. L'utente preme **Salva**.
7. Si valida lo stato e il riferimento.
8. Si salva il record in IndexedDB e si registra l'operazione di sync in modo coerente.
9. La UI mostra «Salvato sul dispositivo» e, se necessario, «In attesa di sincronizzazione».
10. Quando il server conferma, lo stato passa a «Sincronizzato».

**Non** trattare il semplice tocco sullo stato come un salvataggio remoto definitivo. Questo mantiene la regola globale delle bozze e del pulsante Salva.

### 7.3 Uscita dalla schermata

Se lo stato selezionato è diverso da quello confermato, mostrare un avviso di modifiche non salvate. Anche se l'utente lascia la schermata, **conservare la bozza** per un successivo recupero.

Il passaggio a un altro profilo deve impedire che la bozza venga applicata al profilo sbagliato.

### 7.4 Modifica con altri campi

Lo stato può essere modificato insieme a priorità, note o «cosa vedere». La schermata deve poter salvare un insieme coerente di modifiche personali senza generare aggiornamenti contraddittori.

La granularità dell'operazione di sincronizzazione (intero record personale o patch per campo) è da definire in `20-synchronization.md`. In ogni caso, un cambiamento allo stato non deve azzerare accidentalmente note e interessi.

---

## 8. Lista stand e filtri

### 8.1 Filtro stato

La lista degli stand deve offrire almeno:

- **Tutti gli stati**;
- **Da visitare**;
- **Visitato**;
- **Da rivedere**.

Il filtro opera sullo **stato effettivo**, quindi include anche gli stand senza record dinamico nella sezione «Da visitare».

### 8.2 Combinazione con altri filtri

Il filtro stato è combinabile con ricerca per nome, categoria, padiglione e priorità personale. La semantica proposta è **AND tra gruppi di filtri diversi**. Se una UI supporta più valori nello stesso gruppo, usare OR tra quei valori, salvo diversa specifica del modulo frontend.

Esempio: `categoria = caschi` **e** `stato = da rivedere` mostra solo gli stand di quella categoria con stato `revisit` per il profilo attivo.

### 8.3 Filtri e ordinamenti temporanei

Il filtro stato impostato dall'utente o dalla dashboard non deve sopravvivere alla **riapertura dell'app**. Il profilo selezionato, invece, resta memorizzato come previsto dalla configurazione generale.

### 8.4 Stand editoriali e personali

I risultati includono:

- gli stand editoriali visibili nell'evento;
- gli stand creati dal profilo attivo.

Non includono gli stand privati degli altri profili, anche quando si seleziona «Tutti gli stati».

---

## 9. Dashboard: contatori e navigazione

### 9.1 Definizione dei conteggi

Sia `S` l'insieme degli stand visibili per **profilo ed evento attivi**. Si calcolano:

```text
toVisitCount = numero di stand in S con stato effettivo "to_visit"
visitedCount = numero di stand in S con stato effettivo "visited"
revisitCount = numero di stand in S con stato effettivo "revisit"
totalStands = numero totale di stand in S
```

Deve valere sempre:

```text
toVisitCount + visitedCount + revisitCount = totalStands
```

Questa identità è un **invariante fondamentale**. Non contare due volte uno stand `revisit` come `visited`.

### 9.2 Esempio numerico

Con 12 stand visibili, 7 `to_visit`, 3 `visited` e 2 `revisit`:

| Indicatore | Valore |
|---|---:|
| Da visitare | 7 |
| Visitati | 3 |
| Da rivedere | 2 |
| Totale | 12 |

I numeri sono fittizi e illustrano il calcolo, non dati reali di EICMA.

### 9.3 Navigazione dai contatori

- Tocco su **Da visitare** → lista stand con filtro `to_visit`.
- Tocco su **Visitati** → lista stand con filtro `visited`.
- Tocco su **Da rivedere** → lista stand con filtro `revisit`.

La navigazione deve conservare il profilo e l'evento attivi. Il filtro può essere applicato mediante parametro di navigazione, stato temporaneo o altro meccanismo del frontend; non deve diventare una preferenza persistente.

### 9.4 Aggiornamento dei contatori

Dopo un **Salva locale confermato**, i contatori devono aggiornarsi immediatamente usando i dati locali. Non attendere la rete per mostrare il nuovo conteggio.

Le **bozze non confermate** non devono alterare i conteggi ufficiali della dashboard: il conteggio deriva dallo stato confermato. Questa è una proposta importante per evitare differenze tra dashboard e lista durante una modifica incompleta.

### 9.5 Aggiunta e rimozione stand

- Nuovo stand editoriale in catalogo: entra come `to_visit` per tutti i profili, salvo override esistente.
- Nuovo stand personale salvato: entra come `to_visit` per il proprietario, salvo stato confermato contestualmente alla creazione.
- Eliminazione confermata di uno stand personale: lo stand esce dai conteggi, senza cancellare dati collegati silenziosamente.
- Rimozione editoriale di uno stand con riferimenti personali: richiede una strategia di migrazione/conservazione; non perdere gli stati in modo implicito.

---

## 10. Persistenza locale e offline

### 10.1 Strati distinti

**Bozze IndexedDB:** contengono selezioni non ancora confermate.  
**Stati confermati IndexedDB:** sono la fonte della UI offline dopo Salva.  
**Coda operazioni IndexedDB:** contiene le mutazioni confermate in attesa di sincronizzazione.  
**PostgreSQL:** conserva lo stato sincronizzato e la revisione server.

Non sincronizzare le bozze. Non mostrare «salvato» se la scrittura locale è fallita.

### 10.2 Transazione atomica proposta

Al comando Salva:

1. verificare che lo stand sia valido e visibile al profilo;
2. verificare che il nuovo codice stato sia ammesso;
3. aggiornare il record locale confermato;
4. aggiungere un'operazione di sync con ID univoco e revisione di base;
5. completare la transazione IndexedDB;
6. solo dopo il commit, aggiornare l'indicatore «Salvato localmente».

Se la transazione fallisce, non dichiarare riuscito il salvataggio e non scartare la bozza.

### 10.3 Primo avvio senza rete

L'app è offline-first **dopo un bootstrap riuscito**: se il dispositivo non ha mai scaricato cataloghi e profili, non si può promettere la lista stand completa offline. Se i dati necessari sono in cache, gli stati sono consultabili e modificabili senza connessione.

### 10.4 Persistenza delle bozze

Usare una chiave di bozza che includa almeno profilo, evento e riferimento stand. Così due profili non condividono per errore una selezione non salvata.

---

## 11. Sincronizzazione

### 11.1 Quando parte

- Automaticamente quando l'app è aperta e la connettività è disponibile.
- Al ritorno online dopo operazioni offline.
- Su richiesta tramite pulsante di sincronizzazione manuale.

**Non garantire** background sync con app chiusa: il comportamento dipende dal browser e dal sistema operativo.

### 11.2 Operazione concettuale

```json
{
  "operationId": "op-demo-123",
  "entityType": "standVisitState",
  "action": "upsert",
  "profileId": "me",
  "eventId": "eicma-2026",
  "standRef": {
    "source": "catalog",
    "standId": "demo-stand"
  },
  "status": "visited",
  "baseRevision": "example-revision"
}
```

L'esempio **non è un endpoint API definitivo**. `operationId` serve a rendere i retry idempotenti; `baseRevision` consente di individuare modifiche concorrenti. I valori sono segnaposto.

### 11.3 Retry e idempotenza

Ripetere la stessa operazione dopo un timeout non deve generare più cambi di stato o revisioni duplicate. L'API deve riconoscere gli ID di operazione già elaborati.

### 11.4 Ordinamento delle operazioni

Se lo stesso dispositivo conferma `visited` e poi `revisit` offline, la coda deve preservare l'ordine logico o applicare una compattazione sicura che mantenga l'ultima intenzione **senza perdere la capacità di rilevare conflitti**.

La compattazione è una decisione tecnica del motore sync, non una licenza per sovrascrivere revisioni remote.

---

## 12. Conflitti fra dispositivi

### 12.1 Scenario

Il profilo `me` apre lo stesso stand su due dispositivi:

1. Dispositivo A, revisione `r4`: seleziona **Visitato** e salva.
2. Dispositivo B, sempre revisione `r4`: seleziona **Da rivedere** e salva offline.
3. A sincronizza, creando `r5`.
4. B torna online e tenta di sincronizzare sulla base di `r4`.

Il server deve riconoscere il conflitto. Non scegliere automaticamente in base al timestamp del dispositivo o all'ordine di arrivo.

### 12.2 Risoluzione manuale

Mostrare almeno:

| Versione | Stato |
|---|---|
| Versione presente sul server | Visitato |
| Modifica locale in conflitto | Da rivedere |

L'utente sceglie quale mantenere. Entrambe le versioni devono essere preservate fino alla scelta. La risoluzione crea una nuova revisione; l'interfaccia deve confermare soltanto dopo che il salvataggio della scelta è riuscito.

### 12.3 Conflitti con altri campi

Se stato, priorità e note sono nello stesso aggregato, una modifica concorrente alla nota potrebbe confliggere con un cambio stato. Il modello definitivo deve stabilire se le revisioni sono **per campo** o **per record**. Non fondere automaticamente i campi senza una politica esplicita e verificabile.

### 12.4 Eliminazioni

Se uno stand personale è stato eliminato su un dispositivo mentre un altro modifica il suo stato, non ricreare lo stand silenziosamente. Trattare il caso come conflitto di esistenza e applicare le regole di eliminazione del modulo stand.

---

## 13. Aggiornamento del catalogo editoriale

### 13.1 Nuovi stand

Quando un aggiornamento JSON aggiunge uno stand, il suo stato effettivo è `to_visit` per ciascun profilo, a meno che esista già un override compatibile (ad esempio da un precedente snapshot).

### 13.2 Stand rinominati

Una modifica di `name`, `description`, `hall`, `booth` o categorie **a ID invariato** non deve cambiare lo stato personale.

### 13.3 Stand rimossi o ID cambiati

Non cancellare automaticamente gli stati associati a ID rimossi. Serve una politica di migrazione o di conservazione storica, coordinata con prodotti, note e fotografie. La semplice eliminazione di una riga dal JSON non è un'istruzione a cancellare dati personali.

### 13.4 Eventi disabilitati

Disabilitare un evento in `app.json` non deve cancellarne gli stati. Se l'evento viene riabilitato, i dati devono essere recuperabili secondo le regole di conservazione.

---

## 14. Interazione con gli altri moduli

### 14.1 Priorità

La priorità 1–10 rappresenta **quanto interessa uno stand**; lo stato rappresenta **il progresso della visita**. Sono indipendenti:

- priorità 10 + `to_visit` è valido;
- priorità 1 + `visited` è valido;
- priorità assente + `revisit` è valido.

Non impostare automaticamente una priorità quando lo stato cambia.

### 14.2 Cosa vedere

La lista personale «cosa vedere» può essere compilata o modificata indipendentemente dallo stato. Segnare `visited` non deve svuotarla né spuntarne automaticamente gli elementi.

### 14.3 Prodotti

Creare un prodotto durante la visita non deve impostare automaticamente `visited`: l'utente potrebbe voler tornare allo stand. Viceversa, segnare uno stand `visited` non obbliga a creare prodotti.

### 14.4 Note e fotografie

Note e fotografie restano associate allo stand anche se lo stato ritorna `to_visit`. Non usare il cambio di stato per pulire media o note.

### 14.5 Export

L'export per profilo può includere lo stato degli stand. L'eventuale selezione delle sezioni e il formato esatto sono demandati a `23-export.md`. Non includere stati di altri profili.

---

## 15. Validazioni

| ID | Controllo | Comportamento |
|---|---|---|
| VS-001 | Codice stato ammesso | Rifiutare codici sconosciuti |
| VS-002 | Profilo esistente | Rifiutare profilo inesistente |
| VS-003 | Evento esistente | Rifiutare evento inesistente |
| VS-004 | Stand editoriale presente nell'evento | Validare riferimento |
| VS-005 | Stand personale di proprietà del profilo | Validare proprietario |
| VS-006 | Unicità della chiave logica | Non creare duplicati |
| VS-007 | Bozza separata dal confermato | Non sincronizzare bozze |
| VS-008 | Scrittura locale + coda atomica | Nessun falso salvataggio |
| VS-009 | Revisione di base coerente | Conflitto se diversa |
| VS-010 | Operazione ripetuta | Idempotenza |
| VS-011 | Contatori mutuamente esclusivi | Somma uguale al totale |
| VS-012 | Cambi profilo/evento | Nessuna contaminazione |
| VS-013 | Aggiornamento catalogo | Preservare override validi |
| VS-014 | Stand rimosso con dati | Nessuna perdita silenziosa |

### 15.1 Errori applicativi proposti

```text
VISIT_STATUS_INVALID
Valore "pending" non supportato. Stati validi: to_visit, visited, revisit.
```

```text
VISIT_STATUS_STAND_NOT_ACCESSIBLE
Lo stand richiesto non esiste nell'evento oppure non appartiene al profilo attivo.
```

```text
VISIT_STATUS_CONFLICT
La versione sul server è cambiata. Confronta le due versioni e scegli quale mantenere.
```

```text
VISIT_STATUS_LOCAL_SAVE_FAILED
Impossibile salvare sul dispositivo. La bozza è stata mantenuta, se possibile.
```

Le stringhe sono esempi di contratto, non messaggi finali già localizzati.

---

## 16. Accessibilità e usabilità

- Usare etichette testuali complete, non soltanto colori o icone.
- Indicare chiaramente quale stato è selezionato.
- Il controllo deve funzionare con tastiera, touch e screen reader.
- Associare il controllo al nome dello stand per evitare modifiche alla scheda sbagliata.
- Rendere distinguibili «Modifiche non salvate», «Salvato localmente» e «Sincronizzato».
- Non mostrare conferme di sincronizzazione prima della risposta positiva del server.
- Le schermate di conflitto devono permettere di leggere **entrambe** le versioni.
- I contatori della dashboard devono essere cliccabili/toccabili e avere un nome accessibile.
- Evitare di usare «Da rivedere» come etichetta di errore: è uno stato normale.

---

## 17. Test funzionali

| Test | Scenario | Esito atteso |
|---|---|---|
| T-VS-01 | Stand editoriale senza record personale | `to_visit` |
| T-VS-02 | Stand personale appena salvato | `to_visit` |
| T-VS-03 | `to_visit → visited` | Consentito |
| T-VS-04 | `to_visit → revisit` | Consentito |
| T-VS-05 | `visited → revisit` | Consentito |
| T-VS-06 | `visited → to_visit` | Consentito |
| T-VS-07 | `revisit → visited` | Consentito |
| T-VS-08 | `revisit → to_visit` | Consentito |
| T-VS-09 | Selezione dello stato già attivo | Nessun cambio sostanziale |
| T-VS-10 | Codice `pending` | Rifiutato |
| T-VS-11 | Cambio stato prima di Salva | Solo bozza |
| T-VS-12 | Uscita dalla scheda con bozza | Avviso e bozza preservata |
| T-VS-13 | Cambio profilo con bozza | Nessun trasferimento |
| T-VS-14 | Salva offline | Conferma locale + coda |
| T-VS-15 | Errore IndexedDB | Nessun falso successo |
| T-VS-16 | Ritorno online | Sincronizzazione tentata |
| T-VS-17 | Sync manuale | Operazioni pendenti inviate |
| T-VS-18 | Retry stessa operazione | Nessun duplicato |
| T-VS-19 | Due modifiche offline in sequenza | Ordine preservato |
| T-VS-20 | Due dispositivi, revisione divergente | Conflitto manuale |
| T-VS-21 | Scelta versione remota | Stato scelto salvato |
| T-VS-22 | Scelta versione locale | Stato scelto salvato |
| T-VS-23 | Cambio stato con note esistenti | Note preservate |
| T-VS-24 | Cambio stato con prodotti esistenti | Prodotti preservati |
| T-VS-25 | Cambio stato con foto esistenti | Foto preservate |
| T-VS-26 | Cambio stato con priorità esistente | Priorità preservata |
| T-VS-27 | Profilo `me` visita stand | Profilo `father` invariato |
| T-VS-28 | Cambio evento | Stati evento precedente non applicati |
| T-VS-29 | Filtro `to_visit` | Include stand senza override |
| T-VS-30 | Filtro `revisit` | Non include `visited` |
| T-VS-31 | Filtri stato + categoria | Intersezione corretta |
| T-VS-32 | Contatori dashboard | Somma = totale stand visibili |
| T-VS-33 | Tocco contatore Visitati | Lista filtrata `visited` |
| T-VS-34 | Tocco contatore Da rivedere | Lista filtrata `revisit` |
| T-VS-35 | Riapertura app | Filtri resettati |
| T-VS-36 | Rinomina stand editoriale | Stato conservato |
| T-VS-37 | Aggiunta stand al catalogo | Conteggio `to_visit` aumenta |
| T-VS-38 | Rimozione ID editoriale con stato | Nessuna perdita silenziosa |
| T-VS-39 | Stand personale altro profilo | Non visibile né modificabile nel contesto corrente |
| T-VS-40 | Eliminazione stand personale concorrente | Conflitto/gestione esplicita |
| T-VS-41 | Bozza stato non salvata | Dashboard usa confermato |
| T-VS-42 | Evento disabilitato e poi riabilitato | Stati conservati secondo retention |

---

## 18. Test di proprietà e casi limite

### 18.1 Invariante dei contatori

Per ogni insieme `S` di stand visibili e per ogni profilo/evento:

```ts
const count = (status: VisitStatus) =>
  stands.filter((stand) => effectiveStatus(stand) === status).length;

const total = count("to_visit") + count("visited") + count("revisit");

if (total !== stands.length) {
  throw new Error("Conteggi degli stati incoerenti");
}
```

Testare l'invariante con liste vuote, stand senza override, stand editoriali e personali mescolati, e modifiche locali in attesa di sincronizzazione.

### 18.2 Stato senza record

Con 100 stand e zero record di stato, la dashboard deve mostrare 100 «Da visitare», 0 «Visitati» e 0 «Da rivedere». Non mostrare 0/0/0.

### 18.3 Record orfani

Un override che punta a uno stand non più presente nel catalogo non deve far aumentare i contatori degli **stand visibili**, ma non deve essere eliminato automaticamente dal database. Gestire separatamente il riferimento storico e la migrazione.

### 18.4 Revisioni fuori ordine

Se arriva in ritardo una risposta a una sincronizzazione precedente, non deve sovrascrivere uno stato locale più recente. Il motore deve correlare risposte, operazioni e revisioni.

### 18.5 Cache offline obsoleta

Se un altro dispositivo ha cambiato uno stato mentre il primo è offline, il primo può mostrare temporaneamente la propria versione confermata. Quando sincronizza deve rilevare la divergenza e non dichiarare entrambi i dispositivi aggiornati senza risoluzione.

---

## 19. Decisioni da confermare

| Tema | Proposta | Documento che la finalizza |
|---|---|---|
| Codici tecnici | `to_visit`, `visited`, `revisit` | Questo documento + `12` |
| Stati iniziali | Assenza record = `to_visit` | Questo documento + `12` |
| Transizioni | Tutte consentite | `16-stand-management.md` |
| `revisit` nei contatori | Esclusivo, non incluso in `visited` | `15-dashboard.md` |
| Bozze nei conteggi | Escluse fino a Salva | `15`, `19` |
| Granularità revisioni | Per record o per campo | `12`, `20` |
| Stato `to_visit` esplicito | Override mantenuto | `12`, `20` |
| Cancellazione record orfani | Solo con migrazione/retention | `12`, `20` |
| Eventuali timestamp storici di visita | Non richiesti in v1 | `12`, `16` |
| Etichette/icone/colori | Testo obbligatorio, stile da definire | `14-frontend-ui.md` |
| Eventuali bulk actions | Non richieste in v1 | `16-stand-management.md` |

Queste decisioni non devono essere presentate come requisiti già approvati. Il requisito certo è l'esistenza dei tre stati e il loro carattere personale.

---

## 20. Criteri di accettazione

- [ ] I soli stati della v1 sono «Da visitare», «Visitato», «Da rivedere».
- [ ] Lo stato appartiene al profilo, evento e stand corretti.
- [ ] Uno stand senza record è considerato «Da visitare».
- [ ] Nessuno stato è scritto nel JSON condiviso degli stand.
- [ ] Uno stand personale di un altro profilo non è accessibile nel contesto corrente.
- [ ] La modifica dello stato non cambia priorità, note, foto o prodotti.
- [ ] Le bozze sono autosalvate e non sincronizzate prima di Salva.
- [ ] Salva conferma localmente anche offline e registra una sync pendente.
- [ ] Il client distingue salvataggio locale e sincronizzazione server.
- [ ] I conflitti mantengono entrambe le versioni fino a scelta manuale.
- [ ] I filtri funzionano sugli stati effettivi, inclusi gli stand senza override.
- [ ] I contatori sono mutuamente esclusivi e la loro somma coincide con il totale.
- [ ] I contatori aprono le liste filtrate corrette.
- [ ] I filtri si resettano alla riapertura dell'app.
- [ ] Le modifiche editoriali non cancellano stati personali.
- [ ] La UI è utilizzabile su smartphone, desktop, tastiera e screen reader.
- [ ] Nessun file `config/visit-statuses.json` viene creato senza necessità approvata.

---

## 21. Prossimo documento

**`docs/12-database.md`** descriverà lo schema PostgreSQL e il modello locale IndexedDB: eventi, profili, stand personali, riferimenti agli stand editoriali, interessi, stati visita, prodotti, risposte ai questionari, media, revisioni, coda operazioni e politiche di eliminazione. Dovrà mantenere le separazioni di proprietà e gli invarianti fissati nei documenti `04`–`11`.
