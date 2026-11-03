# Archivio server — step 18

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
idempotente dello step 19. I metadati media distinguono `pending` e `ready`; una
foto pronta richiede una chiave storage. Upload, verifica dei byte e pubblicazione
atomica degli originali saranno introdotti nello step 19.

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
questi dati a IndexedDB: download e riconciliazione sono dello step 19.
Le raccolte sono vuote finché non saranno inviate tramite il futuro push.

Tutte le risposte usano `Cache-Control: private, no-store`; nessun percorso media,
credenziale o errore interno nelle risposte. Scope malformato: 400; profilo/evento
inesistente: 404; database/schema/catalogo indisponibile: 503. Nessun endpoint di
scrittura introdotto. Come previsto dal progetto, scegliere un profilo separa
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
