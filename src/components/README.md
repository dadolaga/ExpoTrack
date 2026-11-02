# Componenti condivisi

I componenti condivisi vivono in questa cartella. Importare direttamente dal file,
per esempio `@/components/ui/Button`. Colori, spaziature, raggi e dimensioni touch
usano i token di `src/app/globals.css` nei temi chiaro, scuro e di sistema.
Il focus visibile è quello globale. I componenti di base non dipendono da dati
ExpoTrack, rete o storage; il selettore tema usa solo la preferenza locale del browser.

| Componente | Proprietà e impiego |
|---|---|
| `ui/Button` | Prop native di `button`, inclusi `children`, `disabled`, `onClick`, `ref` e attributi ARIA. `variant`: `primary` (default) o `secondary`. `type` è `button` per default: specificare `submit` nei form. Dimensione minima di 48 px, testo a capo e focus da tastiera. Accompagnare `disabled` con una spiegazione visibile, associata tramite `aria-describedby`. |
| `ui/Card` | Prop native di `div`, inclusi `children` e `className`. Contenitore con bordo, superficie, padding e distanza interna comuni. Il chiamante sceglie titoli e semantica, per esempio una `section` esterna con `aria-labelledby`. Non è cliccabile. |
| `forms/TextField` | `label` obbligatoria; `hint` e `error` facoltativi. Prop native di `input`, inclusi `required`, `disabled`, `value`/`defaultValue`, `onChange`, `name` e `ref`. `type`: `text` (default), `email`, `password`, `search`, `tel`, `url`, `number`. `className` si applica all’input. Genera un ID stabile con `useId` se `id` non è fornito. Label e input sono associati; hint ed errore vengono aggiunti ad `aria-describedby`, conservando gli ID del chiamante. Un errore non vuoto imposta `aria-invalid` e mostra il prefisso «Errore:». La validazione e lo spostamento del focus restano al form. |
| `ui/StatusChip` | Prop native di `span` e `tone`: `neutral` (default), `success`, `warning`, `danger`. `children` deve esprimere lo stato a parole: il colore è un rinforzo. Per aggiornamenti da annunciare, inserire il chip in un contenitore persistente con `role="status"` e `aria-atomic="true"`. Non rileva né simula salvataggi o sincronizzazioni. |
| `feedback/EmptyState` | `title` e `description` obbligatori; `action` facoltativa (`ReactNode`), normalmente un `Button` con callback reale o un link. Il titolo è un `h3`: collocarlo sotto un titolo di sezione `h2`. Nessuna azione predefinita. |

`TextField` è un Client Component perché usa `useId`. Gli altri componenti di base
non richiedono una direttiva client. Event handler e stato si definiscono in un
Client Component chiamante; pagine e layout possono restare Server Components.
I componenti di base non decidono quando salvare, quale validazione eseguire o dove navigare.

## Shell mobile e tema

| Componente | Proprietà e impiego |
|---|---|
| `layout/AppShell` | `children` contiene le pagine Server Component. Componente client che attende la sessione locale, manda a `/profiles` quando manca una scelta valida e usa un layout dedicato senza tab per la selezione. Dopo la scelta, header/area scorrevole/barra inferiore occupano tre righe del viewport dinamico. Safe area sui quattro lati e collegamento «Vai al contenuto». |
| `layout/TopBar` | Titolo derivato dalla destinazione corrente; `title` e `subtitle` possono sostituirlo. `onBack` facoltativo mostra Indietro solo con un ritorno effettivo; `actions` accoglie azioni contestuali e `context` il riepilogo di profilo/evento. Nei tab principali si usa la cronologia del browser. |
| `layout/BottomNav` | Quattro link Next.js stabili: `/`, `/stands`, `/products`, `/profile`. Icone SVG locali e label visibili; destinazione attiva con `aria-current="page"`, sfondo pieno e testo rinforzato. I percorsi delle sottoviste mantengono attivo il tab del proprio ambito. |
| `forms/ThemeSelector` | Gruppo radio nativo Automatico/Chiaro/Scuro, utilizzato in Profilo. Usa i token esistenti; Automatico segue il sistema senza un override su `html`. Preferenza locale `expotrack.theme`, sincronizzata fra schede. Se la scrittura fallisce, applica il tema alla sessione e mostra errore e pulsante per ritentare. |
| `layout/ThemeController` | Componente senza UI montato nel layout radice. Ripristina la preferenza dopo il remount di sviluppo e ascolta le modifiche fra schede. Lo script statico in `head` applica il tema prima del primo rendering; `suppressHydrationWarning` è limitato a `html`, il cui attributo è modificato dallo script come previsto dalla guida Next.js installata. |

Pagine e layout restano Server Components; la shell è client per gestire la scelta
locale del profilo e la navigazione. La selezione profili è operativa; riepilogo,
elenco prodotti e sincronizzazione arriveranno nei rispettivi step. La lista stand
è operativa dallo step 07.

## Selezione profili

