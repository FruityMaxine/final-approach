"use strict";
//==================================================================
// ATC — 空管语音通信 + 无线电面板(组17 Tick3)
//   指令状态机:按 S.phase/alt/距阈触发塔台指令序列(每条一次,防重发),
//   Sound.say 语音播报 + 消息日志;玩家应答按钮(WILCO/ROGER/SAY AGAIN)。
//   依赖运行期全局:S/RWY/CONFIG/WIND/M_TO_FT/MS_TO_KT/Sound/showCallout/getC。
//   手机零横向溢出:日志 flex 纵列自动换行,应答按钮 flex-wrap。
//==================================================================
const ATC={
  label:'无线电/ATC',
  freq:'118.70',
  log:[], fired:{}, awaiting:null, _el:0, _lastLen:-1,

  reset(){ this.log=[]; this.fired={}; this.awaiting=null; this._el=0; this._lastLen=-1; },
  _stamp(){ const s=Math.floor(this._el); return 'T+'+String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'); },
  _wind(){ const d=(typeof CONFIG!=='undefined')?CONFIG.windDir:280, v=(typeof CONFIG!=='undefined')?CONFIG.windSpeed:8;
    return String(d).padStart(3,'0')+'/'+String(v).padStart(2,'0'); },
  _rwy(){ return (typeof RWY!=='undefined'&&RWY.name)?RWY.name:'27'; },

  push(who,msg){ this.log.push({who,msg,t:this._stamp()}); if(this.log.length>40)this.log.shift(); },
  // 塔台发话(去抖:每 key 一次)+ 语音 + 主回调闪烁 + 置应答待命
  say(key,msg,voice){
    if(this.fired[key])return; this.fired[key]=1;
    this.push('ATC',msg);
    if(typeof Sound!=='undefined'&&Sound.say)Sound.say(voice||msg);
    if(typeof showCallout==='function'&&typeof getC==='function')showCallout('ATC',getC('--cyan'));
    this.awaiting=key;
  },
  // 玩家应答
  reply(kind){
    if(kind==='SAY AGAIN'){ this.push('YOU','say again'); if(typeof Sound!=='undefined'&&Sound.say)Sound.say('say again'); return; }
    this.push('YOU',kind.toLowerCase());
    if(typeof Sound!=='undefined'&&Sound.blip)Sound.blip(440,0.05);
    this.awaiting=null;
  },

  // 逐帧推进:按飞行阶段触发指令
  step(S,dt){
    if(!S||!S.started)return;
    this._el+=(dt||0.016);
    const altft=S.alt*M_TO_FT, rwy=this._rwy(), wind=this._wind(), dist=Math.max(0,(-S.z)/1852);
    if(S.phase==='ended')return;
    // 进场放行(开局)
    if(!this.fired.clr) this.say('clr','维加塔台:cleared to land runway '+rwy+', wind '+wind, 'cleared to land runway '+rwy+', wind '+wind);
    // 进近继续(报距离)
    if(altft<1500 && !this.fired.cont) this.say('cont','continue approach, '+dist.toFixed(1)+' miles to touchdown', 'continue approach');
    // 风报更新(中段)
    if(altft<800 && !this.fired.wind2) this.say('wind2','wind check '+wind, 'wind '+wind);
    // 落地许可(短五边)
    if(altft<400 && !this.fired.land) this.say('land','check gear down, cleared to land runway '+rwy, 'check gear down, cleared to land');
    // 复飞指令(EMMA/玩家复飞)
    if(S.phase==='goaround' && !this.fired.ga) this.say('ga','go around, fly runway heading, climb three thousand', 'go around, fly runway heading');
    // 脱离跑道(落地滑行)
    if(S.onGround && S.V*MS_TO_KT<40 && !this.fired.exit) this.say('exit','welcome, vacate runway when able, contact ground 121.9', 'vacate runway when able');
  },

  //------------------ 无线电/ATC 面板 ------------------
  build(){
    return '<div class="syspanel"><div class="sp-title">无线电 / ATC 通信</div>'
      +'<div class="atc-freq">TWR <b>'+this.freq+'</b> · CALLSIGN <b>FA0727</b></div>'
      +'<div class="atc-log" id="atcLog"></div>'
      +'<div class="atc-reply">'
      +'<button class="atc-btn" data-rep="WILCO">WILCO</button>'
      +'<button class="atc-btn" data-rep="ROGER">ROGER</button>'
      +'<button class="atc-btn" data-rep="SAY AGAIN">SAY AGAIN</button>'
      +'</div>'
      +'<div class="sp-hint">塔台按进近阶段自动发指令(放行 / 继续 / 风报 / 落地许可 / 复飞 / 脱离),并语音播报。收到指令后点 WILCO / ROGER 回报,听不清点 SAY AGAIN。</div></div>';
  },
  wire(host){
    const self=this;
    host.querySelectorAll('[data-rep]').forEach(b=>b.addEventListener('click',()=>{ self.reply(b.dataset.rep); self._lastLen=-1; self.sync(host); }));
    this._lastLen=-1; this.sync(host);
  },
  sync(host){
    if(!host)return;
    if(this.log.length===this._lastLen)return;       // 仅日志变化时重绘
    this._lastLen=this.log.length;
    const el=host.querySelector('#atcLog'); if(!el)return;
    el.innerHTML=this.log.length
      ? this.log.map(m=>'<div class="atc-msg '+(m.who==='ATC'?'atc':'you')+'"><span class="atc-t">'+m.t+'</span>'
          +'<span class="atc-who">'+m.who+'</span><span class="atc-tx">'+m.msg+'</span></div>').join('')
      : '<div class="atc-empty">建立进近后,塔台指令将在此显示。</div>';
    el.scrollTop=el.scrollHeight;                     // 滚到底
  },
};

if(typeof PANELS!=='undefined')PANELS.register('atc',ATC);
if(typeof window!=='undefined')window.ATC=ATC;
