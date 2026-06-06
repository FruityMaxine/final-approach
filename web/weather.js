"use strict";
//==================================================================
// WEATHER — 气象  ·  独立模块(本 tick 只放 visibility/ceiling 基础态;
//   FA组14 Tick5 在此 append microburst/wake/icing,勿覆盖本段)
//   IMC 仪表气象:低能见度→外景雾化渐隐;云底 ceiling 之上→云中白化。
//   PFD 不受影响(仪表飞行)。依赖 render.js 运行期:wctx/W/Hh/S/clamp/M_TO_FT。
//==================================================================
const WEATHER={
  visibility:10000,   // 能见度(m):晴 10000,薄雾 4000,IMC 1500,低能见度 800
  ceiling:5000,       // 云底(ft AGL):晴 5000(高),IMC 600
  preset(k){          // 预设:clear/mist/imc/lowvis
    const P={clear:[10000,5000], mist:[4000,2500], imc:[1500,700], lowvis:[800,300]}[k];
    if(P){this.visibility=P[0];this.ceiling=P[1];}
  },
};
if(typeof window!=='undefined')window.WEATHER=WEATHER;

// IMC 渲染:在 drawWorld 末尾(HUD 前)调用。云中白化 / 低能见度地平线雾。
function drawIMC(){
  if(typeof WEATHER==='undefined')return;
  const altft=S.alt*M_TO_FT, vis=WEATHER.visibility, ceil=WEATHER.ceiling, cloud='214,219,227';
  // 云中(高于云底)→ 白化(越深越浓)
  if(altft>ceil){
    const depth=clamp((altft-ceil)/180,0,1);
    wctx.fillStyle='rgba('+cloud+','+(0.55+0.42*depth)+')';wctx.fillRect(0,0,W,Hh);
    return;
  }
  // 云底将至(接近 ceiling 顶)→ 上方云幕渐厚
  const nearCloud=clamp((altft-(ceil-150))/150,0,1);
  // 低能见度 → 地平线/远景雾化(上→下渐隐,近处留清晰)
  const fog=clamp(1-vis/9000,0,0.93);
  if(fog>0.02||nearCloud>0.02){
    const g=wctx.createLinearGradient(0,0,0,Hh*0.78);
    g.addColorStop(0,'rgba('+cloud+','+clamp(fog+nearCloud*0.5,0,0.96)+')');
    g.addColorStop(0.55,'rgba('+cloud+','+(fog*0.7)+')');
    g.addColorStop(1,'rgba('+cloud+',0)');
    wctx.fillStyle=g;wctx.fillRect(0,0,W,Hh);
  }
}
if(typeof window!=='undefined')window.drawIMC=drawIMC;
