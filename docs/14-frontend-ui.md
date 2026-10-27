# ExpoTrack — 14. Frontend UI e UX

> **Percorso previsto:** `docs/14-frontend-ui.md`  
> **Stato:** specifica progettuale, non implementazione  
> **Progetto:** ExpoTrack — applicazione privata, mobile-first e offline-first per fiere; primo evento EICMA 2026  
> **Documenti correlati:** `00-overview.md`, `01-architecture.md`, `02-project-structure.md`, `03-app-config.md`, `04-profiles-config.md`, `05-pavilions-config.md`, `06-categories-config.md`, `07-stands-config.md`, `08-products-config.md`, `09-interests-config.md`, `10-questionnaires-config.md`, `11-visit-statuses-config.md`, `12-database.md`, `13-backend-api.md`  
> **Documento successivo:** `15-dashboard.md`

---

## 1. Scopo

Definire il comportamento dell'interfaccia di ExpoTrack prima dell'implementazione: navigazione, pagine, componenti, form, feedback, accessibilità, adattamento mobile/desktop e funzionamento offline. La specifica evita di imporre dettagli grafici non ancora concordati; propone una struttura coerente, realizzabile con **Next.js, React, TypeScript e Tailwind CSS**, usando **componenti personalizzati** senza MUI o shadcn/ui.

ExpoTrack non è un'app per mappe o itinerari: non deve introdurre percorsi, navigazione indoor o calcolo distanze tra stand. I dati di padiglione e posizione servono soltanto a identificare, cercare e filtrare gli espositori quando verificati.

### 1.1 Obiettivi di esperienza

1. Identificare rapidamente chi sta usando l'app: **Io** oppure **Papà**, con possibilità di creare altri profili.
2. Consultare stand e prodotti anche senza rete dopo il primo caricamento dei dati.
3. Registrare informazioni sul posto con pochi passaggi e controlli comodi da usare con una mano.
4. Distinguere senza ambiguità **bozza**, **salvato sul dispositivo**, **in sincronizzazione**, **sincronizzato** e **conflitto**.
5. Tenere separati interessi, priorità, note, prodotti, fotografie e questionari dei diversi profili.
6. Consentire confronti affiancati di prodotti della stessa categoria **solo su desktop**.
7. Conservare modifiche non ancora confermate senza spedirle al server.
8. Evitare la perdita silenziosa di dati, soprattutto durante cambi di pagina, profilo e connettività.

### 1.2 Vincoli non negoziabili

- Nessun login, password, PIN o autenticazione interna v1.
- Selezione profilo iniziale e memorizzazione locale del profilo scelto.
- Cambio profilo consentito in qualsiasi momento, rispettando le bozze aperte.
- Catalogo editoriale condiviso; stand creati dall'app privati al profilo proprietario.
- Ogni prodotto appartiene a un profilo e a uno stand e ha **esattamente una categoria**; questa categoria diventa immutabile dopo il primo **Salva**, anche offline.
- Priorità stand da **1 a 10**, distinta dal voto prodotto da **1 a 10**.
- Stati stand: **Da visitare**, **Visitato**, **Da rivedere**.
- Questionari personalizzati per profilo e categoria/sottocategoria; nessun questionario generico automatico.
- Le domande dei questionari sono tutte facoltative.
- Nessun campo padiglione o numero stand inventato se non disponibile nei JSON validati.
- Filtri e ordinamenti tornano ai valori iniziali quando si riapre la lista, salvo ingresso tramite una scorciatoia esplicitamente filtrata dalla dashboard.
- Esportazione JSON/PDF per profilo; niente Excel e niente import v1.

---

## 2. Utenti, dispositivi e contesti d'uso

### 2.1 Contesto primario: fiera su smartphone

L'utente è in movimento, può avere una sola mano libera, batteria limitata e connettività intermittente. L'interfaccia deve privilegiare:

- testo leggibile senza zoom;
- target tattili ampi;
- azioni frequenti nella parte inferiore della schermata;
- schede riassuntive che non richiedono scroll orizzontale;
- form che non perdono i dati quando la tastiera mobile si apre;
- fotografie acquisibili dalla fotocamera o dalla galleria;
- indicazione discreta ma costante dello stato locale/sync.

### 2.2 Contesto secondario: desktop

Il desktop serve per rivedere gli appunti, filtrare, compilare descrizioni lunghe, consultare fotografie e confrontare prodotti. La navigazione può sfruttare sidebar, tabelle e pannelli laterali. Il confronto affiancato è esclusivo della modalità desktop.

### 2.3 Tablet

Layout adattivo intermedio: preferire schede a due colonne dove c'è spazio, mantenendo le funzioni principali del mobile. Non considerare un tablet automaticamente desktop per abilitare il confronto: definire un breakpoint e un criterio di spazio effettivo.

---

## 3. Architettura delle pagine

### 3.1 Albero informativo proposto

```text
ExpoTrack
├── Selezione profilo (primo accesso o cambio esplicito)
└── Area evento / profilo attivo
    ├── Dashboard
    ├── Stand
    │   ├── Lista, ricerca, filtri, ordinamento
    │   ├── Dettaglio stand
    │   │   ├── Priorità e cose da vedere
    │   │   ├── Stato visita e note
    │   │   ├── Fotografie stand
    │   │   └── Prodotti osservati nello stand
    │   └── Nuovo stand personale / modifica
    ├── Prodotti
    │   ├── Lista, ricerca e filtri
    │   ├── Dettaglio prodotto
    │   │   ├── Dati, prezzo, voto, preferito
    │   │   ├── Note e fotografie
    │   │   └── Questionario categoria/profilo
    │   ├── Nuovo prodotto / modifica
    │   └── Confronto (solo desktop)
    └── Profilo
        ├── Scelta/cambio profilo
        ├── Preferenze e budget per categoria
        ├── Gestione profili dinamici
        ├── Sincronizzazione e conflitti
        └── Esportazione JSON/PDF
```

L'albero è un'organizzazione UI; non definisce automaticamente URL o endpoint API. I percorsi Next.js devono essere stabiliti in `02-project-structure.md` e coordinati con `13-backend-api.md`.

