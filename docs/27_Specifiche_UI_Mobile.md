# ExpoTrack — Specifica UI mobile per utilizzo in fiera

> **Documento:** `docs/27_Specifiche_UI_Mobile.md`  
> **Stato:** specifica mobile aggiornata alle risposte A1–A9; decisioni consolidate, mockup abbinati e scostamenti documentati  
> **Ambito:** PWA mobile-first, Android/Galaxy S25 come riferimento; tema chiaro/scuro; offline-first.  
> **Fuori ambito di questa fase:** confronto desktop, analisi post-fiera, esportazioni avanzate, mappe e itinerari.
> **Revisione documentale:** 28 ottobre 2026; verificati visivamente tutti i 15 PNG presenti in `docs/mockups/` (13 tavole UI e 2 asset del marchio).

## 0. Principi e gerarchia delle fonti

Questo documento consolida le scelte esplicite effettuate durante la progettazione dei mockup 01–11. Le immagini dei mockup sono **riferimenti visivi**, non specifiche esatte dei dati: testi, prezzi, date, conteggi, ubicazioni, brand e schermate accessorie rappresentati nei mockup possono essere dimostrativi. Le regole esplicite descritte qui prevalgono su eventuali elementi introdotti accidentalmente nelle immagini.

**Livelli di certezza:**
- **[DECISO]** scelta confermata dall'utente.
- **[PROPOSTA UI]** default implementativo coerente con le decisioni, modificabile in revisione.
- **[DA DEFINIRE]** dettaglio ancora aperto; le risposte A1–A9 sono recepite nella sezione 10; gli eventuali dettagli tecnici residui sono distinti dalle decisioni funzionali.

Le risposte dell’utente A1–A9 aggiornano e, dove necessario, superano le decisioni precedenti. **Fa fede il testo**, anche quando manca il mockup o l’immagine mostra controlli diversi. Le scelte operative introdotte per completare il raccordo sono etichettate **[SCELTA OPERATIVA]**, senza attribuirle a una risposta esplicita dell’utente.

### 0.1 Indice completo dei mockup e degli asset

I collegamenti sono relativi a questo documento. Una tavola può contenere più schermate, stati e varianti chiaro/scuro: il numero identifica il flusso, non un singolo file per ogni vista. Le cornici dei telefoni, la barra di stato di sistema, le frecce e le annotazioni esterne non fanno parte dell'interfaccia da implementare.

| ID | File | Abbinamento e copertura | Esito della revisione |
|---|---|---|---|
| 01 | [01_profilo.png](mockups/01_profilo.png) | §3, 01: selezione iniziale profilo, chiaro/scuro | Riferimento per la lista e la distinzione JSON/personale. |
| 02 | [02_dashboard.png](mockups/02_dashboard.png) | §3, 02: Dashboard, chiaro/scuro | Riferimento principale per Dashboard; quattro statistiche e cinque stand. |
| 03 | [03_lista-stand.png](mockups/03_lista-stand.png) | §3, 03: lista, ricerca, filtri e interessi, chiaro/scuro | La stella indica interesse personale, inizializzato dal JSON; non esiste un preferito stand distinto né un quarto stato visita. |
| 04 | [04_dettaglio-stand.png](mockups/04_dettaglio-stand.png) | §3, 04: dettaglio, checklist, prodotti pianificati/registrati, chiaro/scuro | Escludere mappe, indicazioni e fotografie stand. Il conteggio checklist è dimostrativo: sono visibili due spunte, non tre. |
| 05 | [05_nuovo-prodotto.png](mockups/05_nuovo-prodotto.png) | §3, 05: modulo prodotto, chiaro/scuro | Editor unico anche per prodotti esistenti; selettore stand iniziale; questionario inline; eliminare badge e pulsante bozza, usare salvataggio automatico. |
| 05a | [05a_domanda-questionario.png](mockups/05a_domanda-questionario.png) | §3, 05a: ingresso dal modulo e dettaglio risposta, chiaro/scuro | Voto facoltativo senza foto; salvataggio automatico; sostituire «Annulla»/«Salva risposta» con ritorno al prodotto. |
| 05b | [05b_descrizione-prodotto.png](mockups/05b_descrizione-prodotto.png) | §3, 05b: ingresso dal modulo ed editor testuale, chiaro/scuro | Una sola descrizione, senza limite funzionale di caratteri; eliminare cronologia, contatore /500 e note rapide. |
| 06 | [06_foto.png](mockups/06_foto.png) | §3, 06: griglia, viewer, menu, scelta principale, conferma eliminazione; cinque stati per tema | Foto originali salvate automaticamente; rimuovere «Informazioni»; mantenere viewer, principale ed eliminazione con conferma. |
| 07 | [07_prodotti.png](mockups/07_prodotti.png) | §3, 07: lista, filtri, ordinamento, lista filtrata, ingresso nuovo prodotto; cinque viste per tema | Entrambi i tipi prodotto aprono 05; questionario inline. «Altro» va sostituito con «Profilo» e non serve più «Salva prodotto» come conferma finale. |
| 08 | [08_dettagli-prodotto.png](mockups/08_dettagli-prodotto.png) | §3, 08: dettaglio, galleria, questionario, note, menu, conferma eliminazione; sei viste per tema | Tavola non attiva in questa fase: non creare 08 né navigarvi; aprire sempre 05. Viewer foto riutilizzabile tramite 06. |
| 09 | [09_seleziona-stand.png](mockups/09_seleziona-stand.png) | §3, 09: selezione chiara/scura, ricerca con tastiera, catalogo completo scuro | Stelle = interesse; rimuovere «Pulisci» recenti; posizioni e tempi sono esempi. |
| 10 | [10_sincronizzazione.png](mockups/10_sincronizzazione.png) | §3, 10: indicatore, panoramica, coda, upload foto, impostazioni, completamento; sei viste per tema | Dashboard superata da 02; niente mappa. Sync sempre automatica, entrambe le reti, LWW fisso; rimuovere toggle e notifiche configurabili. |
| 11 | [11_profilo.png](mockups/11_profilo.png) | §3, 11: profilo, cambio, dettaglio, creazione, impostazioni, selezione evento; sei viste per tema | Identità JSON in sola lettura; evento via tendina. Rimuovere reset personalizzazioni, descrizione profilo e selettore icone; aggiungere budget per categoria. |
| Marchio completo | [Logo vettoriale ExpoTrack.png](<mockups/Logo vettoriale ExpoTrack.png>) | §2.1 e 01: simbolo con scritta ExpoTrack su fondo bianco | File raster PNG, non vettoriale nonostante il nome; manca una variante completa adatta allo sfondo scuro. |
| Simbolo | [Logo vettoriale ExpoTrack (1).png](<mockups/Logo vettoriale ExpoTrack (1).png>) | §2.1: simbolo senza scritta, possibile base per icona app | File raster PNG; destinazione PWA e ritagli da verificare. Non è un SVG. |

