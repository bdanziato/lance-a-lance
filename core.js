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

/* ===== cenários do "Por quê?" (usado no app e no Treinador) ===== */
// Posição igual, mas com a vez passada ao outro lado ("e se o adversário não fizesse nada?")
function nullFen(fen){ const p = fen.split(' '); p[1] = p[1]==='w' ? 'b' : 'w'; p[3] = '-'; return p.join(' '); }
// O que o lance pretende: xeque, captura, peças atacadas e a ameaça (lance seguinte se o adversário não reagisse)
function intentOf(base, uci, threat){
  const g = new Chess(base); const m = uciMove(g, uci); const out = {parts:[], attacked:[], threat:null};
  if (!m) return out;
  const me = m.color, opp = me==='w' ? 'b' : 'w', map = boardMap(g);
  if (g.in_checkmate()){ out.parts.push('dá xeque-mate'); return out; }
  if (g.in_check()) out.parts.push('dá xeque');
  if (m.captured) out.parts.push('captura ' + PUM[m.captured]);
  attacksFrom(map, m.to).forEach(s => { const p = map[s]; if (p && p.color===opp && p.type!=='k' && p.type!=='p' && (VAL[p.type] > VAL[m.piece] || attackersOf(map, s, opp).length===0)) out.attacked.push(s); });
  out.attacked.slice(0, 2).forEach(s => out.parts.push(`ataca ${PART[map[s].type]} em ${s}`));
  if (threat && threat.info && threat.info.first && !g.in_check()){
    const t = threat.info, san = ptSan(t.sans[0]);
    if (t.mate===me){ out.parts.push(`ameaça mate com ${san}`); out.threat = t; }
    else if (t.saldo >= 2 && piecesText(t.gain)){ out.parts.push(`ameaça ${san}, que ganharia ${piecesText(t.gain)}`); out.threat = t; }
  }
  return out;
}
const GOOD_CLS = ['brilhante','otimo','melhor','excelente','bom','livro','forcado'];
function evalMeText(s){ if (!s) return ''; return ('mate' in s) ? (s.mate>0 ? `mate em ${s.mate} para você` : s.mate===0 ? 'xeque-mate' : `você leva mate em ${-s.mate}`) : `${s.cp>=0?'+':''}${(s.cp/100).toFixed(1)}`; }
// Monta as frases de cada cenário. Recebe tudo já calculado.
function narrate(o){
  // o: {pm, pb, cls, wb, wa, opp, intent, game:{info, reply, replyCls, evalMe}|null, mine:{info, reply, evalMe}, best:{info, evalMe}, why}
  const N = {};
  const wb = Math.round(o.wb), wa = Math.round(o.wa);
  const d = wb - wa;
  N.size = o.cls==='perdido' ? `Havia uma chance melhor: ${wb}% contra ${wa}% de chance de vencer.`
    : d < 3 ? `Diferença mínima: ${wb}% contra ${wa}% de chance de vencer.`
    : d < 10 ? `Diferença pequena: sua chance de vencer foi de ${wb}% para ${wa}%. Seu plano é jogável; o melhor lance só é mais preciso.`
    : d < 20 ? `Diferença grande: sua chance de vencer caiu de ${wb}% para ${wa}%. A ideia tinha um furo.`
    : `Diferença decisiva: sua chance de vencer caiu de ${wb}% para ${wa}%.`;
  N.idea = o.intent.parts.length ? `Com ${o.pm}, você ${o.intent.parts.join(' e ')}.` : `${o.pm} não cria uma ameaça imediata: é um lance de posição.`;
  const same = o.game && o.game.reply && o.mine.reply && o.game.reply.from===o.mine.reply.from && o.game.reply.to===o.mine.reply.to;
  if (!o.game || !o.game.reply) N.game = 'A partida terminou neste lance.';
  else {
    const r = ptSan(o.game.reply.san), ok = GOOD_CLS.indexOf(o.game.replyCls)>=0;
    let t = `${o.opp} respondeu ${r}` + (same ? ', exatamente o que o computador esperava' : ok ? ', uma boa resposta' : `, ${CLS[o.game.replyCls] ? CLS[o.game.replyCls].a : 'um erro'}`) + '. ';
    if (o.intent.parts.length && ok) t += 'Essa resposta neutralizou a sua ideia. ';
    else if (!ok) t += o.game.info.saldo > o.mine.info.saldo ? 'Ele errou e você aproveitou. ' : 'Ele errou, mas a chance passou. ';
    t += `Nos lances seguintes: ${lineSummary(o.game.info, o.me)}` + (o.game.evalMe ? ` Avaliação: ${evalMeText(o.game.evalMe)}.` : '');
    N.game = t;
  }
  N.same = !!same;
  N.mine = o.mine.reply ? (same ? `Foi o que aconteceu: com ${ptSan(o.mine.reply.san)}, ${lowerFirst(lineSummary(o.mine.info, o.me))} Avaliação: ${evalMeText(o.mine.evalMe)}.`
    : `Se ele respondesse ${ptSan(o.mine.reply.san)}: ${lowerFirst(lineSummary(o.mine.info, o.me))} Avaliação: ${evalMeText(o.mine.evalMe)}.`) : `${lineSummary(o.mine.info, o.me)}`;
  N.best = `${o.pb}: ${lowerFirst(lineSummary(o.best.info, o.me))} Avaliação: ${evalMeText(o.best.evalMe)}.` + (o.why ? ' ' + o.why : '');
  return N;
}
function lowerFirst(s){ return s ? s[0].toLowerCase() + s.slice(1) : s; }