### 3.2 Navigazione mobile fissa

Quattro voci nella **bottom navigation**:

| Voce | Destinazione | Indicazione |
|---|---|---|
| Dashboard | Riepilogo del profilo/evento | Icona home/dashboard |
| Stand | Catalogo e stand personali | Icona negozio/edificio |
| Prodotti | Prodotti osservati | Icona tag/scatola |
| Profilo | Identità, sync, export | Icona utente |

Il testo delle quattro voci deve restare visibile. L'elemento attivo è distinguibile non solo tramite colore, ma anche tramite forma, indicatore o peso tipografico. La barra rispetta le safe area degli smartphone e non copre i pulsanti **Salva**.

### 3.3 Navigazione desktop

**Proposta:** sidebar persistente con le stesse quattro destinazioni; header con evento, profilo e stato di sincronizzazione. Non creare funzioni diverse per desktop, salvo confronto affiancato e densità maggiore delle liste.

### 3.4 Deep link

Un URL può identificare evento, stand o prodotto. Se il profilo attivo non corrisponde al proprietario del dato, non mostrare automaticamente dati di un altro profilo: richiedere cambio esplicito o visualizzare un messaggio di contenuto non disponibile nel profilo corrente.

I link verso stand editoriali possono essere aperti da più profili, ma i campi personali devono riflettere **solo** il profilo attivo.

---

## 4. Sistema visivo

### 4.1 Principi

- Interfaccia pulita, moderna, rapida, focalizzata sulla raccolta dati.
- Colore del profilo come **accento identificativo**, non come unica codifica di significato.
- Stati di visita con testo e icona, oltre al colore.
- Contrasti adeguati e gerarchia visiva chiara.
- Riduzione del rumore: mostrare prima le informazioni utili, dettagli avanzati su richiesta.
- Supporto a testi lunghi, nomi espositori e categorie annidate.

### 4.2 Token suggeriti

```ts
interface UiTokens {
  spacing: readonly number[];
  radius: {
    card: string;
    control: string;
    modal: string;
  };
  colors: {
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    border: string;
    danger: string;
    warning: string;
    success: string;
  };
}
```

La palette definitiva, i font e le dimensioni non sono ancora decisi. Utilizzare variabili CSS e classi Tailwind per rendere i token sostituibili. I colori iniziali dei profili provengono da `profiles.json` (`me` rosso, `father` blu negli esempi progettuali), non da costanti duplicate nei componenti.

### 4.3 Stati interattivi

Ogni controllo deve avere stati: normale, hover dove applicabile, focus visibile, pressed, disabled, loading ed errore. Non affidare un errore soltanto a una bordatura rossa: aggiungere un testo esplicativo.

---

## 5. Selezione del profilo

### 5.1 Primo avvio

Mostrare una schermata semplice: nome ExpoTrack, evento corrente e schede dei profili abilitati. L'utente sceglie il proprio profilo; l'app salva l'ID localmente e apre la dashboard.

**Non** chiedere credenziali. La selezione profilo è una preferenza locale, non una prova di identità.

### 5.2 Avvii successivi

Se l'ID locale corrisponde a un profilo ancora abilitato, aprire direttamente l'area principale. Se il profilo non esiste più o è disabilitato, tornare alla selezione senza cancellare i dati locali.

### 5.3 Cambio profilo

Disponibile da header e pagina Profilo. Se è presente una bozza aperta, avvisare e consentire di salvarla, lasciarla in bozza o annullare il cambio. **Non trasferire mai la bozza al nuovo profilo.**

### 5.4 Profili dinamici

Consentire creazione, modifica e cancellazione dei soli profili creati nell'app. La cancellazione richiede doppia conferma e una spiegazione delle conseguenze per dati e fotografie. I profili definiti in JSON non sono eliminabili tramite UI.

---

## 6. Header applicazione

L'header contiene:

- nome o logo ExpoTrack;
- evento selezionato;
- profilo attivo, con nome e colore;
- indicatore di sincronizzazione;
- accesso rapido al cambio profilo, se non sovraccarica il mobile.

### 6.1 Indicatore sync

| Stato | Etichetta consigliata | Significato |
|---|---|---|
| `offline` | Offline | Connessione non disponibile o server non raggiungibile |
| `local_saved` | Salvato sul dispositivo | Dati confermati localmente, sync pendente |
| `syncing` | Sincronizzazione… | Operazioni in invio/ricezione |
| `synced` | Sincronizzato | Nessuna operazione pendente per il contesto dichiarato |
| `error` | Sync non riuscita | Errore recuperabile o permanente |
| `conflict` | Conflitto da risolvere | Due versioni concorrenti conservate |

**Precisazione:** `navigator.onLine` non garantisce che il backend sia raggiungibile. Il client deve distinguere connettività presunta da reale disponibilità API.

Non mostrare «Sincronizzato» mentre esistono modifiche locali confermate in coda. Una **bozza non salvata** va indicata separatamente: non è una mutazione da sincronizzare.

---

## 7. Dashboard: contratto UI generale

La dashboard viene specificata nel dettaglio in `15-dashboard.md`. In questo documento se ne definiscono soltanto gli elementi trasversali:

- intestazione con profilo ed evento;
- contatori **Da visitare**, **Visitati**, **Da rivedere**;
- contatore prodotti registrati e preferiti;
- collegamenti ai rispettivi elenchi filtrati;
- indicazione dello stato sync;
- azioni rapide per consultare stand e aggiungere prodotti, se il contesto consente di scegliere lo stand.

### 7.1 Universo dei conteggi

Il catalogo editoriale può contenere più stand di quelli effettivamente interessanti per il profilo. **Proposta da confermare:** i contatori di visita riguardano gli stand tracciati dal profilo (interessi iniziali, aggiunte personali e stand esplicitamente seguiti), non necessariamente l'intero catalogo. Lo stato predefinito di uno stand tracciato senza override è **Da visitare**.

Questa regola deve essere allineata con `09-interests-config.md`, `11-visit-statuses-config.md` e `15-dashboard.md` prima dell'implementazione.

