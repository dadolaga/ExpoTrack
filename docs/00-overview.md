# 00 — Panoramica funzionale di ExpoTrack

> **Tipo:** specifica funzionale generale  
> **Stato:** base di progetto per la versione 1  
> **Documento principale:** [`../README.md`](../README.md)  
> **Evento pilota:** EICMA 2026  
> **Ambito:** fiere ed esposizioni in generale, non soltanto EICMA

---

## 1. Scopo del documento

Questo documento descrive **che cosa deve fare ExpoTrack**, **chi lo utilizza**, **come si svolgono i flussi principali** e **quali comportamenti devono essere rispettati** in tutti i moduli.

Non è il documento che definisce definitivamente tabelle SQL, endpoint, componenti React o la sintassi completa dei JSON. Questi aspetti saranno specificati nei README tecnici successivi.

### 1.1 Obiettivo del prodotto

ExpoTrack è una web app installabile (PWA) per:

1. preparare una visita a una fiera partendo da un catalogo di stand;
2. gestire interessi e priorità **personali**;
3. seguire l'avanzamento delle visite;
4. registrare prodotti scoperti, con fotografie, note e valutazioni;
5. rispondere a questionari **configurati per profilo e categoria/sottocategoria**;
6. consultare, filtrare, confrontare ed esportare le informazioni raccolte;
7. continuare a funzionare durante interruzioni della connessione.

**Vincolo fondamentale:** ExpoTrack deve poter essere riutilizzato per fiere diverse. I nomi e i contenuti EICMA sono dati di configurazione dell'evento pilota, non regole codificate nell'app.

### 1.2 Principi di progettazione

- **Mobile-first:** operazioni rapide con una mano, interfaccia adatta al telefono durante la fiera.
- **Desktop complementare:** consultazione estesa e confronto affiancato dei prodotti.
- **Offline-first:** il lavoro non deve interrompersi quando la rete è assente.
- **Semplicità:** nessun login o PIN interno nella prima versione.
- **Separazione dei profili:** nessuna mescolanza involontaria di prodotti, risposte e note.
- **Configurabilità:** cataloghi e questionari definiti da JSON modulari.
- **Salvataggio consapevole:** una bozza non equivale a un record confermato.
- **Tracciabilità dei conflitti:** niente sovrascritture silenziose.

---

## 2. Ambito della prima versione

### 2.1 Funzionalità incluse

| Area | Funzionalità |
|---|---|
| Eventi | Catalogo configurabile, inizialmente EICMA 2026 |
| Profili | Profili iniziali JSON e nuovi profili creati nell'app |
| Stand | Elenco, dettagli, filtri, priorità, stati di visita, note e fotografie |
| Stand personali | Creazione, modifica ed eliminazione da parte del profilo proprietario |
| Prodotti | Inserimento, modifica, eliminazione, fotografie multiple, prezzo, voto, preferiti, note |
| Questionari | Definizioni JSON per profilo e categoria/sottocategoria; risposte facoltative |
| Dashboard | Riepiloghi personali e accesso diretto alle liste filtrate |
| Ricerca | Stand e prodotti, con filtri e ordinamenti |
| Confronto | Prodotti della stessa categoria, **solo desktop** |
| Offline | Dati consultabili, bozze, salvataggio locale, coda di sincronizzazione |
| Sincronizzazione | Automatica al ritorno della rete, comando manuale, conflitti risolti dall'utente |
| Export | JSON personale, PDF riassuntivo, PDF con schede dettagliate |

### 2.2 Esclusioni esplicite

Non fanno parte della prima versione:

- login, password o PIN all'interno dell'app;
- autenticazione obbligatoria tramite Cloudflare Access;
- percorsi, navigazione, ottimizzazione itinerari o mappe degli spostamenti;
- importazione di un JSON per ripristinare i dati;
- esportazione Excel;
- confronto affiancato dei prodotti su smartphone;
- creazione automatica di questionari per profili senza configurazione;
- gestione di acquisti, carrelli, pagamenti o ordini.

