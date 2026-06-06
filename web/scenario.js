"use strict";
//==================================================================
// SCENARIO — 故障情景训练 + 处置评分(组18 Tick5,收尾)
//   预设剧本:按高度注入故障(起火/失效/液压/风切变),监测玩家处置
//   (正确动作 + 响应时间),情景结束给评分 + debrief 时间线。
//   依赖运行期全局:S/ENGINES/FAILURES/WEATHER/SYS/M_TO_FT。手机零横滚。
//==================================================================
const SCENARIO={
  label:'训练情景',
  active:null, t:0, injected:false, _handled:false, _injT:0, _rt:0, score:null, events:[], _sig:null,
  DEFS:[
    {id:'engfire',  name:'发动机起火', desc:'短五边发动机起火,拉灭火手柄断油灭火', injAlt:700, action:'拉灭火手柄(断油)灭火',
      inject(){ if(typeof FAILURES!=='undefined')FAILURES.trigger('engineFire'); },
      correct(S){ return !!(typeof ENGINES!=='undefined'&&ENGINES.list[0]&&ENGINES.list[0].fuelCut); }},
    {id:'engfail',  name:'单发失效',   desc:'进近单发失效,蹬舵保向 / 评估复飞', injAlt:700, action:'蹬舵修向 / 评估复飞',
      inject(){ if(typeof FAILURES!=='undefined')FAILURES.trigger('engineFail'); },
      correct(S){ return Math.abs(S.rudder)>0.15||S.phase==='goaround'; }},
    {id:'hydfail',  name:'液压全失',   desc:'液压 A 失压,操纵沉重,加着陆余量', injAlt:900, action:'确认构型 / 加余量 / 必要复飞',
      inject(){ if(typeof FAILURES!=='undefined')FAILURES.trigger('hydFail'); },
      correct(S){ return S.phase==='goaround'||(S.gearDown&&S.flaps>=2); }},
    {id:'windshear',name:'风切变进近', desc:'微下击暴流,果断 TOGA 复飞', injAlt:600, action:'TOGA 推力 / 复飞',
      inject(){ if(typeof WEATHER!=='undefined'&&WEATHER.triggerMicroburst)WEATHER.triggerMicroburst();
        if(typeof SYS!=='undefined')SYS.set('env','windShear',true); },
      correct(S){ return S.phase==='goaround'||S.throttle>0.85; }},
  ],
  _def(){ return this.DEFS.find(d=>d.id===this.active); },
  _clearAll(){ if(typeof FAILURES!=='undefined')for(const id of ['engineFire','engineFail','hydFail'])FAILURES.clear(id); },

  reset(){ this.active=null;this.t=0;this.injected=false;this._handled=false;this._injT=0;this._rt=0;this.score=null;this.events=[];this._sig=null; },
  start(id){ if(!this.DEFS.find(d=>d.id===id))return; this._clearAll();
    this.active=id;this.t=0;this.injected=false;this._handled=false;this._injT=0;this._rt=0;this.score=null;
    this.events=[{t:0,txt:'情景开始:'+this._def().name}];this._sig=null; },

  step(S,dt){
    if(!this.active||this.score!=null||typeof S==='undefined'||!S.started)return;
    this.t+=(dt||0.016);
    const d=this._def(); if(!d)return;
    const altft=S.alt*((typeof M_TO_FT!=='undefined')?M_TO_FT:3.281);
    if(!this.injected && altft<d.injAlt){ this.injected=true;this._injT=this.t;d.inject();
      this.events.push({t:this.t,txt:'故障注入:'+d.name}); }
    if(this.injected && !this._handled){ let ok=false; try{ok=d.correct(S);}catch(_){}
      if(ok){ this._handled=true;this._rt=this.t-this._injT;
        this.events.push({t:this.t,txt:'正确处置:'+d.action+'(响应 '+this._rt.toFixed(1)+'s)'}); } }
    if(S.phase==='ended' || (this.injected && this.t-this._injT>60))this._finish(S);
  },
  _finish(S){
    const d=this._def(); let sc=40;
    if(this._handled){ sc+=40; sc+=Math.max(0,20-(this._rt||10)*1.4); }
    else this.events.push({t:this.t,txt:'未正确处置:'+d.action});
    this.score=Math.round(Math.max(0,Math.min(100,sc)));
    this.events.push({t:this.t,txt:'情景结束 · 评分 '+this.score});
  },

  //------------------ 面板 ------------------
  build(){
    let h='<div class="syspanel"><div class="sp-title">故障情景训练</div><div class="scn-list">';
    for(const d of this.DEFS) h+='<button class="scn-card" data-scn="'+d.id+'"><b>'+d.name+'</b><span>'+d.desc+'</span></button>';
    h+='</div><div class="scn-ctl"><button class="scn-stop" id="scnStop">重置 / 退出情景</button></div>'
      +'<div class="scn-status" id="scnStatus"></div>'
      +'<div class="sp-hint">选剧本开始训练:系统在指定高度注入故障,监测你的处置(正确动作 + 响应时间)。情景结束(落地 / 复飞 / 超时)给评分与时间线复盘。</div></div>';
    return h;
  },
  wire(host){
    const self=this;
    host.querySelectorAll('[data-scn]').forEach(b=>b.addEventListener('click',()=>{ self.start(b.dataset.scn); self._sig=null; self.render(host); }));
    const st=host.querySelector('#scnStop'); if(st)st.addEventListener('click',()=>{ self._clearAll(); self.reset(); self._sig=null; self.render(host); });
    this._sig=null; this.render(host);
  },
  render(host){
    if(!host)return; const sc=host.querySelector('#scnStatus'); if(!sc)return;
    const sig=this.active+'|'+this.injected+'|'+this._handled+'|'+this.score+'|'+this.events.length;
    if(sig===this._sig)return; this._sig=sig;
    host.querySelectorAll('[data-scn]').forEach(b=>b.classList.toggle('on',b.dataset.scn===this.active));
    if(!this.active){ sc.innerHTML='<div class="scn-idle">未开始 · 选择上方剧本进入训练</div>'; return; }
    const d=this._def();
    let h='<div class="scn-hd">'+d.name+(this.score!=null?' <span class="scn-score">评分 '+this.score+'</span>':(this.injected?' <span class="scn-live wr">故障中</span>':' <span class="scn-live">就绪</span>'))+'</div>';
    h+='<div class="scn-log">'+this.events.map(e=>'<div class="scn-ev"><span>T+'+e.t.toFixed(1)+'</span>'+e.txt+'</div>').join('')+'</div>';
    if(this.score!=null){ const g=this.score>=80?'优秀':this.score>=60?'合格':'需改进';
      h+='<div class="scn-debrief '+(this.score>=60?'ok':'no')+'">处置评分 '+this.score+' · '+g+(this._handled?' · 已正确处置':' · 未正确处置')+'</div>'; }
    sc.innerHTML=h;
  },
  sync(host){ this.render(host); },   // 逐帧:情景推进 + 时间线刷新
};

if(typeof PANELS!=='undefined')PANELS.register('scn',SCENARIO);
if(typeof window!=='undefined')window.SCENARIO=SCENARIO;
