# ExpoTrack — Implementazione a piccoli passi

Questo README definisce **come lavoriamo**, un passo alla volta, sulla parte web mobile da fiera. Ogni step parte da una domanda concreta, produce un’implementazione circoscritta e termina con un risultato verificabile. Non autorizza a implementare l’intera applicazione in un’unica sessione.

**Stato corrente:** step da 00 a 11 accettati dall’utente; step 12 e 13 implementati insieme su richiesta e da verificare dall’utente. Gli step dal 14 in avanti non sono iniziati. Gli esiti sono riportati nel registro della singola consegna.

## Riferimenti e priorità

- [Specifica mobile corrente](docs/27_Specifiche_UI_Mobile.md): comportamenti, mockup, risposte A1–A9 e scelte operative.
- [Struttura del progetto](docs/02-project-structure.md): organizzazione generale, nei limiti compatibili con la specifica corrente.
- [Guida allo sviluppo](docs/development.md): avvio locale e comandi disponibili.
- [AGENTS.md](AGENTS.md): prima di scrivere codice Next.js, leggere le guide pertinenti della versione installata in `node_modules/next/dist/docs/`.

La specifica mobile prevale sui mockup superati e sugli esempi tecnici precedenti incompatibili. Questo piano organizza il lavoro senza riaprire le decisioni già prese: editor prodotto unico 05, schermata 08 sospesa, autosalvataggio locale poi server, nessuna modalità bozza, foto solo prodotto e budget/stand personali inclusi durante la fiera.

## Un solo step alla volta

1. Tu indichi lo step, per esempio: **«Implementa solo lo step 01»**. La domanda dello step ne definisce l’obiettivo; non è una richiesta di riconfermare requisiti già decisi.
2. Io leggo i riferimenti necessari e indico il piccolo risultato che realizzerò. Se manca una decisione realmente necessaria, pongo solo quella domanda e completo il lavoro indipendente dalla risposta.
3. Implemento esclusivamente lo step e le sue dipendenze già previste. Non aggiungo in anticipo funzionalità degli step successivi.
4. Eseguo le verifiche pertinenti e aggiorno questo README con stato, file, esiti e istruzioni per il controllo manuale.
5. Mi fermo e ti consegno il risultato: puoi provarlo, correggermi e fare il commit. Una correzione resta nello stesso step e viene verificata di nuovo.
6. Passo allo step successivo soltanto quando me lo chiedi. Il silenzio o il superamento dei test non valgono come via libera.

**I commit li gestisci tu.** Non eseguo commit, push o operazioni Git distruttive automaticamente. Il commit non è obbligatorio per continuare: puoi dirmi di procedere anche senza averlo fatto. Le modifiche già presenti nel repository restano distinte dal lavoro del nuovo step; niente `git add .` indiscriminato.

**Lingua dei commit:** titoli e messaggi di commit devono essere in inglese.

Uno step dovrebbe produrre un singolo cambiamento comprensibile. Se durante il lavoro risulta troppo ampio, lo divido qui in sottopassi numerati, per esempio `17a` e `17b`, e consegno soltanto il primo. Non considero una funzione completata se i suoi controlli non sono eseguibili o se il risultato dipende da codice ancora da realizzare.

## Priorità: sviluppo rapido e consumo contenuto di token

**L’app è prevista per un solo utilizzo in fiera.** Su richiesta dell’utente, privilegiare velocità di implementazione e pochi token, con una manutenibilità essenziale: codice comprensibile e riuso dove serve subito, senza progettare per evoluzioni future. Questa priorità guida le regole organizzative che seguono.

Scegliere la soluzione diretta più semplice che soddisfa lo step e il mockup. Limitare letture, spiegazioni e verifiche al necessario; evitare astrazioni preventive, frammentazione in tanti file, refactoring estetici, documentazione prolissa e ripetizioni di controlli già superati senza nuove modifiche o problemi. Fermarsi quando il risultato richiesto è raggiunto. Restano obbligatori lint e typecheck a fine step, i test mirati ai rischi concreti e la protezione dei dati; la fedeltà al mockup resta un requisito.

## Codice semplice e componenti riusabili

**Tutti i componenti React riusabili devono stare in `src/components/`.** Le pagine li compongono; non ricopiano pulsanti, campi, card, righe, dialoghi o sezioni comuni.

```text
src/
├── app/                       # Route, layout Next.js e composizione delle viste
├── components/                # Unica raccolta dei componenti React riusabili
│   ├── ui/                    # Button, Card, IconButton, StatusChip...
│   ├── layout/                # AppShell, TopBar, BottomNav...
│   ├── forms/                 # FormField, input, select, RatingSlider...
│   ├── feedback/              # EmptyState, SaveStatus, ConfirmDialog...
│   ├── profiles/              # ProfileRow e sezioni profilo
│   ├── stands/                # StandRow, StandChecklist...
│   ├── products/              # ProductRow, ProductEditor e sezioni
│   ├── questionnaires/        # QuestionField e controlli delle risposte
│   └── photos/                # PhotoGrid, PhotoViewer...
├── features/                  # Regole dei singoli ambiti, selettori e hook dedicati
├── lib/
│   ├── config/                # Lettura e validazione dei dati editoriali
│   ├── offline/               # IndexedDB, repository locali e outbox
│   ├── sync/                  # Push/pull, retry e dipendenze
│   └── server/                # Accesso database e servizi esclusivamente server
└── types/                     # Contratti realmente condivisi
```

La struttura cresce con gli step: non creare cartelle vuote, componenti inutilizzati o un framework interno prima di averne bisogno. Le configurazioni e i dati dimostrativi non devono essere incorporati nel markup dei componenti.

Regole da rispettare in ogni implementazione:

- Prima cercare il componente o la funzione esistente; estenderli con poche proprietà chiare quando il comportamento è lo stesso.
- Una responsabilità per componente. Estrarre una sezione se ha significato proprio o viene riusata; evitare sia pagine monolitiche sia decine di file senza utilità.
- Componenti visivi senza chiamate dirette al database, alla rete o a IndexedDB. Ricevono dati e callback; repository e hook gestiscono persistenza e coordinamento.
- Funzioni pure per filtri, conteggi e validazione. Una sola implementazione della regola, richiamata dalle diverse schermate.
- TypeScript rigoroso, nomi espliciti, niente `any` per aggirare errori e niente soppressioni di controlli senza motivazione.
- Rispettare lo [standard del codice](docs/code-style.md), applicato da `eslint.config.mjs` e `.editorconfig`; usare `npm run lint:fix` per le correzioni automatiche, senza disabilitare le regole per aggirare gli errori.
- Token semantici per colori e spaziature; niente palette duplicate nelle pagine. HTML semantico, etichette accessibili, focus visibile e target touch adeguati.
- Separare codice browser e server secondo le guide Next.js installate; non rendere tutta l’app client per comodità e non introdurre dipendenze server nei componenti condivisi.
- Nessuna nuova libreria se il codice nativo o una dipendenza già presente risolvono il problema con chiarezza. Documentare la scelta quando una dipendenza è utile.
- Nessuna astrazione preventiva o refactoring generale fuori dallo step. Niente doppio componente per la stessa UI con nomi diversi.

## Come verifichiamo e consegniamo

Alla fine di ogni step eseguire `npm run lint` e `npm run typecheck`, correggere eventuali errori e riportare gli esiti prima della consegna. Su richiesta dell’utente, non eseguire la build come controllo di fine step. Restano i test funzionali pertinenti e la procedura di validazione finale descritta sotto.

Il comando `test:unit`, introdotto nello step 04, verifica contratti e loader su fixture fittizie isolate; `test:integration`, dallo step 05, verifica repository e transazioni locali con IndexedDB emulato. Ampliare l’integrazione ad API/PostgreSQL e aggiungere E2E negli step pertinenti, documentandone l’impiego reale. I test dell’app devono coprire rischi concreti: isolamento profili/eventi, transazioni, recupero dati, validazione, conteggi e sincronizzazione. Non aggiungere test che si limitano a ripetere il markup o l’implementazione di un pulsante.

**Test mirati e stabili, su richiesta dell’utente:** non creare uno unit test per ogni funzione, componente o singolo dettaglio e non inseguire il 100% di copertura. Scegliere pochi casi significativi per regole di dominio, errori e integrità dei dati; usare test di integrazione quando verificano meglio un comportamento completo, evitando di ripetere gli stessi controlli a ogni livello.

Verificare risultati osservabili e contratti stabili, senza legare i test alla struttura interna del codice, alle chiamate fra funzioni private o all’ordine di operazioni equivalente. Modifiche di formattazione, punteggiatura dei testi, rinominazioni interne, spostamenti di codice e refactoring che conservano il comportamento non devono provocare fallimenti a cascata o richiedere la riscrittura sistematica dei test. Usare import condivisi o punti di accesso stabili quando utili; aggiornare i test quando cambia il comportamento richiesto, non per inseguire ogni dettaglio dell’implementazione.

**La parte grafica è esclusa dai test automatici**, inclusa la validazione finale: niente snapshot del markup o degli screenshot, confronti di pixel o asserzioni su colori, font, spaziature, dimensioni, classi CSS e struttura esatta del DOM. Non fissare nei test testi editoriali o punteggiatura, salvo contenuti che costituiscono un requisito funzionale. Gli eventuali test dei flussi UI verificano azioni ed effetti funzionali con selettori semantici stabili. Eventuali verifiche visive su viewport, temi e disposizione degli elementi restano manuali, senza introdurre test grafici da mantenere. Queste regole valgono per tutti gli step e per la procedura di validazione finale.

Quando si introduce persistenza, verificare refresh e riapertura; quando si introduce sync, rete assente/intermittente e riavvio. Prima dello step PWA il refresh senza rete dell’intera app **non è ancora una funzionalità garantita**: distinguere storage locale e cache della shell.

Ogni consegna deve indicare:

- **Risposta alla domanda:** cosa funziona ora e cosa resta agli step successivi.
- **Modifiche:** file toccati e componenti riusati/creati.
- **Verifiche eseguite:** comando e risultato, distinguendo test passati, non eseguiti e controlli manuali ancora da fare.
- **Come provarlo:** URL o comando effettivo, dati di partenza, azioni e risultato atteso; uno step tecnico può essere verificato tramite test o API anziché una schermata.
- **Punto di commit:** elenco dei soli file dello step e titolo suggerito, senza effettuare il commit.

Stati: `Da iniziare` → `In corso` → `Da verificare dall’utente` → `Accettato`. In caso di correzioni si torna `In corso`; `Bloccato` richiede una ragione concreta. «Accettato» si registra soltanto dopo il tuo riscontro, non automaticamente dopo i test. Un tuo «avanti» sul risultato consegnato vale come accettazione dello step precedente.

### Validazione finale a carico dell’assistente

Su richiesta dell’utente, al termine dell’intera implementazione nello **step 28 eseguirò io `npm run validate:final`**, leggerò il report, correggerò gli errori e ripeterò le verifiche necessarie prima della consegna finale. La procedura è in [docs/final-validation.md](docs/final-validation.md) ed è richiamata anche in `AGENTS.md` per le sessioni successive.

Durante gli step pertinenti collegare i test reali alle aree obbligatorie di `validation/final-evidence.json` e introdurre i comandi `test:unit`, `test:integration`, `test:e2e` quando servono. Il runner non considera sufficiente una build riuscita: suite o copertura mancanti impediscono la validazione; prove fisiche ancora pendenti mantengono l’esito incompleto. Non anticipare funzioni applicative solo per far passare il runner. I report generati sono in `validation-results/`, esclusi da Git.

## Registro degli step

L’ordine è intenzionale: prima fondamenta e funzioni locali verificabili, poi integrazione server e PWA. Le funzioni degli step futuri non devono sembrare già operative: usare stati vuoti o indicazioni corrette, senza simulare salvataggi o sincronizzazioni.

| Step | Risultato | Stato |
|---|---|---|
| 00 | Base di lavoro e controlli iniziali | Accettato |
| 01 | Token grafici e tipografia | Accettato |
| 02 | Componenti UI di base | Accettato |
| 03 | Shell mobile, navigazione e tema | Accettato |
| 04 | Contratti dati e dataset dimostrativo | Accettato |
| 05 | Persistenza locale e outbox | Accettato |
| 06 | Selezione e cambio profilo | Accettato |
| 07 | Lista stand e interessi | Accettato |
| 08 | Dettaglio stand e checklist | Accettato |
| 09 | Note dello stand | Accettato |
| 10 | Stand personali | Accettato |
| 11 | Dashboard con conteggi reali | Accettato |
| 12 | Creazione minima prodotto e selezione stand | Accettato |
| 13 | Modifica prodotto e descrizione | Accettato |
| 14 | Lista prodotti, duplicazione ed eliminazione | Da iniziare |
| 15 | Motore questionari e primi controlli | Da iniziare |
| 16 | Rating e scelte del questionario | Da iniziare |
| 17 | Acquisizione e salvataggio fotografie | Da iniziare |
| 18 | Galleria, principale ed eliminazione foto | Da iniziare |
| 19 | Budget per categoria | Da iniziare |
| 20 | Gestione profili e impostazioni | Da iniziare |
| 21 | Schema PostgreSQL e repository server | Da iniziare |
| 22 | API di bootstrap e lettura | Da iniziare |
| 23 | Invio modifiche, LWW e cancellazioni | Da iniziare |
| 24 | Ricezione modifiche e recupero della coda | Da iniziare |
| 25 | Upload degli originali fotografici | Da iniziare |
| 26 | Pagina sincronizzazione e indicatore | Da iniziare |
| 27 | Installabilità e shell offline PWA | Da iniziare |
| 28 | Collaudo del flusso completo e dati reali | Da iniziare |