La configurazione futura di Cloudflare Access resta possibile senza trasformare i profili ExpoTrack in account autenticati.

---

## 3. Glossario e concetti

| Termine | Significato |
|---|---|
| **Evento** | Fiera o esposizione configurata; EICMA 2026 è l'evento pilota |
| **Padiglione** | Raggruppamento fisico di stand; informazione facoltativa se non verificata |
| **Stand** | Espositore o postazione fisica del catalogo; ogni postazione è un record distinto |
| **Stand del catalogo** | Stand definito nei JSON dell'evento, condiviso tra i profili |
| **Stand personale** | Stand creato nell'app, visibile soltanto al profilo proprietario |
| **Profilo** | Identità operativa selezionabile nell'app; **non** è un account di sicurezza |
| **Interesse** | Priorità e indicazioni personali relative a uno stand |
| **Categoria** | Nodo di una gerarchia di classificazione |
| **Sottocategoria** | Categoria figlia di un'altra categoria, con profondità estendibile |
| **Prodotto osservato** | Oggetto registrato da un profilo durante la visita, associato a uno stand |
| **Questionario** | Definizione JSON di domande per uno specifico profilo e categoria/sottocategoria |
| **Risposta** | Dato personale associato a un prodotto e a una domanda |
| **Bozza** | Modifica conservata localmente ma non ancora confermata con **Salva** |
| **Record salvato** | Modifica confermata, persistita localmente e pronta alla sincronizzazione |
| **Conflitto** | Due modifiche incompatibili dello stesso dato effettuate su dispositivi diversi |

### 3.1 Distinzione fondamentale: configurazione e dati

**Configurazione JSON** (editoriale, versionata): evento, padiglioni, categorie, catalogo stand, profili iniziali, interessi iniziali e definizioni dei questionari.

**Dati applicativi** (dinamici): profili creati nell'app, stati di visita, stand personali, prodotti osservati, note, foto, preferiti, risposte, bozze e modifiche in sincronizzazione.

I dati applicativi sono gestiti con IndexedDB sul dispositivo e PostgreSQL sul server. **Non si aggiornano modificando i JSON di configurazione**.

---

## 4. Profili e isolamento dei dati

### 4.1 Profili preconfigurati

I profili iniziali sono descritti da `config/profiles.json` e hanno identificativi stabili (per esempio `me` e `father`), nome, colore, icona e stato di abilitazione.

Gli interessi iniziali e i questionari sono definiti da file separati. Un profilo può avere priorità e domande completamente diverse da quelle di un altro.

Un profilo disabilitato non compare nel selettore, ma i suoi dati devono rimanere conservati.

### 4.2 Profili creati nell'app

Un visitatore può creare un profilo senza modificare file JSON.

Il nuovo profilo:

- vede gli stand del catalogo condiviso;
- parte senza interessi, priorità o questionari personali preimpostati;
- può registrare interessi, visite, stand personali, prodotti, fotografie e note;
- può compilare questionari **soltanto se viene predisposta una definizione JSON dedicata al suo ID e alla categoria pertinente**;
- può essere rinominato o cambiare colore;
- può essere eliminato con **doppia conferma**, eliminando i suoi dati associati.

Le modalità esatte di rimozione dei dati sincronizzati e dei file fotografici saranno definite nei documenti su database, API e foto.

### 4.3 Selezione e cambio profilo

- Al primo utilizzo si seleziona un profilo.
- La selezione viene ricordata sul dispositivo.
- All'apertura successiva l'app mostra la **dashboard** del profilo ricordato.
- Dalla sezione **Profilo** si può passare a un altro profilo.
- Nome e colore del profilo attivo sono sempre visibili nell'intestazione.
- La commutazione non deve mescolare dati o bozze tra profili.

**Nota di sicurezza:** chiunque possa accedere all'app può selezionare qualsiasi profilo; questa è una scelta funzionale, non un sistema di controllo degli accessi.

