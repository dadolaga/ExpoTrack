# Standard del codice

La configurazione applicata è [eslint.config.mjs](../eslint.config.mjs). Vale per JavaScript, TypeScript, JSX, configurazioni e script; i controlli che richiedono i tipi sono limitati ai file TypeScript. I preset Next.js, React, Hooks e accessibilità già presenti restano attivi. A questi si aggiungono le regole raccomandate di ESLint e quelle TypeScript che usano le informazioni sui tipi.

La formattazione usa ESLint Stylistic, senza regole di stile deprecate di ESLint e senza un secondo formatter in conflitto. Le versioni dei nuovi strumenti sono fissate in `package.json` e nel lockfile. CSS, JSON e Markdown non sono analizzati da ESLint con questa configurazione; `.editorconfig` ne uniforma le impostazioni di base negli editor compatibili.

## Formattazione richiesta

- Graffe di apertura sulla stessa riga di funzioni, callback, classi, `if`, `else`, cicli e `try/catch`, precedute da uno spazio (stile 1TBS). Anche `else` e `catch` seguono la graffa di chiusura sulla stessa riga: `} else {` e `} catch (error) {`. Il contenuto del blocco va a capo; niente blocchi compressi su una riga. Graffe obbligatorie anche per un solo comando.
- Rientro di 2 spazi, inclusi i `case` degli `switch`; tab vietati.
- Oggetti non vuoti e tipi oggetto su più righe, una proprietà per riga. Destrutturazioni e import/export con almeno quattro elementi vanno su più righe; quelli brevi possono restare compatti.
- Array con almeno tre elementi o contenuti su più righe con le parentesi quadre su righe separate. Gli elementi rispettano una disposizione coerente, senza mescolare separatori a capo e sulla stessa riga.
- Chiamate e parametri brevi possono restare sulla stessa riga. Quando gli argomenti sono distribuiti su più righe, parentesi e separatori devono essere coerenti.
- Parentesi sempre intorno ai parametri delle arrow function; parentesi anche nei costruttori senza argomenti. Rimosse parentesi superflue intorno alle funzioni.
- Uno spazio dopo le virgole e i due punti delle proprietà, intorno agli operatori binari e alle arrow, dopo le parole chiave; niente spazi prima delle virgole, dentro parentesi tonde e quadre, negli accessi calcolati o prima delle proprietà.
- Nessuno spazio fra il nome di una funzione e `(`, anche nelle chiamate; spazio fra `async` e i parametri di una arrow function. Spaziatura coerente anche per operatori unari, blocchi, `case`, generatori e `yield*`.
- Spazi nelle graffe di import/destrutturazioni compatti; nessuno spazio aggiuntivo in spread/rest, interpolazioni e tagged template.
- Doppi apici per stringhe e attributi JSX; apici singoli ammessi per evitare escape inutili. Chiavi degli oggetti senza virgolette quando non servono.
- Punto e virgola obbligatorio a fine istruzione e separatori coerenti nei membri dei tipi TypeScript. Virgole finali nelle strutture multilinea e virgole in fondo alla riga.
- Una sola istruzione per riga. Niente ternari annidati; parentesi esplicite quando si mescolano operatori con precedenze diverse. Numeri decimali con zero prima e dopo il punto.
- Operatori a inizio riga nelle espressioni spezzate; punto insieme al nome della proprietà nelle catene su più righe. IIFE racchiuse correttamente fra parentesi.
- Massimo 100 caratteri per riga di codice. Esclusi URL, stringhe, template literal, espressioni regolari e commenti per non alterare contenuti o imporre spezzature artificiali.
- Righe vuote fra dichiarazioni e istruzioni, prima di `return` e `throw`, intorno a funzioni/classi e fra membri delle classi. Dichiarazioni consecutive possono restare adiacenti. Nessuna riga vuota subito dentro i blocchi e al massimo una riga vuota consecutiva.
- Commenti con spazio dopo il delimitatore; nessuno spazio multiplo di allineamento o spazio finale. File UTF-8, terminatori LF e newline finale. Il Markdown conserva gli spazi finali utili alla sua sintassi.
- In JSX: una prop per riga quando ce n'è più di una, prima prop a capo nei tag multilinea, chiusure allineate, rientro delle prop di 2 spazi e spazio prima di `/>`.
- In JSX: niente spazi intorno a `=` o dentro le graffe; stringhe senza graffe inutili; prop booleane vere in forma abbreviata; elementi vuoti autochiusi, niente fragment superflui e parentesi per espressioni JSX multilinea.
- In TypeScript: spaziatura coerente di annotazioni, generici e tuple con elementi nominati; firme di metodi nei tipi espresse come proprietà funzione.
- Import in testa al file, ordinati alfabeticamente per gruppi: moduli Node, dipendenze esterne, moduli interni, percorsi parent/sibling/index, object import e import di soli tipi. Una riga vuota separa i gruppi e gli import dal codice. Gli import con effetti collaterali non vengono riordinati automaticamente.

