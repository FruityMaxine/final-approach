"use strict";
//==================================================================
// AIRPORTS — 多机场航路库  ·  独立模块(组16 Tick3)
//   4 机场各自跑道号/朝向/长宽/ILS 频率/标高/PAPI 角/航路点。
//   applyAirport 逐字段写 RWY 全局(const,逐字段赋值)+ WPTS 原地改(不替换引用)
//   + PAPI 位置随跑道宽重算。跑道几何沿轴复用(进近永远对跑道轴),朝向影响
//   罗盘基准 + ILS 频率 + 标高 + 跑道号(PFD/MCDU 读 RWY.hdg/ils/name)。
//   依赖运行期全局:RWY / WPTS / PAPI / CONFIG。加载置 game.js 之前。
//==================================================================
const AIRPORTS={
  vega:  { name:'维加国际',   icao:'ZVGA', rwy:'27', hdg:270, W:45, L:3000, ils:'110.30', elevFt:120,  papi:3.0,
           wpts:[{id:'VEGAS',z:-9000},{id:'FAF',z:-3500}] },
  alps:  { name:'阿尔卑斯山城', icao:'LSGA', rwy:'34', hdg:340, W:40, L:2600, ils:'109.50', elevFt:3120, papi:3.5,
           wpts:[{id:'ALPER',z:-9000},{id:'FAF',z:-3500}] },   // 高原短跑道,陡下滑
  coast: { name:'海岸都会',   icao:'KSEA', rwy:'16', hdg:160, W:60, L:3500, ils:'111.70', elevFt:430,  papi:3.0,
           wpts:[{id:'COAST',z:-10500},{id:'FAF',z:-3500}] },  // 宽长跑道
  island:{ name:'热带岛屿',   icao:'RJTI', rwy:'05', hdg:50,  W:45, L:2400, ils:'108.90', elevFt:28,   papi:3.0,
           wpts:[{id:'ISLEX',z:-8200},{id:'FAF',z:-3500}] },   // 海岛短跑道
};

function curAirport(){ return (typeof CONFIG!=='undefined'&&AIRPORTS[CONFIG.airport])||AIRPORTS.vega; }

// 把机场档案逐字段写入 RWY 全局 + WPTS 原地改 + PAPI 位置重算。
function applyAirport(id){
  if(typeof RWY==='undefined')return;
  const a=AIRPORTS[id]||AIRPORTS.vega;
  // —— 逐字段写 RWY(aim/tdz 沿轴几何不动) ——
  RWY.W=a.W; RWY.L=a.L; RWY.elevFt=a.elevFt;
  RWY.name=a.rwy; RWY.ils=a.ils; RWY.hdg=a.hdg; RWY.papi=a.papi; RWY.icao=a.icao; RWY.aptName=a.name;
  // —— PAPI 横向位置随跑道宽重算(PAPI 是 const 对象,改字段) ——
  if(typeof PAPI!=='undefined')PAPI.x=-a.W/2-22;
  // —— WPTS 原地改(length=0+push,保持同一数组引用,render/mcdu 实时读) ——
  if(typeof WPTS!=='undefined'){
    WPTS.length=0;
    for(const w of a.wpts)WPTS.push({id:w.id,z:w.z});
    WPTS.push({id:'RW'+a.rwy,z:0});                  // 跑道阈值航路点
  }
}

if(typeof window!=='undefined'){ window.AIRPORTS=AIRPORTS; window.applyAirport=applyAirport; window.curAirport=curAirport; }
