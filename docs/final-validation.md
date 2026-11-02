# Validazione finale dell’implementazione

Il comando unico è:

```bash
npm run validate:final
```

**Responsabile: l’assistente.** Lo eseguirà al termine dell’intera implementazione nello step 28, correggerà gli errori e riporterà gli esiti. Preparare lo script ora non completa né avvia gli step applicativi successivi. `test:unit` copre i contratti e il loader; dallo step 05 `test:integration` copre il repository locale con IndexedDB emulato. API/PostgreSQL ed E2E non sono ancora disponibili. I prerequisiti incompleti devono produrre `not-ready`, senza dichiarare validata l’app.

La fonte dei requisiti è [la specifica mobile corrente, §§6–7](27_Specifiche_UI_Mobile.md#6-accessibilità-prestazioni-e-verifiche). Le indicazioni precedenti su bozze, conferma Salva, pagina 08, foto stand o conflitti manuali non sono criteri di accettazione attivi.

## Prerequisiti e comportamento

1. Arrestare dev server e altre build. Predisporre browser di test, database PostgreSQL dedicato, fixture fittizie e storage media temporaneo. Le suite di integrazione ed E2E devono creare/ripristinare soltanto questi dati di test e pulire i propri processi e file.
2. Impostare `TEST_DATABASE_URL` nell’ambiente del processo. Il nome database deve contenere il segmento `test`, per esempio `expotrack_test` o `expotrack_test_123`. La connessione non deve coincidere con `DATABASE_URL`. Il runner passa ai comandi figli `DATABASE_URL=TEST_DATABASE_URL`, `CI=1` ed `EXPOTRACK_FINAL_VALIDATION=1`; non crea database, migra o cancella dati da solo. Non registra gli URL di connessione nel report.
3. Configurare i comandi npm reali `test:unit`, `test:integration`, `test:e2e` quando gli step pertinenti introducono i rispettivi strumenti. Devono terminare dopo l’esecuzione, fallire se non trovano test o se fallisce un caso obbligatorio e non saltare i casi necessari. Non usare placeholder, `--passWithNoTests` o `--if-present`.
4. Collegare i test reali alle aree obbligatorie in [final-evidence.json](../validation/final-evidence.json). Ogni area deve avere almeno un percorso relativo a un file non vuoto con suffisso `.test.*` o `.spec.*`. Più aree possono condividere un file se contiene effettivamente tutti i relativi casi. La presenza del file da sola non prova la correttezza: l’assistente deve verificare che i test collegati siano eseguiti dalla suite indicata e controllino i comportamenti descritti sotto.
5. Eseguire `npm run validate:final`. Il controllo dei prerequisiti viene prima di ogni altro comando; se manca qualcosa, nessuna suite viene avviata. Altrimenti vengono eseguiti, in sequenza: `lint`, `typecheck`, `test:unit`, `test:integration`, `build`, `test:e2e`. Le verifiche indipendenti continuano dopo un errore; E2E viene saltato se fallisce la build, per non usare un artefatto precedente.

`test:e2e` deve avviare e arrestare autonomamente il server della **build di produzione appena generata**, con database/media di test e contesti browser puliti. Non deve riusare un dev server o un server esterno già attivo. Deve verificare anche il primo accesso e il riavvio della PWA offline; una prova solo su `next dev` non è sufficiente. I test di integrazione devono coprire API e PostgreSQL reali isolati, non soltanto mock.

## Aree automatiche obbligatorie

| ID nel manifest | Suite npm | Comportamenti da dimostrare |
|---|---|---|
| `catalog-and-domain` | `test:unit` | JSON e riferimenti validi/invalidi; importazione e override; filtri, contatori e perimetro interessi; categorie esatte; questionari/versioni e sei tipi di risposta. |
| `profile-event-isolation` | `test:integration` | Dati, interessi, budget, note, prodotti e code isolati fra almeno due profili/eventi; riferimenti del catalogo condivisi correttamente. |
| `local-persistence` | `test:integration` | Transazione atomica record/outbox; input incompleti/invalidi recuperabili; ultima versione valida preservata; nessuna mutazione invalida; categoria/stand bloccati al primo salvataggio valido; errori di scrittura e quota senza falso successo. |
| `server-contracts` | `test:integration` | Migrazioni su DB isolato, vincoli, scope e immutabilità; bootstrap e importazione JSON ripetibili con rollback e personalizzazioni preservate; API valide/invalide. |
| `sync-integrity` | `test:integration` | LWW per ordine server, revisioni, idempotenza, risposta persa e retry; cursori/pull, modifiche locali concorrenti, riavvio e recupero coda; tombstone protette e recupero dei record respinti. |
| `media-integrity` | `test:integration` | Originale e hash invariati; commit blob/metadati; upload interrotto/ripetuto, dipendenze prodotto/foto, errori di spazio/formato e pulizia degli asset non più referenziati. |
| `profiles-and-dashboard` | `test:e2e` | Primo e successivo avvio, cambio profilo immediato, profili personali e protezioni JSON; cambio evento solo nelle impostazioni; quattro contatori e fino a cinque stand reali; budget assente/zero/override. |
| `stands` | `test:e2e` | Ricerca, filtri e scroll conservati; stella = interesse; priorità, visita manuale, checklist e note autosalvate; posizione assente; CRUD stand personale e blocco eliminazione con prodotti. |
| `products-and-questionnaires` | `test:e2e` | Editor unico 05 per pianificati/registrati, nessuna pagina 08 o bozza; autosalvataggio/refresh/input parziali; immutabilità; sei tipi di domanda, voto assente/rimuovibile; descrizione lunga; duplica senza foto, elimina con conferma; visita stand invariata. |
| `photo-workflow` | `test:e2e` | Acquisizione da file, galleria, viewer e focus al ritorno; scelta/sostituzione principale; annullamento/conferma eliminazione; foto riapribili dopo refresh, anche con prodotto incompleto. |
| `offline-pwa-multidevice` | `test:e2e` | Profilo → stand/checklist → prodotto → questionario → descrizione → foto → riavvio offline → ritorno rete → sync → secondo contesto browser; rete intermittente e riavvio; indicatori/contatori reali, foto conteggiate una volta; shell PWA e primo accesso non preparato. |
| `accessibility-and-mobile-scope` | `test:e2e` | Due temi e preferenza persistita, viewport stretto, testo ingrandito, contrasto, label/focus/tastiera/target touch; contenuti non coperti dalla barra; stati vuoti/errori; assenza dei flussi e controlli mobili esplicitamente esclusi dalla specifica. |

Questa mappa va completata con test effettivi man mano che si sviluppa l’app. Non aggiungere fin d’ora test fittizi che passano senza esercitare le funzioni.

**Copertura introdotta nello step 04:** `tests/unit/catalog.test.ts`, eseguito da
`npm run test:unit`, è collegato a `catalog-and-domain`. Copre caricamento valido,
schema/riferimenti invalidi, categorie cicliche, identità stabili, separazione dei seed
e dei riferimenti fra profili/eventi, definizioni dei sei tipi di domanda e alias rating,
letture fallite e file opzionali assenti. Questo collegamento è **parziale**: non prova
ancora importazione nel database, override persistenti, filtri, contatori o validazione
delle risposte. Questi casi devono essere aggiunti negli step pertinenti prima dello
step 28. Le prove fisiche restano pendenti.

**Copertura introdotta nello step 05:** `tests/integration/local-persistence.test.ts`,
eseguito da `npm run test:integration`, è collegato a `local-persistence` e
`profile-event-isolation`. Otto scenari integrano repository, validazione,
transazioni e outbox: input incompleti recuperabili, ultima versione valida,
aggiornamenti validi mentre altri campi sono invalidi, blocco categoria/stand,
quattro contesti profilo/evento, rollback su quota simulata e abort tardivo,
concorrenza, attivazione snapshot e riferimenti rimossi senza perdita di dati.
La suite usa `fake-indexeddb` in memoria; una prova temporanea su IndexedDB reale
in Chromium ha verificato anche refresh e scrittura senza rete. Restano da ampliare
le prove su browser dell’app completa e su dispositivo, gli altri record personali
(interessi, budget, note, media) e tutti i contratti server. Il collegamento non
dichiara completate queste aree per lo step 28 e non sostituisce le future prove
su API/PostgreSQL isolati. Le altre aree rimangono pendenti.

**Copertura introdotta nello step 06:** `tests/integration/profile-selection.test.ts`
è eseguito da `test:integration` e collegato a `local-persistence` e
`profile-event-isolation`. Sei scenari coprono primo/secondo avvio del repository,
scelta persistita, cambio dopo commit personali, prodotti/code preservati, profili
rimossi/disabilitati, preferenze corrotte, evento valido/non valido, errori di
scrittura con retry e catalogo vuoto senza duplicare gli snapshot. Una prova
temporanea Chromium ha esercitato il flusso UI completo su `next dev`, inclusi
refresh, tastiera, errori e stati vuoti. Non è una suite E2E permanente della build
di produzione: `profiles-and-dashboard` resta da collegare quando verranno
introdotti i test E2E e le ulteriori funzioni di quell’area. Le prove fisiche e le
altre parti delle aree di integrazione restano pendenti.

**Copertura introdotta nello step 07:** `tests/unit/stand-list.test.ts`, eseguito
da `test:unit` e collegato a `catalog-and-domain`, copre interessi per profilo,
precedenza degli override, ricerca senza accenti, filtri combinati e azzeramento,
priorità decrescente con spareggio per nome/ID e contesto dei parametri di lista.
`tests/integration/stand-interests.test.ts`, eseguito da `test:integration`, è
collegato a `local-persistence` e `profile-event-isolation`: rimozioni esplicite
persistenti, aggiornamenti dei seed, due profili/eventi, visita/priorità preservate,
concorrenza, dipendenze, rollback su quota/abort e migrazione IndexedDB 1 → 2 con
prodotti e code preesistenti conservati. Le prove temporanee in Chromium verificano
il flusso UI, errori/retry e ritorno con filtri/scroll; non sono una suite E2E di
produzione. `stands` resta da collegare quando saranno disponibili anche dettaglio,
checklist, note e CRUD personale. Le altre parti delle aree e le prove fisiche
restano pendenti; nessun test grafico automatico introdotto.

## Prove su dispositivo

**Estensione step 08:** la suite già collegata `tests/integration/stand-interests.test.ts`
verifica anche checklist per ID, aggiunte, contatore, priorità rimossa, visita
preservata da spunte/prodotti, separazione dei prodotti e dei profili, riapertura,
seed aggiornati, patch invalide e rollback/retry. È copertura parziale delle aree
`local-persistence` e `profile-event-isolation`; l’area E2E `stands` resta pendente.

Gli emulatori non dimostrano installazione PWA, fotocamera, memoria o usabilità su un telefono fisico. Il manifest mantiene tre verifiche distinte:

| ID | Verifica richiesta |
|---|---|
| `android-pwa` | Su Android di riferimento/Galaxy S25: installazione, modalità aereo, refresh, chiusura e riapertura, riattivazione rete e sincronizzazione, senza perdita di dati. |
| `camera-and-storage` | Fotocamera/galleria reali, originali riapribili, permessi negati, quota o spazio insufficiente e recupero senza falso salvataggio. |
| `mobile-usability` | Tastiera virtuale, safe area, target touch, luminosità elevata, temi, testo ingrandito e navigazione con tecnologie assistive. |

Ogni voce parte da `pending`. Segnarla `passed` soltanto dopo la prova, indicando in `evidence` percorsi relativi a verbali, screenshot o registrazioni non vuoti, con dispositivo/browser, data, azioni, risultato e responsabile. Usare `failed` se la prova evidenzia un difetto. L’assistente eseguirà tutto ciò che l’ambiente consente; eventuali prove fisiche non disponibili resteranno esplicitamente pendenti e impediranno un esito complessivo completo.

## Report ed esiti

Ogni esecuzione crea `validation-results/<timestamp-UTC>/report.json`, escluso da Git. Il report contiene modalità, tempi, prerequisiti mancanti, comandi ed exit code, file di test collegati e stato/evidenze delle prove fisiche. Gli output dettagliati restano visibili nel terminale e nei report delle rispettive suite.

| Stato | Exit code | Significato |
|---|---|---|
| `passed` | 0 | Tutti i comandi superati e prove su dispositivo completate con evidenze. |
| `not-ready` | 1 | Mancano prerequisiti, suite, file di test o evidenze dichiarate come superate. Nessun check dell’app eseguito. |
| `failed` | 1 | Almeno un comando o una prova su dispositivo è fallito. |
| `incomplete` | 2 | Controlli automatici passati, prove fisiche ancora pendenti. |
| `preflight-only` | 0 | Solo prerequisiti controllati; **non** equivale a un’app validata. |

Il comando diagnostico `npm run validate:final -- --preflight` controlla soltanto la preparazione; l’assistente dovrà comunque eseguire il comando completo alla fine. Dopo un difetto corretto, ripetere i controlli pertinenti e la validazione finale sul codice aggiornato, riportando sempre lo stato effettivo e il percorso dell’ultimo report.

**Estensione step 09:** i due scenari note in
`tests/integration/stand-interests.test.ts`, già collegato a `local-persistence`
e `profile-event-isolation` in `validation/final-evidence.json`, verificano testo
lungo integro, riapertura, cancellazione del contenuto, profili/eventi/stand,
separazione dalla descrizione prodotto, patch concorrenti, invalidi e quota con
rollback/retry. Le prove Chromium temporanee su copia isolata verificano input
mentre una transazione è in corso, ritorno immediato, cambio profilo, refresh e
blocco dell’uscita con recupero dopo errore. Non completano l’area E2E `stands`,
ancora priva di CRUD personale e suite della build di produzione; le prove
fisiche restano pendenti. Nessun test grafico aggiunto.
