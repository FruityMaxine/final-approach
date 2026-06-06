"use strict";
//==================================================================
// WORLDGEN — 程序化世界生成  ·  独立模块
//   网格 cell + per-cell 独立 hash 种子,确定性生成连续铺展的城市/郊区/田野。
//   同 cell 每帧完全一致(不用全局序列随机,杜绝逐帧抖动)。
//   cellsAround(camX,camZ,range) 返回相机周边建筑/树对象。依赖 RWY 运行期全局。
//==================================================================
const WORLDGEN={
  CELL:200,
  // per-cell 独立种子:(cellX,cellZ)→稳定 hash → mulberry32 确定性序列
  rngFor(cx,cz){
    let h=(Math.imul(cx,73856093)^Math.imul(cz,19349663))>>>0;
    h=(h^0x9e3779b9)>>>0;
    return function(){ h=(h+0x6d2b79f5)>>>0; let t=h; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; };
  },
  // 区带:距跑道中线 x + 沿跑道 z 决定密度/楼高。近跑道走廊留空。
  zone(wx,wz){
    const ax=Math.abs(wx), rl=(typeof RWY!=='undefined')?RWY.L:3000;
    if(ax<95 && wz>-250 && wz<rl+400) return 'rwy';      // 跑道走廊留空
    if(ax<650 && wz>-600 && wz<3600) return 'city';      // 城市核(高楼密集)
    if(ax<1500) return 'suburb';                          // 郊区(中低)
    return 'field';                                       // 田野(稀树)
  },
  // 相机周边 cell 的对象(建筑 b / 树 t)。range:前方生成距离。
  cellsAround(camX,camZ,range){
    const out=[], C=this.CELL, rl=(typeof RWY!=='undefined')?RWY.L:3000;
    const cx0=Math.floor((camX-1200)/C), cx1=Math.floor((camX+1200)/C);
    const cz0=Math.floor((camZ-200)/C), cz1=Math.floor((camZ+range)/C);
    for(let cz=cz0;cz<=cz1;cz++)for(let cx=cx0;cx<=cx1;cx++){
      const wxc=cx*C, wzc=cz*C, z=this.zone(wxc+C/2,wzc+C/2);
      if(z==='rwy')continue;
      const rng=this.rngFor(cx,cz);
      const n = z==='city'? 3+(rng()*4|0) : z==='suburb'? 1+(rng()*2|0) : (rng()<0.4?1:0);
      for(let i=0;i<n;i++){
        const ox=wxc+rng()*C, oz=wzc+rng()*C;
        if(Math.abs(ox)<90 && oz>-250 && oz<rl+400)continue;           // 再次避跑道
        const treeP = z==='field'?1 : z==='suburb'?0.32 : 0.06;
        if(rng()<treeP){ out.push({k:'t', x:ox, z:oz, h:5+rng()*8}); }
        else {
          const hMax = z==='city'?115 : z==='suburb'?38 : 14;
          out.push({k:'b', x:ox, z:oz, w:14+rng()*32, d:14+rng()*28, h:8+rng()*hMax, lit:rng()});
        }
      }
    }
    return out;
  },
};
if(typeof window!=='undefined')window.WORLDGEN=WORLDGEN;
