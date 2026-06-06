"use strict";
//==================================================================
// PERF — 性能计算页(组18 Tick3)
//   按机型质量(AC.dryMass+FUEL)+ 跑道长/标高 + 顶风 + 襟翼 + OAT
//   算 V1/VR/V2/Vref/Vapp + 起飞 TODR / 着陆 LDR + 跑道余量。
//   ★简化教学公式,非真实 AFM 数据。结果可写 AFS.tgt.spdSel(Vapp)闭环。
//   依赖运行期全局:AC/FUEL/RWY/WIND/MS_TO_KT/AFS。高密度小控件,手机零横滚。
//==================================================================
const PERF={
  label:'性能/PERF',
  oat:15,                 // 外界大气温 ℃(可调)
  toFlap:2, ldgFlap:4,    // 起飞/着陆襟翼档

  _mass(){ const dry=(typeof AC!=='undefined')?AC.dryMass:44000, fuel=(typeof FUEL!=='undefined')?FUEL.total():18000; return dry+fuel; },
  _rho(){ const elev=(typeof RWY!=='undefined')?RWY.elevFt:120;
    return 1.225*(1-elev*0.0000086)*(288.15/(273.15+this.oat)); },   // 标高+温度密度修正(简化)
  _vstallMs(flap){
    if(typeof AC==='undefined')return 60;
    const CLmax=AC.CL0+AC.CLa*12+ (AC.flapCL[flap]||0);              // 12° 失速迎角
    return Math.sqrt(2*this._mass()*9.81/(this._rho()*AC.S*Math.max(CLmax,0.5)));
  },
  _headKt(){ return (typeof WIND!=='undefined')?Math.max(0,WIND.head)*MS_TO_KT:0; },

  // 全套性能(kt / m)
  calc(){
    const kt=MS_TO_KT, mass=this._mass();
    const vsTo=this._vstallMs(this.toFlap), vsLd=this._vstallMs(this.ldgFlap);
    const V2=vsTo*1.20*kt, VR=vsTo*1.15*kt, V1=vsTo*1.08*kt;   // V1≤VR≤V2(简化)
    const Vref=vsLd*1.3*kt, Vapp=Vref+Math.min(15,this._headKt()/3+5);  // 进近风修正附加
    // 距离(简化能量法,含安全系数)
    const T=(typeof AC!=='undefined')?AC.maxThrust:180000;
    const aTo=Math.max(0.6, T/mass*0.82-1.1);                          // 起飞净加速度
    const vrG=Math.max(10,(VR-this._headKt())/kt);                     // 地速(顶风减)
    const TODR=Math.round((vrG*vrG)/(2*aTo)*1.15+250);                 // +抬轮离地段
    const vapG=Math.max(10,(Vref-this._headKt())/kt);
    const LDR=Math.round(380 + (vapG*vapG)/(2*2.6)*1.0);              // 气程+地面减速 2.6m/s²
    const rwy=(typeof RWY!=='undefined')?RWY.L:3000;
    return { mass:Math.round(mass), V1:Math.round(V1),VR:Math.round(VR),V2:Math.round(V2),
             Vref:Math.round(Vref),Vapp:Math.round(Vapp), TODR,LDR, rwy,
             toMargin:rwy-TODR, ldMargin:rwy-LDR, head:Math.round(this._headKt()) };
  },

  applyVapp(){ const d=this.calc(); if(typeof AFS!=='undefined'){ AFS.tgt.spdSel=d.Vapp; }
    if(typeof MCDU!=='undefined'&&MCDU.fmgc)MCDU.fmgc.vapp=d.Vapp; return d.Vapp; },

  //------------------ 面板 ------------------
  _cell(lbl,val,unit,cls){ return '<div class="pf-cell '+(cls||'')+'"><span>'+lbl+'</span><b>'+val+(unit?'<small>'+unit+'</small>':'')+'</b></div>'; },
  render(host){
    const s=host?host.querySelector('#pfScreen'):null; if(!s)return; const d=this.calc();
    let h='<div class="pf-gw">起飞全重 GW <b>'+d.mass+'</b> KG · 顶风 '+d.head+' kt · OAT '+this.oat+'℃ · 跑道 '+d.rwy+' m</div>';
    h+='<div class="pf-sec">起飞</div><div class="pf-grid">'
      +this._cell('V1',d.V1,'kt')+this._cell('VR',d.VR,'kt')+this._cell('V2',d.V2,'kt')
      +this._cell('起飞襟翼','FLAP '+this.toFlap,'')+this._cell('TODR',d.TODR,'m')
      +this._cell('余量',(d.toMargin>0?'+':'')+d.toMargin,'m',d.toMargin>0?'ok':'no')+'</div>';
    h+='<div class="pf-sec">着陆</div><div class="pf-grid">'
      +this._cell('Vref',d.Vref,'kt')+this._cell('Vapp',d.Vapp,'kt')+this._cell('着陆襟翼','FULL','')
      +this._cell('LDR',d.LDR,'m')+this._cell('余量',(d.ldMargin>0?'+':'')+d.ldMargin,'m',d.ldMargin>0?'ok':'no')
      +'<div class="pf-cell"><span>&nbsp;</span><b>&nbsp;</b></div>'+'</div>';
    s.innerHTML=h;
  },
  build(){
    return '<div class="syspanel"><div class="sp-title">性能计算 PERF</div>'
      +'<div class="pf-ctl"><span class="pf-lbl">OAT ℃</span>'
        +'<button class="pf-b" data-oat="-5">−</button><b class="pf-oat" id="pfOat">'+this.oat+'</b><button class="pf-b" data-oat="5">+</button>'
        +'<button class="pf-apply" id="pfApply">应用 Vapp → 自动飞行</button></div>'
      +'<div class="pf-screen" id="pfScreen"></div>'
      +'<div class="sp-hint">按机型全重 / 跑道长 / 标高 / 顶风 / 襟翼 / OAT 计算速度与起降距离。余量绿=跑道够,红=不够。'
      +'<b style="color:var(--amb)">简化教学用,非真实 AFM。</b>点应用把 Vapp 送入 AFS 自动飞行。</div></div>';
  },
  wire(host){
    const self=this;
    host.querySelectorAll('[data-oat]').forEach(b=>b.addEventListener('click',()=>{
      self.oat=Math.max(-40,Math.min(50,self.oat+ +b.dataset.oat));
      const o=host.querySelector('#pfOat'); if(o)o.textContent=self.oat; self.render(host);
    }));
    const ap=host.querySelector('#pfApply'); if(ap)ap.addEventListener('click',()=>{
      const v=self.applyVapp(); ap.textContent='已应用 Vapp '+v+'kt'; setTimeout(()=>{ap.textContent='应用 Vapp → 自动飞行';},1500);
    });
    this.render(host);
  },
  sync(host){ this.render(host); },   // 逐帧随质量/风/机型实时刷新
};

if(typeof PANELS!=='undefined')PANELS.register('perf',PERF);
if(typeof window!=='undefined')window.PERF=PERF;
