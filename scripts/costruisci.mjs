// Genera la cartella _sito/ (i soli file da pubblicare) dai modelli in src/ e dai dati in data/.
// I modelli usano {{chiave}} (testo, con escape HTML) e {{{chiave}}} (HTML già pronto); una chiave
// sconosciuta ferma la costruzione. Con --hostinger aggiunge i file PHP, .htaccess e recensioni-escluse.txt.
//
// Uso: node scripts/costruisci.mjs [--hostinger] [--uscita CARTELLA]

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const RADICE = fileURLToPath(new URL("..", import.meta.url));

const PAGINE = ["index.html", "termini.html", "privacy.html", "cookie.html"];
const FILE_RADICE = ["favicon.ico", "favicon-32.png", "favicon-512.png", "apple-touch-icon.png", ".nojekyll"];
const FILE_HOSTINGER = ["recensioni.php", "recensioni-lib.php", "aggiorna-recensioni.php", "config.example.php", ".htaccess"];

const GIORNI = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
const GIORNI_SCHEMA = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const NUMERI = ["zero", "uno", "due", "tre", "quattro", "cinque", "sei", "sette", "otto", "nove", "dieci"];

export function leggiDati(radice = RADICE) {
  return {
    ristorante: JSON.parse(readFileSync(join(radice, "data/restaurant.json"), "utf8")),
    menu: JSON.parse(readFileSync(join(radice, "data/menu.json"), "utf8")),
  };
}

export function escape(testo) {
  return String(testo).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function prezzo(n) {
  return "€ " + n.toFixed(2).replace(".", ",");
}

export function elenco(voci) {
  return voci.length < 2 ? voci.join("") : voci.slice(0, -1).join(", ") + " e " + voci[voci.length - 1];
}

export function dataItaliana(iso) {
  const [anno, mese, giorno] = iso.split("-").map(Number);
  return `${giorno} ${MESI[mese - 1]} ${anno}`;
}

function maiuscola(testo) {
  return testo.charAt(0).toUpperCase() + testo.slice(1);
}

// "dal lunedì al giovedì 12:00-15:00; venerdì 12:00-15:00 e 19:30-23:00; ...": giorni consecutivi con le stesse fasce vengono uniti.
export function fraseOrari(orari) {
  const gruppi = [];
  for (const g of [1, 2, 3, 4, 5, 6, 0]) {
    const fasce = orari[g].join(" e ");
    const ultimo = gruppi[gruppi.length - 1];
    if (ultimo && ultimo.fasce === fasce) ultimo.giorni.push(g);
    else gruppi.push({ fasce, giorni: [g] });
  }
  return gruppi.map(({ fasce, giorni }) => {
    const nomi = giorni.map((g) => GIORNI[g]);
    const ultimo = giorni[giorni.length - 1];
    const quando = nomi.length === 1 ? nomi[0] : nomi.length === 2 ? `${nomi[0]} e ${nomi[1]}` : `dal ${nomi[0]} ${ultimo === 0 ? "alla" : "al"} ${nomi[nomi.length - 1]}`;
    return `${quando} ${fasce}`;
  }).join("; ");
}

// Dato del titolare: null = ancora da avere (segnaposto visibile), "" = non applicabile (riga omessa).
function segnaposto(valore, descrizione) {
  return valore === null ? `<span class="dc">TODO(titolare): ${escape(descrizione)}</span>` : escape(valore);
}
function riga(valore, descrizione) {
  return valore === "" ? "" : segnaposto(valore, descrizione) + "<br>\n      ";
}

function jsonLd(r) {
  const indirizzo = { "@type": "PostalAddress", addressLocality: r.indirizzo.comune, postalCode: r.indirizzo.cap, addressRegion: r.indirizzo.provincia, addressCountry: "IT" };
  if (r.indirizzo.via) indirizzo.streetAddress = r.indirizzo.via;
  const perFasce = new Map();
  for (const g of [1, 2, 3, 4, 5, 6, 0]) {
    for (const fascia of r.orari[g]) {
      if (!perFasce.has(fascia)) perFasce.set(fascia, []);
      perFasce.get(fascia).push(GIORNI_SCHEMA[g]);
    }
  }
  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: r.nome,
    telephone: r.contatti.telefono,
    email: r.contatti.email,
    address: indirizzo,
    hasMap: linkMaps(r),
    openingHoursSpecification: [...perFasce].map(([fascia, giorni]) => {
      const [opens, closes] = fascia.split("-");
      return { "@type": "OpeningHoursSpecification", dayOfWeek: giorni, opens, closes };
    }),
  };
}