---

## 5. Eventi, categorie e stand

### 5.1 Catalogo dell'evento

Ogni evento possiede un catalogo di stand. La versione iniziale usa EICMA 2026.

Uno stand del catalogo:

- ha un identificativo stabile;
- ha un nome;
- può avere padiglione e numero di postazione, se verificati;
- può appartenere a **più categorie**;
- può avere una descrizione;
- è condiviso da tutti i profili.

**Non inventare** numeri di padiglione o postazione mancanti: devono poter restare assenti.

La gerarchia delle categorie è estendibile (categoria, sottocategoria, ulteriori livelli). Se non esiste un ordinamento esplicito, si usa quello alfabetico.

### 5.2 Interessi personali sugli stand

Per ciascun profilo, uno stand può avere:

- priorità **1–10**;
- elenco facoltativo di cose da vedere;
- stato di visita;
- note libere facoltative;
- più fotografie facoltative.

La priorità è **una per stand**, non una per categoria dello stand.

Stati consentiti:

1. **Da visitare** (predefinito);
2. **Visitato**;
3. **Da rivedere**.

La modifica di uno stato non cambia lo stato dello stesso stand negli altri profili.

### 5.3 Stand creati dal visitatore

- Si possono creare anche offline.
- Sono **privati** del profilo che li crea.
- Possono contenere prodotti personali.
- Possono essere modificati ed eliminati, previa conferma.
- Non vengono aggiunti automaticamente al catalogo JSON condiviso.
- Dopo la sincronizzazione sono accessibili dallo stesso profilo sugli altri dispositivi, non dagli altri profili.

### 5.4 Elenco stand

Ricerca e filtri combinabili:

- nome;
- categoria;
- padiglione;
- priorità;
- stato di visita.

Ordinamenti:

- priorità;
- nome;
- padiglione;
- crescente o decrescente.

**Alla riapertura dell'app i filtri e gli ordinamenti tornano ai valori predefiniti.** I valori predefiniti precisi saranno formalizzati nella specifica UI.

---

## 6. Prodotti osservati

### 6.1 Creazione

Il visitatore apre uno stand e aggiunge un prodotto.

Durante la creazione:

1. inserisce il nome;
2. sceglie **manualmente una sola categoria/sottocategoria**;
3. può inserire un prezzo unico;
4. può assegnare un voto complessivo da **1 a 10**;
5. può indicare il prodotto come preferito;
6. può aggiungere note libere;
7. può allegare **più fotografie**, facoltative;
8. può rispondere al questionario previsto per il suo profilo e quella categoria.

Tutti i campi non espressamente indicati come obbligatori restano facoltativi. I dettagli di validazione saranno specificati nel documento dedicato.

### 6.2 Vincoli

- Un prodotto appartiene a **uno stand** e a **una sola categoria/sottocategoria**.
- La categoria viene scelta manualmente, anche se lo stand espone più categorie.
- **Dopo il primo salvataggio non è possibile cambiare categoria o sottocategoria.**
- Nome, prezzo, voto, note, fotografie, preferito e risposte possono essere aggiornati.
- Un prodotto creato manualmente può essere eliminato, con richiesta di conferma.
- Prodotti, foto, note e risposte sono personali: non sono condivisi automaticamente tra profili.

### 6.3 Consultazione

Il prodotto compare:

- nell'elenco prodotti del proprio stand;
- nella **lista generale personale**.

La lista generale supporta:

- ricerca per nome;
- filtro per categoria;
- filtro per stand;
- filtro per preferiti;
- ordinamento per prezzo;
- ordinamento per voto.

La comparazione affiancata è disponibile **solo su desktop**, per prodotti della stessa categoria, e mostra prezzo, voto e risposte ai questionari applicabili.

---

## 7. Questionari per profilo e categoria

### 7.1 Regola di selezione

Un questionario esiste **solo** se è definito esplicitamente per la combinazione:

