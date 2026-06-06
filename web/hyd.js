"use strict";
//==================================================================
// HYD — 液压系统  ·  独立模块
//   三液压源 A/B/C(类 737/A320):A=主操纵(发1驱动) B=扰流板/起落架(发2驱动) C=刹车/备份(电动泵)。
//   液压故障→压力降→操纵增益下降(沉重迟钝)/扰流板失效/刹车效能降。
//   cascade:发动机失效→其驱动的液压泵失压。注册"液压"面板(框架第4面板)。
//   依赖 game.js/engines.js 运行期全局(clamp/lerp/ENGINES)。
//==================================================================
const HYD={
  sys:{
    A:{press:1, pump:true, eng:0,  failed:false},   // 主操纵,发动机1驱动
    B:{press:1, pump:true, eng:1,  failed:false},   // 扰流板/起落架,发动机2驱动
    C:{press:1, pump:true, eng:null,failed:false},  // 刹车/备份,电动泵
  },
  reset(){ for(const k in this.sys){ const s=this.sys[k]; s.press=1; s.pump=true; s.failed=false; } },
  step(dt){
    for(const k in this.sys){ const s=this.sys[k];
      let supplied = s.pump && !s.failed;
      // 发动机驱动泵:对应发动机非运转 → 该泵失压(cascade)
      if(s.eng!=null && typeof ENGINES!=='undefined' && ENGINES.list[s.eng]){
        const e=ENGINES.list[s.eng];
        if(e.state!=='run'&&e.state!=='idle')supplied=false;
      }
      s.press = lerp(s.press, supplied?1:0, Math.min(1,dt*0.8));   // 压力渐变(蓄压器缓冲)
    }
  },
  // 主操纵增益:系统A压力低→操纵迟钝(保留 25% 人力/备份)
  ctrlGain(){ return clamp(0.25+0.75*this.sys.A.press, 0.25, 1); },
  spoilerOK(){ return this.sys.B.press>0.4; },                 // 扰流板需 B 压力
  brakeGain(){ return clamp(0.3+0.7*this.sys.C.press, 0.3, 1); },// 刹车效能
  fail(k,on){ if(this.sys[k])this.sys[k].failed=!!on; },
  anyLow(){ return this.sys.A.press<0.5||this.sys.B.press<0.5||this.sys.C.press<0.5; },
};
if(typeof window!=='undefined')window.HYD=HYD;

//------------------ 液压面板(PANELS 第 4 个注册面板) ------------------
if(typeof PANELS!=='undefined'){
  PANELS.register('hyd',{
    label:'液压',
    build(){
      const bar=(k,nm)=>'<div class="hyd-col" data-hyd="'+k+'"><div class="hyd-nm">SYS '+k+'</div>'
        +'<div class="hyd-bar"><div class="hyd-fill" id="hf_'+k+'"></div></div>'
        +'<div class="hyd-p" id="hp_'+k+'">0</div><div class="hyd-src">'+nm+'</div>'
        +'<button class="eng-btn" data-hpump="'+k+'">泵 PUMP</button></div>';
      return '<div class="syspanel"><div class="sp-title">液压系统 · A / B / C</div><div class="hyd-row">'
        +bar('A','主操纵 · ENG1')+bar('B','扰流板/起落架 · ENG2')+bar('C','刹车/备份 · 电动')+'</div>'
        +'<div class="sp-hint">压力低→操纵沉重迟钝(A)、扰流板失效(B)、刹车效能降(C)。发动机失效→其驱动泵失压。</div></div>';
    },
    wire(host){ host.querySelectorAll('[data-hpump]').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.hpump;HYD.sys[k].pump=!HYD.sys[k].pump;this.sync(host);})); },
    sync(host){ if(!host)return; const g=id=>document.getElementById(id);
      for(const k of ['A','B','C']){ const s=HYD.sys[k], pct=Math.round(s.press*100);
        if(g('hf_'+k)){g('hf_'+k).style.height=pct+'%';g('hf_'+k).classList.toggle('lo',s.press<0.5);}
        if(g('hp_'+k))g('hp_'+k).textContent=Math.round(s.press*3000);   // psi 显示(满压 3000)
        const pb=host.querySelector('[data-hpump="'+k+'"]'); if(pb)pb.classList.toggle('on',s.pump);
      }
    },
  });
}