---

## 8. Lista stand

### 8.1 Contenuto di ogni scheda

Una scheda stand può mostrare:

1. Nome espositore/stand.
2. Categoria o categorie principali.
3. Padiglione e posizione **solo se verificati e disponibili**.
4. Priorità personale 1–10, se assegnata.
5. Stato visita del profilo.
6. Indicatore di prodotti osservati.
7. Breve anteprima delle cose da vedere, se presenti.

Non mostrare placeholder che sembrino posizioni reali, ad esempio «Padiglione 1» per dati mancanti. Preferire «Posizione non disponibile» oppure omettere il campo.

### 8.2 Ricerca

Ricerca almeno per nome stand; estensioni possibili per categoria, descrizione e parole chiave. La ricerca deve funzionare offline sullo snapshot locale.

### 8.3 Filtri

- Categoria e sottocategoria.
- Padiglione, solo se presente.
- Priorità personale.
- Stato visita.
- Origine: catalogo o stand personale (filtro proposto).
- Interesse: seguiti/non seguiti (filtro proposto).

I filtri combinati devono essere comprensibili; mostrare il numero di risultati e un'azione **Azzera filtri**.

### 8.4 Ordinamento

Supportare almeno nome, priorità e padiglione, in ordine crescente/decrescente quando pertinente. Per i record senza priorità o padiglione, definire una posizione stabile, preferibilmente in fondo.

### 8.5 Reset alla riapertura

Quando l'utente abbandona la lista e la riapre dalla navigazione principale, filtri e ordinamenti tornano ai valori iniziali. Quando arriva da una card dashboard «Da rivedere», il filtro iniziale deve riflettere il collegamento, ma non diventare una preferenza persistente.

### 8.6 Catalogo versus interessi

Consultare uno stand editoriale **non deve aggiungerlo automaticamente** agli interessi personali. L'utente può marcarlo come interessante o iniziare a raccogliere dati: definire esplicitamente il momento in cui diventa «tracciato». La UI deve rendere visibile questa distinzione senza complicare il flusso.

---

## 9. Dettaglio stand

### 9.1 Struttura proposta

```text
[Indietro]       [Nome stand]
[Categoria/e]    [Padiglione / posizione se noti]

[Segui stand / Interesse personale]
[Priorità 1–10]       [Stato visita]

Cose da vedere
- ...
- ...
[Modifica]

Note personali
[Campo di testo]

Fotografie stand
[Miniature] [+ Aggiungi foto]

Prodotti osservati
[Elenco] [+ Nuovo prodotto]

[Salva]
```

Questa è una rappresentazione concettuale, non un mockup definitivo.

### 9.2 Distinzione condiviso/personale

Nome, descrizione, categorie e posizione degli stand editoriali sono di origine JSON e **non modificabili** dall'utente nella v1. Priorità, stato, cose da vedere, note e foto sono personali.

Per uno stand creato dall'app, il profilo proprietario può modificare anche i campi anagrafici consentiti. L'eliminazione dello stand personale richiede conferma e controllo dei prodotti collegati.

### 9.3 Stato visita

Usare un selettore chiaro con tre valori:

- **Da visitare** (`to_visit`)
- **Visitato** (`visited`)
- **Da rivedere** (`revisit`)

Il cambio di stato modifica solo il dato personale del profilo; non cambia automaticamente priorità, note, prodotti o fotografie.

### 9.4 Priorità

Valori interi 1–10. Il controllo può essere una select o un selettore numerico compatto. Mostrare il significato di «10 = massima priorità». La priorità **non** è il voto assegnato a un prodotto.

### 9.5 Cose da vedere

Lista di stringhe personalizzabili. Ogni elemento può essere aggiunto, modificato o rimosso. **Non introdurre uno stato checklist completato/non completato** senza una decisione specifica: il requisito corrente è una lista di obiettivi, non un task manager.

### 9.6 Salvataggio

Modifiche a priorità, stato, cose da vedere e note possono essere raccolte in un unico form o in sezioni con salvataggio distinto. **Proposta v1:** un pulsante Salva ben visibile per le modifiche della scheda, con bozze locali autosalvate; i prodotti e le fotografie seguono il proprio ciclo di salvataggio.

---

## 10. Creazione e gestione di stand personali

### 10.1 Nuovo stand

Campi suggeriti:

| Campo | Obbligatorio | Note |
|---|---|---|
| Nome | Sì | Non vuoto dopo trim |
| Descrizione | No | Testo libero |
| Categorie | No | Più categorie; ammettere array vuoto se catalogazione incompleta |
| Padiglione | No | Solo ID valido per evento |
| Numero/posizione stand | No | Testo libero, non inventato |

L'evento e il profilo proprietario vengono dal contesto attivo, non scelti implicitamente da un altro profilo.

### 10.2 Modifica

Consentire modifiche dei campi dello stand personale. Non permettere di cambiare il profilo proprietario. Se uno stand viene usato da prodotti, mantenere stabile l'ID.

### 10.3 Eliminazione

Mostrare una conferma esplicita. **Proposta prudente:** bloccare la cancellazione se esistono prodotti associati e spiegare come gestirli; il comportamento definitivo è ancora aperto in `12-database.md`.

---

## 11. Lista prodotti

### 11.1 Scheda prodotto

- Nome prodotto.
- Stand di riferimento.
- Categoria/sottocategoria.
- Prezzo, solo se registrato.
- Voto 1–10, solo se registrato.
- Icona preferito.
- Miniatura fotografica, se disponibile.
- Stato di sincronizzazione quando necessario.

Non confondere «nessun prezzo» con «0 €»; non mostrare un voto inesistente come `0/10`.

### 11.2 Filtri

Categoria, sottocategoria, stand, preferiti, presenza prezzo/voto (facoltativi) e ricerca per nome. Le categorie annidate possono essere filtrate per ramo includendo discendenti, se coerente con `06-categories-config.md`.

### 11.3 Ordinamento

Nome, prezzo, voto e data di creazione/modifica sono opzioni proposte. I valori mancanti vanno gestiti in modo deterministico. Reset dei filtri alla riapertura, come per gli stand.

