/* Percorso guidato Vivantech: prenotazione consulenza gratuita (showroom o casa) + QR personale per la prova a casa.
   Nessun prezzo online: il sito porta il cliente a un appuntamento.
   I contatti arrivano tramite Netlify Forms (modulo "consulenza"); da lì un webhook li porta in Go High Level. */
import qrcode from './qrcode.mjs';

const $ = s => document.querySelector(s);
const BASE = location.origin;

// codice cliente breve e leggibile (niente 0/O, 1/I): VT-7K3M9Q
export function nuovoCodice() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const b = new Uint8Array(6); (crypto.getRandomValues ? crypto.getRandomValues(b) : b.forEach((_, i) => b[i] = Math.random() * 255));
  return 'VT-' + Array.from(b, x => A[x % A.length]).join('');
}

// link della prova a casa: tutto nell'indirizzo, nessun dato personale
export function linkProva(sel, codice) {
  const q = new URLSearchParams({ m: sel.mat, mod: sel.model, c: sel.colorKey, id: codice });
  return `${BASE}/prova/?${q}`;
}

export function disegnaQR(el, testo) {
  const q = qrcode(0, 'M'); q.addData(testo); q.make();
  el.innerHTML = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true, alt: 'QR code per la prova a casa' });
}

export function initConsulenza(getSel) {
  const box = $('#book'), form = $('#bForm');
  let tipo = 'showroom', codice = null;
  const steps = box.querySelectorAll('[data-step]');
  const show = n => { steps.forEach(s => s.hidden = s.dataset.step !== n); const f = box.querySelector(`[data-step="${n}"] h3, [data-step="${n}"] [autofocus]`); f && f.focus && f.focus({ preventScroll: true }); box.querySelector('.bk').scrollTop = 0; };
  const riepilogo = () => { const s = getSel(); return `${s.label} · ${s.model} · ${s.colorName}`; };

  function apri(step = '1') {
    codice = codice || nuovoCodice();
    box.querySelectorAll('.bSel').forEach(e => e.textContent = riepilogo());
    box.hidden = false; document.body.classList.add('booking'); show(step);
    if (step === 'qr') mostraQR();
  }
  function chiudi() { box.hidden = true; document.body.classList.remove('booking'); }
  function mostraQR() {
    const url = linkProva(getSel(), codice);
    box.querySelectorAll('.qrBox').forEach(el => disegnaQR(el, url));
    box.querySelectorAll('.qrLink').forEach(a => a.href = url);
    box.querySelectorAll('.qrCode').forEach(e => e.textContent = codice);
  }
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
    form.elements['materiale'].value = s.label; form.elements['modello'].value = s.model;
    form.elements['colore'].value = s.colorName; form.elements['codice'].value = codice;
    form.elements['link_prova'].value = linkProva(s, codice);
    const btn = form.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'Invio in corso…';
    let ok = false;
    try { const r = await fetch('/', { method: 'POST', body: new FormData(form) }); ok = r.ok; } catch (_) { ok = false; }
    btn.disabled = false; btn.textContent = 'Prenota la consulenza gratuita';
    $('#bEsito').hidden = ok; // se l'invio non riesce, mostriamo il numero da chiamare
    $('#bGrazieTitolo').textContent = ok ? 'Richiesta ricevuta, grazie!' : 'Quasi fatto: chiamaci per confermare';
    $('#bGrazieTesto').textContent = ok
      ? (tipo === 'showroom' ? 'Ti chiamiamo entro un giorno lavorativo per fissare l’orario in showroom. Ricordati le due foto della finestra.' : 'Ti chiamiamo entro un giorno lavorativo per fissare la visita del tecnico a casa tua.')
      : 'La richiesta non è partita. Chiamaci allo 031 8130087 e cita il tuo codice: ti fissiamo subito l’appuntamento.';
    mostraQR(); show('3');
  });

  // dalla pagina "prova a casa": #prenota apre direttamente la prenotazione
  return { apri, chiudi };
}
