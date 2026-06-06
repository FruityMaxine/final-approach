"use strict";
//==================================================================
// AIRCRAFT — 多机型性能库  ·  独立模块(组16 Tick2)
//   4 机型完整气动档案(窄体/宽体/支线/货机),applyAircraft 逐字段写 AC 全局。
//   AC 在 game.js:60 为 const,只能逐字段赋值(AC.m=…),绝不整体替换引用
//   (气动计算 game.js 持 AC 引用,替换会失效)。
//   联动 ENGINES.setCount(机型发动机数,仅 2/4)+ FUEL 容量缩放。
//   起始进近速度按机型 vref 比例缩放(重机进近更快,防换大机型即失速)。
//   依赖运行期全局:AC / ENGINES / FUEL / CONFIG。顶层只定义,加载置 game.js 之前。
//==================================================================
const AIRCRAFT={
  // —— 窄体(A320 级,当前基准,与 game.js:60 原值一致) ——
  narrow:{ name:'窄体客机', desc:'A320 级 · 双发 · Vref 140kt · 灵活均衡', engines:2, vref:140,
    m:62000, dryMass:44000, S:125, span:34, maxThrust:180000, revFactor:0.42,
    CLa:0.105, CL0:0.30, aoaStall:14, CD0:0.021, k:0.045,
    flapCL:[0,0.25,0.50,0.75,1.0], flapStallBonus:[0,1,2,3,4], flapCD:[0,0.010,0.022,0.040,0.065],
    gearCD:0.018, spoilerCD:0.065, spoilerLiftLoss:0.55, gearHeight:3.6,
    fuel:{left:5500,center:7000,right:5500} },
  // —— 宽体(B777 级,重型双发,进近更快、惯性更大) ——
  wide:{ name:'宽体客机', desc:'B777 级 · 双发重型 · Vref 149kt · 惯性大', engines:2, vref:149,
    m:240000, dryMass:170000, S:428, span:60, maxThrust:660000, revFactor:0.40,
    CLa:0.100, CL0:0.28, aoaStall:14, CD0:0.020, k:0.042,
    flapCL:[0,0.22,0.46,0.70,0.95], flapStallBonus:[0,1,2,3,4], flapCD:[0,0.011,0.024,0.044,0.072],
    gearCD:0.020, spoilerCD:0.060, spoilerLiftLoss:0.52, gearHeight:5.8,
    fuel:{left:30000,center:40000,right:30000} },
  // —— 支线(CRJ 级,轻小,进近慢、反应快) ——
  regional:{ name:'支线客机', desc:'CRJ 级 · 双发 · Vref 135kt · 轻快灵敏', engines:2, vref:135,
    m:34000, dryMass:21000, S:70, span:24, maxThrust:80000, revFactor:0.38,
    CLa:0.108, CL0:0.32, aoaStall:15, CD0:0.022, k:0.048,
    flapCL:[0,0.27,0.54,0.80,1.05], flapStallBonus:[0,1,2,3,4], flapCD:[0,0.010,0.021,0.038,0.060],
    gearCD:0.017, spoilerCD:0.068, spoilerLiftLoss:0.57, gearHeight:2.6,
    fuel:{left:3000,center:4000,right:3000} },
  // —— 货机(747F 级,四发最重) ——
  cargo:{ name:'货机', desc:'747F 级 · 四发最重 · Vref 154kt · 沉稳难驾', engines:4, vref:154,
    m:340000, dryMass:180000, S:511, span:64, maxThrust:1000000, revFactor:0.40,
    CLa:0.100, CL0:0.27, aoaStall:13, CD0:0.020, k:0.040,
    flapCL:[0,0.20,0.43,0.66,0.90], flapStallBonus:[0,1,2,3,4], flapCD:[0,0.012,0.026,0.048,0.078],
    gearCD:0.022, spoilerCD:0.058, spoilerLiftLoss:0.50, gearHeight:5.2,
    fuel:{left:45000,center:60000,right:45000} },
};

// 当前机型 vref(kt);供 resetState 缩放起始速度。缺省窄体 140。
function curAircraftVref(){
  const a=(typeof CONFIG!=='undefined'&&AIRCRAFT[CONFIG.aircraft])||AIRCRAFT.narrow;
  return a.vref;
}

// 把机型档案逐字段写入 AC 全局(不替换引用)+ 联动发动机数 + 燃油容量。
function applyAircraft(id){
  if(typeof AC==='undefined')return;
  const a=AIRCRAFT[id]||AIRCRAFT.narrow;
  // —— 逐字段写气动(rho/g 为物理常数不动) ——
  AC.m=a.m; AC.dryMass=a.dryMass; AC.S=a.S; AC.span=a.span;
  AC.maxThrust=a.maxThrust; AC.revFactor=a.revFactor;
  AC.CLa=a.CLa; AC.CL0=a.CL0; AC.aoaStall=a.aoaStall; AC.CD0=a.CD0; AC.k=a.k;
  AC.flapCL=a.flapCL.slice(); AC.flapStallBonus=a.flapStallBonus.slice(); AC.flapCD=a.flapCD.slice();
  AC.gearCD=a.gearCD; AC.spoilerCD=a.spoilerCD; AC.spoilerLiftLoss=a.spoilerLiftLoss;
  AC.gearHeight=a.gearHeight;
  // —— 发动机数(setCount 仅 2/4) ——
  if(typeof ENGINES!=='undefined'&&typeof ENGINES.setCount==='function'){
    ENGINES.setCount(a.engines===4?4:2);
    ENGINES.REVF=a.revFactor;
  }
  if(typeof CONFIG!=='undefined')CONFIG.engines=(a.engines===4?4:2);
  // —— 燃油容量按机型缩放(cap+qty 同步,避免 cap/qty 失配) ——
  if(typeof FUEL!=='undefined'&&FUEL.tanks&&a.fuel){
    for(const t of ['left','center','right']){
      if(FUEL.tanks[t]){ FUEL.tanks[t].cap=a.fuel[t]; FUEL.tanks[t].qty=a.fuel[t]; FUEL.tanks[t].leak=0; }
    }
  }
}

if(typeof window!=='undefined'){ window.AIRCRAFT=AIRCRAFT; window.applyAircraft=applyAircraft; window.curAircraftVref=curAircraftVref; }