Tutte le tavole UI contengono varianti dei due temi, ma non sempre per ogni sottovista: per esempio il catalogo completo di 09 è rappresentato solo in scuro. Nessuna tavola rappresenta tutti gli stati offline, vuoti, di errore o di validazione richiesti dalla sezione 5.3.

### 0.2 Raccordo con le altre specifiche

Questo documento è il riferimento funzionale e grafico corrente per il web mobile da fiera. I documenti correlati riportano un aggiornamento normativo con le conseguenze delle risposte A1–A9; i precedenti esempi basati su bozze, conferma finale Salva, dettaglio 08, foto stand o conflitti manuali non sono contratti da implementare. Le strutture tecniche compatibili (IndexedDB, outbox, idempotenza, revisioni, tombstone, separazione profilo/evento) restano valide. Desktop, confronto ed export non vengono riprogettati in questa fase.

### Vincoli invarianti [DECISO]
1. La PWA serve a fiere generiche, non esclusivamente motociclistiche. EICMA 2026 è il primo dataset.
2. Nessun login/account interno: l'utente sceglie un profilo; la scelta viene ricordata localmente. L'accesso remoto al server può essere protetto da Cloudflare Access, separatamente.
3. Profili configurati via JSON distinti dai profili creati nell'app; i profili JSON non sono eliminabili dall'app.
4. Interfaccia italiana, mobile-first, con tema automatico e possibilità di forzare chiaro/scuro nelle impostazioni.
5. Catalogo stand configurabile; preferenze, note, valutazioni e visite sono riferite al profilo e all'evento.
6. Lo **stato visita** appartiene esclusivamente allo **stand**, non al prodotto. Salvare un prodotto non marca automaticamente lo stand come visitato.
7. Questionari definiti da categoria/profilo; fotografie e note personali associate al prodotto.
8. Le operazioni devono essere possibili offline; la sincronizzazione non deve bloccare la registrazione.
9. Non progettare in questa fase funzioni desktop/post-fiera non richieste.
10. Unico editor prodotto 05, senza dettaglio 08 e senza ciclo di vita bozza/conferma finale.
11. Salvataggio automatico prima sul dispositivo, poi sync automatica quando il server è raggiungibile.
12. Stand personali e budget per categoria sono inclusi nell’uso mobile da fiera.

## 1. Architettura della navigazione

```text
Avvio PWA
 ├─ Profilo locale valido? ─ Sì ─> 02 Dashboard
 └─ No ─> 01 Selezione profilo ─(tap immediato)─> 02 Dashboard

Navigazione principale mobile
 ├─ Home ─> 02 Dashboard
 │   ├─ stand prioritario ─> 04 Dettaglio stand
 │   ├─ aggiungi prodotto ─> 05 Editor prodotto ─> 09 Selezione stand
 │   └─ indicatore sync ─> 10 Sincronizzazione
 ├─ Stand ─> 03 Lista stand ─> 04 Dettaglio stand
 │            ├─ nuovo stand ─> 04b Crea/modifica stand personale
 │            └─ dettaglio ─> checklist / 04a Note stand / modifica stand personale
 │                          └─ prodotto pianificato o registrato ─> 05 Editor prodotto
 ├─ Prodotti ─> 07 Lista prodotti ─> 05 Editor prodotto (unico)
 │                  └─ + ─> 05 Editor prodotto ─> 09 Selezione stand
 │                              ├─ questionario inline ─> 05a Dettaglio risposta
 │                              ├─ 05b Descrizione personale unica
 │                              └─ 06 Gestione fotografie e viewer
 └─ Profilo ─> 11 Profilo e impostazioni
                ├─ cambia profilo ─> 01 Lista profili (riuso)
                ├─ gestisci profili ─> elenco / creazione / modifica personale
                ├─ 11a Budget per categoria
                ├─ evento attivo ─> selettore a tendina
                ├─ aspetto ─> automatico / chiaro / scuro
                └─ sincronizzazione ─> 10 Sincronizzazione
```

**[DECISO]** La schermata 08 è sospesa in questa fase: tutti i prodotti si aprono direttamente in 05, anche quelli registrati. Non creare una pagina mobile di sola lettura né un passaggio «Modifica prodotto».

**Regola di ritorno:** dalla creazione prodotto, «Fine» torna al dettaglio dello stand scelto anche entrando da Home/lista prodotti. Dalla modifica di un prodotto esistente, tornare alla vista chiamante (stand o lista prodotti) **[SCELTA OPERATIVA]**. Sottoviste 05a, 05b, 06 e 09 tornano sempre all’editor 05 mantenendo il contesto. Il ritorno non conferma o annulla modifiche già salvate automaticamente.

## 2. Design system

### 2.1 Identità e stile

- **[DECISO]** Aspetto moderno, minimale, leggibile, coerente tra chiaro e scuro. Branding ExpoTrack: blu come colore operativo e arancione come accento del marchio.
- **[PROPOSTA UI]** Palette tramite token semantici, mai colori hardcoded nei componenti:

| Token | Light | Dark | Impiego |
|---|---|---|---|
| `--bg` | `#F7F9FC` | `#07111F` | sfondo pagina |
| `--surface` | `#FFFFFF` | `#0D1B2B` | schede, modali |
| `--surface-muted` | `#EDF3FA` | `#14283C` | righe secondarie |
| `--text` | `#142236` | `#F4F7FB` | testo primario |
| `--text-muted` | `#64748B` | `#A7B7C9` | testo secondario |
| `--border` | `#DFE6EE` | `#26394D` | bordi/divisori |
| `--primary` | `#0866E8` | `#4B95FF` | CTA, focus, selezione |
| `--brand-accent` | `#F97316` | `#FB923C` | wordmark/accenti limitati |
| `--success` | `#15803D` | `#4ADE80` | completato/sincronizzato |
| `--warning` | `#B45309` | `#FBBF24` | attesa/conflitto |
| `--danger` | `#DC2626` | `#F87171` | eliminazione/errori |

I valori sono proposti e devono essere testati per contrasto WCAG; lo stato non deve essere comunicato solo dal colore.

### 2.2 Tipografia e dimensioni [PROPOSTA UI]

