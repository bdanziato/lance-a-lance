/* Lance a Lance — interface */
'use strict';
(function(){
const $ = id => document.getElementById(id);
const store = {
  get(k){ try { return JSON.parse(localStorage.getItem(k)); } catch(e){ return null; } },
  set(k,v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} },
  del(k){ try { localStorage.removeItem(k); } catch(e){} }
};
const esc = s => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const avg = xs => xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : null;
const pct = (a,b) => b ? Math.round(a/b*100) : 0;
const plural = (n, a, b) => n===1 ? a : b;
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;

/* ---------- configurações ---------- */
const S = Object.assign({user:'', sound:true, elo:800, off:0, color:'w', tc:'600+0', pz:900, pzDone:{}, pzDay:'', pzToday:0, pzStreak:0, learn:{}}, store.get('lal3') || {});
if (!S.user){ const old = store.get('lal2-settings'); if (old && old.user){ S.user = old.user; S.elo = old.elo || S.elo; } }
const save = () => store.set('lal3', S);

let toastT = 0;
function toast(t){ const el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => el.hidden = true, 2600); }

/* ---------- som ---------- */
let actx = null;
function snd(kind){
  if (!S.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const t = actx.currentTime, o = actx.createOscillator(), gn = actx.createGain();
    const f = {move:500, capture:300, check:760, end:392, ok:880, bad:200}[kind] || 500;
    o.type = kind==='capture' || kind==='bad' ? 'square' : 'triangle';
    o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f*(kind==='ok'?1.5:0.7), t+0.09);
    gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(kind==='capture'||kind==='bad'?0.08:0.18, t+0.005); gn.gain.exponentialRampToValueAtTime(0.0001, t+(kind==='end'?0.45:0.12));
    o.connect(gn); gn.connect(actx.destination); o.start(t); o.stop(t+0.5);
  } catch(e){}
}
function soundOf(mv, g){ if (g.game_over()) return 'end'; if (g.in_check()) return 'check'; if (mv.captured) return 'capture'; return 'move'; }

/* =====================================================================
   Tabuleiro
   ===================================================================== */
function arrowSvg(sqXY, from, to, color, op){
  const [x1,y1] = sqXY(from).map(v=>v+0.5), [x2,y2] = sqXY(to).map(v=>v+0.5);
  const dx=x2-x1, dy=y2-y1, L=Math.hypot(dx,dy)||1, ux=dx/L, uy=dy/L, px=-uy, py=ux;
  const w=0.18, hw=0.46, hl=0.42, sx=x1+ux*0.2, sy=y1+uy*0.2, tx=x2-ux*0.08, ty=y2-uy*0.08, nx=tx-ux*hl, ny=ty-uy*hl;
  const P = [[sx+px*w/2,sy+py*w/2],[nx+px*w/2,ny+py*w/2],[nx+px*hw/2,ny+py*hw/2],[tx,ty],[nx-px*hw/2,ny-py*hw/2],[nx-px*w/2,ny-py*w/2],[sx-px*w/2,sy-py*w/2]];
  return `<polygon points="${P.map(p=>p.map(v=>v.toFixed(3)).join(',')).join(' ')}" style="fill:${color};opacity:${op||0.85}"/>`;
}
function makeBoard(host){
  const wrap = document.createElement('div'); wrap.className = 'bwrap';
  wrap.innerHTML = '<div class="board"></div><svg class="overlay" viewBox="0 0 8 8" aria-hidden="true"></svg><div class="promo" hidden><div class="promo-box"></div></div>';
  host.appendChild(wrap);
  const bEl = wrap.querySelector('.board'), ov = wrap.querySelector('.overlay'), promo = wrap.querySelector('.promo'), pbox = wrap.querySelector('.promo-box');
  const st = {fen:START, orient:'w', last:null, marks:{}, arrows:[], badge:null, hint:null, movable:null, onMove:null, flash:{}};
  let sel = null, targets = [], drag = null, pend = null;
  const sqXY = sq => { const f = sq.charCodeAt(0)-97, r = +sq[1]-1; return st.orient==='w' ? [f, 7-r] : [7-f, r]; };
  function render(anim){
    const g = new Chess(st.fen); const bd = g.board();
    const chk = g.in_check() ? kingSq(boardMap(g), g.turn()) : null;
    let h = '';
    for (let y=0;y<8;y++) for (let x=0;x<8;x++){
      const f = st.orient==='w' ? x : 7-x, r = st.orient==='w' ? 7-y : y;
      const sq = FILES[f] + (r+1), p = bd[7-r][f];
      const cls = ['sq', (f+r)%2===0 ? 'd' : 'l'];
      let style = '';
      if (st.marks[sq]){ cls.push('mk'); style = ` style="--mk:${st.marks[sq]}"`; }
      else if (st.last && (st.last[0]===sq || st.last[1]===sq)) cls.push('hl');
      if (sel===sq) cls.push('sel');
      if (st.hint===sq) cls.push('hint');
      if (st.flash[sq]) cls.push(st.flash[sq]);
      if (chk===sq) cls.push('chk');
      if (drag && drag.moved && drag.from===sq) cls.push('dragfrom');
      let inner = '';
      if (x===0) inner += `<span class="co r">${r+1}</span>`;
      if (y===7) inner += `<span class="co f">${FILES[f]}</span>`;
      const t = targets.find(m => m.to===sq);
      if (t) inner += p ? '<span class="ring"></span>' : '<span class="dot"></span>';
      if (p) inner += `<span class="pc ${p.color}${p.type}"${anim && anim.to===sq ? ' data-anim="1"' : ''}></span>`;
      h += `<button type="button" class="${cls.join(' ')}"${style} data-sq="${sq}" aria-label="${sq}${p ? ' ' + (p.color==='w'?'branco ':'preto ') + PNAME[p.type] : ''}">${inner}</button>`;
    }
    bEl.innerHTML = h;
    if (anim){
      const el = bEl.querySelector('[data-anim]');
      if (el){ const [fx,fy] = sqXY(anim.from), [tx,ty] = sqXY(anim.to); el.style.transform = `translate(${(fx-tx)*100}%,${(fy-ty)*100}%)`; requestAnimationFrame(() => requestAnimationFrame(() => { el.classList.add('anim'); el.style.transform = ''; })); }
    }
    let s = '';
    for (const a of st.arrows) s += arrowSvg(sqXY, a.from, a.to, a.color, a.op);
    if (st.badge){
      const [x,y] = sqXY(st.badge.sq); const cx = Math.min(x+0.84, 7.79), cy = Math.max(y+0.16, 0.21);
      s += `<circle cx="${cx}" cy="${cy}" r="0.2" style="fill:var(${st.badge.c});stroke:#fff;stroke-width:.03"/><text x="${cx}" y="${cy+0.005}" text-anchor="middle" dominant-baseline="central" style="fill:#fff;font:800 ${st.badge.s.length>1?0.15:0.2}px Figtree,sans-serif">${st.badge.s}</text>`;
    }
    ov.innerHTML = s;
  }
  function set(o, anim){
    if (o.fen && o.fen !== st.fen){ sel = null; targets = []; }
    Object.assign(st, {marks:{}, arrows:[], badge:null, hint:null, flash:{}}, o);
    if (!('movable' in o)) st.movable = null;
    render(anim);
  }
  function update(o){ Object.assign(st, o); render(); }
  function flash(sq, cls, ms){ st.flash = Object.assign({}, st.flash, {[sq]:cls}); render(); setTimeout(() => { delete st.flash[sq]; render(); }, ms || 700); }
  const canMove = () => st.movable && new Chess(st.fen).turn()===st.movable;
  bEl.addEventListener('pointerdown', e => {
    const b = e.target.closest('[data-sq]'); if (!b || !canMove()) return;
    const sq = b.dataset.sq, g = new Chess(st.fen);
    if (sel && targets.find(t => t.to===sq)){ tryMove(sel, sq); return; }
    const p = g.get(sq);
    if (p && p.color===st.movable){
      e.preventDefault();
      const was = sel===sq; sel = sq; targets = g.moves({square:sq, verbose:true});
      drag = {from:sq, was, moved:false, x:e.clientX, y:e.clientY, ghost:null, cls:p.color+p.type};
      try { bEl.setPointerCapture(e.pointerId); } catch(_){}
      render();
    } else { sel = null; targets = []; render(); }
  });
  bEl.addEventListener('pointermove', e => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX-drag.x, e.clientY-drag.y) < 6) return;
    if (!drag.ghost){
      drag.moved = true;
      const gh = document.createElement('div'); gh.className = 'dragghost pc ' + drag.cls;
      const s = bEl.clientWidth/8*1.1; gh.style.width = gh.style.height = s + 'px';
      document.body.appendChild(gh); drag.ghost = gh; render();
    }
    drag.ghost.style.left = e.clientX + 'px'; drag.ghost.style.top = e.clientY + 'px';
  });
  bEl.addEventListener('pointerup', e => {
    if (!drag) return;
    const d = drag; drag = null; if (d.ghost) d.ghost.remove();
    if (!d.moved){ if (d.was){ sel = null; targets = []; } render(); return; }
    const el = document.elementFromPoint(e.clientX, e.clientY); const b = el && el.closest && el.closest('[data-sq]');
    if (b && b.dataset.sq!==d.from && targets.find(t => t.to===b.dataset.sq)){ tryMove(d.from, b.dataset.sq, true); return; }
    render();
  });
  bEl.addEventListener('pointercancel', () => { if (drag && drag.ghost) drag.ghost.remove(); drag = null; render(); });
  function tryMove(from, to, dragged){
    const opts = targets.filter(t => t.from===from && t.to===to); if (!opts.length) return;
    if (opts.some(o => o.promotion)){
      pend = {from, to, dragged};
      pbox.innerHTML = ['q','r','b','n'].map(t => `<button type="button" data-p="${t}" aria-label="Promover a ${PNAME[t]}"><span class="pc ${opts[0].color}${t}"></span></button>`).join('');
      promo.hidden = false; return;
    }
    done(from, to, undefined, dragged);
  }
  function done(from, to, promotion, dragged){
    sel = null; targets = [];
    const r = st.onMove ? st.onMove(from, to, promotion, dragged) : null;
    if (r === false) render();
  }
  pbox.addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (!b || !pend) return; const p = pend; pend = null; promo.hidden = true; done(p.from, p.to, b.dataset.p, p.dragged); });
  promo.addEventListener('click', e => { if (e.target===promo){ pend = null; promo.hidden = true; sel = null; targets = []; render(); } });
  render();
  return {set, update, flash, get st(){ return st; }, sqXY};
}
function makeStage(colId, withEval){
  const col = $(colId);
  col.innerHTML = `<div class="player" data-top></div><div class="boardline${withEval?' ev':''}">${withEval?'<div class="evalbar"><div class="fill"></div><div class="num"></div></div>':''}<div class="bhost" style="min-width:0"></div></div><div class="player" data-bot></div>`;
  const board = makeBoard(col.querySelector('.bhost'));
  return {board, top: col.querySelector('[data-top]'), bot: col.querySelector('[data-bot]'), ev: col.querySelector('.evalbar')};
}
function capturedBy(fen){
  const map = boardMap(new Chess(fen)); const cnt = {w:{p:0,n:0,b:0,r:0,q:0}, b:{p:0,n:0,b:0,r:0,q:0}};
  for (const s in map){ const p = map[s]; if (p.type!=='k') cnt[p.color][p.type]++; }
  const full = {p:8,n:2,b:2,r:2,q:1};
  const took = col => { const o = col==='w'?'b':'w'; let h = ''; ['q','r','b','n','p'].forEach(t => { for (let k=0; k<Math.max(0, full[t]-cnt[o][t]); k++) h += `<span class="pc ${o}${t}"></span>`; }); return h; };
  return {w:took('w'), b:took('b'), diff: matCount(map,'w') - matCount(map,'b')};
}
function playerHTML(o){
  // o: {name, rating, color, caps, diff, clock, clockOn, clockLow, avatar}
  return `<span class="ava"><span class="pc ${o.color}${o.avatar||'k'}"></span></span><span class="nm">${esc(o.name)}${o.rating ? ` <span class="rt">(${esc(o.rating)})</span>` : ''}</span><span class="caps">${o.caps||''}${o.diff>0 ? `<span>+${o.diff}</span>` : ''}</span>${o.clock!=null ? `<span class="clk${o.clockOn?' on':''}${o.clockLow?' low':''}">${o.clock}</span>` : ''}`;
}
function setEval(ev, score, turn, orient){
  if (!ev) return;
  const sw = toWhite(score || {cp:0}, turn);
  const mated = ('mate' in sw) && sw.mate===0;
  const w = mated ? (turn==='w' ? 0 : 100) : winPct(sw);
  const fill = ev.querySelector('.fill'), num = ev.querySelector('.num');
  const whiteBottom = orient==='w';
  fill.style.height = w + '%'; fill.style.top = whiteBottom ? 'auto' : '0'; fill.style.bottom = whiteBottom ? '0' : 'auto';
  num.textContent = mated ? (turn==='w' ? '0-1' : '1-0') : fmtEval(sw).replace('+','').replace('−','');
  const whiteAhead = w >= 50; num.style.color = whiteAhead ? '#403d39' : '#fff';
  const atBottom = whiteAhead === whiteBottom; num.style.top = atBottom ? 'auto' : '0'; num.style.bottom = atBottom ? '0' : 'auto';
}
const fmtClk = s => { s = Math.max(0, s); const m = Math.floor(s/60), r = Math.floor(s%60); return s < 20 ? `${m}:${String(r).padStart(2,'0')}.${Math.floor((s%1)*10)}` : `${m}:${String(r).padStart(2,'0')}`; };
function mini(fen, orient){
  const bd = new Chess(fen).board(); let h = '';
  for (let y=0;y<8;y++) for (let x=0;x<8;x++){
    const f = orient==='b' ? 7-x : x, r = orient==='b' ? y : 7-y, p = bd[7-r][f];
    h += `<i style="background:var(${(f+r)%2===0?'--sq-d':'--sq-l'})">${p ? `<span class="pc ${p.color}${p.type}"></span>` : ''}</i>`;
  }
  return `<span class="mini">${h}</span>`;
}

/* =====================================================================
   chess.com
   ===================================================================== */
