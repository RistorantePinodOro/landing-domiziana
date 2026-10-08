<?php
declare(strict_types=1);

/**
 * Funzioni condivise per l'aggiornamento delle recensioni su hosting PHP (Hostinger e simili).
 * Le usano:
 *   - aggiorna-recensioni.php  (dal cron di hPanel o dal browser con token)
 *   - recensioni.php           (risponde al posto di recensioni.json e, se il file ha più di un giorno, lo rinnova prima)
 * Stessa logica di scripts/aggiorna-recensioni.mjs, la versione per GitHub Actions: i test confrontano i due risultati.
 */

const PLACE_ID_PREDEFINITO = 'ChIJcV_Xya3fOhMRWT5u9UL0X08'; // uguale a google.placeId in data/restaurant.json (un test lo verifica)
const CAMPI = 'id,displayName,rating,userRatingCount,reviews,googleMapsUri';
const LINGUE = ['it', 'en'];           // la prima è la principale (voto, conteggio, testi in italiano); le altre aggiungono le recensioni scritte in quella lingua
const MASSIMO_TUTTE = 10;
const ETA_MASSIMA_GIORNI = 730;        // recensioni più vecchie di due anni non entrano (legge 11 marzo 2026, n. 34)
const TESTO_MIN_FILE = 20;             // recensioni più corte non entrano nel file
const TESTO_MIN = 40;                  // recensioni più corte non vengono messe in evidenza
const VALUTAZIONE_MIN = 4;             // uguale a recensioni.stelleMinime in data/restaurant.json (un test lo verifica)
// Parole che, anche in una recensione a 5 stelle, non vogliamo in evidenza: la recensione viene lasciata fuori.
const PAROLE_ESCLUSE = ['rubbish', 'terrible', 'awful', 'horrible', 'disgusting', 'worst', 'rude', 'dirty', 'overpriced', 'rip off', 'rip-off', 'scam', 'avoid', 'never again', 'disappoint', 'unfriendly',
    'pessim', 'orribil', 'terribil', 'schifo', 'maleducat', 'sporc', 'delus', 'scaden', 'sconsigli', 'mai più', 'mai piu', 'da evitare', 'fregatura', 'vergogn'];
const TIMEOUT_SEC = 20;
const ETA_MASSIMA_SEC = 24 * 3600;     // dopo un giorno recensioni.json va rinnovato
const RIPROVA_DOPO_SEC = 3600;         // se Google non risponde, si riprova al massimo ogni ora

// Una recensione in evidenza per ciascun tema, in quest'ordine.
const CATEGORIE = [
    'lavoro' => ['lavoro', 'pausa', 'veloc', 'rapid', 'servizio', 'cortes', 'gentil', 'tempi', 'puntual', 'personale', 'attent', 'professional'],
    'viaggio' => ['viaggio', 'passaggio', 'famiglia', 'bambin', 'figli', 'vacanz', 'sosta', 'strada', 'domiziana', 'torner', 'fermat', 'tappa'],
    'cibo' => ['lupin', 'spaghett', 'pesce', 'fritt', 'cucina', 'piatt', 'buon', 'mangiat', 'fresc', 'qualit', 'porzion', 'ottim', 'delizios'],
];

mb_internal_encoding('UTF-8');

function percorsoRecensioni(): string
{
    return __DIR__ . '/recensioni.json';
}

/** Legge config.php (copia compilata di config.example.php); array vuoto se manca. */
function leggiConfig(): array
{
    if (!is_file(__DIR__ . '/config.php')) {
        return [];
    }
    $letto = require __DIR__ . '/config.php';
    return is_array($letto) ? $letto : [];
}

/** Secondi trascorsi dall'ultimo aggiornamento di recensioni.json; null se il file manca. */
function etaRecensioni(): ?int
{
    $file = percorsoRecensioni();
    if (!is_file($file)) {
        return null;
    }
    $dati = json_decode((string) file_get_contents($file), true);
    $quando = is_array($dati) ? strtotime((string) ($dati['aggiornato'] ?? '')) : false;
    if ($quando === false) {
        $quando = filemtime($file) ?: 0;
    }
    return max(0, time() - $quando);
}

