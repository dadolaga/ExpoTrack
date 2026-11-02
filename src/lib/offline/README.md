# Persistenza locale — step 05

`openLocalRepository()` apre IndexedDB `expotrack-local`, versione **2**. Non apre
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
| `setStandInterest(context, standId, interested)` | Salva l’override booleano di uno stand del catalogo e accoda una mutazione `stand-preferences` nella stessa transazione. La Promise termina dopo il commit. |
| `saveStandPreferences(context, standId, changes)` | Patch di interesse, priorità intera 1–10/null, visita manuale, spunta per ID o aggiunta di una voce checklist. Validazione e record/outbox atomici; conserva i campi non modificati. |
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
L’outbox è ora una union discriminata fra `product` e `stand-preferences`.

In questo step il prodotto copre il minimo necessario alla persistenza: nome,
categoria, riferimento stand e descrizione libera. Prezzo, valutazione, risposte,
foto, eliminazione e stand personali avranno contratti e repository estesi nei
loro step. I riferimenti a stand personali non ancora disponibili vengono
conservati come input da correggere, senza generare mutazioni.

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
