# Sincronizzazione dati e originali

Il server conserva dati strutturati in PostgreSQL e originali/derivate nello
storage `MEDIA_ROOT`. Il browser salva prima su IndexedDB e accoda soltanto
payload validi. Input ancora incompleti e foto dei loro prodotti rimangono locali;
la pagina `/sync` invita a completarli, senza dichiararli inviati.

`SyncEngine` processa tutte le code del dispositivo rispettando le dipendenze.
I metadati hanno precedenza sugli upload; una foto viene confermata solo dopo
ricevuta dell’originale `ready` e hash corretto. Un file interrotto viene ritentato
interamente con lo stesso ID. La stessa operazione non viene applicata due volte.
Una cancellazione locale già accodata può rendere inutile l’invio dei byte prima
della tombstone; l’originale rimane comunque conservato sul dispositivo.

Il pull usa revisioni monotone e pagine; record e cursore condividono il commit
locale. Un crash prima del commit ripete la pagina. Un cursore non più valido
avvia la rilettura completa conservando raccolte e coda. Le nuove modifiche locali
hanno precedenza nell’applicazione di ack e pull; il server usa LWW per record
nell’ordine di accettazione, mantenendo i vincoli di dominio. Nessuna scelta
manuale della versione per normali aggiornamenti concorrenti.

Gli update respinti contro tombstone non riattivano il record. `sync_recovery`
conserva operazione, input e riferimenti foto. «Recupera come nuovo elemento»
riusa ID di recupero persistenti per evitare copie doppie dopo interruzioni e
mantiene gli originali. Un profilo rimosso si recupera in un nuovo personale;
le sue risposte vengono conservate come testo descrittivo quando non è possibile
assegnare il questionario del vecchio proprietario al nuovo profilo. Le definizioni
non vengono inventate o assegnate ad altri profili. Le copie originali restano
anche nella registrazione di recupero. Nessuna garbage collection distruttiva.

Il motore parte all’avvio, riprende a ritorno online/primo piano e dopo scritture;
ritenta con backoff e jitter. Web Locks coordina le schede dove disponibile,
altrimenti una lease IndexedDB rinnovata limita le esecuzioni sovrapposte.
L’idempotenza server è obbligatoria anche con più schede. Alla chiusura non si
promettono trasferimenti in background: la coda durevole riparte all’apertura.

Le foto remote sono scaricate e verificate prima del commit locale dei blob.
Finché non sono effettivamente presenti, la UI mostra indisponibilità locale.
Prezzi zero, No, budget assente/escluso e storico questionari mantengono i loro
significati. I conteggi globali includono ogni operazione pendente/respinta una
sola volta; le foto sono un sottoinsieme. I dettagli UI rispettano profilo/evento.

`test:integration` include sei scenari completi su database/media isolati.
Dallo step 20 la cache della shell PWA permette la riapertura completa senza rete
dopo preparazione online in produzione. Il test Chromium integra anche la ripresa
della sync; la prova sul telefono fisico resta pendente.