function dettagli(string $chiave, string $placeId, string $fixture, string $lingua = 'it'): array
{
    if ($fixture !== '') {
        if ($lingua !== LINGUE[0]) {
            $fixture = (string) getenv('PLACES_FIXTURE_' . strtoupper($lingua));
            if ($fixture === '') {
                return ['reviews' => []];
            }
        }
        $contenuto = @file_get_contents($fixture);
        if ($contenuto === false) {
            throw new RuntimeException('Risposta di prova non leggibile: ' . $fixture);
        }
        $dati = json_decode($contenuto, true);
        if (!is_array($dati)) {
            throw new RuntimeException('Risposta di prova non valida.');
        }
        return $dati;
    }
    $url = 'https://places.googleapis.com/v1/places/' . rawurlencode($placeId) . '?languageCode=' . rawurlencode($lingua) . '&regionCode=IT';
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => TIMEOUT_SEC,
        CURLOPT_HTTPHEADER => ['X-Goog-Api-Key: ' . $chiave, 'X-Goog-FieldMask: ' . ($lingua === LINGUE[0] ? CAMPI : 'reviews'), 'Accept: application/json'],
    ]);
    $corpo = curl_exec($ch);
    $errore = curl_error($ch);
    $stato = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($corpo === false) {
        throw new RuntimeException('Google non raggiungibile: ' . $errore);
    }
    if ($stato !== 200) {
        throw new RuntimeException('Places API ' . $stato . ': ' . mb_substr((string) $corpo, 0, 300));
    }
    $dati = json_decode((string) $corpo, true);
    if (!is_array($dati)) {
        throw new RuntimeException('Risposta di Google non leggibile.');
    }
    return $dati;
}

/** Tempo trascorso in italiano ("3 settimane fa"), uguale per tutte le lingue. */
function quandoItaliano(string $publishTime, int $adesso): string
{
    $t = strtotime($publishTime);
    if (!$t) {
        return '';
    }
    $giorni = max(0, intdiv($adesso - $t, 86400));
    if ($giorni < 1) {
        return 'oggi';
    }
    if ($giorni === 1) {
        return 'ieri';
    }
    if ($giorni < 7) {
        return "$giorni giorni fa";
    }
    $settimane = intdiv($giorni, 7);
    if ($giorni < 30) {
        return $settimane === 1 ? 'una settimana fa' : "$settimane settimane fa";
    }
    $mesi = (int) floor($giorni / 30.44);
    if ($giorni < 365) {
        return $mesi <= 1 ? 'un mese fa' : "$mesi mesi fa";
    }
    $anni = (int) floor($giorni / 365.25);
    return $anni <= 1 ? 'un anno fa' : "$anni anni fa";
}

function punteggio(string $testo, array $parole): int
{
    $t = mb_strtolower($testo);
    $n = 0;
    foreach ($parole as $p) {
        if (str_contains($t, $p)) {
            $n++;
        }
    }
    return $n;
}

function scegli(array $recensioni): array
{
    $valide = array_values(array_filter($recensioni, static fn(array $r): bool => mb_strlen($r['testo']) >= TESTO_MIN));
    $usate = [];
    $scelte = [];
    foreach (CATEGORIE as $categoria => $parole) {
        $migliore = null;
        $max = 0;
        foreach ($valide as $i => $r) {
            if (isset($usate[$i])) {
                continue;
            }
            $s = punteggio($r['testo'], $parole);
            if ($s > $max) {
                $max = $s;
                $migliore = $i;
            }
        }
        if ($migliore !== null) {
            $usate[$migliore] = true;
            $scelte[] = $valide[$migliore] + ['categoria' => $categoria];
        }
    }
    $ordine = array_keys($valide);
    $italiana = static fn(array $r): int => ($r['lingua'] === LINGUE[0]) ? 1 : 0;
    usort($ordine, static fn(int $a, int $b): int =>
        [$italiana($valide[$b]), $valide[$b]['valutazione'], $valide[$b]['data']] <=> [$italiana($valide[$a]), $valide[$a]['valutazione'], $valide[$a]['data']]);
    foreach ($ordine as $i) {
        if (count($scelte) >= 3) {
            break;
        }
        if (!isset($usate[$i])) {
            $usate[$i] = true;
            $scelte[] = $valide[$i] + ['categoria' => 'altro'];
        }
    }
    return $scelte;
}