### 11.4 Preferiti

Il preferito è una proprietà personale del prodotto. Un toggle rapido nella lista può essere utile, ma **deve rispettare il contratto di Salva**: evitare modifiche persistenti implicite non concordate. Proposta: azione esplicita con conferma locale immediata, distinguibile dai form con bozza; decisione da chiudere in `17-product-management.md`.

---

## 12. Creazione prodotto

### 12.1 Campi

| Campo | Regola |
|---|---|
| Stand | Obbligatorio, selezionato esplicitamente o precompilato dal dettaglio stand |
| Nome | Obbligatorio |
| Categoria | **Esattamente una**, obbligatoria |
| Prezzo | Facoltativo, singolo importo non negativo |
| Voto | Facoltativo, intero 1–10 |
| Preferito | Booleano |
| Note | Facoltative |
| Fotografie | Zero o più |
| Questionario | Solo se esiste definizione applicabile a profilo/categoria |

### 12.2 Selezione categoria

Mostrare la gerarchia categoria → sottocategoria, con selezione finale **singola**. Non usare checkbox multiselezione. Selezionare una categoria padre può essere consentito, se la regola editoriale lo permette.

### 12.3 Categoria immutabile

**Prima del primo Salva:** la categoria può essere modificata liberamente nella bozza.  
**Dopo il primo Salva locale riuscito:** il controllo diventa di sola lettura; il blocco permane offline, dopo reload e dopo sincronizzazione.

Se l'utente ha scelto la categoria sbagliata, la v1 non deve modificarla silenziosamente: mostrare una spiegazione e, se appropriato, proporre la creazione di un nuovo prodotto con la categoria corretta, senza cancellare automaticamente il precedente.

### 12.4 Prezzo

Input numerico localizzato per `it-IT`; accettare la virgola decimale, convertendo in unità minori esatte prima della persistenza. Gestire `0`, valore vuoto, spazi, input non numerici e valori fuori range. La valuta prevista è EUR.

### 12.5 Voto

Controllo 1–10, facoltativo. Non obbligare l'utente a valutare un prodotto appena visto. Il voto complessivo è distinto dalle risposte a domande di tipo rating del questionario.

### 12.6 Primo salvataggio

Prima di salvare, validare nome, stand, categoria e campi numerici. Eseguire una transazione locale atomica tra record prodotto e outbox. Se la transazione fallisce, mantenere la bozza e mostrare un errore senza simulare il successo.

---

## 13. Dettaglio e modifica prodotto

La schermata dettaglio deve rendere leggibili:

1. Nome, categoria (bloccata), stand e contesto evento.
2. Prezzo, voto, preferito e note.
3. Fotografie con miniature e vista ingrandita.
4. Questionario applicabile, se presente.
5. Stato di sincronizzazione e conflitti eventuali.
6. Azioni Modifica ed Elimina.

Le modifiche ai campi consentiti passano attraverso bozza e **Salva**. L'eliminazione richiede conferma e deve rispettare tombstone e dipendenze fotografiche.

### 13.1 Cambiare stand del prodotto

Non è stato definito come requisito certo. **Proposta conservativa:** trattare lo stand come stabile dopo il primo Salva, analogamente alla categoria, fino a decisione in `17-product-management.md`. Non presentare questa proposta come decisione già approvata.

---

## 14. Questionari nella UI

### 14.1 Risoluzione

Per il profilo attivo e la categoria del prodotto, caricare la definizione appropriata dai JSON del profilo. Se non esiste, **non mostrare una sezione vuota** né un questionario condiviso inventato.

L'eventuale ereditarietà da categoria padre è ancora una decisione aperta; la proposta corrente è corrispondenza esatta.

### 14.2 Tipi di campo

| Tipo JSON | Controllo UI | Validazione |
|---|---|---|
| Testo | Input/textarea | Stringa, facoltativa |
| Numero | Input numerico | Numero valido, eventuali limiti definiti |
| Sì/no | Scelta a due opzioni + non risposto | `true`, `false` oppure assente |
| Scelta singola | Radio/select | Un'opzione valida oppure assente |
| Scelta multipla | Checkbox | Zero o più opzioni valide |
| Rating 1–10 | Selettore numerico | Intero 1–10 oppure assente |

**Importante:** per sì/no, «Non risposto» è diverso da «No». Per scelta multipla, zero opzioni selezionate non deve essere interpretato automaticamente come risposta negativa a una domanda non compilata, se il contratto dati distingue i due casi.

### 14.3 Modifiche alle definizioni

Le risposte salvate devono rimanere interpretabili dopo l'aggiornamento dei questionari. La UI può mostrare una dicitura «Questionario compilato con una versione precedente» e le etichette originali, se conservate nello snapshot storico.

### 14.4 Ergonomia

Raggruppare le domande per sezioni se il JSON lo consente. Evitare schermate troppo lunghe con molte select. Non forzare la compilazione per poter salvare il prodotto.

---

## 15. Gestione fotografie

### 15.1 Acquisizione

L'utente può aggiungere fotografie da fotocamera o libreria del dispositivo, nei limiti del supporto browser. Non promettere accesso alla fotocamera se il browser o i permessi non lo consentono.

### 15.2 Esperienza

- Anteprima immediata.
- Indicazione delle foto ancora soltanto locali.
- Rimozione con conferma dove necessario.
- Possibilità di più foto per stand e prodotto.
- Visualizzazione a schermo intero/ingrandita.
- Feedback di upload e errori.

### 15.3 Offline

Dopo il salvataggio locale, il blob deve essere conservato in IndexedDB o storage locale equivalente; non basta mantenere un `blob:` URL temporaneo. Gestire quota insufficiente e permessi negati.

### 15.4 Prestazioni

Generare miniature, valutare compressione e non caricare tutte le immagini originali nelle liste. Limiti definitivi e formati saranno descritti in `21-photo-management.md`.

---

## 16. Bozze, Salva e feedback

### 16.1 Stati del form

