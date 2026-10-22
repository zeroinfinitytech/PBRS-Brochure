/* PBRS brochure editor. Edit text in place, swap or re-crop any photo from the library or your own file, leave review notes, and send them to GitHub.
   Changes are kept in this browser (localStorage); Export / Import moves them between people; "Send review" opens a prefilled GitHub issue. */
(function () {
'use strict';
var CFG = window.ED_CONFIG || {};
var KEY = 'pbrs-brochure-edits-v1:' + (CFG.id || 'a');
var LIB = (window.ED_LIBRARY || []);
var $ = function (s, r) { return (r || document).querySelector(s); }, $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var state = { texts: {}, images: {}, notes: [] }, orig = { texts: {}, images: {} }, mode = 'edit';

function load() { try { var s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) state = { texts: s.texts || {}, images: s.images || {}, notes: s.notes || [] }; } catch (e) { } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { toast('Could not save in this browser (storage full?). Use Export.'); } status(); }
function toast(m) { var t = $('#ed-toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(function () { t.classList.remove('on'); }, 2600); }
function status() { var c = $('#ed-nc'); if (c) c.textContent = state.notes.length; }

/* ---- prepare the page: wrap pages in a stage, tag text leaves and images ---- */
var BLOCK = /^(DIV|P|H1|H2|H3|H4|UL|OL|LI|TABLE|TR|TD|TH|SECTION|IMG|HEADER|FOOTER|FIGURE)$/;
function prepare() {
  var pages = $$('.page'); var stage = document.createElement('div'); stage.id = 'ed-stage';
  pages[0].parentNode.insertBefore(stage, pages[0]);
  pages.forEach(function (p, i) { var c = document.createElement('div'); c.className = 'ed-cap'; c.textContent = (CFG.captions && CFG.captions[i]) || (i === 0 ? 'Outside: flap, back, cover' : 'Inside'); stage.appendChild(c); stage.appendChild(p); });
  var n = 0;
  $$('.page *').forEach(function (el) {
    if (el.tagName === 'IMG') { if (/logo/i.test(el.getAttribute('src') || '')) return; el.setAttribute('data-ed-img', ++n); orig.images[n] = { src: el.getAttribute('src'), style: el.getAttribute('style') || '' }; return; }
    var hasText = false, blockKid = false;
    for (var k = el.firstChild; k; k = k.nextSibling) { if (k.nodeType === 3 && k.textContent.trim()) hasText = true; if (k.nodeType === 1 && BLOCK.test(k.tagName)) blockKid = true; }
    if (hasText && !blockKid) { el.setAttribute('data-ed-text', ++n); orig.texts[n] = el.innerHTML; }
  });
  fit();
}
function fit() { var w = (CFG.widthMm || 303) * 3.7795; var vw = Math.min(window.innerWidth, document.documentElement.clientWidth || window.innerWidth); var z = Math.min(CFG.maxZoom || 1.45, (vw - 20) / w); $$('#ed-stage .page').forEach(function (p) { p.style.zoom = z; }); }

/* ---- apply stored changes ---- */
function applyAll() {
  Object.keys(state.texts).forEach(function (id) { var el = $('[data-ed-text="' + id + '"]'); if (el) el.innerHTML = state.texts[id]; });
  Object.keys(state.images).forEach(function (id) { var el = $('[data-ed-img="' + id + '"]'); if (el) paintImg(el, state.images[id]); });
  pins();
}
function paintImg(el, v) {
  if (v.src) el.setAttribute('src', v.src);
  var z = Math.max(1, Number(v.z) || 1), px = v.x == null ? 50 : v.x, py = v.y == null ? 50 : v.y;
  el.style.objectFit = 'cover';
  el.style.objectPosition = px + '% ' + py + '%';
  var vv = (1 - 1 / z) * 100;
  el.style.objectViewBox = z > 1 ? 'inset(' + (vv * py / 100).toFixed(2) + '% ' + (vv * (100 - px) / 100).toFixed(2) + '% ' + (vv * (100 - py) / 100).toFixed(2) + '% ' + (vv * px / 100).toFixed(2) + '%)' : '';
}

/* ---- popovers ---- */
function pop(html, anchor, wide) {
  closePop(); var d = document.createElement('div'); d.className = 'ed-pop'; d.innerHTML = html; document.body.appendChild(d);
  var r = anchor ? anchor.getBoundingClientRect() : { left: innerWidth / 2 - 200, top: 120, width: 0, height: 0, bottom: 140 };
  var w = d.offsetWidth, h = d.offsetHeight;
  var left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2));
  var top = r.bottom + 10; if (top + h > innerHeight - 8) top = Math.max(64, r.top - h - 10); if (top + h > innerHeight - 8) top = 64;
  d.style.left = left + 'px'; d.style.top = top + 'px'; if (wide) d.style.width = wide;
  return d;
}
function closePop() { $$('.ed-pop').forEach(function (p) { p.remove(); }); }
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

/* ---- image picker ---- */
function pickImage(el) {
  var id = el.getAttribute('data-ed-img'), cur = state.images[id] || { src: null, z: 1, x: 50, y: 50 };
  var d = pop('<h4>Change this photo</h4><div class="bd"><div class="ed-grid" id="edg">' +
    LIB.map(function (p) { return '<button data-src="' + CFG.library + p[0] + '" title="' + esc(p[1]) + '"><img loading="lazy" src="' + CFG.library + 'thumb/' + p[0] + '"><span>' + p[2] + '</span></button>'; }).join('') +
    '</div><label>Or upload your own photo (JPG or PNG)</label><input type="file" id="edf" accept="image/*">' +
    '<label>Zoom <span id="edzv"></span></label><input type="range" id="edz" min="1" max="3" step="0.05" value="' + (cur.z || 1) + '">' +
    '<label>Move left / right</label><input type="range" id="edx" min="0" max="100" value="' + (cur.x == null ? 50 : cur.x) + '">' +
    '<label>Move up / down</label><input type="range" id="edy" min="0" max="100" value="' + (cur.y == null ? 50 : cur.y) + '">' +
    '</div><div class="ft"><button class="dng" id="edr">Reset photo</button><button class="pri" id="edok">Done</button></div>', el, '560px');
  function commit(extra) { var v = state.images[id] || { src: null }; Object.assign(v, extra); state.images[id] = v; paintImg(el, v); save(); }
  function live() { commit({ z: Number($('#edz', d).value), x: Number($('#edx', d).value), y: Number($('#edy', d).value) }); $('#edzv', d).textContent = Number($('#edz', d).value).toFixed(2) + 'x'; }
  ['#edz', '#edx', '#edy'].forEach(function (s) { $(s, d).addEventListener('input', live); }); $('#edzv', d).textContent = Number($('#edz', d).value).toFixed(2) + 'x';
  $$('#edg button', d).forEach(function (b) { b.addEventListener('click', function () { commit({ src: b.getAttribute('data-src'), z: 1, x: 50, y: 50 }); $('#edz', d).value = 1; $('#edx', d).value = 50; $('#edy', d).value = 50; toast('Photo changed'); }); });
  $('#edf', d).addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0]; if (!f) return; var rd = new FileReader();
    rd.onload = function () { var im = new Image(); im.onload = function () { var m = 1800, k = Math.min(1, m / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); commit({ src: c.toDataURL('image/jpeg', .88), z: 1, x: 50, y: 50 }); toast('Your photo is in'); }; im.src = rd.result; };
    rd.readAsDataURL(f);
  });
  $('#edr', d).addEventListener('click', function () { delete state.images[id]; el.setAttribute('src', orig.images[id].src); el.setAttribute('style', orig.images[id].style); save(); closePop(); toast('Photo reset'); });
  $('#edok', d).addEventListener('click', closePop);
}