**profilo attivo + categoria/sottocategoria del prodotto**.

Non esiste un questionario comune a tutti i prodotti e non vengono generate domande automaticamente.

Se non è configurato un questionario applicabile, **la sezione questionario non compare**.

L'eventuale regola di corrispondenza tra un questionario definito per una categoria padre e un prodotto in sottocategoria figlia **non è ancora stata concordata**: non va inventata nell'implementazione; sarà definita in `10-questionnaires-config.md` e `18-questionnaire-engine.md`.

### 7.2 Tipi di risposta

I questionari possono includere:

- testo libero;
- numero;
- sì/no;
- scelta singola;
- scelta multipla;
- voto da 1 a 10.

**Tutte le domande sono facoltative.**

Le risposte sono salvate nel profilo e nel prodotto, non nel JSON delle definizioni.

### 7.3 Esempio concettuale

- Profilo `me`, categoria «Moto → Naked»: domande sulla posizione di guida e sulle sensazioni in sella.
- Profilo `father`, categoria «Abbigliamento → Guanti»: domande su vestibilità e protezione.
- Profilo nuovo senza JSON dedicato: nessuna sezione questionario.

Gli esempi illustrano il comportamento; non costituiscono questionari definitivi.

---

## 8. Dashboard e navigazione

### 8.1 Avvio

Dopo l'eventuale selezione del profilo, **l'app apre sempre la dashboard personale**.

La dashboard mostra:

- stand **da visitare**;
- stand **visitati**;
- stand **da rivedere**;
- prodotti registrati;
- prodotti preferiti;
- avanzamento percentuale delle visite.

Le statistiche sono riferite al profilo attivo e all'evento corrente. La formula definitiva dell'avanzamento, compreso il trattamento degli stand «da rivedere», sarà fissata in `15-dashboard.md`.

### 8.2 Dashboard interattiva

Toccando un riepilogo, l'utente apre direttamente la lista relativa con i filtri già applicati. Il reset dei filtri alla riapertura dell'app resta valido.

### 8.3 Navigazione mobile

Barra inferiore fissa con quattro voci:

1. **Dashboard**
2. **Stand**
3. **Prodotti**
4. **Profilo**

Nell'intestazione, sempre visibili:

- nome e colore del profilo;
- indicatore di stato della connessione e sincronizzazione.

---

## 9. Salvataggio, offline e sincronizzazione

### 9.1 Bozze e pulsante Salva

La modifica di un campo produce una **bozza locale** conservata automaticamente.

Finché l'utente non preme **Salva**:

- la bozza non è considerata un record confermato;
- non deve essere sincronizzata con PostgreSQL;
- deve rimanere recuperabile localmente;
- se l'utente lascia la schermata con modifiche non salvate, deve essere avvisato.

Quando l'utente preme **Salva**:

- il record viene confermato localmente;
- l'app lo rende disponibile offline;
- se la rete è assente, lo mette in coda per l'invio successivo;
- se la rete è presente, avvia la sincronizzazione secondo le regole previste.

La presenza di una bozza non va confusa con la presenza di modifiche salvate ma non sincronizzate.

### 9.2 Comportamento offline

Dopo una prima preparazione con connessione:

- catalogo e dati necessari devono essere consultabili offline;
- si possono creare e modificare stand personali e prodotti;
- si possono compilare questionari disponibili nella cache;
- si possono conservare fotografie salvate localmente;
- i record confermati attendono la sincronizzazione.

L'uso completamente offline **al primo accesso, senza aver mai caricato l'app**, non è garantito.

### 9.3 Sincronizzazione

- Avvio **automatico** al ritorno della connessione.
- Pulsante per avvio **manuale**.
- Stato sempre visibile: **sincronizzato**, **offline**, **in attesa**, **errore**.
- Le bozze locali hanno un'indicazione distinta.
- Errori temporanei non devono comportare perdita dei dati confermati.

### 9.4 Conflitti

Se due dispositivi modificano lo stesso record in modo incompatibile:

