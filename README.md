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
  recensioni.json valutazione, numero di recensioni e recensioni della scheda Google (aggiornato in automatico)
  scripts/        lo script che scarica le recensioni da Google
  .github/        i due automatismi: pubblicazione su GitHub Pages e aggiornamento delle recensioni
  .nojekyll       serve solo a GitHub Pages (dice di pubblicare i file cosi' come sono)

COME SI PUBBLICA
  Opzione 1 - GitHub Pages (gratis, senza hosting): Settings > Pages > Source "Deploy from a branch",
    branch main, cartella "/ (root)". La pagina sara' su https://NOMEUTENTE.github.io/landing-domiziana/
    e si puo' collegare a un dominio proprio dalla stessa schermata.
  Opzione 2 - Qualsiasi hosting (Hostinger, Vercel, ...): carica il contenuto del repository,
    cosi' com'e', dove vuoi che stia la pagina: nella radice di un dominio dedicato (public_html/)
    oppure in una sottocartella (es. public_html/domiziana/). Nessuna configurazione da fare.

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
  Il blocco "La prova" (voto, numero di recensioni e tre recensioni) si aggiorna da solo dalla scheda
  Google del Lido: ogni lunedi' mattina (7:23 ora italiana d'estate, 6:23 d'inverno) un automatismo
  (Actions > "Aggiorna le recensioni Google", lanciabile anche a mano in qualsiasi momento) interroga
  l'API ufficiale di Google Maps Platform (Places API), scrive recensioni.json e ripubblica la pagina.
  Google espone al massimo 5 recensioni per scheda (le piu' rilevanti): lo script ne sceglie 3, con
  almeno 4 stelle, una per categoria del documento (lavoro/servizio, viaggio/famiglia, cibo), copiate
  parola per parola; oltre i 320 caratteri il testo viene accorciato e compare il link "Leggi tutto"
  verso la recensione su Google. I nomi vengono abbreviati a nome e iniziale (es. "Marco R.").
  Finche' l'automatismo non e' configurato, nella pagina restano i tre segnaposto.

  Per attivarlo, una volta sola:
  1. Su https://console.cloud.google.com crea un progetto, attiva "Places API (New)" e la fatturazione
     (obbligatoria per Google Maps Platform; la quota gratuita mensile copre ampiamente le 4 o 5
     chiamate al mese di questo automatismo; imposta comunque un avviso di budget).
  2. Crea una chiave API (APIs & Services > Credentials) limitata alla sola "Places API (New)".
  3. Nel repository: Settings > Secrets and variables > Actions.
       Secrets   -> GOOGLE_PLACES_API_KEY = la chiave
       Variables -> GOOGLE_PLACE_ID = il Place ID della scheda del Lido
                    (si trova con https://developers.google.com/maps/documentation/places/web-service/place-id)
                    In alternativa GOOGLE_PLACE_QUERY = "Lido Pino d'Oro <comune>": lo script cerca la scheda
                    e stampa il Place ID nel log, da salvare poi in GOOGLE_PLACE_ID.
  4. Actions > "Aggiorna le recensioni Google" > Run workflow: se tutto e' a posto, in un minuto la pagina
     mostra le recensioni vere. Da li' in poi va da solo.
  Il Place ID trovato viene usato anche da "Portami li'" e "Leggi tutte le recensioni su Google",
  se CONFIG.googlePlaceId in index.html e' vuoto.

GOOGLE ADS
  Crea cinque conversioni (Portami li', Chiama, WhatsApp Lavoro, WhatsApp Sosta, WhatsApp generico),
  copia l'ID del tag (AW-...) e le cinque etichette nel blocco CONFIG. Il tag si carica solo se
  l'ID e' presente, in modo asincrono, per restare sotto i 2 secondi.

MISURAZIONE (foglio 4-MARKETING)
  - Parole chiave WhatsApp: DOMIZIANA LAVORO, DOMIZIANA SOSTA, DOMIZIANA (accanto a PRANZO e DOMENICA).
  - Al tavolo: "Come ci hai trovato?", con l'opzione "Google".
  - Ogni lunedi': spesa della campagna, indicazioni stradali, chiamate, clic WhatsApp, costo per azione.
```