```ts
type EditorState =
  | "pristine"
  | "draft_dirty"
  | "saving_local"
  | "saved_local"
  | "local_error"
  | "sync_pending"
  | "syncing"
  | "synced"
  | "conflict";
```

Questa union è illustrativa: **stato del form** e **stato di sincronizzazione** possono essere due dimensioni indipendenti, per evitare combinazioni impossibili.

### 16.2 Autosalvataggio bozza

Ad ogni modifica significativa, persistire la bozza in locale. L'implementazione può usare debounce per ridurre scritture, ma deve prevedere flush in transizioni critiche e recupero dopo crash quando tecnicamente possibile.

### 16.3 Pulsante Salva

- Deve essere riconoscibile e raggiungibile.
- Deve validare i dati.
- Deve confermare **prima** la persistenza locale.
- Deve mettere in coda la sincronizzazione.
- Deve distinguere «Salvato sul dispositivo» da «Sincronizzato».
- Non deve eliminare la bozza in caso di errore.

### 16.4 Navigazione con modifiche non confermate

Proposta di dialogo:

> **Hai modifiche non salvate.** Le abbiamo conservate come bozza su questo dispositivo. Vuoi salvarle ora, continuare senza confermarle oppure restare qui?

Il testo deve essere adattato ai limiti reali del browser. Non affermare che un dialogo personalizzato sia garantito alla chiusura della scheda.

### 16.5 Errori

Messaggi specifici: «Impossibile salvare sul dispositivo: spazio insufficiente», «Categoria non valida», «Il prodotto è stato modificato su un altro dispositivo», evitando errori generici quando il motivo è noto.

---

## 17. Sincronizzazione e conflitti nella UI

### 17.1 Pagina stato sincronizzazione

Mostrare almeno:

- connessione attuale;
- numero operazioni in attesa;
- ultima sincronizzazione riuscita, se nota;
- errori recenti;
- conflitti da risolvere;
- pulsante **Sincronizza ora**.

Il pulsante manuale non deve sostituire la sincronizzazione automatica quando la connessione è disponibile.

### 17.2 Conflitto manuale

Per ogni conflitto mostrare:

| Versione locale | Versione server |
|---|---|
| Dati modificati sul dispositivo | Dati già presenti sul server |
| Revisione di partenza | Revisione corrente |
| Data/ora informativa | Data/ora informativa |

Consentire la scelta della versione da mantenere, con anteprima delle differenze e conferma. **Non** scegliere automaticamente il più recente in base all'orologio. Le due versioni devono restare disponibili fino alla risoluzione.

### 17.3 Foto e conflitti

Se un conflitto riguarda foto, mostrare miniature di entrambe le versioni quando i file sono disponibili; in caso contrario, rendere visibile la limitazione e non cancellare riferimenti.

### 17.4 App chiusa

Non promettere sincronizzazione in background quando la PWA è chiusa: la disponibilità dipende dal browser e dalla piattaforma.

---

## 18. Esportazione dati

La pagina Profilo ospita l'export **del profilo attivo**, con:

- formato **JSON** o **PDF**;
- tutte le categorie o categorie selezionate;
- riepilogo per categoria/sottocategoria;
- schede prodotto con note, foto e risposte ai questionari, quando previste dal formato;
- indicazione del perimetro dei dati esportati.

### 18.1 Dati non sincronizzati

**Decisione aperta:** esportare dal dataset locale confermato oppure richiedere un export server-side dei dati sincronizzati. La UI deve esplicitare la scelta e non produrre un PDF incompleto fingendo che contenga tutte le modifiche offline.

### 18.2 Nessun import o Excel

Non aggiungere pulsanti Importa o Esporta Excel nella v1.

---

## 19. Responsive design

### 19.1 Breakpoint proposti

| Modalità | Indicazione progettuale | Layout |
|---|---|---|
| Mobile | Schermo stretto | Una colonna, bottom nav |
| Tablet | Schermo intermedio | Una/due colonne, navigazione adattiva |
| Desktop | Spazio sufficiente | Sidebar, tabelle e confronto |

I breakpoint effettivi saranno scelti dopo test su Galaxy S25 e browser desktop. Non vincolare il confronto a un semplice user-agent: verificare spazio disponibile e interazione.

### 19.2 Bottom sheet e dialoghi

Sul mobile preferire bottom sheet per filtri e azioni secondarie; su desktop dialoghi o pannelli laterali. Il contenuto deve essere navigabile da tastiera e con screen reader.

### 19.3 Tastiera virtuale

I pulsanti Salva e Annulla devono restare raggiungibili quando la tastiera è aperta. Evitare elementi fissi che coprono l'ultimo input.

---

## 20. Accessibilità

- HTML semantico, etichette associate ai campi.
- Focus visibile e ordine di tabulazione coerente.
- Controlli accessibili da tastiera.
- Target tattili sufficientemente grandi.
- Contrasto adeguato anche per colori dei profili.
- Testo, non solo colore, per stati di visita e sincronizzazione.
- Errori annunciati e collegati ai campi interessati.
- Dialoghi con gestione focus e chiusura prevedibile.
- Rispetto delle preferenze di movimento ridotto.
- Supporto allo zoom del browser senza perdita di contenuti essenziali.
- Etichette e descrizioni alternative per immagini significative.

**Obiettivo proposto:** conformità WCAG 2.2 livello AA per le schermate principali, da verificare con test automatici e manuali.

---

## 21. Performance e resilienza

### 21.1 Caricamento

Dopo il bootstrap iniziale, usare i dati locali per mostrare immediatamente schermate e liste; aggiornare in seguito quando la connessione lo consente. Mostrare scheletri di caricamento solo se necessari, senza bloccare tutta l'app per una richiesta secondaria.

### 21.2 Rendering

- Evitare il caricamento simultaneo di foto originali.
- Virtualizzare liste solo se le dimensioni reali lo richiedono.
- Mantenere stabile lo scroll al ritorno dal dettaglio, se coerente con il reset filtri.
- Limitare ricalcoli costosi durante la digitazione.
- Ridurre dipendenze frontend non indispensabili.

### 21.3 Error boundary

