"use strict";
//==================================================================
// AFS — 自动飞行系统 / FCU 控制板(组17 Tick2)
//   独立于 EMMA 的可选模式自动驾驶:HDG/ALT/SPD/V·S 选定 + NAV/APPR managed。
//   FCU 面板调目标值 + 选模式;AFS.update(dt) 按选定模式算目标写 S(舵面/油门)。
//   与 EMMA 协调:ap.level==='control'(EMMA 全接管)时 AFS 让位;否则 engaged 即飞。
//   依赖运行期全局:S/AC/RWY/WPTS/WIND/GS_DEG/RAD/DEG/MS_TO_KT/M_TO_FT/MS_TO_FPM/
//   clamp/lerp/crosswindAt/ap/syncThrottleUI/updateStickKnob/updateRudderUI。
//==================================================================
const AFS={
  label:'AFS/FCU',
  engaged:false,
  tgt:{ hdgSel:270, altSel:2000, spdSel:140, vsSel:0 },
  modes:{ lat:'HDG', ver:'ALT', spd:'SEL' },     // lat:HDG/NAV  ver:ALT/VS/APPR  spd:SEL/MANAGED
  STEP:{ hdgSel:5, altSel:100, spdSel:5, vsSel:100 },
  LIM:{ hdgSel:[0,359,true], altSel:[0,41000], spdSel:[100,340], vsSel:[-2000,2000] },

  adj(k,dir){
    const s=this.STEP[k]*dir, L=this.LIM[k]; let v=this.tgt[k]+s;
    if(L[2]){ v=((v%360)+360)%360; }                 // hdg 环绕
    else v=Math.max(L[0],Math.min(L[1],v));
    this.tgt[k]=v;
  },

  // 按 FCU 模式飞;EMMA control 时让位(ap 优先)。返回是否实际驱动。
  update(dt){
    if(!this.engaged)return false;
    if(typeof ap!=='undefined'&&ap.level==='control')return false;   // EMMA 全接管优先
    if(typeof S==='undefined'||!S.started||S.onGround||S.phase==='ended')return false;
    const altft=S.alt*M_TO_FT, vkt=S.V*MS_TO_KT, vs=S.V*Math.sin(S.gamma)*MS_TO_FPM;
    const rwHdg=(typeof RWY!=='undefined'&&RWY.hdg!=null)?RWY.hdg:270;
    const cw=(typeof crosswindAt==='function')?crosswindAt(S.alt):WIND.cross, latGS=S.V*Math.sin(S.hdg*RAD)+cw;

    // —— 横向:目标坡度 ——
    let tRoll;
    if(this.modes.lat==='NAV'||this.modes.lat==='APPR'){
      tRoll=clamp(-S.x*0.85-latGS*3.2,-16,16);                       // 沿中线(WPTS 在中线)/ILS
    }else{ // HDG 选定
      let hdgErr=(this.tgt.hdgSel-(rwHdg+S.hdg)); hdgErr=((hdgErr+540)%360)-180;
      tRoll=clamp(hdgErr*0.9,-22,22);
    }
    // —— 纵向:目标俯仰 ——
    let tPitch, tGamma;
    if(this.modes.ver==='APPR'){
      const distToThr=Math.max(1,-S.z), gsDeg=S.z<0?Math.atan2(S.alt,distToThr)*DEG:0, onGS=gsDeg-GS_DEG;
      tGamma=clamp(-GS_DEG-onGS*0.9,-5,-1.2)*RAD;
      tPitch=clamp(S.pitch+(tGamma-S.gamma)*DEG*0.35,0.5,9);
    }else if(this.modes.ver==='VS'){
      const vsErr=this.tgt.vsSel-vs; tPitch=clamp(S.pitch+vsErr*0.0016,-3,12);
    }else{ // ALT 保持
      const altErr=this.tgt.altSel-altft, vsCmd=clamp(altErr*8,-1600,1600), vsErr=vsCmd-vs;
      tPitch=clamp(S.pitch+vsErr*0.0016,-3,12);
    }
    // —— 速度:目标油门 ——
    let tThr;
    if(this.modes.spd==='MANAGED'){ tThr=clamp(0.20-(vkt-140)*0.018,0,0.6); }
    else { tThr=clamp(0.20-(vkt-this.tgt.spdSel)*0.018,0,0.85); }
    const tRud=clamp(-S.beta*0.04-S.hdg*0.03,-0.6,0.6);

    // —— 写 S(全权,engaged) ——
    S.pitchIn=clamp((tPitch-S.pitch)*0.6,-1,1); S.pitchInRaw=S.pitchIn;
    S.rollIn=clamp((tRoll-S.roll)*0.12,-1,1);
    S.rudder=lerp(S.rudder,tRud,Math.min(1,dt*4));
    S.throttle=clamp(lerp(S.throttle,tThr,Math.min(1,dt*2.2)),0,1);
    if(typeof ap!=='undefined'){ ap.fd.pitch=tPitch; ap.fd.roll=tRoll; ap.fd.valid=true; }
    if(typeof syncThrottleUI==='function')syncThrottleUI();
    if(typeof updateStickKnob==='function')updateStickKnob();
    if(typeof updateRudderUI==='function')updateRudderUI();
    return true;
  },

  //------------------ FCU 面板 ------------------
  build(){
    const t=this.tgt, fmtA=v=>(''+Math.round(v)).padStart(3,'0');
    const tile=(k,lbl,val)=>'<div class="fcu-tile"><div class="fcu-lbl">'+lbl+'</div>'
      +'<div class="fcu-val" id="fcu_'+k+'">'+val+'</div>'
      +'<div class="fcu-knob"><button class="fcu-b" data-adj="'+k+'" data-dir="-1">▼</button>'
      +'<button class="fcu-b" data-adj="'+k+'" data-dir="1">▲</button></div></div>';
    const mbtn=(grp,val,lbl)=>'<button class="fcu-mode" data-mgrp="'+grp+'" data-mval="'+val+'">'+lbl+'</button>';
    return '<div class="syspanel"><div class="sp-title">自动飞行系统 · FCU</div>'
      +'<div class="fcu-row">'
      +'<button class="fcu-ap" id="fcuAP">AP</button>'
      +tile('spdSel','SPD',Math.round(t.spdSel))
      +tile('hdgSel','HDG',fmtA(t.hdgSel))
      +tile('altSel','ALT',Math.round(t.altSel))
      +tile('vsSel','V/S',(t.vsSel>0?'+':'')+Math.round(t.vsSel))
      +'</div>'
      +'<div class="fcu-modes"><span class="fcu-grp">横向</span>'+mbtn('lat','HDG','HDG')+mbtn('lat','NAV','NAV')+mbtn('lat','APPR','APPR')+'</div>'
      +'<div class="fcu-modes"><span class="fcu-grp">纵向</span>'+mbtn('ver','ALT','ALT')+mbtn('ver','VS','V/S')+mbtn('ver','APPR','G/S')+'</div>'
      +'<div class="fcu-modes"><span class="fcu-grp">速度</span>'+mbtn('spd','SEL','SPD SEL')+mbtn('spd','MANAGED','MANAGED')+'</div>'
      +'<div class="sp-hint">AP 主开关接通后,按选定模式自动飞:HDG 保持选定航向 / ALT 保持选定高度 / V·S 保持升降率 / SPD 自动油门;NAV·APPR 沿航路与 ILS。EMMA 全接管时 FCU 自动让位。</div></div>';
  },
  wire(host){
    const self=this;
    host.querySelectorAll('[data-adj]').forEach(b=>b.addEventListener('click',()=>{ self.adj(b.dataset.adj,+b.dataset.dir); self.sync(host); }));
    host.querySelectorAll('[data-mgrp]').forEach(b=>b.addEventListener('click',()=>{ self.modes[b.dataset.mgrp]=b.dataset.mval; self.sync(host); }));
    const ap0=host.querySelector('#fcuAP'); if(ap0)ap0.addEventListener('click',()=>{ self.engaged=!self.engaged; self.sync(host); });
    this.sync(host);
  },
  sync(host){
    if(!host)return;
    const t=this.tgt, g=id=>host.querySelector(id);
    if(g('#fcu_spdSel'))g('#fcu_spdSel').textContent=Math.round(t.spdSel);
    if(g('#fcu_hdgSel'))g('#fcu_hdgSel').textContent=(''+Math.round(t.hdgSel)).padStart(3,'0');
    if(g('#fcu_altSel'))g('#fcu_altSel').textContent=Math.round(t.altSel);
    if(g('#fcu_vsSel'))g('#fcu_vsSel').textContent=(t.vsSel>0?'+':'')+Math.round(t.vsSel);
    const apb=g('#fcuAP'); if(apb)apb.classList.toggle('on',this.engaged);
    host.querySelectorAll('[data-mgrp]').forEach(b=>b.classList.toggle('on',this.modes[b.dataset.mgrp]===b.dataset.mval));
  },
};

if(typeof PANELS!=='undefined')PANELS.register('afs',AFS);
if(typeof window!=='undefined')window.AFS=AFS;