## Controlli di qualità

- Niente variabili/import inutilizzati, variabili omonime che nascondono altre variabili, uso prima della dichiarazione o soppressioni ESLint inutilizzate. Le dichiarazioni di funzione possono essere richiamate prima della definizione; parametri e errori catturati intenzionalmente inutilizzati devono iniziare con `_`.
- Preferire `const`, arrow callback, proprietà abbreviate, template literal, spread/rest, esponenziazione e letterali numerici. Vietati `var`, riassegnazione di parametri e loro proprietà, assegnazioni multiple e più dichiarazioni nello stesso statement.
- Confronti stretti `===` e `!==`, costante a destra, conversioni esplicite e base esplicita in `parseInt`; niente confronti con se stessi, ternari inutili, assegnazioni nei `return`, sequenze con virgola o `else` superflui dopo `return`.
- Callback di array con ritorni corretti; `forEach` senza valori restituiti, `for...in` con controllo delle proprietà proprie, `default` per ultimo negli switch e parametri con valore predefinito dopo quelli obbligatori.
- Niente `eval`, `Function` dinamico, timer con stringhe, URL `javascript:`, `alert`, `caller`, `__iterator__`, estensioni degli oggetti nativi, wrapper primitivi, costruttori `Object`, blocchi/label inutili o costruttori che restituiscono valori impropri.
- Niente concatenazioni, rinominazioni, chiavi calcolate, `bind` o `return` inutili; usare `Object.hasOwn` quando applicabile. I costruttori devono produrre un valore effettivamente usato.
- Promise senza executor che restituiscono valori ignorati e rejection con errori. Nel codice TypeScript: Promise gestite, `await` solo su valori appropriati, callback asincrone usate correttamente e funzioni `async` giustificate.
- In TypeScript: niente `any` espliciti, accessi/chiamate/assegnazioni/ritorni non sicuri, asserzioni non-null con `!`, asserzioni ridondanti o tipi/condizioni inutili. Controlli booleani espliciti per stringhe e numeri; preferire `??`, `?.` e membri `readonly` quando applicabili. Switch esaustivi su union/enum e valori lanciati come errori.
- Import/export di soli tipi espliciti e senza effetti collaterali involontari; niente import duplicati, di se stessi, ciclici o con segmenti di percorso inutili, né esportazioni riassegnabili.
- Nel codice dell'app sono consentiti soltanto `console.warn` e `console.error`; gli script da terminale possono stampare i loro risultati. Restano attivi i controlli Next.js/React/Hooks e accessibilità semantica; nessun test grafico o snapshot viene introdotto.

## Comandi

```bash
npm run lint:fix
npm run lint
npm run typecheck
```

`lint:fix` corregge soltanto ciò che ESLint sa risolvere automaticamente. Gli altri errori vanno corretti nel codice, senza disattivare le regole. Il comando lint mantiene zero warning ammessi. La build non fa parte dei controlli di fine step.

## Catalogo delle regole esplicite

Le tabelle seguenti riportano tutte le regole dichiarate nei tre blocchi dello standard e le relative opzioni. Si aggiungono ai preset citati sopra. Le regole core disattivate nel blocco TypeScript sono sostituite dalle rispettive versioni TypeScript, per evitare controlli duplicati o non compatibili con i tipi.

