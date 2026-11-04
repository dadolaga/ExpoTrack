# Persistenza locale — step 05

`openLocalRepository()` apre IndexedDB `expotrack-local`, versione **4**. Non apre
connessioni a database server e non esegue richieste di rete. Importare i tipi da
`src/types/offline.ts`; aprire il repository soltanto nel browser. L’importazione
del modulo non accede alle API browser durante il rendering server di Next.js.

## Store e contesti

| Store | Chiave | Impiego |
|---|---|---|
| `config_snapshots` | `id` | Snapshot editoriali validati, separati dai dati personali. |
| `app_meta` | `key` | Puntatore allo snapshot attivo e preferenza locale `active-context` con profilo/evento. |
| `products` | `[profileId, eventId, id]` | Input corrente, errori, ultima versione valida e sequenza locale. |
| `stand_preferences` | `[profileId, eventId, standRef.source, standRef.standId]` | Override personali degli stand; l’assenza di un campo conserva il seed. |
| `personal_stands` | `[profileId, eventId, id]` | Input e ultima versione valida degli stand personali; tombstone dopo eliminazione. |
| `photos` | `[profileId, eventId, id]` | Metadati foto, proprietario prodotto, principale, sequenza e tombstone. |
| `photo_assets` | `[profileId, eventId, id]` | Originale immutabile, anteprima e miniatura separate. |
| `outbox` | `operationId` | Mutazioni valide da inviare in futuro; indice univoco su contesto/tipo entità/entità/sequenza. |

Tutte le letture e scritture personali richiedono esplicitamente profilo ed evento.
Le chiavi composte sono array IndexedDB: non concatenazioni di stringhe.
Lo stesso ID in contesti diversi non sovrascrive un altro record. I metodi di
scrittura verificano che profilo ed evento siano disponibili nello snapshot;
quelli di lettura conservano l’accesso ai record anche se il catalogo cambia.

Non esiste uno store `drafts`. Gli altri store di dominio saranno aggiunti quando
le relative funzionalità verranno implementate, con migrazioni della versione
IndexedDB; questa versione è distinta dallo `schemaVersion` dei JSON.

## API attuale

| Metodo | Risultato |
|---|---|
| `saveCatalog(snapshot, snapshotId?)` | Accetta il `CatalogSnapshot` già validato dal loader dello step 04; ricontrolla i riferimenti. Snapshot e puntatore si scrivono nella stessa transazione. Gli ID snapshot non si sovrascrivono: una collisione rifiuta la transazione e preserva lo snapshot attivo precedente. Nessuna cancellazione dei dati personali o delle code. |
| `getCatalog()` | Snapshot attivo, oppure `null` prima del caricamento iniziale. |
| `initializeProfileSession(catalog)` | Collega il catalogo validato e risolve la scelta ricordata. Evita di duplicare snapshot identici e non sceglie il primo profilo. |
| `getProfileSession()` | Sessione risolta dal catalogo attivo e dalla preferenza locale; `null` se il catalogo non è ancora caricato. |
| `selectProfile(profileId)` | Verifica disponibilità, attende le transazioni personali già avviate e salva il contesto locale dopo commit. Non accoda preferenze al server e non elimina prodotti o code. |
| `saveProduct(context, id, changes)` | Salva una patch dei campi modificati intenzionalmente. Restituisce il record solo dopo commit riuscito; in caso di errore rigetta la Promise. |
| `getProduct(context, id)` | Record completo di input, errori e ultima versione valida; `undefined` se assente. La sola lettura non crea record. |
| `listProducts(context)` | Record locali del solo contesto, compresi input incompleti da recuperare. |
| `listRegisteredProducts(context)` | Ultime versioni valide del solo contesto. Esclude gli inserimenti che non hanno mai raggiunto i dati minimi validi. |
| `listOutbox(context)` | Mutazioni del solo contesto, ordinate per entità e sequenza locale; nessun invio o conferma simulata. |
| `listStandPreferences(context)` | Override degli stand del solo profilo/evento; una lettura non materializza i seed. |
| `setStandInterest(context, standId, interested, source?)` | Override booleano con outbox atomica. Origine predefinita `catalog`; usare `personal` per uno stand del proprietario. |
| `saveStandPreferences(context, standId, changes, source?)` | Patch di interesse, priorità, visita, checklist e note. Origine predefinita `catalog`; record/outbox atomici, campi indipendenti preservati. |
| `getVisitData(context)` | Snapshot atomico di preferenze, stand personali attivi e prodotti registrati del contesto; condiviso da lista, dettaglio e dashboard. |
| `getPersonalStand(context, id)` | Input e ultima versione valida del solo proprietario/evento, anche per recupero dopo refresh; una lettura non crea record. |
| `savePersonalStand(context, id, changes)` | Patch validata, senza modificare il catalogo; prima versione valida inizializza interesse e visita con le rispettive operazioni dipendenti. |
| `deletePersonalStand(context, id)` | Blocca prodotti collegati anche parziali; altrimenti elimina preferenze e salva tombstone/outbox atomicamente. |
| `close()` | Chiude la connessione. Riaprire il repository rilegge lo stesso archivio persistente. |