Errori di rendering di una singola scheda non devono compromettere l'intera applicazione. Offrire retry e conservare bozze e outbox.

### 21.4 Stato offline

Se il catalogo non è mai stato scaricato, il primo avvio offline **non può inventare i dati**: mostrare una schermata che spiega la necessità di un primo collegamento.

---

## 22. Modello componenti TypeScript proposto

```ts
type ProfileId = string;
type EventId = string;
type StandId = string;
type ProductId = string;

type VisitStatus = "to_visit" | "visited" | "revisit";

type StandSource = "catalog" | "personal";

interface StandReference {
  eventId: EventId;
  source: StandSource;
  standId: StandId;
}

interface StandListItemViewModel {
  ref: StandReference;
  name: string;
  categoryNames: string[];
  hallLabel?: string;
  boothLabel?: string;
  priority?: number;
  visitStatus: VisitStatus;
  isTracked: boolean;
  productCount: number;
}

interface ProductListItemViewModel {
  id: ProductId;
  profileId: ProfileId;
  eventId: EventId;
  standName: string;
  name: string;
  categoryPath: string[];
  priceMinor?: number;
  rating?: number;
  favorite: boolean;
  thumbnailLocalId?: string;
}

interface SaveFeedback {
  draftDirty: boolean;
  localSaveStatus: "idle" | "saving" | "saved" | "error";
  syncStatus: "pending" | "syncing" | "synced" | "conflict" | "error";
}
```

Sono **view model**, non necessariamente le stesse interfacce SQL/API. Evitare che i componenti UI dipendano direttamente dalle strutture PostgreSQL o dalle risposte grezze dell'API.

### 22.1 Componenti suggeriti

```text
components/
├── app-shell/
│   ├── AppHeader
│   ├── MobileBottomNavigation
│   ├── DesktopSidebar
│   └── ProfileSwitcher
├── common/
│   ├── Button
│   ├── TextField
│   ├── SelectField
│   ├── RatingField
│   ├── ConfirmDialog
│   ├── EmptyState
│   ├── ErrorState
│   ├── SyncIndicator
│   └── PhotoPicker
├── stands/
│   ├── StandCard
│   ├── StandFilters
│   ├── StandStatusPicker
│   ├── PriorityPicker
│   ├── WhatToSeeEditor
│   └── StandEditor
├── products/
│   ├── ProductCard
│   ├── ProductFilters
│   ├── ProductEditor
│   ├── ProductRating
│   └── ProductPhotoGallery
├── questionnaires/
│   ├── QuestionnaireRenderer
│   └── QuestionField
└── sync/
    ├── PendingOperationsSummary
    └── ConflictResolver
```

I nomi sono proposti, non vincolanti. La collocazione esatta deve rispettare `02-project-structure.md`.

---

## 23. Gestione dello stato frontend

### 23.1 Separare tre livelli

1. **Stato editoriale**: cataloghi JSON validati e versionati.
2. **Stato confermato locale**: dati già salvati in IndexedDB, anche se non sincronizzati.
3. **Stato bozza**: modifiche non confermate dell'editor.

La UI non deve leggere direttamente da un unico oggetto globale mutabile senza distinguere i tre livelli.

### 23.2 Profilo ed evento

Ogni query, cache key e mutazione personale deve includere `profileId` ed `eventId`. Quando cambia il profilo, annullare o isolare fetch pendenti e invalidare i view model per evitare visualizzazioni incrociate.

### 23.3 Sincronizzazione

Il sync worker non deve modificare la bozza aperta mentre arriva una versione server. Se c'è divergenza, mantenere la bozza e proporre una risoluzione coerente.

### 23.4 Librerie

Non è ancora stata approvata una libreria di gestione dello stato o dei form. Sono possibili React Hook Form, TanStack Query e una libreria IndexedDB, ma **nessuna è imposta da questa specifica**. Scegliere in base a complessità, bundle, supporto offline e testabilità.

---

## 24. Stati vuoti, errori e microcopy

| Situazione | Messaggio proposto | Azione |
|---|---|---|
| Nessun prodotto | «Non hai ancora registrato prodotti.» | «Aggiungi prodotto» |
| Nessuno stand trovato | «Nessuno stand corrisponde ai filtri.» | «Azzera filtri» |
| Nessun questionario | Non mostrare la sezione | Nessuna |
| Nessuna foto | «Nessuna fotografia aggiunta.» | «Aggiungi foto» |
| Offline con cache | «Stai lavorando offline. I dati salvati saranno sincronizzati quando possibile.» | Nessuna obbligatoria |
| Offline senza cache | «Per usare ExpoTrack offline, aprila una prima volta con Internet.» | «Riprova» |
| Salvataggio locale riuscito | «Salvato sul dispositivo.» | Nessuna |
| Sincronizzazione completata | «Sincronizzato.» | Nessuna |
| Conflitto | «Questo dato è stato modificato anche su un altro dispositivo.» | «Confronta versioni» |
| Foto troppo grande | «La fotografia supera il limite consentito.» | «Scegli un'altra foto» |
| Categoria bloccata | «La categoria non può essere modificata dopo il primo salvataggio.» | Nessuna |
| Profilo non disponibile | «Il profilo selezionato non è più disponibile.» | «Scegli profilo» |

Evitare toast che scompaiono prima di poter essere letti per errori gravi: utilizzare anche messaggi persistenti vicino all'azione interessata.

---

## 25. Confronto prodotti desktop

Il dettaglio del confronto è nel documento `22-comparison.md`. Vincoli UI qui definiti:

- Disponibile **solo su desktop**.
- Selezionare prodotti della **stessa categoria esatta**, salvo diversa decisione esplicita.
- Mostrare affiancati dati principali, prezzo, voto, note e risposte questionario compatibili.
- Non convertire risposte mancanti in valori negativi o zero.
- Se le versioni dei questionari differiscono, segnalare l'incompatibilità o mostrare le domande per versione senza confronto fuorviante.
- Su mobile non mostrare un pulsante confronto che apre una vista inutilizzabile; eventualmente indicare che è disponibile su desktop.

---

## 26. Flussi utente principali

### 26.1 Prima visita

