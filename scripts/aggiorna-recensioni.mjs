// Scarica dalla scheda Google del Lido (Places API (New) di Google Maps Platform) la valutazione media, il numero
// totale di recensioni e le recensioni che Google espone (al massimo 5 per lingua, le più rilevanti), sceglie le 3 da
// mettere in evidenza e scrive recensioni.json. Stessa logica di hostinger/recensioni-lib.php.
//
// Variabili d'ambiente:
//   GOOGLE_PLACES_API_KEY   chiave API (obbligatoria; nel repository: Settings > Secrets and variables > Actions)
//   GOOGLE_PLACE_ID         Place ID della scheda; se manca vale quello di data/restaurant.json
//   PLACES_FIXTURE, PLACES_FIXTURE_EN, RECENSIONI_ADESSO, RECENSIONI_USCITA   solo per i test (risposte salvate, data fissa, file di uscita)
//
// Uso: node scripts/aggiorna-recensioni.mjs   (esce con 0 anche se la chiave manca: scrive solo un avviso)

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const RADICE = new URL("../", import.meta.url);
const USCITA = process.env.RECENSIONI_USCITA ? pathToFileURL(process.env.RECENSIONI_USCITA) : new URL("recensioni.json", RADICE);
const FILE_ESCLUSE = new URL("recensioni-escluse.txt", RADICE);
const RISTORANTE = JSON.parse(readFileSync(new URL("data/restaurant.json", RADICE), "utf8"));

const CAMPI = "id,displayName,rating,userRatingCount,reviews,googleMapsUri";
const LINGUE = ["it", "en"]; // la prima è la principale (voto, conteggio, testi in italiano); le altre aggiungono le recensioni scritte in quella lingua
const MASSIMO_TUTTE = 10;
const ETA_MASSIMA_GIORNI = 730; // recensioni più vecchie di due anni non entrano (legge 11 marzo 2026, n. 34)
const TESTO_MIN_FILE = 20;      // recensioni più corte non entrano nel file
const TESTO_MIN = 40;           // recensioni più corte non vengono messe in evidenza
const VALUTAZIONE_MIN = RISTORANTE.recensioni.stelleMinime;
// Parole che, anche in una recensione a 5 stelle, non vogliamo in evidenza: la recensione viene lasciata fuori.
const PAROLE_ESCLUSE = ["rubbish", "terrible", "awful", "horrible", "disgusting", "worst", "rude", "dirty", "overpriced", "rip off", "rip-off", "scam", "avoid", "never again", "disappoint", "unfriendly",
  "pessim", "orribil", "terribil", "schifo", "maleducat", "sporc", "delus", "scaden", "sconsigli", "mai più", "mai piu", "da evitare", "fregatura", "vergogn"];
// Una recensione in evidenza per ciascun tema, in quest'ordine.
const CATEGORIE = [
  { id: "lavoro", parole: ["lavoro", "pausa", "veloc", "rapid", "servizio", "cortes", "gentil", "tempi", "puntual", "personale", "attent", "professional"] },
  { id: "viaggio", parole: ["viaggio", "passaggio", "famiglia", "bambin", "figli", "vacanz", "sosta", "strada", "domiziana", "torner", "fermat", "tappa"] },
  { id: "cibo", parole: ["lupin", "spaghett", "pesce", "fritt", "cucina", "piatt", "buon", "mangiat", "fresc", "qualit", "porzion", "ottim", "delizios"] },
];

const chiave = process.env.GOOGLE_PLACES_API_KEY || "";
const fixture = process.env.PLACES_FIXTURE || "";
const placeId = process.env.GOOGLE_PLACE_ID || RISTORANTE.google.placeId;

async function chiama(url, campi) {
  const risposta = await fetch(url, { headers: { "X-Goog-Api-Key": chiave, "X-Goog-FieldMask": campi } });
  const testo = await risposta.text();
  if (!risposta.ok) throw new Error(`Places API ${risposta.status}: ${testo.slice(0, 300)}`);
  return JSON.parse(testo);
}

