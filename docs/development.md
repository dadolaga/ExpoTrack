# Sviluppo locale

La base implementata comprende Next.js con App Router in `src/app`, React,
TypeScript in modalità strict, Tailwind CSS, ESLint e PostgreSQL 17 in Docker.
L'alias `@/*` punta a `src/*`. La shell mobile offre Home (`/`), Stand (`/stands`),
Prodotti (`/products`) e Profilo (`/profile`). Al primo avvio la scelta del profilo
avviene in `/profiles`; un profilo ricordato e valido apre Home agli avvii successivi.
Si cambia da **Profilo → Cambia profilo**, senza conferma intermedia.
In Profilo si sceglie il tema Automatico/Chiaro/Scuro, ricordato nel browser.
La dimostrazione dei componenti di base è in `/examples/components`.
La lista Stand (`/stands`) offre interessi personali, catalogo completo, ricerca e
filtri dallo step 07. Home mostra dallo step 11 quattro contatori reali e fino a
cinque stand prioritari del profilo/evento; le card stand aprono liste filtrate.
Elenco prodotti disponibile dallo step 14; sincronizzazione automatica e pagina
`/sync` con contatori reali dallo step 19.

Dallo step 08 il tap sulla riga apre `/stands/[standId]`: priorità e stato visita
manuali, checklist persistente e sezioni per prodotti pianificati/registrati.
La stella rimane un controllo indipendente. Le azioni prodotto arriveranno allo
step 12. Dallo step 09 «Apri note stand» apre `/stands/[standId]/notes`: testo
facoltativo senza limite UI, autosalvataggio locale e ritorno dopo commit.
Le note sono personali per profilo/evento/stand; un errore di storage mantiene il
testo aperto con retry. La sincronizzazione server arriverà negli step successivi.

Dallo step 10 «Nuovo stand» apre `/stands/new`: nome obbligatorio, descrizione,
categorie e posizione facoltative, autosalvataggio locale. L’URL conserva l’ID
durante la compilazione per recuperare l’input al refresh. Gli stand personali
aprono `/stands/personal/[standId]`; «Modifica stand» consente modifica ed
eliminazione confermata, bloccata con prodotti collegati. Il catalogo resta
in sola lettura. La creazione inizializza interesse e visita «Da visitare»;
assegnando una priorità lo stand entra fra i candidati della dashboard.

Il dataset dimostrativo e il loader di configurazione sono disponibili dallo step 04,
separati dal markup. Tutti i dati sono fittizi: i profili mostrati sono marcati come demo.
Contratti effettivi e struttura dei file: [config/README.md](../config/README.md).

Dallo step 05 è disponibile il [repository IndexedDB](../src/lib/offline/README.md),
con input recuperabili, ultima versione valida e outbox atomica. È verificabile
tramite test; dallo step 06 ricorda anche profilo/evento selezionati. Dallo step 18
il provider client legge il bootstrap PostgreSQL e prepara l’archivio locale,
conservando l’ultima copia valida quando il server non risponde. Nome e colore
del profilo attivo compaiono nell’header.

Per provare il primo avvio, usare un contesto browser nuovo o una finestra privata,
senza cancellare archivi già usati. Se il browser impedisce IndexedDB, viene mostrato
un errore con **Riprova**. Se un profilo ricordato non è più disponibile, la pagina
richiede una nuova scelta senza eliminare i dati personali. Dallo step 16, «Aggiungi profilo» crea un profilo personale con nome e colore;
«Tutti i profili» apre la gestione dedicata. Da Profilo sono disponibili budget
per categoria, selezione evento, tema e informazioni app. Le modifiche valide
salvano localmente e accodano le operazioni server previste dallo step 19.

## Avvio con devcontainer

Prerequisiti: Docker Desktop avviato (container Linux, Docker Compose v2), Visual Studio Code e
l'estensione **Dev Containers** (`ms-vscode-remote.remote-containers`). Non serve
installare Node.js sull'host.

1. Aprire la cartella del repository in VS Code.
2. Eseguire **Dev Containers: Reopen in Container** dalla palette dei comandi.
3. Attendere la creazione del container e il completamento di `npm ci`.
4. Nel terminale del container eseguire:

   ```bash
   npm run dev
   ```

