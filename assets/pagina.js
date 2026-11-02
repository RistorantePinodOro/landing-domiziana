    // Menu di navigazione (telefono)
    const toggle = document.getElementById('navToggle');
    const links = document.getElementById('navLinks');
    toggle.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open);
      if (open) links.querySelector('a').focus(); // il pulsante segue la lista nel DOM: senza questo Tab salterebbe il menu
    });
    links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      links.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && links.classList.contains('open')) {
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });

    // Galleria: frecce (desktop) sullo scorrimento orizzontale
    const galleryScroll = document.getElementById('galleryScroll');
    document.querySelectorAll('.galleria-btn').forEach(b => b.addEventListener('click', () => {
      galleryScroll.scrollBy({ left: Number(b.dataset.dir) * galleryScroll.clientWidth * .8, behavior: 'smooth' });
    }));

    // Barra in basso (telefono): compare quando il pulsante della prima schermata esce dallo schermo, sparisce sopra il modulo
    (() => {
      const barra = document.getElementById('pdo-barra');
      let heroVisibile = true, moduloVisibile = false;
      const aggiorna = () => barra.classList.toggle('is-visibile', !heroVisibile && !moduloVisibile);
      document.body.classList.add('pdo-con-barra');
      new IntersectionObserver(e => { heroVisibile = e[0].isIntersecting; aggiorna(); }).observe(document.getElementById('pdo-hero-cta'));
      new IntersectionObserver(e => { moduloVisibile = e[0].isIntersecting; aggiorna(); }, { threshold: 0.15 }).observe(document.getElementById('reserveForm'));
    })();

    // Foto di sfondo della recensione: caricata solo quando la sezione si avvicina (è 5-6 schermate più in basso)
    (() => {
      const sfondi = document.querySelectorAll('.recensione');
      if (!('IntersectionObserver' in window)) { sfondi.forEach(s => s.classList.add('is-near')); return; }
      const io = new IntersectionObserver(entries => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('is-near'); io.unobserve(e.target); }
      }), { rootMargin: '600px' });
      sfondi.forEach(s => io.observe(s));
    })();

    // ------------------------------------------------------------------
    // Prenotazioni: orari, sale e fasce orarie live dal backend
    // (api/prenota.php su Hostinger, /api/reserve altrove — vedi data-endpoint).
    // Senza backend (anteprima statica) ogni richiesta fallisce in silenzio: gli orari
    // restano quelli del markup, il modulo tiene gli orari fissi e l'invio mostra
    // il messaggio con i contatti.
    // ------------------------------------------------------------------
    const $ = id => document.getElementById(id);
    const form = $('reserveForm');
    const formSuccess = $('formSuccess');
    const formError = $('formError');
    const reserveEndpoint = form.dataset.endpoint || '/api/reserve';
    const dateInput = $('date'), dateHint = $('dateHint');
    const guestsInput = $('guests'), guestsHint = $('guestsHint');
    const roomField = $('roomField'), roomChoices = $('roomChoices');
    const timeChoices = $('timeChoices'), timeLegend = $('timeLegend'), timeHint = $('timeHint'), slotNotice = $('slotNotice');
    const ackWrap = $('ackWrap'), ackBox = $('ackNotice');
    const waitlistWrap = $('waitlistWrap'), waitlistBox = $('waitlist');
    const submitBtn = $('submitBtn');
    const passi = [$('passo1'), $('passo2'), $('passo3')];
    const fixedTimes = timeChoices.dataset.orari.split(' ');
    const MAX_GUESTS = Number(guestsInput.max);
    const DAYS = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
    const DAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
    const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
    const MONTHS_LONG = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
    const STATUS_LABELS = { 1: 'Da confermare', 2: 'Confermata', 3: 'Cancellata', 4: 'Non accettata', 5: 'Cliente in', 6: 'Cliente out', 8: "Lista d'attesa", 9: 'Annullata da te', 10: 'No show' };
    const CLOSED_STATES = [3, 4, 6, 9, 10];
    // Orari settimanali di riserva (data/restaurant.json, hours.weekly): usati finché non arrivano quelli live.
    const STATIC_HOURS = {
      hours: [
        { day: 1, ranges: [{ open: '12:00', close: '15:00' }, { open: '19:30', close: '22:30' }] },
        { day: 2, ranges: [{ open: '12:00', close: '15:00' }, { open: '19:30', close: '22:30' }] },
        { day: 3, ranges: [{ open: '12:00', close: '15:00' }, { open: '19:30', close: '22:30' }] },
        { day: 4, ranges: [{ open: '12:00', close: '15:00' }, { open: '19:30', close: '22:30' }] },
        { day: 5, ranges: [{ open: '12:00', close: '15:00' }, { open: '19:30', close: '22:30' }] },
        { day: 6, ranges: [{ open: '12:00', close: '15:15' }, { open: '19:15', close: '22:30' }] },
        { day: 7, ranges: [{ open: '12:00', close: '15:15' }] }
      ],
      exceptions: []
    };

    let hoursData = null;          // {hours, exceptions} dal backend; null → resta il markup statico
    let roomChoiceRequired = false;
    let roomNames = new Map();     // codice sala → nome, per riepilogo e descrizione
    let liveSlots = [];            // fasce della data scelta quando la disponibilità live è attiva
    let slotsRequest = 0;          // guardia contro risposte in ritardo
    let passo = 0;                 // passo del modulo mostrato (0, 1, 2)
    const pending = { time: null, room: null }; // dall'hash dell'URL, applicati appena arrivano i dati

    const pad = n => String(n).padStart(2, '0');
    // Oggi nel fuso del ristorante (Europe/Rome); senza Intl la data locale del dispositivo.
    const todayISO = () => {
      try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
      catch { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
    };
    const oraRoma = () => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
    const ANTICIPO = 30; // minuti minimi tra la richiesta e l'orario, per prenotare in giornata
    const minuti = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
    const troppoTardi = (iso, t) => iso < todayISO() || (iso === todayISO() && minuti(t) < minuti(oraRoma()) + ANTICIPO);
    const isISODate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
    const isTime = s => /^([01]\d|2[0-3]):[0-5]\d$/.test(s || ''); // stessa regola del backend
    const parseISO = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
    const isoWeekday = iso => { const js = parseISO(iso).getDay(); return js === 0 ? 7 : js; }; // 1 = lunedì … 7 = domenica
    const shortDate = iso => { const d = parseISO(iso); return d.getDate() + ' ' + MONTHS[d.getMonth()]; };
    const longDate = iso => { const d = parseISO(iso); return DAYS_SHORT[isoWeekday(iso) - 1].toLowerCase() + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); };
    const fullDate = iso => { const d = parseISO(iso); return DAYS[isoWeekday(iso) - 1].toLowerCase() + ' ' + d.getDate() + ' ' + MONTHS_LONG[d.getMonth()]; };

    // Le letture si riprovano due volte (sui telefoni una richiesta può cadere); l'invio mai, o la prenotazione si doppia.
    async function api(query, options) {
      if (location.protocol === 'file:') throw new Error('no backend'); // anteprima statica: niente da chiamare
      for (let tentativo = 1; ; tentativo++) {
        try {
          const r = await fetch(reserveEndpoint + query, Object.assign({ headers: { accept: 'application/json' }, cache: 'no-store' }, options || {}));
          const json = await r.json().catch(() => null);
          if (options || tentativo === 3 || (r.status < 500 && json)) return { ok: r.ok, status: r.status, json };
        } catch (err) {
          if (options || tentativo === 3) throw err;
        }
        await new Promise(fatto => setTimeout(fatto, 1000 * tentativo));
      }
    }
    const postJson = body => api('', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(body) });
    const show = (node, on) => { node.hidden = !on; };
    const setHint = (node, text, error) => { node.textContent = text || ''; node.classList.toggle('is-error', !!error); node.hidden = !text; };
    const scelto = name => { const i = form.querySelector('input[name="' + name + '"]:checked'); return i ? i.value : ''; };
    const scegli = (name, value) => { const i = Array.from(form.querySelectorAll('input[name="' + name + '"]')).find(x => x.value === value); if (i) i.checked = true; return !!i; };
    function scelta(name, value, text, required) {
      const label = document.createElement('label'); label.className = 'scelta';
      const input = document.createElement('input'); input.type = 'radio'; input.name = name; input.value = value; input.required = !!required;
      const span = document.createElement('span'); span.textContent = text;
      label.append(input, span);
      return label;
    }

    // ---- Orari (GET ?hours=1) -------------------------------
    const rangesText = ranges => ranges.map(r => r.open + ' – ' + r.close).join(' · ');
    const covers = (ex, iso) => isISODate(ex.from) && ex.from <= iso && iso <= (isISODate(ex.to) ? ex.to : ex.from);
    function exceptionLabel(ex) {
      const to = isISODate(ex.to) ? ex.to : ex.from;
      let when;
      if (to === ex.from) when = shortDate(ex.from);
      else if (parseISO(ex.from).getMonth() === parseISO(to).getMonth()) when = parseISO(ex.from).getDate() + '–' + parseISO(to).getDate() + ' ' + MONTHS[parseISO(to).getMonth()];
      else when = shortDate(ex.from) + ' – ' + shortDate(to);
      return (ex.type === 'opening' ? 'Aperto ' : 'Chiuso ') + when;
    }
    // Striscia nell'hero: "oggi, giovedì 8 ottobre, aperti" + fasce, oppure "oggi chiuso" (chiusure ed aperture straordinarie comprese).
    function renderToday(data) {
      const line = $('oggiData'), hours = $('oggiOrario');
      if (!line || !hours) return;
      const iso = todayISO();
      let when;
      try { when = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Rome' }).format(new Date()); }
      catch { const d = parseISO(iso); when = DAYS[isoWeekday(iso) - 1].toLowerCase() + ' ' + d.getDate() + ' ' + MONTHS_LONG[d.getMonth()]; }
      const closure = data.exceptions.find(e => e.type === 'closure' && covers(e, iso));
      const extra = !closure && data.exceptions.find(e => e.type === 'opening' && covers(e, iso));
      const h = data.hours.find(x => Number(x.day) === isoWeekday(iso));
      const ranges = h && Array.isArray(h.ranges) ? h.ranges : [];
      if (!closure && (ranges.length || extra)) {
        line.textContent = 'oggi, ' + when + ', aperti';
        hours.textContent = ranges.length ? rangesText(ranges) : (extra.message || 'apertura straordinaria');
      } else {
        line.textContent = 'oggi, ' + when;
        hours.textContent = 'oggi chiuso' + (closure && closure.message ? ' — ' + closure.message : '');
      }
    }
    function renderHours(data) {
      const list = $('hoursList');
      if (!list) return;
      const byDay = new Map(data.hours.map(h => [Number(h.day), h]));
      const todayDay = isoWeekday(todayISO());
      const item = (left, right, cls) => {
        const li = document.createElement('li');
        const a = document.createElement('span'), b = document.createElement('span');
        a.textContent = left;
        if (Array.isArray(right)) right.forEach((range, i) => { // "12:00 – 15:00 · 19:30 – 22:30", mai spezzato dentro una fascia
          if (i) b.append(' · ');
          const span = document.createElement('span'); span.className = 'range'; span.textContent = range; b.append(span);
        }); else b.textContent = right;
        if (cls) li.className = cls; else if (!right) { li.className = 'closed'; b.textContent = 'Chiuso'; }
        li.append(a, b);
        return li;
      };
      const frag = document.createDocumentFragment();
      const rows = []; // giorni consecutivi con lo stesso orario, per il riepilogo nel footer
      for (let d = 1; d <= 7; d++) {
        const h = byDay.get(d);
        const text = h && Array.isArray(h.ranges) && h.ranges.length ? rangesText(h.ranges) : '';
        const li = item(DAYS[d - 1], text ? text.split(' · ') : '');
        if (d === todayDay) li.classList.add('today');
        frag.appendChild(li);
        const last = rows[rows.length - 1];
        if (last && last.text === text) last.to = d; else rows.push({ from: d, to: null, text });
      }
      const today = todayISO();
      data.exceptions
        .filter(ex => isISODate(ex.from) && (isISODate(ex.to) ? ex.to : ex.from) >= today)
        .slice(0, 4)
        .forEach(ex => frag.appendChild(item(exceptionLabel(ex), ex.message || '', 'exception' + (ex.type === 'opening' ? ' opening' : ''))));
      list.replaceChildren(frag);
      // Riepilogo nel footer: "Lun – Ven 12:00 – 15:00 · 19:30 – 22:30", "Chiuso il lunedì".
      const footer = $('footerHours');
      if (footer) {
        footer.replaceChildren(...rows.map(r => {
          const li = document.createElement('li');
          const span = r.to ? DAYS_SHORT[r.from - 1] + ' – ' + DAYS_SHORT[r.to - 1] : DAYS_SHORT[r.from - 1];
          li.textContent = r.text ? span + ' ' + r.text : 'Chiuso ' + (r.to ? span : 'il ' + DAYS[r.from - 1].toLowerCase());
          return li;
        }));
      }
    }
    async function loadHours() {
      try {
        const { json: j } = await api('?hours=1');
        if (!j || !j.ok || !Array.isArray(j.hours) || !j.hours.length) return; // niente di usabile: resta il markup statico
        hoursData = { hours: j.hours, exceptions: Array.isArray(j.exceptions) ? j.exceptions : [] };
        renderHours(hoursData);
        renderToday(hoursData);
      } catch { /* restano gli orari statici */ }
    }
    // Perché una data non si può prenotare secondo gli orari live, o null se è aperta. Stesso ordine del backend:
    // una chiusura straordinaria vince su un'apertura straordinaria, poi le fasce del giorno della settimana.
    function closedReason(iso) {
      if (!hoursData) return null;
      const closure = hoursData.exceptions.find(e => e.type === 'closure' && covers(e, iso));
      if (closure) return 'Siamo chiusi in questa data' + (closure.message ? ' — ' + closure.message : '') + '. Scegli un altro giorno.';
      if (hoursData.exceptions.some(e => e.type === 'opening' && covers(e, iso))) return null;
      const h = hoursData.hours.find(x => Number(x.day) === isoWeekday(iso));
      if (h && (!Array.isArray(h.ranges) || !h.ranges.length)) return 'Siamo chiusi il ' + DAYS[isoWeekday(iso) - 1].toLowerCase() + ' — scegli un altro giorno.';
      return null;
    }
    // Un orario di riserva vale solo dentro le fasce del giorno; con un'apertura o chiusura straordinaria decide il backend.
    function aperto(iso, t) {
      if (!hoursData || hoursData.exceptions.some(e => covers(e, iso))) return true;
      const h = hoursData.hours.find(x => Number(x.day) === isoWeekday(iso));
      return !h || !Array.isArray(h.ranges) || h.ranges.some(r => r.open <= t && t < r.close);
    }
    // Svuota una data chiusa e spiega perché. Restituisce true quando la data è utilizzabile.
    function validateDate() {
      setHint(dateHint, '');
      const v = dateInput.value;
      if (!isISODate(v)) return true;
      const why = closedReason(v);
      if (!why) return true;
      dateInput.value = '';
      setHint(dateHint, why, true);
      dateInput.focus({ preventScroll: true }); // il campo è stato svuotato: l'ospite resta lì
      return false;
    }

    // ---- Sale (GET ?rooms=1): compaiono solo se il sistema di prenotazione ne ha ----
    async function loadRooms() {
      try {
        const { json: j } = await api('?rooms=1');
        if (!j || !j.ok) return;
        const rooms = Array.isArray(j.rooms) ? j.rooms.filter(r => r && r.code) : [];
        roomChoiceRequired = !!j.roomChoiceRequired;
        if (!roomChoiceRequired && !rooms.length) return;
        roomNames = new Map(rooms.map(r => [r.code, r.name || r.code]));
        const choices = rooms.map(r => scelta('room', r.code, r.name || r.code, roomChoiceRequired));
        if (!roomChoiceRequired) {
          const none = scelta('room', '', 'Nessuna preferenza');
          none.firstChild.checked = none.firstChild.defaultChecked = true;
          choices.unshift(none);
        }
        roomChoices.replaceChildren(...choices);
        show(roomField, true);
        applyPendingRoom();
      } catch { /* senza sale il modulo resta senza scelta della sala */ }
    }
    function applyPendingRoom() {
      if (!pending.room || roomField.hidden) return;
      scegli('room', pending.room);
      pending.room = null;
    }
    const salaScelta = () => roomField.hidden ? '' : (roomNames.get(scelto('room')) || '');

    // ---- Fasce orarie (GET ?slots=1&date&guests[&room]) ----------------------
    // Orari come pulsanti raggruppati per fascia (Pranzo, Cena…); senza etichetta decide l'ora.
    function setTimes(list, preferred) {
      const current = scelto('time');
      const groups = new Map();
      list.forEach(s => {
        const t = typeof s === 'string' ? s : s.time;
        const name = (typeof s === 'string' ? '' : s.label) || (t < '17:00' ? 'Pranzo' : 'Cena');
        if (!groups.has(name)) groups.set(name, []);
        groups.get(name).push(t);
      });
      timeChoices.replaceChildren(...Array.from(groups, ([name, times]) => {
        const box = document.createElement('div'); box.className = 'fascia';
        const title = document.createElement('p'); title.className = 'fascia-nome'; title.textContent = name;
        const grid = document.createElement('div'); grid.className = 'scelte scelte-ore';
        times.forEach(t => grid.append(scelta('time', t, t, true)));
        box.append(title, grid);
        return box;
      }));
      timeLegend.textContent = preferred ? 'Orario preferito' : 'Orario';
      if (current) scegli('time', current);
    }
    function updateSubmitLabel() {
      submitBtn.textContent = (!waitlistWrap.hidden && waitlistBox.checked) ? "Mettimi in lista d'attesa" : 'Invia la richiesta';
    }
    function resetSlotUi() {
      liveSlots = [];
      setHint(timeHint, '');
      slotNotice.textContent = ''; show(slotNotice, false);
      ackBox.checked = false; ackBox.required = false; show(ackWrap, false);
      waitlistBox.checked = false; show(waitlistWrap, false);
      updateSubmitLabel();
    }
    // L'avviso arriva come HTML dal sistema di prenotazione: se ne tengono solo i paragrafi, come testo.
    function setNotice(html) {
      const body = new DOMParser().parseFromString(html, 'text/html').body;
      const parts = Array.from(body.querySelectorAll('p'), p => p.textContent.trim()).filter(Boolean);
      if (!parts.length && body.textContent.trim()) parts.push(body.textContent.trim());
      const p = text => { const el = document.createElement('p'); el.textContent = text; return el; };
      const title = p('Nota sulla prenotazione'); title.className = 'occhiello';
      slotNotice.replaceChildren(...(parts.length ? [title, ...parts.map(p)] : []));
    }
    // L'avviso della fascia scelta — o della prima — più la casella di presa visione.
    function updateNotice() {
      const meta = liveSlots.find(s => s.time === scelto('time')) || liveSlots[0];
      const notice = meta && meta.notice ? String(meta.notice) : '';
      setNotice(notice); show(slotNotice, !!notice);
      const ack = !!(meta && meta.ackRequired);
      show(ackWrap, ack); ackBox.required = ack;
      if (!ack) ackBox.checked = false;
    }
    let dataCaricata = ''; // la data a cui si riferiscono gli orari mostrati
    async function loadSlots() {
      const date = dateInput.value, guests = guestsInput.value;
      dataCaricata = date;
      const req = ++slotsRequest;
      pending.time = pending.time || scelto('time'); // l'orario scelto resta, se c'è ancora con i nuovi dati
      resetSlotUi();
      const room = roomField.hidden ? '' : scelto('room');
      const missing = [!isISODate(date) && 'la data', roomChoiceRequired && !room && 'la sala'].filter(Boolean);
      if (missing.length) { setTimes([]); setHint(timeHint, 'Scegli ' + missing.join(' e ') + ' per vedere gli orari.'); return; }
      setTimes([]);
      setHint(timeHint, 'Verifica della disponibilità…');
      let j = null;
      try {
        j = (await api('?slots=1&date=' + encodeURIComponent(date) + '&guests=' + encodeURIComponent(guests) + (room ? '&room=' + encodeURIComponent(room) : ''))).json;
      } catch { j = null; }
      if (req !== slotsRequest) return; // è partita una richiesta più recente
      setHint(timeHint, '');
      const slots = j && j.ok && Array.isArray(j.slots) ? j.slots.filter(s => s && isTime(s.time) && !troppoTardi(date, s.time)) : null;
      const riserva = fixedTimes.filter(t => !troppoTardi(date, t) && aperto(date, t));
      if (slots && slots.length) {
        liveSlots = slots;
        setTimes(slots);
        updateNotice();
      } else if (!riserva.length) {
        setHint(timeHint, 'Per questa data non ci sono più orari prenotabili online — scegli un altro giorno o chiamaci.', true);
      } else if (slots || (j && j.ok === false && j.reason === 'closed')) {
        // Niente di prenotabile online: resta un orario preferito per chiedere comunque — o mettersi in lista.
        setTimes(riserva, true);
        const waitlist = !!(j && j.waitlist);
        setHint(timeHint, 'Nessun tavolo disponibile online per questa data' + (waitlist ? " — mettiti in lista d'attesa o chiamaci." : ' — chiamaci o prova un altro giorno.'), true);
        show(waitlistWrap, waitlist);
      } else {
        setTimes(riserva); // nessun modulo di prenotazione / backend non raggiungibile: la lista fissa
      }
      applyPendingTime();
    }
    function applyPendingTime() {
      if (!pending.time) return;
      const t = pending.time;
      pending.time = null;
      if (scegli('time', t)) updateNotice();
      else if (liveSlots.length) setHint(timeHint, t + ' non è disponibile in questa data — scegli un altro orario.', true);
    }
    function changeGuests(delta) {
      const n = Number(guestsInput.value) + delta;
      setHint(guestsHint, n > MAX_GUESTS ? 'Da ' + (MAX_GUESTS + 1) + ' persone in su chiamaci: +39 388 787 7008.' : '');
      if (n < 1 || n > MAX_GUESTS) return;
      guestsInput.value = n;
      loadSlots();
    }
    $('guestsMeno').addEventListener('click', () => changeGuests(-1));
    $('guestsPiu').addEventListener('click', () => changeGuests(1));
    guestsInput.addEventListener('change', () => {
      guestsInput.value = Math.min(MAX_GUESTS, Math.max(1, Math.round(Number(guestsInput.value)) || 1));
      setHint(guestsHint, '');
      loadSlots();
    });
    // Safari su iPhone può cambiare la data senza "change": si ricontrolla anche all'uscita dal campo e prima di "Avanti".
    const cambiaData = () => { if (dateInput.value !== dataCaricata) { validateDate(); loadSlots(); } };
    dateInput.addEventListener('change', cambiaData);
    dateInput.addEventListener('blur', cambiaData);
    roomField.addEventListener('change', loadSlots);
    timeChoices.addEventListener('change', updateNotice);
    waitlistBox.addEventListener('change', updateSubmitLabel);

    // ---- Passi: 1 quando, 2 dati, 3 riepilogo e invio ----
    // Primo campo non valido del passo (quelli nascosti non contano); senza orari mostrati resta il suggerimento.
    function stepValid(n) {
      for (const el of passi[n].querySelectorAll('input, textarea')) {
        if (el.closest('[hidden]') || el.checkValidity()) continue;
        el.reportValidity();
        return false;
      }
      if (n === 0 && dateInput.value !== dataCaricata) { cambiaData(); return false; }
      if (n === 0 && !scelto('time')) {
        if (timeHint.hidden) setHint(timeHint, 'Scegli un orario.', true);
        $('timeField').scrollIntoView({ block: 'center' });
        return false;
      }
      return true;
    }
    function goTo(n) {
      passi.forEach((p, i) => show(p, i === n));
      $('passi').querySelectorAll('li').forEach((li, i) => {
        li.classList.toggle('fatto', i < n);
        if (i === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
      });
      passo = n;
      if (n === 2) renderSummary();
      form.scrollIntoView({ block: 'start' });
      $('passo' + (n + 1) + 'Titolo').focus({ preventScroll: true });
    }
    form.addEventListener('click', e => {
      if (e.target.closest('[data-avanti]')) { if (stepValid(passo)) goTo(passo + 1); }
      else if (e.target.closest('[data-indietro]')) goTo(passo - 1);
    });
    function renderSummary() {
      const v = id => $(id).value.trim();
      const waitlisted = !waitlistWrap.hidden && waitlistBox.checked;
      const rows = [
        ['Nome', v('firstName') + ' ' + v('lastName')],
        ['Telefono', v('phone')],
        ['E-mail', v('email')],
        ['CAP', v('cap')],
        ['Persone', guestsInput.value, true],
        ['Data', fullDate(dateInput.value), true],
        [waitlisted ? 'Orario preferito' : 'Ora', scelto('time') + (waitlisted ? " · lista d'attesa" : ''), true],
        ['Sala', salaScelta(), true]
      ];
      $('riepilogo').replaceChildren(...rows.filter(r => r[1]).flatMap(([k, val, strong]) => {
        const dt = document.createElement('dt'); dt.textContent = k;
        const dd = document.createElement('dd'); dd.textContent = val;
        if (strong) dd.className = 'forte';
        return [dt, dd];
      }));
      updateNotice();
      tutto.checked = caselle().every(c => c.checked);
    }
    // "Accetto tutto" spunta o toglie le caselle mostrate nel passo 3 e segue quelle cambiate a mano.
    const tutto = $('accettaTutto');
    const caselle = () => [ackBox, $('privacy'), $('marketing')].filter(c => !c.closest('[hidden]'));
    tutto.addEventListener('change', () => caselle().forEach(c => { c.checked = tutto.checked; }));
    passi[2].addEventListener('change', e => { if (caselle().includes(e.target)) tutto.checked = caselle().every(c => c.checked); });

    // ---- Invio (POST {"action":"create"}) -----------------------------------
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (passo < 2) { if (stepValid(passo)) goTo(passo + 1); return; } // Invio da tastiera nei primi passi = Avanti
      formError.classList.remove('show');
      if (!stepValid(2)) return;
      if (troppoTardi(dateInput.value, scelto('time'))) { goTo(0); loadSlots(); return; } // l'orario si è avvicinato troppo mentre si compilava il modulo
      const v = id => $(id).value.trim();
      const payload = {
        action: 'create',
        firstName: v('firstName'), lastName: v('lastName'), phone: v('phone'), email: v('email'),
        date: dateInput.value, time: scelto('time'), guests: Number(guestsInput.value),
        notes: 'DOMIZIANA' + (v('notes') ? ' – ' + v('notes') : ''), // la parola dice al locale che la prenotazione arriva da questa pagina (dolce in omaggio)
        privacy: !!$('privacy').checked, marketing: !!$('marketing').checked,
        website: $('website').value
      };
      if (v('cap')) payload.cap = v('cap');
      if (!roomField.hidden && scelto('room')) payload.room = scelto('room');
      if (!waitlistWrap.hidden && waitlistBox.checked) payload.waitlist = true;
      if (!ackWrap.hidden) payload.ackNotice = !!ackBox.checked;
      submitBtn.disabled = true;
      try {
        const { ok, json: j } = await postJson(payload);
        if (ok && j && j.ok) {
          window.dataLayer.push({ event: 'prenotazione_inviata', gruppo });
          if (!payload.waitlist && Number(j.statusCode) !== 8) {
            // Conversione Google Ads: la invia il tag Google caricato da Tag Manager, quindi solo dopo il consenso.
            const conversione = { send_to: 'AW-16777142003/NuUyCJTD26QdEPO9-78-' };
            if (j.code) conversione.transaction_id = String(j.code);
            gtag('event', 'conversion', conversione);
          }
          showSuccess(j, !!payload.waitlist);
        } else {
          formError.textContent = (j && j.error && j.error.message) || 'Non siamo riusciti a inviare la richiesta. Chiamaci o scrivici.';
          formError.classList.add('show');
        }
      } catch {
        formError.textContent = 'Le prenotazioni online non sono disponibili in questo momento — chiamaci o scrivici e ti aiutiamo volentieri.';
        formError.classList.add('show');
      } finally { submitBtn.disabled = false; }
    });
    function showSuccess(j, waitlisted) {
      // Il testo segue lo stato con cui Cooperto ha creato la prenotazione: 2 confermata, 8 lista d'attesa, altrimenti richiesta.
      const stato = waitlisted || Number(j.statusCode) === 8 ? 'attesa' : Number(j.statusCode) === 2 ? 'confermata' : 'richiesta';
      const code = j.code ? String(j.code) : '';
      $('successTitolo').textContent = { confermata: 'Tavolo confermato', richiesta: 'Richiesta ricevuta', attesa: "Sei in lista d'attesa" }[stato];
      const text = $('successTesto');
      text.replaceChildren({
        confermata: 'Fatto: il tuo tavolo è confermato. Tra poco ti arriva il messaggio su WhatsApp. Ci vediamo sulla spiaggia.',
        richiesta: 'Abbiamo ricevuto la tua richiesta. Ti confermiamo il tavolo su WhatsApp il prima possibile.',
        attesa: "Sei in lista d'attesa. Se si libera un tavolo, ti scriviamo noi su WhatsApp."
      }[stato]);
      if (code) { const b = document.createElement('strong'); b.textContent = code; text.append(' Codice: ', b, '.'); }
      if (code) {
        const note = document.createElement('span'); note.className = 'save-code';
        note.textContent = 'Conserva questo codice per controllare o annullare la prenotazione.';
        text.append(note);
        $('lookupCode').value = code; $('lookupPhone').value = $('phone').value.trim(); // pronti per "Controlla la tua prenotazione"
      }
      form.reset(); resetSlotUi(); setHint(dateHint, ''); setHint(guestsHint, ''); loadSlots();
      passi.forEach(p => show(p, false)); show($('passi'), false);
      formSuccess.classList.add('show');
      form.scrollIntoView({ block: 'start' });
      formSuccess.focus({ preventScroll: true });
    }
    $('nuovaPrenotazione').addEventListener('click', () => {
      formSuccess.classList.remove('show'); show($('passi'), true);
      goTo(0);
    });

    // ---- Precompilazione da #reserve?date=YYYY-MM-DD&time=HH:MM&guests=N[&room=CODE] (link diretti al modulo) ----
    function applyHash() {
      const m = /^#reserve\?(.*)$/.exec(location.hash);
      if (!m) return; // un semplice #reserve è l'ancora normale
      const p = new URLSearchParams(m[1]);
      const date = p.get('date'), time = p.get('time'), guests = Number(p.get('guests')), room = p.get('room');
      formError.classList.remove('show'); formSuccess.classList.remove('show'); show($('passi'), true);
      if (isISODate(date)) { dateInput.value = date; validateDate(); }
      if (guests >= 1 && guests <= MAX_GUESTS) guestsInput.value = guests;
      pending.time = isTime(time) ? time : null;
      pending.room = room || null;
      applyPendingRoom();
      goTo(0);
      loadSlots();
    }
    window.addEventListener('hashchange', applyHash);

    // ---- Controlla / annulla una prenotazione (POST {"action":"lookup"} e {"action":"cancel"}) ----
    const lookupToggle = $('lookupToggle'), lookupPanel = $('lookupPanel'), lookupForm = $('lookupForm');
    const lookupError = $('lookupError'), lookupResult = $('lookupResult');
    const cancelBtn = $('cancelBtn'), cancelConfirm = $('cancelConfirm'), cancelYes = $('cancelYes'), cancelNo = $('cancelNo'), cancelStatus = $('cancelStatus');
    let found = null; // { code, phone, reservation }
    lookupToggle.addEventListener('click', () => {
      const open = lookupPanel.hidden;
      show(lookupPanel, open);
      lookupToggle.setAttribute('aria-expanded', String(open));
      if (open) $('lookupCode').focus({ preventScroll: true });
    });
    const lookupFail = text => { lookupError.textContent = text; show(lookupError, true); };
    function renderReservation(r) {
      $('resCode').textContent = r.code || found.code;
      const pill = $('resStatus');
      pill.textContent = STATUS_LABELS[Number(r.statusCode)] || r.status || '—';
      pill.classList.toggle('is-closed', CLOSED_STATES.includes(Number(r.statusCode)));
      $('resWhen').textContent = (isISODate(r.date) ? longDate(r.date) : (r.date || '—')) + (r.time ? ' · ' + r.time : '');
      $('resGuests').textContent = r.guests ? r.guests + (Number(r.guests) === 1 ? ' persona' : ' persone') : '—';
      $('resRoom').textContent = r.room || ''; show($('resRoomRow'), !!r.room); show($('resRoom'), !!r.room);
      show(cancelBtn, !!r.cancellable); show(cancelConfirm, false);
      cancelStatus.textContent = '';
      show(lookupResult, true);
    }
    async function fetchReservation(code, phone) {
      const { ok, status, json: j } = await postJson({ action: 'lookup', code, phone });
      if (ok && j && j.ok && j.reservation) return j.reservation;
      throw Object.assign(new Error('lookup'), { status, message: status === 404 ? 'Non troviamo una prenotazione con questo codice e numero di telefono.' : (j && j.error && j.error.message) || 'Non riusciamo a controllare la prenotazione in questo momento. Chiamaci o scrivici.' });
    }
    lookupForm.addEventListener('submit', async e => {
      e.preventDefault();
      show(lookupError, false); show(lookupResult, false);
      if (!lookupForm.checkValidity()) { lookupForm.reportValidity(); return; }
      const code = $('lookupCode').value.trim(), phone = $('lookupPhone').value.trim();
      const btn = $('lookupBtn'); btn.disabled = true;
      try {
        found = { code, phone, reservation: await fetchReservation(code, phone) };
        renderReservation(found.reservation);
      } catch (err) {
        lookupFail(err && err.status ? err.message : 'La verifica della prenotazione non è disponibile in questo momento — chiamaci o scrivici.');
      } finally { btn.disabled = false; }
    });
    cancelBtn.addEventListener('click', () => { show(cancelBtn, false); show(cancelConfirm, true); cancelYes.focus({ preventScroll: true }); });
    cancelNo.addEventListener('click', () => { show(cancelConfirm, false); show(cancelBtn, true); cancelBtn.focus({ preventScroll: true }); });
    cancelYes.addEventListener('click', async () => {
      if (!found) return;
      cancelYes.disabled = true; cancelNo.disabled = true; show(lookupError, false);
      try {
        const { ok, status, json: j } = await postJson({ action: 'cancel', code: found.code, phone: found.phone });
        // I pulsanti di conferma spariscono in ogni caso: il focus segue l'esito, mai su <body>.
        if (ok && j && j.ok) {
          found.reservation = Object.assign({}, found.reservation, { status: j.status, statusCode: j.statusCode, cancellable: false });
          renderReservation(found.reservation);
          cancelStatus.textContent = "La tua prenotazione è stata annullata. Speriamo di vederti un'altra volta.";
          cancelStatus.focus({ preventScroll: true });
        } else {
          show(cancelConfirm, false);
          lookupFail((j && j.error && j.error.message) || 'Non riusciamo ad annullare la prenotazione in questo momento. Chiamaci o scrivici.');
          if (status === 409) { // già annullata o chiusa: aggiorniamo quello che mostriamo
            try { found.reservation = await fetchReservation(found.code, found.phone); renderReservation(found.reservation); } catch { show(cancelBtn, false); }
            lookupError.focus({ preventScroll: true });
          } else { show(cancelBtn, true); cancelBtn.focus({ preventScroll: true }); }
        }
      } catch {
        show(cancelConfirm, false); show(cancelBtn, true);
        lookupFail("L'annullamento non è disponibile in questo momento — chiamaci o scrivici.");
        cancelBtn.focus({ preventScroll: true });
      } finally { cancelYes.disabled = false; cancelNo.disabled = false; }
    });

    // ---- Avvio ----
    dateInput.min = todayISO(); // niente date passate
    renderHours(STATIC_HOURS);  // lista, riepilogo nel footer (con il giorno di oggi evidenziato)…
    renderToday(STATIC_HOURS);  // …e striscia nell'hero partono dagli orari di riserva, poi passano a quelli live
    let shownDay = todayISO();
    setInterval(() => { if (todayISO() !== shownDay) { shownDay = todayISO(); dateInput.min = shownDay; renderToday(hoursData || STATIC_HOURS); renderHours(hoursData || STATIC_HOURS); } }, 60000); // pagina aperta oltre la mezzanotte
    Promise.all([loadHours(), loadRooms()]).then(() => { loadSlots(); applyHash(); });

    // Clic su chiamata, WhatsApp e indicazioni: un evento per Tag Manager, con il gruppo di annunci (?g=) da cui arriva la visita.
    const gruppo = new URLSearchParams(location.search).get('g') || 'nessuno';
    document.querySelectorAll('[data-azione]').forEach(a => a.addEventListener('click', () => {
      window.dataLayer.push({ event: 'clic_pulsante', azione: a.dataset.azione, gruppo });
    }));

    // Recensioni Google: recensioni.json lo rinnova ogni giorno dalla scheda Google recensioni.php (su GitHub Pages il workflow).
    // Senza dati i blocchi restano nascosti: mai recensioni o voti finti. I testi entrano come testo, mai come HTML.
    const NOMI_LINGUE = { en: 'in inglese', de: 'in tedesco', fr: 'in francese', es: 'in spagnolo' };
    const elemento = (tag, classe, testo) => {
      const el = document.createElement(tag);
      if (classe) el.className = classe;
      if (testo !== undefined) el.textContent = testo;
      return el;
    };
    const linkEsterno = (href, classe, testo) => Object.assign(elemento('a', classe, testo), { href, target: '_blank', rel: 'noopener' });
    // La stessa recensione in riga (recensione-blocco1) o in evidenza (recensione-blocco2).
    function schedaRecensione(r, variante) {
      const scheda = elemento('blockquote', variante + ' recensione-google');
      const testata = elemento('div', 'recensione-testata');
      const autore = elemento('cite');
      autore.append(r.autoreLink ? linkEsterno(r.autoreLink, '', r.autore) : r.autore);
      const n = Math.max(1, Math.min(5, Math.round(Number(r.valutazione))));
      const stelle = elemento('span', '', '★★★★★'.slice(0, n));
      stelle.setAttribute('role', 'img');
      stelle.setAttribute('aria-label', n + ' stelle su 5');
      testata.append(autore, stelle);
      const testo = elemento('p', variante === 'recensione-blocco2' ? 'contenuto-recensione2' : 'contenuto-recensione', '“' + r.testo + '”');
      const mostra = elemento('button', 'mostra-tutto', 'Mostra tutto');
      mostra.type = 'button';
      mostra.hidden = true;
      mostra.setAttribute('aria-expanded', 'false');
      mostra.addEventListener('click', () => {
        const aperta = scheda.classList.toggle('aperta');
        mostra.textContent = aperta ? 'Riduci' : 'Mostra tutto';
        mostra.setAttribute('aria-expanded', String(aperta));
      });
      const parti = [];
      if (r.quando) parti.push(r.quando);
      if (r.lingua && r.lingua !== 'it') parti.push(NOMI_LINGUE[r.lingua] || 'in ' + r.lingua);
      if (r.link) parti.push(linkEsterno(r.link, '', 'Vedi su Google'));
      if (r.segnala) {
        const segnala = linkEsterno(r.segnala, 'segnala', 'Segnala');
        segnala.setAttribute('aria-label', 'Segnala questa recensione a Google');
        parti.push(segnala);
      }
      const dettagli = elemento('p', 'recensione-dettagli');
      parti.forEach((parte, i) => { if (i) dettagli.append(' · '); dettagli.append(parte); });
      scheda.append(testata, testo, mostra, dettagli);
      return scheda;
    }
    // "Mostra tutto" compare solo sulle recensioni che il limite di righe del CSS ha davvero accorciato.
    function aggiornaMostraTutto() {
      document.querySelectorAll('.recensione-google').forEach(scheda => {
        const testo = scheda.querySelector('p');
        scheda.querySelector('.mostra-tutto').hidden = !scheda.classList.contains('aperta') && testo.scrollHeight <= testo.clientHeight + 1;
      });
    }
    function mostraRecensioni(dati) {
      if (!dati || !dati.scelte || !dati.scelte.length) return;
      if (typeof dati.valutazione === 'number' && dati.numeroRecensioni) {
        $('stelle-medie').textContent = dati.valutazione.toFixed(1).replace('.', ',');
        $('conteggio-recensioni').textContent = dati.numeroRecensioni;
        $('dati-recensioni').hidden = false;
        $('link-recensioni').textContent = 'leggile tutte →';
      }
      if (dati.nome) $('nome-scheda').textContent = '«' + dati.nome + '»';
      const mostrate = dati.scelte.slice(0, 3);
      $('recensioni').append(...mostrate.map(r => schedaRecensione(r, 'recensione-blocco1')));
      $('blocco-recensioni').hidden = false;
      // In evidenza va l'altra recensione del file, scelta da chi genera recensioni.json (la più recente tra le altre idonee).
      const chiavi = mostrate.map(r => r.autore + '|' + r.testo);
      const altra = (dati.tutte || []).find(r => !chiavi.includes(r.autore + '|' + r.testo));
      if (altra) {
        const evidenza = schedaRecensione(altra, 'recensione-blocco2');
        evidenza.id = 'recensione-evidenza';
        $('recensione-evidenza').replaceWith(evidenza);
        $('attribuzione-evidenza').hidden = false;
      }
      aggiornaMostraTutto();
      document.fonts.ready.then(aggiornaMostraTutto); // con il carattere definitivo le righe cambiano: va rifatta la misura
    }
    $('vai-nota-recensioni').addEventListener('click', () => { $('nota-recensioni').open = true; });
    let ritardoMostra = null;
    window.addEventListener('resize', () => { clearTimeout(ritardoMostra); ritardoMostra = setTimeout(aggiornaMostraTutto, 150); });
    fetch("recensioni.json", { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).then(mostraRecensioni);

    // Anno nel footer
    document.getElementById('year').textContent = new Date().getFullYear();

    // Banner dei cookie (Linee guida del Garante 10 giugno 2021): "Accetta" e "Rifiuta" identici, la X e il tasto Esc
    // valgono come rifiuto. La scelta dura 6 mesi in localStorage "cookie-consenso" (la stessa chiave della landing
    // /domiziana/, stesso dominio) e si cambia da "Preferenze cookie" nel footer o con index.html#preferenze-cookie.
    // "Accetta" carica Tag Manager con window.caricaTagManager (definita nel <head>).
    (() => {
      const bar = $('storageNotice');
      if (!bar) return;
      const KEY = 'cookie-consenso', MESI = 6;
      const sceltaSalvata = () => {
        let s = null;
        try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return ''; }
        if (!s || (s.scelta !== 'accettati' && s.scelta !== 'rifiutati')) return '';
        const scadenza = new Date(s.quando);
        scadenza.setMonth(scadenza.getMonth() + MESI);
        return Date.now() < scadenza.getTime() ? s.scelta : '';
      };
      // Revoca: cancella i cookie e la memoria che i tag di Google hanno impostato su questo dominio.
      const cancellaCookieGoogle = () => {
        const parti = location.hostname.split('.');
        document.cookie.split(';').forEach(c => {
          const nome = c.split('=')[0].trim();
          if (!/^(_gcl_|_gac_|_ga|_gid|_gat)/.test(nome)) return;
          document.cookie = nome + '=; Max-Age=0; path=/';
          for (let i = 0; i < parti.length - 1; i++) document.cookie = nome + '=; Max-Age=0; path=/; domain=' + parti.slice(i).join('.');
        });
        try { localStorage.removeItem('_gcl_ls'); } catch { /* archiviazione non disponibile */ }
      };
      // Finché la barra è visibile: ciò che viene portato in vista (es. il pulsante di invio raggiunto con Tab)
      // resta sopra di essa, e il footer riceve lo stesso spazio in più così la riga legale si può leggere.
      const root = document.documentElement;
      const pad = () => {
        const space = bar.hidden ? 0 : Math.ceil(window.innerHeight - bar.getBoundingClientRect().top + 12);
        root.style.scrollPaddingBottom = space ? space + 'px' : '';
        root.style.setProperty('--notice-space', space + 'px');
        document.body.classList.toggle('has-notice', !bar.hidden);
      };
      const mostra = () => { bar.hidden = false; pad(); window.addEventListener('resize', pad); };
      bar.querySelectorAll('[data-consenso]').forEach(b => b.addEventListener('click', () => {
        const scelta = b.dataset.consenso;
        try { localStorage.setItem(KEY, JSON.stringify({ scelta, quando: Date.now() })); } catch { /* archiviazione non disponibile: la scelta vale per questa visita */ }
        bar.hidden = true;
        pad();
        window.removeEventListener('resize', pad);
        if (scelta === 'accettati') { window.caricaTagManager(); return; }
        if (window.tagManagerCaricato) {
          window.gtag('consent', 'update', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' });
          cancellaCookieGoogle();
          location.reload();
        }
      }));
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && !bar.hidden) bar.querySelector('.storage-notice-chiudi').click(); });
      $('preferenze-cookie').addEventListener('click', e => { e.preventDefault(); mostra(); });
      if (location.hash === '#preferenze-cookie') { history.replaceState(null, '', location.pathname + location.search); mostra(); }
      else if (!sceltaSalvata()) mostra();
    })();
  