### Step 00 — Qual è la base verificata da cui iniziamo?

**Implementazione:** controllare lo stato Git, le dipendenze e i comandi esistenti; annotare le modifiche già presenti e gli eventuali errori iniziali. Eseguire lint, typecheck e build prima di attribuire problemi a nuovo codice. Non riorganizzare l’app e non assorbire automaticamente le precedenti modifiche documentali nel prossimo step.

**Controllo:** la pagina iniziale si apre con `npm run dev`; esiti iniziali documentati e modifiche preesistenti riconoscibili. Gli eventuali problemi bloccanti vanno risolti in un sottopasso dedicato, senza proseguire nascondendoli.

### Step 01 — Quali colori, spaziature e caratteri userà tutta l’app?

**Implementazione:** introdurre i token semantici della specifica e la tipografia comune nei CSS globali. Preparare le varianti chiaro/scuro senza scaricare font a runtime. Non realizzare ancora le schermate funzionali.

**Controllo:** verificare il risultato sulla pagina iniziale, applicando entrambi i temi; colori e spaziature dipendono dagli stessi token, testo leggibile su viewport stretto. Consegna con anteprima locale e istruzioni esatte.

### Step 02 — Quali elementi possiamo riusare in tutte le schermate?

**Implementazione:** creare `src/components/` e i primi elementi realmente necessari: pulsanti, card, campi con label/errori, stato vuoto e indicazione di stato. Usarli nella pagina di verifica locale; documentarne proprietà e impiego in `src/components/README.md`. Dialoghi e componenti più specifici arriveranno al primo utilizzo.

**Controllo:** stati normale, disabilitato, focus ed errore riconoscibili nei due temi; label associate ai campi, nessun duplicato inline dei componenti introdotti. I componenti non dipendono dai dati ExpoTrack.

### Step 03 — Come ci muoviamo nell’app su telefono?

**Implementazione:** comporre `AppShell`, `TopBar`, `BottomNav` e scelta tema Automatico/Chiaro/Scuro. Quattro destinazioni Home/Stand/Prodotti/Profilo con contenuto iniziale esplicitamente vuoto; preferenza tema ricordata localmente.

**Controllo:** tab e indietro funzionano, elemento attivo riconoscibile, contenuto non coperto dalla barra; refresh mantiene il tema. Nessuna statistica o sincronizzazione fittizia nelle pagine iniziali.

### Step 04 — Con quali dati verificabili costruiamo le funzioni?

**Implementazione:** definire contratti minimi condivisi e un piccolo dataset dimostrativo separato dalla UI: eventi, profili, categorie, stand, interessi, pianificati e questionari. Aggiungere lettura/validazione essenziale e riferimenti stabili; non inventare dati reali EICMA.

**Controllo:** dataset valido caricabile e caso invalido respinto con messaggio utile; due profili con interessi diversi, ubicazione assente e almeno un pianificato. Nessun dato di catalogo hardcoded nel JSX.

### Step 05 — Come salviamo sul dispositivo senza perdere o mescolare dati?

**Implementazione:** introdurre IndexedDB dietro repository semplici e la struttura outbox, senza motore di rete. Persistenza atomica record/mutazione valida, input incompleti recuperabili sul record locale e separazione profilo/evento. Configurare solo i test automatici necessari a verificare queste proprietà.

**Controllo:** test di integrazione su commit/errore, refresh, isolamento fra due profili/eventi e mancato accodamento di payload invalidi. Nessuno store `drafts`. Indicare il comando effettivo dei test; nessun falso «Sincronizzato» senza server.

### Step 06 — Chi sta usando l’app e come cambia profilo?

**Implementazione:** realizzare 01 con `ProfileRow`, distinzione configurati/personali, selezione immediata e memorizzazione della scelta. Un profilo valido apre Home agli avvii successivi; cambio profilo da Profilo. La creazione personale arriva nello step 20.

**Controllo:** primo/secondo avvio, cambio profilo, scelta non più valida e isolamento dati. Nel frattempo un catalogo profili vuoto ha un messaggio corretto, senza pulsante creazione ancora privo di funzione.

### Step 07 — Come troviamo gli stand che ci interessano?

**Implementazione:** lista 03 con `StandRow`, ricerca, vista interessi/tutti, filtri e priorità decrescente. La stella modifica solo l’interesse e salva tramite il repository locale.

**Controllo:** confrontare i due profili; ricerca con accenti, azzeramento filtri, posizione mancante, stella persistita dopo refresh. Stato visita invariato dal tap sulla stella; filtri/scroll conservati tornando alla lista.

### Step 08 — Cosa dobbiamo vedere nello stand e cosa abbiamo già verificato?

**Implementazione:** dettaglio 04 con priorità, stato visita manuale e `StandChecklist`; sezioni distinte per pianificati e registrati. Riutilizzare righe e controlli esistenti. Le azioni prodotto diventano attive nello step 12.

**Controllo:** spunte con ID stabili e contatore corretto, stato/priorità persistenti per il profilo, nessun cambiamento automatico della visita. Nessuna mappa o fotografia stand; nessun pulsante apparentemente attivo senza destinazione.

### Step 09 — Come prendiamo appunti personali sullo stand?

**Implementazione:** vista dedicata 04a con textarea e `SaveStatus`, autosalvataggio tramite repository, ritorno al dettaglio. Un solo testo senza limite funzionale di caratteri.

**Controllo:** testo lungo, refresh, ritorno immediato e cambio profilo; appunti isolati e nessun salvataggio esplicito o cronologia. Un errore di scrittura non deve mostrare successo.

### Step 10 — Come aggiungiamo uno stand scoperto in fiera?

**Implementazione:** editor 04b per stand personali, accesso dalla lista e modifica dal dettaglio. Nome obbligatorio, dati posizione facoltativi, autosalvataggio e inizializzazione di interesse/stato; eliminazione con `ConfirmDialog` e controllo dei prodotti collegati.

**Controllo:** creazione e riapertura senza rete server, visibilità solo al proprietario, campi catalogo JSON non modificabili. Test del blocco cancellazione con prodotto collegato tramite fixture, senza dover anticipare l’editor prodotto.

### Step 11 — La Dashboard rappresenta davvero la visita del profilo?

**Implementazione:** quattro statistiche e fino a cinque stand prioritari da selettori condivisi; tap verso liste filtrate e dettaglio. Nessun secondo calcolo dei contatori nei componenti.

**Controllo:** test con interessi/non interessi, visitati/da rivedere, parità e priorità assenti; cambio profilo/evento, zero risultati e meno di cinque candidati. Il conteggio prodotti è inizialmente zero salvo fixture valida.

### Step 12 — Come registriamo un prodotto con il minimo indispensabile?

**Implementazione:** editor unico 05 e selettore stand 09, da Home/stand/lista prodotti. Campi iniziali stand, nome, categoria; precompilazione pianificati e prima registrazione automatica al raggiungimento dei dati minimi validi, con blocco categoria/stand.

**Controllo:** semplice apertura senza creazione; dati parziali recuperati dopo refresh, nessun payload invalido in coda, prima registrazione valida conteggiata. Riapertura dello stesso pianificato senza duplicazione; nessun percorso verso 08.

### Step 13 — Come aggiorniamo un prodotto e le nostre impressioni?

**Implementazione:** completare 05 con prezzo, voto generale facoltativo/rimuovibile, preferito e descrizione unica 05b. Autosalvataggio di ogni modifica e recupero degli input temporaneamente invalidi, riusando i campi condivisi.

**Controllo:** distinguere prezzo assente/zero e voto assente/1; testo lungo senza troncamento. Nome temporaneamente vuoto non distrugge l’ultima versione valida; ritorno e refresh non perdono l’input. «Fine» naviga senza conferma Salva.

### Step 14 — Come ritroviamo, duplichiamo o eliminiamo i prodotti?

**Implementazione:** lista 07 con `ProductRow`, ricerca, filtri e ordinamento recenti, pianificati/registrati insieme. Apertura sempre in 05; duplica ed elimina nell’editor con repository e dialogo condiviso.

**Controllo:** filtri combinati e ritorno alla lista; copia con nuovo ID, descrizione conservata e nessuna foto. Elimina richiede conferma e accoda tombstone; salvare prodotto non cambia visita stand.

### Step 15 — Come carichiamo il questionario corretto senza codificare le domande nelle pagine?

**Implementazione:** risoluzione esatta profilo/categoria, versione della definizione, sezione inline e renderer condiviso; primi controlli testo, numero e sì/no. Risposte facoltative autosalvate.

**Controllo:** due profili con domande diverse, nessun questionario applicabile, risposta non compilata distinta da No, numero invalido e snapshot storico. Zero domande inventate o duplicate nel markup.

### Step 16 — Come rispondiamo con voti e scelte configurabili?

**Implementazione:** completare il renderer con rating 1–10, scelta singola/multipla e dettaglio focalizzato 05a. `RatingSlider` condiviso con il voto generale; spunta come indicatore di risposta presente.

**Controllo:** nessun voto preassegnato, risposta cancellabile, scelte salvate per ID e ripristinate dopo refresh. Indietro non annulla risposte; nessuna foto, bozza o conferma Salva risposta nel dettaglio domanda.

### Step 17 — Come conserviamo subito le foto originali sul telefono?

**Implementazione:** acquisizione da fotocamera/galleria, validazione file, anteprime derivate e salvataggio atomico di originali/metadati. Collegare a prodotto e outbox con dipendenze, senza upload server ancora attivo.

**Controllo:** foto riapribile dopo refresh con rete server assente, originale invariato, errori permessi/formato/quota senza falso successo. Foto mantenuta se il prodotto è ancora incompleto; nessuna fotografia stand.

### Step 18 — Come consultiamo e organizziamo le foto raccolte?

**Implementazione:** `PhotoGrid`, `PhotoViewer`, scelta principale ed eliminazione con conferma; riusare il viewer senza attivare 08. Gestire sostituzione principale e pulizia sicura dei soli asset non più referenziati.

**Controllo:** apertura/chiusura con ripristino focus, principale persistente, eliminazione annullata/confermata, griglia vuota e riferimenti ancora usati da operazioni pendenti. Nessun pulsante Informazioni foto.

### Step 19 — Come confrontiamo un prezzo con il budget della categoria?

**Implementazione:** 11a in Profilo, budget profilo/categoria con override ed esclusione esplicita del seed; importo e differenza nell’editor 05. Riutilizzare campi monetari e selezione categoria.

**Controllo:** budget assente/zero, due profili, categoria esatta senza ereditarietà, rimozione override distinta da «Nessun budget», persistenza locale e riuso fra eventi. Nessuna somma dei prezzi come spesa sostenuta.

### Step 20 — Come gestiamo profili personali ed evento attivo?

**Implementazione:** creazione/modifica profilo personale, nome/colore e icona standard; doppia conferma eliminazione con gestione delle dipendenze. Completare impostazioni con evento a tendina, tema già condiviso e informazioni app.

**Controllo:** identità JSON non modificabile/eliminabile, profilo personale senza questionario automatico, cambio contesto senza perdita di input/operazioni. Niente reset personalizzazioni, descrizione profilo o selettore icone.

### Step 21 — Come rappresentiamo gli stessi dati sul server?

**Implementazione:** scegliere un accesso PostgreSQL semplice, introdurre migrazioni versionate e repository server per i contratti già usati localmente. Modellare revisioni, idempotenza, tombstone e riferimenti media senza esporre credenziali al browser.

**Controllo:** migrazione su database di test isolato e test di integrità, proprietà, categoria/stand immutabili e budget/checklist. Non modificare o azzerare il database di sviluppo per far passare i test.

### Step 22 — Come carichiamo catalogo e dati server con contratti verificabili?

**Implementazione:** API di bootstrap/lettura con validazione dei JSON, snapshot coerente e perimetro profilo/evento. Collegare l’aggiornamento dei cataloghi al repository locale, preservando override e dati personali.

