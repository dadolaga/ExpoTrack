# Componenti di base

I componenti condivisi vivono in questa cartella. Importare direttamente dal file,
per esempio `@/components/ui/Button`. Colori, spaziature, raggi e dimensioni touch
usano i token di `src/app/globals.css` nei temi chiaro, scuro e di sistema.
Il focus visibile è quello globale. Nessuna dipendenza da dati ExpoTrack, rete o storage.

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
Nessun componente decide quando salvare, quale validazione eseguire o dove navigare.

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

`examples/ComponentPreview` è la dimostrazione interattiva usata dalla pagina `/`.
Non è un editor dell’app e non persiste dati. Eseguire `npm run dev` e aprire
[http://localhost:3000](http://localhost:3000).

1. Premere **Verifica campo** sul campo vuoto (o contenente soltanto spazi):
   messaggio vicino al campo, `aria-invalid`, focus riportato sull’input e stato di errore.
2. Inserire testo e verificare: stato di successo della sola prova locale.
   **Azzera la prova** rimuove testo, errore ed esito.
3. Usare l’azione dello stato vuoto: compila e porta il focus al campo di prova.
4. Controllare con Tab/Shift+Tab e Invio: focus visibile e campi/pulsanti disabilitati
   esclusi dalla navigazione. Un clic sulla label attiva il campo associato.
5. Ripetere con tema di sistema chiaro/scuro, viewport stretta e zoom testo.
   Per forzare il tema dalla console del browser:
   `document.documentElement.dataset.theme = "dark"` oppure `"light"`.
   Ripristinare con `delete document.documentElement.dataset.theme`.

Le verifiche visive restano manuali; non aggiungere snapshot o test di classi,
colori o struttura esatta del DOM. Nessun selettore tema persistente è introdotto
in questo step: appartiene allo step 03.
