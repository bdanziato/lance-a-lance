/* Regras, táticas, aberturas e classificação de lances (compartilhado) */
'use strict';
/* ===== CORE-START ===== */
const FILES = 'abcdefgh';
const GLYPH = {k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'};
const PT = {K:'R',Q:'D',R:'T',N:'C'};
const ptSan = s => s.replace(/[KQRN]/g, c => PT[c]);
const VAL = {p:1,n:3,b:3,r:5,q:9,k:100};
const PNAME = {p:'peão',n:'cavalo',b:'bispo',r:'torre',q:'dama',k:'rei'};
const PART = {p:'o peão',n:'o cavalo',b:'o bispo',r:'a torre',q:'a dama',k:'o rei'};
const PUM = {p:'um peão',n:'um cavalo',b:'um bispo',r:'uma torre',q:'a dama',k:'o rei'};
const strip = s => s.replace(/[+#?!]/g,'');
const uciOf = m => m.from + m.to + (m.promotion || '');
function moveFromUci(fen, uci){
  if (!uci) return null;
  const g = new Chess(fen);
  return g.move({from:uci.slice(0,2), to:uci.slice(2,4), promotion: uci[4] || undefined}) || null;
}
function boardMap(g){ const m = {}; const bd = g.board(); for (let r=0;r<8;r++) for (let c=0;c<8;c++) if (bd[r][c]) m[FILES[c]+(8-r)] = bd[r][c]; return m; }
const sxy = s => [s.charCodeAt(0)-97, +s[1]-1];
const xys = (x,y) => (x<0||x>7||y<0||y>7) ? null : FILES[x]+(y+1);
const DIRS = {b:[[1,1],[1,-1],[-1,1],[-1,-1]], r:[[1,0],[-1,0],[0,1],[0,-1]]};
DIRS.q = DIRS.b.concat(DIRS.r);
function attacksFrom(map, sq){
  const p = map[sq]; if (!p) return [];
  const [x,y] = sxy(sq); const out = [];
  const add = (dx,dy) => { const s = xys(x+dx,y+dy); if (s) out.push(s); };
  if (p.type==='p'){ const d = p.color==='w'?1:-1; add(-1,d); add(1,d); }
  else if (p.type==='n'){ [[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]].forEach(([a,b])=>add(a,b)); }
  else if (p.type==='k'){ for (let a=-1;a<=1;a++) for (let b=-1;b<=1;b++) if (a||b) add(a,b); }
  else for (const [dx,dy] of DIRS[p.type]){ let cx=x+dx, cy=y+dy; while(true){ const s = xys(cx,cy); if(!s) break; out.push(s); if (map[s]) break; cx+=dx; cy+=dy; } }
  return out;
}
function attackersOf(map, sq, color){ return Object.keys(map).filter(s => map[s].color===color && attacksFrom(map, s).indexOf(sq)>=0); }
function kingSq(map, color){ return Object.keys(map).find(s => map[s].type==='k' && map[s].color===color); }
function matCount(map, color){ let s=0; for (const k in map) if (map[k].color===color && map[k].type!=='k') s += VAL[map[k].type]; return s; }
function npm(map){ let s=0, q=0; for (const k in map){ const t=map[k].type; if (t!=='p'&&t!=='k') s+=VAL[t]; if (t==='q') q++; } return {s,q}; }

const OPENINGS = [
 ['e4','Abertura do Peão do Rei'],['d4','Abertura do Peão da Dama'],['c4','Abertura Inglesa'],['Nf3','Abertura Réti'],['f4','Abertura Bird'],['b3','Abertura Larsen'],['g3','Abertura com fianqueto do rei'],
 ['e4 e5','Jogo Aberto'],['e4 e5 Nf3','Abertura do Cavalo do Rei'],['e4 e5 Nf3 Nc6','Abertura do Cavalo do Rei'],
 ['e4 e5 Nf3 Nc6 Bc4','Abertura Italiana'],['e4 e5 Nf3 Nc6 Bc4 Bc5','Abertura Italiana (Giuoco Piano)'],['e4 e5 Nf3 Nc6 Bc4 Bc5 c3','Giuoco Piano, linha principal'],['e4 e5 Nf3 Nc6 Bc4 Bc5 d3','Giuoco Pianissimo'],['e4 e5 Nf3 Nc6 Bc4 Nf6','Defesa dos Dois Cavalos'],['e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5','Dois Cavalos, Ataque Fegatello'],['e4 e5 Nf3 Nc6 Bc4 Nf6 d3','Dois Cavalos, linha moderna'],
 ['e4 e5 Nf3 Nc6 Bb5','Ruy López (Espanhola)'],['e4 e5 Nf3 Nc6 Bb5 a6','Ruy López, Variante Morphy'],['e4 e5 Nf3 Nc6 Bb5 Nf6','Ruy López, Defesa Berlinense'],['e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6','Ruy López, linha principal'],
 ['e4 e5 Nf3 Nc6 d4','Abertura Escocesa'],['e4 e5 Nf3 Nc6 d4 exd4 Nxd4','Abertura Escocesa'],['e4 e5 Nf3 Nc6 Nc3','Abertura dos Três Cavalos'],['e4 e5 Nf3 Nc6 Nc3 Nf6','Abertura dos Quatro Cavalos'],
 ['e4 e5 Nf3 Nf6','Defesa Petrov'],['e4 e5 Nf3 d6','Defesa Philidor'],['e4 e5 f4','Gambito do Rei'],['e4 e5 Nc3','Abertura Vienense'],['e4 e5 Bc4','Abertura do Bispo'],['e4 e5 Qh5','Ataque Parham (dama precoce)'],['e4 e5 d4','Gambito do Centro'],
 ['e4 c5','Defesa Siciliana'],['e4 c5 Nf3 d6','Defesa Siciliana com ...d6'],['e4 c5 Nf3 d6 d4 cxd4 Nxd4','Siciliana Aberta'],['e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6','Siciliana Najdorf'],['e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6','Siciliana Dragão'],['e4 c5 Nf3 Nc6','Defesa Siciliana com ...Cc6'],['e4 c5 Nf3 e6','Defesa Siciliana com ...e6'],['e4 c5 c3','Siciliana Alapin'],['e4 c5 Nc3','Siciliana Fechada'],
 ['e4 e6','Defesa Francesa'],['e4 e6 d4 d5','Defesa Francesa'],['e4 e6 d4 d5 e5','Francesa, Variante do Avanço'],['e4 e6 d4 d5 Nc3','Francesa, Variante Clássica'],['e4 e6 d4 d5 exd5','Francesa, Variante das Trocas'],
 ['e4 c6','Defesa Caro-Kann'],['e4 c6 d4 d5','Defesa Caro-Kann'],['e4 c6 d4 d5 e5','Caro-Kann, Variante do Avanço'],['e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5','Caro-Kann, Variante Clássica'],
 ['e4 d5','Defesa Escandinava'],['e4 d5 exd5 Qxd5','Escandinava com ...Dxd5'],['e4 d6','Defesa Pirc'],['e4 g6','Defesa Moderna'],['e4 Nf6','Defesa Alekhine'],['e4 Nc6','Defesa Nimzowitsch'],
 ['d4 d5','Jogo Fechado'],['d4 d5 c4','Gambito da Dama'],['d4 d5 c4 e6','Gambito da Dama Recusado'],['d4 d5 c4 dxc4','Gambito da Dama Aceito'],['d4 d5 c4 c6','Defesa Eslava'],['d4 d5 c4 e5','Contragambito Albin'],
 ['d4 d5 Bf4','Sistema Londres'],['d4 d5 Nf3 Nf6 Bf4','Sistema Londres'],['d4 Nf6 Bf4','Sistema Londres'],['d4 Nf6 Nf3 d5 Bf4','Sistema Londres'],['d4 Nf6 Bg5','Ataque Trompowsky'],
 ['d4 Nf6','Defesas Índias'],['d4 Nf6 c4 g6','Índia do Rei ou Grünfeld'],['d4 Nf6 c4 g6 Nc3 d5','Defesa Grünfeld'],['d4 Nf6 c4 g6 Nc3 Bg7','Defesa Índia do Rei'],
 ['d4 Nf6 c4 e6','Nimzo-Índia ou Índia da Dama'],['d4 Nf6 c4 e6 Nc3 Bb4','Defesa Nimzo-Índia'],['d4 Nf6 c4 e6 Nf3 b6','Defesa Índia da Dama'],['d4 Nf6 c4 c5','Defesa Benoni'],['d4 f5','Defesa Holandesa'],['c4 e5','Inglesa, Siciliana Invertida'],['c4 Nf6','Inglesa, Defesa Anglo-Índia']
].map(([s,n])=>[s.split(' '),n]);
const IDEAS = [
 ['Italiana','O bispo em c4 mira o ponto fraco f7. Plano típico: c3 e d4 para dominar o centro, roque rápido.'],
 ['Giuoco','O bispo em c4 mira o ponto fraco f7. Plano típico: c3 e d4 para dominar o centro, roque rápido.'],
 ['Dois Cavalos','Jogo agudo: as pretas contra-atacam e4. Cuidado com o ataque em f7 depois de Cg5.'],
 ['Ruy López','O bispo em b5 pressiona o cavalo que defende e5. Jogo posicional rico: roque, c3 e d4.'],
 ['Escocesa','As brancas abrem o centro cedo com d4 e ganham espaço e desenvolvimento rápido.'],
 ['Siciliana','As pretas trocam o peão c pelo peão d das brancas e buscam contrajogo na coluna c.'],
 ['Francesa','Estrutura sólida com e6 e d5. O bispo de c8 fica preso; as pretas atacam a cadeia de peões com c5 e f6.'],
 ['Caro-Kann','Como a Francesa, mas o bispo de c8 sai antes de e6. Defesa muito sólida.'],
 ['Escandinava','As pretas atacam e4 já no primeiro lance. Se a dama recapturar, cuidado para não perder tempos.'],
 ['Gambito da Dama','As brancas oferecem o peão c4 para tirar o peão d5 do centro.'],
 ['Eslava','As pretas defendem d5 com c6, mantendo o bispo de c8 livre.'],
 ['Londres','Sistema fácil de aprender: d4, Bf4, e3, Cf3, Bd3, c3. O mesmo esquema contra quase tudo.'],
 ['Índia do Rei','As pretas deixam o centro para as brancas e depois o atacam com e5 ou c5, buscando ataque no flanco do rei.'],
 ['Grünfeld','As pretas deixam as brancas montarem o centro para destruí-lo com c5 e o bispo em g7.'],
 ['Nimzo','O bispo em b4 prende o cavalo de c3 e luta pelo controle de e4.'],
 ['Parham','A dama sai cedo demais e vira alvo. Funciona contra iniciantes, mas perde tempo contra boa defesa.'],
 ['Gambito do Rei','Abertura romântica: sacrifica o peão f para abrir a coluna f e o centro.'],
 ['Petrov','Defesa simétrica e sólida: as pretas contra-atacam e4 em vez de defender e5.'],
 ['Philidor','Defesa compacta com d6. Sólida, porém um pouco passiva.'],
 ['Vienense','Cc3 antes de Cf3 prepara o avanço f4 com ataque.'],
 ['Inglesa','Controla d5 pelo flanco e costuma levar a jogo posicional com fianqueto.'],
 ['Réti','Desenvolvimento flexível: as brancas decidem a estrutura de peões depois.'],
 ['Pirc','As pretas deixam as brancas montarem o centro e o atacam depois com g6, Bg7 e e5 ou c5.'],
 ['Alekhine','O cavalo provoca os peões brancos a avançarem demais para depois atacá-los.'],
 ['Holandesa','O peão f5 controla e4 e prepara ataque no flanco do rei, mas enfraquece o roque.'],
 ['Benoni','As pretas aceitam menos espaço em troca de jogo dinâmico na ala da dama.'],
 ['Trompowsky','O bispo em g5 ameaça trocar o cavalo e estragar a estrutura de peões das pretas.']
];
function openingInfo(sans){
  const t = sans.map(strip); let name = null, len = 0;
  for (const [seq,n] of OPENINGS){
    if (seq.length > t.length || seq.length <= len) continue;
    let ok = true; for (let i=0;i<seq.length;i++) if (seq[i]!==t[i]) { ok=false; break; }
    if (ok){ name = n; len = seq.length; }
  }
  return {name, len};
}
function ideaFor(name){ if (!name) return ''; const f = IDEAS.find(([k])=>name.indexOf(k)>=0); return f ? f[1] : ''; }

const TAG = {
  mate:['Xeque-mate','o rei não tem como escapar do xeque'],
  mate_corredor:['Mate do corredor','mate na última fileira, com o rei preso pelos próprios peões'],
  mate_sufocado:['Mate sufocado','mate de cavalo com o rei cercado pelas próprias peças'],
  xeque_duplo:['Xeque duplo','duas peças dão xeque ao mesmo tempo; só o rei pode se mover'],
  xeque_descoberto:['Xeque descoberto','uma peça sai da frente e outra dá xeque'],
  ataque_descoberto:['Ataque descoberto','uma peça sai da frente e revela o ataque de outra'],
  garfo:['Garfo','uma peça ataca duas ou mais peças inimigas ao mesmo tempo'],
  cravada:['Cravada','a peça atacada não pode sair sem expor uma peça mais valiosa atrás dela'],
  cravada_abs:['Cravada absoluta','a peça atacada não pode se mover porque o rei está atrás dela'],
  espeto:['Espeto','ataca uma peça valiosa que, ao sair, expõe outra atrás dela'],
  peca_indefesa:['Peça indefesa','capturar uma peça que não estava protegida'],
  ganho_material:['Ganho de material','a captura vale mais do que a peça que pode ser perdida'],
  sacrificio:['Sacrifício','entregar material para conseguir uma vantagem maior'],
  promocao:['Promoção','o peão chega à última fileira e vira outra peça'],
  troca:['Troca','troca de peças de mesmo valor'],
  ameaca_mate:['Ameaça de mate','o lance ameaça dar xeque-mate no lance seguinte'],
  roque:['Roque','rei em segurança e torres conectadas'],
  desenvolvimento:['Desenvolvimento','colocar cavalos e bispos em jogo cedo'],
  centro:['Controle do centro','peões centrais dominam as casas mais importantes do tabuleiro'],
  coluna_aberta:['Coluna aberta','torres e damas ficam mais fortes em colunas sem peões'],
  coluna_semiaberta:['Coluna semiaberta','a torre pressiona uma coluna sem peões seus'],
  peao_passado:['Peão passado','peão sem peões inimigos à frente; ameaça promover'],
  fianqueto:['Fianqueto','bispo na grande diagonal, protegido pelos peões'],
  rei_ativo:['Rei ativo','no final, o rei vira uma peça de ataque'],
  dama_cedo:['Dama cedo demais','a dama exposta no início vira alvo e perde tempos'],
  cavalo_borda:['Cavalo na borda','"cavalo na borda, triste sorte": ali ele controla poucas casas'],
  enfraquece_roque:['Enfraquece o roque','mexer nos peões do roque abre caminho para ataques'],
  rei_exposto:['Rei exposto','o rei perde o direito ao roque e fica no meio do tabuleiro'],
  peca_pendurada:['Peça pendurada','deixar uma peça atacada sem defesa']
};
const FEM = ['cravada','cravada_abs','peca_indefesa','promocao','ameaca_mate','troca','peca_pendurada','coluna_aberta','coluna_semiaberta'];
const art = t => (FEM.indexOf(t)>=0 ? 'uma ' : 'um ') + '<b>' + TAG[t][0].toLowerCase() + '</b>';
const NEG = ['dama_cedo','cavalo_borda','enfraquece_roque','rei_exposto','peca_pendurada'];
const STRONG = ['mate','mate_corredor','mate_sufocado','xeque_duplo','xeque_descoberto','ataque_descoberto','garfo','cravada','cravada_abs','espeto','peca_indefesa','ganho_material','promocao','ameaca_mate'];
const LICHESS = {garfo:'fork',cravada:'pin',cravada_abs:'pin',espeto:'skewer',ataque_descoberto:'discoveredAttack',xeque_descoberto:'discoveredAttack',xeque_duplo:'doubleCheck',peca_indefesa:'hangingPiece',peca_pendurada:'hangingPiece',mate_corredor:'backRankMate',mate_sufocado:'smotheredMate',mate:'mateIn2',ameaca_mate:'mateIn2',promocao:'promotion',ganho_material:'hangingPiece'};

function tacticsOf(fen, m){
  const tags = [];
  if (!m) return tags;
  const g = new Chess(fen); const before = boardMap(g);
  const mv = g.move({from:m.from, to:m.to, promotion:m.promotion}); if (!mv) return tags;
  const after = boardMap(g); const me = mv.color, opp = me==='w'?'b':'w';
  const ksq = kingSq(after, opp);
  if (g.in_checkmate()){
    const [kx,ky] = sxy(ksq);
    if (mv.piece==='n'){ let boxed = true; for (let a=-1;a<=1;a++) for (let b=-1;b<=1;b++){ if(!a&&!b) continue; const s = xys(kx+a,ky+b); if (s && !(after[s] && after[s].color===opp)) boxed = false; } if (boxed) tags.push('mate_sufocado'); }
    if ((mv.piece==='r'||mv.piece==='q') && (ky===0||ky===7) && +mv.to[1]===ky+1) tags.push('mate_corredor');
    tags.push('mate'); return tags;
  }
  if (mv.promotion) tags.push('promocao');
  const checkers = ksq ? attackersOf(after, ksq, me) : [];
  if (checkers.length>=2) tags.push('xeque_duplo');
  else if (checkers.length===1 && checkers[0]!==mv.to) tags.push('xeque_descoberto');
  const hit = attacksFrom(after, mv.to).filter(s => after[s] && after[s].color===opp && after[s].type!=='p' &&
    (after[s].type==='k' || VAL[after[s].type] > VAL[mv.piece] || attackersOf(after, s, opp).length===0));
  if (hit.length>=2) tags.push('garfo');
  if ('bqr'.indexOf(mv.piece)>=0){
    const [x,y] = sxy(mv.to);
    for (const [dx,dy] of DIRS[mv.piece]){
      let cx=x+dx, cy=y+dy, first=null, second=null;
      while(true){ const s = xys(cx,cy); if(!s) break; if (after[s]){ if(!first) first = s; else { second = s; break; } } cx+=dx; cy+=dy; }
      if (!first || !second) continue;
      const A = after[first], B = after[second];
      if (A.color!==opp || B.color!==opp) continue;
      if (B.type==='k' && A.type!=='p') { tags.push('cravada_abs'); break; }
      if (B.type!=='k' && A.type!=='k' && VAL[B.type] > VAL[A.type] && VAL[B.type] >= 5 && A.type!=='p') { tags.push('cravada'); break; }
      if ((A.type==='k' || VAL[A.type] > VAL[B.type]) && B.type!=='p' && (attackersOf(after, second, opp).length===0 || VAL[B.type] >= VAL[mv.piece])) { tags.push('espeto'); break; }
    }
  }
  if (!checkers.length){
    for (const s in after){
      if (s===mv.to || after[s].color!==me || 'bqr'.indexOf(after[s].type)<0) continue;
      const nowHits = attacksFrom(after, s).filter(t => after[t] && after[t].color===opp && VAL[after[t].type]>=3 && (VAL[after[t].type] > VAL[after[s].type] || attackersOf(after, t, opp).length===0));
      const oldHits = before[s] ? attacksFrom(before, s) : [];
      if (nowHits.some(t => oldHits.indexOf(t)<0 && t!==mv.to)) { tags.push('ataque_descoberto'); break; }
    }
  }
  if (mv.captured){
    const defended = attackersOf(after, mv.to, opp).length>0;
    if (!defended && VAL[mv.captured]>=3) tags.push('peca_indefesa');
    else if (defended && VAL[mv.captured] > VAL[mv.piece] + 1) tags.push('ganho_material');
    else if (VAL[mv.captured]===VAL[mv.piece] && mv.captured!=='p') tags.push('troca');
  }
  if (!g.in_check() && STRONG.every(t => tags.indexOf(t)<0)){
    const fake = g.fen().split(' '); fake[1] = me; fake[3] = '-';
    const g2 = new Chess(fake.join(' '));
    if (g2.fen().split(' ')[1]===me && Object.keys(boardMap(g2)).length>2 && !g2.in_check()){
      const mates = g2.moves({verbose:true}).some(x => { g2.move(x); const ok = g2.in_checkmate(); g2.undo(); return ok; });
      if (mates) tags.push('ameaca_mate');
    }
  }
  return tags;
}
function strategyOf(fen, m, moverMoveNo){
  const tags = []; if (!m) return tags;
  const g = new Chess(fen); const before = boardMap(g);
  if (!g.move({from:m.from,to:m.to,promotion:m.promotion})) return tags;
  const after = boardMap(g); const me = m.color, opp = me==='w'?'b':'w';
  const {s:np, q} = npm(after); const endgame = np <= 20 || (q===0 && np <= 26);
  if (m.flags.indexOf('k')>=0 || m.flags.indexOf('q')>=0) tags.push('roque');
  const start = me==='w' ? ['b1','g1','c1','f1'] : ['b8','g8','c8','f8'];
  if ((m.piece==='n'||m.piece==='b') && start.indexOf(m.from)>=0 && moverMoveNo<=12) tags.push('desenvolvimento');
  if (m.piece==='p' && ['d4','e4','d5','e5'].indexOf(m.to)>=0 && moverMoveNo<=10) tags.push('centro');
  if (m.piece==='b' && ['g2','b2','g7','b7'].indexOf(m.to)>=0 && moverMoveNo<=12) tags.push('fianqueto');
  if (m.piece==='q' && moverMoveNo<=5 && !m.captured) tags.push('dama_cedo');
  if (m.piece==='n' && (m.to[0]==='a'||m.to[0]==='h') && !m.captured && !endgame) tags.push('cavalo_borda');
  if (m.piece==='r' || (m.piece==='q' && moverMoveNo>10)){
    const f = m.to[0]; let mine = 0, theirs = 0;
    for (let r=1;r<=8;r++){ const p = after[f+r]; if (p && p.type==='p'){ if (p.color===me) mine++; else theirs++; } }
    if (m.from[0]!==f){ if (!mine && !theirs) tags.push('coluna_aberta'); else if (!mine) tags.push('coluna_semiaberta'); }
  }
  if (m.piece==='p'){
    const [x,y] = sxy(m.to); const dir = me==='w'?1:-1; let passed = true;
    for (let dx=-1;dx<=1;dx++) for (let yy=y+dir; yy>=0 && yy<=7; yy+=dir){ const s = xys(x+dx,yy); if (s && after[s] && after[s].type==='p' && after[s].color===opp) passed = false; }
    const advanced = me==='w' ? y>=4 : y<=3;
    if (passed && (endgame || advanced)) tags.push('peao_passado');
    const k = kingSq(before, me);
    if (k && !endgame && ['f','g','h'].indexOf(m.from[0])>=0 && ['g','h'].indexOf(k[0])>=0 && Math.abs(+k[1] - +m.from[1])<=2) tags.push('enfraquece_roque');
    else if (k && !endgame && ['a','b','c'].indexOf(m.from[0])>=0 && ['b','c'].indexOf(k[0])>=0 && Math.abs(+k[1] - +m.from[1])<=2) tags.push('enfraquece_roque');
  }
  if (m.piece==='k' && m.flags.indexOf('k')<0 && m.flags.indexOf('q')<0){
    if (endgame){ const [x,y] = sxy(m.to), [fx,fy] = sxy(m.from); if (Math.abs(x-3.5)+Math.abs(y-3.5) < Math.abs(fx-3.5)+Math.abs(fy-3.5)) tags.push('rei_ativo'); }
    else if (moverMoveNo<=15 && (m.from==='e1'||m.from==='e8')) tags.push('rei_exposto');
  }
  return tags;
}
function hangingAfter(fen, m){
  const g = new Chess(fen); const mv = g.move({from:m.from,to:m.to,promotion:m.promotion}); if (!mv) return null;
  const map = boardMap(g); const me = mv.color, opp = me==='w'?'b':'w'; let worst = null;
  for (const s in map){
    const p = map[s]; if (p.color!==me || p.type==='k' || p.type==='p') continue;
    const att = attackersOf(map, s, opp); if (!att.length) continue;
    const def = attackersOf(map, s, me).length;
    const minAtt = Math.min.apply(null, att.map(a=>VAL[map[a].type]));
    if (!def || minAtt < VAL[p.type]) { if (!worst || VAL[p.type] > VAL[worst.t]) worst = {sq:s, t:p.type}; }
  }
  return worst;
}

const winPct = s => !s ? 50 : ('mate' in s) ? (s.mate>0 ? 100 : 0) : 50 + 50*(2/(1+Math.exp(-0.00368208*s.cp)) - 1);
const neg = s => ('mate' in s) ? {mate:-s.mate} : {cp:-s.cp};
const toWhite = (s, turn) => turn==='w' ? s : neg(s);
function fmtEval(s){
  if (!s) return '0.0';
  if ('mate' in s) return s.mate===0 ? '#' : (s.mate>0 ? 'M' : '−M') + Math.abs(s.mate);
  const v = s.cp/100; return (v>0?'+':v<0?'−':'') + Math.abs(v).toFixed(1);
}
const moveAcc = d => Math.max(0, Math.min(100, 103.1668*Math.exp(-0.04354*d) - 3.1669));
function accToElo(a){
  const P = [[0,100],[40,400],[55,700],[65,1000],[75,1350],[82,1650],[88,2000],[92,2300],[96,2700],[100,3000]];
  for (let i=1;i<P.length;i++) if (a<=P[i][0]){ const [x0,y0]=P[i-1],[x1,y1]=P[i]; return Math.round((y0+(a-x0)/(x1-x0)*(y1-y0))/25)*25; }
  return 3000;
}
const CLS = {
  brilhante:{n:'Brilhante',s:'!!',c:'--c-bril',a:'um lance brilhante'},
  otimo:{n:'Ótimo',s:'!',c:'--c-otimo',a:'um ótimo lance'},
  melhor:{n:'Melhor',s:'★',c:'--c-melhor',a:'o melhor lance'},
  excelente:{n:'Excelente',s:'✓✓',c:'--c-exc',a:'um lance excelente'},
  bom:{n:'Bom',s:'✓',c:'--c-bom',a:'um bom lance'},
  livro:{n:'Teórico',s:'T',c:'--c-livro',a:'um lance teórico'},
  forcado:{n:'Forçado',s:'→',c:'--c-forc',a:'o único lance possível'},
  imprecisao:{n:'Imprecisão',s:'?!',c:'--c-imp',a:'uma imprecisão'},
  erro:{n:'Erro',s:'?',c:'--c-erro',a:'um erro'},
  perdido:{n:'Chance perdida',s:'✕',c:'--c-perd',a:'uma chance perdida'},
  capivarada:{n:'Capivarada',s:'??',c:'--c-cap',a:'uma capivarada'}
};
const CLS_ORDER = ['brilhante','otimo','melhor','excelente','bom','livro','imprecisao','erro','perdido','capivarada'];
const BAD = ['imprecisao','erro','perdido','capivarada'];

function isSacrifice(R, i){
  const m = R.moves[i]; if (m.piece==='p' || m.piece==='k') return false;
  if (m.captured && VAL[m.captured] >= VAL[m.piece]) return false;
  const hang = hangingAfter(R.fens[i], m); if (!hang || VAL[hang.t] < 3) return false;
  const g = new Chess(R.fens[i]); const me = m.color, opp = me==='w'?'b':'w';
  const base = () => { const mp = boardMap(g); return matCount(mp, me) - matCount(mp, opp); };
  const b0 = base();
  g.move({from:m.from,to:m.to,promotion:m.promotion});
  const pv = (R.an[i+1].lines[0] && R.an[i+1].lines[0].pv) || [];
  let minD = base() - b0, steps = 0;
  for (let k=0;k<Math.min(pv.length,5);k++){
    const u = pv[k]; if (!g.move({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]||undefined})) break;
    steps++;
    if (k%2===0) minD = Math.min(minD, base() - b0);
  }
  if (!steps) return false;
  const finalD = base() - b0;
  return minD <= -2 && finalD <= -1;
}
function classifyGame(R){
  const N = R.moves.length; const op = openingInfo(R.moves.map(m=>m.san));
  R.opening = op.name; R.items = [];
  for (let i=0;i<N;i++){
    const m = R.moves[i], A = R.an[i], B = R.an[i+1];
    const bestUci = A.lines[0] && A.lines[0].pv[0];
    const wb = winPct(A.lines[0] ? A.lines[0].score : A.score);
    const wa = 100 - winPct(B.lines[0] ? B.lines[0].score : B.score);
    const isBest = bestUci === uciOf(m);
    const d = isBest ? 0 : Math.max(0, wb - wa);
    let c;
    const legal = new Chess(R.fens[i]).moves().length;
    if (legal===1) c = 'forcado';
    else if (i < op.len && i < 20) c = 'livro';
    else {
      const second = A.lines[1];
      const gap = second ? wb - winPct(second.score) : 0;
      if (d < 2 && wa >= 50 && wb < 97 && isSacrifice(R, i)) c = 'brilhante';
      else if (isBest && second && gap >= 15 && wa >= 30 && wa <= 97 && !new Chess(R.fens[i]).in_check()
        && !(m.captured && VAL[m.captured] >= 3) && !(i>0 && R.moves[i-1].captured && R.moves[i-1].to===m.to)) c = 'otimo';
      else if (isBest) c = 'melhor';
      else if (d < 2) c = 'excelente';
      else if (d < 5) c = 'bom';
      else {
        const prev = R.items[i-1];
        if (prev && (prev.c==='erro' || prev.c==='capivarada') && d < 20) c = 'perdido';
        else if (d < 10) c = 'imprecisao';
        else if (d < 20) c = 'erro';
        else c = 'capivarada';
        if (wa >= 92 && (c==='erro'||c==='capivarada')) c = 'imprecisao';
      }
    }
    R.items.push({c, d, wb, wa, acc: (c==='livro'||c==='forcado') ? 100 : moveAcc(d), bestUci, color:m.color});
  }
  const side = col => {
    const xs = R.items.filter(x=>x.color===col).map(x=>x.acc);
    if (!xs.length) return {acc:0, elo:0};
    const ar = xs.reduce((a,b)=>a+b,0)/xs.length;
    const hm = xs.length / xs.reduce((a,b)=>a + 1/Math.max(b,5), 0);
    const acc = Math.round(((ar+hm)/2)*10)/10;
    return {acc, elo: accToElo(acc)};
  };
  R.side = {w: side('w'), b: side('b')};
  const phaseOf = i => { if (i < 20) return 0; const map = boardMap(new Chess(R.fens[i])); const {s,q} = npm(map); return (s<=20 || (q===0 && s<=26)) ? 2 : 1; };
  R.phases = [0,1,2].map(p => {
    const xs = R.items.map((x,i)=>({x,i})).filter(o => o.x.color===R.userColor && phaseOf(o.i)===p).map(o=>o.x.acc);
    return xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : null;
  });
}
function parsePGN(text){
  const headers = {}; text = String(text).replace(/\r/g,'');
  text.replace(/\[(\w+)\s+"([^"]*)"\]/g, (_, k, v) => { headers[k] = v; return ''; });
  let body = text.replace(/\[(\w+)\s+"([^"]*)"\]/g, ' ');
  body = body.replace(/\{[^}]*\}/g, ' ').replace(/;[^\n]*/g, ' ');
  let prev; do { prev = body; body = body.replace(/\([^()]*\)/g, ' '); } while (body!==prev);
  body = body.replace(/\$\d+/g, ' ').replace(/\d+\.(\.\.)?/g, ' ');
  const toks = body.split(/\s+/).filter(t => t && !/^(1-0|0-1|1\/2-1\/2|\*|½-½)$/.test(t));
  const start = headers.FEN || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const g = new Chess(start);
  if (g.fen().split(' ').slice(0,2).join(' ')!==start.split(' ').slice(0,2).join(' ')) return {error:'A posição inicial (FEN) do PGN é inválida.'};
  for (const t of toks){
    const clean = t.replace(/[!?]+$/,'').replace(/^0-0-0/,'O-O-O').replace(/^0-0/,'O-O');
    const mv = g.move(clean, {sloppy:true});
    if (!mv) return {error:`Não consegui ler o lance "${t}". Confira se o PGN está completo.`};
  }
  return {headers, startFen:start, moves:g.history({verbose:true}), final:g};
}
/* ===== CORE-END ===== */


/* ===== comparação de sequências (usado no "Por quê?" e no Treinador) ===== */
function uciMove(g, u){ return g.move({from:u.slice(0,2), to:u.slice(2,4), promotion:u[4]||undefined}); }
function lineInfo(startFen, ucis, me){
  const g = new Chess(startFen), sans = [], gain = {}, lost = {}; let mate = null, first = null, check = false;
  for (const u of ucis){
    const m = uciMove(g, u); if (!m) break;
    if (!first){ first = m; check = g.in_check(); }
    sans.push(m.san);
    if (m.captured){ const o = m.color===me ? gain : lost; o[m.captured] = (o[m.captured]||0) + 1; }
    if (m.promotion){ const o = m.color===me ? gain : lost; o['promo'] = (o['promo']||0) + 1; }
    if (g.in_checkmate()){ mate = m.color; break; }
  }
  const val = o => Object.entries(o).reduce((a,[t,n]) => a + (t==='promo' ? 8 : VAL[t])*n, 0);
  return {ucis: ucis.slice(0, sans.length), sans, gain, lost, saldo: val(gain) - val(lost), mate, first, check, end: g.fen()};
}
function piecesText(o){
  const N = {q:['a dama','2 damas'], r:['uma torre','2 torres'], b:['um bispo','2 bispos'], n:['um cavalo','2 cavalos'], p:['um peão','peões'], promo:['uma promoção','promoções']};
  const parts = [];
  ['q','r','b','n','p','promo'].forEach(t => { const n = o[t]; if (!n) return; parts.push(n===1 ? N[t][0] : (t==='p' ? n + ' peões' : N[t][1])); });
  if (!parts.length) return '';
  return parts.length===1 ? parts[0] : parts.slice(0,-1).join(', ') + ' e ' + parts[parts.length-1];
}
function lineSummary(info, me){
  if (info.mate) return info.mate===me ? 'Termina em xeque-mate a seu favor.' : 'Você leva xeque-mate.';
  const g = piecesText(info.gain), l = piecesText(info.lost);
  if (!g && !l) return 'Ninguém ganha material nessa sequência.';
  return `${g ? 'Você ganha ' + g : 'Você não ganha nada'}${l ? ' e perde ' + l : ''}. Saldo: ${info.saldo>0?'+':''}${info.saldo}.`;
}
function linePT(startFen, ucis, n){
  const g = new Chess(startFen); const parts = []; let num = +startFen.split(' ')[5] || 1, turn = startFen.split(' ')[1], first = true;
  for (const u of ucis.slice(0, n || ucis.length)){
    const mv = uciMove(g, u); if (!mv) break;
    if (turn==='w') parts.push(`${num}.${ptSan(mv.san)}`); else parts.push(first ? `${num}...${ptSan(mv.san)}` : ptSan(mv.san));
    if (turn==='b') num++; turn = turn==='w' ? 'b' : 'w'; first = false;
  }
  return parts.join(' ');
}
function whyText(base, mine, best, me){
  // mine/best: lineInfo das duas sequências a partir da mesma posição
  if (!mine.first || !best.first) return '';
  const tm = tacticsOf(base, mine.first), tb = tacticsOf(base, best.first);
  const fm = tm.indexOf('garfo')>=0, fb = tb.indexOf('garfo')>=0;
  const pm = ptSan(mine.first.san), pb = ptSan(best.first.san);
  if (fm && fb && best.check && !mine.check)
    return `Os dois lances são garfos, mas ${pb} dá xeque: o adversário é obrigado a salvar o rei e perde a outra peça. No garfo de ${pm} não havia xeque, então ele escolheu salvar a peça mais valiosa.`;
  const artT = t => (FEM.indexOf(t)>=0 ? 'uma ' : 'um ') + TAG[t][0].toLowerCase();
  if (mine.ucis[1]){
    const ga = new Chess(base); uciMove(ga, mine.ucis[0]); const fa = ga.fen(); const rep = uciMove(ga, mine.ucis[1]);
    const rt = rep ? tacticsOf(fa, rep).filter(t => STRONG.indexOf(t)>=0 && t!=='troca') : [];
    if (rt.length && best.saldo > mine.saldo) return `Depois de ${pm}, o adversário tem ${artT(rt[0])} com ${ptSan(rep.san)}. Com ${pb} isso não acontece.`;
  }
  if (fb && !fm) return `${pb} é um garfo: ataca duas peças de uma vez e uma delas cai.`;
  if (best.mate===me) return `${pb} leva a um xeque-mate forçado.`;
  if (mine.mate && mine.mate!==me) return `Depois de ${pm}, o adversário tem xeque-mate.`;
  if (best.saldo > mine.saldo) return `Com ${pb} o saldo de material fica ${best.saldo - mine.saldo} ${best.saldo - mine.saldo===1 ? 'ponto' : 'pontos'} melhor para você do que com ${pm}.`;
  return `Os dois caminhos ganham material parecido, mas ${pb} deixa sua posição melhor depois da troca.`;
}