function linkMaps(r) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.nome)}&query_place_id=${encodeURIComponent(r.google.placeId)}`;
}

export function contesto({ ristorante: r, menu: m }) {
  const whatsapp = (testo) => `https://wa.me/${r.contatti.whatsapp}?text=${encodeURIComponent(testo)}`;
  const smart = m.smart, plus = m.plus;
  return {
    nome: r.nome,
    schedaGoogle: r.schedaGoogle,
    telefono: r.contatti.telefono,
    telefonoLink: "tel:" + r.contatti.telefono.replace(/[^\d+]/g, ""),
    email: r.contatti.email,
    chiRacconta: r.persone.chiRacconta,
    link: {
      lavoro: whatsapp(r.messaggiWhatsapp["whatsapp-lavoro"]),
      sosta: whatsapp(r.messaggiWhatsapp["whatsapp-sosta"]),
      generico: whatsapp(r.messaggiWhatsapp["whatsapp-generico"]),
      maps: linkMaps(r),
      recensioni: `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(r.google.placeId)}`,
    },
    indirizzo: {
      via: segnaposto(r.indirizzo.via, "via e numero civico"),
      cap: r.indirizzo.cap,
      comune: r.indirizzo.comune,
      provincia: r.indirizzo.provincia,
      distanza: r.indirizzo.distanzaDallaDomiziana,
    },
    titolare: {
      ragioneSociale: segnaposto(r.titolare.ragioneSociale, "ragione sociale, oppure nome e cognome del titolare"),
      partitaIva: segnaposto(r.titolare.partitaIva, "partita IVA"),
      rea: segnaposto(r.titolare.rea, "numero REA"),
      pec: segnaposto(r.titolare.pec, "indirizzo PEC"),
      registroImprese: riga(r.titolare.registroImprese, "solo se società: ufficio del Registro delle imprese e numero, capitale sociale (s.r.l. e s.p.a.), socio unico o liquidazione; se ditta individuale, lasciare vuoto"),
      titoliAbilitativi: riga(r.titolare.titoliAbilitativi, "se applicabile: estremi della SCIA per la somministrazione e della concessione demaniale"),
    },
    hosting: {
      dominio: segnaposto(r.hosting.dominio, "dominio della copia su Hostinger, es. tuodominio.it/domiziana/"),
      dataCenter: segnaposto(r.hosting.dataCenter, "paese del data center scelto in hPanel"),
      giorniConservazioneLog: segnaposto(r.hosting.giorniConservazioneLog === null ? null : String(r.hosting.giorniConservazioneLog), "giorni di conservazione dei registri di accesso, da hPanel o dall'assistenza Hostinger"),
    },
    sitoPrincipale: {
      dominio: segnaposto(r.sitoPrincipale.dominio, "dominio del sito principale"),
      cookiePolicy: segnaposto(r.sitoPrincipale.cookiePolicy, "collegamento alla cookie policy del sito principale"),
    },
    menu: {
      aggiornato: dataItaliana(m.aggiornato),
      smart: { nome: smart.nome, prezzo: prezzo(smart.prezzo), scelteN: NUMERI[smart.scelte.length], scelte: elenco(smart.scelte), inclusi: smart.inclusi, giorni: smart.giorni, minuti: smart.minuti },
      plus: { nome: plus.nome, prezzo: prezzo(plus.prezzo), primiN: NUMERI[plus.primi.length], primi: elenco(plus.primi), secondiN: NUMERI[plus.secondi.length], secondi: elenco(plus.secondi), inclusi: plus.inclusi, giorni: plus.giorni, minuti: plus.minuti },
      coperto: { prezzo: prezzo(m.coperto.prezzo), descrizione: m.coperto.descrizione },
      allaCarta: m.allaCarta.map((p) => `<li><span>${escape(p.nome)}</span><span>${escape(prezzo(p.prezzo))}</span></li>`).join("\n            "),
    },
    offerta: m.offerta.caffe,
    orari: { frase: maiuscola(fraseOrari(r.orari)), pranzo: r.orari[1][0] },
    recensioni: { stelleMinime: r.recensioni.stelleMinime },
    anno: new Date().getFullYear(),
    jsonLd: JSON.stringify(jsonLd(r)),
    datiPagina: JSON.stringify({ orari: r.orari, google: r.google, recensioni: r.recensioni }).replace(/</g, "\\u003c"),
  };
}

