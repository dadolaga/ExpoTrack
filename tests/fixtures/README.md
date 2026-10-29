# Fixture del catalogo

`catalog/` contiene una piccola configurazione fittizia, inizialmente uguale al demo
dello step 04 ma indipendente dai dati in `config/`. I test copiano questa fixture
in directory temporanee: nessun dato di sviluppo o produzione viene modificato
né acquisito dalle suite. Aggiornare il catalogo reale non deve cambiare il
significato dei casi di test.

Nomi e testi sono illustrativi. Gli ID servono ai riferimenti dei casi positivi e
negativi; rinominare le etichette non richiede di cambiare le asserzioni.
