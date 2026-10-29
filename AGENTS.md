<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Verifiche obbligatorie a fine step

Alla fine di ogni step, **l’assistente deve eseguire `npm run lint` e `npm run typecheck`** sul codice aggiornato, leggere gli esiti e correggere eventuali errori prima di dichiarare lo step completato o pronto per la verifica dell’utente. Entrambi i comandi devono terminare con successo; non delegare questi controlli all’utente e non dichiararli superati senza averli eseguiti. Dopo le correzioni, ripetere i controlli necessari e riportare nella consegna l’esito effettivo di lint e typecheck. Se un impedimento ne preclude l’esecuzione o il completamento, dichiararlo esplicitamente senza presentare lo step come verificato.

Su richiesta dell’utente, non eseguire la build come controllo di fine step: i comandi obbligatori sono soltanto lint e typecheck. Restano i test funzionali pertinenti allo step e la procedura di validazione finale descritta sotto.

## Validazione finale dell’implementazione

Al termine dell’intera implementazione, durante lo step 28, **l’assistente deve eseguire `npm run validate:final`**, leggere il report e correggere gli errori prima di dichiarare concluso il lavoro. L’esecuzione è a carico dell’assistente, come richiesto dall’utente; non delegare all’utente i controlli automatizzabili.

Durante gli step che introducono test, collegare i file reali alle aree di `validation/final-evidence.json`, secondo `docs/final-validation.md`. Suite mancanti, test non collegati o prove su dispositivo ancora pendenti non valgono come validazione completa. Non segnare verifiche come superate senza averle eseguite. Usare database e media di test isolati, senza modificare i dati di sviluppo o produzione.
