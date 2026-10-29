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
| `layout/AppShell` | `children` contiene le pagine Server Component. Header, area principale scorrevole e barra inferiore occupano tre righe del viewport dinamico: la barra rimane visibile e il suo ingombro reale non copre i contenuti, anche con testo ingrandito. Safe area sui quattro lati e collegamento «Vai al contenuto». |
| `layout/TopBar` | Titolo derivato dalla destinazione corrente; `title` e `subtitle` possono sostituirlo. `onBack` facoltativo mostra un vero pulsante Indietro soltanto quando il chiamante fornisce il ritorno previsto; `actions` accoglie azioni contestuali. Nei quattro tab principali il ritorno è gestito dalla cronologia del browser. |
| `layout/BottomNav` | Quattro link Next.js stabili: `/`, `/stands`, `/products`, `/profile`. Icone SVG locali e label visibili; destinazione attiva con `aria-current="page"`, sfondo pieno e testo rinforzato. I percorsi delle sottoviste mantengono attivo il tab del proprio ambito. |
| `forms/ThemeSelector` | Gruppo radio nativo Automatico/Chiaro/Scuro, utilizzato in Profilo. Usa i token esistenti; Automatico segue il sistema senza un override su `html`. Preferenza locale `expotrack.theme`, sincronizzata fra schede. Se la scrittura fallisce, applica il tema alla sessione e mostra errore e pulsante per ritentare. |
| `layout/ThemeController` | Componente senza UI montato nel layout radice. Ripristina la preferenza dopo il remount di sviluppo e ascolta le modifiche fra schede. Lo script statico in `head` applica il tema prima del primo rendering; `suppressHydrationWarning` è limitato a `html`, il cui attributo è modificato dallo script come previsto dalla guida Next.js installata. |

Pagine e shell restano Server Components; solo navigazione, titolo legato al percorso
e preferenza tema richiedono componenti client. Le destinazioni iniziali sono stati
vuoti espliciti: catalogo, profili, contatori e sincronizzazione arriveranno nei loro step.

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
