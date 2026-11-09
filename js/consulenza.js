/* Funnel Vivantech: priorità -> materiale -> 3 soluzioni (senza prezzo) -> appuntamento.
   La prova a casa (QR) è un regalo: si sblocca solo in showroom o alla visita del tecnico.
   I contatti arrivano tramite Netlify Forms (modulo "consulenza"); un webhook li porta in Go High Level. */
import qrcode from './qrcode.mjs';

const $ = s => document.querySelector(s);

/* ---------- priorità del cliente ---------- */
export const PRIORITA = {
  sicurezza: { t: 'Sicurezza', s: 'Protezione e antieffrazione', ico: '🛡️', mat: 'pvc' },
  luce: { t: 'Luce & Design', s: 'Profilo minimale, massima luminosità', ico: '☀️', mat: 'alu' },
  silenzio: { t: 'Insonorizzazione', s: 'Lasciare fuori i rumori', ico: '🤫', mat: 'fib' }
};
let prio = null;
try { prio = sessionStorage.getItem('vt-prio'); } catch (_) {}
export const getPrio = () => (PRIORITA[prio] ? prio : null);
export const setPrio = p => { prio = p; try { sessionStorage.setItem('vt-prio', p); } catch (_) {} };

/* beneficio per materiale x priorità: solo dati delle schede prodotto */
export const BENEFICIO = {
  pvc: {
    sicurezza: 'Il PVC 80 arriva fino alla classe antieffrazione WK3: profilo a 7 camere con rinforzi in acciaio e 3 guarnizioni.',
    luce: 'Brillant 70 e PVC 80 sono i profili più robusti. Se la luce viene prima di tutto, guarda anche il VLS: nodo centrale da 90 mm.',
    silenzio: 'Il PVC 80 arriva fino a 46 dB di isolamento acustico, con 7 camere e 3 guarnizioni.'
  },
  fib: {
    sicurezza: 'Il P76 NEO è rinforzato in ultrafibra; con vetri stratificati e ferramenta antieffrazione alziamo la protezione al livello che ti serve.',
    luce: 'Il 70 EVO ha il nodo centrale sottile: più vetro e più luce, con un profilo pulito.',
    silenzio: 'Il 70 EVO arriva fino a 46 dB, il P76 NEO fino a 44 dB con tre guarnizioni per la tenuta.'
  },
  alu: {
    sicurezza: 'Il VLS accoglie vetri fino a 48 mm: c’è spazio per vetri stratificati di sicurezza, con anticorrosione di serie.',
    luce: 'Il VLS ha nodo laterale da 82 mm e centrale da 90 mm: fino al 30% di luce in più, anche con anta smussata a 17°.',
    silenzio: 'Il VLS ha tre guarnizioni di serie e vetri fino a 48 mm, per vetrocamere acustiche importanti.'
  }
};

/* le tre soluzioni (good-better-best), senza prezzo: composizione indicativa */
export const SOLUZIONI = {
  sicurezza: [
    { n: 'A · Essenziale', d: 'Vetrocamera con lastra stratificata 33.1 sul lato interno, ferramenta di serie con nottolini a fungo sul lato maniglia. Protegge dagli urti e dalle effrazioni improvvisate.' },
    { n: 'B · Consigliata', d: 'Stratificati 33.1 su entrambi i lati, nottolini a fungo su tutto il perimetro con riscontri in acciaio, maniglia con chiave e protezione antitrapano. La protezione che chiede chi vive al piano terra.' },
    { n: 'C · Eccellenza', d: 'Pacchetto in classe antieffrazione RC2 certificata: vetro P4A antisfondamento, ferramenta e fissaggi di sicurezza, sensori di apertura predisposti per l’allarme.' }],
  luce: [
    { n: 'A · Essenziale', d: 'Profilo standard con doppio vetro basso emissivo: più luce e meno dispersione di oggi.' },
    { n: 'B · Consigliata', d: 'Nodo centrale ridotto e vetro extrachiaro: più superficie vetrata e luce più naturale.' },
    { n: 'C · Eccellenza', d: 'Profilo minimale, triplo vetro extrachiaro con canalina scura e colore su misura per la tua facciata.' }],
  silenzio: [
    { n: 'A · Essenziale', d: 'Vetrocamera asimmetrica (lastre di spessore diverso, es. 4 + 6 mm): spezza le frequenze del traffico e abbassa il rumore di fondo rispetto ai vecchi infissi.' },
    { n: 'B · Consigliata', d: 'Vetro acustico stratificato con PVB silent sul lato strada, tre guarnizioni e posa con nastri autoespandenti e sigillatura continua: il rumore non passa dal vetro né dal giunto.' },
    { n: 'C · Eccellenza', d: 'Triplo vetro acustico con due stratificati silent, cassonetto isolato e posa certificata: per la camera da letto su strada trafficata o lo studio dove serve concentrazione.' }]
};