1. l'app rileva il conflitto;
2. conserva le due versioni;
3. mostra le differenze utili all'utente;
4. chiede quale versione mantenere;
5. applica la scelta senza sovrascrivere silenziosamente dati.

Le regole di versionamento, conflitti su foto, eliminazioni e retry sono demandate a `20-synchronization.md`.

---

## 10. Esportazione

### 10.1 Ambito

L'esportazione riguarda **esclusivamente il profilo selezionato** e può essere limitata a categorie specifiche, ove applicabile.

### 10.2 JSON

Esporta i dati personali del profilo per consultazione/archiviazione.

**Non è prevista alcuna funzione di importazione o ripristino da JSON nella v1.** Non presentare il file come backup ripristinabile dall'app.

### 10.3 PDF

Sono disponibili **due formati**:

**PDF riassuntivo**
- prodotti raggruppati per categoria e sottocategoria;
- stand, prezzo, voto e informazioni essenziali;
- esportazione completa o limitata a categorie selezionate.

**PDF dettagliato**
- una scheda per prodotto;
- fotografie;
- note;
- prezzo e valutazione;
- domande e risposte del questionario personale;
- esportazione completa o per categorie.

Non è previsto l'export Excel.

---

## 11. Flussi utente di riferimento

### UC-01 — Primo avvio

**Precondizione:** applicazione raggiungibile e configurazione iniziale disponibile.

1. L'utente apre ExpoTrack.
2. Se non esiste una selezione locale, sceglie un profilo.
3. L'app carica i dati di quel profilo.
4. Viene mostrata la dashboard personale.
5. L'intestazione indica chiaramente il profilo attivo.

**Risultato:** nessun dato di un altro profilo viene presentato come proprio.

### UC-02 — Preparare la visita

1. Il visitatore apre la lista stand.
2. Cerca e filtra per categoria/padiglione/priorità.
3. Apre uno stand del catalogo.
4. Consulta le informazioni e i propri interessi.
5. Aggiunge o aggiorna note e preferenze personali.
6. Conferma con **Salva**.

**Risultato:** il catalogo condiviso resta invariato; le modifiche sono personali.

### UC-03 — Registrare una visita offline

1. Il visitatore perde la connessione.
2. Apre uno stand già disponibile offline.
3. Imposta lo stato «Visitato» o «Da rivedere».
4. Aggiunge note e fotografie facoltative.
5. Premendo **Salva**, conferma i dati sul dispositivo.
6. Al ritorno della rete, parte la sincronizzazione automatica.

**Risultato:** i dati non vanno persi a causa della disconnessione.

### UC-04 — Registrare un prodotto

1. Il visitatore apre uno stand.
2. Crea un prodotto e ne sceglie manualmente la categoria.
3. Inserisce eventuali prezzo, voto, foto, note e preferito.
4. Se esiste un questionario per quel profilo e categoria, può compilarlo.
5. Preme **Salva**.
6. Il prodotto compare nello stand e nella lista personale.

**Risultato:** categoria bloccata dopo il primo salvataggio; altri campi modificabili.

### UC-05 — Scoprire uno stand non censito

1. Il visitatore non trova uno stand nel catalogo.
2. Crea uno stand personale.
3. Lo salva e, se desidera, aggiunge prodotti.
4. Lo ritrova sui propri dispositivi dopo la sincronizzazione.

**Risultato:** lo stand **non** appare automaticamente nei profili degli altri visitatori.

### UC-06 — Creare un profilo per un amico

1. Dalla sezione Profilo si crea un nuovo profilo.
2. Si impostano nome e attributi disponibili.
3. Il profilo vede gli stand comuni.
4. Inizia a registrare interessi e dati propri.
5. Non vede questionari se non ne esistono nei JSON per il suo ID.

**Risultato:** profilo autonomo, senza preferenze iniziali.

### UC-07 — Risolvere un conflitto

