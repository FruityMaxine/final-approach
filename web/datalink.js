"use strict";
//==================================================================
// DATALINK — ATIS 自动通播 + CPDLC 数据链(组20 Tick4)
//   ①ATIS:按机场/天气/风/跑道生成终端情报通播文本(信息字母 A-Z 轮替),可语音播报。
//   ②CPDLC:塔台文本数据链报文(上行:放行/高度/移交)+ 玩家文本应答(WILCO/UNABLE/STANDBY)。
//     ★区别于 ATC(atc.js 语音指令):CPDLC 是文本上下行报文,不依赖 Sound.say 语音。
//   依赖运行期全局:RWY/WEATHER/CONFIG/S/M_TO_FT/Sound。高密度 DCDU 面板,手机零横滚。
//==================================================================
const DATALINK={
  label:'数据链/DCDU',
  atis:{ letter:'A', text:'', _idx:0, _last:'' },
  cpdlc:{ log:[], fired:{}, _el:0 },
  _sig:null,

  _windStr(){ const d=(typeof CONFIG!=='undefined')?CONFIG.windDir:280, v=(typeof CONFIG!=='undefined')?CONFIG.windSpeed:8;
    return String(d).padStart(3,'0')+'/'+String(v).padStart(2,'0'); },
  _visStr(){ const v=(typeof WEATHER!=='undefined')?WEATHER.visibility:10000; return v>=9000?'10KM':(v>=1000?(v/1000).toFixed(1)+'KM':v+'M'); },
  _cloudStr(){ const c=(typeof WEATHER!=='undefined')?WEATHER.ceiling:5000; return c<800?'OVC':(c<2000?'BKN':'FEW')+(' '+(c|0)); },
  // 生成 ATIS:天气/风变则推进信息字母
  genATIS(){
    const icao=(typeof RWY!=='undefined'&&RWY.icao)?RWY.icao:'ZVGA', rwy=(typeof RWY!=='undefined'&&RWY.name)?RWY.name:'27';
    const core=this._windStr()+'|'+this._visStr()+'|'+this._cloudStr()+'|'+rwy;
    if(core!==this.atis._last){ this.atis._idx=(this.atis._idx+1)%26; this.atis._last=core; }
    this.atis.letter='ABCDEFGHIJKLMNOPQRSTUVWXYZ'[this.atis._idx];
    this.atis.text=icao+' ATIS 情报 '+this.atis.letter+' · 风 '+this._windStr()+' · 能见度 '+this._visStr()
      +' · 云 '+this._cloudStr()+' · 温度 15/08 · 跑道 '+rwy+' 使用中 · QNH 1013 · 通报情报 '+this.atis.letter;
    return this.atis.text;
  },
  speakATIS(){ this.genATIS(); if(typeof Sound!=='undefined'&&Sound.say)Sound.say(this.atis.text.replace(/·/g,', ')); },

  // CPDLC 上行报文(文本,去抖)
  _up(key,msg){ if(this.cpdlc.fired[key])return; this.cpdlc.fired[key]=1;
    this.cpdlc.log.push({dir:'UP',msg,t:this._stamp()}); },
  _stamp(){ const s=Math.floor(this.cpdlc._el); return 'T+'+String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'); },
  step(S,dt){
    if(!S||!S.started||S.phase==='ended')return;
    this.cpdlc._el+=(dt||0.016);
    const altft=S.alt*((typeof M_TO_FT!=='undefined')?M_TO_FT:3.281), rwy=(typeof RWY!=='undefined'?RWY.name:'27');
    if(!this.cpdlc.fired.clr)this._up('clr','[CLEARED] 数据链放行:cleared to land runway '+rwy);
    if(altft<2000&&!this.cpdlc.fired.des)this._up('des','[DESCEND] descend and maintain 1500FT');
    if(altft<1200&&!this.cpdlc.fired.ctc)this._up('ctc','[CONTACT] contact tower 118.70');
    if(S.phase==='goaround'&&!this.cpdlc.fired.ga)this._up('ga','[GO-AROUND] climb runway heading, maintain 3000FT');
  },
  reply(kind){ this.cpdlc.log.push({dir:'DN',msg:kind,t:this._stamp()}); this._sig=null; },
  reset(){ this.cpdlc.log=[]; this.cpdlc.fired={}; this.cpdlc._el=0; this._sig=null; },

  //------------------ DCDU 面板 ------------------
  render(host){
    if(!host)return; const sig=this.atis.letter+'|'+this.atis.text+'|'+this.cpdlc.log.length; if(sig===this._sig)return; this._sig=sig;
    const a=host.querySelector('#dlAtis'); if(a)a.innerHTML='<div class="dl-atisL">情报 '+this.atis.letter+'</div><div class="dl-atisT">'+this.atis.text+'</div>';
    const c=host.querySelector('#dlCpdlc'); if(c)c.innerHTML=this.cpdlc.log.length
      ? this.cpdlc.log.map(m=>'<div class="dl-msg '+(m.dir==='UP'?'up':'dn')+'"><span class="dl-t">'+m.t+'</span><span class="dl-d">'+(m.dir==='UP'?'↑UPLINK':'↓你')+'</span><span class="dl-m">'+m.msg+'</span></div>').join('')
      : '<div class="dl-empty">建立进近后,塔台数据链报文将在此显示</div>';
  },
  build(){
    return '<div class="syspanel"><div class="sp-title">数据链 DCDU · ATIS / CPDLC</div>'
      +'<div class="dl-sec">ATIS 自动情报 <button class="dl-spk" id="dlSpk">播报</button></div><div class="dl-atis" id="dlAtis"></div>'
      +'<div class="dl-sec">CPDLC 数据链报文</div><div class="dl-cpdlc" id="dlCpdlc"></div>'
      +'<div class="dl-reply"><button class="dl-rb" data-dl="WILCO">WILCO</button><button class="dl-rb" data-dl="UNABLE">UNABLE</button><button class="dl-rb" data-dl="STANDBY">STANDBY</button></div>'
      +'<div class="sp-hint">ATIS 按天气/风自动生成情报(字母轮替),点播报语音。CPDLC 是塔台文本数据链报文(区别于无线电语音),收到后点 WILCO/UNABLE 文本应答。</div></div>';
  },
  wire(host){
    const self=this; this.genATIS();
    const spk=host.querySelector('#dlSpk'); if(spk)spk.addEventListener('click',()=>self.speakATIS());
    host.querySelectorAll('[data-dl]').forEach(b=>b.addEventListener('click',()=>{ self.reply(b.dataset.dl); self.render(host); }));
    this._sig=null; this.render(host);
  },
  sync(host){ this.genATIS(); this.render(host); },   // 逐帧:ATIS 随天气刷新 + CPDLC 日志
};

if(typeof PANELS!=='undefined')PANELS.register('dl',DATALINK);
if(typeof window!=='undefined')window.DATALINK=DATALINK;