### expotrack/code-standard

| Regola | Configurazione |
|---|---|
| `@stylistic/array-bracket-newline` | `["error",{"multiline":true,"minItems":3}]` |
| `@stylistic/array-bracket-spacing` | `["error","never"]` |
| `@stylistic/array-element-newline` | `["error","consistent"]` |
| `@stylistic/arrow-parens` | `["error","always"]` |
| `@stylistic/arrow-spacing` | `"error"` |
| `@stylistic/block-spacing` | `["error","always"]` |
| `@stylistic/brace-style` | `["error","1tbs",{"allowSingleLine":false}]` |
| `@stylistic/comma-dangle` | `["error","always-multiline"]` |
| `@stylistic/comma-spacing` | `"error"` |
| `@stylistic/comma-style` | `["error","last"]` |
| `@stylistic/computed-property-spacing` | `["error","never"]` |
| `@stylistic/dot-location` | `["error","property"]` |
| `@stylistic/eol-last` | `["error","always"]` |
| `@stylistic/function-call-argument-newline` | `["error","consistent"]` |
| `@stylistic/function-call-spacing` | `["error","never"]` |
| `@stylistic/function-paren-newline` | `["error","multiline-arguments"]` |
| `@stylistic/generator-star-spacing` | `["error",{"before":false,"after":true}]` |
| `@stylistic/indent` | `["error",2,{"SwitchCase":1}]` |
| `@stylistic/key-spacing` | `"error"` |
| `@stylistic/keyword-spacing` | `"error"` |
| `@stylistic/linebreak-style` | `["error","unix"]` |
| `@stylistic/lines-between-class-members` | `["error","always"]` |
| `@stylistic/max-len` | `["error",{"code":100,"ignoreUrls":true,"ignoreStrings":true,"ignoreTemplateLiterals":true,"ignoreRegExpLiterals":true,"ignoreComments":true}]` |
| `@stylistic/max-statements-per-line` | `["error",{"max":1}]` |
| `@stylistic/member-delimiter-style` | `"error"` |
| `@stylistic/new-parens` | `["error","always"]` |
| `@stylistic/no-extra-parens` | `["error","functions"]` |
| `@stylistic/no-floating-decimal` | `"error"` |
| `@stylistic/no-mixed-operators` | `"error"` |
| `@stylistic/no-mixed-spaces-and-tabs` | `"error"` |
| `@stylistic/no-multi-spaces` | `"error"` |
| `@stylistic/no-multiple-empty-lines` | `["error",{"max":1,"maxBOF":0,"maxEOF":0}]` |
| `@stylistic/no-tabs` | `"error"` |
| `@stylistic/no-trailing-spaces` | `"error"` |
| `@stylistic/no-whitespace-before-property` | `"error"` |
| `@stylistic/object-curly-newline` | `["error",{"ObjectExpression":{"minProperties":1,"consistent":true},"ObjectPattern":{"minProperties":4,"multiline":true,"consistent":true},"ImportDeclaration":{"minProperties":4,"multiline":true,"consistent":true},"ExportDeclaration":{"minProperties":4,"multiline":true,"consistent":true},"TSTypeLiteral":{"minProperties":1,"consistent":true},"TSInterfaceBody":{"minProperties":1,"consistent":true}}]` |
| `@stylistic/object-curly-spacing` | `["error","always"]` |
| `@stylistic/object-property-newline` | `["error",{"allowAllPropertiesOnSameLine":false}]` |
| `@stylistic/operator-linebreak` | `["error","before"]` |
| `@stylistic/padded-blocks` | `["error","never"]` |
| `@stylistic/padding-line-between-statements` | `["error",{"blankLine":"always","prev":"*","next":["return","throw","function","class"]},{"blankLine":"always","prev":["const","let"],"next":"*"},{"blankLine":"any","prev":["const","let"],"next":["const","let"]},{"blankLine":"always","prev":["function","class"],"next":"*"}]` |
| `@stylistic/quote-props` | `["error","as-needed"]` |
| `@stylistic/quotes` | `["error","double",{"avoidEscape":true}]` |
| `@stylistic/rest-spread-spacing` | `["error","never"]` |
| `@stylistic/semi` | `["error","always"]` |
| `@stylistic/semi-spacing` | `"error"` |
| `@stylistic/semi-style` | `["error","last"]` |
| `@stylistic/space-before-blocks` | `["error","always"]` |
| `@stylistic/space-before-function-paren` | `["error",{"anonymous":"never","named":"never","asyncArrow":"always"}]` |
| `@stylistic/space-in-parens` | `["error","never"]` |
| `@stylistic/space-infix-ops` | `"error"` |
| `@stylistic/space-unary-ops` | `"error"` |
| `@stylistic/spaced-comment` | `["error","always",{"markers":["/","!"]}]` |
| `@stylistic/switch-colon-spacing` | `"error"` |
| `@stylistic/template-curly-spacing` | `["error","never"]` |
| `@stylistic/template-tag-spacing` | `["error","never"]` |
| `@stylistic/type-annotation-spacing` | `"error"` |
| `@stylistic/type-generic-spacing` | `"error"` |
| `@stylistic/type-named-tuple-spacing` | `"error"` |
| `@stylistic/wrap-iife` | `["error","outside"]` |
| `@stylistic/yield-star-spacing` | `["error",{"before":false,"after":true}]` |
| `accessor-pairs` | `"error"` |
| `array-callback-return` | `["error",{"checkForEach":true}]` |
| `block-scoped-var` | `"error"` |
| `curly` | `["error","all"]` |
| `default-case-last` | `"error"` |
| `default-param-last` | `"error"` |
| `dot-notation` | `"error"` |
| `eqeqeq` | `["error","always"]` |
| `guard-for-in` | `"error"` |
| `no-alert` | `"error"` |
| `no-caller` | `"error"` |
| `no-constructor-return` | `"error"` |
| `no-else-return` | `["error",{"allowElseIf":false}]` |
| `no-eval` | `"error"` |
| `no-extend-native` | `"error"` |
| `no-extra-bind` | `"error"` |
| `no-implicit-coercion` | `"error"` |
| `no-implied-eval` | `"error"` |
| `no-iterator` | `"error"` |
| `no-labels` | `"error"` |
| `no-lone-blocks` | `"error"` |
| `no-lonely-if` | `"error"` |
| `no-multi-assign` | `"error"` |
| `no-nested-ternary` | `"error"` |
| `no-new` | `"error"` |
| `no-new-func` | `"error"` |
| `no-new-wrappers` | `"error"` |
| `no-object-constructor` | `"error"` |
| `no-param-reassign` | `["error",{"props":true}]` |
| `no-promise-executor-return` | `"error"` |
| `no-return-assign` | `["error","always"]` |
| `no-script-url` | `"error"` |
| `no-self-compare` | `"error"` |
| `no-sequences` | `"error"` |
| `no-shadow` | `"error"` |
| `no-template-curly-in-string` | `"error"` |
| `no-throw-literal` | `"error"` |
| `no-unneeded-ternary` | `"error"` |
| `no-unused-expressions` | `"error"` |
| `no-unused-vars` | `["error",{"args":"all","argsIgnorePattern":"^_","caughtErrors":"all","caughtErrorsIgnorePattern":"^_","ignoreRestSiblings":true}]` |
| `no-use-before-define` | `["error",{"functions":false}]` |
| `no-useless-computed-key` | `"error"` |
| `no-useless-concat` | `"error"` |
| `no-useless-rename` | `"error"` |
| `no-useless-return` | `"error"` |
| `no-var` | `"error"` |
| `object-shorthand` | `["error","always"]` |
| `one-var` | `["error","never"]` |
| `prefer-arrow-callback` | `"error"` |
| `prefer-const` | `"error"` |
| `prefer-exponentiation-operator` | `"error"` |
| `prefer-numeric-literals` | `"error"` |
| `prefer-object-has-own` | `"error"` |
| `prefer-object-spread` | `"error"` |
| `prefer-promise-reject-errors` | `"error"` |
| `prefer-rest-params` | `"error"` |
| `prefer-spread` | `"error"` |
| `prefer-template` | `"error"` |
| `radix` | `["error","always"]` |
| `yoda` | `["error","never"]` |
| `import/first` | `"error"` |
| `import/newline-after-import` | `"error"` |
| `import/no-cycle` | `"error"` |
| `import/no-duplicates` | `"error"` |
| `import/no-mutable-exports` | `"error"` |
| `import/no-self-import` | `"error"` |
| `import/no-useless-path-segments` | `"error"` |
| `import/order` | `["error",{"groups":["builtin","external","internal","parent","sibling","index","object","type"],"newlines-between":"always","alphabetize":{"order":"asc","caseInsensitive":true},"warnOnUnassignedImports":true}]` |

