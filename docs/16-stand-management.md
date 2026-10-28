# 16 — Gestione degli stand

## Aggiornamento mobile — risposte A1–A9

**Contratto vigente per il web mobile da fiera:** [specifica UI mobile, risposte A1–A9](27_Specifiche_UI_Mobile.md#10-risposte-di-revisione-recepite). Questo aggiornamento prevale sui paragrafi, diagrammi, pseudocodice e casi di test precedenti incompatibili. In particolare, gli esempi con `drafts`, conferma finale «Salva», dettaglio mobile 08, foto stand o scelta manuale del conflitto descrivono la progettazione precedente e non vanno implementati nel mobile. Le parti compatibili e le funzioni desktop/post-fiera mantengono il proprio ambito.

Checklist richiesta e persistita per profilo/evento/stand con ID stabili. Note dedicate autosalvate; niente foto stand/mappe. Stella = interesse, stato visita manuale. Stand personali creabili/modificabili durante la fiera; nuovo stand personale incluso negli interessi, eliminazione bloccata con prodotti collegati. Tutti i prodotti aprono 05.


> **ExpoTrack** · Specifica funzionale e tecnica · `docs/16-stand-management.md`  
> **Stato:** proposta di progettazione v1, senza implementazione · **Fiera pilota:** EICMA 2026  
> **Dipendenze:** `03-app-config.md`, `04-profiles-config.md`, `05-pavilions-config.md`, `06-categories-config.md`, `07-stands-config.md`, `09-interests-config.md`, `11-visit-statuses-config.md`, `12-database.md`, `13-backend-api.md`, `14-frontend-ui.md`, `15-dashboard.md`  
> **Prossimo:** `17-product-management.md`

---

## 1. Scopo e confini

Definire l'esperienza completa di consultazione e gestione degli stand, dalla lista al dettaglio, dagli interessi personali alla registrazione della visita, fino agli stand creati nell'app. Questo documento descrive **cosa deve fare il sistema**, le regole dei dati, gli stati dell'interfaccia, il comportamento offline e i test. Non introduce implementazione, endpoint definitivi o file JSON operativi.

La gestione stand è il punto di incontro tra:

1. **Catalogo condiviso**: espositori e stand definiti nei JSON editoriali, uguali per tutti i profili.
2. **Interessi personali**: selezione degli stand da seguire, priorità da 1 a 10 e lista `whatToSee`, specifici per profilo ed evento.
3. **Attività personali**: stato di visita, note, fotografie e prodotti osservati, sempre nel contesto del profilo attivo.
4. **Stand personali**: record creati direttamente nell'app, privati del profilo creatore.

**Non sono previsti mappe, percorsi o itinerari all'interno dell'app.** Padiglione e posizione stand sono dati informativi e filtri, non un sistema di navigazione.

### 1.1 Principi irrinunciabili

- Un catalogo editoriale può contenere più stand di quanti l'utente voglia visitare.
- **Essere nel catalogo non equivale a essere tra gli interessi.**
- Il profilo `me` e il profilo `father` possono attribuire priorità, obiettivi e stati diversi allo stesso stand.
- Uno stand editoriale non può essere eliminato dall'interfaccia; si può togliere dagli interessi del profilo.
- Uno stand personale è visibile soltanto al profilo proprietario e può essere modificato o eliminato, con conferma e protezione dei dati collegati.
- Il valore `to_visit` è lo stato effettivo predefinito quando non esiste uno stato salvato; ciò **non** aggiunge automaticamente lo stand agli interessi.
- L'assenza di connessione non deve impedire le modifiche dopo il bootstrap offline.
- Salvataggio mobile automatico locale e outbox per valori validi, senza modalità bozza o conferma Salva finale; input invalidi conservati localmente secondo §5.1 del documento 27.
- Non inventare padiglioni, numeri stand o collocazioni EICMA 2026.

---

## 2. Terminologia e modello concettuale

| Termine | Significato |
|---|---|
| Catalogo | Insieme degli stand editoriali della fiera corrente |
| Stand editoriale | Stand identificato nel JSON `config/events/<eventId>-stands.json` |
| Stand personale | Stand aggiunto da un profilo, salvato come record dinamico |
| Interesse | Associazione personale profilo/evento/stand che lo rende un obiettivo di visita |
| Priorità | Valore personale intero 1–10, facoltativo se non ancora assegnato |
| `whatToSee` | Elenco personale di cose da guardare, chiedere o provare allo stand |
| Stato di visita | `to_visit`, `visited`, `revisit` |
| Note stand | Testo libero personale riferito allo stand |
| Foto stand | Immagini personali riferite allo stand, distinte da quelle dei prodotti |
| Prodotto | Elemento osservato e registrato all'interno di uno stand |
| Snapshot editoriale | Versione coerente e validata dei JSON della fiera |
| Bozza | Modifica locale non ancora confermata dall'utente |
| Record confermato | Modifica salvata localmente, anche se non ancora sincronizzata |

### 2.1 Identità dello stand

Uno stand va sempre identificato mediante **evento + origine + ID**. L'ID da solo non è sufficiente: lo stesso identificativo editoriale potrebbe esistere in due eventi, mentre uno stand personale può avere un identificativo di formato diverso.

```ts
type StandSource = 'catalog' | 'personal';

type StandRef = {
  eventId: string;
  source: StandSource;
  standId: string;
};

// La chiave personale include anche il profilo:
type ProfileStandKey = StandRef & {
  profileId: string;
};
```

**Regola:** non usare il nome dello stand come chiave. Le denominazioni possono cambiare senza invalidare note, interessi e prodotti.

---

## 3. Fonti dei dati e precedenza

### 3.1 Catalogo editoriale

Lo schema è definito in `07-stands-config.md`. Per ogni stand editoriale sono disponibili:

- `id`: identificativo stabile;
- `name`: nome obbligatorio;
- `description?`: descrizione facoltativa;
- `hall?`: riferimento a padiglione validato;
- `booth?`: posizione/numero stand facoltativo;
- `categories`: zero o più categorie globali.

L'evento è implicito nel file indicato da `app.json`. I campi personali **non** appartengono al catalogo.

### 3.2 Interessi iniziali

I file `config/interests/me.json` e `config/interests/father.json` definiscono i seed degli interessi per profilo. I profili creati nell'app non hanno necessariamente un file di seed. Gli interessi possono poi essere aggiunti o modificati nell'interfaccia.

### 3.3 Dati dinamici

PostgreSQL e IndexedDB conservano stand personali, override degli interessi, stati visita, note, foto e prodotti. Le informazioni dinamiche non devono essere scritte nei JSON editoriali.

### 3.4 Regola di composizione

La scheda mostrata all'utente è una **vista composta**:

```text
StandView =
  CatalogStand OR PersonalStand
  + InterestMembership(profileId, eventId, standRef)
  + EffectivePriority(profileId, eventId, standRef)
  + EffectiveWhatToSee(profileId, eventId, standRef)
  + EffectiveVisitStatus(profileId, eventId, standRef)
  + StandNotesAndPhotos(profileId, eventId, standRef)
  + ProductsSummary(profileId, eventId, standRef)
```

I campi editoriali provengono dalla configurazione; i campi personali dal seed più gli override runtime. La rimozione volontaria di una priorità o di una lista non deve essere annullata dal successivo aggiornamento dei seed.

---

## 4. Perimetro per evento e profilo

Ogni operazione avviene nel contesto di un evento selezionato e di un profilo attivo. Il profilo è selezionato all'apertura e ricordato sul dispositivo; non esiste login interno nella v1.

**Non considerare la selezione del profilo una misura di autenticazione.** Chi può accedere all'app può selezionare un altro profilo. La protezione dell'accesso esterno va affrontata nel documento `25-security.md`.

### 4.1 Cambio profilo

Quando l'utente cambia profilo:

1. Se esiste una bozza non confermata, mostrare un avviso e conservarla nel perimetro originale.
2. Aggiornare il profilo attivo e l'intestazione.
3. Invalidare le query personali precedenti.
4. Ricaricare interessi, priorità, stati, note, foto e prodotti del nuovo profilo.
5. Conservare gli stessi dati editoriali condivisi.
6. Reimpostare i filtri temporanei della lista.

Non mostrare per errore fotografie o note del profilo precedente durante la transizione.

### 4.2 Cambio evento

Il cambio evento applica la stessa separazione logica, includendo `eventId` in ogni chiave. Una bozza EICMA non deve comparire nella scheda di un altro evento.

---

## 5. Navigazione e pagine

### 5.1 Voci principali

La barra inferiore mobile rimane: **Dashboard · Stand · Prodotti · Profilo**. La sezione Stand include:

- lista di tutti gli stand visibili;
- filtro rapido per **I miei interessi**;
- dettaglio stand;
- creazione di stand personale;
- modifica stand personale;
- gestione di priorità, obiettivi, stato, note e foto.

Su desktop le stesse funzioni possono essere esposte con sidebar e layout più ampio, mantenendo semantica e comportamento coerenti.

### 5.2 Apertura da Dashboard

Le statistiche «Da visitare», «Visitati» e «Da rivedere» aprono la lista stand con un filtro contestuale già impostato e, quando appropriato, il perimetro degli interessi. Questo è un **filtro di navigazione esplicito**, non un filtro persistente globale.

### 5.3 Ripristino filtri

Alla riapertura ordinaria della sezione Stand, filtri e ordinamento temporanei tornano ai valori iniziali. Se l'utente apre un collegamento filtrato dalla Dashboard, prevalgono i filtri richiesti dal collegamento per quella navigazione.

---

## 6. Lista stand: contenuto delle card

Ogni card deve rendere immediatamente riconoscibili:

- nome dello stand;
- padiglione e numero stand **solo se noti e verificati**;
- categorie associate, eventualmente riassunte;
- indicazione di interesse personale;
- priorità personale, se assegnata;
- stato di visita effettivo;
- eventuale numero di prodotti registrati per il profilo;
- eventuale indicatore di salvataggio locale/sync pendente, se pertinente.

### 6.1 Informazioni assenti

- `hall` assente: visualizzare «Padiglione non indicato» o omettere il dato, secondo il design.
- `booth` assente: non inventare codici o posizioni.
- priorità assente: visualizzare «Senza priorità», **non** `0`.
- descrizione assente: nessun testo fittizio.
- nessun prodotto: conteggio `0` o badge omesso.

### 6.2 Distinzione editoriale/personale

Una card di stand personale può mostrare una piccola etichetta «Aggiunto da te» o equivalente. L'etichetta non deve far sembrare lo stand verificato ufficialmente dalla fiera.

### 6.3 Interazioni

- Toccare la card apre il dettaglio.
- Un controllo esplicito può aggiungere/rimuovere l'interesse, con feedback chiaro.
- Le azioni distruttive non devono essere attivate da un tocco accidentale sulla card.
- Le aree touch devono essere sufficientemente ampie.

---

## 7. Ricerca, filtri e ordinamento

### 7.1 Ricerca testuale

Ricerca per **nome stand**, ignorando maiuscole/minuscole e spazi iniziali/finali. L'estensione a descrizione, prodotti o altri campi è una scelta futura, non un requisito confermato.

### 7.2 Filtri

| Filtro | Valori | Semantica |
|---|---|---|
| Interesse | Tutti / I miei interessi / Non selezionati | Membership personale |
| Categoria | Categoria o sottocategoria | Match sulle categorie dello stand |
| Padiglione | Uno o più padiglioni noti | Solo stand con padiglione corrispondente |
| Priorità | Intervallo 1–10, eventuale «Senza priorità» | Valore effettivo personale |
| Stato | Da visitare / Visitato / Da rivedere | Stato effettivo personale |
| Origine | Tutti / Editoriali / Personali | Origine record |

L'eventuale filtro «Padiglione non indicato» è utile, ma va deciso a livello UI. Non attribuire padiglioni mancanti a una categoria artificiale del catalogo.

### 7.3 Filtri combinati

I filtri attivi sono combinati con **AND**; all'interno di un filtro multi-selezione, i valori possono essere combinati con **OR**. Documentare questa convenzione in UI.

Esempio: «I miei interessi» AND «Categoria Naked» AND «Da visitare».

### 7.4 Categorie annidate

Quando si seleziona una categoria padre, la proposta coerente con `06-categories-config.md` è includere le sottocategorie discendenti. Per gli stand con più categorie è sufficiente che **almeno una** corrisponda al filtro.

### 7.5 Ordinamento

Consentire almeno:

- priorità crescente/decrescente;
- nome A–Z / Z–A;
- padiglione crescente/decrescente.

**Default proposto:** priorità decrescente tra gli interessi, con gli stand senza priorità in fondo e spareggio alfabetico. Nella vista catalogo completa, può essere più naturale l'ordine alfabetico; questa differenza va confermata in fase UI.

La posizione degli stand senza padiglione nell'ordinamento deve essere stabile e documentata, preferibilmente alla fine in entrambe le direzioni.

### 7.6 Stato vuoto

Distinguere:

- catalogo non ancora disponibile offline;
- nessuno stand nell'evento;
- nessun interesse selezionato;
- nessun risultato per i filtri correnti.

Per il quarto caso, proporre **Azzera filtri**. Non mostrare «nessuno stand disponibile» se il problema è soltanto un filtro troppo restrittivo.

---

## 8. Appartenenza agli interessi

### 8.1 Due insiemi distinti

```text
VisibleCatalog(eventId, profileId) =
  EditorialStands(eventId) ∪ OwnPersonalStands(profileId, eventId)

TrackedStands(eventId, profileId) =
  SeedInterests(profileId, eventId)
  applicati insieme agli override personali
  ∪ StandPersonaliTracciati(profileId, eventId)
  ∪ StandAggiuntiEsplicitamenteAgliInteressi(profileId, eventId)
```

**Non** usare `VisibleCatalog` come base indiscriminata dei contatori «Da visitare» della Dashboard. Per il conteggio degli obiettivi di visita usare `TrackedStands`, in coerenza con `15-dashboard.md`.

### 8.2 Aggiungere un interesse

Da una scheda editoriale non selezionata, l'utente può scegliere «Aggiungi ai miei interessi». Il record diventa tracciato, con stato effettivo `to_visit` e priorità facoltativa.

### 8.3 Rimuovere un interesse

La rimozione di un interesse **non deve cancellare** note, foto, prodotti o stato visita. Occorre una semantica esplicita di esclusione dal set tracciato, anche quando lo stand era nel seed JSON, per impedire che ricompaia dopo un aggiornamento della configurazione.

**Proposta:** un override di membership con valori `inherit | included | excluded`, più tombstone/operazione versionata. Se il documento `09-interests-config.md` definisce già un altro meccanismo, mantenerne la semantica ed evitare duplicazioni di campi concorrenti.

### 8.4 Stand personale e tracciamento

**Default proposto:** uno stand personale appena creato entra automaticamente negli interessi del profilo creatore. È una scelta da confermare prima dell'implementazione; in ogni caso, non entra negli interessi degli altri profili.

### 8.5 Note su stand non tracciati

È possibile consultare uno stand editoriale senza aggiungerlo agli interessi. Se l'utente inizia a registrare note, stato o prodotti su uno stand non tracciato, l'app deve rendere chiaro se ciò lo aggiunga automaticamente agli interessi.

**Raccomandazione:** chiedere esplicitamente o aggiungere agli interessi contestualmente al primo Salva, mostrando una conferma chiara. Evitare una conversione silenziosa che alteri i contatori.

---

## 9. Priorità personale

### 9.1 Dominio

- Intero da **1 a 10**.
- `10` indica la priorità massima.
- Il valore è indipendente dal voto dei prodotti.
- La priorità può essere assente per uno stand non ancora classificato.

### 9.2 Interazione

Nella scheda stand prevedere un selettore accessibile 1–10, con la possibilità di rimuovere volontariamente la priorità. La cancellazione volontaria è diversa dall'assenza di override.

### 9.3 Modifica

La modifica entra nella bozza locale e viene confermata con Salva. Una modifica da un dispositivo offline deve comparire localmente subito dopo il salvataggio e sincronizzarsi successivamente.

### 9.4 Validazione

Rifiutare numeri frazionari, stringhe non numeriche, valori sotto 1 o sopra 10. Non trasformare `null` in `0`.

---

## 10. Cose da vedere: `whatToSee`

### 10.1 Significato

È una lista personale di obiettivi riferiti allo stand, per esempio:

```json
{
  "whatToSee": [
    "Salire in sella sul modello che mi interessa",
    "Chiedere informazioni sulla disponibilità",
    "Valutare la posizione di guida"
  ]
}
```

L'esempio è illustrativo, non un record di configurazione EICMA ufficiale.

### 10.2 Funzioni

- Visualizzare gli obiettivi in ordine.
- Aggiungere una voce.
- Modificare una voce.
- Rimuovere una voce.
- Eventualmente riordinare le voci, se l'interfaccia lo prevede.
- Salvare anche una lista vuota.

### 10.3 Validazione

Ogni voce deve essere una stringa non vuota dopo `trim`. Non creare automaticamente una domanda di questionario a partire da un obiettivo.

### 10.4 Checklist richiesta

La lista «Cose da vedere» è una checklist personale per profilo/evento/stand. Ogni voce ha ID stabile, testo e booleano completato. Le stringhe del JSON restano seed editoriali; assegnare ID stabili nella normalizzazione dello snapshot e conservare override e spunte attraverso gli aggiornamenti, senza riusare il solo indice come identità. Aggiunta, modifica, rimozione e tap sulla spunta salvano automaticamente. Non cambiano stato visita. Contatore calcolato dai dati effettivi, non dai numeri dimostrativi del mockup.

## 11. Stato di visita

### 11.1 Stati supportati

| Codice | Etichetta | Interpretazione |
|---|---|---|
| `to_visit` | Da visitare | Obiettivo non ancora concluso |
| `visited` | Visitato | Stand visitato |
| `revisit` | Da rivedere | Utente desidera tornare allo stand |

### 11.2 Stato effettivo

```ts
type VisitStatus = 'to_visit' | 'visited' | 'revisit';

function effectiveStatus(saved?: VisitStatus): VisitStatus {
  return saved ?? 'to_visit';
}
```

La funzione non stabilisce l'appartenenza agli interessi. Uno stand non tracciato può avere uno stato effettivo `to_visit`, ma non va necessariamente contato tra gli obiettivi della Dashboard.

### 11.3 Modifica

L'utente può selezionare uno qualunque dei tre stati. Non imporre un ordine obbligato delle transizioni: può segnare direttamente «Da rivedere» dopo una visita o correggere uno stato errato.

### 11.4 Effetti collaterali vietati

Cambiare stato non deve:

- modificare priorità o `whatToSee`;
- cancellare note e foto;
- alterare i prodotti;
- cambiare lo stato degli altri profili;
- modificare il catalogo editoriale.

### 11.5 Persistenza

Stato modificato in bozza → Salva locale → outbox → sincronizzazione. Gli aggiornamenti concorrenti su dispositivi diversi seguono la gestione manuale dei conflitti.

---

## 12. Note personali dello stand

### 12.1 Caratteristiche

- Testo libero, facoltativo, modificabile.
- Associato a `profileId`, `eventId` e `StandRef`.
- Distinto dalle note dei singoli prodotti.
- Salvataggio mobile automatico locale e outbox per valori validi, senza modalità bozza o conferma Salva finale; input invalidi conservati localmente secondo §5.1 del documento 27.

### 12.2 UI

Textarea leggibile su smartphone, con spazio adeguato e indicazione di salvataggio. Non cancellare il testo quando si cambia temporaneamente scheda senza aver salvato: conservare la bozza.

### 12.3 Sicurezza

Trattare il testo come **dato non fidato**: non renderizzare HTML arbitrario e non interpretare script inseriti nelle note.

### 12.4 Esportazione

Le note stand sono dati personali esportabili nel JSON del profilo e, quando previsto dal formato scelto, nel PDF. Il dettaglio della struttura export appartiene a `23-export.md`.

---

## 13. Note stand e fotografie

Note stand in vista dedicata 04a: campo unico facoltativo, autosalvataggio locale poi server, senza limite funzionale di caratteri né cronologia. Non confondere con description del prodotto. Nessuna fotografia stand come entità autonoma nel mobile; rimuovere la CTA Foto. Le sole foto raccolte appartengono ai prodotti e usano 06. Mappe e indicazioni escluse.

## 14. Prodotti collegati allo stand

La scheda stand mostra i prodotti registrati dal **profilo attivo** presso quello stand.

### 14.1 Riepilogo

- numero prodotti;
- nome prodotto;
- categoria/sottocategoria;
- prezzo, se presente;
- voto, se presente;
- indicazione preferito;
- miniatura, se disponibile.

### 14.2 Creazione dal dettaglio

Il comando «Aggiungi prodotto» apre il modulo prodotto con riferimento stand già impostato. Il prodotto richiede **una categoria scelta manualmente**, che diventa immutabile dopo il primo Salva, anche offline.

### 14.3 Separazione dati

Il voto del prodotto non è la priorità dello stand. Le foto prodotto non sono foto stand. Le risposte ai questionari appartengono al prodotto e alla sua categoria, non allo stand.

### 14.4 Eliminazione stand personale

Non cancellare implicitamente prodotti collegati. La proposta v1 è **impedire l'eliminazione dello stand personale finché ha prodotti attivi**, mostrando il numero di record da gestire. L'eventuale riassegnazione dei prodotti è una decisione aperta.

**Specifiche approfondite:** `17-product-management.md`.

---

## 15. Creazione di uno stand personale

### 15.1 Motivazione

Permettere di registrare uno stand non presente nel catalogo editoriale, senza modificare il JSON condiviso.

### 15.2 Campi

| Campo | Obbligatorio | Regola |
|---|---|---|
| Nome | Sì | Stringa non vuota dopo trim |
| Descrizione | No | Testo libero |
| Padiglione | No | Solo ID padiglione esistente per l'evento |
| Numero stand | No | Testo libero; non inventato dall'app |
| Categorie | No | Zero o più categorie esistenti |
| Profilo proprietario | Automatico | Profilo attivo, non modificabile |
| Evento | Automatico | Evento corrente, non modificabile |
| ID | Automatico | UUID generato anche offline |

### 15.3 Flusso

1. L'utente apre la sezione Stand.
2. Seleziona «Aggiungi stand».
3. Inserisce almeno il nome; gli altri campi sono facoltativi.
4. Le modifiche sono autosalvate come bozza locale.
5. Premendo Salva, il record viene validato.
6. IndexedDB salva lo stand e l'operazione outbox atomicamente.
7. Lo stand compare subito nella lista del profilo.
8. La sincronizzazione avviene quando disponibile.

### 15.4 Provenienza

Uno stand creato nell'app **non diventa uno stand ufficiale del catalogo** e non compare automaticamente agli altri profili.

### 15.5 Duplicati

È possibile che il nome corrisponda a uno stand editoriale o personale esistente. Mostrare un avviso non bloccante con eventuali corrispondenze; non fondere automaticamente record distinti.

---

## 16. Modifica dello stand personale

### 16.1 Campi modificabili

Nome, descrizione, padiglione, numero stand e categorie. Le informazioni personali (priorità, stato, note, obiettivi) si modificano nei rispettivi moduli.

### 16.2 Campi immutabili

ID, profilo proprietario ed evento di origine. Cambiare proprietario richiederebbe un'operazione di trasferimento esplicita, non prevista nella v1.

### 16.3 Modifica offline

Ogni modifica entra in bozza e, dopo Salva, aggiorna il record locale con una mutazione versionata. Se il server possiede una versione più recente, aprire un conflitto da risolvere manualmente.

### 16.4 Modifica dello stand editoriale

**Vietata dalla UI.** Eventuali correzioni a nome, categorie, padiglione o numero stand editoriale si fanno nei JSON e vengono pubblicate tramite il processo editoriale.

---

## 17. Eliminazione dello stand personale

### 17.1 Requisiti

- Azione disponibile solo per stand personali del profilo attivo.
- Conferma esplicita; per operazioni con dati collegati usare una conferma rafforzata.
- Eliminazione logica/tombstone per propagare la cancellazione ai dispositivi offline.
- Nessuna eliminazione automatica di note, foto o prodotti senza regola definita.

### 17.2 Politica conservativa proposta

Se lo stand possiede prodotti o fotografie, **bloccare l'eliminazione** e spiegare cosa deve essere gestito prima. Per note e stato visita, decidere se archiviare o cancellare insieme allo stand dopo conferma, senza lasciare riferimenti orfani.

### 17.3 Eliminazione in coda

Uno stand creato e poi eliminato offline prima del primo sync richiede un trattamento coerente delle operazioni: si può compattare la coda **solo se** nessun altro record dipende dallo stand e senza perdere eventi necessari alla consistenza. Non cancellare ciecamente la prima operazione.

### 17.4 Stand editoriale

Non mostrare «Elimina stand». Offrire invece «Rimuovi dai miei interessi», preservando i dati personali già raccolti.

---

## 18. Schermata dettaglio: composizione proposta

### 18.1 Intestazione

- Nome dello stand.
- Indicazione editoriale/personale.
- Padiglione e numero stand, se disponibili.
- Categorie.
- Pulsante interesse personale.

### 18.2 Sezione «La mia visita»

- Priorità 1–10 o «Senza priorità».
- Stato di visita.
- Cose da vedere.
- Note personali.
- Fotografie stand.

### 18.3 Sezione «Prodotti»

- Lista prodotti personali registrati presso lo stand.
- Pulsante «Aggiungi prodotto».

### 18.4 Azioni

- **Salva** per le modifiche alla scheda personale.
- **Annulla modifiche** con gestione della bozza.
- **Modifica stand** soltanto per stand personali.
- **Elimina stand** soltanto per stand personali e dopo conferma.

### 18.5 Stato della sincronizzazione

Mostrare una distinzione comprensibile tra:

1. «Modifiche non salvate» (bozza);
2. «Salvato sul dispositivo, da sincronizzare»;
3. «Sincronizzato»;
4. «Errore di sincronizzazione»;
5. «Conflitto da risolvere».

Non confondere un indicatore di rete «online» con la prova che tutti i dati siano sincronizzati.

---

## 19. Salvataggio automatico degli stand

Ogni modifica intenzionale viene persistita automaticamente sul dispositivo. Per dati validi, record e mutazione outbox sono scritti nella stessa transazione; la rete interviene dopo. Non esistono store o modalità bozza né conferma Salva finale. Nome, stand e categoria restano obbligatori per la prima registrazione prodotto: i valori iniziali incompleti sono recuperabili nello stesso record locale, senza essere contati o inviati come prodotto valido. Categoria e stand si bloccano alla prima registrazione locale valida. Un input successivamente invalido resta recuperabile senza sostituire l’ultima versione valida sincronizzabile. Vedere [§5.1 della specifica mobile](27_Specifiche_UI_Mobile.md#51-salvataggio-automatico-validazione-e-recupero).

Dichiarare «Salvato sul dispositivo» solo dopo commit riuscito; errori quota o transazione mantengono l’input e non producono falso successo. Prima di cambio vista/profilo completare la persistenza, senza dialogo di conferma per modifiche già autosalvate. «Fine»/indietro non annullano scritture effettuate.

Per lo stand personale il dato minimo è il nome; categorie, padiglione e posizione sono facoltativi. Nuovo stand personale: interesse attivo e stato to_visit; elenco e note sempre filtrati per proprietario/evento. Eliminazione bloccata con prodotti collegati, senza cascade implicita.

## 20. Sincronizzazione e concorrenza

### 20.1 Identità dell'operazione

Ogni mutazione confermata genera un `operationId` idempotente, `profileId`, `eventId`, riferimento stand e revisione base.

### 20.2 Dipendenze

Se un prodotto fa riferimento a uno stand personale creato offline, l'operazione di creazione dello stand deve essere sincronizzata prima della creazione del prodotto, oppure il backend deve gestire un batch atomico esplicito. Evitare riferimenti orfani.

### 20.3 Conflitti

Esempi:

- due dispositivi modificano la priorità dello stesso stand per lo stesso profilo;
- uno cambia lo stato visita e l'altro modifica note;
- uno elimina uno stand personale e l'altro aggiunge una foto;
- un aggiornamento del seed modifica la lista mentre l'utente ha un override personale.

Non usare `updatedAt` per scegliere automaticamente il vincitore. Mostrare entrambe le versioni e richiedere risoluzione manuale quando si verifica un conflitto effettivo.

### 20.4 Granularità

Se priorità, stato e note sono record separati, modifiche indipendenti possono sincronizzarsi senza conflitto. Se sono un unico documento versionato, modifiche a campi diversi potrebbero produrre conflitti più frequenti. La struttura dati deve essere coerente con `12-database.md` e `20-synchronization.md`.

### 20.5 Aggiornamento catalogo

Un aggiornamento JSON che rinomina uno stand non deve cancellare i dati personali. Se un ID viene rimosso, bloccare la pubblicazione o predisporre una migrazione esplicita; non riassegnare automaticamente prodotti a uno stand dal nome simile.

---

## 21. Prestazioni e comportamento offline

### 21.1 Bootstrap

Il catalogo deve essere disponibile offline **dopo un primo caricamento valido**. Non promettere che un'installazione mai aperta online possa mostrare dati non ancora scaricati.

### 21.2 Ricerca locale

Per un numero contenuto di stand, ricerca, filtri e ordinamento possono essere calcolati localmente. Ottimizzare evitando ricalcoli non necessari e mantenendo stabile lo scorrimento su smartphone.

### 21.3 Foto

Le foto salvate localmente devono restare accessibili senza rete. Gestire i limiti di spazio del browser e mostrare chiaramente errori di quota.

### 21.4 Stati di rete

- Offline: lettura e salvataggio locale disponibili.
- Online ma API irraggiungibile: salvare localmente e mantenere operazioni pendenti.
- API disponibile: sincronizzazione automatica, con controllo manuale.
- App chiusa: **non garantire** la sincronizzazione in background.

---

## 22. Accessibilità e usabilità mobile

- Etichette esplicite per priorità e stato.
- Indicatori non basati soltanto sul colore.
- Supporto tastiera e screen reader.
- Focus visibile.
- Controlli touch di dimensione adeguata.
- Messaggi di errore vicino ai campi.
- Conferme per operazioni distruttive.
- Fotografie con descrizioni/etichette accessibili quando possibile.
- Nessuna perdita di dati per cambio orientamento o riapertura della PWA.
- Evitare modali troppo lunghi o moduli che coprano completamente la navigazione su schermi piccoli.

---

## 23. Esempi TypeScript di vista composta

I seguenti tipi sono **illustrativi**; vanno armonizzati con gli schemi definitivi dei documenti JSON e database.

```ts
type VisitStatus = 'to_visit' | 'visited' | 'revisit';

type StandSummary = {
  ref: StandRef;
  name: string;
  description?: string;
  hallId?: string;
  booth?: string;
  categoryIds: string[];
  isPersonal: boolean;
};

type StandPersonalView = {
  profileId: string;
  isTracked: boolean;
  priority: number | null;
  whatToSee: string[];
  visitStatus: VisitStatus;
  notes: string;
  photoCount: number;
  productCount: number;
};

type StandListItem = StandSummary & {
  personal: StandPersonalView;
};

type StandFilters = {
  search: string;
  tracked: 'all' | 'tracked' | 'untracked';
  categoryIds: string[];
  hallIds: string[];
  statuses: VisitStatus[];
  minPriority?: number;
  maxPriority?: number;
  source: 'all' | 'catalog' | 'personal';
  sortBy: 'priority' | 'name' | 'hall';
  sortDirection: 'asc' | 'desc';
};
```

### 23.1 Invarianti

```ts
function isValidPriority(value: unknown): value is number {
  return Number.isInteger(value) &&
    typeof value === 'number' &&
    value >= 1 && value <= 10;
}

function isValidWhatToSee(items: unknown): items is string[] {
  return Array.isArray(items) &&
    items.every((item) =>
      typeof item === 'string' && item.trim().length > 0
    );
}
```

### 23.2 Conteggio degli interessi

```ts
function countTrackedByStatus(
  stands: StandListItem[],
  status: VisitStatus
): number {
  return stands.filter(
    (stand) => stand.personal.isTracked &&
      stand.personal.visitStatus === status
  ).length;
}
```

Il codice è dimostrativo e presuppone una lista senza duplicati per chiave stand. Non va usato come implementazione finale senza test su membership e seed/override.

---

## 24. Contratti applicativi: comandi e query

| Operazione logica | Input principale | Risultato |
|---|---|---|
| `listStands` | Evento, profilo, filtri | Vista composta e paginata/locale |
| `getStandDetail` | StandRef, profilo | Dettaglio editoriale + personale |
| `addInterest` | StandRef, profilo | Membership inclusa |
| `removeInterest` | StandRef, profilo | Membership esclusa senza perdita dati |
| `saveStandVisit` | Stato, priorità, obiettivi, note | Commit locale e outbox |
| `createPersonalStand` | Nome e campi facoltativi | UUID, record personale |
| `updatePersonalStand` | ID e campi modificabili | Revisione aggiornata |
| `deletePersonalStand` | ID, conferma | Tombstone o blocco motivato |
| `addStandPhoto` | StandRef, media | Foto locale + upload pendente |
| `removeStandPhoto` | ID foto, conferma | Tombstone foto |
| `listStandProducts` | StandRef, profilo | Prodotti del profilo |

Le route HTTP, i codici di stato e i payload definitivi devono essere coerenti con `13-backend-api.md`. La UI deve usare gli stessi servizi di dominio online e offline, non duplicare la validazione in modo incoerente.

---

## 25. Errori e messaggi suggeriti

| Caso | Comportamento UI |
|---|---|
| Stand non trovato | Mostrare messaggio, consentire ritorno alla lista |
| Evento sconosciuto | Bloccare modifica, chiedere aggiornamento configurazione |
| Categoria/padiglione non valido | Evidenziare il campo e non confermare |
| Nome stand personale vuoto | Richiedere un nome |
| Priorità fuori 1–10 | Mostrare errore di validazione |
| Stand editoriale modificato dalla UI | Operazione non disponibile |
| Stand personale di altro profilo | Non mostrare e rifiutare la scrittura |
| Eliminazione con prodotti | Bloccare e spiegare le dipendenze |
| Quota IndexedDB esaurita | Non mostrare «Salvato»; conservare quanto possibile |
| Rete assente | Confermare localmente e indicare sync pendente |
| Upload foto fallito | Mantenere foto locale e permettere retry |
| Conflitto di revisione | Mostrare confronto e scelta manuale |
| JSON editoriale aggiornato | Ricaricare snapshot senza perdere dati personali |
| Seed ripubblicato | Conservare esclusioni e cancellazioni volontarie |

Non mostrare dettagli SQL, percorsi di storage o stack trace all'utente finale.

---

## 26. Scenari di test funzionali

| ID | Scenario | Esito atteso |
|---|---|---|
| ST-01 | Apertura lista | Catalogo e stand personali visibili nel perimetro corretto |
| ST-02 | Stand editoriale senza padiglione | Nessuna posizione inventata |
| ST-03 | Stand editoriale senza booth | Nessun codice fittizio |
| ST-04 | Ricerca nome maiuscolo/minuscolo | Risultati equivalenti |
| ST-05 | Ricerca con spazi esterni | Trim applicato |
| ST-06 | Filtro categoria padre | Include sottocategorie, secondo regola adottata |
| ST-07 | Stand con più categorie | Match se almeno una corrisponde |
| ST-08 | Filtro padiglione | Solo stand corrispondenti |
| ST-09 | Filtro priorità | Range 1–10 rispettato |
| ST-10 | Filtro stato | Stato effettivo corretto |
| ST-11 | Filtri combinati | Intersezione corretta |
| ST-12 | Ordinamento nome asc/desc | Ordine corretto |
| ST-13 | Ordinamento priorità asc/desc | Ordine corretto |
| ST-14 | Ordinamento padiglione asc/desc | Ordine stabile |
| ST-15 | Stand senza priorità | Nessun `0` fittizio |
| ST-16 | Nessun risultato | Stato vuoto e azzera filtri |
| ST-17 | Riapertura lista ordinaria | Filtri e ordinamento resettati |
| ST-18 | Apertura da dashboard | Filtro contestuale applicato |
| ST-19 | Catalogo ampio, pochi interessi | Dashboard conta solo tracciati |
| ST-20 | Aggiunta interesse editoriale | Appare nei tracciati del profilo |
| ST-21 | Rimozione interesse seed | Non riappare dopo refresh JSON |
| ST-22 | Rimozione interesse con note | Note preservate |
| ST-23 | Rimozione interesse con prodotti | Prodotti preservati |
| ST-24 | Interesse profilo me | Non modifica father |
| ST-25 | Priorità 1 e 10 | Accettate |
| ST-26 | Priorità 0, 11, frazionaria | Rifiutate |
| ST-27 | Priorità cancellata volontariamente | Non ripristinata dal seed |
| ST-28 | whatToSee aggiunta/modifica | Salvata correttamente |
| ST-29 | whatToSee vuota | Accettata come scelta esplicita |
| ST-30 | whatToSee con stringa vuota | Rifiutata o normalizzata prima del Salva |
| ST-31 | Cambio `to_visit` → `visited` | Stato aggiornato |
| ST-32 | Cambio `visited` → `revisit` | Stato aggiornato |
| ST-33 | Cambio `revisit` → `to_visit` | Stato aggiornato |
| ST-34 | Nessuno stato persistito | `to_visit` effettivo |
| ST-35 | Modifica stato | Prodotti, foto e priorità invariati |
| ST-36 | Note stand | Non alterano note prodotto |
| ST-37 | Foto stand offline | Disponibile dopo salvataggio locale |
| ST-38 | Foto stand di me | Non appare a father |
| ST-39 | Nuovo stand personale offline | Creato con UUID locale |
| ST-40 | Stand personale senza nome | Salva rifiutato |
| ST-41 | Stand personale con nome duplicato | Avviso, nessuna fusione automatica |
| ST-42 | Stand personale modificato | Aggiornamento solo del proprietario |
| ST-43 | Tentativo modifica stand editoriale | Azione assente/rifiutata |
| ST-44 | Tentativo eliminazione stand editoriale | Azione assente/rifiutata |
| ST-45 | Eliminazione stand personale con prodotti | Blocco e messaggio |
| ST-46 | Eliminazione stand personale senza dipendenze | Tombstone e sync |
| ST-47 | Cambio profilo con bozza | Bozza conservata nel profilo originale |
| ST-48 | Salva offline | Record e outbox atomici |
| ST-49 | Fallimento salvataggio locale | Nessun falso successo |
| ST-50 | Retry operazione | Nessun duplicato server |
| ST-51 | Due dispositivi stesso profilo | Conflitto manuale |
| ST-52 | Due profili diversi | Nessun conflitto incrociato |
| ST-53 | Rinomina editoriale | Dati personali collegati all'ID |
| ST-54 | Rimozione ID editoriale referenziato | Migrazione/errore esplicito |
| ST-55 | Prodotto creato da stand personale offline | Dipendenza sync rispettata |
| ST-56 | App offline dopo bootstrap | Lista e dettagli disponibili |
| ST-57 | Primo avvio senza snapshot offline | Messaggio esplicito |
| ST-58 | Browser chiuso con outbox | Sync riprende alla riapertura |
| ST-59 | Navigazione da tastiera | Azioni accessibili |
| ST-60 | Indicatori colore | Stato comprensibile anche senza colore |

---

## 27. Test di integrazione e qualità

### 27.1 Integrazione con Dashboard

- I contatori cambiano dopo Salva locale, senza aspettare il server.
- La rimozione dagli interessi aggiorna i conteggi senza cancellare i dati.
- Le statistiche sono isolate per profilo/evento.
- Un collegamento dalla Dashboard porta alla lista con filtro corretto.

### 27.2 Integrazione con prodotti

- I prodotti registrati sono visibili nel dettaglio dello stand corretto.
- Lo stesso stand editoriale mostra prodotti diversi per `me` e `father`.
- La categoria del prodotto è scelta esplicitamente e non modificabile dopo il primo Salva.
- Il numero prodotti esclude i record eliminati.

### 27.3 Integrazione con configurazione

- Padiglioni e categorie devono esistere nel catalogo dell'evento.
- Il cambio nome dello stand editoriale non rompe le referenze.
- Il sistema non attribuisce posizioni non confermate.
- Le priorità iniziali sono sostituite dagli override dove previsti.

### 27.4 Integrazione con sincronizzazione

- Salvataggio mobile automatico locale e outbox per valori validi, senza modalità bozza o conferma Salva finale; input invalidi conservati localmente secondo §5.1 del documento 27.
- Un errore di rete non elimina la coda.
- L'operazione duplicata è idempotente.
- Un conflitto mantiene le due versioni.
- Una tombstone evita la resurrezione di stand eliminati.

---

## 28. Criteri di accettazione

- [ ] Lista stand consultabile per evento e profilo.
- [ ] Catalogo editoriale condiviso, senza dati personali incorporati.
- [ ] Stand personali visibili solo al profilo creatore.
- [ ] Ricerca per nome e filtri per categoria, padiglione, priorità e stato.
- [ ] Ordinamento ascendente/descendente per priorità, nome e padiglione.
- [ ] Reset dei filtri alla riapertura ordinaria.
- [ ] Collegamenti Dashboard con filtri contestuali.
- [ ] Distinzione chiara tra catalogo completo e interessi personali.
- [ ] Aggiunta e rimozione interessi senza perdita di dati.
- [ ] Priorità intera 1–10, facoltativa e personale.
- [ ] Cancellazioni volontarie dei seed rispettate.
- [ ] `whatToSee` personale modificabile, senza inventare checklist completata.
- [ ] Stati `to_visit`, `visited`, `revisit` disponibili.
- [ ] Stato assente = `to_visit`, senza auto-iscrizione agli interessi.
- [ ] Note e foto personali per stand.
- [ ] Prodotti del solo profilo attivo mostrati nello stand.
- [ ] Creazione e modifica di stand personali anche offline.
- [ ] Nessuna modifica o eliminazione di stand editoriali dalla UI.
- [ ] Eliminazione stand personale protetta da conferma e controllo dipendenze.
- Salvataggio mobile automatico locale e outbox per valori validi, senza modalità bozza o conferma Salva finale; input invalidi conservati localmente secondo §5.1 del documento 27.
- [ ] Commit locale atomico e feedback corretto.
- [ ] Coda di sincronizzazione idempotente e dipendenze rispettate.
- Concorrenza mobile LWW per record in ordine di accettazione server; revisioni monotone, idempotenza e protezione delle tombstone.
- [ ] Nessuna posizione EICMA inventata.
- [ ] Accessibilità mobile e desktop verificata.

---

## 29. Decisioni ancora aperte

| Tema | Raccomandazione iniziale | Impatto |
|---|---|---|
| Inclusione automatica degli stand personali negli interessi | Sì, solo per il creatore | Dashboard e membership |
| Salvataggio scheda visita | Un solo pulsante Salva per stato, priorità, obiettivi e note | Bozze e sync |
| Modifica note/stato su stand non tracciato | Chiedere esplicitamente se aggiungere agli interessi | Conteggi dashboard |
| Eliminazione stand personale con foto | Bloccare finché esistono dipendenze | Media e tombstone |
| Eliminazione stand personale con prodotti | Bloccare nella v1 | Integrità prodotti |
| Priorità default della lista completa | Alfabetico; per interessi priorità decrescente | UI |
| Padiglione non indicato | Filtro opzionale dedicato | Ricerca |
| Checklist completamento `whatToSee` | Non prevista nella v1 | Schema dati futuro |
| Merge stand duplicati | Non automatico | Sicurezza dati |
| Rimozione interesse e storico visita | Conservare tutti i dati personali | Export e audit |

Queste proposte non vanno trattate come decisioni già approvate: prima dello sviluppo occorre allinearle con i documenti relativi.

---

## 30. Riferimenti e prossimo passo

- `07-stands-config.md`: schema editoriale degli stand.
- `09-interests-config.md`: seed e override degli interessi personali.
- `11-visit-statuses-config.md`: stati visita e transizioni.
- `12-database.md`: persistenza PostgreSQL e IndexedDB.
- `13-backend-api.md`: contratti backend.
- `14-frontend-ui.md`: componenti e navigazione.
- `15-dashboard.md`: statistiche e filtri contestuali.
- `17-product-management.md`: **prossimo documento**, creazione, modifica, categoria immutabile, foto, questionari, valutazioni, preferiti ed eliminazione dei prodotti.
- `19-offline-storage.md`, `20-synchronization.md`, `21-photo-management.md`: dettagli di storage, sincronizzazione e media.

**Conclusione:** la sezione Stand deve permettere di esplorare un catalogo comune e organizzare una visita personale senza mescolare profili, senza perdere dati offline e senza trasformare informazioni non verificate in dati ufficiali.