- Font: `Inter`, fallback `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` (evitare download runtime di font per offline).
- Titolo pagina 22–24 px/700; titolo sezione 16–18 px/650; testo normale 14–16 px; label 13–14 px; caption 12–13 px (mai testo operativo sotto 12 px).
- Base spacing 4 px; distanze standard 8/12/16/24 px; margini pagina 16 px.
- Radius: input 10–12 px, card 14–16 px, dialog 20 px; ombre lievi solo dove utili.
- Target tocco almeno 44×44 CSS px, preferibilmente 48×48; spaziatura tra azioni distruttive e conferme.
- Safe area: `env(safe-area-inset-top/bottom)`; bottom navigation fissa, contenuto con padding inferiore adeguato.
- Supporto zoom testo, `prefers-reduced-motion`, tastiera virtuale e focus visibile.

### 2.3 Componenti riutilizzabili [PROPOSTA UI]

| Componente | Responsabilità |
|---|---|
| `AppShell` | header, bottom navigation, safe areas, scroll container |
| `TopBar` | indietro, titolo, sottotitolo, azioni contestuali |
| `BottomNav` | Home / Stand / Prodotti / Profilo, 4 tab stabili |
| `SyncIndicator` | icona + contatore discreto, apre schermata 10 |
| `ProfileRow` | avatar/colore, nome, origine JSON/personale, attivo |
| `StandRow` | logo/fallback, nome, padiglione, priorità, stato |
| `ProductRow` | miniatura principale/fallback, nome, stand, categoria, stato pianificato/registrato, voto |
| `StatusChip` | stato testuale + semantica visiva |
| `FilterSheet` | filtri applicabili/ripristinabili, contatore risultati |
| `RatingSlider` | 1–10 con valore numerico esplicito |
| `QuestionnaireSection` | domande dinamiche per categoria/profilo, espandibili |
| `PhotoGrid` | griglia miniature, apertura viewer, foto principale, eliminazione |
| `ConfirmDialog` | conferma azioni distruttive con nome oggetto |
| `OfflineNotice` | informazione non bloccante sullo stato offline |
| `SaveStatus` | stato del salvataggio automatico locale, validazione e sync separati |
| `EmptyState` | stato vuoto con azione contestuale |

### 2.4 Regole globali

- Un'unica CTA primaria evidente per schermata; azioni secondarie outline/testuali.
- Non mostrare pulsanti senza azione; gli elementi non disponibili sono disabilitati con spiegazione.
- Filtri, ordinamento e scroll mantenuti tornando dall’editor/dettaglio alla lista; un nuovo ingresso dal tab riparte dai default **[SCELTA OPERATIVA]**.
- Ricerca case-insensitive, tollerante agli accenti **[PROPOSTA UI]**.
- Placeholder/skeleton in caricamento, stato vuoto, errore e offline per tutte le viste dati.
- Le immagini dei brand possono essere importate e conservate localmente prima della fiera; fallback con iniziali/icona, senza richieste obbligatorie online.
- Le fotografie utente restano in qualità originale **[DECISO]**; mostrare spazio usato e possibili errori di quota, senza compressione silenziosa.

## 3. Specifiche schermate

### 01 — Selezione profilo [DECISO]

**Mockup:** [01_profilo.png](mockups/01_profilo.png) — selezione profilo, chiaro/scuro.

**Quando:** soltanto al primo avvio o se il profilo memorizzato non è più valido; accessibile anche da «Cambia profilo».

**Layout:** logo, titolo «Chi sta usando ExpoTrack?», lista semplice divisa in «Profili configurati» e «Profili personali», CTA «Aggiungi profilo», nota sulla memorizzazione della scelta.

**Interazioni:** tap sulla riga = selezione immediata, persistenza locale e navigazione Dashboard; nessun pulsante Continua. I profili JSON sono identificati chiaramente e non eliminabili; quelli personali sono distinti. In caso di lista vuota, offrire creazione profilo e messaggio esplicativo.

### 02 — Dashboard [DECISO]

**Mockup:** [02_dashboard.png](mockups/02_dashboard.png) — chiaro/scuro; prevale sulla Dashboard accessoria di 10.

**Layout:** evento attivo visibile ma non modificabile, profilo, indicatore sync, esattamente quattro statistiche (stand da visitare, visitati, da rivedere, prodotti registrati), fino a cinque stand prioritari, CTA «Aggiungi prodotto», bottom navigation. Se gli stand disponibili sono meno di cinque, non aggiungere riempitivi.

**Interazioni:** statistiche aprono liste filtrate; stand apre 04; aggiunta prodotto apre 05 con selezione stand 09; sync apre 10. Il conteggio prodotti include solo prodotti con dati minimi validi, esclusi i semplici prodotti pianificati del catalogo.

**[SCELTA OPERATIVA] Universo stand:** i tre conteggi riguardano esclusivamente gli stand di interesse del profilo nell’evento attivo; sono tre insiemi disgiunti in base allo stato manuale. La top 5 comprende gli stessi stand, con priorità assegnata e stato «Da visitare» o «Da rivedere»; esclude i visitati. Ordinare per priorità decrescente, poi nome, poi ID. Consultare o registrare attività su uno stand fuori interessi non accende automaticamente la stella e non cambia lo stato visita. I dati restano trovabili con «Mostra tutti».

I budget restano consultabili da Profilo e dall’editor prodotto; non aggiungere altre statistiche alla Dashboard.

### 03 — Lista stand [DECISO]

**Mockup:** [03_lista-stand.png](mockups/03_lista-stand.png) — lista e filtri, chiaro/scuro.

**Layout:** ricerca, lista compatta, logo, nome, padiglione/posizione quando disponibili, priorità, stato; default **solo stand di interesse personale**, azione «Mostra tutti»; filtri completi: stato da visitare/visitato/da rivedere, interesse personale, categoria, padiglione, priorità; ordinamento iniziale priorità decrescente.

**Interazioni:** tap riga apre 04; la stella indica e modifica l’interesse personale (seed JSON più override), non un preferito stand separato. Il tap sulla stella non apre il dettaglio e non cambia lo stato visita. Filtri combinabili, azzerabili e contatore risultati. CTA «Nuovo stand» apre 04b. Catalogo generale non implica interesse personale. Per posizione assente mostrare «Posizione non disponibile».

### 04 — Dettaglio stand [DECISO]

**Mockup:** [04_dettaglio-stand.png](mockups/04_dettaglio-stand.png) — dettaglio, chiaro/scuro; escludere mappe, indicazioni e foto stand.

