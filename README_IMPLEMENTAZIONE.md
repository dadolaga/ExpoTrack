# ExpoTrack — Implementazione a piccoli passi

Questo README definisce **come lavoriamo**, un passo alla volta, sulla parte web mobile da fiera. Ogni step parte da una domanda concreta, produce un’implementazione circoscritta e termina con un risultato verificabile. Non autorizza a implementare l’intera applicazione in un’unica sessione.

**Stato iniziale:** piano predisposto; nessuno degli step sotto è stato eseguito tramite questo piano. Il progetto contiene la base Next.js e le specifiche. Le cartelle indicate qui sono destinazioni da creare quando servono, non funzionalità già presenti.

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

Uno step dovrebbe produrre un singolo cambiamento comprensibile. Se durante il lavoro risulta troppo ampio, lo divido qui in sottopassi numerati, per esempio `17a` e `17b`, e consegno soltanto il primo. Non considero una funzione completata se i suoi controlli non sono eseguibili o se il risultato dipende da codice ancora da realizzare.

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
- Token semantici per colori e spaziature; niente palette duplicate nelle pagine. HTML semantico, etichette accessibili, focus visibile e target touch adeguati.
- Separare codice browser e server secondo le guide Next.js installate; non rendere tutta l’app client per comodità e non introdurre dipendenze server nei componenti condivisi.
- Nessuna nuova libreria se il codice nativo o una dipendenza già presente risolvono il problema con chiarezza. Documentare la scelta quando una dipendenza è utile.
- Nessuna astrazione preventiva o refactoring generale fuori dallo step. Niente doppio componente per la stessa UI con nomi diversi.

## Come verifichiamo e consegniamo

Per ogni step di codice eseguire `npm run lint` e `npm run typecheck`. Eseguire `npm run build` quando cambiano route, layout, confini client/server, dipendenze, API, manifest/cache PWA e nel collaudo finale. Non eseguire build e dev server contemporaneamente sulla stessa directory di output.

I comandi di test automatici non sono ancora configurati: introdurre l’attrezzatura minima nel primo step che ne ha bisogno e documentare il comando reale. I test devono coprire rischi concreti: isolamento profili/eventi, transazioni, recupero dati, validazione, conteggi e sincronizzazione. Non aggiungere test che si limitano a ripetere il markup o l’implementazione di un pulsante.

Per la UI il controllo comprende almeno viewport mobile stretto, tema chiaro/scuro, tastiera/focus e assenza di contenuti coperti dalla barra inferiore. Quando si introduce persistenza, aggiungere refresh e riapertura; quando si introduce sync, rete assente/intermittente e riavvio. Prima dello step PWA il refresh senza rete dell’intera app **non è ancora una funzionalità garantita**: distinguere storage locale e cache della shell.

Ogni consegna deve indicare:

- **Risposta alla domanda:** cosa funziona ora e cosa resta agli step successivi.
- **Modifiche:** file toccati e componenti riusati/creati.
- **Verifiche eseguite:** comando e risultato, distinguendo test passati, non eseguiti e controlli manuali ancora da fare.
- **Come provarlo:** URL o comando effettivo, dati di partenza, azioni e risultato atteso; uno step tecnico può essere verificato tramite test o API anziché una schermata.
- **Punto di commit:** elenco dei soli file dello step e titolo suggerito, senza effettuare il commit.

Stati: `Da iniziare` → `In corso` → `Da verificare dall’utente` → `Accettato`. In caso di correzioni si torna `In corso`; `Bloccato` richiede una ragione concreta. «Accettato» si registra soltanto dopo il tuo riscontro, non automaticamente dopo i test. Un tuo «avanti» sul risultato consegnato vale come accettazione dello step precedente.

## Registro degli step

L’ordine è intenzionale: prima fondamenta e funzioni locali verificabili, poi integrazione server e PWA. Le funzioni degli step futuri non devono sembrare già operative: usare stati vuoti o indicazioni corrette, senza simulare salvataggi o sincronizzazioni.

| Step | Risultato | Stato |
|---|---|---|
| 00 | Base di lavoro e controlli iniziali | Da iniziare |
| 01 | Token grafici e tipografia | Da iniziare |
| 02 | Componenti UI di base | Da iniziare |
| 03 | Shell mobile, navigazione e tema | Da iniziare |
| 04 | Contratti dati e dataset dimostrativo | Da iniziare |
| 05 | Persistenza locale e outbox | Da iniziare |
| 06 | Selezione e cambio profilo | Da iniziare |
| 07 | Lista stand e interessi | Da iniziare |
| 08 | Dettaglio stand e checklist | Da iniziare |
| 09 | Note dello stand | Da iniziare |
| 10 | Stand personali | Da iniziare |
| 11 | Dashboard con conteggi reali | Da iniziare |
| 12 | Creazione minima prodotto e selezione stand | Da iniziare |
| 13 | Modifica prodotto e descrizione | Da iniziare |
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

Il primo passo operativo sarà **00**. La creazione di questo README non avvia lo sviluppo dei passi successivi.