/* ---- review notes ---- */
function labelFor(el) {
  var p = el.closest('.page'), pi = $$('.page').indexOf(p), pn = el.closest('.panel'), pcls = pn ? (pn.className.match(/p[123]/) || [''])[0] : '';
  var name = { 0: { p1: 'Flap', p2: 'Back', p3: 'Cover' }, 1: { p1: 'Inside left', p2: 'Inside middle', p3: 'Inside right' } }[pi] || {};
  var t = el.hasAttribute('data-ed-img') ? 'Photo' : (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 50);
  return ((CFG.pageNames && CFG.pageNames[pi]) || name[pcls] || 'Page') + ' / ' + t;
}
function addNote(el, ev) {
  var id = el.getAttribute('data-ed-text') || el.getAttribute('data-ed-img'), kind = el.hasAttribute('data-ed-img') ? 'img' : 'text';
  var d = pop('<h4>Add a review note</h4><div class="bd"><div style="color:#5a6c7e;font-size:12px;margin-bottom:6px">' + esc(labelFor(el)) + '</div><textarea id="edn" placeholder="What should change here? (wording, photo, spacing, a fact to check)"></textarea></div><div class="ft"><button id="edc">Cancel</button><button class="pri" id="eds">Add note</button></div>', el);
  var r = el.getBoundingClientRect(), pg = el.closest('.page').getBoundingClientRect();
  $('#edc', d).addEventListener('click', closePop);
  $('#eds', d).addEventListener('click', function () { var t = $('#edn', d).value.trim(); if (!t) return; state.notes.push({ id: id, kind: kind, label: labelFor(el), text: t, at: new Date().toISOString().slice(0, 16).replace('T', ' ') }); save(); pins(); closePop(); toast('Note added'); });
  $('#edn', d).focus();
}
function pins() {
  $$('.ed-pin').forEach(function (p) { p.remove(); });
  state.notes.forEach(function (n, i) {
    var el = $('[data-ed-text="' + n.id + '"],[data-ed-img="' + n.id + '"]'); if (!el) return; var page = el.closest('.page'); if (!page) return;
    var z = parseFloat(page.style.zoom) || 1, r = el.getBoundingClientRect(), pr = page.getBoundingClientRect();
    var pin = document.createElement('div'); pin.className = 'ed-pin'; pin.textContent = i + 1; pin.style.left = ((r.left - pr.left) / z + Math.min(14, r.width / z / 2)) + 'px'; pin.style.top = ((r.top - pr.top) / z + 4) + 'px';
    pin.addEventListener('click', function (e) { e.stopPropagation(); showNotes(); }); page.appendChild(pin);
  });
}
function showNotes() {
  var d = pop('<h4>Review notes (' + state.notes.length + ')</h4><div class="bd">' + (state.notes.length ? state.notes.map(function (n, i) { return '<div class="ed-note"><i>' + (i + 1) + '</i><div><b>' + esc(n.label) + '</b><div>' + esc(n.text) + '</div><small>' + n.at + ' <a href="#" data-del="' + i + '">remove</a></small></div></div>'; }).join('') : '<p style="color:#5a6c7e">No notes yet. Tap any text or photo on the page to add one.</p>') + '</div><div class="ft"><button id="edx2">Close</button><button class="pri" id="edsend">Send feedback</button></div>', null, '520px');
  $('#edx2', d).addEventListener('click', closePop); $('#edsend', d).addEventListener('click', function () { closePop(); sendReview(); });
  $$('[data-del]', d).forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); state.notes.splice(+a.getAttribute('data-del'), 1); save(); pins(); showNotes(); }); });
}
function changesSummary() {
  var out = [];
  Object.keys(state.texts).forEach(function (id) { var el = $('[data-ed-text="' + id + '"]'); var a = txt(orig.texts[id]), b = txt(state.texts[id]); if (a !== b) out.push('- Text (' + (el ? labelFor(el) : id) + '): "' + a.slice(0, 120) + '" -> "' + b.slice(0, 160) + '"'); });
  Object.keys(state.images).forEach(function (id) { var el = $('[data-ed-img="' + id + '"]'); var v = state.images[id]; out.push('- Photo (' + (el ? labelFor(el) : id) + '): ' + (v.src ? (v.src.indexOf('data:') === 0 ? 'own upload' : v.src.split('/').pop()) : 'same photo') + (v.z > 1 ? ', zoom ' + Number(v.z).toFixed(2) + 'x' : '')); });
  return out;
}
function txt(h) { var d = document.createElement('div'); d.innerHTML = h; return (d.textContent || '').replace(/\s+/g, ' ').trim(); }
function sendReview() {
  var d = pop('<h4>Send your feedback to the Zero Infinity team</h4><div class="bd"><div style="color:#5a6c7e;font-size:12.5px;margin-bottom:6px">' + state.notes.length + ' note' + (state.notes.length === 1 ? '' : 's') + ' will be included. Name and email are optional; add your email if you would like a reply.</div>' +
    '<label>Your name (optional)</label><input type="text" id="edfn" autocomplete="name"><label>Your email (optional)</label><input type="text" id="edfe" autocomplete="email" inputmode="email">' +
    '<label>Anything else you would like to say</label><textarea id="edfm" placeholder="Overall comments, changes you would like, questions"></textarea><div id="edfs" style="margin-top:8px;font-size:12.5px;color:#a3262a"></div></div>' +
    '<div class="ft"><button id="edfc">Cancel</button><button class="pri" id="edfg">Send</button></div>', null, '460px');
  $('#edfc', d).addEventListener('click', closePop);
  $('#edfg', d).addEventListener('click', function () {
    var NL = String.fromCharCode(10), notes = state.notes.map(function (n, i) { return (i + 1) + '. [' + n.label + '] ' + n.text; }).join(NL);
    var msg = $('#edfm', d).value.trim(), email = $('#edfe', d).value.trim();
    if (!notes && !msg) { $('#edfs', d).textContent = 'Add a note on the page or write a comment first.'; return; }
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { $('#edfs', d).textContent = 'That email address does not look right.'; return; }
    var btn = $('#edfg', d); btn.disabled = true; btn.textContent = 'Sending...';
    var payload = { brochure: CFG.title || '', name: $('#edfn', d).value.trim(), email: email, comment: msg, notes: notes || '(no notes)', page: location.href.split('#')[0], sent_at: new Date().toISOString() };
    fetch(CFG.endpoint, { method: 'POST', body: JSON.stringify(payload) })
      .then(function (r) { if (!r.ok) throw new Error('failed'); return r.json().catch(function () { return {}; }); })
      .then(function () { closePop(); state.notes = []; save(); pins(); toast('Thank you. Your feedback was sent to the Zero Infinity team.'); })
      .catch(function () {
        btn.disabled = false; btn.textContent = 'Send';
        $('#edfs', d).innerHTML = 'Could not send right now. <a href="#" id="edfm2">Send by email instead</a>';
        $('#edfm2', d).addEventListener('click', function (e) { e.preventDefault(); window.location.href = 'mailto:' + (CFG.feedbackTo || 'zeroinfinityinfotech@gmail.com') + '?subject=' + encodeURIComponent('PBRS brochure feedback: ' + (CFG.title || '')) + '&body=' + encodeURIComponent((msg ? msg + NL + NL : '') + notes); });
      });
  });
}