1. Aprire ExpoTrack con connessione disponibile.
2. Scaricare e validare lo snapshot editoriale.
3. Mostrare profili abilitati.
4. Selezionare «Io» o «Papà».
5. Memorizzare il profilo scelto.
6. Aprire la dashboard del profilo/evento.

### 26.2 Segnare uno stand come visitato

1. Aprire la lista Stand.
2. Cercare lo stand.
3. Aprire il dettaglio.
4. Selezionare **Visitato**.
5. Premere **Salva**.
6. Mostrare conferma locale.
7. Aggiornare i contatori dashboard in modo coerente.
8. Sincronizzare quando possibile.

### 26.3 Registrare una moto o un accessorio

1. Aprire uno stand.
2. Toccare **Nuovo prodotto**.
3. Inserire nome e scegliere **una categoria**.
4. Aggiungere prezzo/voto/nota/foto se desiderato.
5. Compilare eventualmente il questionario applicabile.
6. Premere **Salva**.
7. Bloccare la categoria.
8. Mostrare il prodotto nella lista, anche offline.

### 26.4 Riprendere una bozza

1. Iniziare la modifica di un prodotto.
2. Cambiare pagina senza premere Salva.
3. Ricevere avviso; scegliere di mantenere la bozza.
4. Tornare allo stesso prodotto e profilo.
5. Riprendere la bozza senza perdere i dati.
6. Salvare o scartare esplicitamente.

### 26.5 Risolvere un conflitto

1. Aprire Profilo → Sincronizzazione.
2. Selezionare il conflitto.
3. Confrontare versione locale e server.
4. Scegliere quale mantenere.
5. Confermare la risoluzione.
6. Inviare una nuova operazione versionata.
7. Verificare lo stato finale.

---

## 27. Matrice schermate e disponibilità

| Schermata/funzione | Mobile | Tablet | Desktop | Offline dopo bootstrap |
|---|---|---|---|---|
| Selezione profilo | Sì | Sì | Sì | Sì |
| Dashboard | Sì | Sì | Sì | Sì |
| Lista stand | Sì | Sì | Sì | Sì |
| Dettaglio stand | Sì | Sì | Sì | Sì |
| Nuovo stand personale | Sì | Sì | Sì | Sì |
| Lista prodotti | Sì | Sì | Sì | Sì |
| Nuovo/modifica prodotto | Sì | Sì | Sì | Sì |
| Questionari | Sì | Sì | Sì | Sì |
| Foto già salvate localmente | Sì | Sì | Sì | Sì |
| Confronto affiancato | No | Da decidere | Sì | Sì, se dati disponibili |
| Sync manuale | Sì | Sì | Sì | Richiede rete |
| Risoluzione conflitti | Sì | Sì | Sì | Richiede dati/versioni disponibili; conferma server quando online |
| Export JSON/PDF | Sì | Sì | Sì | Dipende dall'architettura export scelta |

---

## 28. Test funzionali UI

| ID | Caso | Risultato atteso |
|---|---|---|
| UI-01 | Primo avvio senza profilo | Selezione profilo |
| UI-02 | Profilo già selezionato | Apertura dashboard |
| UI-03 | Profilo disabilitato | Nuova selezione senza perdita dati |
| UI-04 | Cambio profilo con bozza | Avviso e isolamento bozza |
| UI-05 | Cambio profilo senza bozza | Dati aggiornati al nuovo profilo |
| UI-06 | Mobile | Quattro voci bottom nav visibili |
| UI-07 | Desktop | Navigazione equivalente |
| UI-08 | Stand senza padiglione | Nessuna posizione inventata |
| UI-09 | Ricerca stand offline | Risultati da cache locale |
| UI-10 | Filtri combinati | Risultati coerenti |
| UI-11 | Riapertura lista | Filtri e sort resettati |
| UI-12 | Dashboard → Da rivedere | Lista con filtro intenzionale |
| UI-13 | Stand editoriale | Campi condivisi non modificabili |
| UI-14 | Stand personale | Campi consentiti modificabili |
| UI-15 | Stand di altro profilo | Non accessibile come personale |
| UI-16 | Priorità 1 e 10 | Accettate |
| UI-17 | Priorità 0 o 11 | Rifiutate |
| UI-18 | Stato assente | Da visitare |
| UI-19 | Cambio stato | Non modifica note/prodotti |
| UI-20 | Cose da vedere | Stringhe modificabili senza checklist automatica |
| UI-21 | Prodotto senza categoria | Salva bloccato |
| UI-22 | Prodotto con due categorie | Impossibile |
| UI-23 | Categoria prima di Salva | Modificabile |
| UI-24 | Categoria dopo Salva offline | Immutabile |
| UI-25 | Prezzo vuoto | Nessun prezzo |
| UI-26 | Prezzo zero | Zero esplicito |
| UI-27 | Prezzo con virgola | Interpretato correttamente |
| UI-28 | Voto vuoto | Nessun voto |
| UI-29 | Voto 1–10 | Accettato |
| UI-30 | Voto 0/11 | Rifiutato |
| UI-31 | Questionario assente | Sezione nascosta |
| UI-32 | Questionario profilo diverso | Non mostrato |
| UI-33 | Domanda sì/no non compilata | Distinta da «No» |
| UI-34 | Questionario con risposte vuote | Salvataggio consentito |
| UI-35 | Foto aggiunta offline | Anteprima e blob persistenti |
| UI-36 | Permesso fotocamera negato | Errore gestito |
| UI-37 | Quota locale esaurita | Nessun falso successo |
| UI-38 | Modifica senza Salva | Solo bozza, non outbox |
| UI-39 | Salva offline | Conferma locale e outbox |
| UI-40 | Sync pendente | Non indicare «Sincronizzato» |
| UI-41 | Sync completata | Stato aggiornato |
| UI-42 | Conflitto | Entrambe le versioni visibili |
| UI-43 | Risoluzione conflitto | Nuova mutazione versionata |
| UI-44 | Eliminazione prodotto | Conferma obbligatoria |
| UI-45 | Eliminazione profilo JSON | Azione non disponibile |
| UI-46 | Eliminazione profilo dinamico | Doppia conferma |
| UI-47 | Confronto su mobile | Non disponibile |
| UI-48 | Confronto categorie diverse | Rifiutato |
| UI-49 | Export Excel | Non presente |
| UI-50 | Import dati | Non presente |
| UI-51 | Avvio offline senza cache | Messaggio primo bootstrap |
| UI-52 | Focus da tastiera | Visibile e coerente |
| UI-53 | Screen reader | Etichette significative |
| UI-54 | Zoom browser | Nessun contenuto essenziale perso |
| UI-55 | Tastiera mobile | Salva raggiungibile |
| UI-56 | Apertura deep link di altro profilo | Nessuna esposizione automatica |
| UI-57 | Cambio evento | Dati e filtri isolati |
| UI-58 | Aggiornamento JSON invalido | Ultimo snapshot valido mantenuto |
| UI-59 | PWA chiusa con sync pendente | Operazioni conservate |
| UI-60 | Navigazione durante upload | Nessuna perdita silenziosa |