**Layout:** logo, nome, ubicazione se disponibile, priorità modificabile 1–10, stato visita modificabile **manualmente**, checklist spuntabile, «Prodotti da vedere» e «Prodotti registrati» in sezioni distinte, pulsante «Aggiungi prodotto», accesso a note stand dedicate.

**Interazioni:** tap checklist aggiorna la voce del profilo; modifica stato tramite controllo esplicito, mai automatica quando si salva un prodotto; tap prodotto pianificato avvia 05 precompilato; tap prodotto registrato apre 05 precompilato; CTA aggiungi prodotto apre 05 con stand già assegnato. Note stand **in schermata dedicata** e non confonderle con note prodotto.

**[DECISO]** Non implementare fotografie dello stand come entità separata in questa fase. Stella interesse, priorità, stato e checklist salvano automaticamente in locale e accodano la sync. Non mostrare pulsanti mappe, indicazioni, foto stand o reset personalizzazioni.

### 04a — Note stand [DECISO]

**Mockup:** non disponibile; fa fede questa descrizione.

Vista dedicata con nome stand, area testuale unica e facoltativa, senza limite funzionale di caratteri, indicatore salvataggio automatico e ritorno al dettaglio stand. Dati separati per profilo/evento/stand, distinti da descrizione prodotto e risposte questionario. Nessuna cronologia e nessun pulsante di conferma finale.

### 04b — Creazione/modifica stand personale [DECISO]

**Mockup:** non disponibile; funzione inclusa nell’uso in fiera tramite A9.

**Accessi:** «Nuovo stand» in 03; «Modifica stand» nel dettaglio di uno stand personale. Campi: nome obbligatorio, descrizione facoltativa, categorie facoltative, padiglione selezionabile fra quelli configurati e posizione testuale facoltativa. Non inventare ubicazioni. Evento e profilo proprietario vengono dal contesto e non sono modificabili.

Salvataggio automatico locale, poi sync. I campi del catalogo JSON sono in sola lettura; interessi, priorità, note, stato e checklist restano personali e modificabili. Per rendere subito rintracciabile il nuovo stand personale, inizializzare interesse attivo e stato «Da visitare» **[SCELTA OPERATIVA]**. L’eliminazione richiede conferma e viene bloccata se lo stand ha prodotti collegati, spiegando il motivo; non cancellare prodotti a cascata.

### 05 — Editor unico di creazione/modifica prodotto [DECISO]

**Mockup:** [05_nuovo-prodotto.png](mockups/05_nuovo-prodotto.png), con ingresso dalla tavola [07](mockups/07_prodotti.png). Rimuovere badge «Bozza», «Salva come bozza» e conferma finale «Salva prodotto».

**Layout:** pagina unica scorrevole; stand, nome e categoria obbligatori; prezzo facoltativo; voto generale facoltativo 1–10; preferito prodotto; budget della categoria se configurato; questionario inline espandibile con tutte le domande applicabili; descrizione personale dedicata; fotografie in basso; stato salvataggio e azione «Fine»/ritorno. Nessun campo «Stato visita» sul prodotto.

**Accessi:** creazione da Home, stand o lista prodotti; apertura di prodotti pianificati e registrati sempre in 05. Pianificati precompilano i dati disponibili; il solo ingresso non crea un nuovo prodotto, non lo registra e non marca visitato lo stand. La prima modifica intenzionale avvia la raccolta, seguendo §5.1. Aprire nuovamente lo stesso pianificato, se già associato a un prodotto personale, riapre quel prodotto anziché duplicarlo **[SCELTA OPERATIVA]**.

**Persistenza:** ogni modifica è salvata automaticamente prima in locale, poi accodata al server quando valida; il ritorno non è una conferma finale. Le foto sono salvate subito, con dipendenza dall’esistenza del prodotto prima dell’upload. Mostrare «Salvataggio…», «Salvato sul dispositivo», «In attesa di sincronizzazione», «Sincronizzato» o errore reale, senza badge bozza.

**[DECISO A8]** Categoria obbligatoria: selezionabile durante l’inserimento iniziale, bloccata dopo la prima registrazione locale valida, anche offline. Stand stabile dopo tale registrazione **[SCELTA OPERATIVA conservativa]**; per correggere categoria/stand creare un nuovo prodotto anziché spostare risposte e allegati implicitamente. Informare l’utente del blocco prima della prima selezione valida.

**Valutazione:** voto assente `—/10`; nessun valore preassegnato. Azione «Rimuovi valutazione» ripristina l’assenza. Preferito indipendente dalle risposte e dal voto generale. Prezzo assente diverso da zero; indicare valuta.

**Azioni contestuali:** duplica ed elimina disponibili qui, poiché 08 non è attivo. Duplicazione esplicita crea un nuovo prodotto personale con dati principali, descrizione e risposte, senza foto, nuovo ID e salvataggio locale immediato; apre la copia in 05. L’eliminazione richiede conferma e tombstone con gestione sicura degli allegati. Niente condivisione o esportazione mobile.

### 05a — Risposta questionario [DECISO]

**Mockup:** [05a_domanda-questionario.png](mockups/05a_domanda-questionario.png) — utile per rating; eliminare «Annulla» e «Salva risposta» come conferme di una bozza.

Ogni risposta salva automaticamente in locale e poi sul server. La freccia indietro/«Torna al prodotto» non annulla quanto salvato. La spunta nella lista è solo un indicatore di risposta presente, non una checkbox di completamento indipendente. Per i voti: slider 1–10, valore visibile, nessun default e possibilità di rimuovere la risposta. Nessuna fotografia nello step domanda.

**Sei tipi di controllo**, derivati dal JSON: testo libero; numero con vincoli della domanda; sì/no con stato non risposto; radio/select a scelta singola; checkbox a scelta multipla; rating 1–10. Tutte le risposte sono facoltative. Per il tipo rating usare il nome canonico `rating_1_10` del documento 10; `rating` negli esempi precedenti del documento 18 va normalizzato al confine di lettura, non è un secondo tipo.

Non introdurre un commento accessorio per ogni voto sulla sola base del mockup: il testo libero è una domanda di tipo testo se configurata, mentre la descrizione generale del prodotto resta in 05b **[SCELTA OPERATIVA]**. Senza questionario applicabile, omettere la sezione; nessuna domanda generica inventata. Fino a diversa regola editoriale usare matching esatto categoria/profilo, senza ereditarietà implicita **[SCELTA OPERATIVA]**.

### 05b — Descrizione personale del prodotto [DECISO]