1. Lo stesso profilo modifica un prodotto su due dispositivi.
2. Le versioni risultano incompatibili al momento della sincronizzazione.
3. L'app segnala il conflitto.
4. L'utente confronta le versioni e sceglie quale conservare.
5. Il sistema applica la decisione.

**Risultato:** nessuna versione è eliminata prima della decisione.

### UC-08 — Analizzare la visita su desktop

1. Il visitatore apre la lista personale dei prodotti.
2. Filtra per categoria.
3. Seleziona prodotti della stessa categoria.
4. Visualizza il confronto affiancato.
5. Esporta un PDF riassuntivo o dettagliato.

**Risultato:** analisi post-evento senza mescolare i profili.

### UC-09 — Eliminare un profilo creato nell'app

1. Il visitatore apre la sezione Profilo.
2. Seleziona un profilo creato nell'app.
3. Richiede l'eliminazione.
4. L'app mostra una prima conferma e una seconda conferma esplicita.
5. Solo dopo entrambe le conferme procede alla rimozione dei dati associati.

**Risultato:** nessuna eliminazione accidentale con un singolo tocco.

---

## 12. Requisiti trasversali

### 12.1 Usabilità

- Interfaccia leggibile e utilizzabile sul telefono.
- Azioni frequenti raggiungibili rapidamente.
- Feedback chiaro dopo **Salva**.
- Indicatori visibili di bozza, dati in attesa e problemi di sincronizzazione.
- Conferme prima di eliminazioni di stand/prodotti e doppia conferma per i profili.

### 12.2 Integrità dei dati

- Identificativi stabili per eventi, profili, stand, categorie, prodotti e domande.
- Nessuna associazione accidentale di dati tra profili.
- Validazione dei riferimenti tra JSON.
- Nessuna categoria prodotto modificabile dopo il primo salvataggio.
- Nessuna sovrascrittura automatica in caso di conflitto.
- Distinzione rigorosa tra configurazione e dati dinamici.

### 12.3 Sicurezza e riservatezza

ExpoTrack è destinata a uso privato, ma **Cloudflare Tunnel non limita da solo chi può aprire il sito**. In assenza di Cloudflare Access o altra protezione:

- chi conosce l'indirizzo può potenzialmente aprire l'app;
- può selezionare qualsiasi profilo;
- può vedere o modificare dati associati ai profili;
- l'assenza di indicizzazione sui motori di ricerca non equivale a protezione.

La prima versione resta senza login/PIN, come richiesto. La documentazione di deployment dovrà evidenziare il rischio e predisporre la possibilità di introdurre Cloudflare Access in seguito.

### 12.4 Configurabilità e riuso

- Nessuna regola applicativa dipendente dal nome «EICMA».
- Stand e questionari configurabili senza cambiare il codice.
- Possibilità di aggiungere eventi futuri.
- Assenza di dati di padiglione/postazione inventati.
- JSON di esempio mantenuti separati dai dati degli utenti.

---

## 13. Criteri di accettazione generali

Una prima versione di ExpoTrack è funzionalmente accettabile quando:

