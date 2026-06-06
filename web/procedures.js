"use strict";
//==================================================================
// PROC — SID/STAR 程序进近(组19 Tick5,收尾)
//   多机场标准进场程序(STAR)库,各含程序点序列(含高度/速度限制)。
//   选择激活→把程序点并入 WPTS(原地改,保留基线可还原),FPLN/ND 自动显示
//   (WPTS 读 id/z 不破坏现有渲染;altLim/spdLim 旁挂字段供 ND/FPLN 增显)。
//   依赖运行期全局:WPTS/CONFIG/RWY。高密度选择面板,手机零横滚。
//==================================================================
const PROC={
  label:'程序/PROC',
  active:{airport:null,proc:null}, _base:null,
  lib:{
    vega:[
      {id:'VEGA1A',name:'VEGA1A 进场',legs:[
        {id:'TONLA',z:-16000,altLim:'6000',spdLim:'250'},
        {id:'BERIK',z:-12500,altLim:'4000',spdLim:'220'},
        {id:'VEGAS',z:-9000, altLim:'3000',spdLim:'210'}]},
      {id:'VEGA2B',name:'VEGA2B 进场',legs:[
        {id:'KONDA',z:-14000,altLim:'5000',spdLim:'240'},
        {id:'VEGAS',z:-9000, altLim:'3000',spdLim:'210'}]},
    ],
    alps:[ {id:'ALPS1C',name:'ALPS1C 进场',legs:[
        {id:'MTREK',z:-15000,altLim:'9000',spdLim:'230'},
        {id:'ALPER',z:-9000, altLim:'6000',spdLim:'200'}]} ],
    coast:[ {id:'COAS3',name:'COAST3 进场',legs:[
        {id:'SEAGL',z:-17000,altLim:'7000',spdLim:'250'},
        {id:'COAST',z:-10500,altLim:'4000',spdLim:'220'}]} ],
    island:[ {id:'ISLE1',name:'ISLE1 进场',legs:[
        {id:'PALMS',z:-13000,altLim:'5000',spdLim:'230'},
        {id:'ISLEX',z:-8200, altLim:'2500',spdLim:'200'}]} ],
  },
  _aptKey(){ return (typeof CONFIG!=='undefined'&&CONFIG.airport)?CONFIG.airport:'vega'; },
  list(){ return this.lib[this._aptKey()]||[]; },

  select(procId){
    const proc=this.list().find(p=>p.id===procId); if(!proc||typeof WPTS==='undefined')return;
    if(!this._base)this._base=WPTS.map(w=>({id:w.id,z:w.z}));          // 首次存机场基线航路
    const lastZ=proc.legs[proc.legs.length-1].z;
    const tail=this._base.filter(w=>w.z>lastZ);                         // 保留比程序末点更近的点(FAF/RW)
    const merged=proc.legs.map(l=>({id:l.id,z:l.z,altLim:l.altLim,spdLim:l.spdLim})).concat(tail);
    merged.sort((a,b)=>a.z-b.z);
    WPTS.length=0; for(const w of merged)WPTS.push(w);
    this.active={airport:this._aptKey(),proc:procId};
  },
  clear(){ if(this._base&&typeof WPTS!=='undefined'){ WPTS.length=0; for(const w of this._base)WPTS.push(w); } this._base=null; this.active={airport:null,proc:null}; },

  //------------------ 程序选择面板 ------------------
  render(host){
    if(!host)return; const sc=host.querySelector('#procScreen'); if(!sc)return;
    const apt=this._aptKey(), procs=this.list();
    const sig=apt+'|'+this.active.proc; if(sig===this._sig)return; this._sig=sig;   // 缓存:机场/激活程序不变不重建
    let h='<div class="proc-apt">当前机场 '+(typeof RWY!=='undefined'?RWY.aptName:apt)+' · STAR 进场程序</div><div class="proc-list">';
    if(!procs.length){ h+='<div class="proc-empty">该机场暂无程序</div>'; }
    for(const p of procs){ const on=this.active.proc===p.id;
      h+='<div class="proc-card '+(on?'on':'')+'" data-proc="'+p.id+'"><div class="proc-hd"><b>'+p.id+'</b>'+(on?'<span class="proc-act">激活</span>':'')+'</div>'
        +'<div class="proc-legs">'+p.legs.map(l=>l.id+' <small>'+l.altLim+'/'+l.spdLim+'</small>').join(' › ')+'</div></div>'; }
    h+='</div>';
    if(this.active.proc)h+='<div class="proc-ctl"><button class="proc-clr" id="procClr">清除程序(还原直飞)</button></div>';
    sc.innerHTML=h;
  },
  build(){
    return '<div class="syspanel"><div class="sp-title">SID/STAR 程序进近</div>'
      +'<div class="proc-screen" id="procScreen"></div>'
      +'<div class="sp-hint">选择标准进场程序(STAR):激活后程序点(含高度/速度限制)并入航路,在 MCDU F-PLN 与 ND 显示。换机场后程序随之更新。</div></div>';
  },
  wire(host){
    const self=this;
    host.querySelector('#procScreen').addEventListener('click',e=>{
      const card=e.target.closest('[data-proc]'); if(card){ self.select(card.dataset.proc); self._sig=null; self.render(host); return; }
      if(e.target.id==='procClr'){ self.clear(); self._sig=null; self.render(host); }
    });
    this._sig=null; this.render(host);
  },
  sync(host){ /* 程序为选择态,非逐帧;切机场时由再开面板刷新 */ this.render(host); },
};

if(typeof PANELS!=='undefined')PANELS.register('proc',PROC);
if(typeof window!=='undefined')window.PROC=PROC;
