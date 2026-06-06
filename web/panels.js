"use strict";
//==================================================================
// PANELS — 面板框架(PanelFramework)  ·  独立模块
//   驾驶舱式可切换面板,注册即生效 → 支持数十种面板(引擎/燃油/液压/电气/MCDU…)。
//   register(id,{label,build,wire,sync}) → 选择器自动出 tab;open/close 切换。
//   依赖 game.js/engines.js 运行期全局。SYS.panels 开关过滤可见性。
//==================================================================
const PANELS={
  reg:{}, order:[], current:null, host:null, bar:null,
  register(id,def){ if(!this.reg[id]){this.reg[id]=def;this.order.push(id);} return this; },
  init(){
    this.host=document.getElementById('panelHost');
    this.bar=document.getElementById('panelBar');
    this.buildBar();
  },
  buildBar(){
    if(!this.bar)return;
    let h='<div class="ptab on" data-panel="__flight">飞行</div>';
    for(const id of this.order){
      if(typeof SYS!=='undefined'&&SYS.panels[id]&&!SYS.get('panels',id))continue;  // 面板可开关
      h+='<div class="ptab" data-panel="'+id+'">'+(this.reg[id].label||id)+'</div>';
    }
    this.bar.innerHTML=h;
    this.bar.querySelectorAll('.ptab').forEach(t=>t.addEventListener('click',()=>{
      const p=t.dataset.panel; p==='__flight'?this.close():this.open(p);
    }));
  },
  open(id){
    const def=this.reg[id]; if(!def||!this.host)return;
    this.current=id;
    if(def.build)this.host.innerHTML=def.build();
    if(def.wire)def.wire(this.host);
    if(def.sync)def.sync(this.host);
    this.host.classList.add('show');
    if(this.bar)this.bar.querySelectorAll('.ptab').forEach(t=>t.classList.toggle('on',t.dataset.panel===id));
  },
  close(){
    this.current=null;
    if(this.host)this.host.classList.remove('show');
    if(this.bar)this.bar.querySelectorAll('.ptab').forEach(t=>t.classList.toggle('on',t.dataset.panel==='__flight'));
  },
  // 每帧由主循环调用:刷新当前面板读数(仅当前面板,开销小)
  sync(){ const d=this.current&&this.reg[this.current]; if(d&&d.sync)d.sync(this.host); },
};

//------------------ 引擎 / 燃油系统面板(首个注册面板) ------------------
// 按钮真连动 engines.js 状态机:CUTOFF 断油停车 / STARTER+IGN 启动序列 / FIRE 灭火手柄
PANELS.register('engine',{
  label:'引擎',
  build(){
    if(typeof ENGINES==='undefined')return '<div class="syspanel"><div class="sp-title">引擎面板</div></div>';
    let h='<div class="syspanel"><div class="sp-title">引擎 / 燃油系统 · '+ENGINES.count+' 发</div><div class="eng-grid eng-'+ENGINES.count+'">';
    for(const e of ENGINES.list){
      const i=e.id-1;
      h+='<div class="eng-col" data-eng="'+i+'">'
        +'<div class="eng-hd">ENG '+e.id+'</div>'
        +'<div class="eng-state" id="estate'+e.id+'">--</div>'
        +'<div class="eng-gauges">'
          +'<div>N1<b id="eN1'+e.id+'">0</b></div><div>N2<b id="eN2'+e.id+'">0</b></div>'
          +'<div>EGT<b id="eEGT'+e.id+'">0</b></div><div>FF<b id="eFF'+e.id+'">0</b></div>'
        +'</div>'
        +'<button class="eng-btn" data-act="starter">起动机</button>'
        +'<button class="eng-btn" data-act="ign">点火 IGN</button>'
        +'<button class="eng-btn cut" data-act="cutoff">断油 CUTOFF</button>'
        +'<button class="eng-btn fire" data-act="fire">灭火手柄</button>'
        +'<button class="eng-btn" data-act="pump">燃油泵</button>'
        +'</div>';
    }
    h+='</div><div class="sp-hint">启动序列:CUTOFF 关 → STARTER → IGN,N2 起转点火至慢车。FIRE 拉手柄断油灭火。</div></div>';
    return h;
  },
  wire(host){
    if(typeof ENGINES==='undefined')return;
    host.querySelectorAll('.eng-col').forEach(col=>{
      const i=+col.dataset.eng;
      col.querySelectorAll('.eng-btn').forEach(btn=>btn.addEventListener('click',()=>{
        const e=ENGINES.list[i]; if(!e)return;
        switch(btn.dataset.act){
          case 'cutoff': e.fuelCut=!e.fuelCut; if(e.fuelCut){e.starter=false;e.ign=false;} break;
          case 'starter': e.starter=!e.starter; break;
          case 'ign': e.ign=!e.ign; break;
          case 'fire': e.fire=false; e.fuelCut=true; e.starter=false; e.ign=false; break;  // 拉灭火手柄=断油停车灭火
          case 'pump': e.pump=!e.pump; break;
        }
        this.sync(host);
      }));
    });
  },
  sync(host){
    if(typeof ENGINES==='undefined'||!host)return;
    const g=id=>document.getElementById(id);
    for(const e of ENGINES.list){
      const st=g('estate'+e.id); if(st){st.textContent=e.state.toUpperCase();st.className='eng-state s-'+e.state;}
      if(g('eN1'+e.id))g('eN1'+e.id).textContent=Math.round(e.n1*100);
      if(g('eN2'+e.id))g('eN2'+e.id).textContent=Math.round(e.n2*100);
      if(g('eEGT'+e.id))g('eEGT'+e.id).textContent=Math.round(e.egt);
      if(g('eFF'+e.id))g('eFF'+e.id).textContent=e.ff.toFixed(1);
      const col=host.querySelector('.eng-col[data-eng="'+(e.id-1)+'"]'); if(!col)continue;
      const set=(act,on)=>{const b=col.querySelector('[data-act='+act+']');if(b)b.classList.toggle('on',on);};
      set('cutoff',e.fuelCut); set('starter',e.starter); set('ign',e.ign); set('fire',e.fire); set('pump',e.pump!==false);
    }
  },
});
if(typeof window!=='undefined')window.PANELS=PANELS;