- [ ] Si apre su smartphone e desktop e mostra sempre la dashboard del profilo attivo.
- [ ] È possibile selezionare e cambiare profilo senza mescolare i dati.
- [ ] I profili iniziali provengono dai JSON e i nuovi profili possono essere creati nell'app.
- [ ] Un profilo creato nell'app parte senza interessi e senza questionari automatici.
- [ ] Il catalogo stand condiviso viene letto dalla configurazione dell'evento.
- [ ] Gli stand personali sono visibili solo al profilo proprietario.
- [ ] Gli stati di visita, le note e le fotografie degli stand sono personali.
- [ ] La ricerca e i filtri degli stand funzionano; si azzerano alla riapertura.
- [ ] Si possono creare prodotti con una sola categoria scelta manualmente.
- [ ] Dopo il primo salvataggio la categoria del prodotto non è modificabile.
- [ ] Ogni prodotto appare sia nello stand sia nella lista personale.
- [ ] I questionari appaiono solo se definiti per profilo e categoria pertinente.
- [ ] Tutte le domande del questionario sono facoltative.
- [ ] Le bozze vengono conservate localmente e non sono sincronizzate senza **Salva**.
- [ ] L'app continua a registrare dati offline dopo il caricamento iniziale.
- [ ] I record confermati offline vengono sincronizzati automaticamente quando torna la rete.
- [ ] Esiste una sincronizzazione manuale e un indicatore sempre visibile.
- [ ] I conflitti vengono presentati all'utente senza sovrascrittura automatica.
- [ ] Il confronto affiancato è disponibile su desktop, non su smartphone.
- [ ] L'export JSON è separato per profilo e non è prevista importazione.
- [ ] Entrambi i PDF (riassuntivo e dettagliato) supportano la selezione delle categorie.
- [ ] L'eliminazione di un profilo creato nell'app richiede doppia conferma.
- [ ] Nessuna funzionalità di itinerario o mappa è necessaria per completare la v1.

I singoli README aggiungeranno test più precisi e verificabili.

---

## 14. Decisioni consolidate e dettagli ancora da specificare

### 14.1 Decisioni consolidate

Sono **vincolanti** per la prima versione:

- Next.js + React + TypeScript, Tailwind CSS personalizzato;
- PostgreSQL, IndexedDB, PWA, Docker, Cloudflare Tunnel;
- niente login/PIN interni e Cloudflare Access rimandato;
- profili indipendenti e nuovi profili creati dall'app;
- catalogo condiviso e stand creati nell'app privati;
- una categoria per prodotto, immutabile dopo il primo salvataggio;
- questionari JSON soltanto per profilo e categoria/sottocategoria;
- salvataggio esplicito e sincronizzazione automatica/manuale;
- conflitti risolti manualmente;
- dashboard interattiva, confronto solo desktop;
- export JSON e PDF, senza import JSON né Excel.

### 14.2 Dettagli da definire nei documenti successivi

Questi aspetti **non vanno inventati durante l'implementazione**:

| Aspetto | Documento previsto |
|---|---|
| Come si seleziona l'evento corrente e come convivono più eventi | `03-app-config.md`, `01-architecture.md` |
| Formato esatto di ogni JSON e schema di validazione | `03`–`11` |
| Regole di eredità dei questionari tra categoria e sottocategoria | `10-questionnaires-config.md`, `18-questionnaire-engine.md` |
| Valori predefiniti esatti dei filtri e formula di avanzamento | `14-frontend-ui.md`, `15-dashboard.md` |
| Identificativi, schema dati, cancellazioni e versioni | `12-database.md` |
| API e regole di sincronizzazione tra dispositivi | `13-backend-api.md`, `20-synchronization.md` |
| Conservazione foto offline, limiti e pulizia dello storage | `21-photo-management.md` |
| Struttura dettagliata dei file esportati | `23-export.md` |
| Deployment, esposizione e futura protezione Access | `24-deployment.md`, `25-security.md` |

---

## 15. Dipendenze documentali e prossimi passi

Questo documento è una **specifica funzionale trasversale**: i documenti successivi devono rispettarne i vincoli, salvo modifica esplicita e coordinata della documentazione.

Percorso consigliato:

1. [`01-architecture.md`](01-architecture.md) — architettura applicativa, responsabilità dei componenti e flussi dati.
2. [`02-project-structure.md`](02-project-structure.md) — organizzazione del repository e convenzioni.
3. `03`–`11` — configurazioni JSON e modelli funzionali.
4. `12`–`13` — database e API.
5. `14`–`23` — interfaccia, funzionalità, offline, sincronizzazione ed export.
6. `24`–`26` — distribuzione, sicurezza e test.

**Regola per gli sviluppatori:** se una decisione non è documentata, non considerarla automaticamente approvata. Annotarla nel documento pertinente e risolverla prima di implementare il comportamento che ne dipende.