/** Identità di una recensione: il suo link su Google (uno per recensione), altrimenti autore e testo. */
function chiaveRecensione(array $r): string
{
    return str_contains($r['link'], '/reviews/') ? $r['link'] : $r['autore'] . '|' . $r['testo'];
}

/** Esclusioni manuali: righe di recensioni-escluse.txt (un pezzo del link della recensione, oppure il nome come appare su Google). */
function escluseManuali(): array
{
    $file = __DIR__ . '/recensioni-escluse.txt';
    if (!is_file($file)) {
        return [];
    }
    $righe = [];
    foreach (preg_split('/\r?\n/', (string) file_get_contents($file)) as $riga) {
        $riga = trim($riga);
        if ($riga !== '' && !str_starts_with($riga, '#')) {
            $righe[] = mb_strtolower($riga);
        }
    }
    return $righe;
}

function daEscludere(array $r, array $manuali): bool
{
    $t = mb_strtolower($r['testo']);
    foreach (PAROLE_ESCLUSE as $p) {
        if (str_contains($t, $p)) {
            return true;
        }
    }
    $autore = mb_strtolower($r['autore']);
    $link = mb_strtolower($r['link']);
    foreach ($manuali as $m) {
        if ($autore === $m || ($link !== '' && str_contains($link, $m))) {
            return true;
        }
    }
    return false;
}

/**
 * Attribuzione come la fornisce Google (nome pubblico, link al profilo, link alla recensione, link per segnalare): le
 * condizioni di Google Maps Platform non permettono di modificarla. Testo originale e integrale dell'autore, mai la
 * traduzione automatica. La data è conservata con precisione al giorno (minimizzazione).
 */
function normalizza(array $dati, array $extra, string $placeId, ?int $adesso = null): array
{
    $adesso = $adesso ?? time();
    $converti = static fn(array $r, string $lingua): array => [
        'autore' => trim((string) ($r['authorAttribution']['displayName'] ?? '')) ?: 'Utente Google',
        'autoreLink' => (string) ($r['authorAttribution']['uri'] ?? ''),
        'valutazione' => (int) ($r['rating'] ?? 0),
        'testo' => trim((string) preg_replace('/\s+/u', ' ', (string) ($r['originalText']['text'] ?? ($r['text']['text'] ?? '')))),
        'quando' => quandoItaliano((string) ($r['publishTime'] ?? ''), $adesso),
        'data' => substr((string) ($r['publishTime'] ?? ''), 0, 10),
        'link' => (string) ($r['googleMapsUri'] ?? ($dati['googleMapsUri'] ?? '')),
        'segnala' => (string) ($r['flagContentUri'] ?? ''),
        'lingua' => $lingua,
    ];
    $scaricate = [];
    $presenti = [];
    $aggiungi = static function (array $r, string $lingua) use (&$scaricate, &$presenti, $converti): void {
        $c = $converti($r, $lingua);
        if ($c['testo'] === '' || isset($presenti[chiaveRecensione($c)])) {
            return;
        }
        $presenti[chiaveRecensione($c)] = true;
        $scaricate[] = $c;
    };
    // Per ogni lingua solo le recensioni scritte davvero in quella lingua: le altre arriverebbero tradotte da Google.
    foreach ($dati['reviews'] ?? [] as $r) {
        $originale = (string) ($r['originalText']['languageCode'] ?? '');
        if ($originale === '' || $originale === LINGUE[0]) {
            $aggiungi($r, LINGUE[0]);
        }
    }
    foreach ($extra as $blocco) {
        foreach ($blocco['reviews'] ?? [] as $r) {
            if ((string) ($r['originalText']['languageCode'] ?? '') === $blocco['lingua']) {
                $aggiungi($r, $blocco['lingua']);
            }
        }
    }
    $manuali = escluseManuali();
    // Nel file restano solo le recensioni che la pagina può mostrare (minimizzazione, art. 5.1.c GDPR).
    $tutte = array_values(array_filter($scaricate, static function (array $r) use ($manuali, $adesso): bool {
        if ($r['valutazione'] < VALUTAZIONE_MIN || mb_strlen($r['testo']) < TESTO_MIN_FILE) {
            return false;
        }
        $data = strtotime($r['data']);
        if ($data && $adesso - $data > ETA_MASSIMA_GIORNI * 86400) {
            return false;
        }
        return !daEscludere($r, $manuali);
    }));
    usort($tutte, static fn(array $a, array $b): int => strcmp($b['data'], $a['data']));
    $tutte = array_slice($tutte, 0, MASSIMO_TUTTE);
    $valutazione = $dati['rating'] ?? null;
    $numero = $dati['userRatingCount'] ?? null;
    return [
        'aggiornato' => gmdate('Y-m-d\TH:i:s', $adesso) . '.000Z',
        'placeId' => (string) ($dati['id'] ?? $placeId),
        'nome' => (string) ($dati['displayName']['text'] ?? ''),
        'googleMapsUri' => (string) ($dati['googleMapsUri'] ?? ''),
        'valutazione' => is_int($valutazione) || is_float($valutazione) ? $valutazione : null,
        'numeroRecensioni' => is_int($numero) ? $numero : null,
        'scelte' => scegli($tutte),
        'tutte' => $tutte,
    ];
}

