import { test, before } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { costruisci, leggiDati, prezzo, rendi } from "../scripts/costruisci.mjs";

const PAGINE = ["index.html", "termini.html", "privacy.html", "cookie.html"];
let uscita, pagine;

before(() => {
  uscita = mkdtempSync(join(tmpdir(), "sito-"));
  costruisci({ uscita, hostinger: true });
  pagine = Object.fromEntries(PAGINE.map((p) => [p, readFileSync(join(uscita, p), "utf8")]));
});

function tutti(cartella) {
  return readdirSync(cartella).flatMap((nome) => {
    const percorso = join(cartella, nome);
    return statSync(percorso).isDirectory() ? tutti(percorso) : [percorso];
  });
}

test("il motore dei modelli fa l'escape e rifiuta le chiavi sconosciute", () => {
  assert.equal(rendi("<b>{{a.b}}</b> {{{c}}}", { a: { b: "d'<oro>" }, c: "<i>x</i>" }), "<b>d&#39;&lt;oro&gt;</b> <i>x</i>");
  assert.throws(() => rendi("{{manca}}", {}), /manca/);
});

test("nessun segnaposto, commento HTML o codice di debug nei file pubblicati", () => {
  for (const [nome, html] of Object.entries(pagine)) {
    assert.ok(!html.includes("{{"), `${nome}: segnaposto non sostituito`);
    assert.ok(!html.includes("<!--"), `${nome}: commento HTML`);
  }
  for (const file of tutti(uscita).filter((f) => /\.(js|html|css|php)$/.test(f))) {
    const testo = readFileSync(file, "utf8");
    assert.ok(!/console\.\w+\(/.test(testo), `${file}: console.*`);
    assert.ok(!/\bdebugger\b/.test(testo), `${file}: debugger`);
    assert.ok(!/[?&](prova|debug|test|anteprima)=/.test(testo), `${file}: parametro di debug`);
  }
});

test("la landing è accessibile: lingua, salto al contenuto, immagini con alt e dimensioni", () => {
  for (const [nome, html] of Object.entries(pagine)) {
    assert.match(html, /^<!DOCTYPE html>\s*<html lang="it">/, nome);
    assert.match(html, /<a class="salta" href="#contenuto">Salta al contenuto<\/a>/, nome);
    assert.match(html, /<main[^>]*id="contenuto"/, nome);
    assert.match(html, /<meta name="viewport"/, nome);
    for (const img of html.match(/<img\b[^>]*>/g) || []) {
      assert.match(img, / alt="[^"]*"/, `${nome}: ${img}`);
      assert.match(img, / width="\d+"/, `${nome}: ${img}`);
      assert.match(img, / height="\d+"/, `${nome}: ${img}`);
      assert.match(img, /\.webp"/, `${nome}: immagine non WebP ${img}`);
      for (const src of img.match(/assets\/[\w\/.-]+\.webp/g) || []) {
        assert.ok(existsSync(join(uscita, src)), `${nome}: file mancante ${src}`);
      }
    }
    for (const el of html.match(/<(?:svg|div|span)\b[^>]*aria-hidden="true"[^>]*>/g) || []) {
      assert.ok(!/aria-label=/.test(el), `${nome}: aria-hidden su un elemento con etichetta ${el}`);
    }
  }
});

test("prezzi, orari e contatti della landing vengono da data/", () => {
  const { ristorante, menu } = leggiDati();
  const html = pagine["index.html"];
  assert.ok(html.includes(`${menu.smart.nome}, ${prezzo(menu.smart.prezzo)}`));
  assert.ok(html.includes(`${menu.plus.nome}, ${prezzo(menu.plus.prezzo)}`));
  for (const piatto of menu.allaCarta) assert.ok(html.includes(`<span>${prezzo(piatto.prezzo)}</span>`), piatto.nome);
  assert.ok(html.includes(`${prezzo(menu.coperto.prezzo)} a persona`));
  assert.ok(html.includes(`ti serviamo in ${menu.smart.minuti} minuti`));
  assert.ok(html.includes(`href="tel:${ristorante.contatti.telefono.replace(/[^\d+]/g, "")}"`));
  assert.ok(html.includes(`https://wa.me/${ristorante.contatti.whatsapp}?text=`));
  assert.ok(html.includes(`query_place_id=${ristorante.google.placeId}`));
  assert.ok(html.includes(`dalla Domiziana</span>`) && html.includes(ristorante.indirizzo.distanzaDallaDomiziana));
  for (const fascia of new Set(Object.values(ristorante.orari).flat())) assert.ok(html.includes(fascia), `fascia ${fascia}`);
  const dati = JSON.parse(html.match(/<script type="application\/json" id="dati">([^<]*)<\/script>/)[1]);
  assert.deepEqual(dati.orari, ristorante.orari);
  assert.equal(dati.google.adsId, ristorante.google.adsId);
  assert.equal(dati.recensioni.stelleMinime, ristorante.recensioni.stelleMinime);
  assert.ok(!/\b(oltre|più di) \d+\b/i.test(html), "numero tondo decorativo");
});

test("il JSON-LD descrive il ristorante solo con i dati di data/restaurant.json", () => {
  const { ristorante } = leggiDati();
  const ld = JSON.parse(pagine["index.html"].match(/<script type="application\/ld\+json">([^<]*)<\/script>/)[1]);
  assert.equal(ld["@type"], "Restaurant");
  assert.equal(ld.name, ristorante.nome);
  assert.equal(ld.telephone, ristorante.contatti.telefono);
  assert.equal(ld.address.addressLocality, ristorante.indirizzo.comune);
  assert.equal(ld.address.postalCode, ristorante.indirizzo.cap);
  assert.equal("streetAddress" in ld.address, ristorante.indirizzo.via !== null);
  for (const chiave of ["award", "sameAs", "aggregateRating", "review", "priceRange", "servesCuisine"]) assert.ok(!(chiave in ld), chiave);
  const fasce = ld.openingHoursSpecification.flatMap((o) => o.dayOfWeek.map((g) => `${g} ${o.opens}-${o.closes}`)).sort();
  const GIORNI = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const attese = Object.entries(ristorante.orari).flatMap(([g, f]) => f.map((fascia) => `${GIORNI[g]} ${fascia}`)).sort();
  assert.deepEqual(fasce, attese);
});

test("i dati del titolare mancanti compaiono come TODO(titolare) e quelli vuoti spariscono", () => {
  const { ristorante } = leggiDati();
  const html = pagine["termini.html"];
  if (ristorante.titolare.partitaIva === null) assert.ok(html.includes("TODO(titolare): partita IVA"));
  else assert.ok(html.includes(ristorante.titolare.partitaIva));
  assert.ok(!html.includes("[00000000000]"));
});

test("la cartella per Hostinger contiene i PHP e .htaccess ma mai config.php", () => {
  const file = tutti(uscita).map((f) => f.slice(uscita.length + 1).replaceAll("\\", "/"));
  for (const atteso of ["recensioni.php", "recensioni-lib.php", "aggiorna-recensioni.php", "config.example.php", ".htaccess", "recensioni-escluse.txt", ".nojekyll", "favicon.ico", "assets/stile.css", "assets/pagina.js", "assets/legale.css", "assets/caratteri/OFL.txt"]) {
    assert.ok(file.includes(atteso), atteso);
  }
  assert.ok(!file.includes("config.php"));
  assert.ok(!file.some((f) => f.endsWith(".jpg") || f.endsWith(".png") && f.startsWith("assets/")), "immagini non WebP tra gli asset");
});

test("senza --hostinger restano fuori PHP, .htaccess e l'elenco delle esclusioni", () => {
  const solo = mkdtempSync(join(tmpdir(), "sito-pages-"));
  costruisci({ uscita: solo });
  const file = tutti(solo).map((f) => f.slice(solo.length + 1).replaceAll("\\", "/"));
  for (const vietato of ["recensioni.php", "recensioni-lib.php", ".htaccess", "recensioni-escluse.txt", "config.example.php"]) assert.ok(!file.includes(vietato), vietato);
});
