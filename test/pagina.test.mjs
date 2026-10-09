import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const leggi = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const pagina = leggi("index.html");

test("la pagina pubblicata non contiene recensioni scritte a mano o segnaposto", () => {
  for (const finto of ["NomeC.", "contenuto della recensione", "Pasquale T."]) {
    assert.ok(!pagina.includes(finto), `segnaposto o recensione a mano: ${finto}`);
  }
});

test("i blocchi delle recensioni partono nascosti e hanno l'attribuzione a Google", () => {
  for (const id of ["dati-recensioni", "blocco-recensioni", "recensione-evidenza", "attribuzione-evidenza"]) {
    assert.match(pagina, new RegExp(`id="${id}"[^>]*\\bhidden\\b`), `#${id} deve partire nascosto`);
  }
  assert.ok(pagina.includes('Voto e recensioni forniti da <span translate="no">Google Maps</span>'));
  assert.match(pagina, /id="attribuzione-evidenza"[^>]*>Recensione da <span translate="no">Google Maps<\/span>/);
  assert.ok(pagina.includes('fetch("recensioni.json"'));
});

test("senza dati resta visibile il link alle recensioni su Google Maps", () => {
  assert.match(pagina, /<div class="prova4_recensione" id="prova-recensioni">/);
  const blocco = pagina.slice(pagina.indexOf('id="prova-recensioni"'), pagina.indexOf("</div>", pagina.indexOf('id="prova-recensioni"')));
  const link = blocco.slice(blocco.indexOf("</span>"));
  assert.match(link, /<a data-link="recensioni"[^>]*>Leggi le recensioni su Google Maps →<\/a>/);
});

test("i file PHP delle recensioni nella radice sono quelli di hostinger/", () => {
  for (const file of ["recensioni.php", "recensioni-lib.php", "aggiorna-recensioni.php", "config.example.php"]) {
    assert.equal(leggi(file), leggi(`hostinger/${file}`), file);
  }
});

test(".htaccess fa passare recensioni.json da recensioni.php e protegge i file di lavoro", () => {
  const htaccess = leggi(".htaccess");
  assert.match(htaccess, /RewriteRule \^recensioni\\\.json\$ recensioni\.php \[L\]/);
  for (const protetto of ["config\\.php", "recensioni-lib\\.php", "recensioni-escluse\\.txt", "recensioni\\.lock"]) {
    assert.ok(htaccess.includes(protetto), protetto);
  }
});

test("index, privacy e cookie richiamano nell'intestazione le stesse icone, con percorsi relativi", () => {
  const elenchi = ["index.html", "privacy.html", "cookie.html"].map((file) => {
    const intestazione = leggi(file).split("</head>")[0];
    const href = [...intestazione.matchAll(/<link rel="(?:icon|apple-touch-icon)"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
    for (const nome of ["favicon.ico", "favicon-32.png", "apple-touch-icon.png"]) {
      assert.ok(href.some((h) => h.split("?")[0] === nome), `${file}: manca ${nome}`);
    }
    for (const h of href) {
      assert.doesNotMatch(h, /^(\/|[a-z]+:)/i, `${file}: ${h} non è relativo alla cartella della pagina`);
      assert.ok(existsSync(new URL(`../${h.split("?")[0]}`, import.meta.url)), `${file}: ${h} non esiste`);
    }
    return href.join(" ");
  });
  assert.equal(new Set(elenchi).size, 1, "stessi file e stessa versione nelle tre pagine");
});

test("le icone hanno le misure giuste e quella per iPhone non è trasparente", () => {
  const ico = readFileSync(new URL("../favicon.ico", import.meta.url));
  assert.equal(ico.readUInt16LE(2), 1);
  const lati = Array.from({ length: ico.readUInt16LE(4) }, (_, i) => ico[6 + 16 * i] || 256).sort((a, b) => a - b);
  assert.deepEqual(lati, [16, 32, 48]);
  const png = (file) => {
    const b = readFileSync(new URL(`../${file}`, import.meta.url));
    return { lato: [b.readUInt32BE(16), b.readUInt32BE(20)], colore: b[25] };
  };
  assert.deepEqual(png("favicon-32.png").lato, [32, 32]);
  assert.deepEqual(png("favicon-512.png").lato, [512, 512]);
  const ios = png("apple-touch-icon.png");
  assert.deepEqual(ios.lato, [180, 180]);
  assert.ok([0, 2].includes(ios.colore), "apple-touch-icon.png con canale alfa: iOS riempirebbe di nero");
});
