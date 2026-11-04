# Docker in produzione

Artefatti operativi: [Dockerfile](../Dockerfile), [compose.yaml](../compose.yaml),
[env di esempio](../.env.production.example) e
[tunnel opzionale](../compose.tunnel.yaml). Questi file sono distinti dal
Compose del devcontainer. Servono Docker Engine con Compose v2 su Linux e spazio
per PostgreSQL, originali fotografici e backup.

L'immagine usa Node 22 Debian slim, dipendenze bloccate dal lockfile, output
Next.js standalone e strumenti database già compilati. Il worker PWA viene
generato insieme alla build e copiato con gli asset corrispondenti. Nessun JSON
demo, env, media o file privato del checkout entra nel contesto Docker: la
`.dockerignore` ammette soltanto gli input necessari alla compilazione.

## Percorsi reali e variabili

```bash
cp .env.production.example .env.production
chmod 600 .env.production
openssl rand -hex 32
openssl rand -hex 32
```

Inserire le due password generate, diverse, in `POSTGRES_PASSWORD`
(amministrazione PostgreSQL) e `APP_DB_PASSWORD` (applicazione). I valori vuoti
bloccano Compose. Il file `.env.production` è ignorato da Git e va passato
esplicitamente con `--env-file`: non viene letto automaticamente come `.env`.
Usare apici singoli per valori contenenti `$`, `#` o spazi. L'entrypoint costruisce
l'URL PostgreSQL codificando i caratteri speciali, senza chiedere una seconda
copia della password dentro `DATABASE_URL`. Le credenziali restano lato server;
non aggiungere prefissi `NEXT_PUBLIC_`.

Impostare `CONFIG_DIR` al **percorso assoluto della cartella reale non versionata**
e `DATA_DIR` alla cartella persistente. I nomi `/srv/expotrack/...` sono esempi:
si possono scegliere altri nomi, dischi e directory esterne al repository.
Se si preferisce una cartella privata nel checkout, `config.local/` e
`production/` sono già ignorate da Git e dal contesto Docker; indicarne comunque
il percorso assoluto nell'env. L'app non ripiega mai su `config/` dimostrativa.

`CONFIG_DIR` contiene `app.json`, i file indicati da `configFiles` e dagli eventi,
e gli eventuali `interests/` e `questionnaires/`: vale il contratto di
[config/README.md](../config/README.md). Un nome evento/file diverso da quello
demo funziona tramite i riferimenti in `app.json`. Conservare gli ID stabili e
incrementare la versione dei questionari quando richiesto. Il montaggio è in
sola lettura; il catalogo pubblicato viene letto dall'app in PostgreSQL.

Creare le directory prima di avviare Compose, adattando i percorsi all'env:

```bash
sudo install -d -m 750 /srv/expotrack/data/postgres
sudo install -d -m 750 -o 1000 -g 1000 /srv/expotrack/data/media
sudo install -d -m 750 -g 1000 /srv/expotrack/config
```

Popolare `config` con i JSON reali. Directory e file devono essere rispettivamente
attraversabili e leggibili da UID/GID `1000:1000` (per esempio gruppo `1000`,
directory `750`, file `640`). Il processo app usa questo utente e deve poter
scrivere nei media. PostgreSQL prepara autonomamente proprietà e permessi della
propria directory. Non usare `chmod 777`. I bind mount hanno
`create_host_path: false`: percorsi inesistenti falliscono invece di creare
cartelle vuote in una posizione sbagliata.

## Primo avvio

Dalla cartella contenente `compose.yaml`:

```bash
docker compose --env-file .env.production config --quiet
docker compose --env-file .env.production up -d --build --wait --wait-timeout 180
docker compose --env-file .env.production ps -a
docker compose --env-file .env.production logs --tail=100 bootstrap app
curl --fail http://127.0.0.1:3000/api/v1/bootstrap > /dev/null
```

La sequenza è PostgreSQL sano → validazione completa JSON → migrazioni con
checksum/lock → importazione transazionale → app. `bootstrap` deve terminare
con codice `0`; un fallimento blocca l'avvio dell'app. L'healthcheck verifica
il bootstrap HTTP reale, quindi anche disponibilità di schema, database e catalogo.
`APP_PORT` cambia soltanto la porta localhost dell'host (adattare anche `curl`).

Il database non pubblica porte sull'host e usa una rete Docker interna. L'app
riceve soltanto le credenziali `expotrack_app`, un ruolo senza privilegi superuser,
creazione database o amministrazione ruoli. Questo ruolo possiede gli oggetti
applicativi per applicare le migrazioni; l'utente amministrativo resta nel servizio
PostgreSQL. Il processo web ha filesystem in sola lettura, cache temporanee e
volume media scrivibile. I log Docker hanno rotazione.

Le password inizializzano i ruoli **solo al primo avvio con PGDATA vuota**.
Cambiare l'env su un database esistente non cambia le password dei ruoli:
ruotarle con `psql` e `\password`, aggiornare l'env e ricreare i servizi.
Non puntare questa configurazione al database del devcontainer: per trasferire
dati esistenti usare dump/restore, proprietari coerenti e una prova isolata.

## Cartella operativa separata dal repository

Si può tenere il checkout, per esempio, in `/srv/src/expotrack` e la cartella
operativa non versionata in `/opt/expotrack`. Copiare dal checkout questi file
preservando la sottocartella `deploy`:

```text
/opt/expotrack/
├── compose.yaml
├── compose.tunnel.yaml             # facoltativo
├── .env.production                # compilato e privato
└── deploy/
    └── postgres-init.sh
```

