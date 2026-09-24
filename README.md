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
  Due file JPEG o WebP, larghezza 1200 px, sotto i 150 KB ciascuno, con questi nomi esatti:
    foto/tavolo-spiaggia-inverno.jpg    in alto: il tavolo apparecchiato sulla spiaggia d'inverno
    foto/spaghetto-ai-lupini.jpg        blocco 3: lo Spaghetto ai Lupini visto dall'alto, luce naturale
  Finche' mancano, al loro posto compare una cornice dorata con la didascalia.

GOOGLE ADS
  Crea cinque conversioni (Portami li', Chiama, WhatsApp Lavoro, WhatsApp Sosta, WhatsApp generico),
  copia l'ID del tag (AW-...) e le cinque etichette nel blocco CONFIG. Il tag si carica solo se
  l'ID e' presente, in modo asincrono, per restare sotto i 2 secondi.

MISURAZIONE (foglio 4-MARKETING)
  - Parole chiave WhatsApp: DOMIZIANA LAVORO, DOMIZIANA SOSTA, DOMIZIANA (accanto a PRANZO e DOMENICA).
  - Al tavolo: "Come ci hai trovato?", con l'opzione "Google".
  - Ogni lunedi': spesa della campagna, indicazioni stradali, chiamate, clic WhatsApp, costo per azione.
```