---

## 29. Test visivi e accessibilità

### 29.1 Dispositivi e viewport

Verificare almeno:

- smartphone Android con dimensioni simili a Galaxy S25;
- smartphone con viewport più stretta;
- browser desktop a larghezza ridotta;
- desktop ampio;
- orientamento verticale e orizzontale;
- zoom 200%;
- tastiera virtuale aperta;
- tema e preferenze di contrasto, se supportati.

### 29.2 Accessibilità

Testare navigazione completa con tastiera, annunci errori, focus dialoghi, nomi accessibili dei pulsanti, leggibilità dei colori profilo, selettori numerici e foto. Integrare controlli automatici ma mantenere test manuali.

### 29.3 Resilienza

Simulare connessione lenta, passaggio online/offline, refresh durante modifica, IndexedDB non disponibile, quota esaurita, errore di upload e conflitto da secondo dispositivo.

---

## 30. Decisioni aperte

| ID | Tema | Proposta corrente | Impatto |
|---|---|---|---|
| UI-D01 | Palette definitiva | Token CSS e colore profilo | Design system |
| UI-D02 | Breakpoint desktop | Basato su spazio reale | Confronto prodotti |
| UI-D03 | Quali stand contano nella dashboard | Solo stand tracciati | `09`, `11`, `15` |
| UI-D04 | Quando uno stand diventa tracciato | Azione esplicita o prima modifica personale | Stand, dashboard |
| UI-D05 | Salvataggio del preferito | Azione esplicita immediata o form Salva | `17` |
| UI-D06 | Stand prodotto modificabile dopo Salva | Proposta: no | `17` |
| UI-D07 | Eliminazione stand con prodotti | Proposta: blocco | `16`, `17` |
| UI-D08 | Ereditarietà questionari | Matching esatto proposto | `10`, `18` |
| UI-D09 | Export offline | Da definire | `23` |
| UI-D10 | Limiti e compressione foto | Da definire | `21` |
| UI-D11 | Confronto su tablet | Da decidere | `22` |
| UI-D12 | Librerie form/query | Nessuna scelta imposta | Architettura |
| UI-D13 | Form stand con Salva unico o sezionale | Salva unico proposto | Persistenza |
| UI-D14 | Gestione budget UI | Per categoria/sottocategoria, senza totale | `04`, `15` |
| UI-D15 | Ordinamento predefinito | Alfabetico, priorità opzionale | `15`, `16` |

Le proposte non ancora approvate devono rimanere modificabili prima della scrittura del codice.

---

## 31. Criteri di accettazione

- [ ] Interfaccia mobile-first con bottom navigation Dashboard, Stand, Prodotti, Profilo.
- [ ] Profilo attivo chiaramente visibile e selezionabile senza login.
- [ ] Cambio profilo non mescola dati o bozze.
- [ ] Header con evento e stato sync comprensibile.
- [ ] Catalogo consultabile offline dopo bootstrap.
- [ ] Posizioni degli stand mostrate solo se disponibili e verificate.
- [ ] Stand editoriali e personali distinti in modo corretto.
- [ ] Ricerca, filtri e ordinamenti funzionano anche offline.
- [ ] Filtri resettati alla riapertura della lista, salvo deep link filtrato.
- [ ] Priorità stand e rating prodotto restano distinti.
- [ ] Stato stand con tre valori previsti e default Da visitare.
- [ ] Prodotti con una sola categoria, immutabile dopo il primo Salva locale.
- [ ] Prezzo e voto facoltativi e rappresentati senza valori inventati.
- [ ] Questionari applicati solo al profilo/categoria pertinente.
- [ ] Tutte le domande dei questionari facoltative.
- [ ] Foto disponibili offline dopo salvataggio locale.
- [ ] Bozze autosalvate ma non sincronizzate prima di Salva.
- [ ] Salva conferma la transazione locale e accoda la sync.
- [ ] Conflitti conservano e mostrano entrambe le versioni.
- [ ] Confronto affiancato disponibile solo desktop.
- [ ] Export JSON/PDF, senza import/Excel.
- [ ] Errori e stati vuoti con messaggi utili.
- [ ] Test accessibilità e responsive superati.
- [ ] Nessuna funzione di mappe, itinerari o navigazione indoor.

---

## 32. Collegamento ai prossimi documenti

**`15-dashboard.md`** dettaglierà le card statistiche, le regole di conteggio, le scorciatoie filtrate, i budget per categoria e gli stati vuoti. **`16-stand-management.md`** e **`17-product-management.md`** definiranno i workflow CRUD; **`18-questionnaire-engine.md`** il renderer dinamico; **`19-offline-storage.md`** e **`20-synchronization.md`** la persistenza; **`21-photo-management.md`** i media; **`22-comparison.md`** il confronto desktop; **`23-export.md`** JSON/PDF; **`26-testing.md`** la strategia complessiva di verifica.

**Nota finale:** questo documento è una specifica di progettazione. Non introduce file JSON reali, non avvia l'implementazione e non attribuisce posizioni ufficiali a stand EICMA 2026.
