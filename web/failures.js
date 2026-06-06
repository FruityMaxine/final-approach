"use strict";
//==================================================================
// FAILURES — 故障核心系统  ·  独立模块
//   故障注册表:每种故障 {id,sys,msg,level,active,trigger(),clear(),step()}。
//   手动触发/解除 + SYS.failures 双向联动。step(dt) 推进连锁(Tick3-5 填充各故障逻辑)。
//   注册 ECAM 故障面板(PANELS 第 3 面板)。依赖 engines/fuel 等运行期全局。
//==================================================================
const FAILURES={
  reg:{}, order:[],
  register(id,def){
    if(!this.reg[id]){
      this.reg[id]={id,sys:def.sys||'SYS',msg:def.msg||id,level:def.level||'caution',
                    active:false,_t:0,trigger:def.trigger||null,clear:def.clear||null,step:def.step||null};
      this.order.push(id);
    }
    return this;
  },
  trigger(id){ const f=this.reg[id]; if(f&&!f.active){ f.active=true; f._t=0; if(f.trigger)f.trigger(); if(typeof SYS!=='undefined')SYS.set('failures',id,true); } },
  clear(id){ const f=this.reg[id]; if(f&&f.active){ f.active=false; if(f.clear)f.clear(); if(typeof SYS!=='undefined')SYS.set('failures',id,false); } },
  toggle(id){ const f=this.reg[id]; if(!f)return; f.active?this.clear(id):this.trigger(id); },
  activeList(){ return this.order.map(id=>this.reg[id]).filter(f=>f.active); },
  hasWarning(){ return this.activeList().some(f=>f.level==='warning'); },
  hasCaution(){ return this.activeList().some(f=>f.level==='caution'); },
  step(dt){
    // SYS.failures → FAILURES 同步(总控面板/外部置位时反应)
    if(typeof SYS!=='undefined')for(const id of this.order){
      const on=SYS.get('failures',id);
      if(on!==this.reg[id].active){ on?this.trigger(id):this.clear(id); }
    }
    // 各故障自身连锁推进(Tick3-5 填 step)
    for(const id of this.order){ const f=this.reg[id]; if(f.active){ f._t+=dt; if(f.step)f.step(dt,f); } }
  },
};

// —— 登记 6 种故障(本 tick:引擎类接 engines 验证连锁可行;余留 Tick3-5 填逻辑) ——
function _eng0(){ return (typeof ENGINES!=='undefined'&&ENGINES.list.length)?ENGINES.list[0]:null; }
FAILURES.register('engineFire',{ sys:'ENG', msg:'ENG 1 FIRE', level:'warning',
  trigger(){ const e=_eng0(); if(e){e.fire=true;e.fireDmg=0;} },
  clear(){ const e=_eng0(); if(e)e.fire=false; },
  step(dt,f){ // 久烧不灭 → 蔓延邻发(15s 后)
    const e=_eng0(); if(!e)return;
    if((e.fireDmg||0)>15 && typeof ENGINES!=='undefined' && ENGINES.list[1] && !ENGINES.list[1].fire){
      ENGINES.list[1].fire=true; f.msg='ENG 1+2 FIRE';
    }
  }});
FAILURES.register('engineFail',{ sys:'ENG', msg:'ENG 1 FAIL', level:'warning',
  trigger(){ if(typeof ENGINES!=='undefined')ENGINES.failEngine(0,true); },
  clear(){ if(typeof ENGINES!=='undefined')ENGINES.failEngine(0,false); } });
FAILURES.register('fuelLeak', { sys:'FUEL', msg:'FUEL LEAK', level:'caution',
  trigger(){ if(typeof FUEL!=='undefined')FUEL.tanks.left.leak=10; },          // 左箱 10kg/s 漏
  clear(){ if(typeof FUEL!=='undefined')FUEL.tanks.left.leak=0; },
  step(dt,f){ // 总油量低 → 升级为 warning
    if(typeof FUEL!=='undefined'){ f.level=FUEL.total()<2500?'warning':'caution'; f.msg=FUEL.total()<2500?'FUEL LOW · LEAK':'FUEL LEAK'; }
  }});
FAILURES.register('hydFail',  { sys:'HYD',  msg:'HYD LO PR',  level:'caution' });   // Tick4 填液压
FAILURES.register('elecFail', { sys:'ELEC', msg:'ELEC FAULT', level:'caution' });   // Tick5 填电气
FAILURES.register('tireBurst',{ sys:'GEAR', msg:'R TIRE BURST',level:'caution' });  // Tick5 填爆胎

if(typeof window!=='undefined')window.FAILURES=FAILURES;

//------------------ ECAM 故障面板(PANELS 第 3 个注册面板) ------------------
if(typeof PANELS!=='undefined'){
  PANELS.register('failures',{
    label:'故障',
    build(){
      let h='<div class="syspanel"><div class="sp-title">故障注入 / ECAM 告警</div><div class="fail-grid">';
      for(const id of FAILURES.order){ const f=FAILURES.reg[id];
        h+='<button class="eng-btn fail-btn '+f.level+'" data-fail="'+id+'">'+f.msg+'<span class="fsys">'+f.sys+'</span></button>';
      }
      h+='</div><div class="ecam-hd">ECAM 告警</div><div class="ecam-list" id="ecamList"></div>'
        +'<div class="sp-hint">点故障按钮手动触发/解除。warning 级红+主警告音,caution 级琥珀。后续 tick 补全各故障连锁影响。</div></div>';
      return h;
    },
    wire(host){ host.querySelectorAll('[data-fail]').forEach(b=>b.addEventListener('click',()=>{ FAILURES.toggle(b.dataset.fail); this.sync(host); })); },
    sync(host){
      if(!host)return;
      for(const id of FAILURES.order){ const b=host.querySelector('[data-fail="'+id+'"]'); if(b)b.classList.toggle('on',FAILURES.reg[id].active); }
      const list=document.getElementById('ecamList'); if(!list)return;
      const a=FAILURES.activeList();
      list.innerHTML=a.length? a.map(f=>'<div class="ecam-msg '+f.level+'">'+f.msg+'</div>').join('') : '<div class="ecam-ok">NORMAL · NO MESSAGES</div>';
    },
  });
}