### expotrack/typed-safety

| Regola | Configurazione |
|---|---|
| `default-param-last` | `"off"` |
| `dot-notation` | `"off"` |
| `no-implied-eval` | `"off"` |
| `no-shadow` | `"off"` |
| `no-unused-vars` | `"off"` |
| `no-use-before-define` | `"off"` |
| `@typescript-eslint/consistent-type-exports` | `"error"` |
| `@typescript-eslint/consistent-type-imports` | `["error",{"fixStyle":"separate-type-imports"}]` |
| `@typescript-eslint/default-param-last` | `"error"` |
| `@typescript-eslint/dot-notation` | `"error"` |
| `@typescript-eslint/method-signature-style` | `["error","property"]` |
| `@typescript-eslint/no-confusing-void-expression` | `"error"` |
| `@typescript-eslint/no-explicit-any` | `"error"` |
| `@typescript-eslint/no-import-type-side-effects` | `"error"` |
| `@typescript-eslint/no-non-null-assertion` | `"error"` |
| `@typescript-eslint/no-shadow` | `"error"` |
| `@typescript-eslint/no-unnecessary-condition` | `"error"` |
| `@typescript-eslint/no-unnecessary-type-arguments` | `"error"` |
| `@typescript-eslint/no-unused-vars` | `["error",{"args":"all","argsIgnorePattern":"^_","caughtErrors":"all","caughtErrorsIgnorePattern":"^_","ignoreRestSiblings":true}]` |
| `@typescript-eslint/no-use-before-define` | `["error",{"functions":false}]` |
| `@typescript-eslint/prefer-nullish-coalescing` | `"error"` |
| `@typescript-eslint/prefer-optional-chain` | `"error"` |
| `@typescript-eslint/prefer-readonly` | `"error"` |
| `@typescript-eslint/strict-boolean-expressions` | `["error",{"allowString":false,"allowNumber":false}]` |
| `@typescript-eslint/switch-exhaustiveness-check` | `"error"` |