**Controllo:** richieste ripetibili documentate e test di configurazione valida/invalida, riferimenti mancanti, profilo errato e server non raggiungibile. Un aggiornamento catalogo non cancella raccolte locali né riaccende interessi esclusi.

### Step 23 — Come inviamo le modifiche senza duplicarle?

**Implementazione:** push dell’outbox, applicazione atomica sul server, LWW per record nell’ordine di accettazione, retry idempotente e protezione cancellazioni. Nessuna scelta manuale della versione.

**Controllo:** due dispositivi sullo stesso record, retry dopo risposta persa, stesso ID con payload diverso, update tardivo contro tombstone. Verifiche API/database prima di collegare l’intera UI.

### Step 24 — Come riceviamo aggiornamenti senza perdere quelli locali?

**Implementazione:** pull incrementale, cursori, conferme persistenti, ordine per record e ripresa automatica della coda. Proteggere input locali successivi e recuperare gli update respinti come nuovi elementi.

**Controllo:** crash fra risposta e commit locale, cursor scaduto, modifiche locali durante pull, code di due profili/eventi e recupero da cancellazione. Nessuna riapplicazione di operazioni già confermate.

### Step 25 — Come trasferiamo gli originali fotografici al server?

**Implementazione:** endpoint media, controlli di integrità e upload automatico dipendente dal prodotto; retry e progresso senza bloccare la UI. Collegare lo storage server ai metadati senza pubblicare file incompleti.

**Controllo:** upload interrotto/ripetuto, hash discordante, prodotto cancellato durante invio e spazio server insufficiente. Il file locale resta disponibile e non viene eliminato per un semplice errore di rete.

### Step 26 — Come capiamo cosa è salvato e cosa è ancora in attesa?

**Implementazione:** indicatore condiviso e pagina 10 con stato reale, totale operazioni del dispositivo, dettagli del contesto attivo, sottoinsieme foto, errori e comando manuale. Riutilizzare `SaveStatus` senza simulare l’esito del server.

**Controllo:** numero corretto con foto conteggiate una volta, errori inclusi, cambio profilo, retry e coda svuotata. Sync automatica sempre attiva, entrambe le reti, nessun toggle superfluo; «Sincronizzato» soltanto a conferma avvenuta.

### Step 27 — Come apriamo l’app anche senza rete e la installiamo sul telefono?

**Implementazione:** manifest, icone e cache della shell PWA; aggiornamento controllato degli asset e bootstrap necessario al primo uso. Preservare dati personali e outbox durante aggiornamenti.

**Controllo:** su build di produzione, primo caricamento online seguito da modalità aereo, refresh, chiusura/riapertura e installazione sul dispositivo di riferimento. Primo accesso mai preparato senza rete gestito correttamente; nessuna promessa di sync a PWA chiusa.

### Step 28 — Il flusso completo è pronto per l’utilizzo in fiera?

**Implementazione:** integrare i dati reali disponibili e risolvere soltanto i difetti emersi dal collaudo. Non inventare catalogo o posizioni mancanti: registrare quali dati devono ancora essere forniti. Niente nuove funzionalità o rifacimento generale finale.

**Controllo:** profilo → interessi → stand/checklist → prodotto → questionario → descrizione → foto → refresh offline → sync → riapertura su altro dispositivo. Verificare anche stand personale, budget, cancellazioni, temi, accessibilità e tastiera su telefono reale. Build e criteri di accettazione della specifica verificati; annotare limiti residui. La pubblicazione richiede un’attività separata esplicitamente richiesta.

## Registro della singola consegna

Al termine di ogni step compilare una voce con questo formato. Finché non esiste una voce, non dichiarare lo step implementato.

```text
Step: NN — titolo
Stato: Da verificare dall’utente
Domanda: ...
Risultato implementato: ...
File dello step: ...
Componenti riusati / introdotti: ...
Verifiche eseguite ed esito: ...
Come provarlo (URL/comando, azioni, risultato atteso): ...
Controlli non eseguiti o limiti noti: ...
Commit suggerito: ...
Riscontro dell’utente / correzioni: ...
```

### Consegna step 00 — Base di lavoro e controlli iniziali

- **Data:** 28 ottobre 2026.
- **Stato:** Accettato.
- **Domanda:** Qual è la base verificata da cui iniziamo?
- **Risultato:** base Next.js verificata senza modifiche al codice applicativo. Pagina iniziale servita correttamente in sviluppo e build di produzione completata. Nessuna funzione degli step successivi implementata.
- **Stato Git iniziale:** al commit `94b6672` (`Add mockup images for various app screens and logos`), `git status --porcelain=v1` non riportava modifiche o file non tracciati. Nessuna modifica documentale preesistente da separare.
- **Ambiente e dipendenze:** Node.js `22.16.0`, npm `10.9.2`, Next.js `16.4.3`, React/React DOM `19.3.1`, TypeScript `5.9.3`. Node rispetta il requisito `>=22.14.0`. Dipendenze dirette di `package.json` allineate al lockfile; `npm ls --depth=0` termina con codice 0. Sono presenti sei pacchetti segnalati come `extraneous` nell’installazione locale (`@emnapi/core`, `@emnapi/runtime`, `@emnapi/wasi-threads`, `@img/sharp-wasm32`, `@napi-rs/wasm-runtime`, `@tybys/wasm-util`), senza impedire i controlli. Nessuna reinstallazione, aggiornamento o modifica al lockfile effettuata.
- **File dello step:** solo `README_IMPLEMENTAZIONE.md` (stato del piano e questa consegna). I file generati in `.next/` e gli altri output già ignorati non fanno parte del commit.
- **Componenti riusati / introdotti:** nessuno; pagina e layout iniziali invariati.

**Verifiche eseguite:**

| Comando / controllo | Esito |
|---|---|
| `npm run lint` | Superato, codice 0, nessun warning. |
| `npm run typecheck` | Superato, codice 0; tipi delle route generati e TypeScript senza errori. |
| `npm run build` | Superato, codice 0; `/` e `/_not-found` prerenderizzate. |
| `npm run dev` e richiesta HTTP a `http://localhost:3000/` | Server avviato; HTTP 200, lingua `it`, titolo ExpoTrack e testo «Applicazione in fase di sviluppo.» presenti nell’HTML. Server arrestato al termine della verifica. |
| `git status --short` dopo le verifiche, prima dell’aggiornamento di questo file | Nessuna modifica ai file tracciati o nuovo file non tracciato. |

**Problemi iniziali e diagnosi:** nell’ambiente limitato dell’agente, la prima build è fallita con `binding to a port / Operation not permitted` durante PostCSS; anche il primo avvio dev era impedito da `listen EPERM` sulla porta 3000. L’esecuzione con permessi aggiuntivi ha consentito avvio e richiesta HTTP. Per la build è stato necessario rimuovere anche la sola cache generata `.next/cache/turbopack`, che conservava l’errore, e ripetere `npm run build` con gli stessi permessi: esito positivo. Come tentativo diagnostico, `npm run build -- --webpack` nell’ambiente limitato ha restituito `Could not parse output from TypeScript’s --showConfig`; `tsc --showConfig` eseguito direttamente era valido. Non è stato cambiato il bundler configurato né disattivato alcun controllo; la build finale usa Turbopack. Build e dev non sono stati eseguiti contemporaneamente.

**Come provarlo:**