Impostare `SOURCE_DIR=/srv/src/expotrack` nell'env operativo: il contesto di build
punta al checkout, mentre configurazione e dati restano dove indicato da
`CONFIG_DIR` e `DATA_DIR`. I comandi si eseguono da `/opt/expotrack`. Non serve
versionare la cartella operativa. Lo script PostgreSQL viene montato dal percorso
`./deploy/postgres-init.sh` accanto a Compose, anche quando il sorgente è altrove.

Con un'immagine già costruita e trasferita a un registry/server, impostare
`APP_IMAGE` al suo tag o digest e usare `up -d --no-build --wait` invece di
`up -d --build --wait`. Per un registry eseguire prima `docker compose --env-file
.env.production pull app bootstrap postgres`. In questa modalità il checkout
non serve al runtime; conservare comunque lo script di inizializzazione accanto
a Compose. Congelare i digest delle immagini per riprodurre esattamente una
release; i tag Node/PostgreSQL del Dockerfile/Compose seguono gli aggiornamenti
della rispettiva versione principale.

## HTTPS e Cloudflare Tunnel

La porta web è pubblicata solo su `127.0.0.1`: un reverse proxy HTTPS o un
`cloudflared` già sullo stesso host può usare `http://127.0.0.1:3000`.
Per un tunnel in questo stesso progetto Compose, impostare `TUNNEL_TOKEN` e
usare entrambi i file:

```bash
docker compose --env-file .env.production -f compose.yaml -f compose.tunnel.yaml up -d --build --wait
```

Nel dashboard Cloudflare configurare il servizio origin `http://app:3000` per
il proprio hostname HTTPS. `localhost` dentro il container tunnel identifica il
tunnel stesso. Per fermarlo o aggiornarlo usare gli stessi due `-f`.
Il tag cloudflared è configurabile con `CLOUDFLARED_IMAGE`: fissare una release
o un digest verificato quando si congela l'ambiente. Il token resta fuori
dall'immagine; chi amministra Docker può leggere le variabili dei container.
Il tunnel collega il server; per l'app privata configurare anche la policy
Cloudflare Access con gli utenti ammessi. L'app non offre un login interno.
HTTPS è necessario per PWA e fotocamera da telefono; localhost è adatto ai
controlli sul server.

Riferimenti: [montaggi e dipendenze Compose](https://docs.docker.com/reference/compose-file/services/),
[parametri tunnel e token](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/run-parameters/).

## Modifica catalogo e aggiornamenti

Per controllare una cartella modificata senza scrivere nel database:

```bash
docker compose --env-file .env.production run --rm --no-deps bootstrap validate
```

Per pubblicarla, dopo backup e controllo dei JSON:

```bash
docker compose --env-file .env.production run --rm bootstrap import
```

Non serve ricompilare l'immagine per cambiare i JSON. L'importazione è esplicita
e atomica; non c'è un watcher. Un riavvio del solo container app non importa
file. Un normale `up` che avvia nuovamente `bootstrap` può rieseguire validazione,
migrazioni e import: l'importazione invariata è idempotente. Pubblicare quindi
nella cartella reale soltanto configurazioni pronte.

Per aggiornare il codice, dopo un backup coerente e con il nuovo checkout pronto:

```bash
docker compose --env-file .env.production build
docker compose --env-file .env.production stop app
docker compose --env-file .env.production run --rm bootstrap
docker compose --env-file .env.production up -d --no-deps --wait app
```

Se `bootstrap` fallisce, correggere il problema prima dell'ultimo comando.
Quando si usa il tunnel containerizzato, aggiungere entrambi i `-f` ai comandi;
il tunnel può restare in esecuzione durante la breve indisponibilità dell'app.
Conservare l'immagine precedente: rollback dell'app e rollback del database sono
operazioni diverse. `down` conserva i bind mount persistenti; non cancellare le
cartelle dati durante un aggiornamento.

## Backup e ripristino

Salvare insieme database, l'intera directory media, JSON pubblicati e tag/digest
dell'immagine. Conservare l'env separatamente con accesso ristretto. Per una copia
coerente semplice, fermare l'app durante dump e copia dei media:

```bash
umask 077
mkdir -p /percorso/backup/expotrack
docker compose --env-file .env.production stop app
docker compose --env-file .env.production exec -T postgres pg_dump -U expotrack_admin -d expotrack -Fc > /percorso/backup/expotrack/database.dump
sudo tar -C /srv/expotrack/data -cpf /percorso/backup/expotrack/media.tar media
sudo tar -C /srv/expotrack -cpf /percorso/backup/expotrack/config.tar config
docker compose --env-file .env.production start app
```

Adattare i percorsi e verificare l'esito di ogni comando; conservare copie datate
anche fuori dal server. Evitare di copiare a caldo i file di `data/postgres` al
posto del dump. Provare il restore su directory, porte e progetto Compose
isolati: inizializzare i ruoli su DB vuoto, ripristinare il dump con
`pg_restore -U expotrack_admin -d expotrack --exit-on-error`, ripristinare media
con UID/GID corretti e lo stesso catalogo, poi migrare e controllare bootstrap,
raccolte e originali. Conservare il proprietario `expotrack_app` degli oggetti
nel dump; non ripristinare come proprietario amministrativo tramite `--no-owner`.
Un restore di uno snapshot precedente richiede anche la gestione dell'epoca sync
e dei client ancora offline prevista dalle specifiche: non è un rollback da
eseguire alla cieca su un'istanza in uso.

## Verifiche sul server

Prima dell'uso effettivo controllare app `healthy`, bootstrap concluso con `0`,
accesso HTTPS da telefono e PC, caricamento di una foto e persistenza dopo una
ricreazione dei container. Il ripristino va provato su una copia isolata.
Lint e typecheck verificano il codice; non certificano l'esecuzione Docker,
Cloudflare o l'hardware di produzione.
