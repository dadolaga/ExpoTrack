# Marchio ExpoTrack

`expotrack-icon.png` è una copia senza modifiche del PNG esistente
`docs/mockups/Logo vettoriale ExpoTrack (1).png`. Il nome del file originale non
ne cambia il formato: resta un’immagine raster con fondo chiaro e wordmark.

La pagina di selezione usa `next/image` con dimensioni esplicite e caricamento diretto. Non richiede CDN o font esterni. Nessun logo è stato generato o ritagliato
dalle tavole dei telefoni.


Nello step 20 `pwa-192.png`, `pwa-512.png` e `apple-touch-icon.png` (180 px)
sono state derivate dallo stesso marchio con Sharp, mantenendo proporzioni e
sfondo bianco. Manifest e metadati Apple le usano per l’installabilità; la shell
le conserva insieme al marchio. Il caricamento diretto evita richieste di
ottimizzazione immagini non disponibili offline.