function codifica(array $dati): string
{
    return json_encode($dati, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION) . "\n";
}

function senzaData(array $dati): string
{
    unset($dati['aggiornato']);
    return json_encode($dati, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

/**
 * Interroga Google e riscrive recensioni.json (sempre, così la data "aggiornato" è quella dell'ultimo controllo).
 * Ritorna ['cambiato' => bool, 'messaggio' => string]. Lancia un'eccezione se Google non risponde o il file non si scrive.
 */
function aggiornaRecensioni(array $config, string $fixture = ''): array
{
    $chiave = trim((string) ($config['api_key'] ?? ''));
    $placeId = trim((string) ($config['place_id'] ?? '')) ?: PLACE_ID_PREDEFINITO;
    if ($chiave === '' && $fixture === '') {
        throw new RuntimeException('Manca api_key: copia config.example.php in config.php e inserisci la chiave di Google Maps Platform.');
    }
    $file = percorsoRecensioni();
    $precedente = is_file($file) ? json_decode((string) file_get_contents($file), true) : null;
    $adesso = (PHP_SAPI === 'cli' && getenv('RECENSIONI_ADESSO')) ? (strtotime((string) getenv('RECENSIONI_ADESSO')) ?: time()) : time();
    $base = dettagli($chiave, $placeId, $fixture, LINGUE[0]);
    $extra = [];
    foreach (array_slice(LINGUE, 1) as $lingua) {
        $extra[] = ['lingua' => $lingua, 'reviews' => dettagli($chiave, $placeId, $fixture, $lingua)['reviews'] ?? []];
    }
    $nuovo = normalizza($base, $extra, $placeId, $adesso);
    $cambiato = !(is_array($precedente) && senzaData($precedente) === senzaData($nuovo));
    $temporaneo = $file . '.tmp';
    if (file_put_contents($temporaneo, codifica($nuovo)) === false || !rename($temporaneo, $file)) {
        throw new RuntimeException('Non riesco a scrivere recensioni.json (controlla i permessi della cartella).');
    }
    $riassunto = sprintf('%s su Google, %s recensioni, %d in evidenza', $nuovo['valutazione'] ?? '-', $nuovo['numeroRecensioni'] ?? '-', count($nuovo['scelte']));
    return [
        'cambiato' => $cambiato,
        'messaggio' => $cambiato
            ? "Aggiornato recensioni.json: $riassunto (" . implode(', ', array_column($nuovo['scelte'], 'categoria')) . ').'
            : "Nessuna novità: $riassunto (data di controllo aggiornata).",
    ];
}
