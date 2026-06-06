"use strict";
//==================================================================
// MISSIONS — 任务关卡链 + 挑战解锁(组20 Tick5,收尾)
//   6 关挑战链:选关→注入 CONFIG(难度/机型/机场/天气/风/故障)+ 重置开始;
//   着陆评分达标→通关 + 解锁下一关(localStorage 持久化)。
//   区别于 tutorial(单次分步引导)/scenario(单次故障处置):这是跨飞行的
//   关卡进度系统。依赖运行期全局:CONFIG/applyConfig/applyAircraft/applyAirport/
//   doReset/startFlight/WEATHER/FAILURES。高密度关卡链面板,手机零横滚。
//==================================================================
const MISSIONS={
  label:'任务/MISSION',
  KEY:'fa.missions', activeIdx:null, progress:{unlockedUpTo:0,cleared:[]}, _sig:null,
  defs:[
    {id:'std',   name:'1 · 标准着陆',   desc:'晴天·窄体·维加,稳定进近',     target:70, cfg:{diff:'real',aircraft:'narrow',airport:'vega',weather:'clear',windDir:280,windSpeed:6}},
    {id:'xwind', name:'2 · 侧风着陆',   desc:'强侧风 18kt,蹬舵 decrab',     target:65, cfg:{diff:'real',aircraft:'narrow',airport:'vega',weather:'clear',windDir:0,  windSpeed:18}},
    {id:'imc',   name:'3 · 低能见 IMC', desc:'仪表气象 1.5km,云中进近',     target:60, cfg:{diff:'real',aircraft:'narrow',airport:'vega',weather:'imc',  windDir:280,windSpeed:8}},
    {id:'engf',  name:'4 · 单发进近',   desc:'发动机失效,不对称推力',       target:55, cfg:{diff:'real',aircraft:'narrow',airport:'vega',weather:'clear',windDir:280,windSpeed:8,failure:'engineFail'}},
    {id:'wshr',  name:'5 · 风切变',     desc:'微下击暴流,果断处置',         target:50, cfg:{diff:'hard',aircraft:'narrow',airport:'vega',weather:'clear',windDir:280,windSpeed:10,microburst:true}},
    {id:'cargo', name:'6 · 满载短跑道', desc:'货机·海岛短跑道,重着陆挑战',   target:60, cfg:{diff:'real',aircraft:'cargo', airport:'island',weather:'clear',windDir:50, windSpeed:8}},
  ],

  load(){ try{ const v=JSON.parse(localStorage.getItem(this.KEY)||'null'); if(v&&typeof v==='object'){ this.progress.unlockedUpTo=v.unlockedUpTo|0; this.progress.cleared=Array.isArray(v.cleared)?v.cleared:[]; } }catch(_){} },
  save(){ try{ localStorage.setItem(this.KEY,JSON.stringify(this.progress)); }catch(_){} },
  unlocked(i){ return i<=this.progress.unlockedUpTo; },
  isCleared(i){ return this.progress.cleared.indexOf(i)>=0; },

  start(idx){
    if(idx<0||idx>=this.defs.length||!this.unlocked(idx))return false;
    const c=this.defs[idx].cfg; this.activeIdx=idx;
    if(typeof CONFIG!=='undefined'){ CONFIG.diff=c.diff;CONFIG.aircraft=c.aircraft;CONFIG.airport=c.airport;CONFIG.weather=c.weather;CONFIG.windDir=c.windDir;CONFIG.windSpeed=c.windSpeed; }
    if(typeof applyDifficulty==='function')applyDifficulty(c.diff);
    if(typeof applyAircraft==='function')applyAircraft(c.aircraft);
    if(typeof applyAirport==='function')applyAirport(c.airport);
    if(typeof applyConfig==='function')applyConfig();
    if(typeof doReset==='function')doReset(); else if(typeof resetState==='function')resetState();
    if(typeof startFlight==='function')startFlight();
    // 故障 / 风切变 注入
    if(c.failure&&typeof FAILURES!=='undefined')setTimeout(()=>{ if(this.activeIdx===idx)FAILURES.trigger(c.failure); },1200);
    if(c.microburst&&typeof WEATHER!=='undefined'&&WEATHER.triggerMicroburst)setTimeout(()=>{ if(this.activeIdx===idx)WEATHER.triggerMicroburst(); },1500);
    this._sig=null; return true;
  },
  // 着陆评分回调:达标→通关 + 解锁下一关
  onLanding(score){
    if(this.activeIdx==null)return; const i=this.activeIdx, m=this.defs[i];
    if((score|0)>=m.target){
      if(this.progress.cleared.indexOf(i)<0)this.progress.cleared.push(i);
      if(i>=this.progress.unlockedUpTo&&i+1<this.defs.length)this.progress.unlockedUpTo=i+1;
      this.save();
    }
    this._sig=null;
  },

  //------------------ 关卡链面板 ------------------
  render(host){
    if(!host)return; const sc=host.querySelector('#msnScreen'); if(!sc)return;
    const sig=this.activeIdx+'|'+this.progress.unlockedUpTo+'|'+this.progress.cleared.join(','); if(sig===this._sig)return; this._sig=sig;
    let h='<div class="msn-prog">进度 '+this.progress.cleared.length+' / '+this.defs.length+' 关通过</div><div class="msn-list">';
    this.defs.forEach((m,i)=>{ const cl=this.isCleared(i), un=this.unlocked(i), cur=this.activeIdx===i;
      const st=cl?'done':(un?'open':'lock');
      h+='<div class="msn-card '+st+(cur?' cur':'')+'"><div class="msn-hd"><b>'+m.name+'</b>'
        +'<span class="msn-badge">'+(cl?'通过':(un?'目标 '+m.target:'锁定'))+'</span></div>'
        +'<div class="msn-desc">'+m.desc+'</div>'
        +(un?'<button class="msn-go" data-msn="'+i+'">'+(cl?'重玩':'开始挑战')+'</button>':'<div class="msn-locked">完成上一关解锁</div>')
        +'</div>'; });
    sc.innerHTML=h+'</div>';
  },
  build(){
    return '<div class="syspanel"><div class="sp-title">任务关卡 · 挑战链</div><div class="msn-screen" id="msnScreen"></div>'
      +'<div class="sp-hint">逐关挑战(标准→侧风→IMC→单发→风切变→满载短跑道):选关自动配置天气/机型/机场/故障并开始;着陆评分达标即通关、解锁下一关。进度本地保存。</div></div>';
  },
  wire(host){
    const self=this;
    host.querySelector('#msnScreen').addEventListener('click',e=>{
      const b=e.target.closest('[data-msn]'); if(b){ self.start(+b.dataset.msn); self._sig=null; self.render(host); }
    });
    this._sig=null; this.render(host);
  },
  sync(host){ this.render(host); },
};
MISSIONS.load();

if(typeof PANELS!=='undefined')PANELS.register('msn',MISSIONS);
if(typeof window!=='undefined')window.MISSIONS=MISSIONS;