/* ===== professor: explicação completa de cada lance da revisão ===== */
const CLS_WHY = {
  brilhante:'um sacrifício que funciona, o tipo de lance mais difícil de achar',
  otimo:'o único lance que mantinha a vantagem ou salvava a posição',
  melhor:'o lance que o computador escolheria',
  excelente:'quase tão bom quanto o melhor; a diferença é mínima',
  bom:'um lance sólido, mas havia opção mais forte',
  livro:'um lance conhecido da teoria de aberturas',
  forcado:'o único lance legal ou o único que não perdia na hora',
  imprecisao:'perdeu um pouco da vantagem; não é grave, mas havia lance melhor',
  erro:'perdeu bastante da vantagem e mudou o rumo da posição',
  perdido:'deixou passar uma chance clara que o adversário tinha dado',
  capivarada:'um erro grave, que costuma decidir a partida'
};
const TAG_RULE = {
  garfo:'Antes de cada lance, olhe as casas onde um cavalo ou peão inimigo atacaria duas peças suas de uma vez.',
  cravada:'Peças alinhadas com o rei ou a dama são alvos: evite deixar uma peça sozinha na frente delas.',
  cravada_abs:'Peças alinhadas com o rei são alvos: uma cravada deixa a peça presa.',
  espeto:'Cuidado com rei e dama na mesma linha ou diagonal: um espeto ganha a peça de trás.',
  ataque_descoberto:'Quando uma peça sua está na frente de uma torre, bispo ou dama, mexer nela pode revelar um ataque.',
  xeque_descoberto:'Um xeque descoberto é dos golpes mais fortes: a peça que sai pode capturar o que quiser.',
  peca_indefesa:'Conte quem ataca e quem defende cada peça. Peça sem defesa é peça em perigo.',
  peca_pendurada:'Antes de soltar a peça, pergunte: o que ficou sem defesa?',
  ganho_material:'Capture quando a conta de material sai a seu favor; confira a recaptura antes.',
  mate:'Procure sempre xeques primeiro: às vezes o mate está a um lance.',
  ameaca_mate:'Quando o rei está com poucas casas, veja se dá para ameaçar mate.',
  mate_corredor:'Dê ao seu rei uma "janela" (um peão avançado) para não levar mate na última fileira.',
  promocao:'Peão passado deve ser empurrado; o rei e as torres ajudam a escoltá-lo.'
};
function teachMove(o){
  // o: {base, m, it, anB, anA, after, me (cor do aluno), no, opp, opening}
  const {base, m, it, anB, anA, after, me, no} = o;
  const actor = m.color, isMe = actor===me, who = isMe ? 'Você' : (o.opp || 'O adversário');
  const gA = new Chess(after);
  const S = [];
  const uci = m.from + m.to + (m.promotion || '');
  // 1) o que foi feito
  let t;
  if (m.flags.indexOf('k')>=0) t = `${who} ${isMe ? 'rocou' : 'rocou'} do lado do rei: o rei vai para um canto protegido e a torre entra em jogo.`;
  else if (m.flags.indexOf('q')>=0) t = `${who} rocou do lado da dama: o rei sai do centro e a torre vai para a coluna d.`;
  else {
    t = `${who} ${m.captured ? 'capturou com' : 'levou'} ${PART[m.piece]} de ${m.from} para ${m.to}${m.captured ? `, tomando ${PUM[m.captured]}` : ''}${m.promotion ? ` e promoveu a ${PNAME[m.promotion]}` : ''}.`;
  }
  if (gA.in_checkmate()) t += ' É xeque-mate: fim de partida.';
  else if (gA.in_check()) t += ' O lance dá xeque.';
  const intent = intentOf(base, uci, null).parts.filter(p => !/^(dá xeque|captura|dá xeque-mate)/.test(p));
  if (intent.length) t += ` Com isso, ${intent.join(' e ')}.`;
  const tg = tacticsOf(base, m).concat(strategyOf(base, m, no)).filter((x, k, a) => a.indexOf(x)===k && x!=='troca');
  const good = tg.filter(x => NEG.indexOf(x)<0), bad = tg.filter(x => NEG.indexOf(x)>=0);
  if (good.length) t += ' Ideia: ' + good.slice(0, 2).map(x => `${TAG[x][0].toLowerCase()} (${TAG[x][1]})`).join('; ') + '.';
  if (bad.length) t += ' Cuidado: ' + bad.map(x => `${TAG[x][0].toLowerCase()}, ${TAG[x][1]}`).join('; ') + '.';
  S.push({h:'O lance', t});
  // 2) avaliação (sempre do ponto de vista do aluno)
  const forMe = (score, turn) => turn===me ? score : neg(score);
  const level = s => { if (!s) return 'equilibrada';
    if ('mate' in s) return s.mate===0 ? 'xeque-mate' : s.mate > 0 ? `você tem mate em ${s.mate}` : `o adversário tem mate em ${-s.mate}`;
    const a = Math.abs(s.cp), side = s.cp > 0 ? 'você' : 'o adversário';
    return a < 50 ? 'equilibrada' : a < 150 ? `${side} tem uma vantagem pequena` : a < 400 ? `${side} tem uma vantagem clara` : `${side} tem uma vantagem decisiva`; };
  const fmt = s => !s ? '0.0' : ('mate' in s) ? (s.mate===0 ? '#' : `M${Math.abs(s.mate)}`) : `${s.cp>=0?'+':''}${(s.cp/100).toFixed(1)}`;
  const sB = forMe(anB.score, base.split(' ')[1]);
  const sA = gA.in_checkmate() ? {mate: actor===me ? 1 : -1, done:1} : forMe(anA.score, after.split(' ')[1]);
  const lvA = sA.done ? (actor===me ? 'você venceu' : 'o adversário venceu') : level(sA);
  S.push({h:'Avaliação', t:`Antes: ${fmt(sB)} (${level(sB)}). Depois: ${sA.done ? '#' : fmt(sA)} (${lvA}). Classificação: ${CLS[it.c].n.toLowerCase()}, ${CLS_WHY[it.c] || ''}.`});
  // 3) opções que havia
  const opts = (anB.lines || []).filter(l => l.pv && l.pv[0]).slice(0, 2);
  if (opts.length && it.c!=='forcado'){
    const parts = opts.map((l, k) => {
      const mv = uciMove(new Chess(base), l.pv[0]); if (!mv) return '';
      const tt = tacticsOf(base, mv).concat(strategyOf(base, mv, no)).filter(x => NEG.indexOf(x)<0 && x!=='troca');
      const s = forMe(l.score, base.split(' ')[1]);
      return `${k===0 ? 'A melhor era' : 'Outra boa era'} ${ptSan(mv.san)}${l.pv[0]===uci ? ' (foi o lance jogado)' : ''}, avaliação ${fmt(s)}${isMe ? '' : ' para você'}${tt.length ? `: ${TAG[tt[0]][1]}` : ''}. Sequência provável: ${linePT(base, l.pv, 4)}.`;
    }).filter(Boolean);
    if (parts.length) S.push({h:'Opções que havia', t: parts.join(' ')});
  }
  // 4) por que o melhor é melhor
  const bestU = it.bestUci;
  if (bestU && bestU!==uci && opts.length && it.c!=='livro'){
    const mineL = lineInfo(base, quietCut(base, [uci].concat(anA.lines && anA.lines[0] ? anA.lines[0].pv : []), 7), actor);
    const bestL = lineInfo(base, quietCut(base, opts[0].pv, 7), actor);
    const sum = (L) => { if (L.mate) return L.mate===actor ? 'termina em xeque-mate a favor de quem jogou' : 'termina em xeque-mate contra quem jogou';
      const g = piecesText(L.gain), l = piecesText(L.lost); return !g && !l ? 'ninguém ganha material' : `${g ? 'ganha ' + g : 'não ganha nada'}${l ? ' e perde ' + l : ''}`; };
    let w = whyText(base, mineL, bestL, actor);
    if (!isMe) w = w.replace(/sua posição/g, 'a posição dele').replace(/você/g, 'ele').replace(/Você/g, 'Ele');
    S.push({h:'Por que o melhor lance é melhor', t:`Com ${ptSan(m.san)}, a sequência provável é ${linePT(base, mineL.ucis, 6)} e ${sum(mineL)}. Com ${ptSan(bestL.sans[0])}: ${linePT(base, bestL.ucis, 6)}, e ${sum(bestL)}. ${w}`});
  } else if (bestU===uci && it.c!=='livro' && it.c!=='forcado'){
    S.push({h:'Por que é bom', t:`${isMe ? 'Você encontrou' : 'Ele encontrou'} o melhor lance da posição. ${good.length ? 'O ponto forte: ' + TAG[good[0]][1] + '.' : 'Nenhuma outra opção deixava a posição tão boa.'}`});
  }
  // 5) e agora?
  if (!gA.game_over() && anA.lines && anA.lines[0] && anA.lines[0].pv[0]){
    const next = after.split(' ')[1], rep = uciMove(new Chess(after), anA.lines[0].pv[0]);
    if (rep){
      const rt = tacticsOf(after, rep).filter(x => STRONG.indexOf(x)>=0 && x!=='troca');
      const hang = hangingAfter(base, m);
      let nt = next===me ? `Agora é a sua vez. O melhor lance é ${ptSan(rep.san)}` : `Agora o adversário deve jogar ${ptSan(rep.san)}`;
      nt += rt.length ? `, com ${(FEM.indexOf(rt[0])>=0 ? 'uma ' : 'um ') + TAG[rt[0]][0].toLowerCase()} (${TAG[rt[0]][1]}).` : '.';
      if (next!==me && hang && isMe) nt += ` Atenção: ${PART[hang.t]} em ${hang.sq} ficou sem defesa suficiente.`;
      if (next===me && !isMe && rt.length) nt += ' Procure esse lance antes de passar para o próximo.';
      S.push({h:'E agora?', t: nt});
    }
  } else if (gA.in_stalemate()) S.push({h:'E agora?', t:'Afogamento: o rei não está em xeque, mas não há lance legal. A partida termina empatada.'});
  // 6) lição
  const key = (BAD.indexOf(it.c)>=0 ? tacticsOf(after, anA.lines && anA.lines[0] ? uciMove(new Chess(after), anA.lines[0].pv[0]) : null) : tg).find(x => TAG_RULE[x]);
  const map = boardMap(new Chess(after)); let pcs = 0; for (const s in map) if (map[s].type!=='p' && map[s].type!=='k') pcs++;
  const lesson = key ? TAG_RULE[key]
    : no <= 10 ? 'Na abertura: desenvolva cavalos e bispos, ocupe o centro e faça o roque cedo. Evite mexer a mesma peça duas vezes.'
    : pcs <= 6 ? 'No final: traga o rei para o centro, empurre peões passados e troque peças se estiver com material a mais.'
    : 'No meio-jogo: a cada lance, veja xeques, capturas e ameaças, dos dois lados, nessa ordem. Depois, melhore sua pior peça.';
  S.push({h:'Lição', t: lesson});
  return S;
}

