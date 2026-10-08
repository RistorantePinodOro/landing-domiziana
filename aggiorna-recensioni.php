<?php
declare(strict_types=1);

/**
 * Aggiorna recensioni.json dalla scheda Google del Lido, per hosting PHP (Hostinger e simili).
 * Non e' obbligatorio: recensioni.php rinnova il file da solo alla prima visita dopo un giorno.
 * Serve per forzare l'aggiornamento subito, o per un cron giornaliero in hPanel:
 *   - dal cron (Avanzate > Cron Job):  php /home/UTENTE/domains/DOMINIO/public_html/CARTELLA/aggiorna-recensioni.php
 *   - dal browser, con il token scritto in config.php:  https://DOMINIO/CARTELLA/aggiorna-recensioni.php?token=IL_TOKEN
 * Configurazione in config.php (copia di config.example.php). Richiede PHP 8.1+ con curl, json, mbstring.
 */

require __DIR__ . '/recensioni-lib.php';

$daTerminale = PHP_SAPI === 'cli';
if (!$daTerminale) {
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
}

function termina(int $codice, string $messaggio): never
{
    global $daTerminale;
    if (!$daTerminale) {
        http_response_code($codice === 0 ? 200 : ($codice === 403 ? 403 : 500));
    }
    echo $messaggio, "\n";
    exit($codice === 403 ? 1 : $codice);
}

$config = leggiConfig();
$token = trim((string) ($config['token'] ?? ''));
$fixture = $daTerminale ? (getenv('PLACES_FIXTURE') ?: '') : ''; // solo per i test, mai dal web

// Dal web serve il token: senza, o sbagliato, niente (cosi' nessuno puo' far consumare la quota Google).
if (!$daTerminale) {
    $ricevuto = (string) ($_GET['token'] ?? '');
    if ($token === '' || $ricevuto === '' || !hash_equals($token, $ricevuto)) {
        termina(403, 'Accesso negato.');
    }
}

try {
    $esito = aggiornaRecensioni($config, $fixture);
} catch (Throwable $e) {
    termina(1, 'Errore: ' . $e->getMessage());
}
termina(0, $esito['messaggio']);
