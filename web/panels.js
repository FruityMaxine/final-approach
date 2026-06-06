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
    const con=document.getElementById('console'); if(con)con.classList.add('panel-open');   // 面板打开→仪表区增高给面板腾空间(飞行视野仍在上方)
    if(this.bar)this.bar.querySelectorAll('.ptab').forEach(t=>t.classList.toggle('on',t.dataset.panel===id));
  },
  close(){
    this.current=null;
    if(this.host)this.host.classList.remove('show');
    const con=document.getElementById('console'); if(con)con.classList.remove('panel-open');
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
        +'<div class="eng-top"><span class="eng-hd">ENG '+e.id+'</span><span class="eng-state" id="estate'+e.id+'">--</span></div>'
        +'<div class="eng-n1"><div class="eng-n1bar"><i class="eng-n1fill" id="eN1f'+e.id+'"></i></div>'
          +'<div class="eng-n1v"><b id="eN1'+e.id+'">0</b><span>N1%</span></div></div>'
        +'<div class="eng-rd">'
          +'<div class="erd"><span>N2</span><b id="eN2'+e.id+'">0</b></div>'
          +'<div class="erd"><span>EGT</span><b id="eEGT'+e.id+'">0</b></div>'
          +'<div class="erd"><span>FF</span><b id="eFF'+e.id+'">0</b></div>'
          +'<div class="erd"><span>OIL P</span><b id="eOP'+e.id+'">0</b></div>'
          +'<div class="erd"><span>OIL T</span><b id="eOT'+e.id+'">0</b></div>'
          +'<div class="erd"><span>VIB</span><b id="eVB'+e.id+'">0</b></div>'
        +'</div>'
        +'<div class="eng-ctl">'
          +'<button class="echip" data-act="starter" title="起动机 STARTER">STR</button>'
          +'<button class="echip" data-act="ign" title="点火 IGNITION">IGN</button>'
          +'<button class="echip cut" data-act="cutoff" title="断油 CUTOFF">CUT</button>'
          +'<button class="echip fire" data-act="fire" title="灭火手柄 FIRE">FIRE</button>'
          +'<button class="echip" data-act="pump" title="燃油泵 PUMP">PMP</button>'
        +'</div></div>';
    }
    h+='</div><div class="sp-hint">N1 为主推力。启动:CUT 关→STR→IGN,N2 起转点火至慢车;FIRE 拉手柄断油灭火。EGT 超 850 转红。</div></div>';
    return h;
  },
  wire(host){
    if(typeof ENGINES==='undefined')return;
    host.querySelectorAll('.eng-col').forEach(col=>{
      const i=+col.dataset.eng;
      col.querySelectorAll('.echip').forEach(btn=>btn.addEventListener('click',()=>{
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
      const f=g('eN1f'+e.id); if(f)f.style.width=Math.max(0,Math.min(100,e.n1*100))+'%';
      if(g('eN1'+e.id))g('eN1'+e.id).textContent=Math.round(e.n1*100);
      if(g('eN2'+e.id))g('eN2'+e.id).textContent=Math.round(e.n2*100);
      if(g('eEGT'+e.id)){g('eEGT'+e.id).textContent=Math.round(e.egt);g('eEGT'+e.id).classList.toggle('hot',e.egt>850);}
      if(g('eFF'+e.id))g('eFF'+e.id).textContent=e.ff.toFixed(1);
      if(g('eOP'+e.id))g('eOP'+e.id).textContent=Math.round(e.n2*78+8);      // 滑油压(派生 n2)
      if(g('eOT'+e.id))g('eOT'+e.id).textContent=Math.round(60+e.egt*0.11);  // 滑油温(派生 egt)
      if(g('eVB'+e.id))g('eVB'+e.id).textContent=(e.fire?4.8:e.n1*0.7).toFixed(1);  // 振动
      const col=host.querySelector('.eng-col[data-eng="'+(e.id-1)+'"]'); if(!col)continue;
      const set=(act,on)=>{const b=col.querySelector('[data-act='+act+']');if(b)b.classList.toggle('on',on);};
      set('cutoff',e.fuelCut); set('starter',e.starter); set('ign',e.ign); set('fire',e.fire); set('pump',e.pump!==false);
    }
  },
});
if(typeof window!=='undefined')window.PANELS=PANELS;
