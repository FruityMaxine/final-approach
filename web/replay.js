"use strict";
//==================================================================
// REPLAY — 飞行轨迹回放系统  ·  独立模块(组16 Tick4)
//   逐帧节流记录 S 关键态入环形缓冲;着陆/结束停录。
//   PANELS 第 9 面板"回放":canvas 双图——侧视下滑剖面(alt vs 距离,叠 3° 参考线)
//   + 俯视航迹(横向 x vs 距离,叠中线容差带)+ 关键事件标记(接地/最大坡度/最低速);
//   底部时间轴 scrub 拖动→高亮该时刻 + 读数。
//   依赖运行期全局:S / RWY / GS_DEG / MS_TO_FPM / MS_TO_KT / M_TO_FT / PANELS。
//==================================================================
const REPLAY={
  label:'回放',
  buf:[], recording:false, REC_DT:0.5, MAX:400, _acc:0, scrub:0,

  start(){ this.buf=[]; this._acc=0; this.recording=true; this.scrub=0; },
  stop(){ this.recording=false; },
  sample(S,dt){
    if(!this.recording||!S||!S.started)return;
    this._acc+=dt;
    if(this._acc<this.REC_DT)return;
    this._acc=0;
    this.buf.push({ t:this.buf.length*this.REC_DT, x:S.x, z:S.z, alt:S.alt, V:S.V,
                    pitch:S.pitch, roll:S.roll, hdg:S.hdg, gamma:S.gamma, phase:S.phase, throttle:S.throttle });
    if(this.buf.length>this.MAX)this.buf.shift();
  },

  // 关键事件索引:接地(alt 最低且近阈值)/ 最大坡度 / 最低速度
  events(){
    const b=this.buf; if(!b.length)return {};
    let tdI=b.length-1, rollI=0, minVI=0, minV=1e9, maxRoll=-1;
    for(let i=0;i<b.length;i++){
      if(Math.abs(b[i].roll)>maxRoll){ maxRoll=Math.abs(b[i].roll); rollI=i; }
      if(b[i].V<minV){ minV=b[i].V; minVI=i; }
    }
    for(let i=0;i<b.length;i++){ if(b[i].phase==='rollout'){ tdI=i; break; } }   // 首个 rollout 帧 = 接地
    return { tdI, rollI, minVI };
  },

  //------------------ 面板装配 ------------------
  build(){
    if(!this.buf||this.buf.length<2)
      return '<div class="syspanel"><div class="sp-title">飞行轨迹回放</div>'
        +'<div class="rp-empty">完成一次着陆后回到此处,查看本次进近的下滑剖面与航迹复盘。</div></div>';
    const n=this.buf.length;
    return '<div class="syspanel"><div class="sp-title">飞行轨迹回放 · '+n+' 帧</div>'
      +'<canvas id="replayCanvas" class="rp-canvas" width="480" height="360"></canvas>'
      +'<div class="rp-ctl"><input type="range" id="rpScrub" class="rp-scrub" min="0" max="'+(n-1)+'" value="'+(n-1)+'"></div>'
      +'<div class="rp-readout" id="rpReadout"></div>'
      +'<div class="sp-hint">上图:侧视下滑剖面(高度 vs 距离,虚线=标准 3° 下滑道);下图:俯视航迹(横向偏离 vs 距离,带=中线±半跑道宽容差)。'
      +'红=接地 · 琥珀=最大坡度 · 青=最低速。拖动滑块回看任意时刻。</div></div>';
  },
  wire(host){
    const cv=host.querySelector('#replayCanvas'); if(!cv)return;
    const sc=host.querySelector('#rpScrub');
    if(sc)sc.addEventListener('input',()=>{ this.scrub=+sc.value; this.draw(host); });
    this.scrub=this.buf.length-1;
    this.draw(host);
  },
  sync(host){ /* 回放为静态复盘,不逐帧重绘(录制时面板通常未开) */ },

  draw(host){
    const cv=host.querySelector('#replayCanvas'); if(!cv)return;
    const ctx=cv.getContext('2d'), W=cv.width, H=cv.height, b=this.buf;
    ctx.clearRect(0,0,W,H); ctx.fillStyle='#070b12'; ctx.fillRect(0,0,W,H);
    if(b.length<2)return;
    const ev=this.events(), pad=30;
    let zmin=Infinity,zmax=-Infinity,amax=10,xabs=10;
    for(const p of b){ zmin=Math.min(zmin,p.z); zmax=Math.max(zmax,p.z); amax=Math.max(amax,p.alt); xabs=Math.max(xabs,Math.abs(p.x)); }
    const zr=(zmax-zmin)||1;
    const xOf=z=> pad+(z-zmin)/zr*(W-2*pad);
    const ft=v=>Math.round(v*((typeof M_TO_FT!=='undefined')?M_TO_FT:3.281));
    // —— 上图:侧视下滑剖面 ——
    const tY0=20, tY1=Math.round(H*0.46);
    const yAlt=a=> tY1-(a/(amax*1.12))*(tY1-tY0);
    ctx.strokeStyle='#1a2230'; ctx.lineWidth=1; ctx.strokeRect(pad,tY0,W-2*pad,tY1-tY0);
    ctx.fillStyle='#7f92a8'; ctx.font='10px monospace'; ctx.textBaseline='alphabetic';
    ctx.fillText('侧视 · 下滑剖面 (ALT/FT)',pad,tY0-6);
    // 3° 标准下滑道参考(虚线):alt_ref = tan(3°)*(-z),仅 z<0 阈前
    const GS=(typeof GS_DEG!=='undefined')?GS_DEG:3.0, tg=Math.tan(GS*Math.PI/180);
    ctx.setLineDash([5,4]); ctx.strokeStyle='#2ad8ff66'; ctx.beginPath();
    let started=false;
    for(let z=zmin;z<=Math.min(0,zmax);z+=zr/60){ const aref=tg*(-z); if(aref<=amax*1.12){ const px=xOf(z),py=yAlt(aref); started?ctx.lineTo(px,py):ctx.moveTo(px,py); started=true; } }
    ctx.stroke(); ctx.setLineDash([]);
    // 实际高度轨迹
    ctx.strokeStyle='#2ee68f'; ctx.lineWidth=1.8; ctx.beginPath();
    b.forEach((p,i)=>{ const px=xOf(p.z),py=yAlt(p.alt); i?ctx.lineTo(px,py):ctx.moveTo(px,py); }); ctx.stroke();
    // —— 下图:俯视航迹 ——
    const bY0=Math.round(H*0.56), bY1=H-34, bMid=(bY0+bY1)/2;
    const halfW=(typeof RWY!=='undefined')?RWY.W/2:22, sclX=Math.max(xabs*1.15,halfW*2);
    const yLat=x=> bMid-(x/sclX)*((bY1-bY0)/2);
    ctx.strokeStyle='#1a2230'; ctx.lineWidth=1; ctx.strokeRect(pad,bY0,W-2*pad,bY1-bY0);
    ctx.fillStyle='#7f92a8'; ctx.fillText('俯视 · 航迹 (横向偏离 M)',pad,bY0-6);
    // 中线 + 容差带 ±半跑道宽
    ctx.fillStyle='#12331f55'; ctx.fillRect(pad,yLat(halfW),W-2*pad,yLat(-halfW)-yLat(halfW));
    ctx.strokeStyle='#2ee68f55'; ctx.setLineDash([4,4]); ctx.beginPath(); ctx.moveTo(pad,bMid); ctx.lineTo(W-pad,bMid); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle='#4d8df0'; ctx.lineWidth=1.8; ctx.beginPath();
    b.forEach((p,i)=>{ const px=xOf(p.z),py=yLat(p.x); i?ctx.lineTo(px,py):ctx.moveTo(px,py); }); ctx.stroke();
    // —— 事件标记(双图同 x) ——
    const mark=(i,col)=>{ if(i==null||!b[i])return; const px=xOf(b[i].z);
      for(const py of [yAlt(b[i].alt),yLat(b[i].x)]){ ctx.fillStyle=col; ctx.beginPath(); ctx.arc(px,py,3.2,0,7); ctx.fill(); } };
    mark(ev.rollI,'#ffb02e'); mark(ev.minVI,'#2ad8ff'); mark(ev.tdI,'#ff4a3d');
    // —— scrub 高亮 ——
    const s=Math.min(this.scrub,b.length-1), p=b[s], sx=xOf(p.z);
    ctx.strokeStyle='#eef2f955'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(sx,tY0); ctx.lineTo(sx,bY1); ctx.stroke();
    ctx.fillStyle='#eef2f9'; ctx.beginPath(); ctx.arc(sx,yAlt(p.alt),4,0,7); ctx.fill();
    ctx.beginPath(); ctx.arc(sx,yLat(p.x),4,0,7); ctx.fill();
    // 读数
    const ro=host.querySelector('#rpReadout');
    if(ro){ const vs=Math.round(p.V*Math.sin(p.gamma)*((typeof MS_TO_FPM!=='undefined')?MS_TO_FPM:196.85));
      const kt=Math.round(p.V*((typeof MS_TO_KT!=='undefined')?MS_TO_KT:1.944));
      ro.innerHTML='<b>T+'+p.t.toFixed(1)+'s</b> · ALT '+ft(p.alt)+'ft · SPD '+kt+'kt · V/S '+vs+'fpm · 横偏 '+p.x.toFixed(1)+'m · 坡度 '+p.roll.toFixed(1)+'°'; }
  },
};

if(typeof PANELS!=='undefined')PANELS.register('replay',REPLAY);
if(typeof window!=='undefined')window.REPLAY=REPLAY;
