# Sviluppo locale

La base implementata comprende Next.js con App Router in `src/app`, React,
TypeScript in modalità strict, Tailwind CSS, ESLint e PostgreSQL 17 in Docker.
L'alias `@/*` punta a `src/*`. La pagina iniziale è un segnaposto; le funzionalità descritte nelle
specifiche verranno implementate nelle fasi successive.

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

Il container applicativo riceve la connessione, ma la base Next.js non esegue
ancora query: driver/ORM, schema e migrazioni verranno aggiunti con la persistenza
applicativa. Non è necessario avviare Docker dall'interno del devcontainer:
Compose gestisce entrambi i servizi dall'host.

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
il devcontainer usa `postgres`. Il file `.env.local` è ignorato da Git. La pagina
iniziale attuale funziona anche senza database.

## Verifiche

```bash
npm run lint
npm run typecheck
npm run build
```

`typecheck` genera prima i tipi delle route Next.js. Per provare la build di
produzione in locale, eseguire `npm run start` dopo `npm run build`, arrestando
prima l'eventuale server di sviluppo sulla stessa porta.

La [validazione finale](final-validation.md) si esegue con `npm run validate:final`:
l’assistente la eseguirà al termine dello step 28. Raccoglie i controlli statici,
la build e le future suite di test dell’app, con report in `validation-results/`.
Finché suite e copertura non sono collegate, il comando segnala `not-ready`. La modalità
`npm run validate:final -- --preflight` controlla i prerequisiti senza avviare test o build.

Riferimenti: [installazione Next.js](https://nextjs.org/docs/app/getting-started/installation)
e [Dev Containers in VS Code](https://code.visualstudio.com/docs/devcontainers/create-dev-container).
Il nome condiviso segue la [configurazione del progetto Compose in VS Code](https://code.visualstudio.com/remote/advancedcontainers/set-docker-compose-project-name).
Per la persistenza del database, vedere anche la
[documentazione dell'immagine ufficiale PostgreSQL](https://github.com/docker-library/docs/blob/master/postgres/README.md).