5. Aprire [http://localhost:3000](http://localhost:3000).

Il file [`.devcontainer/compose.yaml`](../.devcontainer/compose.yaml) avvia due
servizi: `app` (ambiente Node.js 22 su Debian Bookworm) e `postgres` (PostgreSQL
17). VS Code si collega al servizio `app` con l'utente non privilegiato `node`.
Il servizio `app` attende che l'healthcheck di PostgreSQL sia positivo prima di
avviarsi. Next.js si avvia poi manualmente con `npm run dev`.

Il nome del progetto Compose è `expotrack-dev`, comune a VS Code e ai comandi
da terminale: entrambi gestiscono gli stessi container e volumi.

La porta 3000 viene inoltrata da VS Code; Next.js ascolta su `0.0.0.0` per essere
raggiungibile dall'host. Le modifiche ai sorgenti attivano il ricaricamento in
sviluppo. Il server si arresta con `Ctrl+C`.

`node_modules` e `.next` risiedono in volumi Docker separati dalle corrispondenti
cartelle dell'host: dipendenze native e cache Linux non vengono condivise con
Windows. I sorgenti restano nella cartella locale del repository.

Dopo una modifica a `package-lock.json`, eseguire `npm ci` nel container. Dopo una
modifica ai file del devcontainer, eseguire **Dev Containers: Rebuild
Container**. Alla chiusura della sessione VS Code arresta i servizi Compose;
i volumi e i dati del database vengono conservati.

## PostgreSQL nello sviluppo

Il database viene creato automaticamente al primo avvio. I parametri locali sono:

| Parametro | Valore |
|---|---|
| Database | `expotrack` |
| Utente | `expotrack` |
| Password | `expotrack_dev` |
| Host dal devcontainer | `postgres` |
| Host dalla macchina locale | `localhost` |
| Porta | `5432` |

Compose imposta nel servizio `app`:

```text
DATABASE_URL=postgresql://expotrack:expotrack_dev@postgres:5432/expotrack
```

La porta del database è pubblicata solo su `127.0.0.1` dell'host, così un client
locale come DBeaver può collegarsi. La porta 5432 deve essere libera prima
dell'avvio. Queste credenziali sono esclusivamente di sviluppo.

Il volume `postgres_data` conserva i dati attraverso riavvii e ricreazioni dei
container. `docker compose down` non rimuove i volumi; evitare l'opzione `-v` per
conservarli. Le variabili `POSTGRES_*` inizializzano il database solo quando il
volume è vuoto: cambiarle nel Compose non aggiorna utenti o password già creati.

I comandi seguenti si eseguono dal terminale **dell'host**, nella root del progetto:

```bash
# Controllare i servizi e i log del database
docker compose -f .devcontainer/compose.yaml ps
docker compose -f .devcontainer/compose.yaml logs postgres

# Verificare una connessione TCP autenticata con una query
docker compose -f .devcontainer/compose.yaml exec -e PGPASSWORD=expotrack_dev postgres psql -h postgres -U expotrack -d expotrack -c "SELECT current_database(), version();"

# Aprire la console SQL
docker compose -f .devcontainer/compose.yaml exec postgres psql -U expotrack -d expotrack
```

Dallo step 18 il server usa `pg` con query parametrizzate e migrazioni SQL.
Prima del primo avvio, con PostgreSQL acceso:

```bash
npm run db:migrate
npm run db:import
```

I comandi usano `DATABASE_URL` dell’ambiente; sull’host caricano anche `.env.local`
con il supporto nativo di Node.js. Non serve avviare Docker dall’interno del
devcontainer: Compose gestisce entrambi i servizi dall’host. Importare di nuovo
dopo modifiche ai JSON; nessun import o migrazione automatica a ogni richiesta.
La procedura e le API effettive sono in [server/README.md](../src/lib/server/README.md).

## Avvio senza container

Usare Node.js 22.14 o successivo (Node.js 22 è la versione di riferimento in
`.nvmrc`), quindi:

```bash
npm ci
npm run dev
```

Su PowerShell, se l'esecuzione di `npm.ps1` è bloccata, usare `npm.cmd` al posto di
`npm`, senza cambiare la policy di esecuzione del sistema.

Per usare PostgreSQL anche con Next.js sull'host, avviare solo il database dal
terminale dell'host:

```bash
docker compose -f .devcontainer/compose.yaml up -d --wait postgres
```

Copiare `.env.example` in `.env.local`: l'URL di esempio usa `localhost`, mentre
il devcontainer usa `postgres`. Il file `.env.local` è ignorato da Git. Eseguire
poi `npm run db:migrate` e `npm run db:import` prima di avviare Next.js. Il primo
bootstrap richiede il catalogo nel database. Un browser già preparato recupera il
catalogo locale se PostgreSQL non risponde; la shell offline completa arriverà
allo step 20.

## Verifiche

```bash
npm run lint
npm run typecheck
npm run validate:config
npm run test:unit
npm run test:local
TEST_DATABASE_URL=postgresql://expotrack:expotrack_dev@postgres:5432/expotrack_test npm run test:integration
```

`typecheck` genera prima i tipi delle route Next.js. Per provare la build di
produzione in locale, eseguire separatamente `npm run build` e `npm run start`, arrestando
prima l'eventuale server di sviluppo sulla stessa porta.

I controlli obbligatori di fine step sono lint e typecheck; la build non ne fa parte.
`validate:config` legge i JSON da `config/` senza scrivere dati. Un percorso alternativo
si passa con `npm run validate:config -- /percorso/directory-config`.
`test:unit` esegue i test dei contratti e del loader con `node:test`, usando copie
temporanee isolate del dataset. Gli strumenti compilano TypeScript in `/tmp`
(o nella directory temporanea del sistema) e ripuliscono l’output a fine esecuzione.
Non richiedono un database server o un browser. `test:local` usa la dipendenza
di sviluppo `fake-indexeddb` per i test della persistenza locale, con factory e nomi
database isolati; include rollback, riapertura delle connessioni e selezione del
profilo con preferenze valide/non valide. `NODE_PATH` dei
processi di test punta alle dipendenze del progetto per eseguire il codice compilato
nella directory temporanea.

`test:integration` esegue `test:local` e `test:server`: quest’ultimo richiede
`TEST_DATABASE_URL` distinta da `DATABASE_URL`, con segmento `test` nel nome
(sull’host usare `localhost`). La suite si collega al database di manutenzione
`postgres`, crea database unici `expotrack_test_<UUID>`, li migra e li elimina al
termine; l’utente PostgreSQL deve poter creare database. Il database indicato
nell’URL di test non deve essere già creato e non viene modificato. Nessun test
server viene saltato se manca la variabile: il comando fallisce. `test:server`
verifica migrazioni, import/rollback, vincoli, contesti e risposte HTTP con il
repository PostgreSQL reale. Le prove E2E della PWA restano agli step successivi.

La [validazione finale](final-validation.md) si esegue con `npm run validate:final`:
l’assistente la eseguirà al termine dello step 21 (ex step 28). Raccoglie i controlli statici,
la build e le future suite di test dell’app, con report in `validation-results/`.
Finché suite e copertura non sono collegate, il comando segnala `not-ready`. La modalità
`npm run validate:final -- --preflight` controlla i prerequisiti senza avviare test o build.

Riferimenti: [installazione Next.js](https://nextjs.org/docs/app/getting-started/installation)
e [Dev Containers in VS Code](https://code.visualstudio.com/docs/devcontainers/create-dev-container).
Il nome condiviso segue la [configurazione del progetto Compose in VS Code](https://code.visualstudio.com/remote/advancedcontainers/set-docker-compose-project-name).
Per la persistenza del database, vedere anche la
[documentazione dell'immagine ufficiale PostgreSQL](https://github.com/docker-library/docs/blob/master/postgres/README.md).

## Fotografie locali (step 17)

Nell’editor prodotto, aprire **Fotografie**: fotocamera del dispositivo o galleria,
anche prima di compilare nome/categoria. JPEG, PNG e WebP; per HEIC/HEIF esportare
una copia JPEG. Originale conservato con eventuali EXIF, anteprime separate.
Dopo «Salvato sul dispositivo» si possono ricaricare la pagina, aprire l’originale,
scegliere la principale ed eliminare con conferma. La lista prodotti mostra la
principale e supporta il filtro foto. Un prodotto incompleto resta recuperabile
nel suo URL editor; per inserirlo nella raccolta completare i campi obbligatori.

Dallo step 19 originali e derivate vengono trasferiti al server con app aperta.
`MEDIA_ROOT` (default `.media`, ignorata da Git) deve restare persistente insieme
al database. Dopo l’aggiornamento eseguire `npm run db:migrate` e riavviare Next.js.
La raccolta e gli originali vengono riletti anche da un browser con archivio vuoto.
Stato, errori, recuperi e comando manuale sono nella pagina `/sync`; la copia
locale continua a funzionare quando le API non rispondono.
Lo storage locale è distinto dalla shell PWA: riavviare l’intera app senza rete
sarà garantito nello step 20. Prove fotocamera/permessi/quota sul telefono reale
restano da eseguire; i file dei test sono isolati dai dati di sviluppo.