const CC = 'https://api.chess.com/pub/player/';
const CC_DRAW = ['agreed','repetition','stalemate','insufficient','50move','timevsinsufficient'];
const CC_WHY = {checkmated:'xeque-mate', resigned:'desistência', timeout:'tempo', abandoned:'abandono', agreed:'acordo', repetition:'repetição', stalemate:'afogamento', insufficient:'material insuficiente', timevsinsufficient:'tempo', '50move':'50 lances'};
const CC_TC = {rapid:'Rápida', blitz:'Blitz', bullet:'Bullet', daily:'Diária'};
async function ccJSON(url){
  let r; try { r = await fetch(url, {headers:{'Accept':'application/json'}}); } catch(e){ throw {code:'net'}; }
  if (r.status===404 || r.status===410) throw {code:404};
  if (r.status===429) throw {code:429};
  if (!r.ok) throw {code:r.status};
  return r.json();
}
const ccErr = e => e && e.code===404 ? 'Usuário não encontrado no chess.com.' : e && e.code===429 ? 'O chess.com pediu uma pausa. Tente em um minuto.' : 'Sem conexão com o chess.com agora.';
const G = {list:[], stats:null, at:0, Rs:{}, parsed:{}, loading:false};
function resetUserData(){ store.del('lal-prof-cache'); G.list = []; G.stats = null; G.at = 0; G.Rs = {}; G.parsed = {}; }
{ const c = store.get('lal-prof-cache'); if (c && S.user && c.u && c.u.toLowerCase()===S.user.toLowerCase() && c.games){ G.list = c.games.map(g => gameInfo(g)); G.stats = c.stats; G.at = c.at || 0; } }
function gameInfo(g){
  const lu = String(S.user||'').toLowerCase();
  const side = (g.white.username||'').toLowerCase()===lu ? 'w' : 'b';
  const me = side==='w' ? g.white : g.black, op = side==='w' ? g.black : g.white;
  const res = me.result==='win' ? 'W' : CC_DRAW.indexOf(me.result)>=0 ? 'D' : 'L';
  const why = res==='W' ? (CC_WHY[op.result]||'') : (CC_WHY[me.result]||'');
  return {id: g.url || g.uuid || ('g' + g.end_time), g, side, me, op, res, why};
}
function parseClocks(pgn, n){ const out = []; const re = /\[%clk\s+(\d+):(\d+):(\d+(?:\.\d+)?)\]/g; let m; while ((m = re.exec(pgn))) out.push((+m[1])*3600 + (+m[2])*60 + (+m[3])); return out.length===n ? out : null; }
function parseTC(tc){ if (!tc || String(tc).indexOf('/')>=0) return null; const [b,i] = String(tc).split('+').map(Number); return b > 0 ? {base:b, inc:i||0} : null; }
function reviewData(info){
  if (!G.parsed[info.id]) G.parsed[info.id] = parsePGN(info.g.pgn);
  const p = G.parsed[info.id]; if (p.error || !p.moves.length) return null;
  const o = info.side==='w' ? 'b' : 'w';
  return {startFen:p.startFen, moves:p.moves, userColor:info.side, names:{[info.side]:{name:S.user, rating:info.me.rating}, [o]:{name:info.op.username||'Adversário', rating:info.op.rating}},
    res:info.res, why:info.why, source:'chesscom', id:info.id, clocks:parseClocks(info.g.pgn, p.moves.length), tc:parseTC(info.g.time_control), timeClass:info.g.time_class, end:info.g.end_time};
}
const AKEY = 'lal-an';
const enc = s => ('mate' in s) ? 'm' + s.mate : s.cp;
const dec = v => (typeof v==='string' && v[0]==='m') ? {mate:+v.slice(1)} : {cp:+v};
const packAn = an => an.map(a => [enc(a.score), a.lines.slice(0,2).map(l => [enc(l.score), l.pv.slice(0,6).join(' ')])]);
const unpackAn = p => p.map(([s, ls]) => ({score:dec(s), lines: ls.map(([sc,pv]) => ({score:dec(sc), pv: pv ? pv.split(' ') : []}))}));
let anMem = null;
function anAll(){ return anMem || (anMem = store.get(AKEY) || {}); }
function anGet(id){ const o = anAll()[id]; return o ? unpackAn(o.an) : null; }
function anPut(id, an){
  const o = anAll(); o[id] = {t:Date.now(), an:packAn(an)};
  const keys = Object.keys(o); if (keys.length > 40) keys.sort((a,b)=>(o[a].t||0)-(o[b].t||0)).slice(0, keys.length-40).forEach(k => delete o[k]);
  store.set(AKEY, o);
}
function buildFens(startFen, moves){ const g = new Chess(startFen); const f = [g.fen()]; for (const m of moves){ g.move({from:m.from,to:m.to,promotion:m.promotion}); f.push(g.fen()); } return f; }
function buildR(data, an){ const r = Object.assign({}, data); r.fens = buildFens(r.startFen, r.moves); r.an = an; classifyGame(r); return r; }
function reviewOf(info){
  if (G.Rs[info.id]) return G.Rs[info.id];
  const an = anGet(info.id); if (!an) return null;
  const d = reviewData(info); if (!d || an.length !== d.moves.length + 1) return null;
  try { G.Rs[info.id] = buildR(d, an); } catch(e){ return null; }
  return G.Rs[info.id];
}
async function fetchGames(){
  if (!S.user || G.loading) return;
  G.loading = true; $('refreshBtn').disabled = true; gamesMsg(G.list.length ? '' : 'Buscando suas partidas…');
  const lu = S.user.toLowerCase();
  try {
    const [arch, stats] = await Promise.all([ccJSON(CC + encodeURIComponent(lu) + '/games/archives'), ccJSON(CC + encodeURIComponent(lu) + '/stats').catch(() => null)]);
    const arcs = (arch.archives || []).slice(-3).reverse(); let games = [];
    for (const url of arcs){ const g = await ccJSON(url); games = games.concat(g.games || []); if (games.length >= 30) break; }
    const list = games.filter(g => g.rules==='chess' && g.pgn && g.white && g.black).sort((x,y)=>(y.end_time||0)-(x.end_time||0)).slice(0, 30);
    G.list = list.map(gameInfo); G.stats = stats; G.at = Date.now();
    store.set('lal-prof-cache', {u:S.user, at:G.at, stats, games:list.slice(0, 25)});
    const r = bestRating(); if (r){ S.elo = clampElo(r.rating); save(); }
    gamesMsg(list.length ? '' : 'Nenhuma partida nos últimos meses. Jogue uma no chess.com e toque em Atualizar.');
  } catch(e){ gamesMsg(ccErr(e) + (G.list.length ? ' Mostrando as partidas guardadas.' : '')); }
  G.loading = false; $('refreshBtn').disabled = false;
  renderMe(); refreshCurrent(); bgRun();
}
function gamesMsg(t){ $('gamesMsg').textContent = t || ''; $('gamesMsg').hidden = !t; }
function bestRating(){
  const s = G.stats; if (!s) return null;
  for (const k of ['chess_rapid','chess_blitz','chess_daily','chess_bullet']) if (s[k] && s[k].last && s[k].last.rating) return {rating:s[k].last.rating, kind:k.replace('chess_','')};
  return null;
}
const clampElo = v => Math.max(100, Math.min(3000, Math.round(v/25)*25));

/* análise em segundo plano das últimas 10 partidas */
const BG_N = 10; let bgOn = false, fgId = null;
async function bgRun(){
  if (bgOn || !SF.ready) return;
  bgOn = true;
  try {
    while (true){
      const todo = G.list.slice(0, BG_N).filter(info => info.id!==fgId && !reviewOf(info) && reviewData(info));
      if (!todo.length) break;
      const info = todo[0], d = reviewData(info), fens = buildFens(d.startFen, d.moves);
      const total = G.list.slice(0, BG_N).filter(i => reviewData(i)).length;
      const doneN = total - todo.length;
      const an = []; let stop = false; const u0 = S.user;
      for (let i=0;i<fens.length;i++){
        setBg(`Analisando suas partidas: ${doneN+1} de ${total}`, (doneN + i/fens.length)/total);
        const a = await analysePos(fens[i], {movetime: info===G.list[0] ? 280 : 150, multipv:2, jsDepth:2, jsMs:150}, 0);
        if (a.cancelled || S.user!==u0 || info.id===fgId){ stop = true; break; }
        an.push(a);
      }
      if (stop){ if (S.user!==u0) break; continue; }
      anPut(info.id, an); delete G.Rs[info.id]; profCache = null;
      refreshCurrent(true);
    }
  } finally { bgOn = false; setBg(''); }
}
function setBg(t, f){ $('bgProg').hidden = !t; $('bgProgText').textContent = t || ''; if (f!=null) $('bgProgBar').style.width = Math.round(f*100) + '%'; }

/* =====================================================================
   Navegação
   ===================================================================== */
const VIEWS = ['v-games','v-review','v-stats','v-puzzles','v-puzzle','v-learn','v-lesson','v-play'];
const TAB_OF = {'v-games':'games','v-review':'games','v-stats':'stats','v-puzzles':'puzzles','v-puzzle':'puzzles','v-learn':'learn','v-lesson':'learn','v-play':'play'};
const HOME = {games:'v-games', stats:'v-stats', puzzles:'v-puzzles', learn:'v-learn', play:'v-play'};
let cur = 'v-games';
function show(v, sub){
  if (cur==='v-play' && v!=='v-play') playLeave();
  if (v!=='v-review' && fgId!==null){ rvTok++; fgId = null; setTimeout(bgRun, 0); }
  cur = v;
  VIEWS.forEach(id => $(id).hidden = id!==v);
  document.querySelectorAll('.navi').forEach(b => b.setAttribute('aria-current', b.dataset.tab===TAB_OF[v] ? 'page' : 'false'));
  if (sub) history.pushState({sub:v}, '');
  window.scrollTo(0, 0);
  if (v==='v-games') renderGames();
  if (v==='v-stats') renderStats();
  if (v==='v-puzzles') renderPuzzles();
  if (v==='v-learn') renderLearn();
  if (v==='v-play') renderPlay();
}
function refreshCurrent(bg){
  if (cur==='v-games') renderGames();
  else if (cur==='v-stats') renderStats();
  else if (cur==='v-puzzles') renderPuzzles();
  else if (cur==='v-learn' && !bg) renderLearn();
}
function back(){ if (history.state && history.state.sub) history.back(); else show(HOME[TAB_OF[cur]]); }
window.addEventListener('popstate', () => { if (['v-review','v-puzzle','v-lesson'].indexOf(cur)>=0) show(HOME[TAB_OF[cur]]); });
$('nav').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b){ if (history.state && history.state.sub) history.replaceState(null, ''); show(HOME[b.dataset.tab]); } });
function renderMe(){
  const r = bestRating();
  $('me').innerHTML = S.user ? `<span class="muted" style="font-size:12px">Conectado como</span><b>${esc(S.user)}</b>${r ? `<span>${CC_TC[r.kind]} <b>${r.rating}</b></span>` : ''}<button class="linkish" id="switchUser">Trocar usuário</button>` : '';
  $('meTop').innerHTML = S.user ? `<span class="chip">${esc(S.user)}${r ? ` · ${r.rating}` : ''}</span>` : '';
  const sw = $('switchUser'); if (sw) sw.onclick = switchUser;
}
function switchUser(){ S.user = ''; save(); resetUserData(); SF.cancelBackground(); showOnboard(); }
function showOnboard(){ $('onboard').hidden = false; $('obUser').value = ''; $('obMsg').textContent = ''; setTimeout(() => $('obUser').focus(), 50); }
$('obForm').addEventListener('submit', async e => {
  e.preventDefault();
  const u = $('obUser').value.trim().replace(/^@/, ''); if (!u){ $('obMsg').textContent = 'Digite seu usuário do chess.com.'; return; }
  $('obMsg').textContent = 'Procurando…';
  try { await ccJSON(CC + encodeURIComponent(u.toLowerCase())); } catch(err){ $('obMsg').textContent = ccErr(err); return; }
  resetUserData(); S.user = u; save(); $('onboard').hidden = true; renderMe(); show('v-games'); fetchGames();
});
$('refreshBtn').addEventListener('click', fetchGames);

/* =====================================================================
   Aba Partidas
   ===================================================================== */
function tcIcon(tc){ const id = {bullet:'i-bullet', blitz:'i-blitz', rapid:'i-rapid', daily:'i-daily'}[tc] || 'i-rapid'; return `<svg><use href="#${id}"/></svg>`; }
const fmtDate = t => t ? new Date(t*1000).toLocaleDateString('pt-BR', {day:'2-digit', month:'short'}) : '';
function renderGames(){
  const L = $('gameList');
  if (!G.list.length){ L.innerHTML = G.loading ? '<div class="empty">Buscando suas partidas…</div>' : '<div class="empty">Nenhuma partida ainda.</div>'; return; }
  L.innerHTML = G.list.map((info, k) => {
    const r = reviewOf(info);
    return `<button type="button" class="grow-btn" data-g="${k}"><span class="res ${info.res}">${info.res==='W'?'+':info.res==='L'?'−':'='}</span>
      <span style="min-width:0"><span class="gopp">${esc(info.op.username||'?')} <span class="muted">(${info.op.rating||'?'})</span></span><span class="gmeta">${tcIcon(info.g.time_class)} ${CC_TC[info.g.time_class]||''} · ${fmtDate(info.g.end_time)}${info.why ? ' · ' + info.why : ''}</span></span>
      <span class="gacc">${r ? r.side[r.userColor].acc.toFixed(1) + '<small>precisão</small>' : '<span class="dim">—</span>'}</span><span class="chev">›</span></button>`;
  }).join('');
}
$('gameList').addEventListener('click', e => { const b = e.target.closest('[data-g]'); if (b){ const info = G.list[+b.dataset.g]; if (info) openGame(info); } });

/* =====================================================================
   Revisão (estilo "revisão de partida")
   ===================================================================== */