## Sessione del profilo — step 06

Il layout server carica i JSON dello step 04 e passa soltanto dati serializzabili a
`ProfileProvider`. Nel browser il bootstrap salva uno snapshot solo se cambiato e
legge `app_meta["active-context"]`. Senza preferenza, oppure se profilo/evento sono
rimossi, disabilitati o non validi, la sessione non attiva un contesto e richiede una
scelta esplicita. Una preferenza non più valida viene conservata finché l’utente
sceglie, senza cancellare dati o code degli altri contesti.

Il cambio conserva l’evento ricordato se ancora disponibile; altrimenti, dopo la
scelta esplicita del profilo, usa l’evento predefinito valido. Questa preferenza è
locale al dispositivo e non genera operazioni di outbox. Le transazioni di cambio
condividono gli store con i salvataggi personali per attendere i commit già avviati;
i futuri editor devono comunque attendere e gestire l’esito di `saveProduct`,
come descritto sotto, prima di abbandonare input ancora in memoria.

La pagina di selezione distingue configurati e personali; attualmente il catalogo
fornisce soltanto profili JSON. Non sono aggiunti store o API di creazione personale
prima dello step 20. Nello step 06 lo schema IndexedDB restava alla versione 1: la preferenza usa
lo store `app_meta` già esistente. Una modifica del catalogo viene riletta a un nuovo
caricamento del layout, senza un motore di aggiornamento o sincronizzazione.

## Interessi stand — step 07

La migrazione 1 → 2 aggiunge `stand_preferences` e ricrea soltanto l’indice univoco
dell’outbox includendo `entityType`, così un prodotto e una preferenza con ID e
sequenza uguali non collidono. Conserva snapshot, profilo selezionato, prodotti e
operazioni pendenti. I dati della versione 1 non vengono riscritti né eliminati.

La stella scrive esclusivamente `interested`: `false` è una rimozione esplicita
anche quando il JSON include lo stand. Non copia la priorità iniziale nel record
e non cambia la visita; eventuali override personali di priorità e visita già
presenti sono conservati. L’assenza di priorità personale permette di seguire
gli aggiornamenti del seed; `null` conserva invece una rimozione intenzionale.
Il selettore applica la precedenza per campo senza modificare il catalogo.

Ogni scrittura rilegge il record nella transazione, preserva gli altri campi,
incrementa la sequenza e dipende dall’operazione precedente della stessa entità.
Ripetere lo stesso override non aggiunge operazioni. Quota/abort annullano insieme
record e coda; la UI aggiorna la stella soltanto dopo commit e permette il retry.
L’outbox distingue `product`, `stand-preferences` e `personal-stand`.

