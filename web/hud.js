"use strict";
//==================================================================
// HUD — 二维平显增强叠加层  ·  FA组21 Tick2
//   绘于 world 画布(wctx,物理像素 W×Hh),在 drawHUD() 之后调用。
//   三件套(区别于 drawHUD 的基础角标):
//     ① FPV 真实飞行航迹矢量(含侧风偏流,带翼/尾符号,非机头朝向)
//     ② 能量管理指示(比能量高度 He=alt+V²/2g 对比理想下滑能量→高/低能量警示)
//     ③ 速度趋势矢量(dV/dt 外推 10s 空速,预测进入失速/超速)
//   依赖 render.js 全局:wctx/W/Hh/project/MS_TO_KT/M_TO_FT/RAD/GS_DEG,
//   game.js 全局:S/RWY/AC/curAircraftVref/vStall。纯叠加,不改飞行物理。
//   开关持久化 localStorage 'fa.hud';面板"平显/HUD"逐项开关+灵敏度。
//==================================================================
const HUD={
  label:'平显/HUD',
  KEY:'fa.hud',
  opts:{ master:true, fpv:true, energy:true, trend:true, sens:1.0 },
  _prevV:null, _prevT:0, _accel:0,   // 速度趋势平滑
  _sig:null,

  load(){ try{const o=JSON.parse(localStorage.getItem(this.KEY)||'null');if(o)Object.assign(this.opts,o);}catch(_){} },
  save(){ try{localStorage.setItem(this.KEY,JSON.stringify(this.opts));}catch(_){} },
  g(){ return 9.81; },
  now(){ return (typeof performance!=='undefined'&&performance.now)?performance.now():0; },

  // —— 每帧叠加绘制(render drawWorld 末尾调用) ——
  drawOverlay(){
    if(!this.opts.master)return;
    if(typeof S==='undefined'||typeof wctx==='undefined')return;
    if(S.onGround)return;                 // 地面不显示空中平显
    const k=this.opts.sens||1.0;
    if(this.opts.fpv)   this._drawFPV(k);
    if(this.opts.energy)this._drawEnergy(k);
    if(this.opts.trend) this._drawTrend(k);
  },

  // ① FPV 真实航迹矢量 —— 投影速度方向点,带翼尾符号(区别机头)
  _drawFPV(){
    // 世界速度分量:前向沿航向 + 升降率(γ),侧向含偏流(beta)
    const V=S.V, ga=S.gamma, hd=S.hdg*RAD, drift=(S.beta||0)*RAD*0.5;
    const fwd = V*Math.cos(ga);
    const vx  = fwd*Math.sin(hd+drift);   // 侧向(含偏流)
    const vz  = fwd*Math.cos(hd+drift);   // 前向
    const vy  = V*Math.sin(ga);           // 垂向
    const t = 320/Math.max(1,fwd);        // 取约 320m 处的航迹点
    const p = (typeof project==='function') ? project(S.x+vx*t, S.alt+vy*t, S.z+vz*t) : null;
    if(!p)return;
    const x=p.x, y=p.y;
    if(x<60||x>W-60||y<60||y>Hh-60)return;       // 出屏不画
    const c='#34ff8c';
    wctx.save();
    wctx.strokeStyle=c; wctx.lineWidth=2.2; wctx.globalAlpha=0.95;
    wctx.beginPath(); wctx.arc(x,y,8,0,Math.PI*2); wctx.stroke();   // 中心圈
    wctx.beginPath();
    wctx.moveTo(x-8,y); wctx.lineTo(x-22,y);     // 左翼
    wctx.moveTo(x+8,y); wctx.lineTo(x+22,y);     // 右翼
    wctx.moveTo(x,y-8); wctx.lineTo(x,y-16);     // 上尾
    wctx.stroke();
    wctx.restore();
  },

  // ② 能量管理 —— 右侧垂直能量偏差带 + 圆形能量态指示
  _drawEnergy(k){
    const g=this.g();
    const He = S.alt + (S.V*S.V)/(2*g);                  // 当前比能量高度(m)
    const dist = Math.max(0, -S.z);                       // 距阈值(m)
    const idealAlt = dist*Math.tan(GS_DEG*Math.PI/180);  // 3°下滑理想高
    const vrefMs = ((typeof curAircraftVref==='function')?curAircraftVref():140)/MS_TO_KT;
    const HeT = idealAlt + (vrefMs*vrefMs)/(2*g);         // 目标比能量
    const errM = He - HeT;                                // +高能量 / -低能量(m)
    const errFt = Math.round(errM*M_TO_FT);
    // 显示:右缘垂直刻度,中心=on-energy,caret 随误差(±200ft 满量程)
    const cx0=W-30, cy0=Hh*0.42, half=Hh*0.20;
    const norm=Math.max(-1,Math.min(1, errM/(200/M_TO_FT)*k));
    const cy=cy0 - norm*half;                             // 高能量→上
    const inBand=Math.abs(errFt)<60;
    const col=inBand?'#34ff8c':(errFt>0?'#ffb02e':'#ff5a4d');
    wctx.save();
    // 刻度轴
    wctx.strokeStyle='rgba(150,200,170,.35)'; wctx.lineWidth=1.4;
    wctx.beginPath(); wctx.moveTo(cx0,cy0-half); wctx.lineTo(cx0,cy0+half); wctx.stroke();
    // 中心 on-energy 标
    wctx.strokeStyle='rgba(150,200,170,.55)';
    wctx.beginPath(); wctx.moveTo(cx0-7,cy0); wctx.lineTo(cx0+7,cy0); wctx.stroke();
    // 能量 caret(三角)
    wctx.fillStyle=col;
    wctx.beginPath(); wctx.moveTo(cx0-11,cy); wctx.lineTo(cx0-2,cy-6); wctx.lineTo(cx0-2,cy+6); wctx.closePath(); wctx.fill();
    // 标签
    wctx.fillStyle=col; wctx.font='700 12px ui-monospace,Menlo,monospace'; wctx.textAlign='right';
    wctx.fillText('E '+(errFt>0?'+':'')+errFt, cx0-14, cy0-half-6);
    wctx.fillStyle='rgba(150,200,170,.6)'; wctx.font='9px ui-monospace,monospace';
    wctx.fillText(inBand?'ON ENERGY':(errFt>0?'HIGH/FAST':'LOW/SLOW'), cx0-2, cy0+half+14);
    wctx.restore();
  },

  // ③ 速度趋势矢量 —— dV/dt 外推 10s,接 IAS 标(左缘)
  _drawTrend(k){
    const tNow=this.now(), V=S.V;
    if(this._prevV!=null && tNow>this._prevT){
      const dt=Math.min(0.5,(tNow-this._prevT)/1000);
      if(dt>0.001){ const a=(V-this._prevV)/dt; this._accel=this._accel*0.85+a*0.15; }  // 平滑加速度
    }
    this._prevV=V; this._prevT=tNow;
    const predKt = (this._accel*10)*MS_TO_KT*k;            // 10s 后空速增量(kt)
    const iasKt = Math.round(V*MS_TO_KT);
    const vsKt = ((typeof vStall==='function')?vStall():(V*0.78))*MS_TO_KT;
    // 左缘速度带,中心=当前 IAS,趋势箭头向上(增速)/下(减速)
    const x0=22, y0=Hh*0.42, ppk=1.1;                     // 像素/kt
    const yEnd=y0 - predKt*ppk;
    const danger = (iasKt+predKt) < vsKt*1.05;            // 预测逼近失速
    const col = danger?'#ff5a4d':(predKt>0?'#34ff8c':'#7fd0ff');
    wctx.save();
    wctx.strokeStyle=col; wctx.lineWidth=3; wctx.globalAlpha=0.92;
    wctx.beginPath(); wctx.moveTo(x0,y0); wctx.lineTo(x0,yEnd); wctx.stroke();
    // 箭头
    const dir=predKt>=0?-1:1;
    wctx.beginPath(); wctx.moveTo(x0,yEnd); wctx.lineTo(x0-4,yEnd-dir*7); wctx.moveTo(x0,yEnd); wctx.lineTo(x0+4,yEnd-dir*7); wctx.stroke();
    wctx.fillStyle=col; wctx.font='700 11px ui-monospace,monospace'; wctx.textAlign='left';
    wctx.fillText((predKt>=0?'+':'')+Math.round(predKt), x0+7, yEnd+4);
    if(danger){ wctx.fillStyle='#ff5a4d'; wctx.font='700 10px ui-monospace,monospace'; wctx.fillText('SPD', x0-4, y0+half_safe(Hh)); }
    wctx.restore();
  },

  // —— 配置面板(下方仪表区,逐项开关+灵敏度) ——
  build(){
    return '<div class="hud-pan">'
      +'<div class="hud-row" id="hudMaster"></div>'
      +'<div class="hud-grid" id="hudItems"></div>'
      +'<div class="hud-sens"><span class="hud-sk">灵敏度</span><div class="hud-seg" id="hudSens"></div></div>'
      +'<div class="hud-note">FPV=真实航迹矢量(含偏流) · E=比能量高度偏差 · 趋势=10s空速外推</div>'
      +'</div>';
  },
  _renderInto(host){
    const o=this.opts;
    const mh='<button class="hud-master'+(o.master?' on':'')+'" data-hm="1">平显总开关 '+(o.master?'ON':'OFF')+'</button>';
    const items=[['fpv','FPV 航迹矢量'],['energy','能量管理 E'],['trend','速度趋势']];
    const ih=items.map(([id,nm])=>'<button class="hud-chip'+(o[id]?' on':'')+'" data-hi="'+id+'">'+nm+'</button>').join('');
    const sens=[['0.5','低'],['1','标准'],['1.5','高'],['2','极']];
    const sh=sens.map(([v,n])=>'<button class="hud-sopt'+((Math.abs(o.sens-parseFloat(v))<0.01)?' on':'')+'" data-hs="'+v+'">'+n+'</button>').join('');
    host.querySelector('#hudMaster').innerHTML=mh;
    host.querySelector('#hudItems').innerHTML=ih;
    host.querySelector('#hudSens').innerHTML=sh;
  },
  wire(host){
    const self=this; this._sig=null;
    this._renderInto(host);
    if(host._hudWired)return;          // 监听只挂一次(panels.show 每次开都调 wire,防叠加双触发)
    host._hudWired=true;
    host.addEventListener('click',e=>{
      const m=e.target.closest('[data-hm]'), i=e.target.closest('[data-hi]'), s=e.target.closest('[data-hs]');
      if(m){ self.opts.master=!self.opts.master; self.save(); self._sig=null; self._renderInto(host); }
      else if(i){ const id=i.dataset.hi; self.opts[id]=!self.opts[id]; self.save(); self._sig=null; self._renderInto(host); }
      else if(s){ self.opts.sens=parseFloat(s.dataset.hs); self.save(); self._sig=null; self._renderInto(host); }
    });
  },
  sync(host){
    const o=this.opts;
    const sig=[o.master,o.fpv,o.energy,o.trend,o.sens].join('|');
    if(sig===this._sig)return;
    this._sig=sig; this._renderInto(host);
  },
};
// 速度带危险标签的纵向偏移(避免与本体重叠)
function half_safe(h){ return h*0.18; }

HUD.load();
if(typeof PANELS!=='undefined')PANELS.register('hud',HUD);
if(typeof window!=='undefined')window.HUD=HUD;