let RV = null, rvStage = null, rvTok = 0;
function ensureRvStage(){ if (!rvStage) rvStage = makeStage('rvBoardCol', true); return rvStage; }
async function openGame(info, opts){
  const d = reviewData(info); if (!d) return toast('Não consegui ler essa partida.');
  const cached = reviewOf(info);
  if (cached) return startReview(cached, opts);
  await analyzeAndReview(d, opts);
}
async function analyzeAndReview(d, opts){
  ensureRvStage(); show('v-review', true);
  const tok = ++rvTok; fgId = d.id || null;
  RV = null;
  const fens = buildFens(d.startFen, d.moves);
  rvStage.board.set({fen: fens[fens.length-1], orient: d.userColor});
  rvStage.top.innerHTML = ''; rvStage.bot.innerHTML = '';
  $('rvTitle').textContent = 'Analisando…';
  $('rvFoot').innerHTML = ''; $('rvSumBtn').hidden = true;
  const an = [];
  for (let i=0;i<fens.length;i++){
    $('rvBody').innerHTML = `<div class="coach"><span class="face"><span class="pc wn"></span></span><div class="bubble"><div class="t">Estou analisando sua partida</div><p>${pct(i, fens.length)}% · ${fens.length-1} lances</p></div></div><div class="bar"><i style="width:${pct(i, fens.length)}%"></i></div>`;
    const a = await analysePos(fens[i], {movetime: fens.length > 120 ? 220 : 300, multipv:2, jsDepth:2, jsMs:350}, 1);
    if (tok !== rvTok) return;
    an.push(a);
  }
  fgId = null;
  if (d.id){ anPut(d.id, an); delete G.Rs[d.id]; profCache = null; }
  const R = buildR(d, an);
  if (d.id) G.Rs[d.id] = R;
  startReview(R, Object.assign({}, opts, {noPush:true}));
  bgRun();
}
function startReview(R, opts){
  opts = opts || {};
  ensureRvStage();
  if (cur!=='v-review') show('v-review', !opts.noPush);
  RV = {R, ply: opts.ply!=null ? opts.ply : 0, mode: opts.ply!=null ? 'moves' : 'summary', retry:null, best:false};
  $('rvSumBtn').hidden = false;
  if (opts.retry && RV.ply > 0) startRetry(RV.ply);
  renderReview();
}
const phaseOf = (R, i) => { if (i < 20) return 0; const {s,q} = npm(boardMap(new Chess(R.fens[i]))); return (s<=20 || (q===0 && s<=26)) ? 2 : 1; };
function phaseAcc(R, col){ return [0,1,2].map(p => { const xs = R.items.map((x,i)=>({x,i})).filter(o => o.x.color===col && phaseOf(R, o.i)===p).map(o => o.x.acc); return xs.length ? avg(xs) : null; }); }
function clockAt(R, col, ply){
  if (!R.clocks || !R.tc) return null;
  let v = R.tc.base; for (let i=0;i<ply;i++) if (R.moves[i].color===col) v = R.clocks[i];
  return fmtClk(v);
}
function renderReview(){
  if (!RV) return;
  if (RV.cmp) return renderCompare();
  const R = RV.R, st = rvStage, uc = R.userColor, oc = uc==='w' ? 'b' : 'w';
  const ply = RV.retry ? RV.retry.k - 1 : RV.ply;
  const fen = R.fens[ply];
  const capt = capturedBy(fen);
  const nm = c => R.names[c] || {name:c==='w'?'Brancas':'Pretas'};
  st.top.innerHTML = playerHTML({name:nm(oc).name, rating:nm(oc).rating, color:oc, caps:capt[oc], diff: oc==='w' ? capt.diff : -capt.diff, clock: clockAt(R, oc, ply)});
  st.bot.innerHTML = playerHTML({name:nm(uc).name, rating:nm(uc).rating, color:uc, caps:capt[uc], diff: uc==='w' ? capt.diff : -capt.diff, clock: clockAt(R, uc, ply)});
  $('rvTitle').textContent = RV.mode==='summary' ? 'Revisão da partida' : (RV.retry ? 'Tente de novo' : 'Revisão da partida');
  $('rvSumBtn').textContent = RV.mode==='summary' ? 'Lances' : 'Resumo';
  if (RV.retry){
    st.board.set({fen, orient:uc, last: RV.retry.k>1 ? [R.moves[RV.retry.k-2].from, R.moves[RV.retry.k-2].to] : null, movable: RV.retry.done ? null : R.moves[RV.retry.k-1].color, onMove: retryMove,
      arrows: RV.retry.showSol && RV.retry.best ? [{from:RV.retry.best.from, to:RV.retry.best.to, color:'#81b64c'}] : []});
    setEval(st.ev, R.an[ply].score, fen.split(' ')[1], uc);
  } else {
    const o = {fen, orient:uc, last:null};
    if (ply > 0){
      const m = R.moves[ply-1], it = R.items[ply-1], meta = CLS[it.c];
      o.marks = {[m.from]:`var(${meta.c})`, [m.to]:`var(${meta.c})`};
      o.badge = {sq:m.to, s:meta.s, c:meta.c};
      const showBest = RV.best || BAD.indexOf(it.c)>=0;
      if (showBest && it.bestUci && it.bestUci!==uciOf(m)) o.arrows = [{from:it.bestUci.slice(0,2), to:it.bestUci.slice(2,4), color:'#81b64c'}];
    }
    st.board.set(o);
    setEval(st.ev, R.an[ply].score, fen.split(' ')[1], uc);
  }
  if (RV.mode==='summary') renderReviewSummary(); else renderReviewMoves();
}
function bubble(title, body, icon){ return `<div class="coach"><span class="face"><span class="pc wn"></span></span><div class="bubble"><div class="t">${icon||''}${title}</div>${body||''}</div></div>`; }
const clsIcon = (c, lg) => `<span class="cls${lg?' lg':''}" style="--c:var(${CLS[c].c})">${CLS[c].s}</span>`;
function renderReviewSummary(){
  const R = RV.R, uc = R.userColor, oc = uc==='w' ? 'b' : 'w';
  const s = R.side, cnt = (c, col) => R.items.filter(x => x.c===c && x.color===col).length;
  const head = R.res==='W' ? 'Você venceu' : R.res==='L' ? 'Você perdeu' : 'Empate';
  const bad = R.items.filter(x => x.color===uc && (x.c==='erro' || x.c==='capivarada')).length;
  const say = bad ? `${bad} ${plural(bad,'erro grave','erros graves')}. Vamos ver onde dava para jogar melhor.` : 'Partida limpa, sem erros graves.';
  const nm = c => (R.names[c] && R.names[c].name) || (c==='w'?'Brancas':'Pretas');
  const wC = uc==='w' ? uc : oc, bC = wC==='w' ? 'b' : 'w';
  const pa = {w: phaseAcc(R,'w'), b: phaseAcc(R,'b')};
  const pIc = v => v==null ? '<span class="dim">—</span>' : clsIcon(v>=90?'melhor':v>=80?'bom':v>=65?'imprecisao':'erro');
  $('rvBody').innerHTML = bubble(`${head}${R.why ? ' por ' + R.why : ''}`, `<p>${say}</p>`) + `
    ${graphHTML(R)}
    <div class="accs"><div class="acc w"><small>${esc(nm('w'))}</small><b>${s.w.acc.toFixed(1)}</b></div><div class="acc b"><small>${esc(nm('b'))}</small><b>${s.b.acc.toFixed(1)}</b></div></div>
    <table class="ctab"><tbody>
      ${CLS_ORDER.map(c => { const a = cnt(c,'w'), b = cnt(c,'b'); return `<tr><td class="lbl">${CLS[c].n}</td><td style="--c:var(${CLS[c].c})" class="${a?'':'z'}">${a}</td><td>${clsIcon(c)}</td><td class="${b?'':'z'}" style="color:var(${CLS[c].c})">${b}</td></tr>`; }).join('')}
      <tr><td class="lbl" style="padding-top:10px">Elo da partida</td><td style="padding-top:10px">${s.w.elo}</td><td></td><td style="padding-top:10px">${s.b.elo}</td></tr>
    </tbody></table>
    <div class="phase"><span></span><span class="dim" style="font-size:12px">Brancas</span><span class="dim" style="font-size:12px">Pretas</span>
      ${['Abertura','Meio-jogo','Final'].map((n,k) => `<span>${n}</span><span>${pIc(pa.w[k])}</span><span>${pIc(pa.b[k])}</span>`).join('')}</div>
    ${R.opening ? `<p class="muted" style="margin:0;font-size:13.5px">Abertura: <b style="color:#fff">${esc(R.opening)}</b></p>` : ''}`;
  $('rvFoot').innerHTML = `<button class="btn go big" id="rvStart">Iniciar revisão</button>`;
  $('rvStart').onclick = () => { RV.mode = 'moves'; RV.ply = Math.max(1, RV.ply); renderReview(); };
  bindGraph();
}
function graphHTML(R){
  const N = R.fens.length, W = 1000, H = 100;
  const pts = R.an.map((a,i) => { const t = R.fens[i].split(' ')[1]; const sw = toWhite(a.score, t); const w = (('mate' in sw) && sw.mate===0) ? (t==='w'?0:100) : winPct(sw); return [N>1 ? i/(N-1)*W : 0, H*(1-w/100)]; });
  const poly = `0,${H} ` + pts.map(p => p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ') + ` ${W},${H}`;
  let dots = '';
  R.items.forEach((it,i) => { if (['erro','capivarada','perdido','brilhante','otimo'].indexOf(it.c)>=0){ const p = pts[i+1]; dots += `<circle cx="${p[0]}" cy="${p[1]}" r="9" style="fill:var(${CLS[it.c].c});stroke:#fff;stroke-width:3" vector-effect="non-scaling-stroke"/>`; } });
  const cx = (N>1 ? (RV.ply)/(N-1)*100 : 0);
  return `<div class="graph" id="rvGraph"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><polygon points="${poly}" style="fill:#fff"/><line x1="0" y1="${H/2}" x2="${W}" y2="${H/2}" style="stroke:#8f8d89;stroke-width:1" vector-effect="non-scaling-stroke"/>${dots}</svg><span class="cur" style="left:${cx}%"></span></div>`;
}
function bindGraph(){ const g = $('rvGraph'); if (!g) return; g.onclick = e => { const r = g.getBoundingClientRect(); const k = Math.round((e.clientX - r.left)/r.width*(RV.R.fens.length-1)); RV.mode = 'moves'; setPly(k); }; }
function coachOf(R, i){
  const cc = R._cc || (R._cc = {}); if (cc[i]) return cc[i];
  const m = R.moves[i], it = R.items[i], fen = R.fens[i], A = R.an[i], B = R.an[i+1];
  const best = moveFromUci(fen, it.bestUci);
  const reply = B.lines[0] ? moveFromUci(R.fens[i+1], B.lines[0].pv[0]) : null;
  const no = Math.floor(i/2)+1;
  const myT = tacticsOf(fen, m), myS = strategyOf(fen, m, no);
  const pos = myT.concat(myS).filter(t => NEG.indexOf(t)<0 && t!=='troca');
  const ng = myS.filter(t => NEG.indexOf(t)>=0);
  let text = '', tags = [];
  const c = it.c;
  if (c==='livro'){ text = R.opening ? `Teoria da ${R.opening}.` : 'Lance conhecido de abertura.'; tags = pos; }
  else if (c==='forcado') text = 'Era o único lance possível.';
  else if (c==='brilhante'){ text = 'Sacrifício que funciona!'; tags = ['sacrificio'].concat(pos); }
  else if (c==='otimo'){ text = 'O único lance que mantinha a vantagem.'; tags = pos; }
  else if (c==='melhor' || c==='excelente' || c==='bom'){
    text = pos.length ? cap(TAG[pos[0]][1]) + '.' : c==='melhor' ? 'Exatamente o lance do motor.' : c==='excelente' ? 'Quase tão bom quanto o melhor.' : 'Razoável, mas havia algo melhor.';
    tags = pos.concat(ng);
  } else {
    const oppMate = B.score && ('mate' in B.score) && B.score.mate > 0;
    const bt = best ? tacticsOf(fen, best).filter(t => STRONG.indexOf(t)>=0 && t!=='troca') : [];
    const rt = reply ? tacticsOf(R.fens[i+1], reply).filter(t => STRONG.indexOf(t)>=0 && t!=='troca') : [];
    if (c==='perdido'){ text = `O adversário errou e ${best ? ptSan(best.san) : 'outro lance'} aproveitava${bt.length ? ' com ' + art(bt[0]) : ''}.`; tags = bt; }
    else if (oppMate){ text = `Permite xeque-mate em ${B.score.mate}${reply ? ': ' + ptSan(reply.san) : ''}.`; tags = rt; }
    else if (rt.length && reply){ text = `Permite ${art(rt[0])}: ${ptSan(reply.san)}.`; tags = rt; }
    else {
      const hang = hangingAfter(fen, m);
      if (hang && reply && reply.to===hang.sq){ text = `Deixa ${PART[hang.t]} sem defesa.`; tags = ['peca_pendurada']; }
      else if (reply && reply.captured && VAL[reply.captured]>=3){ text = `Perde ${PUM[reply.captured]} para ${ptSan(reply.san)}.`; tags = ['peca_pendurada']; }
      else if (bt.length && best){ text = `${ptSan(best.san)} ganhava com ${art(bt[0])}.`; tags = bt; }
      else text = `Sua chance de vitória caiu de ${Math.round(it.wb)}% para ${Math.round(it.wa)}%.`;
    }
    if (ng.length) tags = tags.concat(ng);
  }
  const line = A.lines[0] && best && it.bestUci!==uciOf(m) ? lineText(fen, A.lines[0].pv, 4) : '';
  const out = {text, tags:Array.from(new Set(tags)), best: best && it.bestUci!==uciOf(m) ? best : null, line};
  cc[i] = out; return out;
}
function lineText(fen, pv, n){
  const g = new Chess(fen); const parts = []; let num = +fen.split(' ')[5] || 1, turn = fen.split(' ')[1], first = true;
  for (const u of pv.slice(0, n)){
    const mv = g.move({from:u.slice(0,2), to:u.slice(2,4), promotion:u[4]||undefined}); if (!mv) break;
    if (turn==='w') parts.push(`${num}.${ptSan(mv.san)}`); else parts.push(first ? `${num}...${ptSan(mv.san)}` : ptSan(mv.san));
    if (turn==='b') num++; turn = turn==='w' ? 'b' : 'w'; first = false;
  }
  return parts.join(' ');
}
const tagHTML = tags => tags.length ? `<div class="tags">${tags.map(t => `<span class="tag${NEG.indexOf(t)>=0 || t==='peca_pendurada' ? ' neg' : ''}" title="${esc(TAG[t][1])}">${TAG[t][0]}</span>`).join('')}</div>` : '';
function renderReviewMoves(){
  const R = RV.R, uc = R.userColor;
  let top;
  if (RV.retry){
    const r = RV.retry;
    top = bubble(r.done ? (r.ok ? 'Isso!' : 'Solução') : 'Encontre o melhor lance', `<p>${r.msg || 'Jogue o lance que você faria nesta posição.'}</p>`) +
      `<div class="row">${!r.done && r.tries>=2 ? '<button class="btn sm" id="rtSol"><svg><use href="#i-eye"/></svg>Ver solução</button>' : ''}<button class="btn sm" id="rtExit">${r.done ? 'Continuar' : 'Voltar'}</button></div>`;
  } else if (RV.ply===0){
    top = bubble('Posição inicial', '<p>Use ▶ para andar lance a lance ou pule para o próximo erro.</p>');
  } else {
    const i = RV.ply-1, m = R.moves[i], it = R.items[i], meta = CLS[it.c], c = coachOf(R, i);
    const sA = toWhite(R.an[i+1].score, R.fens[i+1].split(' ')[1]);
    const ev = (('mate' in sA) && sA.mate===0) ? '#' : fmtEval(sA);
    const showBest = c.best && (RV.best || BAD.indexOf(it.c)>=0);
    top = bubble(`${ptSan(m.san)} é ${meta.a}<span class="ev">${ev}</span>`, `<p>${c.text}</p>${showBest ? `<div class="best">Melhor: <b>${ptSan(c.best.san)}</b>${c.line ? ' · ' + c.line : ''}</div>` : ''}${tagHTML(c.tags)}`, clsIcon(it.c, true));
    const mine = m.color===uc;
    top += `<div class="row">${c.best ? '<button class="btn sm go" id="rvWhy">Por quê?</button>' : ''}${c.best && !showBest ? '<button class="btn sm" id="rvBest"><svg><use href="#i-bulb"/></svg>Melhor lance</button>' : ''}${mine && BAD.indexOf(it.c)>=0 ? '<button class="btn sm" id="rvRetry"><svg><use href="#i-retry"/></svg>Tentar de novo</button>' : ''}${mine ? `<a class="btn sm" href="${trainerHref(R, i)}" target="_blank" rel="noopener">Perguntar ao treinador</a>` : ''}</div>`;
  }
  const items = R.items;
  let list = '<div class="moves">', strip = '<div class="mstrip" id="rvStrip">';
  for (let i=0;i<R.moves.length;i+=2){
    const cell = j => { if (j>=R.moves.length) return '<div class="m"></div>'; const it = items[j]; const show = ['brilhante','otimo','imprecisao','erro','perdido','capivarada','melhor','livro'].indexOf(it.c)>=0; return `<div class="m"><button data-ply="${j+1}" class="${RV.ply===j+1?'cur':''}">${show ? clsIcon(it.c) : ''}${ptSan(R.moves[j].san)}</button></div>`; };
    list += `<div class="n">${i/2+1}.</div>${cell(i)}${cell(i+1)}`;
    const sc = j => { if (j>=R.moves.length) return ''; const it = items[j]; const show = ['brilhante','otimo','imprecisao','erro','perdido','capivarada'].indexOf(it.c)>=0; return `<button data-ply="${j+1}" class="${RV.ply===j+1?'cur':''}">${show ? clsIcon(it.c) : ''}${ptSan(R.moves[j].san)}</button>`; };
    strip += `<span class="num">${i/2+1}.</span>${sc(i)}${sc(i+1)}`;
  }
  list += '</div>'; strip += '</div>';
  const mob = window.matchMedia('(max-width:900px)').matches;
  $('rvBody').innerHTML = top + (mob ? strip : list);
  $('rvFoot').innerHTML = `<div class="ctrls"><button class="btn" data-nav="first" aria-label="Início"><svg><use href="#i-first"/></svg></button><button class="btn" data-nav="prev" aria-label="Anterior"><svg><use href="#i-prev"/></svg></button><button class="btn go" data-nav="next" aria-label="Próximo"><svg><use href="#i-next"/></svg></button><button class="btn" data-nav="last" aria-label="Fim"><svg><use href="#i-last"/></svg></button></div><button class="btn sm" id="rvNextErr">Próximo erro seu ›</button>`;
  const cb = $('rvBody').querySelector('button.cur');
  if (cb){
    const strip = $('rvStrip');
    if (mob && strip) strip.scrollLeft = cb.offsetLeft - strip.clientWidth/2 + cb.offsetWidth/2;
    else { const box = $('rvBody'); const top = cb.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop; if (top < box.scrollTop + 120 || top > box.scrollTop + box.clientHeight - 40) box.scrollTop = top - box.clientHeight/2; }
  }
  const b1 = $('rvBest'); if (b1) b1.onclick = () => { RV.best = true; renderReview(); };
  const b0 = $('rvWhy'); if (b0) b0.onclick = () => openCompare(RV.ply - 1);
  const b2 = $('rvRetry'); if (b2) b2.onclick = () => { startRetry(RV.ply); renderReview(); };
  const b3 = $('rtSol'); if (b3) b3.onclick = () => { const r = RV.retry; r.done = true; r.showSol = true; r.msg = `O melhor era <b>${r.best ? ptSan(r.best.san) : '—'}</b>.`; renderReview(); };
  const b4 = $('rtExit'); if (b4) b4.onclick = () => { const k = RV.retry.k; RV.retry = null; setPly(k); };
}
/* ----- "Por quê?": compara o seu lance com o melhor, lance a lance ----- */
const TRAINER = 'https://claude.ai/artifact/H2Puu1ty2JuCVGeWH6BE1q';
function b64url(obj){
  const bytes = new TextEncoder().encode(JSON.stringify(obj)); let bin = '';
  for (let i=0;i<bytes.length;i+=0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i+0x8000));
  return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function trainerHref(R, i, testUci){
  const oc = R.moves[i].color==='w' ? 'b' : 'w';
  const pay = {f:R.fens[i], p:testUci || uciOf(R.moves[i]), o:(R.names[oc]||{}).name || '', g: i <= 60 ? linePT(R.fens[0], R.moves.slice(0, i).map(uciOf)) : ''};
  if (!testUci) pay.cl = R.items[i].c;
  return TRAINER + '#' + b64url(pay);
}
async function openCompare(i){
  const R = RV.R, base = R.fens[i], me = R.moves[i].color;
  RV.cmp = {i, tab:'mine', k:1, loading:true, tok:{}};
  renderReview();
  const tok = RV.cmp.tok; const played = uciOf(R.moves[i]);
  const gA = new Chess(base); uciMove(gA, played);
  const [b, a] = await Promise.all([analysePos(base, {movetime:900, multipv:1, jsDepth:3, jsMs:900}, 2), analysePos(gA.fen(), {movetime:900, multipv:1, jsDepth:3, jsMs:900}, 2)]);
  if (!RV || !RV.cmp || RV.cmp.tok!==tok) return;
  const bestLine = b.lines[0] ? b.lines[0].pv.slice(0, 8) : [R.items[i].bestUci];
  const mineLine = [played].concat(a.lines[0] ? a.lines[0].pv.slice(0, 7) : []);
  Object.assign(RV.cmp, {loading:false, mine:lineInfo(base, mineLine, me), best:lineInfo(base, bestLine, me)});
  renderReview();
}
function cmpLine(){ const c = RV.cmp; return c.tab==='mine' ? c.mine : c.tab==='best' ? c.best : c.test; }
function renderCompare(){
  const R = RV.R, c = RV.cmp, i = c.i, base = R.fens[i], me = R.moves[i].color, st = rvStage;
  $('rvTitle').textContent = 'Por quê?'; $('rvSumBtn').textContent = 'Resumo';
  setEval(st.ev, R.an[i].score, base.split(' ')[1], R.userColor);
  if (c.loading){
    st.board.set({fen:base, orient:R.userColor});
    $('rvBody').innerHTML = bubble('Comparando os lances…', '<p>O Stockfish está calculando as duas sequências.</p>');
    $('rvFoot').innerHTML = '<button class="btn sm" id="cmpClose">Voltar à revisão</button>';
    $('cmpClose').onclick = () => { RV.cmp = null; renderReview(); };
    return;
  }
  const L = cmpLine();
  if (c.tab==='test' && !L){
    st.board.set({fen:base, orient:R.userColor, movable:me, onMove:cmpTest});
  } else {
    const g = new Chess(base); let last = null;
    for (let k=0;k<c.k;k++){ const m = uciMove(g, L.ucis[k]); if (!m) break; last = [m.from, m.to]; }
    const next = L.ucis[c.k];
    st.board.set({fen:g.fen(), orient:R.userColor, last, arrows: next ? [{from:next.slice(0,2), to:next.slice(2,4), color: c.tab==='mine' ? '#e6912c' : '#81b64c', op:.75}] : [], movable: c.tab==='test' ? null : undefined});
  }
  const pm = ptSan(c.mine.sans[0]), pb = ptSan(c.best.sans[0] || c.mine.sans[0]);
  const card = (key, title, info, col) => `<button class="pick" data-tab="${key}" aria-pressed="${c.tab===key}" style="--c:var(${col})"><b>${esc(title)}</b><small>${info ? esc(lineSummary(info, me)) : 'Jogue qualquer lance no tabuleiro.'}</small></button>`;
  let chips = '';
  if (L){
    const gg = new Chess(base); let num = +base.split(' ')[5] || 1, turn = base.split(' ')[1];
    L.ucis.forEach((u, k) => { const m = uciMove(gg, u); if (!m) return; if (turn==='w') chips += `<span class="num">${num}.</span>`; else if (k===0) chips += `<span class="num">${num}...</span>`; chips += `<button data-ck="${k+1}" class="${c.k===k+1?'cur':''}">${ptSan(m.san)}</button>`; if (turn==='b') num++; turn = turn==='w' ? 'b' : 'w'; });
  }
  const why = whyText(base, c.mine, c.best, me);
  $('rvBody').innerHTML = bubble(`${pm} × ${pb}`, `<p>${esc(why)}</p>`) +
    `<div class="picks">${card('mine', 'Seu lance: ' + pm, c.mine, CLS[R.items[i].c].c)}${card('best', 'Melhor: ' + pb, c.best, '--c-melhor')}</div>
     ${card('test', c.test ? 'Seu teste: ' + ptSan(c.test.sans[0]) : 'Testar outro lance', c.test, '--c-otimo')}
     ${L ? `<div class="mstrip" style="flex-wrap:wrap">${chips}</div>` : ''}
     ${R.moves[i].color===R.userColor ? `<a class="btn sm" href="${trainerHref(R, i, c.tab==='test' && c.test ? c.test.ucis[0] : null)}" target="_blank" rel="noopener">Perguntar ao treinador sobre ${esc(c.tab==='test' && c.test ? ptSan(c.test.sans[0]) : pm)}</a>` : ''}`;
  $('rvFoot').innerHTML = `${L ? `<div class="ctrls"><button class="btn" data-cn="0" aria-label="Início"><svg><use href="#i-first"/></svg></button><button class="btn" data-cn="-1" aria-label="Anterior"><svg><use href="#i-prev"/></svg></button><button class="btn go" data-cn="1" aria-label="Próximo"><svg><use href="#i-next"/></svg></button><button class="btn" data-cn="9" aria-label="Fim"><svg><use href="#i-last"/></svg></button></div>` : ''}<button class="btn sm" id="cmpClose">Voltar à revisão</button>`;
  $('cmpClose').onclick = () => { RV.cmp = null; renderReview(); };
}
async function cmpTest(from, to, promo){
  const R = RV.R, c = RV.cmp, base = R.fens[c.i], me = R.moves[c.i].color;
  const g = new Chess(base); const m = g.move({from, to, promotion:promo}); if (!m) return false;
  rvStage.board.set({fen:g.fen(), orient:R.userColor, last:[m.from, m.to]}, {from:m.from, to:m.to});
  $('rvBody').querySelector('.bubble p').textContent = 'Calculando a sequência do seu teste…';
  const tok = c.tok; const a = await analysePos(g.fen(), {movetime:800, multipv:1, jsDepth:3, jsMs:800}, 2);
  if (!RV || RV.cmp!==c || c.tok!==tok) return;
  c.test = lineInfo(base, [uciOf(m)].concat(a.lines[0] ? a.lines[0].pv.slice(0, 7) : []), me); c.k = 1;
  renderReview();
}
$('rvBody').addEventListener('click', e => {
  if (!RV || !RV.cmp || RV.cmp.loading) return;
  const t = e.target.closest('[data-tab]'); if (t){ RV.cmp.tab = t.dataset.tab; RV.cmp.k = t.dataset.tab==='test' && !RV.cmp.test ? 0 : 1; renderReview(); return; }
  const k = e.target.closest('[data-ck]'); if (k){ RV.cmp.k = +k.dataset.ck; renderReview(); }
});
$('rvFoot').addEventListener('click', e => {
  if (!RV || !RV.cmp) return; const b = e.target.closest('[data-cn]'); if (!b) return;
  const L = cmpLine(); if (!L) return; const n = +b.dataset.cn;
  RV.cmp.k = n===0 ? 0 : n===9 ? L.ucis.length : Math.max(0, Math.min(L.ucis.length, RV.cmp.k + n)); renderReview();
});
function setPly(k){ if (!RV) return; RV.retry = null; RV.best = false; RV.cmp = null; RV.ply = Math.max(0, Math.min(RV.R.moves.length, k)); renderReview(); }
$('rvBody').addEventListener('click', e => { const b = e.target.closest('[data-ply]'); if (b){ RV.mode = 'moves'; setPly(+b.dataset.ply); } });
$('rvFoot').addEventListener('click', e => {
  if (!RV) return;
  const b = e.target.closest('[data-nav]');
  if (b){ const n = b.dataset.nav; RV.mode = 'moves'; setPly(n==='first' ? 0 : n==='prev' ? RV.ply-1 : n==='next' ? RV.ply+1 : RV.R.moves.length); if (n==='next' && RV.ply>0) snd(RV.R.moves[RV.ply-1].captured ? 'capture' : 'move'); return; }
  if (e.target.closest('#rvNextErr')){
    const R = RV.R, N = R.moves.length;
    for (let k=1;k<=N;k++){ const j = (RV.ply + k - 1) % N; const it = R.items[j]; if (it.color===R.userColor && BAD.indexOf(it.c)>=0){ RV.mode = 'moves'; setPly(j+1); return; } }
    toast('Nenhum erro seu nesta partida!');
  }
});
$('rvSumBtn').addEventListener('click', () => { if (!RV) return; RV.retry = null; RV.cmp = null; RV.mode = RV.mode==='summary' ? 'moves' : 'summary'; renderReview(); });
$('rvBack').addEventListener('click', () => { rvTok++; fgId = null; back(); bgRun(); });
document.addEventListener('keydown', e => {
  if (cur!=='v-review' || !RV || RV.retry || (e.target.closest && e.target.closest('input'))) return;
  if (e.key==='ArrowLeft'){ e.preventDefault(); RV.mode = 'moves'; setPly(RV.ply-1); }
  else if (e.key==='ArrowRight'){ e.preventDefault(); RV.mode = 'moves'; setPly(RV.ply+1); }
});
function startRetry(k){ const R = RV.R; RV.mode = 'moves'; RV.retry = {k, tries:0, done:false, best: moveFromUci(R.fens[k-1], R.items[k-1].bestUci)}; }
function retryMove(from, to, promo){
  const r = RV.retry, R = RV.R; if (!r || r.done) return false;
  const fen = R.fens[r.k-1]; const g = new Chess(fen); const m = g.move({from, to, promotion:promo}); if (!m) return false;
  const A = R.an[r.k-1]; const ok = [A.lines[0] && A.lines[0].pv[0]];
  if (A.lines[1] && winPct(A.lines[0].score) - winPct(A.lines[1].score) < 3) ok.push(A.lines[1].pv[0]);
  r.tries++;
  if (ok.indexOf(uciOf(m))>=0 || g.in_checkmate()){
    r.done = true; r.ok = true; r.best = m; r.msg = `<b>${ptSan(m.san)}</b> ${uciOf(m)===ok[0] ? 'é o melhor lance' : 'é tão bom quanto o melhor'}.`; snd('ok');
    rvStage.board.set({fen:g.fen(), orient:R.userColor, last:[m.from, m.to], badge:{sq:m.to, s:'✓', c:'--c-melhor'}}, {from:m.from, to:m.to});
    renderReviewMoves(); return;
  }
  snd('bad'); r.msg = `<b>${ptSan(m.san)}</b> não é o melhor. Tente outra vez.`;
  rvStage.board.set({fen:g.fen(), orient:R.userColor, last:[m.from, m.to], marks:{[m.to]:'var(--c-cap)'}, badge:{sq:m.to, s:'✕', c:'--c-cap'}}, {from:m.from, to:m.to});
  setTimeout(() => { if (RV && RV.retry===r) renderReview(); }, 650);
  renderReviewMoves();
}

/* =====================================================================
   Diagnóstico (Desempenho)
   ===================================================================== */
let profCache = null;
function analyzedRs(){ return G.list.slice(0, BG_N).map(reviewOf).filter(Boolean); }
function buildProfile(Rs){
  const P = {n:Rs.length, W:0, D:0, L:0, acc:[], ph:[[],[],[]], cls:{}, tags:{}, ex:{}, errs:0, fast:0, low:0, clocked:0, timeouts:0, thrown:[], worst:null};
  Rs.forEach(r => {
    const u = r.userColor; P[r.res]++; P.acc.push(r.side[u].acc);
    r.phases.forEach((v,k) => { if (v!=null) P.ph[k].push(v); });
    const tc = r.tc, hasClk = !!(r.clocks && tc);
    r.items.forEach((it, i) => {
      if (it.color!==u) return;
      P.cls[it.c] = (P.cls[it.c]||0) + 1;
      if (BAD.indexOf(it.c)<0) return;
      if (!P.worst || it.d > P.worst.d) P.worst = {r, i, d:it.d};
      if (it.c==='erro' || it.c==='capivarada'){
        P.errs++;
        if (hasClk){ P.clocked++; const left = r.clocks[i], prev = i>=2 ? r.clocks[i-2] : tc.base; const spent = prev - left + (i>=2 ? tc.inc : 0); if (spent < 5 && tc.base >= 180) P.fast++; if (left < tc.base*0.1) P.low++; }
      }
      coachOf(r, i).tags.forEach(t => { if (STRONG.indexOf(t)<0 && NEG.indexOf(t)<0 && t!=='peca_pendurada') return; P.tags[t] = (P.tags[t]||0) + 1; if (!P.ex[t] || it.d > P.ex[t].d) P.ex[t] = {r, i, d:it.d}; });
    });
    if (r.res==='L' && r.why==='tempo') P.timeouts++;
    const mine = r.items.map((x,i)=>({x,i})).filter(o => o.x.color===u);
    let peak = -1, pk = -1; mine.forEach(o => { if (o.x.wa > peak){ peak = o.x.wa; pk = o.i; } });
    if (r.res!=='W' && peak >= 85){ const after = mine.filter(o => o.i > pk && BAD.indexOf(o.x.c)>=0).sort((a,b)=>b.x.d-a.x.d)[0]; P.thrown.push({r, i: after ? after.i : pk}); }
  });
  return P;
}
const famOf = name => !name ? 'Outras' : name.split(',')[0].split(' com ')[0].replace(/ \(.*\)$/,'');
function openingStats(){
  const O = {};
  G.list.forEach(info => { const d = reviewData(info); if (!d) return; const fam = famOf(openingInfo(d.moves.map(m=>m.san)).name); const k = info.side + '|' + fam; const o = O[k] || (O[k] = {color:info.side, name:fam, W:0, D:0, L:0, n:0}); o[info.res]++; o.n++; });
  return Object.values(O).sort((a,b)=>b.n-a.n);
}
const TAG2THEME = {garfo:'garfo', cravada:'cravada', cravada_abs:'cravada', espeto:'espeto', ataque_descoberto:'descoberto', xeque_descoberto:'descoberto', xeque_duplo:'duplo', peca_indefesa:'indefesa', peca_pendurada:'indefesa', ganho_material:'vantagem', promocao:'promocao', mate_corredor:'corredor', mate_sufocado:'sufocado', mate:'mate2', ameaca_mate:'mate2'};
function weaknesses(P, ops){
  const L = []; const n = P.n;
  const blunders = P.cls.capivarada || 0, hang = P.tags.peca_pendurada || 0;
  if (blunders/n >= 0.5 || hang >= 2) L.push({score:100+blunders*5, c:'--c-cap', ic:'??', title:'Peças entregues', fact:`${blunders} ${plural(blunders,'capivarada','capivaradas')} em ${n} partidas${hang ? `, ${hang} ${plural(hang,'peça deixada','peças deixadas')} sem defesa` : ''}.`, rule:'Antes de soltar a peça: o que fica sem defesa?', theme:'indefesa', ex:P.ex.peca_pendurada || P.worst});
  const tac = Object.entries(P.tags).filter(([t]) => STRONG.indexOf(t)>=0 && TAG2THEME[t] && !(L.length && (t==='peca_indefesa' || t==='ganho_material'))).sort((a,b)=>b[1]-a[1]);
  tac.slice(0,2).forEach(([t,c], k) => { if (c < 2) return; L.push({score:60+c*8-k*15, c:'--c-erro', ic:'!', title:TAG[t][0], fact:`Apareceu em ${c} dos seus erros: ${TAG[t][1]}.`, rule:`Procure ${TAG[t][0].toLowerCase()} para os dois lados.`, theme:TAG2THEME[t], ex:P.ex[t]}); });
  if (P.clocked >= 3 && P.fast/P.clocked >= 0.35) L.push({score:72, c:'--c-imp', ic:'⏱', title:'Lances rápidos demais', fact:`${P.fast} de ${P.clocked} erros graves em menos de 5 segundos.`, rule:'Captura, xeque ou ameaça? Conte até 5.', theme:'rec'});
  if ((P.clocked >= 3 && P.low/P.clocked >= 0.35) || P.timeouts >= 2) L.push({score:66, c:'--c-imp', ic:'⏱', title:'Relógio', fact:`${P.timeouts} ${plural(P.timeouts,'derrota','derrotas')} por tempo, ${P.low} erros com pouco tempo.`, rule:'No lance 20, ainda ter metade do relógio.', learn:'o:' + (S.color==='b' ? 'carokann' : 'italiana')});
  if (P.thrown.length >= 2 || (P.thrown.length===1 && n <= 5)) L.push({score:55+P.thrown.length*10, c:'--c-perd', ic:'✕', title:'Vitórias que escaparam', fact:`Em ${P.thrown.length} ${plural(P.thrown.length,'partida','partidas')} você esteve ganhando e não venceu.`, rule:'Ganhando? Troque peças e corte o contra-ataque.', learn:'c:trocar', ex:{r:P.thrown[0].r, i:P.thrown[0].i}});
  const bad = ops.filter(o => o.n >= 3 && o.L/o.n >= 0.6).sort((a,b)=>b.L-a.L)[0];
  const opAcc = avg(P.ph[0]);
  if (bad || (opAcc!=null && opAcc < 75)){
    const col = bad ? bad.color : 'w';
    L.push({score:50, c:'--c-livro', ic:'T', title:'Aberturas', fact: bad ? `${bad.name} de ${bad.color==='w'?'brancas':'pretas'}: ${bad.L} derrotas em ${bad.n}.` : `Precisão na abertura: ${Math.round(opAcc)}%.`, rule:'Centro, cavalos, bispos, roque. Nessa ordem.', learn: 'o:' + (col==='w' ? 'italiana' : 'carokann')});
  }
  const eg = avg(P.ph[2]);
  if (eg!=null && P.ph[2].length >= 2 && eg < 75) L.push({score:45, c:'--c-otimo', ic:'♔', title:'Finais', fact:`Precisão nos finais: ${Math.round(eg)}%.`, rule:'No final, rei para o centro.', learn:'m:kr'});
  if (L.length < 2) L.push({score:10, c:'--c-melhor', ic:'★', title:'Próximo nível', fact:`Precisão média de ${Math.round(avg(P.acc)||0)}%, sem ponto fraco gritante.`, rule:'Em cada fase: qual é minha pior peça?', learn:'c:casa', theme:'rec'});
  return L.sort((a,b)=>b.score-a.score).slice(0,3);
}
function profile(){
  if (profCache) return profCache;
  const Rs = analyzedRs(); if (Rs.length < 3) return null;
  const P = buildProfile(Rs); const ops = openingStats();
  profCache = {P, ops, W: weaknesses(P, ops), Rs};
  return profCache;
}
function renderStats(){
  const v = $('v-stats');
  const pr = profile();
  if (!pr){
    const n = analyzedRs().length, total = Math.min(BG_N, G.list.length);
    v.innerHTML = `<div class="page-h"><h1>Desempenho</h1></div><div class="card"><p style="margin:0 0 10px">${G.list.length ? `Analisando suas partidas: ${n} de ${total}. Com 3 prontas, seu diagnóstico aparece aqui.` : 'Assim que suas partidas chegarem, eu analiso e mostro aqui onde você mais erra.'}</p><div class="bar"><i style="width:${total ? pct(n, total) : 0}%"></i></div></div>`;
    return;
  }
  const {P, ops, W} = pr;
  const r = bestRating(); const blitz = G.stats && G.stats.chess_blitz && G.stats.chess_blitz.last;
  const a = P.acc, rec = a.slice(0,5), prev = a.slice(5,10); const trend = prev.length >= 3 ? avg(rec) - avg(prev) : null;
  const ph = P.ph.map(avg);
  const tacs = Object.entries(P.tags).filter(([t]) => STRONG.indexOf(t)>=0 || t==='peca_pendurada').sort((x,y)=>y[1]-x[1]).slice(0,5);
  const tmax = tacs.length ? tacs[0][1] : 1;
  v.innerHTML = `<div class="page-h"><h1>Desempenho</h1><span class="muted" style="font-size:13px">Últimas ${P.n} partidas</span></div>
  <div class="tiles">
    <div class="tile"><small>${r ? CC_TC[r.kind] : 'Rating'}</small><b>${r ? r.rating : '—'}</b><span class="sub">${blitz && r && r.kind!=='blitz' ? `Blitz ${blitz.rating}` : '&nbsp;'}</span></div>
    <div class="tile"><small>Resultados</small><b>${P.W}<span class="muted" style="font-size:16px"> V</span> ${P.D}<span class="muted" style="font-size:16px"> E</span> ${P.L}<span class="muted" style="font-size:16px"> D</span></b><div class="wdl"><i style="width:${pct(P.W,P.n)}%;background:var(--green)"></i><i style="width:${pct(P.D,P.n)}%;background:#8f8d89"></i><i style="width:${pct(P.L,P.n)}%;background:var(--red)"></i></div></div>
    <div class="tile"><small>Precisão média</small><b>${avg(a).toFixed(1)}</b><span class="sub">${trend==null ? '&nbsp;' : `${trend>=0?'▲':'▼'} ${Math.abs(trend).toFixed(1)} nas últimas 5`}</span></div>
    <div class="tile"><small>Capivaradas por partida</small><b>${((P.cls.capivarada||0)/P.n).toFixed(1)}</b><span class="sub">${((P.cls.erro||0)/P.n).toFixed(1)} erros por partida</span></div>
  </div>
  <div class="grid2">
    <div>
      <div class="sec-h">Onde você mais perde pontos</div>
      ${W.map((w,k) => `<div class="weak" style="--c:var(${w.c})"><span class="ico">${w.ic}</span><div><h3>${esc(w.title)}</h3><p>${esc(w.fact)}</p><div class="row">${w.theme ? `<button class="btn sm go" data-train="${w.theme}">Treinar</button>` : ''}${w.learn ? `<button class="btn sm" data-learn="${w.learn}">Aprender</button>` : ''}${w.ex ? `<button class="btn sm" data-ex="${k}">Ver na partida</button>` : ''}</div></div></div>`).join('')}
      <div class="sec-h">Cuidado na próxima partida</div>
      <div class="card"><ul class="rules">${W.map(w => `<li><span>${esc(w.rule)}</span></li>`).join('')}</ul></div>
    </div>
    <div>
      <div class="sec-h">Precisão por fase</div>
      <div class="card">${['Abertura','Meio-jogo','Final'].map((n,k) => `<div class="hbar"><span>${n}</span><div class="bar"><i style="width:${ph[k]==null?0:Math.round(ph[k])}%;background:${ph[k]==null?'transparent':ph[k]>=85?'var(--green)':ph[k]>=70?'var(--c-imp)':'var(--red)'}"></i></div><b>${ph[k]==null ? '—' : Math.round(ph[k])+'%'}</b></div>`).join('')}</div>
      ${tacs.length ? `<div class="sec-h">Táticas nos seus erros</div><div class="card">${tacs.map(([t,c]) => `<div class="hbar"><span>${TAG[t][0]}</span><div class="bar"><i style="width:${pct(c,tmax)}%;background:var(--c-erro)"></i></div><b>${c}</b></div>`).join('')}</div>` : ''}
      ${P.clocked ? `<div class="sec-h">Relógio</div><div class="card"><div class="hbar"><span>Erros em menos de 5 s</span><div class="bar"><i style="width:${pct(P.fast,P.clocked)}%;background:var(--c-imp)"></i></div><b>${pct(P.fast,P.clocked)}%</b></div><div class="hbar"><span>Erros com pouco tempo</span><div class="bar"><i style="width:${pct(P.low,P.clocked)}%;background:var(--c-imp)"></i></div><b>${pct(P.low,P.clocked)}%</b></div><div class="hbar"><span>Derrotas por tempo</span><div class="bar"><i style="width:${pct(P.timeouts,P.n)}%;background:var(--red)"></i></div><b>${P.timeouts}</b></div></div>` : ''}
      <div class="sec-h">Aberturas</div>
      <div class="card">${ops.slice(0,6).map(o => `<div class="oprow"><span class="dot ${o.color}"></span><span class="nm">${esc(o.name)}</span><div class="wdl" style="margin:0"><i style="width:${pct(o.W,o.n)}%;background:var(--green)"></i><i style="width:${pct(o.D,o.n)}%;background:#8f8d89"></i><i style="width:${pct(o.L,o.n)}%;background:var(--red)"></i></div><span class="muted" style="font-size:13px">${o.W}/${o.D}/${o.L}</span></div>`).join('') || '<span class="muted">Sem dados ainda.</span>'}</div>
    </div>
  </div>
  <div class="row" style="margin-top:22px"><button class="btn sm" id="copyDiag">Copiar diagnóstico para o Claude</button><span class="muted" style="font-size:13px" id="copyMsg"></span></div>`;
  $('copyDiag').onclick = copyDiag;
}
$('v-stats').addEventListener('click', e => {
  const t = e.target.closest('[data-train]'); if (t){ startPuzzles(t.dataset.train); return; }
  const l = e.target.closest('[data-learn]'); if (l){ openLearn(l.dataset.learn); return; }
  const x = e.target.closest('[data-ex]'); if (x){ const pr = profile(); const w = pr && pr.W[+x.dataset.ex]; if (w && w.ex) startReview(w.ex.r, {ply:w.ex.i+1, retry:true}); }
});
async function copyDiag(){
  const pr = profile(); if (!pr) return;
  const {P, ops, W} = pr; const r = bestRating();
  const txt = `Seja meu professor particular de xadrez. Fale em português do Brasil, de forma direta e encorajadora. Uso só recursos gratuitos (como o Lichess).
Usuário no chess.com: ${S.user}. Rating: ${r ? CC_TC[r.kind] + ' ' + r.rating : '—'}.
Últimas ${P.n} partidas (análise do Stockfish): ${P.W}V ${P.D}E ${P.L}D; precisão média ${avg(P.acc).toFixed(1)}%; por fase: abertura ${P.ph[0].length?Math.round(avg(P.ph[0]))+'%':'—'}, meio-jogo ${P.ph[1].length?Math.round(avg(P.ph[1]))+'%':'—'}, final ${P.ph[2].length?Math.round(avg(P.ph[2]))+'%':'—'}.
Lances: ${CLS_ORDER.map(k => `${CLS[k].n} ${P.cls[k]||0}`).join(', ')}.
Erros graves rápidos (<5s): ${P.fast}/${P.clocked}; com pouco tempo: ${P.low}/${P.clocked}; derrotas por tempo: ${P.timeouts}; vitórias que escaparam: ${P.thrown.length}.
Táticas nos meus erros: ${Object.entries(P.tags).map(([t,c]) => TAG[t][0] + ' ' + c).join(', ') || 'nenhuma'}.
Aberturas: ${ops.slice(0,6).map(o => `${o.color==='w'?'brancas':'pretas'} ${o.name} ${o.W}/${o.D}/${o.L}`).join('; ')}.
Pontos fracos detectados: ${W.map(w => w.title + ' (' + w.fact + ')').join('; ')}.
Escreva em Markdown: ## Diagnóstico, ## 3 prioridades, ## Repertório para mim, ## Plano de 7 dias, ## Meta para as próximas 10 partidas. Máximo 700 palavras.`;
  try { await navigator.clipboard.writeText(txt); $('copyMsg').textContent = 'Copiado! Cole numa conversa em claude.ai.'; }
  catch(e){ $('copyMsg').textContent = 'Não consegui copiar automaticamente neste aparelho.'; }
}

/* =====================================================================
   Exercícios
   ===================================================================== */
const THEMES = {
  mate1:{n:'Mate em 1', g:'m'}, mate2:{n:'Mate em 2', g:'m'}, mate3:{n:'Mate em 3+', g:'m'}, corredor:{n:'Mate do corredor', g:'m'}, sufocado:{n:'Mate sufocado', g:'m'},
  garfo:{n:'Garfo', g:'t'}, cravada:{n:'Cravada', g:'t'}, espeto:{n:'Espeto', g:'t'}, descoberto:{n:'Ataque descoberto', g:'t'}, duplo:{n:'Xeque duplo', g:'t'}, indefesa:{n:'Peça indefesa', g:'t'}, promocao:{n:'Promoção', g:'t'}, vantagem:{n:'Ganhe material', g:'t'}
};
const ALLP = (typeof PUZZLES !== 'undefined' ? PUZZLES : []);
function myPuzzles(){
  const out = [];
  analyzedRs().forEach(R => R.items.forEach((it, i) => {
    if (it.color!==R.userColor || ['erro','capivarada','perdido'].indexOf(it.c)<0 || i===0 || !it.bestUci) return;
    const A = R.an[i]; const alt = A.lines[1] && winPct(A.lines[0].score) - winPct(A.lines[1].score) < 3 ? [A.lines[1].pv[0]] : [];
    out.push({id:`my:${R.id}:${i}`, fen:R.fens[i-1], moves:[uciOf(R.moves[i-1]), it.bestUci], alt:{1:alt}, themes:['mine'], rating:1100, mine:{opp:(R.names[R.userColor==='w'?'b':'w']||{}).name, played:R.moves[i].san, ply:i+1, rid:R.id}});
  }));
  return out;
}
function poolFor(theme){
  if (theme==='mine') return myPuzzles();
  if (theme==='rec'){
    const pr = profile(); let want = [];
    if (pr){ want = pr.W.map(w => w.theme).filter(t => t && t!=='rec'); Object.entries(pr.P.tags).sort((a,b)=>b[1]-a[1]).forEach(([t]) => { if (TAG2THEME[t]) want.push(TAG2THEME[t]); }); }
    want = Array.from(new Set(want.concat(['indefesa','garfo','mate1','mate2'])));
    const mine = myPuzzles().filter(p => !S.pzDone[p.id]);
    const themed = ALLP.filter(p => p.themes.some(t => want.indexOf(t)>=0));
    return mine.slice(0, 6).concat(themed);
  }
  return ALLP.filter(p => p.themes.indexOf(theme)>=0);
}
function pickPuzzle(pool, exclude){
  const fresh = pool.filter(p => !S.pzDone[p.id] && p.id!==exclude);
  const base = fresh.length ? fresh : pool.filter(p => p.id!==exclude);
  if (!base.length) return null;
  const mine = base.filter(p => p.mine); if (mine.length && Math.random() < 0.5) return mine[Math.floor(Math.random()*mine.length)];
  const near = base.filter(p => Math.abs((p.rating||1200) - S.pz) <= 300);
  const src = near.length ? near : base.slice().sort((a,b) => Math.abs((a.rating||1200)-S.pz) - Math.abs((b.rating||1200)-S.pz)).slice(0, 12);
  return src[Math.floor(Math.random()*src.length)];
}
function today(){ return new Date().toISOString().slice(0,10); }
function renderPuzzles(){
  const v = $('v-puzzles');
  if (S.pzDay !== today()){ S.pzDay = today(); S.pzToday = 0; save(); }
  const pr = profile(); const mine = myPuzzles();
  const recNames = pr ? Array.from(new Set(pr.W.map(w => w.theme).filter(t => t && THEMES[t]))).map(t => THEMES[t].n) : [];
  const card = (key, name) => {
    const pool = poolFor(key); if (!pool.length || (key!=='mine' && pool.length < 5)) return '';
    const done = pool.filter(p => S.pzDone[p.id]).length; const p0 = pool[0];
    const g = new Chess(p0.fen); const m = p0.moves[0]; g.move({from:m.slice(0,2), to:m.slice(2,4), promotion:m[4]||undefined});
    return `<button class="tcard" data-theme="${key}">${mini(g.fen(), g.turn())}<b>${name}</b><small>${done} de ${pool.length} resolvidos</small><span class="meter"><i style="width:${pct(done,pool.length)}%"></i></span></button>`;
  };
  v.innerHTML = `<div class="page-h"><h1>Exercícios</h1></div>
    <div class="hero"><div><h2>Treino recomendado</h2><p>${recNames.length ? 'Focado em: ' + recNames.join(', ') + '.' : 'Táticas e mates, com prioridade para o que você erra.'}</p></div><button class="btn go" data-theme="rec">Começar</button></div>
    <div class="card" style="margin-top:12px"><div class="pstat"><span><b>${Math.round(S.pz)}</b> <small>rating de exercícios</small></span><span><b>${S.pzToday}</b> <small>hoje</small></span><span><b>${S.pzStreak}</b> <small>em sequência</small></span></div></div>
    <div class="sec-h">Dos seus erros</div>
    ${mine.length ? `<div class="cards">${card('mine', 'Posições das suas partidas')}</div>` : `<div class="card muted">${G.list.length ? 'Analisando suas partidas… os lances em que você errou viram exercícios aqui.' : 'Suas partidas viram exercícios aqui.'}</div>`}
    <div class="sec-h">Xeque-mate</div><div class="cards">${Object.keys(THEMES).filter(k => THEMES[k].g==='m').map(k => card(k, THEMES[k].n)).join('')}</div>
    <div class="sec-h">Táticas</div><div class="cards">${Object.keys(THEMES).filter(k => THEMES[k].g==='t').map(k => card(k, THEMES[k].n)).join('')}</div>`;
}
$('v-puzzles').addEventListener('click', e => { const b = e.target.closest('[data-theme]'); if (b) startPuzzles(b.dataset.theme); });
let PZ = null, pzStage = null;
function startPuzzles(theme){
  if (!pzStage) pzStage = makeStage('pzBoardCol', false);
  const pool = poolFor(theme);
  if (!pool.length){ toast('Ainda não há exercícios desse tema.'); return; }
  PZ = {theme, pool, p:null};
  show('v-puzzle', true);
  nextPuzzle();
}
function nextPuzzle(){
  const p = pickPuzzle(PZ.pool, PZ.p && PZ.p.id); if (!p){ toast('Você resolveu todos deste tema!'); back(); return; }
  const g = new Chess(p.fen);
  PZ.p = p; PZ.g = g; PZ.step = 0; PZ.failed = false; PZ.done = false; PZ.counted = false; PZ.msg = null; PZ.solver = g.turn()==='w' ? 'b' : 'w';
  $('pzTitle').textContent = PZ.theme==='rec' ? 'Treino recomendado' : PZ.theme==='mine' ? 'Dos seus erros' : THEMES[PZ.theme].n;
  pzRender();
  setTimeout(() => { if (PZ.p===p) pzOpp(); }, 450);
}
function pzApply(u){ const m = PZ.g.move({from:u.slice(0,2), to:u.slice(2,4), promotion:u[4]||undefined}); return m; }
function pzOpp(){
  const u = PZ.p.moves[PZ.step]; if (!u) return;
  const m = pzApply(u); PZ.step++; snd(soundOf(m, PZ.g));
  pzStage.board.set({fen:PZ.g.fen(), orient:PZ.solver, last:[m.from, m.to], movable: PZ.done ? null : PZ.solver, onMove: pzMove}, {from:m.from, to:m.to});
  pzPanel();
}
function pzMove(from, to, promo){
  if (PZ.done) return false;
  const exp = PZ.p.moves[PZ.step]; const fen = PZ.g.fen();
  const g2 = new Chess(fen); const m = g2.move({from, to, promotion:promo}); if (!m) return false;
  const u = uciOf(m);
  const alts = (PZ.p.alt && PZ.p.alt[PZ.step]) || [];
  const ok = u===exp || alts.indexOf(u)>=0 || g2.in_checkmate();
  if (ok){
    PZ.g = g2; PZ.step++; snd(soundOf(m, g2));
    const last = PZ.step >= PZ.p.moves.length || g2.game_over();
    pzStage.board.set({fen:g2.fen(), orient:PZ.solver, last:[m.from,m.to], badge:{sq:m.to, s:'✓', c:'--c-melhor'}, movable: last ? null : PZ.solver, onMove:pzMove}, {from:m.from, to:m.to});
    if (last){ pzSolved(); return; }
    PZ.msg = {k:'ok', t:'Isso! Continue.'}; pzPanel();
    setTimeout(() => { if (!PZ.done) pzOpp(); }, 380);
    return;
  }
  snd('bad'); PZ.msg = {k:'bad', t:'Não é esse. Tente de novo.'};
  if (!PZ.failed){ PZ.failed = true; pzRate(0); }
  pzStage.board.set({fen:g2.fen(), orient:PZ.solver, last:[m.from,m.to], marks:{[m.to]:'var(--c-cap)'}, badge:{sq:m.to, s:'✕', c:'--c-cap'}}, {from:m.from, to:m.to});
  setTimeout(() => { if (PZ && !PZ.done) pzStage.board.set({fen:PZ.g.fen(), orient:PZ.solver, last:null, movable:PZ.solver, onMove:pzMove}); }, 650);
  pzPanel();
}
function pzRate(result){
  if (PZ.counted) return; PZ.counted = true;
  const pr = PZ.p.rating || 1200; const exp = 1/(1+Math.pow(10, (pr - S.pz)/400));
  const d = Math.round(24*(result - exp)); S.pz = Math.max(400, S.pz + d); PZ.delta = d;
  S.pzDone[PZ.p.id] = result ? 1 : 2;
  if (result){ S.pzStreak++; S.pzToday++; } else S.pzStreak = 0;
  if (S.pzDay !== today()){ S.pzDay = today(); S.pzToday = result ? 1 : 0; }
  save();
}
function pzSolved(){
  PZ.done = true; snd('ok');
  if (!PZ.failed) pzRate(1);
  PZ.msg = {k: PZ.failed ? 'info' : 'ok', t: PZ.failed ? 'Resolvido, mas não de primeira.' : `Correto!${PZ.delta ? ` +${PZ.delta}` : ''}`};
  pzPanel();
}
function pzRender(){
  const p = PZ.p; const fen = p.fen;
  pzStage.board.set({fen, orient:PZ.solver});
  pzStage.top.innerHTML = ''; pzStage.bot.innerHTML = '';
  pzPanel();
}
function pzPanel(){
  const p = PZ.p; $('pzRating').textContent = Math.round(S.pz);
  const turn = `<div class="turn"><i class="${PZ.solver}"></i>${PZ.solver==='w' ? 'Brancas' : 'Pretas'} jogam</div>`;
  const ctx = p.mine ? `<p class="muted" style="margin:0;font-size:14px">Da sua partida contra <b style="color:#fff">${esc(p.mine.opp||'')}</b>. Você jogou ${ptSan(p.mine.played)}; encontre o melhor.</p>` : `<p class="muted" style="margin:0;font-size:14px">${PZ.done ? (p.themes.filter(t => THEMES[t]).map(t => THEMES[t].n).join(' · ') || 'Tática') : 'Encontre o melhor lance.'}</p>`;
  const fb = PZ.msg ? `<div class="fb ${PZ.msg.k}"><span class="ic">${PZ.msg.k==='ok' ? '✓' : PZ.msg.k==='bad' ? '✕' : 'i'}</span>${PZ.msg.t}</div>` : '';
  $('pzBody').innerHTML = turn + ctx + fb;
  $('pzFoot').innerHTML = PZ.done
    ? `<button class="btn go big" id="pzNext">Próximo exercício</button>${p.mine ? '<button class="btn sm" id="pzGame">Ver na partida</button>' : ''}`
    : `<div class="row"><button class="btn sm" id="pzHint"><svg><use href="#i-bulb"/></svg>Dica</button><button class="btn sm" id="pzSol"><svg><use href="#i-eye"/></svg>Solução</button><button class="btn sm ghost" id="pzSkip">Pular</button></div>`;
  const n = $('pzNext'); if (n) n.onclick = nextPuzzle;
  const gm = $('pzGame'); if (gm) gm.onclick = () => { const R = G.Rs[p.mine.rid]; if (R) startReview(R, {ply:p.mine.ply}); };
  const h = $('pzHint'); if (h) h.onclick = () => { if (!PZ.failed){ PZ.failed = true; pzRate(0); } const u = p.moves[PZ.step]; pzStage.board.update({hint: u ? u.slice(0,2) : null}); };
  const so = $('pzSol'); if (so) so.onclick = pzSolution;
  const sk = $('pzSkip'); if (sk) sk.onclick = nextPuzzle;
}
function pzSolution(){
  if (!PZ.failed){ PZ.failed = true; pzRate(0); }
  PZ.done = true; const p = PZ.p;
  const stepPlay = () => {
    if (PZ.p!==p || PZ.step >= p.moves.length){ PZ.msg = {k:'info', t:'Esta era a solução.'}; pzPanel(); return; }
    const m = pzApply(p.moves[PZ.step]); PZ.step++; snd(soundOf(m, PZ.g));
    pzStage.board.set({fen:PZ.g.fen(), orient:PZ.solver, last:[m.from,m.to]}, {from:m.from, to:m.to});
    setTimeout(stepPlay, 650);
  };
  pzPanel(); stepPlay();
}
$('pzBack').addEventListener('click', back);

/* =====================================================================
   Aprender
   ===================================================================== */
function lessonById(key){
  const [t, id] = key.split(':');
  if (t==='o') return {t, x: CONTENT.openings.find(o => o.id===id)};
  if (t==='c') return {t, x: CONTENT.concepts.find(o => o.id===id)};
  if (t==='m') return {t, x: CONTENT.mates.find(o => o.id===id)};
  return null;
}
function renderLearn(){
  const v = $('v-learn'); const pr = profile();
  const recs = [];
  if (pr){ pr.W.forEach(w => { if (w.learn) recs.push(w.learn); }); }
  const ops = openingStats(); const badW = ops.find(o => o.color==='w' && o.n>=2 && o.L/o.n>=0.5), badB = ops.find(o => o.color==='b' && o.n>=2 && o.L/o.n>=0.5);
  if (badW) recs.push('o:italiana'); if (badB) recs.push('o:carokann');
  const recU = Array.from(new Set(recs)).slice(0, 3);
  const finalFen = o => { const g = new Chess(); o.line.forEach(([s]) => g.move(s)); return g.fen(); };
  const ocard = o => `<button class="tcard" data-l="o:${o.id}">${mini(finalFen(o), o.side)}<b>${esc(o.name)}</b><small>${esc(o.sum)}</small>${S.learn['o:'+o.id] ? '<small style="color:var(--green)">✓ Praticada</small>' : ''}</button>`;
  const ccard = c => `<button class="tcard" data-l="c:${c.id}">${mini(c.fen, c.fen.split(' ')[1])}<b>${esc(c.name)}</b>${S.learn['c:'+c.id] ? '<small style="color:var(--green)">✓ Feita</small>' : ''}</button>`;
  const mcard = m => `<button class="tcard" data-l="m:${m.id}">${mini(m.fen, 'w')}<b>${esc(m.name)}</b>${S.learn['m:'+m.id] ? '<small style="color:var(--green)">✓ Concluído</small>' : '<small>Contra o computador</small>'}</button>`;
  const anyCard = key => { const l = lessonById(key); if (!l || !l.x) return ''; return l.t==='o' ? ocard(l.x) : l.t==='c' ? ccard(l.x) : mcard(l.x); };
  const groups = {};
  CONTENT.openings.forEach(o => (groups[o.group] = groups[o.group] || []).push(o));
  v.innerHTML = `<div class="page-h"><h1>Aprender</h1></div>
    ${recU.length ? `<div class="sec-h">Recomendado para você</div><div class="cards">${recU.map(anyCard).join('')}</div>` : ''}
    ${Object.keys(groups).map(gk => `<div class="sec-h">Aberturas · ${esc(gk)}</div><div class="cards">${groups[gk].map(ocard).join('')}</div>`).join('')}
    <div class="sec-h">Estratégia</div><div class="cards">${CONTENT.concepts.map(ccard).join('')}</div>
    <div class="sec-h">Xeque-mate</div><div class="cards">${CONTENT.mates.map(mcard).join('')}</div>`;
}
$('v-learn').addEventListener('click', e => { const b = e.target.closest('[data-l]'); if (b) openLearn(b.dataset.l); });
let LS = null, lsStage = null;
function openLearn(key){
  const l = lessonById(key); if (!l || !l.x) return;
  if (!lsStage) lsStage = makeStage('lsBoardCol', false);
  LS = {key, t:l.t, x:l.x};
  show('v-lesson', true);
  $('lsTitle').textContent = l.x.name;
  if (l.t==='o') openingLesson('watch');
  else if (l.t==='c') conceptLesson();
  else mateLesson();
}
$('lsBack').addEventListener('click', back);
/* --- aberturas --- */
function openingLesson(mode){
  const o = LS.x; LS.mode = mode; LS.k = 0; LS.err = 0; LS.g = new Chess(); LS.done = false;
  if (mode==='practice' && o.side==='b') setTimeout(() => lsAuto(), 450);
  lsOpRender();
}
function lsOpRender(anim){
  const o = LS.x, k = LS.k, g = new Chess(); let last = null;
  for (let i=0;i<k;i++){ const m = g.move(o.line[i][0]); last = [m.from, m.to]; }
  const next = k < o.line.length ? new Chess(g.fen()).move(o.line[k][0]) : null;
  const myTurn = LS.mode==='practice' && !LS.done && next && ((k%2===0) === (o.side==='w'));
  const arrows = [];
  if (LS.mode==='watch' && next) arrows.push({from:next.from, to:next.to, color:'#81b64c', op:.75});
  if (LS.mode==='practice' && myTurn && LS.err >= 2) arrows.push({from:next.from, to:next.to, color:'#4fa3e0', op:.8});
  lsStage.board.set({fen:g.fen(), orient:o.side, last, arrows, movable: myTurn ? o.side : null, onMove: lsOpMove}, anim);
  const stepDots = `<div class="steps">${o.line.map((_,i) => `<i class="${i<k ? 'on' : i===k ? 'cur' : ''}"></i>`).join('')}</div>`;
  const seg = `<div class="seg"><button aria-pressed="${LS.mode==='watch'}" data-mode="watch">Assistir</button><button aria-pressed="${LS.mode==='practice'}" data-mode="practice">Praticar</button></div>`;
  let body;
  if (LS.mode==='watch'){
    const prev = k>0 ? o.line[k-1] : null;
    const say = !prev ? o.sum : (prev[1] || 'Resposta mais comum do adversário.');
    body = seg + `<div class="lesson-text">${prev ? `<b>${Math.floor((k-1)/2)+1}${(k-1)%2===0 ? '.' : '...'}${ptSan(prev[0])}</b> ` : ''}${esc(say)}</div>${stepDots}`;
    $('lsFoot').innerHTML = `<div class="ctrls"><button class="btn" data-ls="first"><svg><use href="#i-first"/></svg></button><button class="btn" data-ls="prev"><svg><use href="#i-prev"/></svg></button><button class="btn go" data-ls="next"><svg><use href="#i-next"/></svg></button><button class="btn" data-ls="last"><svg><use href="#i-last"/></svg></button></div>`;
  } else {
    let fb = '';
    if (LS.done) fb = `<div class="fb ok"><span class="ic">✓</span>Linha completa!</div>`;
    else if (LS.msg) fb = `<div class="fb ${LS.msg.k}"><span class="ic">${LS.msg.k==='ok'?'✓':'✕'}</span>${LS.msg.t}</div>`;
    body = seg + `<div class="lesson-text">${LS.done ? 'Agora repita algumas vezes até sair sem pensar.' : myTurn ? 'Sua vez: jogue o lance da linha.' : 'Aguarde o lance do adversário…'}</div>${fb}${stepDots}`;
    $('lsFoot').innerHTML = `<div class="row"><button class="btn sm" data-ls="restart"><svg><use href="#i-retry"/></svg>Recomeçar</button>${!LS.done && myTurn ? '<button class="btn sm" data-ls="hint"><svg><use href="#i-bulb"/></svg>Dica</button>' : ''}</div>`;
  }
  $('lsBody').innerHTML = body;
}
function lsAuto(){
  const o = LS.x; if (LS.t!=='o' || LS.mode!=='practice' || LS.k >= o.line.length) return;
  const myTurn = (LS.k%2===0) === (o.side==='w'); if (myTurn) return;
  const g = new Chess(); for (let i=0;i<LS.k;i++) g.move(o.line[i][0]);
  const m = g.move(o.line[LS.k][0]); LS.k++; snd(soundOf(m, g)); LS.msg = null;
  if (LS.k >= o.line.length){ LS.done = true; S.learn[LS.key] = 1; save(); }
  lsOpRender({from:m.from, to:m.to});
}
function lsOpMove(from, to, promo){
  const o = LS.x; const g = new Chess(); for (let i=0;i<LS.k;i++) g.move(o.line[i][0]);
  const exp = new Chess(g.fen()).move(o.line[LS.k][0]);
  if (exp && exp.from===from && exp.to===to){
    LS.k++; LS.err = 0; LS.msg = {k:'ok', t: o.line[LS.k-1][1] || 'Isso!'}; snd('move');
    if (LS.k >= o.line.length){ LS.done = true; S.learn[LS.key] = 1; save(); snd('ok'); }
    lsOpRender({from, to});
    if (!LS.done) setTimeout(lsAuto, 500);
    return;
  }
  LS.err++; snd('bad'); LS.msg = {k:'bad', t: LS.err >= 2 ? `Na linha, o lance é ${ptSan(exp.san)}.` : 'Não é o lance da linha. Tente de novo.'};
  lsStage.board.flash(to, 'bad');
  lsOpRender(); return false;
}
$('lsBody').addEventListener('click', e => { const b = e.target.closest('[data-mode]'); if (b && LS && LS.t==='o') openingLesson(b.dataset.mode); });
$('lsFoot').addEventListener('click', e => {
  const b = e.target.closest('[data-ls]'); if (!b || !LS) return;
  const a = b.dataset.ls;
  if (LS.t==='o'){
    if (a==='restart'){ openingLesson('practice'); return; }
    if (a==='hint'){ LS.err = Math.max(LS.err, 2); lsOpRender(); return; }
    const n = LS.x.line.length;
    LS.k = a==='first' ? 0 : a==='prev' ? Math.max(0, LS.k-1) : a==='next' ? Math.min(n, LS.k+1) : n;
    if (a==='next' && LS.k===n) { S.learn[LS.key] = S.learn[LS.key] || 1; save(); }
    lsOpRender(); return;
  }
  if (LS.t==='c'){ if (a==='hint') conceptHint(); else if (a==='again') conceptLesson(); return; }
  if (LS.t==='m'){ if (a==='hint') mateHint(); else if (a==='again') mateLesson(); }
});
/* --- estratégia --- */
function conceptLesson(){
  const c = LS.x; LS.done = false; LS.msg = null; LS.tries = 0;
  const side = c.fen.split(' ')[1];
  lsStage.board.set({fen:c.fen, orient:side, movable:side, onMove:conceptMove});
  conceptPanel();
}
function conceptPanel(){
  const c = LS.x; const side = c.fen.split(' ')[1];
  const fb = LS.msg ? `<div class="fb ${LS.msg.k}"><span class="ic">${LS.msg.k==='ok'?'✓':LS.msg.k==='bad'?'✕':'i'}</span>${LS.msg.t}</div>` : '';
  $('lsBody').innerHTML = `<div class="lesson-text">${esc(c.text)}</div><div class="turn"><i class="${side}"></i>${LS.done ? 'Ideia aplicada' : 'Encontre o lance que mostra a ideia'}</div>${fb}`;
  $('lsFoot').innerHTML = `<div class="row">${LS.done ? '<button class="btn sm" data-ls="again"><svg><use href="#i-retry"/></svg>De novo</button>' : '<button class="btn sm" data-ls="hint"><svg><use href="#i-bulb"/></svg>Dica</button>'}</div>`;
}
async function conceptMove(from, to, promo){
  const c = LS.x; const g = new Chess(c.fen); const m = g.move({from, to, promotion:promo}); if (!m) return false;
  const u = uciOf(m); const okList = [c.move].concat(c.alt || []);
  if (okList.indexOf(u)>=0){
    LS.done = true; S.learn[LS.key] = 1; save(); snd('ok');
    LS.msg = {k:'ok', t:`${ptSan(m.san)}: é exatamente essa a ideia.`};
    lsStage.board.set({fen:g.fen(), orient:c.fen.split(' ')[1], last:[m.from,m.to], badge:{sq:m.to, s:'✓', c:'--c-melhor'}}, {from:m.from, to:m.to});
    conceptPanel(); return;
  }
  lsStage.board.set({fen:g.fen(), orient:c.fen.split(' ')[1], last:[m.from,m.to]}, {from:m.from, to:m.to});
  LS.msg = {k:'info', t:'Conferindo seu lance…'}; conceptPanel();
  const [a, b] = await Promise.all([analysePos(c.fen, {movetime:500, multipv:1, jsDepth:2}, 2), analysePos(g.fen(), {movetime:500, multipv:1, jsDepth:2}, 2)]);
  if (!LS || LS.x!==c) return;
  const best = winPct(a.score), mine = 100 - winPct(b.score);
  LS.tries++;
  if (best - mine < 3) LS.msg = {k:'info', t:`${ptSan(m.san)} também é bom, mas a ideia desta lição é outra. Tente de novo.`};
  else LS.msg = {k:'bad', t:`${ptSan(m.san)} não aproveita a ideia. Tente de novo.`};
  snd('bad');
  setTimeout(() => { if (LS && LS.x===c && !LS.done) lsStage.board.set({fen:c.fen, orient:c.fen.split(' ')[1], movable:c.fen.split(' ')[1], onMove:conceptMove}); }, 600);
  conceptPanel();
}
function conceptHint(){ const c = LS.x; lsStage.board.update({arrows:[{from:c.move.slice(0,2), to:c.move.slice(2,4), color:'#4fa3e0', op:.8}]}); }
/* --- mates contra o computador --- */
function mateLesson(){
  const m = LS.x; LS.g = new Chess(m.fen); LS.n = 0; LS.done = false; LS.msg = null; LS.busy = false;
  lsStage.board.set({fen:m.fen, orient:'w', movable:'w', onMove:mateMove});
  matePanel();
}
function matePanel(){
  const m = LS.x;
  const fb = LS.msg ? `<div class="fb ${LS.msg.k}"><span class="ic">${LS.msg.k==='ok'?'✓':LS.msg.k==='bad'?'✕':'i'}</span>${LS.msg.t}</div>` : '';
  $('lsBody').innerHTML = `<div class="lesson-text">${esc(m.text)}</div><div class="turn"><i class="w"></i>Dê mate em até ${m.limit} lances</div><div class="pstat"><span><b>${LS.n}</b> <small>de ${m.limit} lances</small></span></div>${fb}`;
  $('lsFoot').innerHTML = `<div class="row"><button class="btn sm" data-ls="again"><svg><use href="#i-retry"/></svg>Recomeçar</button>${LS.done ? '' : '<button class="btn sm" data-ls="hint"><svg><use href="#i-bulb"/></svg>Dica</button>'}</div>`;
}
async function mateMove(from, to, promo){
  if (LS.busy || LS.done) return false;
  const mv = LS.g.move({from, to, promotion:promo}); if (!mv) return false;
  LS.n++; snd(soundOf(mv, LS.g)); LS.msg = null;
  lsStage.board.set({fen:LS.g.fen(), orient:'w', last:[mv.from, mv.to]}, {from:mv.from, to:mv.to});
  if (LS.g.in_checkmate()){ LS.done = true; S.learn[LS.key] = 1; save(); snd('ok'); LS.msg = {k:'ok', t:`Xeque-mate em ${LS.n} lances!`}; matePanel(); return; }
  if (LS.g.in_stalemate()){ LS.done = true; LS.msg = {k:'bad', t:'Afogamento: o rei preto ficou sem lances e não estava em xeque. É empate. Tente de novo.'}; matePanel(); return; }
  if (LS.g.in_draw() || LS.g.insufficient_material()){ LS.done = true; LS.msg = {k:'bad', t:'Virou empate. Tente de novo.'}; matePanel(); return; }
  if (LS.n >= LS.x.limit){ LS.done = true; LS.msg = {k:'bad', t:'Passou do limite de lances. Tente de novo.'}; matePanel(); return; }
  matePanel(); LS.busy = true;
  const g0 = LS.g; const r = await analysePos(LS.g.fen(), {movetime:300, multipv:1, jsDepth:2}, 2);
  if (!LS || LS.g!==g0) return;
  const u = r.lines[0] ? r.lines[0].pv[0] : null; const legal = LS.g.moves({verbose:true});
  const rm = u ? LS.g.move({from:u.slice(0,2), to:u.slice(2,4), promotion:u[4]||undefined}) : LS.g.move(legal[0]);
  LS.busy = false;
  lsStage.board.set({fen:LS.g.fen(), orient:'w', last:[rm.from, rm.to], movable:'w', onMove:mateMove}, {from:rm.from, to:rm.to});
}
async function mateHint(){
  if (LS.busy || LS.done) return;
  const g0 = LS.g; const r = await analysePos(LS.g.fen(), {movetime:700, multipv:1, jsDepth:3}, 2);
  if (!LS || LS.g!==g0 || !r.lines[0]) return;
  const u = r.lines[0].pv[0]; lsStage.board.update({arrows:[{from:u.slice(0,2), to:u.slice(2,4), color:'#4fa3e0', op:.8}]});
}

/* =====================================================================
   Jogar contra o computador
   ===================================================================== */
let PL = null, plStage = null, plTick = 0;
function renderPlay(){
  if (!plStage) plStage = makeStage('plBoardCol', false);
  if (!PL || PL.over) return playSetup();
  playRender();
}
function playSetup(){
  const bot = clampElo(S.elo + S.off);
  plStage.board.set({fen:START, orient: S.color==='b' ? 'b' : 'w'});
  plStage.top.innerHTML = playerHTML({name:'Computador', rating:bot, color: S.color==='b' ? 'w' : 'b', avatar:'n'});
  plStage.bot.innerHTML = playerHTML({name:S.user || 'Você', rating:S.elo, color: S.color==='b' ? 'b' : 'w'});
  const segb = (name, opts, val) => `<div class="seg" data-opt="${name}">${opts.map(([v,l]) => `<button aria-pressed="${String(v)===String(val)}" data-v="${v}">${l}</button>`).join('')}</div>`;
  $('plBody').innerHTML = `<div class="setup">
    <div class="opt-row"><span>Seu Elo</span><div class="row"><input class="input" id="plElo" type="number" min="100" max="3000" step="25" value="${S.elo}" style="max-width:120px"><span class="muted" style="font-size:13px">${bestRating() ? 'Puxado do chess.com' : ''}</span></div></div>
    <div class="opt-row"><span>Adversário</span>${segb('off', [[-200,'Mais fácil'],[0,'Mesmo nível'],[200,'Desafio']], S.off)}</div>
    <div class="opt-row"><span>Cor</span>${segb('color', [['w','Brancas'],['r','Sorteio'],['b','Pretas']], S.color)}</div>
    <div class="opt-row"><span>Ritmo</span>${segb('tc', [['0','Livre'],['600+0','10 min'],['300+3','5+3'],['180+2','3+2']], S.tc)}</div>
    <p class="muted" style="margin:0;font-size:13.5px">Computador com Elo ~${bot}. No fim, a partida vai direto para a revisão.</p></div>`;
  $('plFoot').innerHTML = `<button class="btn go big" id="plStart">Jogar</button>`;
  $('plStart').onclick = playStart;
  $('plElo').onchange = () => { const e = parseInt($('plElo').value, 10); if (!isNaN(e)){ S.elo = clampElo(e); save(); playSetup(); } };
}
$('plBody').addEventListener('click', e => {
  const b = e.target.closest('.seg[data-opt] button'); if (!b) return;
  const k = b.closest('[data-opt]').dataset.opt; const v = b.dataset.v;
  S[k] = k==='off' ? +v : v; save(); playSetup();
});
function playStart(){
  let c = S.color; if (c==='r') c = Math.random()<0.5 ? 'w' : 'b';
  const tc = S.tc && S.tc!=='0' ? S.tc.split('+').map(Number) : null;
  PL = {g:new Chess(), me:c, bot:clampElo(S.elo + S.off), over:false, busy:false, clock: tc ? {w:tc[0], b:tc[0], inc:tc[1]||0, run:null, t:0} : null, hint:null, id:Date.now()};
  playRender();
  clearInterval(plTick); plTick = setInterval(playClock, 200);
  if (c==='b') playBot();
}
function playLeave(){ /* a partida continua guardada; o relógio só anda com a aba aberta */ if (PL && PL.clock && PL.clock.run){ playClockCommit(); PL.clock.run = null; PL.paused = true; } }
function playClockCommit(){ const c = PL.clock; if (!c || !c.run) return; const now = performance.now(); c[c.run] -= (now - c.t)/1000; c.t = now; }
function playClock(){
  if (!PL || PL.over || !PL.clock || cur!=='v-play') return;
  if (PL.paused){ PL.paused = false; if (PL.g.history().length) { PL.clock.run = PL.g.turn(); PL.clock.t = performance.now(); } }
  const c = PL.clock; if (!c.run) return;
  const left = c[c.run] - (performance.now() - c.t)/1000;
  const el = (c.run===PL.me ? plStage.bot : plStage.top).querySelector('.clk'); if (el){ el.textContent = fmtClk(left); el.classList.toggle('low', left < 30); }
  if (left <= 0){ c[c.run] = 0; c.run = null; playEnd(PL.g.turn()===PL.me ? 'L' : 'W', 'tempo'); }
}
function playRender(anim){
  const g = PL.g, me = PL.me, op = me==='w' ? 'b' : 'w';
  const hist = g.history({verbose:true}); const l = hist[hist.length-1];
  const capt = capturedBy(g.fen()); const c = PL.clock;
  const clk = col => c ? fmtClk(c.run===col ? c[col] - (performance.now()-c.t)/1000 : c[col]) : null;
  plStage.top.innerHTML = playerHTML({name:'Computador', rating:PL.bot, color:op, caps:capt[op], diff: op==='w' ? capt.diff : -capt.diff, clock:clk(op), clockOn: c && c.run===op, avatar:'n'});
  plStage.bot.innerHTML = playerHTML({name:S.user || 'Você', rating:S.elo, color:me, caps:capt[me], diff: me==='w' ? capt.diff : -capt.diff, clock:clk(me), clockOn: c && c.run===me});
  plStage.board.set({fen:g.fen(), orient:me, last: l ? [l.from, l.to] : null, movable: !PL.over && !PL.busy && g.turn()===me ? me : null, onMove: playMove, arrows: PL.hint ? [{from:PL.hint.slice(0,2), to:PL.hint.slice(2,4), color:'#4fa3e0', op:.75}] : []}, anim);
  const op_ = openingInfo(g.history()).name;
  const sans = g.history(); let strip = '<div class="mstrip" style="flex-wrap:wrap">';
  for (let i=0;i<sans.length;i+=2) strip += `<span class="num">${i/2+1}.</span><button class="${i===sans.length-1?'cur':''}">${ptSan(sans[i])}</button>${sans[i+1] ? `<button class="${i+1===sans.length-1?'cur':''}">${ptSan(sans[i+1])}</button>` : ''}`;
  strip += '</div>';
  const status = PL.busy ? 'O computador está pensando…' : g.in_check() ? 'Xeque!' : 'Sua vez';
  $('plBody').innerHTML = `<div class="turn"><i class="${g.turn()}"></i>${status}</div>${op_ ? `<p class="muted" style="margin:0;font-size:13.5px">${esc(op_)}</p>` : ''}${sans.length ? strip : '<p class="muted" style="margin:0">Toque numa peça e depois na casa, ou arraste.</p>'}`;
  const canUndo = hist.some(m => m.color===me);
  $('plFoot').innerHTML = `<div class="row"><button class="btn sm" id="plHint" ${PL.busy?'disabled':''}><svg><use href="#i-bulb"/></svg>Dica</button><button class="btn sm" id="plUndo" ${PL.busy||!canUndo?'disabled':''}><svg><use href="#i-retry"/></svg>Voltar</button><button class="btn sm" id="plResign" ${PL.busy||hist.length<2?'disabled':''}>${PL.armed ? 'Confirmar desistência' : 'Desistir'}</button></div>`;
  $('plHint').onclick = playHint; $('plUndo').onclick = playUndo; $('plResign').onclick = playResign;
}
function playMove(from, to, promo){
  if (!PL || PL.over || PL.busy) return false;
  const m = PL.g.move({from, to, promotion:promo}); if (!m) return false;
  playAfter(m);
}
function playAfter(m){
  PL.hint = null; PL.armed = false;
  const c = PL.clock;
  if (c){ const now = performance.now(); if (c.run){ c[m.color] -= (now - c.t)/1000; c[m.color] += c.inc; } c.run = PL.g.turn(); c.t = now; }
  snd(soundOf(m, PL.g));
  if (PL.g.game_over()){
    playRender({from:m.from, to:m.to});
    if (PL.g.in_checkmate()) playEnd(m.color===PL.me ? 'W' : 'L', 'xeque-mate');
    else playEnd('D', PL.g.in_stalemate() ? 'afogamento' : PL.g.in_threefold_repetition() ? 'repetição' : 'empate');
    return;
  }
  playRender({from:m.from, to:m.to});
  if (PL.g.turn()!==PL.me) playBot();
}
function botParams(elo){
  if (elo < 500) return {depth:1, mpv:5, temp:28, blunder:0.16};
  if (elo < 800) return {depth:1, mpv:5, temp:16, blunder:0.08};
  if (elo < 1100) return {depth:2, mpv:4, temp:9, blunder:0.04};
  if (elo < 1350) return {depth:4, mpv:4, temp:5.5, blunder:0.02};
  if (elo < 1700) return {depth:6, mpv:3, temp:3.2, blunder:0.008};
  if (elo < 2000) return {depth:8, mpv:3, temp:1.8, blunder:0};
  if (elo < 2300) return {depth:11, mpv:2, temp:0.9, blunder:0};
  return {movetime:1200, mpv:1, temp:0.1, blunder:0};
}
async function playBot(){
  if (!PL || PL.over) return;
  PL.busy = true; playRender();
  const id = PL.id, fen = PL.g.fen(), t0 = performance.now();
  const p = botParams(PL.bot); const legal = PL.g.moves({verbose:true});
  let u = null;
  if (Math.random() < p.blunder) u = uciOf(legal[Math.floor(Math.random()*legal.length)]);
  else {
    const o = {multipv:p.mpv, jsDepth: PL.bot < 900 ? 1 : 2, jsMs: 600}; if (p.depth) o.depth = p.depth; else o.movetime = p.movetime;
    if (PL.clock && PL.clock[PL.g.turn()] < 15 && o.depth) o.depth = Math.min(o.depth, 4);
    const r = await SF.run(fen, o, 2);
    const lines = r.lines || [];
    if (lines.length){
      const ws = lines.map(l => winPct(l.score)); const top = Math.max.apply(null, ws);
      const wt = ws.map(w => Math.exp(-(top - w)/Math.max(0.05, p.temp)));
      let x = Math.random()*wt.reduce((a,b)=>a+b,0), i = 0; for (; i<wt.length-1; i++){ x -= wt[i]; if (x<=0) break; }
      u = lines[i].pv[0];
    } else u = uciOf(legal[0]);
  }
  const low = PL.clock && PL.clock[PL.g.turn()] < 30;
  const wait = Math.max(0, (low ? 100 : 350 + Math.random()*600) - (performance.now() - t0));
  setTimeout(() => {
    if (!PL || PL.id!==id || PL.over || PL.g.fen()!==fen) return;
    PL.busy = false;
    const m = PL.g.move({from:u.slice(0,2), to:u.slice(2,4), promotion:u[4]||'q'}) || PL.g.move(legal[0]);
    playAfter(m);
  }, wait);
}
async function playHint(){
  if (!PL || PL.busy || PL.over) return;
  const fen = PL.g.fen(); const r = await analysePos(fen, {movetime:600, multipv:1, jsDepth:3}, 2);
  if (!PL || PL.g.fen()!==fen || !r.lines[0]) return;
  PL.hint = r.lines[0].pv[0]; playRender();
}
function playUndo(){
  if (!PL || PL.busy || PL.over) return;
  if (PL.g.turn()===PL.me) PL.g.undo();
  PL.g.undo(); PL.hint = null;
  if (PL.clock){ PL.clock.run = PL.g.history().length ? PL.g.turn() : null; PL.clock.t = performance.now(); }
  playRender();
}
function playResign(){
  if (!PL || PL.busy || PL.over) return;
  if (!PL.armed){ PL.armed = true; playRender(); setTimeout(() => { if (PL && PL.armed){ PL.armed = false; playRender(); } }, 3500); return; }
  playEnd('L', 'desistência');
}
function playEnd(res, why){
  if (!PL || PL.over) return;
  PL.over = true; clearInterval(plTick); snd('end');
  const moves = PL.g.history({verbose:true});
  toast(res==='W' ? 'Você venceu!' : res==='L' ? 'Você perdeu.' : 'Empate.');
  if (!moves.length){ renderPlay(); return; }
  const o = PL.me==='w' ? 'b' : 'w';
  analyzeAndReview({startFen:START, moves, userColor:PL.me, names:{[PL.me]:{name:S.user||'Você', rating:S.elo}, [o]:{name:'Computador', rating:PL.bot}}, res, why, source:'play'});
}

/* =====================================================================
   Início
   ===================================================================== */
try { const qu = new URLSearchParams(location.search).get('u'); if (qu && /^[\w-]{2,40}$/.test(qu)){ if (qu.toLowerCase() !== (S.user||'').toLowerCase()){ resetUserData(); S.user = qu; save(); } } } catch(e){}
renderMe();
if (!S.user) showOnboard();
show('v-games');
if (S.user && (Date.now() - G.at > 5*60*1000 || !G.list.length)) fetchGames();
if ('serviceWorker' in navigator && location.protocol==='https:') navigator.serviceWorker.register('sw.js').catch(() => {});
$('engineInfo').textContent = 'Carregando o Stockfish…';
SF.init().then(kind => {
  $('engineInfo').textContent = kind==='sf18' ? 'Motor: Stockfish 18 rodando no seu aparelho.' : kind==='sf10' ? 'Motor: Stockfish 10 rodando no seu aparelho.' : 'O Stockfish não carregou neste aparelho; usando um motor reserva mais fraco.';
  bgRun();
});
window.addEventListener('resize', () => { if (cur==='v-review' && RV && RV.mode==='moves') renderReview(); });
// gancho de diagnóstico (usado só em testes)
window.__lal = {PZ: () => PZ, LS: () => LS, RV: () => RV, PL: () => PL, cur: () => cur, sf: () => SF.kind};
})();