In questo step il prodotto copre il minimo necessario alla persistenza: nome,
categoria, riferimento stand e descrizione libera. Prezzo, valutazione, risposte,
foto ed eliminazione prodotto avranno contratti estesi nei loro step. Dallo step
10 sono validi anche i riferimenti a stand personali attivi del proprietario:
la mutazione prodotto dipende da quella dello stand. Riferimenti assenti o
eliminati restano input da correggere, senza mutazioni valide.

Per allocare un ID senza creare un record, usare `createLocalId()` da `identity.ts`.
Genera UUID v4 con `crypto.getRandomValues`, disponibile anche sulle origini HTTP
locali usate per provare l’app su telefono. La generazione segue il formato
[UUID v4, RFC 9562 §5.4](https://www.rfc-editor.org/rfc/rfc9562.html#section-5.4);
per la disponibilità dell’API vedere [Crypto.getRandomValues](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues).

## Input, validazione e outbox

`LocalProduct.input` conserva l’input corrente, anche vuoto o incompleto.
`lastValid` è `null` finché nome, categoria e stand non sono validi; in questa fase
non nasce alcuna mutazione. La categoria può essere cambiata prima della prima
registrazione valida. Gli ID di categoria e stand devono esistere nello snapshot,
con evento coerente e stand consultabile dal profilo.

Alla prima registrazione valida categoria e stand si bloccano. Un tentativo di
cambiarli rigetta la scrittura senza modificare record o coda. Il nome può essere
temporaneamente vuoto durante una riscrittura: l’input e il suo errore rimangono
locali, mentre l’ultima versione valida conserva il nome precedente. Una modifica
valida alla descrizione può comunque avanzare e accodare un payload valido con
quel nome precedente. Il testo non viene troncato.

Se un riferimento viene rimosso dal catalogo, record e ultima versione valida
rimangono disponibili; nuovi input vengono conservati con errore, senza accodare
payload con riferimenti mancanti. Ripristinare il riferimento consente di
rivalidare l’input senza perderlo. Nessuna riassegnazione automatica.

Le patch vengono applicate al record riletto **nella transazione**, preservando
campi modificati da un’altra connessione. Ogni salvataggio incrementa la sequenza
locale; solo un nuovo contenuto valido aggiunge un’operazione. Ripetere un valore
già valido non duplica l’outbox. Le operazioni mantengono ID stabili, sequenza,
versione di base e dipendenza dalla precedente operazione della stessa entità.
Le date sono diagnostiche: l’ordine locale usa sequenze e dipendenze.

Lo stato disponibile è `pending`, con revisione server iniziale `null`.
Le API di invio, retry e conferma server arriveranno negli step 23–24; non viene
dichiarato «Sincronizzato» dopo un salvataggio locale.

## Confine della transazione

Dallo step 09 `saveStandPreferences` accetta anche `notes`: stringa facoltativa
non troncata né ripulita, inclusa la stringa vuota per cancellare il contenuto.
Le altre patch preservano le note; modificarle non cambia interesse, priorità,
visita, checklist o descrizione prodotto. Non serve una migrazione dello schema 2.
Testo e outbox condividono lo stesso commit. La suite stand già collegata al
manifest verifica testo lungo, riapertura, isolamento, concorrenza, invalidi,
quota/rollback e retry.

Le modifiche al prodotto e la relativa mutazione si scrivono insieme. La Promise
attende `IDBTransaction.complete`, non il solo successo della richiesta `put` o
`add`: un abort successivo annulla entrambe le scritture. La distinzione segue
[IDBTransaction: ciclo di vita e abort](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction).
All’interno della transazione si attendono soltanto richieste IndexedDB; rete,
timer e preparazione di allegati devono restarne fuori.

Il chiamante deve attendere `saveProduct` prima di annunciare il salvataggio o
cambiare vista/profilo. Se la Promise fallisce, mantenere l’input in memoria e
consentire di ritentare la stessa patch. Nessun debounce o salvataggio nascosto
alla chiusura dell’app viene introdotto qui.

## Verifiche

```bash
npm run test:integration
```

La suite integra repository, validazione, indici, transazioni e outbox con
[`fake-indexeddb`](https://github.com/dumbmatter/fakeIndexedDB) **6.2.6**, dipendenza
di solo sviluppo. Ogni scenario usa una factory separata, un database
`expotrack-test-*` e una fixture fittizia in `tests/fixtures/catalog`. Le connessioni
e i database di test vengono chiusi/eliminati al termine. Le prove di quota e
abort iniettano errori al confine dell’API di storage; non riempiono il disco.

Sono coperti riapertura, input parziali/invalidi, prima registrazione, immutabilità,
validazione dei riferimenti, isolamento di due profili per due eventi, rollback,
scritture concorrenti e attivazione atomica degli snapshot. Questi test emulano
IndexedDB in Node: non equivalgono alla persistenza su disco di un browser.

Nella consegna dello step 05 è stata eseguita anche una prova temporanea con
IndexedDB reale in Chromium: refresh, input e coda preservati, scrittura senza rete,
isolamento profili e abort tardivo. Usa un’origine HTTP fittizia con contesto browser
isolato, senza avviare o modificare il server dell’app. Non è una suite E2E della
PWA o una verifica su telefono. Le aree finali `local-persistence` e
`profile-event-isolation` sono collegate alla suite, con i limiti registrati in
`docs/final-validation.md`.

## Stand personali e snapshot visita — step 10–11

La migrazione 2 → 3 aggiunge soltanto `personal_stands`, conservando gli altri
store e indici. I test verificano aggiornamento da v1 e v2 con prodotti, note,
profilo e code preesistenti. Catalogo e stand personali con lo stesso ID restano
distinti per origine; tutte le operazioni personali sono filtrate per proprietario
ed evento.

`LocalPersonalStand.input` conserva anche un nome temporaneamente vuoto; prima
della prima versione valida non nasce outbox, interesse o voce nelle liste.
Dopo la prima registrazione l’ultima versione valida preserva il nome precedente,
come nei prodotti. L’editor non introduce una modalità bozza. Il nome è l’unico
campo obbligatorio; categorie e padiglione devono comunque esistere se indicati.

L’eliminazione controlla input e ultima versione dei prodotti nel contesto,
senza cascata. Note/checklist/preferenze sono rimosse nella stessa transazione
della tombstone; le operazioni già pendenti restano ordinate tramite dipendenze.
Un ID eliminato non viene riutilizzato. `getVisitData` legge i tre store nella
stessa transazione e gestisce anche errori sincroni senza Promise non osservate.

Step 13: l’input prodotto conserva `price` come testo, `rating` assente o 1–10 e
`favorite`. La versione valida usa prezzo numerico in euro o null (zero è valido),
voto o null e preferito booleano. I campi sono opzionali nel contratto per leggere
anche i record precedenti; i nuovi salvataggi normalizzano i valori assenti.
Prezzo temporaneamente invalido resta nell’input senza sovrascrivere il prezzo
valido; nome/voto invalidi seguono la stessa regola per campo. Descrizione e altre
modifiche valide continuano a essere accodate atomicamente. Nessun nuovo store.
I pianificati usano l’ID locale stabile `planned:<id catalogo>` nel contesto
profilo/evento; l’apertura legge soltanto, la prima modifica avvia la raccolta.

Step 14: `duplicateProduct` legge il prodotto e scrive copia/outbox nella stessa
transazione, con ID nuovo, dati dell’ultima versione valida, descrizione, prezzo,
voto e preferito. Copia esplicita dei campi attuali: identità, collegamento al
pianificato e allegati non vengono trasferiti. Questionari e fotografie non sono
ancora raccolti in questo step.

`deleteProduct` conserva un tombstone (`deletedAt`, opzionale per compatibilità)
e, per un prodotto già registrato, accoda un delete dipendente dall’ultima
operazione. Input mai registrati conservano solo un tombstone locale: nessun
payload incompleto raggiunge l’outbox. Ripetere delete non accoda duplicati;
salvataggio e duplicazione di un tombstone sono respinti. Le letture per viste e
conteggi escludono i cancellati. Uno stand personale senza altri prodotti attivi
può essere eliminato; il suo delete dipende anche dai delete dei prodotti collegati.

Il collegamento `plannedProductId` è opzionale e stabile dopo il primo input;
resta compatibile con gli ID `planned:<id>` precedenti. Un pianificato già
registrato compare una volta nella raccolta. Dopo una cancellazione il seed di
catalogo resta disponibile; riaprirlo sceglie una nuova identità deterministica
basata sul tombstone, senza resuscitare il vecchio prodotto né creare record alla
sola apertura. Non servono nuovi store o migrazioni dello schema IndexedDB.


## Questionari e risposte — step 15

`ProductInput.questionnaireInputs` conserva insiemi di input identificati dallo
snapshot completo della definizione; `ProductData.questionnaireAnswers` contiene
soltanto valori validi. Entrambi i campi sono opzionali per i record preesistenti.
Input, ultima versione valida, snapshot e outbox restano nel record prodotto e
si scrivono nella stessa transazione IndexedDB. Nessun nuovo store.

`questionnaire-input.ts` risolve per profilo/categoria esatti, riusa il parser
editoriale al confine di ingresso e rifiuta snapshot inventati, duplicati,
domande ignote e modifiche allo storico. Ogni risposta è facoltativa: chiave
assente = non compilato, `false` = No, `0` = numero valido. I numeri di input
restano testuali, anche invalidi; il payload contiene numeri finiti con min/max/step
della definizione. Un errore preserva la risposta valida precedente per quella
domanda e non impedisce alle altre modifiche valide di avanzare. Le cancellazioni
esplicite rimuovono la chiave e sono sincronizzabili.

Ogni versione usa il proprio snapshot senza riciclare risposte precedenti.
Dopo aggiornamento o rimozione del JSON lo storico è in sola lettura e segue
le modifiche valide del prodotto senza reinterpretazione. Un cambio categoria
prima della prima registrazione conserva gli altri input localmente, escludendoli
dal payload valido. `duplicateProduct` copia le sole risposte valide con i relativi
snapshot, senza input invalidi e senza legami con l’originale. Delete e protezioni
tombstone includono le risposte insieme agli altri dati prodotto. I controlli UI
rating/scelte e il dettaglio 05a sono operativi dallo step 16; il validatore
riconosce i sei tipi canonici per interpretare tutti gli snapshot.

## Profili personali e budget — step 16

`profile-settings.ts` conserva profili e override nel record `profile-settings`
di `app_meta`, senza modificare lo schema IndexedDB v3 o i file JSON. Il catalogo
editoriale rimane separato; le letture aggiungono i profili personali e rifiutano
collisioni di ID. `savePersonalProfile` accetta nome/colore validi e icona utente
fissa; `deletePersonalProfile` scrive un tombstone e disabilita la selezione.
I dati collegati e le operazioni pendenti restano intatti fino alla risoluzione
server delle dipendenze. L’operazione di eliminazione dipende dalla coda del profilo
in tutti gli eventi; nuove scritture prodotto/budget sul profilo eliminato falliscono.

`setBudget(profileId, categoryId, amount)` accetta testo EUR non negativo (massimo
due decimali), `null` per esclusione esplicita o `undefined` per rimuovere l’override.
La rimozione rimane come tombstone sincronizzabile e ripristina il seed JSON.
Budget zero valido, nessuna ereditarietà e nessun evento nel contratto budget.
`effectiveBudget` è condiviso da elenco e prodotto.

Profili/budget e relativa outbox sono atomici; le operazioni globali non contengono
`eventId`. `listPendingOperations()` legge anche queste operazioni; `listOutbox(context)`
conserva il contratto di sola visita. Le creazioni di prodotti/stand/preferenze e budget
personali dipendono dall’operazione del profilo. `selectEvent` valida e ricorda l’evento
senza alterare raccolte, input o code; il provider attende tutte le guardie di autosalvataggio.

## Fotografie prodotto — step 17

La migrazione v4 aggiunge soltanto `photos` e `photo_assets`, mantenendo record e
code preesistenti. `addProductPhoto(context, productId, photoId, prepared, input)`
salva originale, derivate, metadati e outbox in un’unica transazione. Se il prodotto
non esiste, il suo input viene creato nella stessa transazione, soltanto dopo una
selezione file valida; aprire la galleria non scrive nulla. Un errore annulla anche
la creazione del padre. Le foto di prodotti incompleti restano locali e diventano
operazioni `photo` quando il padre raggiunge la prima versione valida, con
`dependsOn` verso la relativa operazione prodotto. Retry con stesso ID/hash non
duplica la foto; riuso con hash/proprietario diverso o dopo delete viene respinto.

`listProductPhotos` restituisce foto attive ordinate per aggiunta e miniature;
`listPhotos(context)` espone i metadati del solo contesto, anche tombstone;
`getPhotoAsset(context, id)` legge originale e derivate senza rete.
`changeProductPhoto(..., "primary" | "delete")` mantiene una sola selezione esplicita.
Prima di selezionarla si usa la prima foto; eliminando la principale si sceglie
la prima residua, o nessuna quando la griglia è vuota. La cancellazione prodotto
include le foto e le dipendenze dei loro tombstone nella stessa transazione.
La duplicazione conserva il comportamento senza allegati.

`collectPhotoOrphans()` considera riferimenti sia nei metadati sia nell’outbox,
compresi payload eliminati recuperabili. Elimina soltanto asset privi di entrambi.
La rimozione di una foto mai accodata e mai confermata può liberare subito i suoi
blob; gli originali accodati rimangono disponibili dopo delete, fino alla futura
conferma/retention server. Nessun invio o conferma viene simulato nello step 17.

La preparazione verifica firma, byte, dimensioni prima della decodifica e decoder
browser; JPEG, PNG e WebP statico. Limiti tecnici: 64 MiB per file, 100 megapixel e
20.000 pixel per lato; nessun limite al numero di foto. Miniatura JPEG fino a 480 px,
anteprima JPEG fino a 2048 px, orientamento del decoder e nessun EXIF nelle derivate.
L’originale conserva tutti i byte, inclusi eventuali EXIF/GPS. SHA-256 usa Web Crypto
quando disponibile e un fallback verificato sulle origini HTTP locali.

## Bootstrap server (step 18)

`initializeServerCatalog` legge `/api/v1/bootstrap` con ETag e timeout. Il provider
riusa il catalogo locale su rete/server/risposta invalidi; senza una copia valida
il primo avvio resta in errore con retry. `initializeProfileSession(catalog, hash)`
attiva snapshot e hash nello stesso commit senza modificare raccolte, asset,
preferenze, profili personali, budget o outbox. Collisioni annullano il commit.
`saveCatalog` e l’inizializzazione senza hash invalidano l’ETag precedente.
Dallo step 19 la rilettura dei dati personali e la sincronizzazione sono gestite
da `LocalSyncStore` e dal [motore sync](../sync/README.md).

## Sincronizzazione (step 19)

IndexedDB v5 aggiunge `sync_receipts` e `sync_recovery` senza cancellare store
precedenti. Ack, revisione e rimozione dalla coda condividono il commit. Ogni
pagina di pull aggiorna record e cursore nella stessa transazione. Modifiche
locali pendenti, input invalidi e versioni questionario restano recuperabili;
una conferma vecchia non sostituisce input o mutazioni locali successive.
Il recupero conserva payload, input e riferimenti agli originali, creando ID nuovi.
Le notifiche delle viste arrivano dopo il commit e non possono farlo risultare
fallito. Notifiche tra schede opzionali; coordinamento e idempotenza non dipendono
dalla sola memoria di un componente React.


## Shell PWA (step 20)

La cache della shell è separata da IndexedDB. Il worker non intercetta le API e
non cancella store, originali o outbox quando cambia versione. Il catalogo locale
valido continua a provenire dal bootstrap esistente. I dettagli operativi sono
in [sviluppo](../../../docs/development.md#shell-offline-step-20).