/* ---------- codice cliente con controllo (deterrente: il sito è pubblico) ---------- */
const ALF = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const chk = s => ALF[[...s].reduce((a, c, i) => (a * 31 + ALF.indexOf(c) * (i + 7) + 17) % 9973, 7016) % ALF.length];
export function nuovoCodice() {
  const b = new Uint8Array(5); crypto.getRandomValues(b);
  const s = Array.from(b, x => ALF[x % ALF.length]).join('');
  return 'VT-' + s + chk(s);
}
export const codiceValido = c => /^VT-[A-Z2-9]{6}$/.test(c || '') && chk(c.slice(3, 8)) === c[8];
export function linkProva(sel, codice) {
  const q = new URLSearchParams({ m: sel.mat, mod: sel.model, c: sel.colorKey, ce: sel.colorOutKey || sel.colorKey, h: sel.handle || 'classica', hf: sel.finish || 'argento', id: codice });
  return `${location.origin}/prova/?${q}`;
}
export function disegnaQR(el, testo) {
  const q = qrcode(0, 'M'); q.addData(testo); q.make();
  el.innerHTML = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true, alt: 'QR code per la prova a casa' });
}

/* ---------- finestra di prenotazione ---------- */
export function initConsulenza(getSel) {
  const box = $('#book'), form = $('#bForm');
  let tipo = 'showroom', codice = null;
  const steps = box.querySelectorAll('[data-step]');
  const show = n => { steps.forEach(s => s.hidden = s.dataset.step !== n); const h = box.querySelector(`[data-step="${n}"] h3`); h && h.focus({ preventScroll: true }); box.querySelector('.bk').scrollTop = 0; };
  const riepilogo = () => { const s = getSel(); return `${s.label} ${s.model} · interno ${s.colorName}, esterno ${s.colorOutName} · maniglia ${s.handleName.toLowerCase()} ${s.finishName.toLowerCase()}`; };

  function soluzioni() {
    const p = getPrio() || 'luce', el = $('#bSol');
    $('#bPrioName').textContent = PRIORITA[p].t.toLowerCase();
    el.innerHTML = SOLUZIONI[p].map((x, i) => `<button type="button" class="sol${i === 1 ? ' best' : ''}" data-sol="${x.n}" aria-pressed="${i === 1}">${i === 1 ? '<span class="solBadge">Consigliata per te</span>' : ''}<b>${x.n}</b><span>${x.d}</span></button>`).join('');
    form.elements['soluzione'].value = SOLUZIONI[p][1].n;
    el.querySelectorAll('.sol').forEach(b => b.addEventListener('click', () => {
      el.querySelectorAll('.sol').forEach(o => o.setAttribute('aria-pressed', o === b));
      form.elements['soluzione'].value = b.dataset.sol;
    }));
  }
  function apri(step = '1') {
    codice = codice || nuovoCodice();
    box.querySelectorAll('.bSel').forEach(e => e.textContent = riepilogo());
    soluzioni();
    box.hidden = false; document.body.classList.add('booking'); show(step);
  }
  function chiudi() { box.hidden = true; document.body.classList.remove('booking'); }
  function scegli(t) {
    tipo = t; form.elements['tipo'].value = t;
    box.querySelectorAll('[data-solo]').forEach(e => e.hidden = e.dataset.solo !== t);
    $('#bFormTitle').textContent = t === 'showroom' ? 'Vieni a trovarci in showroom' : 'Un nostro tecnico viene da te';
    show('2');
  }

  box.querySelector('#bClose').addEventListener('click', chiudi);
  box.addEventListener('keydown', e => { if (e.key === 'Escape') chiudi(); });
  box.querySelectorAll('[data-scelta]').forEach(b => b.addEventListener('click', () => scegli(b.dataset.scelta)));
  box.querySelectorAll('[data-indietro]').forEach(b => b.addEventListener('click', () => show(b.dataset.indietro)));

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const s = getSel();
    form.elements['priorita'].value = (PRIORITA[getPrio()] || {}).t || 'non indicata';
    form.elements['materiale'].value = s.label; form.elements['modello'].value = s.model;
    form.elements['colore'].value = s.colorName; form.elements['colore_esterno'].value = s.colorOutName;
    form.elements['maniglia'].value = s.handleName; form.elements['finitura_maniglia'].value = s.finishName;
    form.elements['codice'].value = codice;
    form.elements['link_prova'].value = linkProva(s, codice);
    const btn = form.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'Invio in corso…';
    let ok = false;
    try { const r = await fetch('/', { method: 'POST', body: new FormData(form) }); ok = r.ok; } catch (_) { ok = false; }
    btn.disabled = false; btn.textContent = 'Prenota e sblocca il regalo';
    $('#bGrazieTitolo').textContent = ok ? 'Fatto. Il tuo regalo ti aspetta.' : 'Quasi fatto: chiamaci per confermare';
    $('#bGrazieTesto').textContent = ok
      ? (tipo === 'showroom'
        ? 'Ti chiamiamo entro un giorno lavorativo per fissare l’orario in showroom. Porta le due foto della finestra: all’appuntamento ti consegniamo il QR personale per provare la finestra sulla tua casa.'
        : 'Ti chiamiamo entro un giorno lavorativo per fissare la visita del tecnico. Al sopralluogo ti consegniamo il QR personale per provare la finestra sulla tua casa.')
      : 'La richiesta non è partita. Chiamaci allo 031 8130087 e cita il codice qui sotto: ti fissiamo subito l’appuntamento.';
    box.querySelectorAll('.qrCode').forEach(e => e.textContent = codice);
    show('3');
  });
  return { apri, chiudi };
}