**Mockup:** [05b_descrizione-prodotto.png](mockups/05b_descrizione-prodotto.png), da adattare: nessuna cronologia, note rapide, contatore /500 o pulsante Salva.

Un solo campo `description` testuale facoltativo, modificabile, senza limite funzionale di caratteri imposto dalla UI. Vista dedicata da 05, titolo «Descrizione personale», textarea con contenuto esistente, stato autosalvataggio e «Torna al prodotto». Il testo salva automaticamente in locale e si sincronizza; il ritorno non conferma né annulla. Non confondere con note stand o domande testuali del questionario. In 05 mostrare un’anteprima di tre righe o «Nessuna descrizione».

Eventuali limiti tecnici del trasporto/storage devono essere documentati e segnalati con errore recuperabile; non troncare testo e non introdurre il limite di 500 caratteri del mockup.

### 06 — Gestione fotografie [DECISO]

**Mockup:** [06_foto.png](mockups/06_foto.png). Il viewer della tavola 08 può essere riutilizzato come parte di 06 senza attivare il dettaglio prodotto 08.

Griglia, viewer a schermo intero, «Scatta foto», «Dalla galleria», foto principale ed eliminazione con conferma. Rimuovere «Informazioni». Nessun limite numerico fisso; originali conservati, miniature separate. Ogni aggiunta/metadato valido salva immediatamente blob, metadati e operazione locale; upload automatico quando il prodotto padre è sincronizzabile. Non attendere un Salva prodotto finale.

Foto principale esplicita; finché non selezionata usare la prima. Eliminando la principale, scegliere la prima foto residua in ordine di aggiunta; se non resta alcuna foto, rimuovere il riferimento **[SCELTA OPERATIVA]**. Confermare le eliminazioni, preservare asset referenziati da operazioni pendenti/recuperabili e pulire gli orfani solo quando sicuro. Non dichiarare salvata una foto se la scrittura locale fallisce per quota. Permessi negati, formato non supportato e upload fallito hanno feedback e azione di recupero.

### 07 — Lista prodotti [DECISO]

**Mockup:** [07_prodotti.png](mockups/07_prodotti.png) — cinque viste per tema; il nuovo prodotto riusa il modulo 05.

**Layout:** ricerca; lista compatta con miniatura principale; distintivi «Registrato» e «Pianificato»; filtri completi: preferiti, categoria, stand, valutazione, prezzo, con/senza foto; ordinamento iniziale **più recenti**; prodotti **registrati e pianificati** visibili insieme; CTA «Aggiungi prodotto».

**Interazioni:** tap registrato apre 05 con i dati esistenti; tap pianificato apre 05 precompilato; CTA apre modulo 05 con stand obbligatorio, selezionabile tramite 09. Se non c'è foto mostrare icona/fallback. Il voto assente appare `—/10`, non zero.

### 08 — Dettaglio prodotto sospeso [DECISO A2]

**File mantenuto per tracciabilità:** [08_dettagli-prodotto.png](mockups/08_dettagli-prodotto.png).

Non implementare la schermata o un percorso mobile 08 in questa fase. I prodotti registrati si aprono direttamente nell’editor 05. Tutte le domande del questionario, descrizione unica e azioni duplica/elimina sono disponibili in 05; fotografie e viewer sono in 06. Le viste cronologia note, condivisione ed esportazione nella tavola non sono requisiti attivi.

### 09 — Selezione stand [DECISO]

**Mockup:** [09_seleziona-stand.png](mockups/09_seleziona-stand.png) — selezione, ricerca e catalogo completo.

**Layout:** ricerca immediata, sezione **stand recenti**, sezione **stand di interesse**, azione «Mostra tutti» per catalogo completo; righe compatte con logo, nome e posizione quando nota.

**Interazioni:** tap stand = selezione **immediata** e ritorno al modulo prodotto con stand compilato; nessuna conferma. Recenti basati sugli stand effettivamente usati dal profilo nel contesto evento **[PROPOSTA UI]**. La ricerca include il catalogo completo solo con «Mostra tutti» attivo; rendere esplicito il perimetro. La stella indica interesse. Nessun pulsante «Pulisci» recenti.

### 10 — Sincronizzazione e offline [DECISO]

**Mockup:** [10_sincronizzazione.png](mockups/10_sincronizzazione.png), con le semplificazioni A7 qui definite.

Stato online/offline e raggiungibilità server, contatore header, modifiche/foto pendenti, ultimo sync, lista operazioni ed errori, progresso foto, «Sincronizza ora»/«Riprova». Sync automatica sempre attiva con app aperta e server raggiungibile, più comando manuale. Foto su Wi-Fi e rete mobile. Nessun toggle di disattivazione, selezione rete, notifiche push configurabili o scelta della policy conflitti **[SCELTA OPERATIVA A7]**. Feedback di esito dentro l’app.

**Contatore [SCELTA OPERATIVA A7]:** numero totale delle operazioni locali non ancora confermate dal server, comprese foto ed errori, per tutti i profili/eventi sul dispositivo. Ogni operazione conta una volta; «foto in attesa» è un sottoinsieme, non una quantità da sommare di nuovo. Il totale non è il numero di prodotti. La pagina dichiara questo perimetro e mostra dettagli del profilo/evento attivi; degli altri contesti mostra soltanto il numero pendente e il collegamento al cambio contesto. La sync processa tutte le code mantenendone l’isolamento.

**LWW per record:** il server ordina atomicamente le nuove mutazioni valide per ordine di accettazione e assegna revisioni monotone. Tra due aggiornamenti concorrenti dello stesso record prevale l’ultimo accettato; il timestamp del telefono non arbitra. Un retry con lo stesso `operationId` restituisce l’esito originale, senza applicarsi di nuovo. Nessun merge automatico per campo né dialogo di scelta versione. Conservare audit sufficiente per diagnosi.

**Delete protette:** una tombstone non viene annullata da aggiornamenti tardivi. Segnalare il tentativo respinto e conservare localmente payload e allegati recuperabili; offrire «Recupera come nuovo elemento» con nuovo ID, senza resuscitare il record originale. Errori di validazione, violazioni di categoria immutabile e hash foto discordanti restano errori, non casi risolvibili da LWW.

Non promettere sync a PWA chiusa: tentare con app aperta e connessione disponibile, riprendendo al riavvio. Non mostrare «Sincronizzato» finché esistono operazioni locali non confermate. Foto presenti solo sul server non diventano offline senza effettivo download locale.

### 11 — Profilo, gestione profili e impostazioni [DECISO]