export function rendi(modello, dati) {
  return modello.replace(/\{\{\{\s*([\w.]+)\s*\}\}\}|\{\{\s*([\w.]+)\s*\}\}/g, (_, grezzo, testo) => {
    const chiave = grezzo || testo;
    const valore = chiave.split(".").reduce((o, k) => (o == null ? undefined : o[k]), dati);
    if (valore === undefined) throw new Error(`Segnaposto sconosciuto nel modello: ${chiave}`);
    return grezzo ? String(valore) : escape(valore);
  });
}

// Dati del titolare ancora null in data/restaurant.json: compaiono nelle pagine come "TODO(titolare)".
export function datiMancanti(ristorante) {
  const mancanti = [];
  const visita = (oggetto, prefisso) => {
    for (const [chiave, valore] of Object.entries(oggetto)) {
      if (valore === null) mancanti.push(prefisso + chiave);
      else if (typeof valore === "object" && !Array.isArray(valore)) visita(valore, `${prefisso}${chiave}.`);
    }
  };
  visita(ristorante, "");
  return mancanti;
}

export function costruisci({ radice = RADICE, uscita = join(RADICE, "_sito"), hostinger = false } = {}) {
  const letti = leggiDati(radice);
  const dati = contesto(letti);
  rmSync(uscita, { recursive: true, force: true });
  mkdirSync(uscita, { recursive: true });
  for (const pagina of PAGINE) {
    writeFileSync(join(uscita, pagina), rendi(readFileSync(join(radice, "src", pagina), "utf8"), dati));
  }
  cpSync(join(radice, "src/assets"), join(uscita, "assets"), { recursive: true });
  for (const f of FILE_RADICE) cpSync(join(radice, f), join(uscita, f)); // icone: le stesse della pagina pubblicata
  if (existsSync(join(radice, "recensioni.json"))) cpSync(join(radice, "recensioni.json"), join(uscita, "recensioni.json"));
  if (hostinger) {
    for (const f of FILE_HOSTINGER) cpSync(join(radice, "hostinger", f), join(uscita, f));
    cpSync(join(radice, "recensioni-escluse.txt"), join(uscita, "recensioni-escluse.txt"));
  }
  return { uscita, mancanti: datiMancanti(letti.ristorante) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argomenti = process.argv.slice(2);
  const indiceUscita = argomenti.indexOf("--uscita");
  const esito = costruisci({
    hostinger: argomenti.includes("--hostinger"),
    uscita: indiceUscita >= 0 ? argomenti[indiceUscita + 1] : undefined,
  });
  console.log(`Sito pronto in ${esito.uscita}`);
  if (esito.mancanti.length) console.log(`Dati del titolare ancora da inserire in data/restaurant.json: ${esito.mancanti.join(", ")}`);
}
