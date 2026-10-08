<?php
// Impostazioni per l'aggiornamento delle recensioni su hosting PHP (Hostinger).
// Copia questo file in config.php nella stessa cartella e compila i valori.
// config.php viene eseguito da PHP e non stampa nulla: la chiave non e' mai visibile ai visitatori.
// Non caricare mai config.php su GitHub (e' gia' escluso da .gitignore).
return [
    'api_key' => 'AIza...',                          // chiave di Google Maps Platform, limitata a "Places API (New)"
    // 'place_id' => 'ChIJcV_Xya3fOhMRWT5u9UL0X08', // scheda "Ristorante Pino D'Oro", Mondragone (predefinita nello script)
    'token' => 'scegli-una-frase-lunga-e-segreta',   // per lanciare l'aggiornamento dal browser: aggiorna-recensioni.php?token=...
];