**Mockup:** [11_profilo.png](mockups/11_profilo.png) — sei viste per tema; identità JSON non modificabile ed evento tramite tendina.

**Layout:** profilo attivo, origine JSON/personale, CTA «Cambia profilo», accesso a gestione profili **in schermata dedicata**, aggiungi profilo, evento attivo, tema, sincronizzazione, informazioni app.

**Interazioni:** cambio profilo **immediato** senza conferma, con ritorno alla Dashboard; profili JSON protetti come origine e non eliminabili, ma **interessi, priorità e dati personali modificabili**; profili personali creabili/modificabili ed eliminabili con doppia conferma; cambio evento tramite **menu a tendina nelle impostazioni**, non dalla Dashboard; tema selezionabile **Automatico / Chiaro / Scuro**, persistito localmente.

**[DECISO]** Nome, colore e avatar dei profili JSON sono in sola lettura nell’app; si modificano solo interessi, priorità e dati personali.



**Controlli rimossi (A6):** ripristino personalizzazioni, descrizione aggiuntiva del profilo e selettore icone/avatar dei profili personali. Per questi ultimi assegnare l’icona utente standard e consentire nome e colore; l’avatar JSON resta visualizzabile e non modificabile. Gli altri controlli di tema, cambio evento, nome/colore personale e gestione profili restano disponibili. Modifiche valide autosalvate localmente e sincronizzate; preferenza tema e profilo scelto restano locali.

**Eliminazione profilo personale:** doppia conferma con nome e conseguenze sui dati collegati. Non eliminare file o record necessari a operazioni pendenti prima di averne risolto le dipendenze. I profili JSON non sono eliminabili.

### 11a — Budget per categoria [DECISO A9]

**Mockup:** non disponibile; incluso nell’uso mobile in fiera. Accesso «Budget per categoria» da Profilo, per profili JSON e personali.

Elenco categorie con importo effettivo, origine configurato/personale e azione aggiungi/modifica/rimuovi override. Campo categoria singola e importo non negativo, valuta esplicita (EUR nel dataset iniziale), massimo due decimali per gli importi in euro. Salvare automaticamente prima in locale poi sul server; nessun budget globale della fiera. Per i profili JSON non modificare il file: usare override personali.

**[SCELTA OPERATIVA]** Budget personale riferito al profilo e alla categoria, come nel documento 04, valido fra eventi; non introdurre un `eventId` nel contratto budget esistente. Nell’editor prodotto mostrare il budget della categoria esatta; senza corrispondenza non ereditare automaticamente quello del padre. Con prezzo presente, mostrare differenza rispetto al budget senza sommare i prodotti come spesa. Rimuovere un override ripristina il valore JSON, se presente; distinguere da «Nessun budget», che richiede un override esplicito di esclusione per non far riapparire il seed.

## 4. Modelli dati UI minimi [PROPOSTA TECNICA]

Non è uno schema DB definitivo; i nomi sono esempi di contratti frontend tipizzati.

```ts
type ID = string;
type VisitStatus = 'to_visit' | 'visited' | 'revisit';
type ProductStatus = 'planned' | 'registered';
type SyncState = 'local' | 'queued' | 'syncing' | 'synced' | 'error';
type ThemePreference = 'system' | 'light' | 'dark';

type ProfileSummary = {
  id: ID;
  name: string;
  origin: 'json' | 'personal';
  color?: string;
  avatar?: string;
};

type StandSummary = {
  id: ID;
  eventId: ID;
  name: string;
  logoLocalUrl?: string;
  hall?: string;
  booth?: string;
  categoryIds: ID[];
  interestForActiveProfile: boolean;
  priorityForActiveProfile?: number; // 1..10
  visitStatusForActiveProfile: VisitStatus;
};

type ProductSummary = {
  id: ID;
  eventId: ID;
  profileId: ID;
  standId: ID;
  name: string;
  categoryId: ID;
  status: ProductStatus; // 'registered' solo dopo la prima registrazione valida
  rating?: number; // 1..10; undefined = non valutato
  price?: number;
  currency?: string;
  favorite: boolean;
  mainPhotoId?: ID;
  description?: string; // campo unico; nessun limite funzionale UI
  createdAt: string;
  updatedAt: string;
};
```

**Separazione obbligatoria:** `visitStatusForActiveProfile` è proprietà della relazione profilo–stand, **non** di `ProductSummary`. La checklist è associata a profilo, evento e stand; le risposte questionario al prodotto e alla versione del questionario. La stella usa solo `interestForActiveProfile`, non un secondo flag preferito. I riferimenti stand devono distinguere `catalog`/`personal` ed evento come nei documenti 12/19. Una voce checklist necessita di ID stabile, testo e completamento personale; non basta persistere stringhe senza identità. Il contratto budget resta profilo/categoria, con override del seed.

## 5. Flussi, stati e regole offline

### 5.1 Salvataggio automatico, validazione e recupero

1. Aprire 05 sul prodotto esistente, sul pianificato o su un nuovo inserimento. L’apertura non produce record vuoti o duplicati.
2. Ogni modifica intenzionale aggiorna il record locale; le mutazioni valide scrivono **atomicamente record e outbox**. Foto: blob e metadati persistiti prima di dichiarare successo. Non esistono entità, store, badge o pulsanti bozza.
3. **[SCELTA OPERATIVA di validazione]** Nell’inserimento iniziale conservare i valori parziali nello stesso record locale, con validazione pendente interna; finché mancano stand, nome o categoria non contarlo come registrato e non inviare un payload invalido al server. Il modulo riapre tali valori dopo refresh. Al primo insieme minimo valido la registrazione è automatica, senza conferma Salva: bloccare categoria e stand, inserire outbox, aggiornare conteggi. Lo stato tecnico di validazione non è una modalità bozza o una seconda lista da gestire.
4. Su prodotto già registrato, un valore temporaneamente invalido (ad esempio nome svuotato durante riscrittura) viene conservato localmente come input da correggere; non sovrascrivere l’ultima versione valida con dati invalidi e non accodarla al server. Mostrare l’errore vicino al campo. Le altre modifiche valide restano salvate; la sync non deve reintrodurre il valore invalido. Preservare anche l’input da correggere al ritorno/refresh, senza creare uno store separato di bozze.
5. Persistenza durante l’input; un eventuale debounce breve non deve perdere l’ultima modifica al cambio vista/profilo. Attendere il commit locale prima di navigare. Se quota/storage falliscono, mantenere il testo in memoria, mostrare errore e consentire riprova senza dichiarare «Salvato».
6. Sync automatica dei valori validi quando possibile, con operazioni ordinate per record e dipendenze prodotto/foto. «Fine» torna al contesto previsto dopo commit locale e controllo dei campi, senza attendere il server. Indietro non annulla modifiche già salvate; non offrire «Scarta modifiche». L’eliminazione esplicita resta confermata.
7. Dopo refresh/riapertura, recuperare dati e input locale in corso; la sync riparte dall’outbox. Distinguere chiaramente dati salvati sul dispositivo, invio pendente, sincronizzati ed errori.

