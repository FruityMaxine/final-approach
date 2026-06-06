"use strict";
//==================================================================
// ECL — 电子检查单(Electronic Checklist)(组18 Tick4)
//   检查单库:正常(进近/着陆/复飞)+ 非正常(ENG FIRE/FAIL/HYD LO)。
//   每项 {t, sense?(S)→bool}:有 sense 的项自动感知(起落架/襟翼/扰流板由 S 自动绿勾),
//   无 sense 的手动点击勾选。按 S.phase/FAILURES.active 自动推荐当前单。完成度进度。
//   依赖运行期全局:S/ENGINES/FAILURES/M_TO_FT。高密度小行,手机零横滚。
//==================================================================
const ECL={
  label:'检查单',
  active:'APPROACH', auto:true, manual:{},
  ORDER:['APPROACH','LANDING','GOAROUND','ENGFIRE','ENGFAIL','HYDLO'],
  lists:{
    APPROACH:{name:'进近 APPROACH',kind:'normal',items:[
      {t:'起落架 …… 放下',sense:s=>s.gearDown},
      {t:'襟翼 …… 进近位',sense:s=>s.flaps>=2},
      {t:'扰流板 …… 预位',sense:s=>s.spoilerArmed},
      {t:'速度 …… 检查',sense:null},
      {t:'进近简令 …… 完成',sense:null}]},
    LANDING:{name:'着陆 LANDING',kind:'normal',items:[
      {t:'起落架 …… 三绿',sense:s=>s.gearDown},
      {t:'襟翼 …… 全 FULL',sense:s=>s.flaps>=4},
      {t:'扰流板 …… 预位',sense:s=>s.spoilerArmed},
      {t:'自动刹车 …… 设置',sense:null},
      {t:'落地许可 …… 收到',sense:null}]},
    GOAROUND:{name:'复飞 GO-AROUND',kind:'normal',items:[
      {t:'推力 …… TOGA',sense:s=>s.throttle>0.8},
      {t:'俯仰 …… 抬头 15°',sense:s=>s.pitch>8},
      {t:'襟翼 …… 收一档',sense:null},
      {t:'起落架 …… 收上',sense:s=>!s.gearDown}]},
    ENGFIRE:{name:'发动机起火 ENG FIRE',kind:'abnormal',items:[
      {t:'推力杆 …… 慢车',sense:null},
      {t:'灭火手柄 …… 拉出',sense:()=>!!(typeof ENGINES!=='undefined'&&ENGINES.list[0]&&ENGINES.list[0].fuelCut)},
      {t:'灭火瓶 …… 火熄',sense:()=>!!(typeof ENGINES!=='undefined'&&ENGINES.list[0]&&!ENGINES.list[0].fire)},
      {t:'考虑尽快落地 …… 决断',sense:null}]},
    ENGFAIL:{name:'发动机失效 ENG FAIL',kind:'abnormal',items:[
      {t:'推力 …… 调整',sense:null},
      {t:'方向 …… 蹬舵修正',sense:null},
      {t:'单发性能 …… 评估',sense:null}]},
    HYDLO:{name:'液压低压 HYD LO',kind:'abnormal',items:[
      {t:'电动泵 …… 检查',sense:null},
      {t:'操纵 …… 注意迟钝',sense:null},
      {t:'着陆距离 …… 加余量',sense:null}]},
  },

  recommend(){
    if(typeof FAILURES!=='undefined'){ const a=FAILURES.activeList();
      if(a.some(f=>f.id==='engineFire'))return 'ENGFIRE';
      if(a.some(f=>f.id==='engineFail'))return 'ENGFAIL';
      if(a.some(f=>f.id==='hydFail'))return 'HYDLO'; }
    if(typeof S!=='undefined'){
      if(S.phase==='goaround')return 'GOAROUND';
      if(S.alt*((typeof M_TO_FT!=='undefined')?M_TO_FT:3.281)<800)return 'LANDING'; }
    return 'APPROACH';
  },
  isDone(li){ const it=this.lists[this.active].items[li]; if(!it)return false;
    if(it.sense){ try{return !!it.sense(S);}catch(_){return false;} }
    return !!this.manual[this.active+':'+li]; },
  toggle(li){ const it=this.lists[this.active].items[li]; if(!it||it.sense)return;  // 自动项不可手动
    const k=this.active+':'+li; this.manual[k]=!this.manual[k]; },

  render(host){
    if(!host)return;
    if(this.auto){ const r=this.recommend(); if(this.lists[r])this.active=r; }
    const L=this.lists[this.active]; const sc=host.querySelector('#eclScreen'); if(!sc)return;
    let done=0; const n=L.items.length;
    // 签名缓存:内容不变则不重建 DOM(避免逐帧重建致元素 detached / 点击失效)
    const sig=this.active+'|'+this.auto+'|'+L.items.map((it,i)=>this.isDone(i)?1:0).join('');
    if(sig===this._sig){ return; } this._sig=sig;
    let rows='';
    L.items.forEach((it,i)=>{ const d=this.isDone(i); if(d)done++;
      rows+='<div class="ecl-item '+(d?'done':'todo')+(it.sense?' auto':' man')+'"'+(it.sense?'':' data-li="'+i+'"')+'>'
        +'<span class="ecl-box"></span><span class="ecl-t">'+it.t+'</span>'
        +'<span class="ecl-tag">'+(it.sense?'AUTO':'')+'</span></div>'; });
    sc.innerHTML='<div class="ecl-hd '+L.kind+'">'+L.name+' <span class="ecl-prog">'+done+'/'+n+'</span></div>'
      +'<div class="ecl-bar"><i style="width:'+Math.round(done/n*100)+'%"></i></div>'
      +'<div class="ecl-list">'+rows+'</div>';
    // tab 高亮 + 自动状态
    host.querySelectorAll('[data-ecl]').forEach(b=>b.classList.toggle('on',b.dataset.ecl===this.active));
    const ab=host.querySelector('#eclAuto'); if(ab)ab.classList.toggle('on',this.auto);
  },
  build(){
    let h='<div class="syspanel"><div class="sp-title">电子检查单 ECL</div><div class="ecl-tabs">';
    h+='<button class="ecl-tab auto" id="eclAuto" data-ecl="__auto">自动</button>';
    for(const id of this.ORDER){ const L=this.lists[id];
      h+='<button class="ecl-tab '+L.kind+'" data-ecl="'+id+'">'+id+'</button>'; }
    h+='</div><div class="ecl-screen" id="eclScreen"></div>'
      +'<div class="sp-hint">AUTO 项由飞机状态自动勾选(起落架/襟翼/扰流板);其余点击勾选。按阶段/故障自动推荐当前单(点单名手动切,点"自动"恢复)。</div></div>';
    return h;
  },
  wire(host){
    const self=this;
    host.querySelectorAll('[data-ecl]').forEach(b=>b.addEventListener('click',()=>{
      if(b.dataset.ecl==='__auto'){ self.auto=true; }
      else { self.auto=false; self.active=b.dataset.ecl; }
      self.render(host);
    }));
    // 手动项勾选(事件委托:点 .ecl-item.man)
    host.querySelector('#eclScreen').addEventListener('click',e=>{
      const row=e.target.closest('.ecl-item.man'); if(row&&row.dataset.li!=null){ self.toggle(+row.dataset.li); self._sig=null; self.render(host); }
    });
    this._sig=null; this.render(host);   // 重开面板:清签名强制首绘
  },
  sync(host){ this.render(host); },   // 逐帧:自动感知项 + 荐单实时刷新
};

if(typeof PANELS!=='undefined')PANELS.register('ecl',ECL);
if(typeof window!=='undefined')window.ECL=ECL;
