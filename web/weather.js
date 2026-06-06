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

//==================================================================
// 高级气象(FA组14 Tick5 append):微下击暴流 / 尾流 / 积冰  ·  真连锁物理
//==================================================================
WEATHER.microburst={active:false,t:0};
WEATHER.wake=false; WEATHER.wakeT=0;
WEATHER.ice=0; WEATHER.antiIce=false;     // 积冰 kg / 除冰
WEATHER.triggerMicroburst=function(){ this.microburst.active=true; this.microburst.t=0; };
WEATHER.deIce=function(){ this.ice=0; };
WEATHER.icePenalty=function(){ return 1-clamp(this.ice/3000,0,0.35); };   // 积冰→操纵效率降(接 ctrlGain*)
WEATHER.step=function(dt,S){
  const head0=(typeof WIND!=='undefined')?3:3;
  // —— 微下击暴流:先顶风增升,过中心顺风骤降 + 下沉气流(经典风切变) ——
  if(this.microburst.active&&typeof WIND!=='undefined'){
    this.microburst.t+=dt; const ph=this.microburst.t;
    if(ph<6){ WIND.head=head0+(ph/6)*9; }                         // 进:顶风增→升性能
    else if(ph<16){ const k=(ph-6)/10; WIND.head=head0+9-k*24;    // 出:顺风骤减→掉性能
      if(!S.onGround)S.gamma-=0.0016*dt;                          // 下击气流→额外下沉
    } else { this.microburst.active=false; WIND.head=head0; }
    if(typeof FAILURES!=='undefined'&&FAILURES.reg.windshear){
      if(ph>5&&ph<16)FAILURES.trigger('windshear'); else FAILURES.clear('windshear');
    }
  }
  // —— 尾流:单向滚转冲击 + 反向恢复(衰减),非纯振荡 ——
  if(this.wake&&!S.onGround){
    this.wakeT+=dt; const env=Math.max(0,1-this.wakeT/4);
    S.roll+=(this.wakeT<1.2?1:-0.5)*18*dt*env;     // 先一侧滚转冲击,后反向恢复
    if(this.wakeT>4)this.wake=false;
  }
  // —— 积冰:结冰环境(SYS.env.icing)累积,除冰清除(标定为分钟级体验内可感) ——
  const icingEnv=(typeof SYS!=='undefined'&&SYS.get('env','icing'));
  if(icingEnv&&!this.antiIce&&!S.onGround)this.ice=Math.min(1800,this.ice+dt*120);
  if(this.antiIce)this.ice=Math.max(0,this.ice-dt*80);
  // 增重(vStall 读 AC.m 自动升)— AC.m = 干重 + 油量 + 积冰(协调 fuel.js)
  if(typeof AC!=='undefined')AC.m=AC.dryMass+((typeof FUEL!=='undefined')?FUEL.total():18000)+this.ice+((typeof WB!=='undefined')?WB.payload():0);
  // ECAM 告警
  if(typeof FAILURES!=='undefined'&&FAILURES.reg.icing){
    const ic=this.ice>200; if(ic&&!FAILURES.reg.icing.active)FAILURES.trigger('icing'); else if(!ic&&FAILURES.reg.icing.active)FAILURES.clear('icing');
  }
};
WEATHER.resetWx=function(){ this.microburst.active=false;this.microburst.t=0;this.wake=false;this.wakeT=0;this.ice=0;this.antiIce=false; };