/* ---- toolbar: Review, Download PDF, Print and nothing more ---- */
function bar() {
  var b = document.createElement('div'); b.id = 'ed-bar';
  var tabs = (CFG.tabs || []).map(function (t) { return '<a class="tab' + (t.on ? ' on' : '') + '" href="' + t.href + '">' + t.label + '</a>'; }).join('');
  b.innerHTML = '<b class="br">' + (CFG.brand || 'PBRS review') + '</b>' + tabs + '<span class="sp"></span><button id="ed-m-rev">Review</button><button id="ed-dl" class="go">Download PDF</button><button id="ed-print">Print</button>';
  document.body.appendChild(b); document.body.classList.add('ed-on');
  var t = document.createElement('div'); t.id = 'ed-toast'; document.body.appendChild(t);
  var rv = document.createElement('div'); rv.id = 'ed-rv';
  rv.innerHTML = '<span>Tap any text or photo to leave a note.</span><button id="ed-notes">Notes (<i id="ed-nc">0</i>)</button><button class="go" id="ed-send">Send feedback</button>';
  document.body.appendChild(rv);
  $('#ed-m-rev').onclick = function () { setMode(mode === 'review' ? 'view' : 'review'); };
  $('#ed-dl').onclick = function () { var a = document.createElement('a'); a.href = CFG.pdf; a.download = CFG.pdfName || 'PBRS.pdf'; document.body.appendChild(a); a.click(); a.remove(); toast('Downloading the PDF'); };
  $('#ed-print').onclick = function () { closePop(); window.print(); };
  $('#ed-notes').onclick = showNotes; $('#ed-send').onclick = sendReview;
}
function setMode(m) { mode = m; document.body.classList.toggle('ed-review', m === 'review'); document.body.classList.toggle('ed-rvon', m === 'review'); var r = $('#ed-m-rev'); if (r) r.classList.toggle('on', m === 'review'); closePop(); }

document.addEventListener('DOMContentLoaded', function () {
  load(); prepare(); bar(); applyAll(); setMode('view'); status();
  window.addEventListener('resize', function () { fit(); pins(); });
  document.addEventListener('input', function (e) { var el = e.target.closest && e.target.closest('[data-ed-text]'); if (!el) return; var id = el.getAttribute('data-ed-text'); if (el.innerHTML === orig.texts[id]) delete state.texts[id]; else state.texts[id] = el.innerHTML; save(); });
  document.addEventListener('click', function (e) {
    if (e.target.closest('#ed-bar,.ed-pop,.ed-pin,#ed-help')) return;
    var img = e.target.closest('[data-ed-img]'), tx = e.target.closest('[data-ed-text]');
    
    if (mode === 'review' && (img || tx)) { e.preventDefault(); addNote(img || tx, e); return; }
    if (!img) closePop();
  }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closePop(); $('#ed-help').classList.remove('on'); } if (mode === 'edit' && e.key === 'Enter' && e.target.closest && e.target.closest('[data-ed-text]') && !e.shiftKey) { /* keep plain line breaks */ } });
});
})();