### 5.2 Navigazione e profilo

- Dati personali visibili filtrati per evento e profilo attivi; catalogo stand condiviso. I budget sono personali al profilo e alla categoria, come specificato in 11a.
- Cambio profilo/evento immediato dopo completamento del commit locale; nessuna conferma su modifiche già autosalvate e nessuna cancellazione delle operazioni degli altri contesti.
- Se la persistenza locale fallisce, non abbandonare in silenzio input ancora solo in memoria: mostrare l’errore e azione ritenta.
- Se profilo/evento non è più valido, presentare scelta esplicita senza eliminare dati locali.
- Tutte le liste prodotti e sezioni stand aprono 05, mai 08. Descrizione, risposta e foto tornano all’editor unico.

### 5.3 Stati obbligatori di ogni schermata

| Stato | Comportamento |
|---|---|
| Loading | skeleton leggero, niente spinner a schermo pieno se cache disponibile |
| Vuoto | testo chiaro e CTA coerente («Aggiungi prodotto», «Mostra tutti») |
| Offline | dati locali consultabili/modificabili, indicatore discreto |
| Sync in corso | operazioni accodate/progresso, navigazione non bloccata |
| Errore di sync | dettagli consultabili e pulsante ritenta |
| Errore di validazione | messaggio vicino al campo, focus sul primo errore |
| Eliminazione | conferma con nome oggetto e conseguenze |
| Dato mancante | «Non disponibile» / «Non valutato», mai dati inventati |

## 6. Accessibilità, prestazioni e verifiche

- Contrasto WCAG AA per testo e controlli; testare light/dark anche con luminosità elevata.
- Screen reader: etichette accessibili per icone, slider e azioni; stato e priorità leggibili senza colore.
- Navigazione con tastiera per uso desktop di servizio, anche se non è focus progettuale.
- Liste grandi virtualizzate solo se necessario, senza rompere scroll e focus; loghi locali con fallback.
- Foto originali: anteprime generate localmente senza alterare l'originale; caricamento progressivo e ripresa tentativi, ove possibile.
- Nessuna dipendenza da CDN/font remoto per visualizzazione essenziale offline.
- Test su Galaxy S25 (viewport mobile reale), viewport stretti, tastiera aperta, temi chiaro/scuro, rete assente/intermittente.
- Test flusso end-to-end: profilo → stand → checklist → prodotto pianificato → questionario → descrizione → foto → salvataggio automatico offline → sync → riapertura editor 05.

## 7. Criteri di accettazione per Codex

- [ ] Primo avvio seleziona profilo; successivi vanno alla Dashboard; cambio profilo immediato e dati isolati.
- [ ] Dashboard: quattro statistiche e fino a cinque stand secondo il perimetro interessi; evento cambiabile solo nelle impostazioni.
- [ ] Stella stand = interesse JSON più override; nessun preferito stand separato o stato visita «Non interessato».
- [ ] Lista stand: interessi default, catalogo completo su richiesta, filtri e priorità decrescente; ritorno conserva filtro/scroll.
- [ ] Stand: checklist con ID stabile, stato manuale, priorità e note dedicate autosalvate; nessuna foto stand o mappa.
- [ ] Stand personali creabili/modificabili offline; blocco eliminazione con prodotti collegati.
- [ ] Budget per categoria disponibili in Profilo e in 05, per profili JSON/personali, con override e distinzione nessun budget/zero.
- [ ] Pianificati e registrati aprono sempre 05; nessun percorso prodotto 08 o passaggio «Modifica prodotto».
- [ ] Editor unico: foto in basso, questionario inline, sei tipi domanda, descrizione unica senza limite UI di testo.
- [ ] Nessun badge, store, lista, pulsante o salvataggio separato bozza; nessuna conferma finale per rendere sincronizzabili modifiche valide.
- [ ] Input iniziali incompleti conservati localmente e recuperabili, esclusi dai registrati e dalla sync finché invalidi.
- [ ] Primo salvataggio valido blocca categoria/stand anche offline; valori successivamente invalidi non distruggono quelli validi né l’input da correggere.
- [ ] Voto facoltativo non preassegnato, rimuovibile; spunta questionario indica risposta presente, non è un toggle autonomo.
- [ ] Risposte/descrizione/foto salvano automaticamente; indietro non annulla; errori locali non mostrano falso successo.
- [ ] Foto originali, viewer, principale e sostituzione dopo eliminazione, conferme e pulizia sicura degli orfani.
- [ ] Duplica in 05 crea una copia immediatamente salvata con nuovo ID, descrizione/risposte e senza foto; elimina con conferma.
- [ ] Nessun campo visita sul prodotto e nessun cambiamento automatico dello stato stand.
- [ ] Contatore sync totale dispositivo, foto incluse una volta, dettagli nel contesto attivo; sync automatica più manuale, entrambe le reti, LWW fisso.
- [ ] LWW per record in ordine server, retry idempotente, tombstone protette e recupero come nuovo elemento dei dati respinti.
- [ ] Assenti pulsanti Informazioni foto, Pulisci recenti, Reset personalizzazioni, descrizione profilo, selettore icone e opzioni sync superflue.
- [ ] Tema automatico/chiaro/scuro, contrasto, target touch, tastiera e safe area verificati.
- [ ] Tutti i flussi principali funzionano offline senza perdita di modifiche persistite o foto; nessuna promessa di sync a PWA chiusa.
- [ ] Nessuna funzione di mappe/itinerari, condivisione/export o flusso post-fiera introdotta nel mobile di questa fase.

## 8. Decisioni originarie Q1–Q8 e aggiornamento

Le risposte A1–A9 prevalgono sui punti originari incompatibili. Questa tabella conserva la tracciabilità senza mantenere requisiti superati come attivi.