async function dettagli(lingua) {
  if (fixture) {
    const file = lingua === LINGUE[0] ? fixture : process.env[`PLACES_FIXTURE_${lingua.toUpperCase()}`];
    return file ? JSON.parse(readFileSync(file, "utf8")) : { reviews: [] };
  }
  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=${lingua}&regionCode=IT`;
  return chiama(url, lingua === LINGUE[0] ? CAMPI : "reviews");
}

// Tempo trascorso in italiano ("3 settimane fa"), uguale per tutte le lingue.
function quandoItaliano(publishTime, adesso) {
  const t = Date.parse(publishTime || "");
  if (!t) return "";
  const giorni = Math.max(0, Math.floor((adesso - t) / 86400000));
  if (giorni < 1) return "oggi";
  if (giorni === 1) return "ieri";
  if (giorni < 7) return `${giorni} giorni fa`;
  const settimane = Math.floor(giorni / 7);
  if (giorni < 30) return settimane === 1 ? "una settimana fa" : `${settimane} settimane fa`;
  const mesi = Math.floor(giorni / 30.44);
  if (giorni < 365) return mesi <= 1 ? "un mese fa" : `${mesi} mesi fa`;
  const anni = Math.floor(giorni / 365.25);
  return anni <= 1 ? "un anno fa" : `${anni} anni fa`;
}

function punteggio(testo, parole) {
  const t = testo.toLowerCase();
  return parole.reduce((n, p) => n + (t.includes(p) ? 1 : 0), 0);
}

function scegli(recensioni) {
  const valide = recensioni.filter((r) => r.testo.length >= TESTO_MIN);
  const usate = new Set();
  const scelte = [];
  for (const categoria of CATEGORIE) {
    let migliore = null, max = 0;
    for (const r of valide) {
      if (usate.has(r)) continue;
      const s = punteggio(r.testo, categoria.parole);
      if (s > max) { max = s; migliore = r; }
    }
    if (migliore) { usate.add(migliore); scelte.push({ ...migliore, categoria: categoria.id }); }
  }
  const italiana = (r) => (r.lingua === LINGUE[0] ? 1 : 0);
  for (const r of [...valide].sort((a, b) => italiana(b) - italiana(a) || b.valutazione - a.valutazione || b.data.localeCompare(a.data))) {
    if (scelte.length >= 3) break;
    if (!usate.has(r)) { usate.add(r); scelte.push({ ...r, categoria: "altro" }); }
  }
  return scelte;
}

// Identità di una recensione: il suo link su Google (uno per recensione), altrimenti autore e testo.
function chiaveRecensione(r) {
  return r.link && r.link.includes("/reviews/") ? r.link : `${r.autore}|${r.testo}`;
}

function escluseManuali() {
  if (!existsSync(FILE_ESCLUSE)) return [];
  return readFileSync(FILE_ESCLUSE, "utf8").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#")).map((l) => l.toLowerCase());
}
function daEscludere(r, manuali) {
  const t = r.testo.toLowerCase();
  if (PAROLE_ESCLUSE.some((p) => t.includes(p))) return true;
  const autore = r.autore.toLowerCase(), link = r.link.toLowerCase();
  return manuali.some((m) => autore === m || (link && link.includes(m)));
}

// Attribuzione come la fornisce Google (nome pubblico scelto dall'autore, link al profilo, link alla recensione, link per
// segnalare): le condizioni di Google Maps Platform non permettono di modificarla. Il testo è quello originale e integrale
// dell'autore, mai la traduzione automatica di Google. La data è conservata con precisione al giorno (minimizzazione).
function normalizza(dati, extra, adesso) {
  const converti = (r, lingua) => ({
    autore: String(r.authorAttribution?.displayName || "Utente Google").trim(),
    autoreLink: r.authorAttribution?.uri || "",
    valutazione: Number(r.rating) || 0,
    testo: String(r.originalText?.text || r.text?.text || "").replace(/\s+/g, " ").trim(),
    quando: quandoItaliano(r.publishTime, adesso),
    data: String(r.publishTime || "").slice(0, 10),
    link: r.googleMapsUri || dati.googleMapsUri || "",
    segnala: r.flagContentUri || "",
    lingua,
  });
  const scaricate = [];
  const presenti = new Set();
  const aggiungi = (r, lingua) => {
    const c = converti(r, lingua);
    if (!c.testo || presenti.has(chiaveRecensione(c))) return;
    presenti.add(chiaveRecensione(c));
    scaricate.push(c);
  };
  // Per ogni lingua solo le recensioni scritte davvero in quella lingua: le altre arriverebbero tradotte da Google.
  for (const r of dati.reviews || []) {
    if (!r.originalText?.languageCode || r.originalText.languageCode === LINGUE[0]) aggiungi(r, LINGUE[0]);
  }
  for (const { lingua, reviews } of extra) {
    for (const r of reviews) if (r.originalText?.languageCode === lingua) aggiungi(r, lingua);
  }
  const manuali = escluseManuali();
  // Nel file restano solo le recensioni che la pagina può mostrare (minimizzazione, art. 5.1.c GDPR).
  const tutte = scaricate
    .filter((r) => r.valutazione >= VALUTAZIONE_MIN && r.testo.length >= TESTO_MIN_FILE)
    .filter((r) => !r.data || adesso - Date.parse(r.data) <= ETA_MASSIMA_GIORNI * 86400000)
    .filter((r) => !daEscludere(r, manuali))
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, MASSIMO_TUTTE);
  return {
    aggiornato: new Date(adesso).toISOString(),
    placeId: dati.id || placeId,
    nome: dati.displayName?.text || "",
    googleMapsUri: dati.googleMapsUri || "",
    valutazione: typeof dati.rating === "number" ? dati.rating : null,
    numeroRecensioni: typeof dati.userRatingCount === "number" ? dati.userRatingCount : null,
    scelte: scegli(tutte),
    tutte,
  };
}

function senzaData(o) { const c = { ...o }; delete c.aggiornato; return JSON.stringify(c); }

if (!chiave && !fixture) {
  console.log("::warning::GOOGLE_PLACES_API_KEY non impostata: recensioni.json non viene aggiornato (README, sezione Recensioni).");
  process.exit(0);
}

const precedente = existsSync(USCITA) ? JSON.parse(readFileSync(USCITA, "utf8")) : null;
const adesso = Date.parse(process.env.RECENSIONI_ADESSO || "") || Date.now();
const base = await dettagli(LINGUE[0]);
const extra = [];
for (const lingua of LINGUE.slice(1)) extra.push({ lingua, reviews: (await dettagli(lingua)).reviews || [] });
const nuovo = normalizza(base, extra, adesso);
if (precedente && senzaData(precedente) === senzaData(nuovo)) {
  console.log(`Nessuna novità: ${nuovo.valutazione} su Google, ${nuovo.numeroRecensioni} recensioni, ${nuovo.scelte.length} in evidenza.`);
  process.exit(0);
}
writeFileSync(USCITA, JSON.stringify(nuovo, null, 2) + "\n");
console.log(`Aggiornato recensioni.json: ${nuovo.valutazione} su Google, ${nuovo.numeroRecensioni} recensioni, ${nuovo.scelte.length} in evidenza (${nuovo.scelte.map((r) => r.categoria).join(", ")}).`);