| Componente | Proprietà e impiego |
|---|---|
| `profiles/ProfileProvider` | Riceve il `CatalogSnapshot` letto e validato dal layout server. Apre il repository e ripristina la sessione; `useProfileSession()` espone stato, repository, catalogo/contesto validi, scelta profilo e retry. Non sceglie automaticamente il primo profilo. Chiude le connessioni e ignora risultati di inizializzazioni già smontate. |
| `profiles/ProfilePicker` | Pagina `/profiles`. Gruppi configurati/personali, scelta mediante riga, messaggio per catalogo vuoto o scelta non più valida. Durante il commit disabilita le righe con spiegazione; naviga a Home soltanto dopo salvataggio riuscito. Nessun pulsante Continua o creazione personale anticipata. |
| `profiles/ProfileRow` | `profile`, `active`, `disabled`, `onSelect`. Pulsante a larghezza piena con nome, origine, avatar decorativo e indicazione testuale «In uso». `aria-current` identifica la scelta attuale; descrizione dell’origine e stato del salvataggio associati. |
| `profiles/ProfileIdentity` | `profile`, `compact` facoltativo e `children` per una descrizione. Riusa nome e colore in riga, header e sezione Profilo; icona utente standard. L’identità JSON è visualizzata in sola lettura. |
| `profiles/ActiveProfile` | Profilo/evento effettivamente attivi e collegamento «Cambia profilo». Il selettore tema rimane nella stessa sezione Profilo. |

I profili personali sono un gruppo distinto attualmente vuoto: la creazione e la
gestione arriveranno nello step 20. Non viene simulato un profilo personale dal
mockup. Il PNG del marchio è un asset locale già presente nel progetto, con
provenienza documentata in `public/brand/README.md`.

## Lista stand — step 07

`stands/StandHeader` riprende il marchio, il contesto e le due scorciatoie ricerca/filtri
del mockup 03. La shell lo compone nella lista stand; il titolo e il selettore
interessi/catalogo sono nella stessa riga del contenuto. La selezione del tab Stand
usa il fondo tenue del mockup.

`stands/StandCatalog` collega la sessione agli hook di `features/stands/`, con caricamento,
errore di lettura e retry di una stella non salvata. `StandList` riceve dati e callback:
ricerca, chip degli stati con conteggi, tre select compatte e pannello Filtri per
interesse e ordinamento; nessuna chiamata diretta allo storage. `StandRow` mostra
fallback con iniziali, nome/categorie/posizione, priorità colorata, stato con pallino
e stella indipendente. I loghi non sono ancora nel contratto del catalogo. Dallo step 08 le righe aprono il dettaglio dello stand.

`forms/SelectField` associa label e select nativa; `compact` mantiene la label
accessibile e usa la forma compatta della barra filtri. `forms/TextField` accetta
`labelClassName`, utilizzato con `sr-only` per la ricerca. Le icone ricerca, filtri,
chiusura e chevron estendono `layout/NavigationIcon`.

Il dettaglio `/stands/[standId]`, introdotto nello step 08, usa `StandDetail` e
`StandChecklist`: priorità rimovibile, visita manuale, spunte e aggiunta di voci
con ID stabili. Riusa `StandInterestButton`, esportato da `StandRow`, per la stella.
Pianificati e registrati hanno conteggi e sezioni distinti, ancora senza azioni
editor prodotto. `useStandDetail` carica e salva; il selettore condiviso risolve
seed, override e prodotti del contesto. Il ritorno dal dettaglio conserva la lista;
un accesso diretto offre comunque il ritorno al catalogo.

I filtri combinabili usano funzioni pure. Il loro URL include profilo/evento per
evitare riusi accidentali in un altro contesto; lo scroll è associato alla voce
di cronologia, con recupero in sessione per URL/contesto dopo refresh del dettaglio.
Un nuovo ingresso dal tab Stand azzera la posizione predefinita. Queste preferenze
non entrano nel catalogo o nell’outbox.

Esempio in un componente client (il form gestisce `name`, `error` e `onSubmit`):

```tsx
<Card>
  <h2>Dati</h2>
  <form onSubmit={onSubmit}>
    <TextField
      label="Nome"
      name="name"
      required
      value={name}
      onChange={(event) => setName(event.target.value)}
      error={error}
    />
    <Button type="submit">Verifica</Button>
  </form>
</Card>
```

## Pagina di verifica

`examples/ComponentPreview` è la dimostrazione interattiva alla pagina `/examples/components`.
Non è un editor dell’app e non persiste dati. Eseguire `npm run dev` e aprire
[http://localhost:3000/examples/components](http://localhost:3000/examples/components).

1. Premere **Verifica campo** sul campo vuoto (o contenente soltanto spazi):
   messaggio vicino al campo, `aria-invalid`, focus riportato sull’input e stato di errore.
2. Inserire testo e verificare: stato di successo della sola prova locale.
   **Azzera la prova** rimuove testo, errore ed esito.
3. Usare l’azione dello stato vuoto: compila e porta il focus al campo di prova.
4. Controllare con Tab/Shift+Tab e Invio: focus visibile e campi/pulsanti disabilitati
   esclusi dalla navigazione. Un clic sulla label attiva il campo associato.
5. Ripetere con tema di sistema chiaro/scuro, viewport stretta e zoom testo.
   Per scegliere e ricordare il tema, usare **Profilo → Aspetto** e tornare alla prova.

Le verifiche visive restano manuali; non aggiungere snapshot o test di classi,
colori o struttura esatta del DOM. La dimostrazione resta separata dalle quattro
destinazioni dell’app e non salva i dati dei campi.
