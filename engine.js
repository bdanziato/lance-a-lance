/* Motor de análise: Stockfish 18 (WASM) -> Stockfish 10 (asm.js) -> motor reserva em JS */
'use strict';
const JS = (function(){
  const PV = {p:100,n:320,b:330,r:500,q:900,k:0};
  const PST = {
  p:[0,0,0,0,0,0,0,0,50,50,50,50,50,50,50,50,10,10,20,30,30,20,10,10,5,5,10,25,25,10,5,5,0,0,0,20,20,0,0,0,5,-5,-10,0,0,-10,-5,5,5,10,10,-20,-20,10,10,5,0,0,0,0,0,0,0,0],
  n:[-50,-40,-30,-30,-30,-30,-40,-50,-40,-20,0,0,0,0,-20,-40,-30,0,10,15,15,10,0,-30,-30,5,15,20,20,15,5,-30,-30,0,15,20,20,15,0,-30,-30,5,10,15,15,10,5,-30,-40,-20,0,5,5,0,-20,-40,-50,-40,-30,-30,-30,-30,-40,-50],
  b:[-20,-10,-10,-10,-10,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,10,10,5,0,-10,-10,5,5,10,10,5,5,-10,-10,0,10,10,10,10,0,-10,-10,10,10,10,10,10,10,-10,-10,5,0,0,0,0,5,-10,-20,-10,-10,-10,-10,-10,-10,-20],
  r:[0,0,0,0,0,0,0,0,5,10,10,10,10,10,10,5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,0,0,0,5,5,0,0,0],
  q:[-20,-10,-10,-5,-5,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,5,5,5,0,-10,-5,0,5,5,5,5,0,-5,0,0,5,5,5,5,0,-5,-10,5,5,5,5,5,0,-10,-10,0,5,0,0,0,0,-10,-20,-10,-10,-5,-5,-10,-10,-20],
  k:[-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-20,-30,-30,-40,-40,-30,-30,-20,-10,-20,-20,-20,-20,-20,-20,-10,20,20,0,0,0,0,20,20,20,30,10,0,0,10,30,20],
  ke:[-50,-40,-30,-20,-20,-30,-40,-50,-30,-20,-10,0,0,-10,-20,-30,-30,-10,20,30,30,20,-10,-30,-30,-10,30,40,40,30,-10,-30,-30,-10,30,40,40,30,-10,-30,-30,-10,20,30,30,20,-10,-30,-30,-30,0,0,0,0,-30,-30,-50,-30,-30,-30,-30,-30,-30,-50]};
  const MATE = 100000, INF = 1e9, TO = {};
  let deadline = Infinity, nodes = 0;
  function ev(g){ const bd = g.board(); let s=0, n=0, q=0;
    for (let r=0;r<8;r++) for (let c=0;c<8;c++){ const p=bd[r][c]; if(p&&p.type!=='p'&&p.type!=='k'){ n+=PV[p.type]; if(p.type==='q') q++; } }
    const eg = n<=1300 || q===0;
    for (let r=0;r<8;r++) for (let c=0;c<8;c++){ const p=bd[r][c]; if(!p) continue; const idx = p.color==='w'? r*8+c : (7-r)*8+c; const t = p.type==='k' ? (eg?PST.ke:PST.k) : PST[p.type]; const v = PV[p.type]+t[idx]; s += p.color==='w'? v : -v; }
    return g.turn()==='w' ? s : -s; }
  function ord(ms){ for (const m of ms) m._o = (m.captured ? 1000+10*PV[m.captured]-PV[m.piece] : 0) + (m.promotion?800:0) + (m.san.indexOf('+')>=0?60:0); ms.sort((a,b)=>b._o-a._o); return ms; }
  function qs(g,a,b,d){ if(((++nodes)&255)===0 && performance.now()>deadline) throw TO; const st = ev(g); if (st>=b) return st; if (st>a) a=st; if (d>=4) return st;
    for (const m of ord(g.moves({verbose:true}).filter(m=>m.captured||m.promotion))){ g.move(m); const s=-qs(g,-b,-a,d+1); g.undo(); if (s>=b) return s; if (s>a) a=s; } return a; }
  function se(g,depth,a,b,ply){ if(((++nodes)&255)===0 && performance.now()>deadline) throw TO; const ms = g.moves({verbose:true});
    if (!ms.length) return g.in_check() ? -(MATE-ply) : 0; if (depth<=0) return qs(g,a,b,0);
    let best=-INF; for (const m of ord(ms)){ g.move(m); const s=-se(g,depth-1,-b,-a,ply+1); g.undo(); if (s>best) best=s; if (s>a) a=s; if (a>=b) break; } return best; }
  function analyse(fen, depth, ms){
    const g0 = new Chess(fen); let moves = ord(g0.moves({verbose:true})); if (!moves.length) return [];
    let res = moves.map(m=>({m, s:0}));
    for (let d=1; d<=depth; d++){ deadline = d===1 ? Infinity : performance.now()+ms; const g = new Chess(fen);
      try { const cur=[]; for (const r of res){ g.move(r.m); const s=-se(g,d-1,-INF,INF,1); g.undo(); cur.push({m:r.m,s}); } cur.sort((a,b)=>b.s-a.s); res = cur; } catch(e){ if (e!==TO) throw e; break; } }
    deadline = Infinity;
    return res.map(r => ({score: Math.abs(r.s) > MATE-200 ? {mate: (r.s>0?1:-1)*Math.max(1, Math.ceil((MATE-Math.abs(r.s))/2))} : {cp:r.s}, pv:[uciOf(r.m)]}));
  }
  return {analyse};
})();
const SF = (function(){
  let w = null, ready = false, kind = 'js';
  const queue = []; let running = null;
  function boot(file, timeoutMs){
    return new Promise(res => {
      let done = false; const fin = ok => { if (!done){ done = true; clearTimeout(to); res(ok); } };
      let worker;
      try { worker = new Worker(file); } catch(e){ return res(false); }
      const to = setTimeout(() => { try { worker.terminate(); } catch(e){} fin(false); }, timeoutMs);
      worker.onmessage = e => {
        const line = typeof e.data === 'string' ? e.data : '';
        if (line === 'uciok') worker.postMessage('isready');
        else if (line === 'readyok' && !done){ w = worker; worker.onmessage = onLine; fin(true); }
      };
      worker.onerror = () => { try { worker.terminate(); } catch(e){} fin(false); };
      worker.postMessage('uci');
    });
  }
  let handler = null;
  function onLine(e){ const line = typeof e.data === 'string' ? e.data : ''; if (handler) handler(line); }
  async function init(){
    if (await boot('stockfish-18-lite-single.js', 25000)){ kind = 'sf18'; }
    else if (await boot('stockfish-10.js', 15000)){ kind = 'sf10'; }
    else kind = 'js';
    ready = true; pump();
    return kind;
  }
  function pump(){
    if (!ready || running || !queue.length) return;
    queue.sort((a,b) => b.prio - a.prio || a.seq - b.seq);
    running = queue.shift();
    const job = running;
    const finish = res => { running = null; job.resolve(res); pump(); };
    if (job.cancelled){ finish({lines:[], cancelled:true}); return; }
    if (kind === 'js'){
      setTimeout(() => {
        try { finish({lines: JS.analyse(job.fen, job.o.jsDepth || 2, job.o.jsMs || 400).slice(0, job.o.multipv || 1)}); }
        catch(err){ finish({lines:[]}); }
      }, 0);
      return;
    }
    const lines = {};
    handler = line => {
      if (line.indexOf('info') === 0 && line.indexOf(' pv ') > 0 && !/ (lower|upper)bound/.test(line)){
        const sc = line.match(/score (cp|mate) (-?\d+)/); if (!sc) return;
        const mp = +((line.match(/ multipv (\d+)/) || [])[1] || 1);
        let pvs = line.split(' pv ')[1].split(' bmc')[0];
        lines[mp] = {score: sc[1] === 'cp' ? {cp:+sc[2]} : {mate:+sc[2]}, pv: pvs.trim().split(/\s+/).filter(x => /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(x))};
      } else if (line.indexOf('bestmove') === 0){
        handler = null;
        finish({lines: Object.keys(lines).map(Number).sort((a,b)=>a-b).map(k => lines[k]).filter(l => l.pv.length), best: line.split(' ')[1]});
      }
    };
    w.postMessage('setoption name MultiPV value ' + (job.o.multipv || 1));
    w.postMessage('position fen ' + job.fen);
    w.postMessage(job.o.depth ? 'go depth ' + job.o.depth : 'go movetime ' + (job.o.movetime || 400));
  }
  let seq = 0;
  // prio: 2 = jogo/exercício na tela, 1 = revisão aberta, 0 = segundo plano
  function run(fen, o, prio){
    let job;
    const p = new Promise(resolve => { job = {fen, o:o||{}, prio:prio||0, seq:seq++, resolve}; queue.push(job); });
    p.cancel = () => { job.cancelled = true; };
    pump();
    return p;
  }
  function cancelBackground(){ queue.forEach(j => { if (j.prio === 0) j.cancelled = true; }); }
  return {init, run, cancelBackground, get kind(){ return kind; }, get ready(){ return ready; }};
})();
async function analysePos(fen, opts, prio){
  const g = new Chess(fen);
  if (g.in_checkmate()) return {lines:[], score:{mate:0}};
  if (g.in_stalemate() || g.insufficient_material()) return {lines:[], score:{cp:0}};
  const r = await SF.run(fen, opts, prio);
  return {lines:r.lines, score: r.lines[0] ? r.lines[0].score : {cp:0}, cancelled:r.cancelled};
}