/* ===== professor nos exercícios: por que o melhor lance é melhor que o seu ===== */
// Ameaças imediatas de `side` na posição (como se fosse a vez dele): mate em 1 e peças que ele ganharia
function threatsOf(fen, side){
  const p = fen.split(' '); p[1] = side; p[3] = '-'; const f = p.join(' ');
  let g; try { g = new Chess(f); } catch(e){ return []; }
  if (!g.moves) return [];
  const out = []; const map = boardMap(g); const other = side==='w' ? 'b' : 'w';
  // se o rei do outro lado já está em xeque, essa posição não é válida para "passar a vez"
  const t = new Chess(f); if (t.in_check()) return [];
  g.moves({verbose:true}).forEach(m => {
    const h = new Chess(f); h.move(m);
    if (h.in_checkmate()){ out.push({k:'mate', m, v:100}); return; }
    if (m.captured){
      const defended = attackersOf(boardMap(h), m.to, other).length > 0;
      const gain = defended ? VAL[m.captured] - VAL[m.piece] : VAL[m.captured];
      if (gain >= 2) out.push({k:'ganha', m, v:gain, piece:m.captured});
    }
  });
  return out.sort((a, b) => b.v - a.v);
}
// corta a sequência num ponto "calmo": nunca logo antes de uma recaptura
function quietCut(base, ucis, max){
  const g = new Chess(base), caps = [];
  for (const u of ucis){ const m = uciMove(g, u); if (!m) break; caps.push(!!m.captured); }
  let k = Math.min(max || 8, caps.length);
  while (k > 1 && caps[k] === true) k--;
  return ucis.slice(0, k);
}
function coachPuzzle(o){
  // o: {base, played (obj), bestUci, bestPv, afterPv (resposta do adversário em diante), me, opp, wb, wa}
  const {base, played, me} = o; const opp = me==='w' ? 'b' : 'w'; const oname = o.opp || 'o adversário';
  const best = uciMove(new Chess(base), o.bestUci); if (!best) return [];
  const pm = ptSan(played.san), pb = ptSan(best.san);
  const S = [];
  const after = fenAfter(base, played), afterB = fenAfter(base, best);
  // 1) o que ele ameaçava antes do seu lance
  const thr = threatsOf(base, opp)[0];
  const stillM = thr ? threatsOf(after, opp).find(x => x.m.san===thr.m.san) : null;
  const stillB = thr ? threatsOf(afterB, opp).find(x => x.m.san===thr.m.san) : null;
  const thrTxt = thr ? (thr.k==='mate' ? `mate com ${ptSan(thr.m.san)}` : `${ptSan(thr.m.san)}, ganhando ${PUM[thr.piece]}`) : '';
  // 2) o que acontece depois do seu lance
  const mineL = lineInfo(base, quietCut(base, [played.from + played.to + (played.promotion||'')].concat(o.afterPv || []), 8), me);
  const bestL = lineInfo(base, quietCut(base, o.bestPv && o.bestPv[0]===o.bestUci ? o.bestPv : [o.bestUci], 8), me);
  const reply = mineL.ucis[1] ? uciMove((() => { const g = new Chess(base); uciMove(g, mineL.ucis[0]); return g; })(), mineL.ucis[1]) : null;
  const rt = reply ? tacticsOf(after, reply).filter(x => STRONG.indexOf(x)>=0 && x!=='troca') : [];
  let t1 = `Na partida você jogou ${pm}`;
  const ip = intentOf(base, played.from + played.to + (played.promotion||''), null).parts;
  t1 += ip.length ? `, que ${ip.join(' e ')}.` : '.';
  if (best.captured && VAL[best.captured] >= 3 && played.to!==best.to) t1 += ` O problema: ${PART[best.captured]} de ${oname} em ${best.to} estava ao seu alcance, e ${pb} capturava essa peça.`;
  else if (thr && stillM && !stillB) t1 += ` O problema: ${oname} ameaçava ${thrTxt}, e ${pm} não resolve isso.`;
  else if (reply && rt.length) t1 += ` O problema: depois dele, ${oname} responde ${ptSan(reply.san)}, ${(FEM.indexOf(rt[0])>=0 ? 'uma ' : 'um ') + TAG[rt[0]][0].toLowerCase()} (${TAG[rt[0]][1]}).`;
  else if (reply) t1 += ` A melhor resposta de ${oname} seria ${ptSan(reply.san)}.`;
  const wTxt = w => w >= 85 ? 'você fica ganhando' : w >= 60 ? 'você continua melhor' : w > 40 ? 'a posição fica equilibrada' : w > 15 ? `${oname} fica melhor` : 'a posição fica perdida para você';
  const matTxt = (L, w) => { const g = piecesText(L.gain), l = piecesText(L.lost); if ((L.saldo >= 2 && w > 60) || (L.saldo <= -2 && w < 40)) return `${g ? 'você ganha ' + g : 'você não ganha nada'}${l ? ' e perde ' + l : ''}, e `; return ''; };
  const sm = mineL.mate ? (mineL.mate===me ? 'você daria mate' : 'você levaria mate') : matTxt(mineL, o.wa) + wTxt(o.wa);
  t1 += ` Na sequência ${linePT(base, mineL.ucis)}, ${sm}.`;
  S.push({h:'O que deu errado', t:t1});
  // 3) por que o melhor é melhor
  const bp = intentOf(base, o.bestUci, null).parts;
  const bt = tacticsOf(base, best).concat(strategyOf(base, best, 20)).filter(x => NEG.indexOf(x)<0 && x!=='troca');
  let t2 = `${pb}${bp.length ? ' ' + bp.join(' e ') : ''}.`;
  if (thr && stillM && !stillB) t2 += ` Ele também acaba com a ameaça de ${thrTxt}.`;
  { const gb = new Chess(base); uciMove(gb, o.bestUci); const mp = boardMap(gb); const hit = attacksFrom(mp, best.to).map(q => mp[q]).filter(x => x && x.color===opp && x.type!=='k' && VAL[x.type] > VAL[best.piece]).sort((a, b) => VAL[b.type] - VAL[a.type])[0];
    if (hit && !gb.in_check()) t2 += ` Isso ganha tempo: ${oname} precisa gastar o lance salvando ${PART[hit.type]}, enquanto você desenvolve o seu jogo.`; }
  if (bt.length) t2 += ` É ${(FEM.indexOf(bt[0])>=0 ? 'uma ' : 'um ') + TAG[bt[0]][0].toLowerCase()}: ${TAG[bt[0]][1]}.`;
  const sb = bestL.mate ? (bestL.mate===me ? 'termina em xeque-mate a seu favor' : 'ainda leva mate') : matTxt(bestL, o.wb) + wTxt(o.wb);
  t2 += ` Sequência: ${linePT(base, bestL.ucis)}, e ${sb}.`;
  const d = Math.round(o.wb - o.wa); if (d > 0) t2 += ` Em chance de vitória, a diferença entre os dois lances é de ${d} pontos (${Math.round(o.wb)}% contra ${Math.round(o.wa)}%).`;
  S.push({h:`Por que ${pb} é melhor`, t:t2});
  // 4) como pensar na próxima vez
  let tip;
  if (thr && stillM && !stillB) tip = 'Antes de pensar no seu plano, olhe o último lance do adversário e pergunte: "o que ele quer fazer agora?". Se ele ameaça algo, defenda primeiro.';
  else if (rt.length && TAG_RULE[rt[0]]) tip = TAG_RULE[rt[0]];
  else if (bt.length && TAG_RULE[bt[0]]) tip = TAG_RULE[bt[0]];
  else tip = 'Antes de jogar, faça a checagem do professor: quais xeques, capturas e ameaças existem para mim? E para ele? Só depois escolha o lance.';
  S.push({h:'Como pensar na próxima vez', t:tip});
  return S;
}
function fenAfter(fen, m){ const g = new Chess(fen); g.move({from:m.from, to:m.to, promotion:m.promotion}); return g.fen(); }
// exercícios comuns: explica a ideia da solução
function coachTactic(fen, ucis, themes){
  const g = new Chess(fen); const first = uciMove(new Chess(fen), ucis[0]); if (!first) return [];
  const me = first.color; const info = lineInfo(fen, ucis, me);
  const tg = tacticsOf(fen, first).filter(x => STRONG.indexOf(x)>=0 && x!=='troca');
  const ip = intentOf(fen, ucis[0], null).parts;
  let t = `${ptSan(first.san)}${ip.length ? ' ' + ip.join(' e ') : ''}.`;
  if (tg.length && !(tg[0]==='mate' && ip.indexOf('dá xeque-mate')>=0)) t += ` É ${(FEM.indexOf(tg[0])>=0 ? 'uma ' : 'um ') + TAG[tg[0]][0].toLowerCase()}: ${TAG[tg[0]][1]}.`;
  t += ` Solução: ${linePT(fen, info.ucis)}. ` + (info.mate===me ? (info.ucis.length > 1 ? 'Termina em xeque-mate.' : '') : piecesText(info.gain) ? `No fim você ganha ${piecesText(info.gain)}${piecesText(info.lost) ? ' e entrega ' + piecesText(info.lost) : ''}.` : '');
  const rule = tg.map(x => TAG_RULE[x]).find(Boolean) || 'Procure sempre lances forçados primeiro: xeques, capturas e ameaças.';
  return [{h:'A ideia', t}, {h:'Para levar para o jogo', t:rule}];
}
