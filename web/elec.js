"use strict";
//==================================================================
// ELEC — 电气系统  ·  独立模块
//   电池 + 双发电机(发动机驱动) + AC/DC 汇流条。
//   发动机失效→对应发电机失电(cascade,电池备份);elecFail→总失电→PFD 黑屏。
//   注册"电气"面板(框架第 6 面板)。依赖 engines 运行期全局。
//==================================================================
const ELEC={
  bat:{on:true, charge:1},
  gen1:{on:true, eng:0}, gen2:{on:true, eng:1},
  busAC:1, busDC:1, failed:false,
  reset(){ this.bat.on=true;this.bat.charge=1;this.gen1.on=true;this.gen2.on=true;this.busAC=1;this.busDC=1;this.failed=false; },
  genPower(g){
    if(!g.on)return 0;
    if(typeof ENGINES!=='undefined'&&ENGINES.list[g.eng]){ const e=ENGINES.list[g.eng]; return (e.state==='run'||e.state==='idle')?1:0; }
    return 1;
  },
  step(dt){
    const genAvail=Math.max(this.genPower(this.gen1),this.genPower(this.gen2));
    this.busAC = this.failed?0:genAvail;                                  // AC 需发电机
    this.busDC = this.failed?0:(genAvail||(this.bat.on?1:0));             // DC 发电机经 TRU 或电池
    if(genAvail<0.5&&this.bat.on&&!this.failed)this.bat.charge=Math.max(0,this.bat.charge-dt*0.012); // 电池耗电
  },
  pfdPower(){ return !this.failed && (this.busAC>0.5 || (this.bat.on&&this.bat.charge>0.05)); },  // PFD 在重要汇流条(电池备份)
  acPower(){ return !this.failed && this.busAC>0.5; },
  fail(on){ this.failed=!!on; },
};
if(typeof window!=='undefined')window.ELEC=ELEC;

//------------------ 电气面板(PANELS 第 6 个注册面板) ------------------
if(typeof PANELS!=='undefined'){
  PANELS.register('elec',{
    label:'电气',
    build(){
      const cell=(id,nm)=>'<div class="elec-cell"><div class="elec-nm">'+nm+'</div><div class="elec-val" id="ev_'+id+'">--</div>'
        +(id==='bat'||id==='gen1'||id==='gen2'?'<button class="eng-btn" data-elec="'+id+'">开关</button>':'')+'</div>';
      return '<div class="syspanel"><div class="sp-title">电气系统 · 电池 / 发电机 / 汇流条</div><div class="elec-grid">'
        +cell('bat','电池 BAT')+cell('gen1','发电机 GEN 1')+cell('gen2','发电机 GEN 2')
        +cell('busAC','交流汇流 AC')+cell('busDC','直流汇流 DC')+'</div>'
        +'<div class="sp-hint">发电机由对应发动机驱动,发动机失效→该发电机失电(电池备份)。总失电→PFD 黑屏。</div></div>';
    },
    wire(host){ host.querySelectorAll('[data-elec]').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.elec;if(k==='bat')ELEC.bat.on=!ELEC.bat.on;else ELEC[k].on=!ELEC[k].on;this.sync(host);})); },
    sync(host){ if(!host)return; const g=id=>document.getElementById(id);
      const set=(id,txt,ok)=>{const el=g('ev_'+id);if(el){el.textContent=txt;el.classList.toggle('lo',!ok);}};
      set('bat', ELEC.bat.on?Math.round(ELEC.bat.charge*100)+'%':'OFF', ELEC.bat.on&&ELEC.bat.charge>0.1);
      set('gen1', ELEC.genPower(ELEC.gen1)>0.5?'ON':'FAULT', ELEC.genPower(ELEC.gen1)>0.5);
      set('gen2', ELEC.genPower(ELEC.gen2)>0.5?'ON':'FAULT', ELEC.genPower(ELEC.gen2)>0.5);
      set('busAC', ELEC.busAC>0.5?'PWR':'OFF', ELEC.busAC>0.5);
      set('busDC', ELEC.busDC>0.5?'PWR':'OFF', ELEC.busDC>0.5);
      host.querySelectorAll('[data-elec]').forEach(b=>{const k=b.dataset.elec;const on=(k==='bat')?ELEC.bat.on:ELEC[k].on;b.classList.toggle('on',on);});
    },
  });
}