| ID | Regola attuale | Aggiornamento |
|---|---|---|
| Q1 | Una descrizione personale unica per prodotto, senza cronologia e senza limite UI di testo | Confermata e completata da A5. |
| Q2 | LWW per record con revisioni server, idempotenza e protezione cancellazioni | Confermata; dettaglio operativo in 10 e §10.1/A7. |
| Q3 | Copia dati principali, descrizione e risposte; foto escluse | Copia ora salvata automaticamente, senza nuova bozza, e aperta in 05. |
| Q4 | Da creazione prodotto tornare allo stand selezionato | Resta valida con azione Fine; modifica esistente torna alla vista chiamante. |
| Q5 | Voto generale facoltativo; assente `—/10` | Confermata; rimozione voto disponibile. |
| Q6 | Nome/colore/avatar JSON in sola lettura; dati personali modificabili | Confermata; nessun selettore icone personale aggiuntivo da A6. |
| Q7 | Nessuna fotografia stand autonoma | Confermata. |
| Q8 | Conferma e pulizia sicura nell’eliminazione | La precedente eliminazione di una bozza è superata da A3/A4: si eliminano record locali/prodotti o foto reali, con conferma e tombstone dove necessarie. |

I PNG restano riferimenti visivi originali: le correzioni da applicare all’interfaccia sono nell’indice §0.1. La tavola 08 è archiviata, non va riprogettata per questa fase.

## 9. Strategia di implementazione suggerita

1. Design tokens, shell, quattro tab, tema e componenti comuni.
2. Profili, evento, Dashboard e stand, inclusi interessi, checklist, note e stand personali.
3. Repository locale con salvataggio automatico, validazione, outbox e recupero degli input; nessun sottosistema bozze.
4. Editor unico prodotto 05, questionari, descrizione illimitata, lista prodotti e budget per categoria.
5. Foto originali, viewer, dipendenze upload, sync automatica e LWW con tombstone protette.
6. Verifiche offline, concorrenza, accessibilità e confronto visivo chiaro/scuro con le sole parti attive dei mockup.

L’aggiornamento riguarda le specifiche, non costituisce implementazione dell’app. Le decisioni dell’utente e le scelte operative di raccordo sono distinte; non reintrodurre funzionalità superate perché ancora raffigurate nei PNG.

## 10. Risposte di revisione recepite

### 10.1 Decisioni A1–A9 [DECISO]

Le risposte inserite dall’utente sono integrate nei flussi precedenti; la tabella distingue decisione e conseguenza operativa. Nessuna delle nove domande resta in attesa di risposta.

| ID | Risposta dell’utente recepita | Regola risultante |
|---|---|---|
| A1 | Le stelle indicano interesse, inizializzato dagli stand nel JSON interessi/da visitare | Un solo interesse personale con override; stato visita distinto. Perimetro conteggi e top 5 definito in 02 come scelta operativa. |
| A2 | Usare sempre la fase 05; dimenticare 08 per ora | Editor unico per prodotti nuovi/esistenti; azioni e informazioni spostate in 05/06. Tavola 08 conservata ma inattiva. |
| A3 | Eliminare le bozze; salvare prima in locale, poi sul server appena connessi | Nessun ciclo bozza/Salva finale; autosalvataggio e outbox. Validazione minima protegge il server da record incompleti, senza perdere l’input locale. |
| A4 | Nessuna bozza neppure nelle risposte: salvare tutto localmente, poi sul server | Risposte autosalvate; ritorno non annulla; spunta indica presenza risposta. Rimuovere Annulla/Salva risposta come commit finale. |
| A5 | Nessun limite di testo | Nessun limite funzionale /500 e nessun troncamento. Nessuna cronologia o note rapide da JSON introdotte dal solo mockup. |
| A6 | Togliere tutti i controlli accessori segnalati | Rimossi Informazioni foto, Pulisci recenti, Ripristina personalizzazioni, descrizione profilo e selettore icone/avatar personale. |
| A7 | Scegliere la soluzione più sensata e semplice | Sync sempre automatica più avvio manuale, tutte le reti, LWW fisso, feedback in app, totale dispositivo con foto già incluse; niente controlli configurabili superflui. |
| A8 | Accettare la proposta sulla categoria | Categoria obbligatoria e bloccata dopo prima registrazione locale valida; selezionabile durante l’inserimento iniziale. Stand stabile dopo registrazione come default conservativo esplicitato in 05. |
| A9 | Stand personali e budget servono durante la fiera; prevale il testo anche senza mockup | Aggiunti 04b e 11a con accessi, campi, autosalvataggio, vincoli e criteri di accettazione. |

### 10.2 Raccordo normativo dei documenti correlati

La revisione corrente comprende gli aggiornamenti nei documenti generali, di configurazione, UI, storage, API, database, sincronizzazione, fotografie e test. Ogni documento coinvolto richiama questo contratto mobile; i relativi blocchi di aggiornamento prevalgono sui precedenti esempi incompatibili. Gli esempi storici non autorizzano a implementare `drafts`, conferme finali Salva, 08, foto stand o risoluzione manuale dei conflitti.

**Scelte operative adottate per completare il raccordo:** conteggi e top 5 sugli interessi; memoria lista solo nel ritorno; validazione locale con recupero input; categoria/stand stabili alla prima registrazione valida; matching esatto questionari e budget; budget profilo/categoria condiviso fra eventi; feedback sync in app; contatore su tutto il dispositivo; LWW secondo ordine di accettazione server; tombstone e recupero con nuovo ID. Non sono nuovi punti in sospeso.

### 10.3 Copertura visiva e dettagli tecnici residui

Mancano mockup dedicati per note stand, stand personali, budget, editor con campi bloccati, tipi domanda diversi dal rating, conferma eliminazione profilo e stati vuoto/errore/offline/quota. **Sono funzioni comunque incluse quando descritte nel testo**; usare lo stesso design system, senza bloccare l’implementazione in attesa di altre immagini.

I soli due asset del marchio sono PNG, non vettoriali; mancano SVG e wordmark separato. Per la fase iniziale usare quelli disponibili con resa adatta al tema; verificare ritaglio e icona PWA. Le immagini prodotto e i loghi degli espositori nelle tavole non sono asset separati: usare il catalogo o fallback, senza ritagliarli dalle tavole.

Restano dettagli tecnici da misurare in implementazione, non domande funzionali A1–A9: limiti reali di quota/file e formati foto, retention di tombstone e payload recuperabili, gestione degli aggiornamenti schema e durata degli eventuali debounce. Nessun limite tecnico deve troncare testo o far dichiarare salvata una modifica non persistita.

**Esito:** navigazione, persistenza, funzioni in fiera e azioni da eliminare sono definite. Il testo aggiornato prevale sui mockup e sostituisce i punti della revisione precedente ormai superati.
