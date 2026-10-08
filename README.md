# Landing "Pranzo sulla Domiziana" - Lido Pino d'Oro

```
Pagina autonoma per la campagna Google Performance Max (obiettivo: visite al locale).
Non dipende dal sito principale: nessun backend, nessun widget, nessun database.
Si carica cosi' com'e' su qualsiasi spazio web.

COSA C'E' IN QUESTO REPOSITORY
  index.html      la pagina (testi, stile e script sono tutti dentro questo file)
  logo.png        il logo
  foto/           qui vanno le due foto (vedi sotto)
  README.md       questo file
  scripts/        lo script che scarica le recensioni da Google e scrive recensioni.json (versione per GitHub Actions)
  recensioni.php, recensioni-lib.php, aggiorna-recensioni.php   lo stesso aggiornamento in PHP, per Hostinger
                  (vedi "SU HOSTINGER")
  recensioni-escluse.txt    autori o recensioni da non mostrare, su loro richiesta
  config.example.php        modello del file con la chiave, solo per Hostinger
  .htaccess       regole di protezione per Hostinger (GitHub Pages le ignora)
  .github/        gli automatismi: pubblicazione su GitHub Pages, aggiornamento delle recensioni, caricamento FTP facoltativo
  .nojekyll       serve solo a GitHub Pages (dice di pubblicare i file cosi' come sono)

COME SI PUBBLICA
  Opzione 1 - GitHub Pages (gratis, senza hosting): Settings > Pages > Source "GitHub Actions".
    A ogni push su main l'automatismo "Pubblica su GitHub Pages" scarica le recensioni e pubblica.
    La pagina sara' su https://NOMEUTENTE.github.io/landing-domiziana/ e si puo' collegare a un dominio
    proprio dalla stessa schermata.
  Opzione 2 - Hostinger (o altro hosting con PHP): carica il contenuto del repository, cosi' com'e',
    dove vuoi che stia la pagina: nella radice di un dominio dedicato (public_html/) oppure in una
    sottocartella (es. public_html/domiziana/). La pagina funziona subito; per le recensioni
    automatiche segui la sezione "SU HOSTINGER" qui sotto.

INDIRIZZI DA METTERE NEGLI ANNUNCI
  Gruppo 1 - Pranzo di lavoro:       https://TUODOMINIO/?g=lavoro
  Gruppo 2 - Sosta sulla Domiziana:  https://TUODOMINIO/?g=sosta
  (in una sottocartella: https://TUODOMINIO/domiziana/?g=lavoro e https://TUODOMINIO/domiziana/?g=sosta)
  Il parametro cambia il titolo, mette per prima la scheda giusta e viene allegato a ogni conversione.

PULSANTI
  Chiama e WhatsApp usano gia' il numero 388 787 7008.
  I messaggi WhatsApp sono precompilati e diversi per pulsante, per capire da dove arriva il cliente:
    scheda "pausa pranzo"   DOMIZIANA LAVORO - arrivo tra 10 minuti, siamo in [ ]
    scheda "in viaggio"     DOMIZIANA SOSTA - arriviamo tra 10 minuti, siamo in [ ] (bambini: [ ])
    pulsanti generici       DOMIZIANA - arrivo tra 10 minuti, siamo in [ ]
  "Portami li'" apre Google Maps sulla scheda del Lido (con il Place ID atterra esattamente sulla scheda).

COSA COMPLETARE PRIMA DI ANDARE ONLINE
  Apri index.html con un editor di testo.
  1. In cima al file: l'elenco dei dati da completare, con la posizione di ciascuno.
  2. In fondo al file, blocco CONFIG: orario del pranzo, Place ID della scheda Google,
     ID Google Ads ed etichette di conversione.
  3. Nel testo, i dati mancanti sono tra parentesi quadre dentro <span class="dc">...</span>
     (in giallo oro sulla pagina): sostituisci il testo e togli lo span.

FOTO
  Nella cartella foto/, ogni foto in due larghezze (-1200.jpg per desktop, -720.jpg per telefono):
    tavolo-spiaggia-*.jpg    in alto: il tavolo apparecchiato sulla sabbia
    tavolo-terrazza-*.jpg    blocco 3, provvisoria: al suo posto va lo Spaghetto ai Lupini visto dall'alto
                             (salvarlo come spaghetto-ai-lupini-1200.jpg e -720.jpg, poi cambiare src, srcset,
                             alt e didascalia del blocco 3 in index.html)
    terrazza-mare-*.jpg e terrazza-pergola-*.jpg   striscia "La terrazza" sotto il blocco 3
  Facoltativa: uno scatto invernale del tavolo sulla spiaggia al posto di tavolo-spiaggia.
  Se un file manca, al suo posto compare una cornice dorata con la didascalia.

RECENSIONI GOOGLE AUTOMATICHE
  Voto medio, numero di recensioni e quattro recensioni (tre in riga e una in evidenza piu' in basso,
  accanto a "E se la prossima recensione fosse la tua?") arrivano dalla scheda Google del Lido tramite
  l'API ufficiale di Google Maps Platform (Places API (New)), con la chiave di Google Maps. La pagina le
  legge da recensioni.json, che non sta nel repository: lo genera chi pubblica.
    - GitHub Pages: a ogni pubblicazione e ogni giorno alle 7:23 ora italiana d'estate (6:23 d'inverno),
      con Actions > "Aggiorna le recensioni Google" (lanciabile anche a mano in qualsiasi momento).
    - Hostinger: recensioni.php, quando il file ha piu' di un giorno (vedi "SU HOSTINGER").
  Google espone al massimo 5 recensioni per lingua (le piu' pertinenti, in italiano e in inglese).
  Entrano solo quelle con almeno 4 stelle, pubblicate da meno di due anni, senza le parole di critica
  dell'elenco PAROLE_ESCLUSE (controllo automatico: puo' togliere anche frasi positive come "non ci ha
  mai delusi") e non presenti in recensioni-escluse.txt. In riga va una recensione per tema (servizio,
  viaggio, cibo); in evidenza la piu' recente tra le altre con almeno 40 caratteri. Testi integrali e
  nomi come li mostra Google, con i link al profilo dell'autore, alla recensione e per segnalarla.
  Nel file finiscono solo le recensioni mostrate.
  Senza dati (chiave mancante, Google non raggiungibile) voto e recensioni restano nascosti e si vede
  solo il link alle recensioni su Google Maps: niente segnaposto, niente voti inventati.
  Se un autore chiede di non comparire: scrivere il suo nome, o il link della recensione, in una riga di
  recensioni-escluse.txt. La recensione sparisce al successivo aggiornamento.

  Per attivarlo su GitHub, una volta sola:
  1. Su https://console.cloud.google.com crea un progetto, attiva "Places API (New)" e la fatturazione
     (obbligatoria per Google Maps Platform; la quota gratuita mensile copre ampiamente le poche chiamate
     al giorno di questo automatismo; imposta comunque un avviso di budget).
  2. Crea una chiave API (APIs & Services > Credentials) limitata alla sola "Places API (New)".
     Non limitarla ai siti (referrer HTTP): la usano solo GitHub e Hostinger, mai il browser.
  3. Nel repository: Settings > Secrets and variables > Actions > Secrets:
       GOOGLE_PLACES_API_KEY = la chiave
     Il Place ID della scheda e' gia' in data/restaurant.json (google.placeId). La variabile
     GOOGLE_PLACE_ID serve solo per usare un'altra scheda.
  4. Actions > "Aggiorna le recensioni Google" > Run workflow: in un minuto la pagina mostra le recensioni.
     Da li' in poi va da solo. Se Google non risponde, la pagina si pubblica lo stesso, senza recensioni.

SU HOSTINGER
  Su Hostinger recensioni.json lo crea e lo rinnova recensioni.php, con la stessa logica dello script per
  GitHub: .htaccess fa passare da li' ogni richiesta di recensioni.json e, se il file manca o ha piu' di un
  giorno, recensioni.php lo rigenera da Google con la chiave di config.php. Se Google non risponde,
  riprova al massimo una volta l'ora e intanto serve l'ultimo file buono. Non serve nessun cron.
  1. Carica i file su Hostinger. Per averla come sottopagina del sito esistente (es. tuodominio.it/domiziana/):
       - hPanel > File Manager > public_html (la cartella del sito esistente);
       - crea una cartella con il nome che vuoi nell'indirizzo, tutto minuscolo e senza spazi (es. domiziana);
       - entra nella cartella, carica lo zip "piatto" della landing (i file senza cartella esterna) ed estrailo
         li': index.html deve trovarsi direttamente in public_html/domiziana/, non in una sottocartella;
       - attiva "Mostra file nascosti" e controlla che ci sia anche .htaccess.
     La pagina risponde su https://tuodominio.it/domiziana/ e gli annunci useranno
     https://tuodominio.it/domiziana/?g=lavoro e https://tuodominio.it/domiziana/?g=sosta.
     Servono: index.html, styles.css, logo.png, le icone (favicon*, apple-touch-icon.png), fonts/, foto/,
     icons/, privacy.html, cookie.html, legale.css, recensioni.php, recensioni-lib.php,
     aggiorna-recensioni.php, config.example.php, recensioni-escluse.txt e .htaccess.
     recensioni.json non va caricato: si crea da solo alla prima visita.
     README.md puo' restare: non e' scaricabile. Le cartelle .github, scripts, src, data, docs, test e
     hostinger servono solo a GitHub (.htaccess le nasconde comunque).
     Il sito esistente non cambia: la cartella e' indipendente, e le sue regole .htaccess valgono solo li' dentro
     (quelle del sito principale continuano a valere e non danno fastidio).
     Se il sito e' WordPress: funziona allo stesso modo. WordPress gestisce solo gli indirizzi che non
     corrispondono a file o cartelle reali, quindi public_html/domiziana/ viene servita direttamente,
     senza tema, plugin o cache di WordPress. Due accortezze: non creare in WordPress una pagina con lo
     stesso slug (es. "domiziana"), e metti la cartella nella radice del dominio (public_html, accanto a
     wp-config.php), non dentro wp-content. Il file .htaccess della landing la isola dalle regole di
     WordPress e imposta index.html come pagina di ingresso.
  2. Nel File Manager duplica config.example.php, rinomina la copia in config.php e compila:
       'api_key' => la chiave di Google Maps Platform (la stessa usata su GitHub, o una nuova);
       'token'   => una frase lunga e segreta a tua scelta.
     config.php viene eseguito da PHP e non e' mai mostrato ai visitatori; .htaccess lo blocca anche
     da download diretto. Senza config.php le recensioni non compaiono.
  3. Prova subito dal browser: https://TUODOMINIO/CARTELLA/aggiorna-recensioni.php?token=IL_TOKEN
     Risponde con una riga ("Aggiornato recensioni.json: ..." oppure "Nessuna novita': ...").
     Senza token, o con token sbagliato, risponde "Accesso negato".
  4. Ricarica la pagina: compaiono voto, numero di recensioni e le recensioni.
  5. Facoltativo: un cron giornaliero tiene il file aggiornato anche nei giorni senza visite.
     hPanel > Avanzate > Cron Job, pianificazione "Personalizzata": minuto 23, ora 7, giorno *, mese *,
     giorno della settimana *, con il comando
       php /home/UTENTE/domains/TUODOMINIO/public_html/CARTELLA/aggiorna-recensioni.php
     Il percorso esatto della cartella lo vedi in alto nel File Manager (inizia con /home/u...).

  Facoltativo - caricamento automatico da GitHub a Hostinger (per chi modifica la pagina su GitHub):
  a ogni push i workflow caricano la cartella via FTP.
  Si attiva impostando nel repository (Settings > Secrets and variables > Actions):
    Variables: HOSTINGER_FTP_HOST (es. ftp.tuodominio.it), HOSTINGER_FTP_DIR (es. public_html/domiziana/,
               con la barra finale), HOSTINGER_FTP_PROTOCOL (ftps; mettere ftp solo se ftps non funziona)
    Secrets:   HOSTINGER_FTP_USER, HOSTINGER_FTP_PASSWORD (hPanel > File > Account FTP)
  Il caricamento FTP non porta recensioni.json e non tocca config.php: su Hostinger le recensioni le
  rinnova recensioni.php, quindi config.php con la chiave va creato comunque (passo 2).
  Senza queste impostazioni il caricamento FTP non parte e non da' errori.

GOOGLE ADS
  Crea cinque conversioni (Portami li', Chiama, WhatsApp Lavoro, WhatsApp Sosta, WhatsApp generico),
  copia l'ID del tag (AW-...) e le cinque etichette nel blocco CONFIG. Il tag si carica solo se
  l'ID e' presente, in modo asincrono, per restare sotto i 2 secondi.

MISURAZIONE (foglio 4-MARKETING)
  - Parole chiave WhatsApp: DOMIZIANA LAVORO, DOMIZIANA SOSTA, DOMIZIANA (accanto a PRANZO e DOMENICA).
  - Al tavolo: "Come ci hai trovato?", con l'opzione "Google".
  - Ogni lunedi': spesa della campagna, indicazioni stradali, chiamate, clic WhatsApp, costo per azione.
```
