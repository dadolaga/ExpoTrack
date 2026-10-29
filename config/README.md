# Dataset dimostrativo

Tutti i dati in questa cartella sono **fittizi**: evento, espositori, ubicazione,
prodotti, domande e budget servono esclusivamente allo sviluppo. Non rappresentano
EICMA né preferenze confermate dell’utente. Gli ID dei profili iniziali `me` e
`father` seguono la specifica; i nomi mostrati contengono l’indicazione demo.

Il dataset comprende una fiera, due profili, tre categorie gerarchiche, un padiglione,
due stand, tre interessi personali, un pianificato e due questionari diversi.
`demo-lights` non ha ubicazione: il loader conserva questa assenza senza inventare
un padiglione o una posizione.

```text
config/
├── app.json
├── profiles.json
├── categories.json
├── pavilions.json
├── events/fiera-demo-2026-stands.json
├── interests/me.json
├── interests/father.json
├── questionnaires/me.json
└── questionnaires/father.json
```

`app.json` individua i file condivisi e i cataloghi dei singoli eventi. I seed
interessi/questionari si leggono, se presenti, da `<tipo>/<profileId>.json`,
verificando anche il `profileId` interno. File assente significa nessun seed;
file presente ma malformato è un errore. Profili/eventi disabilitati restano nello
snapshot: il loader non cancella dati e non sceglie il profilo attivo.

## Contratto effettivamente implementato

I tipi condivisi sono in [catalog.ts](../src/types/catalog.ts); la lettura Node.js
è in [load-catalog.ts](../src/lib/config/load-catalog.ts). Le parti proposte nei
documenti 03–10 diventano operative solo nella misura descritta qui. La
[specifica mobile corrente](../docs/27_Specifiche_UI_Mobile.md) prevale sugli
esempi storici con bozze, foto stand o conferme finali.

- Ogni documento JSON dichiara `schemaVersion: 1`. Proprietà sconosciute, tipi
  errati e riferimenti non risolti causano `ConfigValidationError`: nessuno
  snapshot parziale viene restituito.
- Gli ID di eventi, profili, categorie, padiglioni, stand, pianificati e questionari
  sono slug stabili di 1–64 caratteri (`a-z`, cifre, trattini). Gli ID di domande,
  opzioni e checklist ammettono anche underscore, presenti negli esempi storici.
  Il loader non ricava ID da nomi, testi o posizione negli array.
- Categorie globali ad albero, senza cicli o padri assenti. Stand con più categorie;
  padiglioni e stand identificati nell’ambito dell’evento. `hall` è un ID padiglione
  dello stesso evento; `booth` è testo facoltativo. Le ubicazioni mancanti restano
  assenti. `enabled` degli eventi è facoltativo con default `true`; quello dei
  profili è obbligatorio. L’evento predefinito deve esistere ed essere abilitato.
- I profili configurati hanno origine normalizzata `json`. I budget sono facoltativi,
  per categoria esatta e profilo, senza `eventId`, con importo non negativo a massimo
  due decimali e valuta EUR. Zero è valido; nessuna ereditarietà dal padre è calcolata.
- La presenza di uno stand in `interests/<profileId>.json` è il seed di interesse,
  anche senza priorità né checklist. Priorità facoltativa intera 1–10, distinta dalla
  visita. Non sono presenti stato visita, note personali o completamenti nel seed.

La checklist richiede identità stabile, come da §4 della specifica mobile. In questa
prima implementazione `whatToSee` usa oggetti `{ "id": "...", "text": "..." }`;
gli array di semplici stringhe degli esempi precedenti non sono accettati. Lo
snapshot li espone come `checklist`. Il completamento personale sarà persistito
negli step successivi e non viene scritto nei JSON.

I prodotti pianificati sono una lista facoltativa `plannedProducts` nello stand del
file interessi: `{ "id": "...", "name": "...", "categoryId": "..." }`, con
`description` facoltativa senza limite di caratteri. Il profilo, l’evento e lo stand
sono ereditati dal contesto del file; l’ID è unico per profilo/evento, anche fra stand.
Il loader li espone separatamente in `snapshot.plannedProducts`, con riferimento
`standRef: { source: "catalog", eventId, standId }`. Il contratto condiviso degli
stand distingue già `catalog` e `personal`, ma il seed non può creare o riferire
stand personali. Non viene creato un catalogo `products.json`: registrazioni,
risposte, stato visita e outbox appartengono alla futura persistenza personale.

I questionari sono specifici per profilo e categoria esatta, al massimo uno attivo
per categoria nello stesso profilo, con versione positiva. I sei tipi sono `text`,
`number`, `boolean`, `single_choice`, `multiple_choice`, `rating_1_10`; l’alias storico
`rating` viene normalizzato soltanto in lettura. Opzioni identificate da ID distinti,
limiti numerici coerenti e passo positivo; proprietà valide soltanto per il tipo
corretto. `required` non è ammesso: tutte le risposte saranno facoltative.
Nessuna domanda di fallback, risposta iniziale, ereditarietà o motore delle risposte
è introdotto dal loader.

## Lettura e verifiche

```bash
npm run validate:config
npm run test:unit
```

Il primo comando stampa il riepilogo del dataset o termina con codice 1 indicando
file/campo problematico. Per validare una **copia** del dataset:

```bash
npm run validate:config -- /tmp/expotrack-config-copy
```

Il loader accetta solo riferimenti JSON interni alla directory scelta, anche dopo
la risoluzione dei link simbolici. Non scrive su file, database, media o storage
del browser. Non viene importato dai Client Components: usa le API filesystem di
Node. Dallo step 06 il layout collega il catalogo alla selezione dei profili e al
contesto locale; gli elenchi stand/prodotti e il riepilogo restano ai rispettivi step.

CLI e test compilano gli stessi sorgenti TypeScript in una directory temporanea,
eseguono Node e rimuovono l’output. Nessuna dipendenza aggiuntiva. I test usano
la fixture fittizia separata in `tests/fixtures/catalog`, copiata in directory
temporanee isolate ed eliminata al termine; non leggono né modificano i dati
distribuiti o personali. Le prove riguardano il loader completo e le regole dei
contratti, senza test grafici o snapshot.
