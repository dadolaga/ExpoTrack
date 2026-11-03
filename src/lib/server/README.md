# Archivio server — step 18–19

`pg` è il solo driver aggiunto, senza ORM. `runtime.ts` è marcato `server-only`:
crea il pool da `DATABASE_URL` e lo riusa anche durante il reload di sviluppo.
Nessuna variabile di connessione viene passata ai componenti client.

```bash
npm run db:migrate
npm run db:import
# Directory JSON alternativa, per importare una copia validata:
npm run db:import -- /percorso/config
```

I due comandi caricano `.env.local` se presente, dando precedenza alle variabili
dell’ambiente. Gli strumenti compilano in `/tmp` e rimuovono l’output.
`db:migrate` verifica checksum e ordine di `migrations/NNN_nome.sql`, con lock e
transazione: una migrazione applicata non si modifica, se ne aggiunge un’altra.
`db:import` richiede lo schema già migrato; valida tutti i file prima di scrivere,
serializza gli import e pubblica lo snapshot solo al commit. Stesso hash = nessuna
riscrittura. Cambiare un questionario richiede una versione nuova. Collisioni di
ID con profili personali annullano l’importazione; niente fusioni automatiche.

Il catalogo attivo è un JSON completo, con hash SHA-256 canonico. Le tabelle
editoriali conservano gli elementi rimossi come inattivi, mantenendo chiavi e
riferimenti storici. Le definizioni questionario conservano tutte le versioni.
Interessi, pianificati e budget editoriali restano seed nello snapshot, separati
dalle personalizzazioni: importarli non crea né cancella record personali.

Le raccolte usano JSONB per i payload condivisi e colonne/chiavi/vincoli per
proprietà, evento e riferimenti. Budget globali per profilo/categoria; checklist
con ID/testo e booleani per le spunte; prodotti con categoria/stand immutabili e
risposte con definizioni storiche; foto con FK al prodotto del medesimo contesto,
una principale, checksum, metadati e riferimento media. Nessun blob nel database.
Le cancellazioni personali sono tombstone, senza delete fisici o riattivazione.

`server_state.revision` è un contatore transazionale: serializza l’accettazione,
non avanza dopo rollback e alimenta `server_changes`. `server_operations` conserva
ID univoco, proprietario/evento, hash payload e risposta, predisponendo il replay
idempotente. Dallo step 19 le mutazioni sono applicate da `ServerSync` con LWW
per record vivo, verifiche dei vincoli e protezione delle tombstone. Un ID
operazione ripetuto con hash diverso è rifiutato; gli esiti sono persistenti.
I metadati media distinguono `pending` e `ready`; una foto pronta richiede una
chiave storage e la verifica dell’originale.

## API disponibili

| Metodo e percorso | Risposta |
|---|---|
| `GET /api/v1/bootstrap` | `{schemaVersion:1, configHash, catalog}`; snapshot editoriale completo, ETag e `If-None-Match`/304 |
| `GET /api/v1/profiles` | `{profiles:[{data, revision, deletedAt, available}]}`; configurati e personali, inclusi quelli non più disponibili |
| `GET /api/v1/events/:eventId/catalog` | Hash, evento, categorie, padiglioni e stand del solo evento |
| `GET /api/v1/profiles/:profileId/events/:eventId/collection` | Raccolta completa del contesto, revisioni/tombstone, budget del profilo e stato media |

Le collezioni contengono record `{data, revision}`; le foto aggiungono `mediaStatus`.
La lettura della raccolta usa una transazione `REPEATABLE READ READ ONLY`, senza
mescolare versioni di record letti durante scritture concorrenti. Non applica
questi dati a IndexedDB direttamente: dallo step 19 il motore usa il feed
incrementale `/sync/pull`, con applicazione locale atomica e cursore persistente.

Tutte le risposte usano `Cache-Control: private, no-store`; nessun percorso media,
credenziale o errore interno nelle risposte. Scope malformato: 400; profilo/evento
inesistente: 404; database/schema/catalogo indisponibile: 503. Come previsto dal
progetto, scegliere un profilo separa
logicamente i dati e non autentica: l’app privata dipende dal perimetro di accesso.

## Test

```bash
npm run test:local
TEST_DATABASE_URL=postgresql://expotrack:expotrack_dev@postgres:5432/expotrack_test npm run test:integration
# Solo PostgreSQL/API:
TEST_DATABASE_URL=postgresql://expotrack:expotrack_dev@postgres:5432/expotrack_test npm run test:server
```

Sull’host usare `localhost`. La suite richiede segmento `test` nel nome e un URL
diverso da quello di sviluppo. Si collega a `postgres` soltanto per creare e
rimuovere database unici `expotrack_test_<UUID>`; servono i relativi permessi.
Non modifica il database indicato dall’URL di test o quello di sviluppo. Le fixture
JSON e le migrazioni di prova sono copie temporanee. Variabile mancante o test
fallito interrompono la suite, senza skip. Il runner finale controlla l’URL prima
di sostituire `DATABASE_URL` con quello di test.

## Scritture e media dello step 19

- `POST /api/v1/sync/push`: una operazione outbox completa per richiesta; risposta
  `{operationId,status,code?,current?}`. Le dipendenze devono essere già accettate.
  `status=retry` non rimuove la coda; `rejected` conserva il payload per il recupero.
  Le ricevute conservano anche i tentativi riferiti a proprietari/eventi mancanti.
  I record di dominio mantengono le chiavi esterne di proprietà.
- `GET /api/v1/sync/pull?cursor=...`: `{changes,cursor,hasMore}` in ordine di
  revisione. Il cursore include l’epoca dell’archivio; cursore invalido/scaduto: 410
  e rilettura completa senza cancellare dati locali. Log, ricevute e tombstone
  sono conservati senza scadenza automatica in questa versione.
- `PUT /api/v1/profiles/:profileId/events/:eventId/photos/:photoId/original`:
  originale binario dopo accettazione dei metadati; risposta con record `ready`
  solo dopo file completo e verifica. Retry completo del file, senza promessa
  di ripresa dal singolo byte. Nessuna cancellazione automatica dei byte locali.
- `GET` sullo stesso percorso: originale; `?variant=thumbnail` o `preview` per
  derivate JPEG. Verifica proprietario/evento/prodotto vivo; media pendente non
  scaricabile, media cancellato non pubblicato. Niente percorsi storage in risposta.

`MEDIA_ROOT` sceglie la directory persistente (default `.media` nella root app,
ignorata da Git e fuori da `public`). In devcontainer è sul volume dei sorgenti;
su un server deve puntare a un volume persistente e rientrare nel backup insieme
al database. Migrare con `npm run db:migrate` dopo l’aggiornamento allo step 19.
Non serve reimportare un catalogo già presente e invariato.

I file arrivano in una directory temporanea, con limite di 64 MiB, hash SHA-256,
firma/dimensioni e decodifica Sharp (già dipendenza Next.js, ora dichiarata
esplicitamente). Originali invariati; anteprime orientate separate. File e
cartelle sono sincronizzati su disco prima della conferma DB. Un errore o upload
interrotto non pubblica un file incompleto. La visibilità richiede metadati `ready`
e proprietari ancora vivi anche se il file è già stato scritto. Gli orfani non
vengono rimossi automaticamente: si preservano originali e possibilità di recupero.
Spazio esaurito durante scrittura: 507; errori di integrità: 422; nessun falso ack.
