# Decisioni

Il "perché" delle scelte non ovvie di questo repository. Nel codice pubblicato restano solo i commenti che spiegano una riga; tutto il resto sta qui.

## Struttura

- **Pagina generata da `data/` e `src/`.** Prezzi, orari, contatti e dati del titolare stanno solo in `data/restaurant.json` e `data/menu.json`; `scripts/costruisci.mjs` li inserisce nei modelli HTML di `src/` e produce `_sito/`, l'unica cartella da pubblicare. Così un prezzo si cambia in un punto e compare uguale nella landing, nei termini e nel JSON-LD. Il motore dei modelli è volutamente minimo (`{{chiave}}` con escape, `{{{chiave}}}` HTML): niente dipendenze.
- **`_sito/` non è versionata.** Viene costruita dai workflow a ogni pubblicazione, insieme a `recensioni.json`, che non deve restare nella cronologia pubblica di git (contiene nomi di persone e testi di Google che le condizioni di Google Maps Platform non permettono di conservare).
- **Dati del titolare `null` = da avere, `""` = non applicabile.** Un campo `null` compare nelle pagine come `TODO(titolare): …` evidenziato, e il comando di costruzione lo elenca; un campo vuoto fa sparire la riga (per esempio il Registro delle imprese per una ditta individuale). Una pagina con segnaposto visibili non va messa negli annunci: sarebbe un'omissione informativa (art. 22 Codice del consumo).
- **I file PHP stanno in `hostinger/`** e vengono copiati nella radice del sito solo con `--hostinger`: su GitHub Pages non servono e non devono comparire. `config.php` (con la chiave di Google) non è mai nel repository né nella cartella costruita: lo si crea a mano sul server.
- **Il Place ID e le stelle minime sono anche costanti nel PHP** perché su Hostinger non c'è `data/`; un test verifica che coincidano con `data/restaurant.json`.

## Contenuti

- **Recensioni integrali.** Gli script non accorciano più i testi: la pagina mostra la recensione per intero (ripiegata oltre 8 righe, con "Mostra tutto"), come chiede la regola "copiate integralmente". Restano attribuzione, link alla recensione, al profilo e per segnalare, come richiesto dalle condizioni di Google Maps Platform.
- **Selezione automatica con criteri fissi** (stelle minime, lunghezza, lingua, parole escluse, due anni, esclusioni su richiesta) dichiarata nella pagina e nei termini: lo chiedono il Codice del consumo (art. 22, comma 5-bis) e la legge 11 marzo 2026, n. 34. Senza dati la sezione mostra solo il link alla scheda: mai recensioni o stelle finte.
- **Nessuna statistica decorativa.** La frase "lo ordina un cliente su quattro" è stata tolta perché non verificabile; "Natale e Ferragosto compresi" idem. Gli orari della FAQ sono generati da `data/`.
- **Tempi di servizio come impegno, non garanzia.** "Ti serviamo in 30 minuti" senza "garantito": una garanzia richiede condizioni e rimedio scritti (termini, punto 4).
- **Foto provvisoria nel blocco "La cucina".** Al posto dello Spaghetto ai Lupini c'è il tavolo sulla terrazza finché il titolare non fornisce lo scatto (vedi `docs/voce.md`).

## Codice

- **Un solo `try/catch`, su `localStorage`.** L'accesso può lanciare un'eccezione quando il browser blocca l'archiviazione (navigazione privata, cookie disattivati); l'eccezione viene gestita in un unico punto (`memoria` in `pagina.js` e lo script nell'head) e la pagina funziona senza memoria.
- **La data si rinnova con un timer alla mezzanotte di Roma**, non con un controllo ogni minuto: la pagina può restare aperta sul telefono oltre la mezzanotte e "Oggi" deve cambiare.
- **Link di WhatsApp, Maps e telefono scritti nell'HTML al momento della costruzione**, non dal JavaScript: funzionano anche senza script e sono leggibili dai motori.
- **Consent Mode parte con tutto negato** e passa a "misurazione concessa" solo dopo "Accetta"; prima del consenso il tag di Google non viene nemmeno caricato. Il banner ha "Accetta" e "Rifiuta" identici, la X e il tasto Esc equivalgono a rifiutare, la scelta dura 6 mesi, la revoca cancella i cookie `_gcl_*` e ricarica la pagina (Linee guida del Garante del 10 giugno 2021).
- **Barra dei pulsanti fissa senza sfondo, con sfondo e sfocatura su un figlio.** Safari 26 (Liquid Glass) tinge la propria barra leggendo lo sfondo degli elementi fissi ai bordi e sbaglia con uno sfondo semitrasparente. Con `viewport-fit=cover` la pagina arriva ai bordi e usa `env(safe-area-inset-*)`.
- **Durante la transizione del tema la sfocatura della barra viene sospesa**: con `backdrop-filter` attivo l'animazione del cerchio scendeva a 30 fotogrammi al secondo.
- **La giostra delle recensioni si ferma** con il mouse sopra (solo puntatore vero: sui telefoni un tocco simula `mouseenter` ma non `mouseleave`), per 15 secondi dopo che l'utente l'ha sfogliata, con il fuoco da tastiera, con il pulsante "Ferma" e con la scheda nascosta. Con "riduci animazioni" scorre lo stesso ma senza animazione.
- **Immagini solo WebP**, con dimensioni esplicite; i loghi sono ridotti a 300 px perché vengono mostrati alti al massimo 76 px.

## Pubblicazione

- **GitHub Pages è un'anteprima; per gli annunci a pagamento si usa la copia su Hostinger** (i termini di GitHub Pages non sono pensati per siti commerciali).
- **Su Hostinger le recensioni si rinnovano alla prima visita dopo 24 ore** tramite `recensioni.php` (regola in `.htaccess`), con un lucchetto e un tentativo al massimo ogni ora se Google non risponde; il cron di hPanel è facoltativo.
- **Le icone si richiamano con `?v=N`** in `index.html`, `privacy.html` e `cookie.html` (e nei modelli di `src/`): i browser tengono a lungo la favicon in una cache propria, quindi quando si cambiano i file si aumenta N in tutte le pagine (un test controlla che coincidano). Nelle misure da scheda (16, 32 e 48 px) il filo del rombo è ridisegnato largo almeno un pixel, altrimenti sparisce; niente manifest, perché alle schede non serve.
