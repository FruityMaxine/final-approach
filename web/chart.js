"use strict";
//==================================================================
// CHART — 进近图 / 航图(组20 Tick2)
//   静态参考进近图(区别于 ND 实时航向上投影):固定布局,不读 S 本机位置。
//   ①平面图:跑道居中朝上 + 进近航道延长线 + 航路点(WPTS/PROC)按 z 排布
//     + 距离环 + MDA 框。②垂直剖面:距离×高度,3° 下滑道 + 各点高度限制 + 入口标高。
//   机场/程序切换(WPTS/RWY 变)自动更新。依赖运行期全局:WPTS/RWY/M_TO_FT。
//   高密度小字,手机零横滚。
//==================================================================
const CHART={
  label:'航图/CHART', _sig:null,

  _wpts(){ return (typeof WPTS!=='undefined')?WPTS:[]; },
  _alt(w){ const m=String(w.altLim||'').match(/\d+/); return m?+m[0]:null; },

  drawPlan(cv){
    const ctx=cv.getContext('2d'), W=cv.width, H=cv.height; ctx.clearRect(0,0,W,H);
    ctx.fillStyle='#070d0a'; ctx.fillRect(0,0,W,H);
    const wp=this._wpts(), cx=W/2, top=22, bot=H-30;
    let zfar=-1000; for(const w of wp)zfar=Math.min(zfar,w.z); zfar=Math.min(zfar,-2000);
    const yOf=z=>top+((z-zfar)/(0-zfar))*(bot-top);
    // 距离环(虚线弧)+ NM 标
    ctx.strokeStyle='#15402c'; ctx.setLineDash([4,4]); ctx.fillStyle='#3a6650'; ctx.font='8px monospace'; ctx.textAlign='left';
    for(const nm of [5,10,15]){ const z=-nm*1852; if(z<zfar)continue; const y=yOf(z);
      ctx.beginPath(); ctx.moveTo(cx-W*0.4,y); ctx.lineTo(cx+W*0.4,y); ctx.stroke(); ctx.fillText(nm+'NM',cx+W*0.4-22,y-2); }
    ctx.setLineDash([]);
    // 进近航道延长线
    ctx.strokeStyle='#2ee68f'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(cx,bot); ctx.lineTo(cx,top+6); ctx.stroke();
    // 跑道符号(底部朝上)
    ctx.fillStyle='#cfd6e0'; ctx.fillRect(cx-5,bot,10,22);
    ctx.fillStyle='#9fb2c8'; ctx.font='9px monospace'; ctx.textAlign='center';
    ctx.fillText('RWY '+((typeof RWY!=='undefined')?RWY.name:'27'),cx,bot+34);
    // 航路点(菱形+id+altLim)
    ctx.font='8px monospace';
    for(const w of wp){ const y=yOf(w.z); ctx.fillStyle='#2ad8ff';
      ctx.beginPath(); ctx.moveTo(cx,y-4); ctx.lineTo(cx+4,y); ctx.lineTo(cx,y+4); ctx.lineTo(cx-4,y); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#9fb2c8'; ctx.textAlign='left'; ctx.fillText(w.id+(w.altLim?' '+w.altLim:''),cx+7,y+3); ctx.textAlign='center'; }
    // MDA 框
    const elev=(typeof RWY!=='undefined')?(RWY.elevFt|0):120, mda=elev+250;
    ctx.strokeStyle='#ffb02e'; ctx.fillStyle='#ffb02e'; ctx.lineWidth=1; ctx.strokeRect(6,top,58,16);
    ctx.font='8px monospace'; ctx.textAlign='left'; ctx.fillText('MDA '+mda,9,top+11);
    ctx.fillStyle='#3a6650'; ctx.fillText('平面进近图',6,H-6);
  },
  drawProfile(cv){
    const ctx=cv.getContext('2d'), W=cv.width, H=cv.height; ctx.clearRect(0,0,W,H);
    ctx.fillStyle='#070d0a'; ctx.fillRect(0,0,W,H);
    const wp=this._wpts(), pad=26, elev=(typeof RWY!=='undefined')?(RWY.elevFt|0):120;
    let maxD=6, maxA=Math.max(6000,elev+1000); for(const w of wp){ const d=-w.z/1852; if(d>maxD)maxD=d; const a=this._alt(w); if(a&&a>maxA)maxA=a; }
    const xOf=d=>(W-pad)-(d/maxD)*(W-2*pad), yOf=a=>(H-pad)-((a-elev)/(maxA-elev))*(H-2*pad);
    // 地面线 + 入口
    ctx.strokeStyle='#15402c'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(pad,yOf(elev)); ctx.lineTo(W-pad,yOf(elev)); ctx.stroke();
    ctx.fillStyle='#cfd6e0'; ctx.fillRect(W-pad-3,yOf(elev)-4,3,4);
    // 3° 下滑道
    const tg=Math.tan(3*Math.PI/180);
    ctx.strokeStyle='#2ad8ff'; ctx.setLineDash([5,4]); ctx.beginPath();
    ctx.moveTo(xOf(0),yOf(elev)); ctx.lineTo(xOf(maxD),yOf(elev+maxD*6076*tg)); ctx.stroke(); ctx.setLineDash([]);
    // 航路点高度点+标
    ctx.font='8px monospace';
    for(const w of wp){ const a=this._alt(w); if(a==null)continue; const d=-w.z/1852, x=xOf(d), y=yOf(a);
      ctx.fillStyle='#2ee68f'; ctx.beginPath(); ctx.arc(x,y,3,0,7); ctx.fill();
      ctx.fillStyle='#9fb2c8'; ctx.textAlign='center'; ctx.fillText(w.id,x,y-6); ctx.fillText(a+'',x,y+13); }
    // 轴标
    ctx.fillStyle='#3a6650'; ctx.textAlign='left'; ctx.fillText('垂直剖面 · 3° G/S · 入口标高 '+elev+'ft',pad,12);
    ctx.textAlign='right'; ctx.fillText('THR',W-pad,H-8); ctx.textAlign='left'; ctx.fillText(maxD.toFixed(0)+'NM',pad,H-8);
  },
  render(host){
    if(!host)return;
    const sig=(typeof RWY!=='undefined'?RWY.name:'')+'|'+this._wpts().map(w=>w.id+w.z+(w.altLim||'')).join(',');
    if(sig===this._sig)return; this._sig=sig;
    const pl=host.querySelector('#chartPlan'), pr=host.querySelector('#chartProfile');
    if(pl)this.drawPlan(pl); if(pr)this.drawProfile(pr);
  },
  build(){
    return '<div class="syspanel"><div class="sp-title">进近图 · '+((typeof RWY!=='undefined')?RWY.aptName+' RWY '+RWY.name:'')+'</div>'
      +'<canvas id="chartPlan" class="chart-cv" width="360" height="200"></canvas>'
      +'<canvas id="chartProfile" class="chart-cv" width="360" height="130"></canvas>'
      +'<div class="sp-hint">静态进近参考图:上=平面图(跑道/航道/航路点/距离环/MDA),下=垂直剖面(3° 下滑道/各点高度限制/入口标高)。随机场与程序(SID/STAR)更新。区别于 ND 实时导航显示。</div></div>';
  },
  wire(host){ this._sig=null; this.render(host); },
  sync(host){ this.render(host); },
};

if(typeof PANELS!=='undefined')PANELS.register('chart',CHART);
if(typeof window!=='undefined')window.CHART=CHART;