### expotrack/react-source

| Regola | Configurazione |
|---|---|
| `no-console` | `["error",{"allow":["warn","error"]}]` |
| `react/jsx-boolean-value` | `["error","never"]` |
| `react/jsx-no-useless-fragment` | `"error"` |
| `react/self-closing-comp` | `"error"` |
| `@stylistic/jsx-closing-bracket-location` | `["error","line-aligned"]` |
| `@stylistic/jsx-closing-tag-location` | `"error"` |
| `@stylistic/jsx-curly-brace-presence` | `["error",{"props":"never","children":"never"}]` |
| `@stylistic/jsx-curly-spacing` | `["error","never"]` |
| `@stylistic/jsx-equals-spacing` | `["error","never"]` |
| `@stylistic/jsx-first-prop-new-line` | `["error","multiline"]` |
| `@stylistic/jsx-indent-props` | `["error",2]` |
| `@stylistic/jsx-max-props-per-line` | `["error",{"maximum":1}]` |
| `@stylistic/jsx-quotes` | `["error","prefer-double"]` |
| `@stylistic/jsx-tag-spacing` | `["error",{"beforeSelfClosing":"always"}]` |
| `@stylistic/jsx-wrap-multilines` | `["error",{"declaration":"parens-new-line","assignment":"parens-new-line","return":"parens-new-line","arrow":"parens-new-line","condition":"parens-new-line","logical":"parens-new-line","prop":"parens-new-line"}]` |