1. Dalla root eseguire `npm run lint`, `npm run typecheck` e `npm run build`: ciascun comando deve terminare senza errori. Arrestare prima un eventuale dev server.
2. Eseguire `npm run dev` e aprire [http://localhost:3000](http://localhost:3000).
3. Verificare il titolo «ExpoTrack», l’introduzione sulle visite e il messaggio «Applicazione in fase di sviluppo.». La pagina è ancora il segnaposto iniziale.
4. Arrestare il server con `Ctrl+C`.

**Controlli non eseguiti / limiti:** la verifica HTTP non equivale a un controllo visivo in browser; quest’ultimo resta da eseguire dall’utente. Nessun test PostgreSQL, API o persistenza: l’app iniziale non usa ancora il database. I temi e la verifica UI chiaro/scuro appartengono agli step successivi.

**Punto di commit:** unico file `README_IMPLEMENTAZIONE.md`; titolo suggerito `docs: record step 00 baseline verification`. Nessun commit o push effettuato.

**Riscontro dell’utente / correzioni:** l’utente conferma «funziona» e richiede commit in inglese; step accettato. Lo step 01 parte soltanto su richiesta.

### Consegna step 01 — Token grafici e tipografia

- **Data:** 28 ottobre 2026.
- **Stato:** Accettato.
- **Domanda:** Quali colori, spaziature e caratteri userà tutta l’app?
- **Risultato:** token semantici globali per colori, tipografia, spaziature, raggi, target touch e focus. Tema automatico tramite `prefers-color-scheme`, con override CSS `data-theme="light"` / `data-theme="dark"` su `<html>`. La pagina iniziale usa questi token per verificare il risultato. Nessuna schermata funzionale, selettore tema o persistenza introdotta.
- **File dello step:** `src/app/globals.css`, `src/app/page.tsx`, `README_IMPLEMENTAZIONE.md`. Repository pulito all’inizio di questo step; nessuna modifica a dipendenze, lockfile o layout.
- **Componenti riusati / introdotti:** nessun nuovo componente React; aggiornata la pagina iniziale esistente. I componenti condivisi arriveranno nello step 02.

**Uso dei token:**

- Colori tramite `var(--bg)`, `var(--surface)`, `var(--text)`, `var(--primary)` e gli altri nomi della specifica. Le utility Tailwind (`bg-surface`, `text-primary`, `text-text-muted`, `border-border`, ecc.) risolvono agli stessi token. `--on-primary` definisce il testo leggibile sul blu nei due temi.
- Font: `Inter` se installato sul dispositivo, altrimenti `system-ui`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `sans-serif`. Nessun font remoto o nuovo asset scaricato dall’app; il fallback di sistema è intenzionale. Titoli pagina 24 px/700, sezioni 18 px/650, corpo 16 px, label 14 px, caption 13 px alla dimensione testo standard. Le dimensioni dei caratteri sono in `rem` per consentire l’ingrandimento.
- Spaziature `--space-1/2/3/4/6/8`: 4/8/12/16/24/32 CSS px; margine pagina 16 px (`p-page`), distanza di sezione 24 px (`p-section`, `gap-section`). Le utility numeriche Tailwind usano la stessa base da 4 px. Gli spazi restano stabili quando aumenta solo il testo. Raggi input/card/dialog 12/16/20 px; target touch disponibile da 48 px (`min-h-touch`, `min-w-touch`).
- `h1`, `h2` e `h3` applicano la tipografia globale; sono disponibili anche `text-page-title`, `text-section-title`, `text-body`, `text-label`, `text-caption`. Focus visibile globale con contorno blu da 2 px e distacco di 3 px. La pagina attuale non contiene controlli interattivi o animazioni.

**Adeguamenti alla palette proposta:** per raggiungere almeno 4,5:1 anche sullo sfondo `--surface-muted`, nel tema chiaro `--text-muted` passa da `#64748B` a `#5F6F85`, `--success` da `#15803D` a `#147D3C`, `--warning` da `#B45309` a `#B05209`, `--danger` da `#DC2626` a `#D62525`. Gli altri colori della proposta restano invariati. L’arancione `--brand-accent` è usato solo come decorazione; il bordo tenue è un divisore, non l’unico indicatore di un controllo o di uno stato.

**Verifiche eseguite:**

| Comando / controllo | Esito |
|---|---|
| `npm run lint` | Superato, nessun warning. |
| `npm run typecheck` | Superato. |
| `npm run build` | Superato con Turbopack; nessun dev server attivo durante la build. |
| `npm run start` e Chromium headless sulla build di produzione | HTTP 200; sei combinazioni tra preferenza di sistema e override esplicito verificate. |
| Layout e tipografia calcolati nel browser | Dodici combinazioni: larghezze 320/390/1280 px, entrambi i temi, testo normale e al 200%. Nessuno scorrimento orizzontale; margini pagina 16 px, padding del riquadro 24 px, raggio 16 px; corpo/titolo 16/24 px oppure 32/48 px con testo ingrandito. |
| Contrasto dei token | Minimo 4,53:1 per testo principale, secondario, blu operativo, successo, attesa ed errore su sfondo pagina e sulle due superfici, nei due temi. Verificato anche il testo su blu. Questo controllo non costituisce un audit WCAG completo. |
| Focus e rete | Focus da tastiera con contorno 2 px verificato su un link temporaneo inserito solo nel DOM del browser e poi rimosso; nessun errore JavaScript, richiesta esterna o caricamento font. |
| Anteprime | Ispezionate le schermate a 320 px nei due temi, con testo normale e ingrandito al 200%. Il titolo può andare a capo tra «Expo» e «Track». |

Playwright, Chromium e le librerie necessarie alla verifica sono stati preparati esclusivamente in `/tmp/expotrack-ui-check`; non fanno parte del progetto. Il primo tentativo del browser non partiva per librerie condivise mancanti, poi recuperate nella stessa directory temporanea. La build ha richiesto i permessi aggiuntivi per le porte locali già necessari nello step 00. Il server di produzione è stato arrestato al termine dei controlli.

**Come provarlo:**

1. Eseguire `npm run dev` dalla root e aprire [http://localhost:3000](http://localhost:3000). La pagina resta un segnaposto, ora con tipografia comune, riquadro e colori ExpoTrack.
2. Cambiare la preferenza chiaro/scuro del sistema oppure emulare `prefers-color-scheme` nel pannello Rendering degli strumenti di sviluppo: la pagina si adegua automaticamente.
3. Per forzare il tema dalla console del browser eseguire `document.documentElement.dataset.theme = "dark"`, poi `document.documentElement.dataset.theme = "light"`. Tornare al tema automatico con `delete document.documentElement.dataset.theme`. Gli override di verifica non sono persistiti e si azzerano al refresh.
4. Impostare una viewport da 320 px. Per ingrandire soltanto il testo eseguire `document.documentElement.style.fontSize = "200%"`; verificare che tutto resti leggibile e raggiungibile scorrendo in verticale. Ripristinare con `document.documentElement.style.fontSize = ""`.
5. Arrestare il server con `Ctrl+C`. Per provare la build di produzione, usare `npm run build` e poi `npm run start`, senza dev server contemporaneo.

**Controlli non eseguiti / limiti:** restano il riscontro dell’utente e la prova su telefono reale e altri browser. Il font effettivo dipende dai font installati sul dispositivo. Il selettore tema persistito, la barra inferiore e la shell mobile appartengono allo step 03; non sono ancora presenti. Non sono state aggiunte funzionalità offline, dati o sincronizzazione.

**Punto di commit:** solo i tre file dello step elencati sopra; titolo suggerito `feat: add design tokens and shared typography`. Nessun commit o push effettuato.

**Riscontro dell’utente / correzioni:** l’utente conferma «fatto e funziona»; step accettato. Lo step 02 parte soltanto su richiesta.

### Consegna trasversale — Script di validazione finale

- **Richiesta:** predisporre ora uno script che l’assistente eseguirà al termine dell’intera implementazione per verificare il risultato effettivo.
- **Stato:** Da verificare dall’utente; nessun avanzamento dello step 02.
- **Risultato:** comando `npm run validate:final`, con prerequisiti obbligatori, suite reali da collegare durante gli step pertinenti, build prima degli E2E, database di test distinto, report JSON ed esiti separati per successo, errore e prove su dispositivo pendenti. Nessuna dipendenza aggiunta.
- **File:** `scripts/validate-final.mjs`, `validation/final-evidence.json`, `docs/final-validation.md`, `package.json`, `.gitignore`, `AGENTS.md`, `docs/development.md`, `README_IMPLEMENTAZIONE.md`.
- **Verifiche:** lint e typecheck superati nella consegna iniziale. `npm run validate:final -- --preflight` termina con codice 1 e stato `not-ready`: attualmente mancano il database di test configurato, le tre suite dell’app e i relativi collegamenti ai casi obbligatori. Nessun controllo applicativo viene spacciato per eseguito.
- **Come provarlo:** `npm run validate:final -- --preflight` deve elencare i prerequisiti ancora da implementare. I report vengono scritti in `validation-results/`, esclusi da Git. Procedura e mappa dei comportamenti in [docs/final-validation.md](docs/final-validation.md).
- **Limiti:** nessuna validazione finale dell’app eseguita ora e nessun nuovo test applicativo fittizio. La build non è stata ripetuta per questa attività: non cambiano codice app, route, layout o dipendenze. Le prove fisiche non disponibili rimarranno pendenti, senza dichiararle superate.
- **Esecuzione finale:** a carico dell’assistente nello step 28, come registrato anche in `AGENTS.md`; correggere gli errori e ripetere i controlli prima della consegna finale.
- **Commit suggerito:** `chore: add final implementation validation runner`. Nessun commit o push effettuato.
- **Riscontro dell’utente / correzioni:** l’utente richiede di mantenere lo script per eseguire i comandi e rimuovere i test dello script stesso; rimossi il file di test, il comando npm dedicato e i relativi riferimenti.

### Consegna trasversale — Standard del codice

- **Richiesta:** definire uno standard moderno di formattazione e qualità, applicarlo al codice esistente e documentare tutte le regole.
- **Stato:** Da verificare dall’utente; nessun avanzamento dello step 02.
- **Risultato:** estesa la configurazione ESLint esistente con ESLint Stylistic, regole JavaScript e controlli TypeScript basati sui tipi; aggiunti `npm run lint:fix`, `.editorconfig` e il catalogo completo in [docs/code-style.md](docs/code-style.md). Standard richiamato anche in `AGENTS.md`.
- **File:** `eslint.config.mjs`, `.editorconfig`, `package.json`, `package-lock.json`, `scripts/validate-final.mjs`, `src/app/layout.tsx`, `src/app/page.tsx`, `docs/code-style.md`, `AGENTS.md`, `README_IMPLEMENTAZIONE.md`.
- **Verifiche:** `npm run lint` e `npm run typecheck` superati. Verifica diretta tramite API ESLint di rilevamento delle violazioni di stile, rilevamento di `any` e Promise non gestite, e stabilità dell’autocorrezione alla seconda applicazione. Nessun file di test aggiunto. `git diff --check` superato.
- **Come provarlo:** `npm run lint:fix` applica le correzioni automatiche; `npm run lint` e `npm run typecheck` devono terminare senza errori. La build non è stata eseguita, come richiesto.
- **Commit suggerito:** `chore: enforce code style and typed lint rules`. Nessun commit o push effettuato.

### Consegna step 02 — Componenti UI di base

- **Data:** 29 ottobre 2026.
- **Stato:** Accettato.
- **Domanda:** Quali elementi possiamo riusare in tutte le schermate?
- **Risultato implementato:** pulsanti primario/secondario, card, campo testuale con label/hint/errore, stato vuoto con azione facoltativa e indicatore di stato testuale. Componenti indipendenti dai dati ExpoTrack, basati sui token dello step 01. Pagina iniziale composta con questi elementi e dimostrazione interattiva di errore, validazione, azzeramento e compilazione del campo. Stati disabilitati nativi con spiegazione; label associate, descrizioni accessibili, errore testuale e ritorno del focus al campo invalido. Nessun salvataggio o stato di sincronizzazione simulato.
- **Stato Git iniziale:** working tree pulito; nessuna modifica preesistente da separare.
- **File dello step:** `src/app/page.tsx`, `src/components/ui/Button.tsx`, `src/components/ui/Card.tsx`, `src/components/ui/StatusChip.tsx`, `src/components/forms/TextField.tsx`, `src/components/feedback/EmptyState.tsx`, `src/components/examples/ComponentPreview.tsx`, `src/components/README.md`, `README_IMPLEMENTAZIONE.md`.
- **Componenti riusati / introdotti:** riusati i token e il focus globale esistenti; introdotti `Button`, `Card`, `TextField`, `EmptyState`, `StatusChip` e la dimostrazione `ComponentPreview`. Proprietà e impiego documentati in [src/components/README.md](src/components/README.md). Nessuna nuova dipendenza o modifica alle regole di lint.

**Verifiche eseguite:**

| Comando / controllo | Esito |
|---|---|
| `npm run lint:fix` | Superato; applicata la formattazione automatica senza disabilitare regole. |
| `npm run lint` | Superato, codice 0, nessun warning. |
| `npm run typecheck` | Superato, codice 0; generazione tipi route e TypeScript senza errori. |
| `npm run dev` e richiesta HTTP a `http://localhost:3000/` | HTTP 200; pagina compilata e servita senza errori. Nell’HTML restituito verificati titolo, label e descrizioni associate agli input, stati disabilitati nativi e tipi dei pulsanti. Server arrestato dopo la prova. |
| `git diff --check` | Superato. |

L’avvio dev nell’ambiente limitato ha restituito `listen EPERM` sulla porta 3000; avvio e richiesta HTTP locale con permessi aggiuntivi sono riusciti. La verifica dell’HTML è una prova temporanea, senza aggiungere suite di test o snapshot da mantenere.

**Come provarlo:**

1. Eseguire `npm run dev` e aprire [http://localhost:3000](http://localhost:3000). La pagina contiene l’introduzione e la verifica dei componenti dello step 02.
2. Premere **Verifica campo** senza testo o con soli spazi: appare un errore vicino al campo, il focus torna all’input e l’esito indica l’errore. Scrivere testo e verificare nuovamente: compare l’esito positivo della sola prova locale.
3. Premere **Azzera la prova**: testo, errore ed esito vengono rimossi. L’azione **Compila il campo di prova** nello stato vuoto riempie il campo e vi porta il focus. Campo e pulsante disabilitati non accettano interazione.
4. Provare Tab/Shift+Tab e Invio, clic sulla label, zoom testo e viewport stretta. Ripetere nei temi chiaro/scuro del sistema; in alternativa, dalla console impostare `document.documentElement.dataset.theme = "dark"` o `"light"` e ripristinare con `delete document.documentElement.dataset.theme`.

**Controlli non eseguiti / limiti:** nessun browser disponibile nell’ambiente: interazioni dopo l’idratazione, resa visiva dei due temi, focus visibile, zoom e prova su telefono restano da verificare manualmente. La prova HTTP non li certifica. Nessun test grafico automatico introdotto. Build non eseguita, come richiesto; validazione finale prevista allo step 28. Il selettore tema persistente e la navigazione appartengono allo step 03; dialoghi, textarea e componenti specifici arriveranno al primo utilizzo. Nessuna persistenza o funzionalità di dominio anticipata.

**Punto di commit:** soltanto i nove file elencati sopra; titolo suggerito `feat: add reusable base UI components and local preview`. Nessun commit o push effettuato.

**Riscontro dell’utente / correzioni:** su richiesta dell’utente, i chip hanno ora sfondo pieno colorato in tutte le varianti, con testo adattato al tema chiaro/scuro. Dopo la correzione, `npm run lint` e `npm run typecheck` sono stati eseguiti con esito positivo. Il 29 ottobre 2026 l’utente richiede «Segna lo step 2 chiuso»: step accettato e chiuso. Lo step 03 non è stato avviato.

### Consegna step 03 — Shell mobile, navigazione e tema

- **Data:** 29 ottobre 2026.
- **Stato:** Accettato.
- **Domanda:** Come ci muoviamo nell’app su telefono?
- **Risultato implementato:** shell mobile condivisa con intestazione, quattro destinazioni Home/Stand/Prodotti/Profilo e area principale scorrevole. Header e barra inferiore restano visibili in righe separate: l’altezza reale della barra non copre i contenuti, anche quando il testo aumenta. Safe area sui quattro lati, viewport dinamico e zoom consentito. Link Next.js reali con cronologia indietro/avanti; tab corrente riconoscibile tramite sfondo pieno, testo e `aria-current`. Pagine iniziali con stati vuoti espliciti. In Profilo, scelta Automatico/Chiaro/Scuro ricordata localmente, applicata all’avvio prima del rendering e aggiornata fra schede; valori non validi tornano ad Automatico. Se lo storage fallisce, il tema resta utilizzabile nella sessione con messaggio e possibilità di ritentare. Selettore attivo dopo l’idratazione per evitare interazioni senza persistenza. La demo dello step 02 è ora separata in `/examples/components`.
- **Stato Git iniziale:** working tree pulito; step 02 già chiuso e registrato dall’utente.
- **File dello step:** `src/app/layout.tsx`, `src/app/globals.css`, rimozione di `src/app/page.tsx` a favore di `src/app/(app)/page.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/stands/page.tsx`, `src/app/(app)/products/page.tsx`, `src/app/(app)/profile/page.tsx`, `src/app/examples/components/page.tsx`, `src/components/layout/AppShell.tsx`, `src/components/layout/TopBar.tsx`, `src/components/layout/BottomNav.tsx`, `src/components/layout/NavigationIcon.tsx`, `src/components/layout/navigation.ts`, `src/components/layout/ThemeController.tsx`, `src/components/forms/ThemeSelector.tsx`, `src/lib/theme.ts`, `next.config.ts`, `src/components/README.md`, `docs/development.md`, `README_IMPLEMENTAZIONE.md`.
- **Componenti riusati / introdotti:** riusati `Card`, `EmptyState`, `Button`, `ComponentPreview` e token esistenti; introdotti i componenti della shell, icone SVG locali e selettore tema. Pagine e shell restano Server Components; client soltanto per percorso corrente e preferenza tema. Indicatore di sviluppo Next.js spostato in alto a destra perché in basso intercettava il link Home. Nessuna nuova dipendenza.

**Verifiche eseguite:**

| Comando / controllo | Esito |
|---|---|
| `npm run lint:fix` | Superato; nessuna regola disabilitata o indebolita. |
| `npm run lint` | Superato, codice 0, nessun warning. |
| `npm run typecheck` | Superato, codice 0, anche dopo la rimozione della copia temporanea. Rigenerati i tipi; rimosso il solo validatore generato obsoleto che puntava alla pagina spostata. |
| `git diff --check` | Superato. |
| Chromium / Playwright, prova funzionale temporanea | Superata con codice 0: quattro destinazioni, link corrente, indietro/avanti, tre preferenze persistite dopo refresh e cambio pagina, aggiornamento fra schede e rimozione della preferenza, valore invalido, quota simulata e ritenta, storage completamente negato, radio da tastiera e salto al contenuto. Verificata anche la demo spostata con validazione del campo e ritorno a Home. Nessun errore JavaScript o console rilevato. |
| Ispezione manuale delle anteprime browser | Viewport 320 px nei due temi, testo normale e al 200%, Automatico con cambio tema del sistema. Contenuti scorrevoli fino al fondo, barra visibile e separata; le label dei tab vanno a capo con testo ingrandito. Nessuna asserzione grafica o snapshot introdotto. |

La verifica browser è stata eseguita su una copia temporanea dei sorgenti in `.next/step03-preview`, con Turbopack e cache separata, senza copiare file ambiente o dati. Il server già attivo sulla porta 3000 restituiva ancora la vecchia pagina e non è stato arrestato. Il server temporaneo ha usato la porta 3103 ed è stato arrestato al termine; copia e cache temporanee rimosse. Chromium, librerie, script di prova e anteprime sono temporanei in `/tmp/expotrack-ui-check` e `/tmp/expotrack-step03-*`; non sono dipendenze o suite del progetto e non costituiscono evidenza completa per lo step 28. Nessun database o media applicativo toccato.

**Come provarlo:**

1. Eseguire `npm run dev` e aprire [http://localhost:3000](http://localhost:3000). Se un server avviato prima dello spostamento delle route mostra ancora la demo, riavviarlo per ricaricare la struttura delle pagine.
2. Toccare Home, Stand, Prodotti e Profilo: URL, titolo e tab attivo cambiano; indietro/avanti del browser ripercorrono le destinazioni. Le quattro pagine dichiarano correttamente l’assenza dei dati.
3. In **Profilo → Aspetto**, scegliere Scuro o Chiaro, cambiare pagina e aggiornare: la scelta viene mantenuta. Automatico segue il tema del sistema anche quando quest’ultimo cambia con la pagina aperta. Due schede dello stesso browser condividono la scelta.
4. Usare Tab/Shift+Tab, frecce sui radio e il collegamento **Vai al contenuto**. Provare viewport stretta, testo al 200% e scorrimento fino all’ultimo contenuto: la barra resta visibile senza coprirlo.
5. La verifica dei componenti precedenti resta disponibile in [http://localhost:3000/examples/components](http://localhost:3000/examples/components).

**Controlli non eseguiti / limiti:** nessuna build eseguita, come richiesto; la prova funzionale usa un server di sviluppo, non certifica la build di produzione o una PWA offline. Restano la prova su telefono reale, safe area fisiche, tastiera virtuale e altri browser. Nessun catalogo, selezione profilo/evento, statistica, CRUD, sincronizzazione o installabilità anticipati. Le suite applicative e i collegamenti a `validation/final-evidence.json` arriveranno negli step pertinenti; nessuna nuova suite persistente introdotta qui. La validazione finale completa resta a carico dell’assistente nello step 28.

**Punto di commit:** soltanto i file dello step elencati sopra; titolo suggerito `feat: add mobile app shell, navigation and persistent theme`. Nessun commit o push effettuato.

**Riscontro dell’utente / correzioni:** l’utente conferma «Va bene, accetto le modifiche»; step 03 accettato e chiuso. Lo step 04 non è stato avviato.

### Consegna step 04 — Contratti dati e dataset dimostrativo

- **Data:** 29 ottobre 2026.
- **Stato:** Accettato.
- **Domanda:** Con quali dati verificabili costruiamo le funzioni?
- **Risultato implementato:** contratti condivisi per configurazione, eventi, profili configurati, categorie, padiglioni, stand, interessi, checklist, pianificati e definizioni questionario. Dataset esplicitamente fittizio con una fiera, due profili, tre categorie gerarchiche, un padiglione, due stand (uno senza ubicazione), tre interessi personali, un pianificato e due questionari diversi sulla stessa categoria. Il primo contiene i sei tipi di domanda. Loader Node.js di sola lettura con validazione strutturale, semantica e dei riferimenti; rifiuto completo delle configurazioni incoerenti con messaggio file/campo. Nessuna generazione di dati mancanti o ID da etichette.
- **Stato Git iniziale:** working tree pulito; step 03 accettato e chiuso.
- **File dello step:** `src/types/catalog.ts`; `src/lib/config/load-catalog.ts`, `parse-catalog.ts`, `parse-questionnaires.ts`, `validate-references.ts`, `validation.ts`; `config/README.md` e i nove JSON di `config/`; `scripts/run-config-tools.mjs`, `scripts/validate-config.ts`, `tsconfig.config-tools.json`; `tests/unit/catalog.test.ts`, `tests/fixtures/README.md` e i nove JSON di `tests/fixtures/catalog/`; `package.json`, `validation/final-evidence.json`, `docs/development.md`, `docs/final-validation.md`, `README_IMPLEMENTAZIONE.md`.
- **Componenti riusati / introdotti:** nessun nuovo componente React necessario. Dati editoriali e loader sono separati dalla UI; le quattro pagine mantengono gli stati vuoti dello step 03. Nessuna nuova dipendenza o modifica alle regole di lint.

**Scelte di contratto documentate:** ogni file usa `schemaVersion: 1`, con proprietà sconosciute rifiutate. Stand/padiglioni identificati nell’evento; interessi e pianificati includono profilo e riferimento stand completo. La presenza del seed indica interesse anche senza priorità. `whatToSee` richiede oggetti `id`/`text`, secondo il requisito corrente di identità stabile; completamenti e stato visita saranno dati personali persistiti. `plannedProducts` è una lista facoltativa nello stand degli interessi, esposta separatamente nello snapshot e mai trasformata automaticamente in una registrazione. Questionari specifici per profilo/categoria esatta, versionati, facoltativi e senza fallback; alias storico `rating` normalizzato in `rating_1_10`. Budget per profilo/categoria senza evento, EUR e massimo due decimali. Contratto effettivo ed esempi in [config/README.md](config/README.md).

**Verifiche eseguite:**

| Comando / controllo | Esito |
|---|---|
| `npm run lint:fix` | Superato, codice 0. Nessuna regola indebolita o disabilitata. |
| `npm run lint` | Superato sul codice finale, codice 0, nessun warning. |
| `npm run typecheck` | Superato sul codice finale, codice 0; tipi route e TypeScript senza errori. |
| `npm run validate:config` | Superato, codice 0: 1 evento, 2 profili, 3 categorie, 1 padiglione, 2 stand, 3 interessi, 1 pianificato e 2 questionari. |
| `npm run test:unit` | Superato sul codice finale e sulla fixture separata, codice 0, nessun test fallito o saltato. Copre caricamento valido, riferimenti/cicli/duplicati, scope dei seed e dei riferimenti fra eventi, tipi delle domande, vincoli numerici, stabilità degli ID, assenza dei seed opzionali, alias rating, JSON malformato e percorsi esterni. |
| CLI su copia temporanea invalida | Rifiuto atteso con codice 1: `events/fiera-demo-2026-stands.json (stand demo-bags).hall: riferimento inesistente: padiglione-inesistente`. Dataset distribuito non modificato. |
| `git diff --check` | Superato anche sul registro finale. |

I test esercitano lo stesso loader della CLI con copie temporanee della fixture fittizia separata in `tests/fixtures/catalog/`. Non leggono i cataloghi reali o i dati personali e non modificano `config/`, database o media. TypeScript e `node:test` sono già disponibili: i comandi compilano soltanto gli strumenti in una directory temporanea e la eliminano al termine. Nessuna build Next.js eseguita. I test sono collegati a `catalog-and-domain` nel manifest finale: la copertura è parziale, perché importazione persistente, override, filtri, contatori e validazione delle risposte arriveranno nei rispettivi step. Nessuna altra area o prova fisica dichiarata completata.

**Come provarlo:**

1. Dalla root eseguire `npm run validate:config`: deve stampare «Configurazione valida» e il riepilogo riportato sopra. Non serve un dev server o un database.
2. Eseguire `npm run test:unit`: tutti gli scenari devono terminare senza errori, usando esclusivamente directory temporanee.
3. Per una prova manuale negativa, copiare `config/` in una directory temporanea, cambiare `hall` di `demo-bags` in un ID inesistente ed eseguire `npm run validate:config -- /percorso/della/copia`: deve fallire indicando il file e il campo `hall`.
4. Per i passi successivi importare `loadCatalog` solo nel codice Node/server e usare `CatalogSnapshot` come contratto serializzabile. Lo snapshot espone `config`, `profiles`, `categories`, `pavilions`, `stands`, `interests`, `plannedProducts` e `questionnaires`.

**Controlli non eseguiti / limiti:** nessuna build o verifica browser necessaria a questo step dati. La validazione non importa né persiste i seed, non applica override personali, non valida risposte compilate e non sceglie profilo/evento attivi. Non sono stati anticipati IndexedDB, API, database, statistiche, CRUD, sincronizzazione o dataset EICMA reali. Nessuna suite di integrazione/E2E introdotta: quelle aree e le prove su dispositivo restano pendenti. Validazione finale completa prevista nello step 28.

**Punto di commit:** soltanto i file dello step elencati sopra; titolo suggerito `feat: add validated demo catalog and shared data contracts`. Nessun commit o push effettuato.

**Riscontro dell’utente / correzioni:** l’utente conferma «Va bene»; step 04 accettato e chiuso. Lo step 05 non è stato avviato.

### Consegna step 05 — Persistenza locale e outbox

- **Data:** 29 ottobre 2026.
- **Stato:** Accettato.
- **Domanda:** Come salviamo sul dispositivo senza perdere o mescolare dati?
- **Risultato implementato:** archivio IndexedDB nativo `expotrack-local`, versione 1, dietro un repository con letture esplicitamente isolate per profilo/evento. Snapshot editoriale e puntatore attivo si aggiornano atomicamente. Lo store prodotti conserva input corrente, errori e ultima versione valida nello stesso record, senza store `drafts`. Un inserimento incompleto sopravvive alla riapertura senza essere registrato o accodato; il primo minimo valido produce record e mutazione nella stessa transazione e blocca categoria/stand. Un nome temporaneamente invalido resta recuperabile senza alterare l’ultimo valore valido; altre modifiche valide possono avanzare. La Promise si risolve soltanto dopo commit reale; quota e abort provocano rollback, senza falso successo. Outbox persistente con ID UUID, contesto, sequenza e dipendenze per entità, stato `pending` e revisione server iniziale `null`. Nessun motore di rete.
- **Stato Git iniziale:** working tree pulito; step 04 accettato e chiuso.
- **File dello step:** `src/types/offline.ts`; `src/lib/offline/database.ts`, `identity.ts`, `product-input.ts`, `repository.ts`, `README.md`; `tests/integration/local-persistence.test.ts`; `scripts/run-config-tools.mjs`, `tsconfig.config-tools.json`, `package.json`, `package-lock.json`; `validation/final-evidence.json`, `docs/development.md`, `docs/final-validation.md`, `README_IMPLEMENTAZIONE.md`.
- **Componenti riusati / introdotti:** riusati i contratti e la validazione dei riferimenti del catalogo. Nessun nuovo componente React necessario: il repository verrà collegato alle schermate nei rispettivi step. Per la prova della persistenza si usa il contratto minimo prodotto (nome, categoria, stand, descrizione); gli altri ambiti di dominio verranno aggiunti quando necessari. Nessuna regola di lint modificata. Unica nuova dipendenza: `fake-indexeddb` 6.2.6, fissata e limitata allo sviluppo; il codice dell’app usa IndexedDB nativo.

**Decisioni operative:** chiavi personali composte come array `[profileId, eventId, id]`; patch applicate al record riletto nella transazione per conservare modifiche concorrenti di altri campi. Nessun record viene creato leggendo o aprendo una schermata; la scrittura richiede una modifica intenzionale. Mutazioni valide append-only, con dipendenza dall’operazione precedente della stessa entità; i timestamp non decidono l’ordine. Snapshot precedenti, record personali e code non vengono cancellati durante un aggiornamento editoriale. Un riferimento rimosso blocca nuove mutazioni invalide ma conserva input e ultima versione valida. UUID v4 generati con `crypto.getRandomValues`, utilizzabile anche nelle prove HTTP locali. API, contratti e confine di commit documentati in [src/lib/offline/README.md](src/lib/offline/README.md).

**Verifiche eseguite:**

| Comando / controllo | Esito |
|---|---|
| `npm run lint:fix` | Superato, codice 0; nessuna regola disabilitata o indebolita. |
| `npm run lint` | Superato, codice 0, nessun warning. |
| `npm run typecheck` | Superato, codice 0; tipi route e TypeScript senza errori. |
| `npm run test:integration` | Superato, codice 0; otto scenari sul repository con IndexedDB emulato: recupero input, aggiornamenti validi/invalidi e immutabilità, isolamento fra due profili e due eventi, quota simulata e retry, abort dopo successo delle richieste, concorrenza e dipendenze, snapshot atomico, riferimenti rimossi e ripristinati. Eseguito anche il file compilato direttamente per leggere gli esiti dei singoli scenari: 8 passati, 0 falliti, 0 saltati. |
| `npm run test:unit` | Superato, codice 0; suite del catalogo ancora funzionante con gli strumenti aggiornati. |
| `npm run validate:config` | Superato con gli strumenti aggiornati, codice 0; dataset dimostrativo ancora valido. |
| Chromium / IndexedDB reale, prova temporanea | Superata, codice 0: input parziali dopo refresh, prima registrazione valida, input invalido conservato con altri campi validi accodati, scritture con rete disattivata, separazione di due profili, secondo refresh con record e ID delle operazioni invariati, abort tardivo con rollback di record/outbox. Origine HTTP fittizia; nessun errore JavaScript rilevato. |
| `git diff --check` | Superato anche sul registro finale. |

La suite usa esclusivamente `tests/fixtures/catalog`, factory separate e database `expotrack-test-*` chiusi/eliminati al termine; non legge dati personali o cataloghi di sviluppo. Gli errori di quota/abort sono iniettati al confine dell’API di storage, senza riempire disco o memoria. `test:integration` riusa TypeScript e `node:test`, compilando in directory temporanee; non richiede PostgreSQL o un browser. La prova browser è stata eseguita sui medesimi moduli compilati in ES module in `/tmp/expotrack-step05-browser`, caricati tramite richieste intercettate su `http://expotrack-offline.test/`, in un contesto Chromium pulito con database dedicato. Nessun server dell’app avviato o arrestato e nessun dato reale modificato. Script e output temporanei restano esclusi dal commit.

Le aree `local-persistence` e `profile-event-isolation` sono collegate al test reale in `validation/final-evidence.json`. Il collegamento non certifica le parti ancora da implementare: altri record personali, API/PostgreSQL, allegati, sincronizzazione, browser dell’app completa e prove fisiche restano da coprire. Nessuna validazione finale completa dichiarata.

**Come provarlo:**

1. Dalla root eseguire `npm run test:integration`: deve terminare con codice 0; copre anche fallimenti, rollback e riapertura. Non serve un database server o un dev server.
2. Eseguire `npm run test:unit` e `npm run validate:config`: catalogo e strumenti dello step 04 devono restare validi.
3. Per integrare una futura schermata client, aprire `openLocalRepository()`, caricare un `CatalogSnapshot` validato con `saveCatalog` e salvare soltanto i campi modificati con `await saveProduct(context, id, patch)`. Annunciare il salvataggio o navigare dopo la risoluzione; su errore conservare l’input in memoria e ritentare. API completa in [src/lib/offline/README.md](src/lib/offline/README.md).
4. Recuperare gli input con `getProduct`, le sole versioni registrate con `listRegisteredProducts` e le operazioni pendenti del contesto con `listOutbox`. `close()` seguito da una nuova apertura conserva i dati.

**Controlli non eseguiti / limiti:** nessuna build Next.js eseguita, come richiesto. La prova Chromium riguarda il repository con IndexedDB reale, non la PWA installata o una build di produzione. Non è garantito il refresh dell’intera app senza rete prima dello step 27; la prova di scrittura offline avviene dopo aver caricato il codice. Quote fisiche, espulsione dei dati, Galaxy S25 e altri browser restano da verificare. Nessuna UI di editing, selezione profilo, API, schema PostgreSQL, gestione media, CRUD completo o sync anticipati. Le integrazioni server e gli E2E saranno ampliati negli step pertinenti; validazione finale completa prevista nello step 28.

**Punto di commit:** soltanto i file dello step elencati sopra; titolo suggerito `feat: add atomic IndexedDB persistence and local outbox`. Nessun commit o push effettuato.

**Riscontro dell’utente / correzioni:** l’utente conferma «Verificato»; step 05 accettato e chiuso. Lo step 06 non è stato avviato.

### Consegna step 06 — Selezione e cambio profilo

- **Data:** 29 ottobre 2026.
- **Stato:** Accettato.
- **Domanda:** Chi sta usando l’app e come cambia profilo?
- **Risultato implementato:** al primo avvio compare «Chi sta usando ExpoTrack?» con gruppi configurati/personali e righe selezionabili. Il tap salva immediatamente la scelta sul dispositivo e apre Home, senza «Continua». Agli avvii successivi un profilo valido apre direttamente Home. Il nome, il colore e l’evento attivi compaiono nella testata; da Profilo → Cambia profilo si torna alla scelta. Profilo/evento non più disponibili richiedono una nuova scelta esplicita, conservando dati e preferenza precedente. Catalogo vuoto, archivio non disponibile e scrittura fallita hanno messaggi e recupero coerenti, senza falso successo.
- **Stato Git iniziale:** working tree pulito; step 05 accettato e chiuso.
- **File dello step:** `src/types/profiles.ts`; `src/lib/offline/profile-session.ts`, `repository.ts`, `README.md`; `src/components/profiles/{ProfileProvider,ProfilePicker,ProfileRow,ProfileIdentity,ActiveProfile}.tsx`; `src/components/layout/{AppShell,TopBar}.tsx`, `src/components/README.md`; `src/app/(app)/layout.tsx`, `page.tsx`, `{profile,profiles,stands,products}/page.tsx`, `src/app/globals.css`; `public/brand/{expotrack-icon.png,README.md}`; `tests/integration/profile-selection.test.ts`; `validation/final-evidence.json`; `config/README.md`, `docs/development.md`, `docs/final-validation.md`, `README_IMPLEMENTAZIONE.md`.
- **Componenti riusati / introdotti:** riusati Card, Button, StatusChip pieno, NavigationIcon, shell e selettore tema. ProfileProvider coordina il repository; ProfilePicker compone i gruppi; ProfileRow gestisce la singola scelta; ProfileIdentity è condiviso con testata e ActiveProfile. Il logo raster fornito è copiato senza modifiche da `docs/mockups/`, con provenienza documentata. Nessuna nuova dipendenza o regola di lint modificata.

**Decisioni operative:** catalogo letto dal layout Server Component e trasferito al provider client, senza endpoint aggiuntivi. L’archivio rimane alla versione 1: `app_meta` conserva `active-context` con profilo/evento, senza nuove tabelle o mutazioni outbox. Bootstrap identici non duplicano snapshot. Il cambio attende il commit delle scritture già iniziate e non elimina o trasferisce record/code fra contesti. Un evento valido viene conservato; se non è più valido, l’evento predefinito si applica soltanto dopo una scelta esplicita. Nessun profilo viene scelto automaticamente al primo avvio. Il catalogo viene riletto al caricamento del layout; un aggiornamento dei JSON richiede una nuova apertura o un refresh completo. API e confine di commit in [src/lib/offline/README.md](src/lib/offline/README.md).

**Verifiche eseguite:**

| Comando / controllo | Esito |
|---|---|
| `npm run lint:fix` | Superato, codice 0; nessuna regola disabilitata o indebolita. |
| `npm run lint` | Superato, codice 0, nessun warning. |
| `npm run typecheck` | Superato, codice 0; generazione tipi route e TypeScript senza errori. |
| `npm run test:integration` | Superato, codice 0; entrambi i file passati: otto scenari esistenti e sei nuovi su selezione, persistenza, isolamento, eventi, errori e catalogo vuoto. |
| `npm run test:unit` | Superato, codice 0; suite catalogo passata. |
| `npm run validate:config` | Superato, codice 0; catalogo demo valido con due profili e un evento. |
| Chromium / app in sviluppo, prova temporanea | Superata, codice 0: primo avvio, riapertura e refresh, cambio da Profilo anche da tastiera, scrittura fallita con scelta precedente conservata e retry, profilo disabilitato, catalogo vuoto, accesso diretto a un tab e IndexedDB negato. Nessun errore JavaScript rilevato. |
| `git diff --check` | Superato sul registro finale. |

La nuova suite usa soltanto fixture fittizie e database isolati, chiusi/eliminati al termine. I test sono collegati alle aree `local-persistence` e `profile-event-isolation` del manifest finale. La prova temporanea Chromium usa una copia isolata dell’app sulla porta 3106, senza `.env`, database o media reali; modifica soltanto la copia del catalogo e la ripristina. Server temporaneo arrestato e copia rimossa al termine; il server di sviluppo già presente non è stato arrestato. Script e immagini temporanei non fanno parte del commit. Nessuna suite E2E di produzione o validazione finale completa dichiarata.

**Come provarlo:**

1. Avviare `npm run dev` e aprire [http://localhost:3000](http://localhost:3000) in una finestra privata o in un contesto browser nuovo, senza eliminare archivi esistenti. Deve apparire la scelta con i profili demo configurati e la sezione personale vuota, senza pulsante creazione.
2. Selezionare «Io · demo»: si apre Home e la testata mostra il profilo e l’evento. Ricaricare o riaprire l’indirizzo nello stesso contesto: Home si apre direttamente con la stessa identità.
3. Aprire Profilo → Cambia profilo e selezionare «Papà · demo», anche con Tab/Invio: Home e testata devono aggiornarsi; un nuovo refresh conserva la scelta.
4. Eseguire `npm run test:integration` per verificare anche preferenze invalide, rollback/retry, eventi, conservazione e isolamento di prodotti/code durante il cambio. Le liste applicative personali saranno collegate nei rispettivi step.

**Controlli non eseguiti / limiti:** nessuna build Next.js eseguita, come richiesto. Chromium verifica l’app in sviluppo con IndexedDB reale; non certifica produzione, installazione PWA, refresh senza rete, altri browser o dispositivi fisici. Ispezionate manualmente anteprime a 320 px nei temi chiaro/scuro e con testo al 200%, senza test grafici automatici. I profili personali si potranno creare nello step 20; qui la sezione è vuota. Dashboard, liste operative, cambio evento, API e sincronizzazione restano ai rispettivi step. Lo step 07 non è stato avviato.

**Punto di commit:** soltanto i file dello step elencati sopra; titolo suggerito `feat: add persistent profile selection and switching`. Nessun commit o push effettuato.

**Riscontro dell’utente / correzioni:** l’utente conferma «va bene»; step 06 accettato e chiuso. Lo step 07 non è stato avviato.

### Consegna step 07 — Lista stand e interessi

- **Data:** 1 novembre 2026.
- **Stato:** Accettato.
- **Domanda:** Come troviamo gli stand che ci interessano?
- **Risultato implementato:** `/stands` mostra per default gli interessi del profilo nell’evento attivo, con ricerca per nome/categoria/padiglione tollerante ad accenti e maiuscole. La vista completa include anche gli stand senza interesse. Filtri combinabili per visita, interesse, categoria, padiglione e priorità; conteggi reali, azzeramento e ordine iniziale per priorità decrescente, poi nome/ID. La stella salva un override personale e l’operazione pendente in una sola transazione: non cambia visita o priorità. Rimozioni esplicite e aggiunte sopravvivono a refresh e cambio profilo. Errori di lettura e scrittura consentono il retry senza falso successo.
- **Riferimento visivo:** dopo il riscontro dell’utente, rivista la disposizione rispetto a `docs/mockups/03_lista-stand.png`: marchio e azioni circolari in testata, titolo con selettore segmentato, ricerca su fondo tenue, chip degli stati con conteggi, select compatte e pannello Filtri, righe compatte con priorità colorata, pallino visita e stella arancione. Testata e selezione del tab assumono questa forma nella lista stand. Il catalogo demo contiene due stand fittizi e nessun logo: sono mostrati i dati effettivi e un fallback con iniziali. Le righe diventano navigabili con il dettaglio dello step 08; la creazione personale resta allo step 10.
- **Stato Git iniziale:** working tree pulito all’avvio dello step. Le modifiche presenti alla ripresa erano il lavoro incompleto dello stesso step, conservato e corretto.
- **File dello step:** `src/app/(app)/stands/page.tsx`, `src/app/globals.css`; `src/components/stands/{StandHeader,StandCatalog,StandList,StandRow}.tsx`; `src/components/forms/{TextField,SelectField}.tsx`; `src/components/layout/{AppShell,NavigationIcon}.tsx`; `src/features/stands/{stand-list,use-stand-list,use-stand-filters}.ts`; `src/types/offline.ts`; `src/lib/offline/{database,repository}.ts`; `tests/unit/stand-list.test.ts`, `tests/integration/stand-interests.test.ts`, `tests/integration/local-persistence.test.ts`; `validation/final-evidence.json`; `src/components/README.md`, `src/lib/offline/README.md`, `docs/development.md`, `docs/final-validation.md`, `README_IMPLEMENTAZIONE.md`.
- **Componenti riusati / introdotti:** ricerca con TextField e label accessibile, select nativa condivisa SelectField, icone estese in NavigationIcon, errori con Button ed EmptyState. StandList e StandRow ricevono dati/callback; gli hook coordinano repository e memoria della lista. Nessuna nuova dipendenza, nessuna regola di lint modificata.

**Decisioni operative:** IndexedDB passa alla versione 2 con migrazione conservativa: aggiunta dello store `stand_preferences` e ricostruzione dell’indice outbox con tipo entità incluso. Snapshot, profilo ricordato, prodotti e operazioni della versione 1 restano intatti. Gli override sono per campo: una stella non congela il seed della priorità; `false` conserva una rimozione intenzionale anche dopo aggiornamenti del JSON. L’outbox distingue prodotti e preferenze stand. I filtri sono nell’URL, associati al contesto; lo scroll appartiene alla singola voce di cronologia. Il ritorno ripristina la lista e l’ingresso dal tab usa i default. Gli aggiornamenti rapidi si uniscono ai parametri già applicati nel browser, evitando che una ricerca subito dopo il cambio vista ripristini il valore precedente. In assenza di posizione compare «Posizione non disponibile»; quando presente, si usa anche il codice di padiglione configurato. Sui viewport stretti i chip scorrono nel proprio gruppo e la barra filtri può distribuirsi su più righe, mantenendo i controlli da 48 px.

**Verifiche eseguite:**

| Comando / controllo | Esito |
|---|---|
| `npm run lint:fix` | Superato, codice 0; corretti anche gli errori manuali senza disabilitare regole. |
| `npm run lint` | Superato, codice 0, nessun warning. |
| `npm run typecheck` | Superato, codice 0; tipi delle route e TypeScript senza errori. |
| `npm run test:unit` | Superato, codice 0: entrambe le suite; due nuovi scenari su interessi/override, ricerca, filtri, ordine e contesto. |
| `npm run test:integration` | Superato, codice 0: tutte e tre le suite; quattro nuovi scenari su persistenza/isolamento, seed aggiornati, visita preservata, concorrenza/dipendenze, rollback quota/abort e migrazione 1 → 2. |
| Chromium, prove funzionali temporanee su `next dev` | Superate: due profili, ricerca e filtri combinati/azzerati, posizione assente, stella dopo refresh, errore quota con retry, ordine, ritorno con filtri, nuovo ingresso dal tab e scorciatoie ricerca/filtri. Nessun errore JavaScript rilevato nella prova principale. |
| Chromium, lista lunga fittizia isolata | Superata: azioni rapide vista/ricerca, ritorno con ricerca e scroll conservati, nuovo ingresso dal tab azzerato. |
| Confronto visivo manuale delle anteprime | Ispezionate viste chiara/scura a 430/390 px e vista stretta a 320 px, anche con testo al 200%; nessun test grafico automatico o snapshot aggiunto. |
| `git diff --check` | Superato. |

Le suite permanenti usano fixture e database IndexedDB emulati isolati; i nuovi file sono collegati alle aree pertinenti del manifest finale. La verifica Chromium usa una copia temporanea dell’app sulla porta 3107, senza `.env`, database server o media reali. La lista lunga aggiunge stand esclusivamente nella copia di test, poi ripristinata; il catalogo del repository non è stato modificato. La prova del ritorno usa Profilo come destinazione temporanea, dato che il dettaglio arriverà nello step 08. Queste prove non sostituiscono gli E2E di produzione ancora da introdurre.

**Come provarlo:**

1. Avviare `npm run dev` e aprire [http://localhost:3000/stands](http://localhost:3000/stands). Scegliere «Io · demo» se richiesto e aprire Stand: compare Borse Demo con priorità 9/10. «Tutti gli stand» mostra anche Luci Demo, con priorità non impostata e posizione non disponibile.
2. Nella vista completa cercare `ILLUMINAZIÓNE`: resta Luci Demo. Provare categoria, padiglione, priorità e chip visita; Filtri contiene interesse e ordine. «Azzera filtri» ripristina ricerca vuota e interessi personali.
3. Nella vista completa togliere la stella a Borse Demo, quindi ricaricare: la stella resta spenta e la visita resta «Da visitare». Riaccenderla e verificare di nuovo il refresh. La vista interessi rimuove subito lo stand dopo il commit della stella spenta.
4. Da Profilo → Cambia profilo scegliere «Papà · demo»: gli interessi iniziali sono Luci Demo 8/10 e Borse Demo 4/10, indipendenti dalle modifiche di Io. Tornare a Io conserva le sue scelte.
5. Applicare una ricerca o un filtro, aprire Profilo e tornare con Indietro del browser: la lista conserva lo stato. Entrare invece dal tab Stand ripristina i default. Confrontare la disposizione con il mockup nei temi chiaro e scuro; le informazioni demo restano quelle del catalogo.

**Controlli non eseguiti / limiti:** nessuna build eseguita, come richiesto. Nessuna validazione finale dello step 28 dichiarata. Restano le prove su telefono reale/altri browser e gli E2E della build di produzione. Refresh dell’intera app senza rete e sincronizzazione server appartengono agli step successivi. Nel dataset ridotto lo scroll è limitato: la conservazione è stata verificata con 25 stand fittizi nella sola copia isolata. Dettaglio, checklist, note e stand personali non sono anticipati.

**Punto di commit:** solo i file dello step elencati sopra; titolo suggerito `feat: add stand discovery and persistent personal interests`. Nessun commit o push effettuato.

**Riscontro dell’utente / correzioni:** l’utente ha richiesto maggiore fedeltà al mockup durante l’implementazione; disposizione e densità sono state riviste. Successivamente conferma «Va bene»: step 07 accettato. Richiesta inoltre priorità a sviluppo rapido, pochi token e manutenibilità essenziale per un’app destinata a un solo utilizzo; indicazione registrata sopra. Lo step 08 non è stato avviato.

### Consegna step 08 — Dettaglio stand e checklist

- **Data / stato:** 1 novembre 2026; Accettato.
- **Risultato:** la riga stand apre `/stands/[standId]`. Dettaglio ispirato al mockup 04 con testata compatta, fallback logo, posizione, stella, priorità 1–10 rimovibile e visita manuale. Checklist con spunte e aggiunta di voci a ID stabili, contatore reale e salvataggio locale atomico con outbox. Le sezioni «Prodotti da vedere» e «Prodotti registrati» mostrano soltanto i dati del profilo/evento/stand attivi. Errori con retry e accesso diretto/stand mancante gestiti.
- **File nuovi:** `src/app/(app)/stands/[standId]/page.tsx`, `src/components/stands/{StandDetail,StandChecklist}.tsx`, `src/features/stands/use-stand-detail.ts`, `src/lib/offline/stand-input.ts`.
- **File aggiornati:** `src/types/offline.ts`, `src/lib/offline/repository.ts`, `src/features/stands/{stand-list,use-stand-filters}.ts`, `src/components/stands/{StandHeader,StandRow}.tsx`, `src/components/layout/{AppShell,BottomNav,NavigationIcon}.tsx`, `src/app/globals.css`, `tests/integration/stand-interests.test.ts`, `src/components/README.md`, `src/lib/offline/README.md`, `docs/development.md`, `docs/final-validation.md`, questo README. Working tree iniziale pulito; nessuna dipendenza aggiunta.
- **Riuso e scelte:** stella condivisa fra riga e dettaglio, Button per retry, selettori estesi e repository/schema IndexedDB 2 esistenti. Patch validate e rilette nella transazione: interesse, priorità, visita e checklist si preservano a vicenda. Le spunte seguono gli ID, senza copiare il seed finché non si modifica la lista aggiungendo una voce. Nessuna spunta o attività prodotto cambia automaticamente visita o interesse. Nessuna nuova infrastruttura di test.
- **Verifiche:** `npm run lint:fix`, `npm run lint`, `npm run typecheck`, `npm run test:integration`, `npm run test:unit` superati, codice 0. Due scenari aggiunti alla suite stand già collegata al manifest: riapertura, ID/checklist/concorrenza, contatori, rimozione priorità, profili/eventi, separazione prodotti, patch invalide e quota/rollback/retry. Tutte le suite preesistenti passano. `git diff --check` superato.
- **Browser:** prova temporanea Chromium su copia isolata dell’app, porta 3108, senza `.env`, database o media reali: apertura, modifiche e refresh, errore quota/retry, ritorno con ricerca e scroll anche dopo refresh del dettaglio, stella separata dal link, cambio profilo, posizione assente, accesso diretto e stand mancante verificati. Lo scroll ha un recupero in sessione per URL/contesto, azzerato dal nuovo ingresso sul tab Stand. Anteprime chiara/scura ispezionate manualmente; nessun test grafico automatico.
- **Come provarlo:** aprire Stand con Io · demo e toccare Borse Demo. Cambiare priorità/stato, spuntare una voce e aggiungerne una; ricaricare per verificarne il recupero. Rimuovere la priorità scegliendo «—». Tornare alla lista con la freccia: ricerca e filtri precedenti restano. Cambiare a Papà · demo: priorità, visita e checklist sono indipendenti. Luci Demo mostra posizione assente e checklist vuota. Prodotti pianificati e registrati hanno sezioni/conteggi distinti; i demo non vengono trasformati in registrati.
- **Limiti:** note dedicate allo step 09; azioni/editor prodotto allo step 12. Non sono mostrati pulsanti senza funzione, mappe o fotografie stand. Nessuna build o validazione finale dello step 28 eseguita; nessuna certificazione su telefono reale, produzione o riavvio PWA offline. L’area E2E `stands` resta pendente; la suite di integrazione estesa è già collegata a `local-persistence` e `profile-event-isolation`.
- **Commit suggerito:** `feat: add stand details and persistent checklist`. Nessun commit o push effettuato.
- **Riscontro:** l’utente conferma «Va bene»; step 08 accettato. Step 09 non avviato.

### Consegna step 09 — Note dello stand

- **Data / stato:** 2 novembre 2026; Accettato.
- **Risultato:** dal dettaglio «Apri note stand» apre `/stands/[standId]/notes`. Nome stand, testo unico facoltativo senza limite UI, stato autosalvataggio e ritorno al dettaglio. Il testo viene conservato integralmente, inclusi spazi e righe; nessuna cronologia o conferma Salva. Nel dettaglio compare un’anteprima di tre righe, resa come testo.
- **Persistenza:** campo `notes` nelle preferenze personali esistenti, isolato per profilo/evento/stand. Commit atomico con outbox, senza migrazione o dipendenze nuove. Le altre patch preservano le note; queste non cambiano interesse, priorità, visita, checklist o descrizione prodotto. L’apertura della vista non crea record vuoti.
- **Navigazione/errori:** input salvato subito, scritture serializzate con recupero dell’ultimo testo arrivato durante il commit. Header, ritorno, tab e cambio profilo attendono il salvataggio. Indietro del browser è protetto anche senza Navigation API; il fallback viene registrato dal provider prima dell’App Router. Se la scrittura fallisce, il testo resta aperto con retry e senza successo dichiarato. Refresh/chiusura con modifiche pendenti usano `beforeunload`; dopo commit il normale refresh recupera le note.
- **File nuovi:** `src/app/(app)/stands/[standId]/notes/page.tsx`, `src/components/stands/StandNotes.tsx`, `src/components/feedback/SaveStatus.tsx`, `src/features/stands/use-stand-notes.ts`.
- **File aggiornati:** `src/types/offline.ts`, `src/lib/offline/{stand-input,repository}.ts`, `src/features/stands/stand-list.ts`, `src/components/stands/{StandDetail,StandHeader}.tsx`, `src/components/layout/BottomNav.tsx`, `src/components/profiles/ProfileProvider.tsx`, `src/app/globals.css`, `tests/integration/stand-interests.test.ts`, `src/components/README.md`, `src/lib/offline/README.md`, `docs/{development,final-validation}.md`, questo README. Working tree iniziale pulito. Riusati Button, header, sessione, loader del dettaglio e repository.
- **Verifiche:** `npm run lint:fix`, `npm run lint`, `npm run typecheck`, `npm run test:unit` e `npm run test:integration` superati, codice 0. Due scenari note aggiunti alla suite stand già collegata a `local-persistence` e `profile-event-isolation` in `validation/final-evidence.json`: testo lungo, riapertura, svuotamento, concorrenza, isolamento, descrizione prodotto preservata, invalidi, quota/rollback/retry. Tutte le suite preesistenti passano. `git diff --check` superato.
- **Browser:** prove temporanee Chromium su copia isolata dell’app, `next dev --webpack` porta 3109, senza `.env`, database server o media reali. Verificati testo lungo, refresh, ritorno immediato da pulsante/header/browser, input durante transazione ritardata, cambio profilo, quota e blocco uscite/retry, ritorno alla lista filtrata, svuotamento, accesso diretto, stand mancante e chiusura/riapertura della pagina. Ripetuto il caso quota/Indietro con Navigation API disattivata. Anteprime chiara/scura a 390 px e stretta a 320 px con testo 200% ispezionate manualmente; nessun test grafico introdotto.
- **Come provarlo:** `npm run dev`, poi [http://localhost:3000/stands](http://localhost:3000/stands). Scegliere Io · demo, aprire Borse Demo → Apri note stand. Scrivere anche un testo lungo e tornare subito al dettaglio: l’anteprima lo mostra; riaprire e ricaricare conserva tutto. Cambiare a Papà · demo: le note di Io non compaiono. Tornare a Io le recupera. Svuotare il campo e ricaricare mantiene il testo vuoto. Un accesso diretto a `/stands/demo-lights/notes` consente comunque il ritorno al dettaglio.
- **Limiti:** nessuna build o validazione finale dello step 28 eseguita. Prove su telefono reale e altri browser, PWA offline ed E2E di produzione restano pendenti. Il fallback è esercitato in Chromium disattivando l’API, senza certificare altri motori. La sync server resta agli step successivi; l’indicatore distingue salvataggio locale e sincronizzazione in attesa. Step 10 non avviato.
- **Punto di commit:** soltanto i file elencati sopra; titolo suggerito `feat: add autosaved personal stand notes`. Nessun commit o push effettuato.
- **Riscontro:** l’utente conferma «Va bene»; step 09 accettato. Step 10 non avviato.

### Consegna congiunta step 10–11 — Stand personali e dashboard

- **Data / stato:** 2 novembre 2026; entrambi Da verificare dall’utente. L’utente ha richiesto esplicitamente i due step insieme. Working tree iniziale pulito; nessuna dipendenza aggiunta.
- **Step 10:** «Nuovo stand» dalla lista, editor autosalvato con nome obbligatorio e descrizione/categorie/padiglione/posizione facoltativi. L’apertura non crea record; l’URL conserva l’ID per recuperare anche input incompleti al refresh. La prima versione valida inizializza interesse e visita «Da visitare». Dettaglio, checklist, note e preferenze funzionano anche per gli stand personali. Modifica ed eliminazione confermata dal dettaglio; prodotti collegati validi o parziali bloccano la cancellazione, senza cascata. Catalogo in sola lettura, dati personali isolati per proprietario/evento/origine.
- **Step 11:** Home ispirata al mockup 02 con esattamente quattro statistiche e fino a cinque stand prioritari. I conteggi stand riguardano solo gli interessi del contesto, con stati disgiunti. Prodotti conteggiati soltanto dopo una registrazione valida; pianificati esclusi. Top cinque con priorità assegnata, esclusione visitati e ordine priorità/nome/ID. Card verso liste filtrate, righe verso dettaglio e ritorno alla dashboard. Nessun riempitivo o dato dimostrativo incorporato nel markup.
- **Riuso / persistenza:** `countStandVisits` e i selettori di lista sono condivisi; riusati StandRow, StandHeader, controlli, SaveStatus e sessione. Estratto `useLocalAutosave` dalle note per l’editor; i componenti delegano le mutazioni agli hook. IndexedDB 3 aggiunge `personal_stands`, con input corrente/ultima versione valida e tombstone. Record, preferenze iniziali e outbox condividono il commit; dipendenze preservano l’ordine stand/preferenze/prodotto/eliminazione. Lo stato UI dichiara il salvataggio locale anche per input non ancora accodabili, senza simulare sync.
- **File nuovi:** `src/app/(app)/stands/new/page.tsx`, `src/app/(app)/stands/personal/[standId]/{page.tsx,edit/page.tsx,notes/page.tsx}`; `src/components/dashboard/Dashboard.tsx`, `src/components/stands/PersonalStandEditor.tsx`, `src/components/feedback/ConfirmDialog.tsx`; `src/features/use-local-autosave.ts`, `src/features/stands/use-personal-stand.ts`, `src/lib/offline/personal-stand-input.ts`.
- **File aggiornati:** `src/app/(app)/page.tsx`, `src/app/globals.css`; `src/components/layout/{AppShell,NavigationIcon}.tsx`, `src/components/stands/{StandCatalog,StandList,StandRow,StandHeader,StandDetail,StandNotes}.tsx`, `src/components/feedback/SaveStatus.tsx`; `src/features/stands/{stand-list,use-stand-list,use-stand-detail,use-stand-notes}.ts`; `src/types/offline.ts`, `src/lib/offline/{database,repository,product-input}.ts`; `tests/unit/stand-list.test.ts`, `tests/integration/stand-interests.test.ts`; `src/components/README.md`, `src/lib/offline/README.md`, `docs/{development,final-validation}.md`, questo README.
- **Verifiche automatizzate:** `npm run lint:fix`, `npm run lint`, `npm run typecheck`, `npm run test:unit` e `npm run test:integration` superati, codice 0. Quattro nuovi scenari di integrazione e due unit, oltre alla migrazione v1 aggiornata: input/riapertura, origini omonime, due profili/eventi, catalogo immutabile, blocco prodotti, tombstone/dipendenze, quota/abort, lettura fallita/retry e migrazione v2 → v3. I file sono già collegati alle aree pertinenti in `validation/final-evidence.json`; nessuna copertura E2E dichiarata completa. `git diff --check` superato.
- **Browser:** Chromium temporaneo su copia isolata, `next dev --webpack` porta 3110, senza `.env`, database server o media reali. Verificati creazione minima/parziale, refresh, modifica, scrittura locale senza rete server, note, priorità/stati, conteggi e filtri, cambio profilo/accesso non proprietario, quota/retry/uscita protetta, conferma/annullamento/eliminazione, blocco con prodotto fixture, lettura fallita e dashboard senza interessi. Passate le regressioni delle note, anche senza Navigation API e con chiusura/riapertura. Anteprime chiare/scure a 430/390 px e a 320 px con testo 200% ispezionate manualmente; adattata la testata stretta. Nessun test grafico aggiunto. Server e copia di test rimossi al termine.
- **Come provarlo:** `npm run dev` → [http://localhost:3000](http://localhost:3000). In un contesto browser nuovo scegliere Io · demo: Home parte da 1 da visitare, 0 visitati, 0 da rivedere e 0 prodotti. Da Stand → Nuovo stand inserire un nome e tornare al dettaglio: lo stand è già di interesse. Assegnare priorità 10 e tornare a Home: conteggio aumentato e nuovo prioritario in testa. Segnarlo Visitato o Da rivedere e controllare card/lista filtrata. Modificare, ricaricare e verificare gli stessi valori; cambiare a Papà · demo per controllare l’isolamento. Eliminare lo stand senza prodotti dal suo editor dopo conferma: scompare e i conteggi si aggiornano. Il blocco con prodotto è già verificato tramite fixture, senza anticipare l’editor prodotto.
- **Limiti:** nessuna build o `validate:final` eseguita; prove su telefono reale, altri motori browser ed E2E della build di produzione ancora pendenti. La shell PWA offline resta allo step 27. Creazione prodotto allo step 12, lista prodotti allo step 14 e sync operativa nei rispettivi step; Home non espone CTA prodotto o sync non funzionanti. Step 12 non avviato.
- **Punto di commit:** soltanto i file elencati sopra; titolo suggerito `feat: add personal stands and visit dashboard`. Nessun commit o push effettuato.

### Consegna step 12–13 — Editor prodotto e descrizione

- **Stato:** implementati insieme su richiesta, da verificare dall’utente. Step 10–11 accettati con la richiesta di proseguire; step 14 non avviato.
- **Step 12:** ingressi Aggiungi prodotto da Home, dettaglio stand e Prodotti; apertura dei pianificati/registrati direttamente in 05. Selettore 09 con interessi, ricerca dal perimetro esplicito, catalogo completo, recenti ricavati dai prodotti del contesto e stelle persistenti. Sola apertura senza scritture prodotto; URL stabile per recuperare input parziali. Identità `planned:<id>` per riaprire lo stesso pianificato. Prima registrazione automatica con nome/categoria/stand validi, blocco categoria/stand e conteggi reali; visita stand invariata. Fine torna allo stand dalla creazione e alla vista chiamante dalla modifica.
- **Step 13:** prezzo in euro (assenza distinta da zero, virgola o punto decimale), voto generale assente o 1–10 e rimuovibile, preferito e descrizione unica 05b senza limite di testo. Anteprima di tre righe. Autosalvataggio locale e outbox atomica: input errato recuperabile, ultima versione valida preservata per campo e altre modifiche valide ancora salvabili. Navigazione/subviste attendono il commit, errori reali e retry; nessuna bozza o conferma Salva.
- **Mockup:** tavole 05, 05b e 09 adattate alle decisioni correnti. Testata ExpoTrack, campi compatti, slider/voto, interruttore preferito, riga descrizione e due temi. Corrette la griglia dell’editor senza testata condivisa e la testata stretta con testo ingrandito. Questionari, foto, budget, lista completa e azioni duplica/elimina restano agli step previsti.
- **File nuovi:** `src/app/(app)/products/{new,[productId]}/page.tsx`; `src/components/products/{ProductEditor,StandPicker,ProductDescription}.tsx`; `src/components/forms/RatingSlider.tsx`; `src/features/products/use-product-editor.ts`.
- **File aggiornati:** `src/app/(app)/products/page.tsx`, `src/app/globals.css`; `src/components/dashboard/Dashboard.tsx`, `src/components/layout/AppShell.tsx`, `src/components/stands/StandDetail.tsx`, `src/components/forms/TextField.tsx`; `src/types/offline.ts`, `src/lib/offline/product-input.ts`; `tests/integration/local-persistence.test.ts`; `src/components/README.md`, `src/lib/offline/README.md`, `docs/final-validation.md`, questo README. Nessuna nuova dipendenza o modifica ai dati dimostrativi.
- **Verifiche automatizzate:** applicato `npm run lint:fix`; `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:integration` e `git diff --check` superati, codice 0. Due scenari di integrazione aggiunti al file già collegato alle aree `local-persistence` e `profile-event-isolation` di `validation/final-evidence.json`. Nessuna copertura E2E dichiarata completa.
- **Browser:** Chromium temporaneo contro copia isolata dell’app, `next dev --webpack` porta 3112, senza `.env`, DB server o media reali. Passati apertura senza creazione, selezione stand, parziali/refresh, prima registrazione/blocco, pianificato senza duplicazione, ritorni/Fine, visita invariata e conteggio Home. Passati prezzo assente/zero/decimali/input invalido, voto assente/1/9/rimozione, preferito, descrizione lunga/refresh/indietro, nome vuoto con ultima versione valida, quota simulata/retry/uscita protetta, isolamento profili e ricerca interessi/catalogo completo. Anteprime 390 px chiare/scure e descrizione a 320 px con testo 200% ispezionate manualmente; nessun test grafico introdotto.
- **Come provarlo:** `npm run dev` → [http://localhost:3000](http://localhost:3000). Scegliere Io · demo → Home → Aggiungi prodotto → Borse Demo; inserire il nome, ricaricare prima della categoria per verificare il recupero. Selezionare Borse · demo: stand/categoria si bloccano automaticamente. Provare prezzo `0`, `8799,50`, voto/rimozione, preferito e descrizione lunga. Fine apre Borse Demo; il prodotto registrato riapre lo stesso editor. Aprire anche Borsa giornaliera · demo nei pianificati, modificare un campo e riaprirlo: nessun duplicato. Svuotare temporaneamente nome/prezzo, ricaricare e correggere; il conteggio della registrazione precedente resta valido. Da Profilo cambiare tema/profilo per verificare aspetto e isolamento.
- **Limiti:** prove su telefono reale, altri motori e suite E2E di produzione pendenti. Nessuna build o `validate:final` eseguita; shell PWA e sincronizzazione server restano agli step previsti.
- **Punto di commit:** soltanto i file elencati sopra; titolo suggerito `feat: add autosaved product editor and stand picker`. Nessun commit o push effettuato.
