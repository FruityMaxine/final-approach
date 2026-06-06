"use strict";
//==================================================================
// FINAL APPROACH — 第一视角客机降落模拟
// 纯原生 canvas / WebAudio / 零依赖 / 三屏(手机·iPad·电脑)自适应
//==================================================================
const RAD=Math.PI/180, DEG=180/Math.PI;
const clamp=(v,a,b)=>v<a?a:(v>b?b:v);
const lerp=(a,b,t)=>a+(b-a)*t;
const MS_TO_KT=1.94384, MS_TO_FPM=196.850, M_TO_FT=3.28084;
const $=id=>document.getElementById(id);
function getC(v){return getComputedStyle(document.documentElement).getPropertyValue(v).trim();}

//==================================================================
// 设备分级三屏 — phone / tablet / desktop
//   依据:触控能力 + 视口最短边 + UA。手动可在设置里覆盖。
//==================================================================
const DEVICE_KEY='fa.device';
const DeviceMode={
  current:'desktop', forced:null,
  detect(){
    if(this.forced)return this.forced;
    const ua=navigator.userAgent||'';
    const coarse=window.matchMedia&&window.matchMedia('(pointer:coarse)').matches;
    const touch=('ontouchstart'in window)||navigator.maxTouchPoints>0;
    const minSide=Math.min(window.innerWidth,window.innerHeight);
    const maxSide=Math.max(window.innerWidth,window.innerHeight);
    const isTabletUA=/iPad|Tablet|Nexus 7|Nexus 10|SM-T|Kindle|Silk/i.test(ua)||(/Macintosh/.test(ua)&&touch);
    const isPhoneUA=/iPhone|Android.*Mobile|Windows Phone|iPod/i.test(ua);
    // 纯键鼠桌面:无 coarse 指针且视口大
    if(!coarse&&!touch&&maxSide>=1024)return 'desktop';
    if(isPhoneUA)return 'phone';
    if(isTabletUA)return 'tablet';
    // 尺寸兜底:最短边 <600 手机,600-1100 平板,否则桌面
    if(minSide<600)return 'phone';
    if(minSide<1100)return 'tablet';
    return 'desktop';
  },
  apply(){
    const m=this.detect();this.current=m;
    document.documentElement.setAttribute('data-device',m);
    const txt={phone:'手机',tablet:'iPad',desktop:'电脑'}[m]||m;
    const dt=$('devtxt');if(dt)dt.textContent=txt;
    const dl=$('devLine');if(dl)dl.textContent=(this.forced?'手动锁定 · ':'自动探测 · ')+txt;
    const segs=document.querySelectorAll('.seg-opt[data-dev]');
    segs.forEach(s=>s.classList.toggle('on',s.dataset.dev===m));
    return m;
  },
  setForced(m){
    this.forced=m;
    try{m?localStorage.setItem(DEVICE_KEY,m):localStorage.removeItem(DEVICE_KEY);}catch(_){}
    this.apply();setLayout();resizeWorld();resizePFD();
  },
  init(){
    try{const v=localStorage.getItem(DEVICE_KEY);if(v==='phone'||v==='tablet'||v==='desktop')this.forced=v;}catch(_){}
    this.apply();
  }
};

//------------------ 飞机/环境(类 737,已配平标定) ------------------
const AC={
  m:62000, dryMass:44000, S:125, span:34, rho:1.225, g:9.81,
  maxThrust:180000, revFactor:0.42,
  CLa:0.105, CL0:0.30, aoaStall:14,
  flapCL:[0,0.25,0.50,0.75,1.0], flapStallBonus:[0,1,2,3,4],
  flapCD:[0,0.010,0.022,0.040,0.065],
  CD0:0.021, k:0.045, gearCD:0.018, spoilerCD:0.065, spoilerLiftLoss:0.55,
  gearHeight:3.6,
};
const RWY={ W:45, L:3000, aim:300, tdzStart:150, tdzEnd:900, elevFt:120,
            name:'27', ils:'110.30', hdg:270, papi:3.0, icao:'ZVGA', aptName:'维加国际' };   // 机场库默认(applyAirport 覆写)
const GS_DEG=3.0;
const PAPI={ x:-RWY.W/2-22, y:0, z:340 };
// m/s 顶风+侧风;gustMul 湍流强度倍率,shear 风切变(均由 config.js applyWind 写)
const WIND={ head:3, cross:1.7, gustMul:1, shear:false };

//------------------ 状态 ------------------
let S={};
function resetState(){
  const st=(typeof curStart==='function')?curStart():{z:-4520,alt:245,V:72};
  const vF=(typeof curAircraftVref==='function')?(curAircraftVref()/140):1;   // 机型 vref 比例:重机进近更快,防换大机即失速
  S={
    V:st.V*vF, alt:st.alt, z:st.z, x:0,
    pitch:4.0, roll:0, hdg:0, gamma:-3.0*RAD,
    throttle:0.20, N1:0.25, flaps:2,
    gearDown:true, spoilerArmed:true, spoilerOut:false,
    reverse:false, brake:false,
    pitchIn:0, pitchInRaw:0, rollIn:0, rudder:0, rudderKbd:0, beta:0,
    phase:'approach', ended:false, started:false,
    touchdown:null, onGround:false, t:0, stall:false,
    vTrend:0, lastV:st.V*vF,
    gustG:0, gustR:0, gustTheta:0,
    calls:{}, lastBand:9999,
  };
  if(typeof ENGINES!=='undefined'&&ENGINES.list.length)ENGINES.reset();
  if(typeof FUEL!=='undefined')FUEL.reset();
  if(typeof HYD!=='undefined')HYD.reset();
  if(typeof ELEC!=='undefined')ELEC.reset();
  if(typeof FBW!=='undefined')FBW.reset();
  if(typeof SPATIAL!=='undefined')SPATIAL.reset();
  if(typeof WEATHER!=='undefined'&&WEATHER.resetWx)WEATHER.resetWx();
}
resetState();
const cfg={ gyro:false, invertPitch:false, sound:true, turb:true, gyroBase:null, tod:'dusk' };
// EMMA AI 副驾的状态 ap{} 与逻辑(giveAP/releaseAP/cycleEMMA/grabAxis/autopilot)
// 已抽到独立模块 emma.js(在本文件之前加载)。
function crosswindAt(alt){ return WIND.cross*clamp(1.25-alt/200,0.35,1); }
// 当前难度参数访问器(config.js 缺省时回落真实档)
function DF(){ return (typeof curDiff==='function')?curDiff():{veerEnd:9,overflyEnd:1500,grassMu:0.10,crashFpm:1000,crashRoll:11,crashPitch:14,crashVkt:100,stallMarginKt:0,grade:{greased:170,firm:360,hard:600}}; }

//==================================================================
// 音频:WebAudio 合成发动机/风噪 + SpeechSynthesis 语音
//==================================================================
const Sound={
  ctx:null, ready:false, master:null,
  engGain:null, engFilt:null, rumble:null, rumbleGain:null,
  windGain:null, windFilt:null, warnOsc:null, warnGain:null,
  init(){
    if(this.ctx)return;
    const ACtx=window.AudioContext||window.webkitAudioContext;
    if(!ACtx)return;
    try{
      const ctx=new ACtx(); this.ctx=ctx;
      this.master=ctx.createGain(); this.master.gain.value=cfg.sound?0.9:0.0; this.master.connect(ctx.destination);
      const len=ctx.sampleRate*2, buf=ctx.createBuffer(1,len,ctx.sampleRate), d=buf.getChannelData(0);
      for(let i=0;i<len;i++)d[i]=Math.random()*2-1;
      const noise=ctx.createBufferSource(); noise.buffer=buf; noise.loop=true;
      this.engFilt=ctx.createBiquadFilter(); this.engFilt.type='lowpass'; this.engFilt.frequency.value=900; this.engFilt.Q.value=0.6;
      this.engGain=ctx.createGain(); this.engGain.gain.value=0.0;
      noise.connect(this.engFilt); this.engFilt.connect(this.engGain); this.engGain.connect(this.master);
      this.rumble=ctx.createOscillator(); this.rumble.type='sawtooth'; this.rumble.frequency.value=55;
      this.rumbleGain=ctx.createGain(); this.rumbleGain.gain.value=0.0;
      const rf=ctx.createBiquadFilter(); rf.type='lowpass'; rf.frequency.value=180;
      this.rumble.connect(rf); rf.connect(this.rumbleGain); this.rumbleGain.connect(this.master);
      this.windFilt=ctx.createBiquadFilter(); this.windFilt.type='bandpass'; this.windFilt.frequency.value=1400; this.windFilt.Q.value=0.5;
      this.windGain=ctx.createGain(); this.windGain.gain.value=0.0;
      noise.connect(this.windFilt); this.windFilt.connect(this.windGain); this.windGain.connect(this.master);
      this.warnOsc=ctx.createOscillator(); this.warnOsc.type='square'; this.warnOsc.frequency.value=760;
      this.warnGain=ctx.createGain(); this.warnGain.gain.value=0.0;
      this.warnOsc.connect(this.warnGain); this.warnGain.connect(this.master);
      noise.start(); this.rumble.start(); this.warnOsc.start();
      this.ready=true;
    }catch(e){ this.ready=false; }
  },
  resume(){ if(this.ctx&&this.ctx.state==='suspended')this.ctx.resume(); },
  setMaster(){ if(this.ready)this.master.gain.setTargetAtTime(cfg.sound?0.9:0.0,this.ctx.currentTime,0.05); },
  update(dt){
    if(!this.ready||!cfg.sound)return;
    const n1=S.N1, t=this.ctx.currentTime;
    this.engGain.gain.setTargetAtTime(0.04+n1*0.16,t,0.08);
    this.engFilt.frequency.setTargetAtTime(500+n1*1600,t,0.08);
    this.rumble.frequency.setTargetAtTime(42+n1*70,t,0.08);
    this.rumbleGain.gain.setTargetAtTime(0.05+n1*0.10,t,0.08);
    const wf=clamp((S.V-30)/110,0,1);
    this.windGain.gain.setTargetAtTime(S.onGround?wf*0.05:wf*0.13,t,0.1);
    this.windFilt.frequency.setTargetAtTime(900+wf*1400,t,0.1);
  },
  warnTone(on){ if(!this.ready)return; this.warnGain.gain.setTargetAtTime(on&&cfg.sound?0.05:0,this.ctx.currentTime,0.02); },
  blip(freq,dur){
    if(!this.ready||!cfg.sound)return;
    try{const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type='sine';o.frequency.value=freq;
    g.gain.setValueAtTime(0.0,this.ctx.currentTime);g.gain.linearRampToValueAtTime(0.12,this.ctx.currentTime+0.01);
    g.gain.exponentialRampToValueAtTime(0.001,this.ctx.currentTime+dur);
    o.connect(g);g.connect(this.master);o.start();o.stop(this.ctx.currentTime+dur+0.02);}catch(e){}
  },
  say(text){
    if(!cfg.sound||!('speechSynthesis'in window))return;
    try{const u=new SpeechSynthesisUtterance(text);u.lang='en-US';u.rate=1.08;u.pitch=0.95;u.volume=0.95;
    window.speechSynthesis.cancel();window.speechSynthesis.speak(u);}catch(e){}
  }
};

//------------------ 大字提示 ------------------
const calloutEl=$('callout');
let calloutTimer=null;
function showCallout(msg,color,doSay){
  calloutEl.textContent=msg;calloutEl.style.color=color;
  calloutEl.classList.add('show','pop');
  setTimeout(()=>calloutEl.classList.remove('pop'),180);
  clearTimeout(calloutTimer);
  calloutTimer=setTimeout(()=>calloutEl.classList.remove('show'),1900);
  if(doSay)Sound.say(doSay===true?msg:doSay);
}

//------------------ 无线电高度回报 / GPWS ------------------
const NUM_WORDS={500:'five hundred',400:'four hundred',300:'three hundred',200:'two hundred',100:'one hundred',50:'fifty',40:'forty',30:'thirty',20:'twenty',10:'ten'};
function radioCallouts(altFt,vsFpm){
  const bands=[500,400,300,200,100,50,40,30,20,10];
  for(const b of bands){
    if(S.lastBand>b && altFt<=b && !S.calls[b]){
      S.calls[b]=1; Sound.say(NUM_WORDS[b]);
    }
  }
  if(altFt<260 && !S.calls.appchk){ S.calls.appchk=1; }
  if(altFt<200 && !S.calls.mins){ S.calls.mins=1; Sound.say('minimums'); }
  if(altFt<32 && S.throttle>0.06 && !S.onGround && !S.calls.retard){ S.calls.retard=1; Sound.say('retard'); showCallout('RETARD · 收油',getC('--amb')); }
  if(!S.onGround && altFt<700 && altFt>20){
    if(vsFpm<-1100 && !S.calls.pullup){ S.calls.pullup=1; Sound.say('woop woop. pull up'); showCallout('PULL UP',getC('--red')); setTimeout(()=>{S.calls.pullup=0;},3000); }
    else if(vsFpm<-850 && !S.calls.sink){ S.calls.sink=1; Sound.say('sink rate'); setTimeout(()=>{S.calls.sink=0;},2500); }
  }
  if(!S.onGround && altFt<500 && !S.gearDown && !S.calls.gear){ S.calls.gear=1; Sound.say('too low. gear'); setTimeout(()=>{S.calls.gear=0;},3000); }
  S.lastBand=altFt;
}
//==================================================================
// 输入
//==================================================================
const stickpad=$('stickpad'),stickknob=$('stickknob'),stickReadout=$('stickReadout');
let stickActive=false;
function setPitchRaw(raw){ S.pitchInRaw=clamp(raw,-1,1); S.pitchIn=S.pitchInRaw*(cfg.invertPitch?-1:1); }
function stickFromEvent(e){
  const r=stickpad.getBoundingClientRect();
  S.rollIn=clamp((e.clientX-r.left)/r.width*2-1,-1,1);
  setPitchRaw(-((e.clientY-r.top)/r.height*2-1));
  grabAxis('pitch');grabAxis('roll');   // 摇杆 = 同时夺俯仰+横滚两轴
  updateStickKnob();
}
function updateStickKnob(){
  const m=Math.min(stickpad.clientWidth,stickpad.clientHeight)*0.34||40;
  stickknob.style.transform='translate('+(S.rollIn*m)+'px,'+(-S.pitchInRaw*m)+'px)';
  stickReadout.textContent=(S.pitchInRaw*100|0)+' / '+(S.rollIn*100|0);
}
stickpad.addEventListener('pointerdown',e=>{stickActive=true;try{stickpad.setPointerCapture(e.pointerId);}catch(_){}stickFromEvent(e);});
stickpad.addEventListener('pointermove',e=>{if(stickActive)stickFromEvent(e);});
function stickRelease(){stickActive=false;S.rollIn=0;setPitchRaw(0);updateStickKnob();}
stickpad.addEventListener('pointerup',stickRelease);
stickpad.addEventListener('pointercancel',stickRelease);

// 方向舵脚蹬
const rudTrack=$('rudTrack'),rudKnob=$('rudKnob'),rudFill=$('rudFill');
let rudderActive=false;
function rudFromEvent(e){const r=rudTrack.getBoundingClientRect();S.rudder=clamp((e.clientX-r.left)/r.width*2-1,-1,1);grabAxis('rudder');updateRudderUI();}
function updateRudderUI(){const half=((rudTrack.clientWidth||120)-24)/2;rudKnob.style.transform='translateX('+(S.rudder*half)+'px)';rudFill.style.left=(S.rudder>=0?50:50+S.rudder*50)+'%';rudFill.style.width=(Math.abs(S.rudder)*50)+'%';}
rudTrack.addEventListener('pointerdown',e=>{rudderActive=true;try{rudTrack.setPointerCapture(e.pointerId);}catch(_){}rudFromEvent(e);});
rudTrack.addEventListener('pointermove',e=>{if(rudderActive)rudFromEvent(e);});
function rudRelease(){rudderActive=false;}
rudTrack.addEventListener('pointerup',rudRelease);
rudTrack.addEventListener('pointercancel',rudRelease);

const thrTrack=$('thrTrack'),thrGrip=$('thrGrip'),thrFill=$('thrFill'),thrPct=$('thrPct'),thrN1=$('thrN1');
let thrActive=false;
function thrFromEvent(e){const r=thrTrack.getBoundingClientRect();S.throttle=clamp(1-(e.clientY-r.top)/r.height,0,1);grabAxis('throttle');syncThrottleUI();}
function syncThrottleUI(){
  const p=Math.round(S.throttle*100);
  thrGrip.style.bottom=(S.throttle*100)+'%';thrFill.style.height=(S.throttle*100)+'%';thrPct.textContent=p;
}
thrTrack.addEventListener('pointerdown',e=>{thrActive=true;try{thrTrack.setPointerCapture(e.pointerId);}catch(_){}thrFromEvent(e);});
thrTrack.addEventListener('pointermove',e=>{if(thrActive)thrFromEvent(e);});
thrTrack.addEventListener('pointerup',()=>thrActive=false);
thrTrack.addEventListener('pointercancel',()=>thrActive=false);

const flapKnob=$('flapKnob'),flapStops=[...document.querySelectorAll('.flap-stop')];
function setFlaps(n){S.flaps=clamp(n,0,4);syncFlapUI();}
function syncFlapUI(){flapStops.forEach(s=>s.classList.toggle('on',+s.dataset.f===S.flaps));flapKnob.style.top=((S.flaps/4)*82)+'%';}
flapStops.forEach(s=>s.addEventListener('click',()=>setFlaps(+s.dataset.f)));

const btnGear=$('btnGear'),gearState=$('gearState'),btnSplr=$('btnSplr'),splrState=$('splrState');
const btnRev=$('btnRev'),btnBrake=$('btnBrake'),btnToga=$('btnToga');
btnGear.addEventListener('click',()=>{S.gearDown=!S.gearDown;Sound.blip(S.gearDown?340:260,0.18);syncSysUI();});
btnSplr.addEventListener('click',()=>{if(S.onGround){S.spoilerOut=!S.spoilerOut;}else{S.spoilerArmed=!S.spoilerArmed;}syncSysUI();});
function revDown(){if(S.onGround){S.reverse=true;syncSysUI();}}
function revUp(){S.reverse=false;syncSysUI();}
btnRev.addEventListener('pointerdown',revDown);btnRev.addEventListener('pointerup',revUp);btnRev.addEventListener('pointercancel',revUp);
function brakeDown(){S.brake=true;syncSysUI();}
function brakeUp(){S.brake=false;syncSysUI();}
btnBrake.addEventListener('pointerdown',brakeDown);btnBrake.addEventListener('pointerup',brakeUp);btnBrake.addEventListener('pointercancel',brakeUp);
btnToga.addEventListener('click',goAround);
// EMMA 副驾:给予 / 夺回控制权
const btnEmma=$('btnEmma'),emmaSt=$('emmaSt');
// 三态显示:off(灰) / control(青·on) / assist(琥珀·assist)。giveAP/releaseAP/cycleEMMA 在 emma.js。
function updateEmmaBtn(){
  btnEmma.classList.toggle('on',ap.level==='control');
  btnEmma.classList.toggle('assist',ap.level==='assist');
  emmaSt.textContent=ap.level==='control'?'ON':(ap.level==='assist'?'AST':'OFF');
}
btnEmma.addEventListener('click',()=>{Sound.init();Sound.resume();if(S.phase==='ended')return;cycleEMMA();});

function syncSysUI(){
  btnGear.classList.toggle('on',S.gearDown);gearState.textContent=S.gearDown?'DN':'UP';
  btnSplr.classList.remove('on','armed','warn');
  if(S.spoilerOut){btnSplr.classList.add('on');splrState.textContent='OUT';}
  else if(S.spoilerArmed){btnSplr.classList.add('armed');splrState.textContent='ARM';}
  else{splrState.textContent='DN';}
  btnRev.classList.toggle('on',S.reverse);
  btnBrake.classList.toggle('warn',S.brake);
  btnRev.classList.toggle('disabled',!S.onGround);
}

function goAround(){
  if(S.phase==='ended'||S.phase==='rollout'||S.onGround)return;
  S.throttle=1.0;S.reverse=false;S.brake=false;S.phase='goaround';
  syncThrottleUI();syncSysUI();
  showCallout('GO-AROUND',getC('--cyan'),'go around. flaps');
}

// 键盘
const keys={};
window.addEventListener('keydown',e=>{
  keys[e.key]=true;const k=e.key.toLowerCase();
  // 飞行操纵键不再整体交还 EMMA;pollInputs 按键映射只夺对应轴(grabAxis),其余轴 EMMA 续飞
  if(k==='f')setFlaps(S.flaps+1);
  if(k==='v')setFlaps(S.flaps-1);
  if(k==='g'){S.gearDown=!S.gearDown;syncSysUI();}
  if(k==='b'){if(S.onGround){S.spoilerOut=!S.spoilerOut;}else{S.spoilerArmed=!S.spoilerArmed;}syncSysUI();}
  if(k==='e'){Sound.init();Sound.resume();if(S.phase!=='ended')cycleEMMA();}
  if(e.key==='Enter')goAround();
  if(e.key===' '){e.preventDefault();if(S.onGround){S.reverse=true;S.brake=true;syncSysUI();}}
  if([' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))e.preventDefault();
});
window.addEventListener('keyup',e=>{keys[e.key]=false;if(e.key===' '){S.reverse=false;S.brake=false;syncSysUI();}});
function pollInputs(){
  // 分轴键控:按键只夺对应轴(grabAxis),EMMA 续飞其余 auto 轴。
  // manualFly = 全手动(off)或辅助档(assist) —— 松键即回中;EMMA control 下手动轴松键回中但保持 manual 待超时交还。
  const manualFly=(ap.level==='off'||ap.level==='assist');
  // 油门键
  if(keys['Shift']){grabAxis('throttle');S.throttle=clamp(S.throttle+0.012,0,1);syncThrottleUI();}
  if(keys['Control']){grabAxis('throttle');S.throttle=clamp(S.throttle-0.012,0,1);syncThrottleUI();}
  // 脚舵键(未拖脚蹬时)
  if(!rudderActive){
    let rud=0; if(keys['z']||keys['Z']||keys[','])rud-=1; if(keys['c']||keys['C']||keys['.'])rud+=1;
    if(rud!==0){grabAxis('rudder');S.rudder=clamp(S.rudder+rud*0.07,-1,1);updateRudderUI();}
    else if(manualFly||ap.axes.rudder==='manual'){S.rudder=lerp(S.rudder,0,0.15);updateRudderUI();}
  }
  // 俯仰/横滚键(未用摇杆/陀螺时)
  if(cfg.gyro||stickActive)return;
  let p=0,r=0,kbP=false,kbR=false;
  if(keys['ArrowUp']||keys['w']||keys['W']){p+=1;kbP=true;}
  if(keys['ArrowDown']||keys['s']||keys['S']){p-=1;kbP=true;}
  if(keys['ArrowLeft']||keys['a']||keys['A']){r-=1;kbR=true;}
  if(keys['ArrowRight']||keys['d']||keys['D']){r+=1;kbR=true;}
  if(kbP){grabAxis('pitch');setPitchRaw(p);} else if(manualFly||ap.axes.pitch==='manual'){setPitchRaw(0);}
  if(kbR){grabAxis('roll');S.rollIn=clamp(r,-1,1);} else if(manualFly||ap.axes.roll==='manual'){S.rollIn=0;}
  updateStickKnob();
}

// 陀螺仪
const swGyro=$('swGyro');
function enableGyro(){
  const start=()=>{window.addEventListener('deviceorientation',onOrient);cfg.gyro=true;cfg.gyroBase=null;};
  if(typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function'){
    DeviceOrientationEvent.requestPermission().then(s=>{if(s==='granted')start();else{cfg.gyro=false;swGyro.classList.remove('on');}}).catch(()=>{cfg.gyro=false;swGyro.classList.remove('on');});
  }else if(typeof DeviceOrientationEvent!=='undefined'){start();}else{cfg.gyro=false;swGyro.classList.remove('on');}
}
function disableGyro(){window.removeEventListener('deviceorientation',onOrient);cfg.gyro=false;}
function onOrient(e){
  if(e.beta==null||e.gamma==null)return;
  if(!cfg.gyroBase)cfg.gyroBase={beta:e.beta,gamma:e.gamma};
  S.rollIn=clamp((e.gamma-cfg.gyroBase.gamma)/35,-1,1);
  setPitchRaw(clamp(-(e.beta-cfg.gyroBase.beta)/35,-1,1));
  updateStickKnob();
}

//------------------ 响应式布局(横/竖屏) ------------------
const consoleEl=$('console');
function setLayout(){
  const portrait=window.innerWidth<window.innerHeight;
  consoleEl.classList.toggle('portrait',portrait);
  consoleEl.classList.toggle('landscape',!portrait);
}
// EMMA — AI 副驾(分轴接管/自动进近/着陆/复飞/重新进近)已抽到 emma.js。

//==================================================================
// 物理
//==================================================================
function vStall(){
  const stallA=AC.aoaStall+AC.flapStallBonus[S.flaps];
  let CLmax=AC.CL0+AC.CLa*stallA+AC.flapCL[S.flaps];
  if(typeof WEATHER!=='undefined'&&WEATHER.ice)CLmax/=(1+clamp(WEATHER.ice/1500,0,0.35));   // 积冰破坏升力面→CLmax降→失速速度升
  return Math.sqrt(2*AC.m*AC.g/(AC.rho*AC.S*Math.max(CLmax,0.5)));
}
function updatePhysics(dt){
  if(S.phase==='ended'||!S.started)return;
  if(ap.active&&ap.mode==='reposition')return;
  S.t+=dt;
  // 液压:操纵增益(液压低→俯仰/横滚迟钝沉重)
  const hg=((typeof HYD!=='undefined')?HYD.ctrlGain():1)*((typeof WEATHER!=='undefined'&&WEATHER.icePenalty)?WEATHER.icePenalty():1);  // 液压×积冰操纵效率
  // 电传飞控 FBW(正常法则:松杆1g航迹/坡度保持+包线保护);关或降级→直接法则
  const fbwOn=(typeof FBW!=='undefined'&&typeof SYS!=='undefined'&&SYS.get('features','fbw'));
  if(fbwOn&&FBW.apply(S,S.pitchIn,S.rollIn,dt,hg)){ /* 正常法则已更新 S.pitch/roll */ }
  else {                                               // 直接法则(FBW 关 / 降级)
    if(typeof FBW!=='undefined'&&fbwOn)FBW.law='DIRECT';
    S.pitch=clamp(S.pitch+S.pitchIn*9.0*dt*hg,-15,20);
    S.roll+=S.rollIn*36*dt*hg;
    if(Math.abs(S.rollIn)<0.02)S.roll-=clamp(S.roll,-1,1)*Math.min(1,dt*1.8)*(Math.abs(S.roll)>0.3?1:0.5);
    S.roll=clamp(S.roll,-45,45);
  }
  // 多发引擎:各发独立 spool/状态机(engines.js);S.N1 取队均(供 UI/EMMA/声音向后兼容)
  if(typeof ENGINES!=='undefined'&&ENGINES.list.length){ ENGINES.step(dt,S.throttle); if(typeof FUEL!=='undefined')FUEL.step(dt); if(typeof HYD!=='undefined')HYD.step(dt); if(typeof ELEC!=='undefined')ELEC.step(dt); if(typeof WEATHER!=='undefined'&&WEATHER.step)WEATHER.step(dt,S); S.N1=ENGINES.avgN1(); }
  else { const spool=(S.throttle>S.N1?0.55:0.95); S.N1=clamp(S.N1+(S.throttle-S.N1)*Math.min(1,dt*spool*2.4),0,1); }
  // 扰流板自动展开:需 B 系统液压(液压失→不可展)
  if(S.onGround&&S.spoilerArmed&&!S.spoilerOut&&(typeof HYD==='undefined'||HYD.spoilerOK())){S.spoilerOut=true;syncSysUI();}
  if(S.spoilerOut&&typeof HYD!=='undefined'&&!HYD.spoilerOK()){S.spoilerOut=false;syncSysUI();}  // 液压失→扰流板收回失效
  const gustMul=(WIND.gustMul!=null?WIND.gustMul:(cfg.turb?1:0));
  if(gustMul>0&&!S.onGround){
    const inten=clamp(S.alt/140,0.25,1)*gustMul;
    S.gustG=lerp(S.gustG,Math.random()*2-1,dt*0.9);
    S.gustR=lerp(S.gustR,Math.random()*2-1,dt*0.9);
    S.gamma+=S.gustG*inten*0.0016;
    S.roll+=S.gustR*inten*5.0*dt;
  }
  // 风切变(硬核):低空顶风缓慢骤变,冲击空速与下滑道 — 需主动用油门/姿态补偿
  if(WIND.shear&&!S.onGround&&S.alt*M_TO_FT<450){
    S.shearPhase=(S.shearPhase||0)+dt*0.8;
    const sh=Math.sin(S.shearPhase)+0.5*Math.sin(S.shearPhase*2.3);
    S.V=clamp(S.V+sh*0.6*dt,18,140);
    S.gamma+=sh*0.0009;
  }
  const V=Math.max(S.V,1), gammaDeg=S.gamma*DEG;
  let aoa=S.pitch-gammaDeg;
  const stallA=AC.aoaStall+AC.flapStallBonus[S.flaps];
  const geh=clamp(1-S.alt/AC.span,0,1);
  const geLift=1+0.05*geh, geK=AC.k*(1-0.15*geh);
  let CL=(AC.CL0+AC.CLa*aoa+AC.flapCL[S.flaps])*geLift;
  S.stall=false;
  if(aoa>stallA){CL*=Math.max(0.35,1-(aoa-stallA)*0.10);S.stall=true;}
  if(S.spoilerOut)CL*=(1-AC.spoilerLiftLoss);
  let CD=AC.CD0+geK*CL*CL+AC.flapCD[S.flaps]+(S.gearDown?AC.gearCD:0)+(S.spoilerOut?AC.spoilerCD:0);
  const q=0.5*AC.rho*V*V, L=q*AC.S*CL, D=q*AC.S*CD, W=AC.m*AC.g;
  // 总推力 = Σ各发(engines.js);失效/不对称发动机自然减少总推力
  let T,yawThrust=0;
  if(typeof ENGINES!=='undefined'&&ENGINES.list.length){ T=ENGINES.totalThrust(S.reverse,S.onGround); yawThrust=ENGINES.yawFromThrust(); }
  else { T=S.N1*AC.maxThrust; if(S.reverse&&S.onGround)T=-S.N1*AC.maxThrust*AC.revFactor; }

  if(!S.onGround){
    const aoaR=aoa*RAD;
    const Vdot=(T*Math.cos(aoaR)-D-W*Math.sin(S.gamma))/AC.m;
    const gammaDot=(L*Math.cos(S.roll*RAD)+T*Math.sin(aoaR)-W*Math.cos(S.gamma))/(AC.m*V);
    S.V=clamp(S.V+Vdot*dt,18,140);
    S.gamma=clamp(S.gamma+gammaDot*dt,-12*RAD,12*RAD);
    const hs=Math.max(0,S.V*Math.cos(S.gamma)-WIND.head), vs=S.V*Math.sin(S.gamma);
    S.z+=hs*dt; S.alt+=vs*dt;
    // 偏航:坡度协调 + 脚舵 + 不对称推力(失效发动机把机头拉向死发一侧)
    const psiDot=(AC.g*Math.tan(S.roll*RAD))/S.V + S.rudder*0.42*hg + yawThrust;
    S.hdg=clamp(S.hdg+psiDot*DEG*dt-S.beta*0.015,-40,40);
    S.x+=(S.V*Math.sin(S.hdg*RAD)+crosswindAt(S.alt))*dt;
    S.beta=lerp(S.beta,S.rudder*10-S.roll*0.42,Math.min(1,dt*2.5));
    if(S.alt<=AC.gearHeight)touchdown(vs);
    if(S.phase==='goaround'&&S.alt>230&&S.z>120)endGame('goaround');
    if(S.z>RWY.L+DF().overflyEnd&&S.phase!=='goaround')endGame('overfly');
  }else{
    const d=DF(),offRwy=Math.abs(S.x)>RWY.W/2,grass=offRwy?d.grassMu:0;
    const bg=(typeof HYD!=='undefined')?HYD.brakeGain():1;
    const fric=(0.02+grass+(S.brake?0.35*bg:0))*W;
    // 爆胎:滑跑时持续拉向爆胎(右)侧 + 该侧刹车失效
    if(typeof FAILURES!=='undefined'&&FAILURES.reg.tireBurst&&FAILURES.reg.tireBurst.active){
      S.hdg=clamp(S.hdg+14*dt,-25,25); S.x+=2.4*dt*S.V*0.04;
    }
    const Vdot=(T-fric-D)/AC.m;
    S.V=Math.max(0,S.V+Vdot*dt);
    S.z+=S.V*dt; S.x+=(S.V*Math.sin(S.hdg*RAD)+crosswindAt(S.alt)*0.7)*dt;
    S.hdg=clamp(S.hdg+S.rudder*9*dt-clamp(S.hdg,-1,1)*dt*1.8,-25,25);
    S.beta=lerp(S.beta,0,Math.min(1,dt*3));
    S.alt=AC.gearHeight;S.gamma=0;S.pitch=lerp(S.pitch,0.5,Math.min(1,dt*2));
    if(S.phase==='goaround')S.onGround=false;
    // 放宽:仅严重偏出(难度容差)且有速度才判冲出;轻微偏出靠草地阻力减速,可蹬舵修回中线
    if(Math.abs(S.x)>RWY.W/2+d.veerEnd&&S.V*MS_TO_KT>30)endGame('veeroff');
    else if(offRwy&&!S._grassWarn){S._grassWarn=1;showCallout('偏出道面 · 蹬舵修回',getC('--amb'));setTimeout(()=>{S._grassWarn=0;},2500);}
    if(S.z>RWY.L&&S.V*MS_TO_KT>30)endGame('overrun');
    if(S.V<7&&S.z>RWY.aim)endGame('stopped');
  }
  if(!S.onGround&&S.phase!=='goaround'&&S.phase!=='ended')S.phase=(S.alt<25)?'flare':'approach';
  const inst=(S.V-S.lastV)/Math.max(dt,1e-3); S.lastV=S.V;
  S.vTrend=lerp(S.vTrend,inst,Math.min(1,dt*3));
  Sound.warnTone(S.stall&&!S.onGround);
  if(S.stall&&!S.onGround&&!S._stallCall){S._stallCall=1;showCallout('STALL',getC('--red'),'stall');setTimeout(()=>{S._stallCall=0;},2000);}
  if(!S.onGround)radioCallouts(Math.round(S.alt*M_TO_FT),S.V*Math.sin(S.gamma)*MS_TO_FPM);
}

function touchdown(vsAtTD){
  if(S.onGround||S.touchdown)return;
  S.onGround=true;S.phase='rollout';
  const fpm=Math.abs(vsAtTD*MS_TO_FPM);
  S.touchdown={vsFpm:fpm,vAtKt:S.V*MS_TO_KT,zPos:S.z,xOff:S.x,pitch:S.pitch,roll:S.roll,stall:S.stall};
  if(S.spoilerArmed)S.spoilerOut=true;
  S.throttle=0;syncThrottleUI();syncSysUI();
  Sound.blip(110,0.4);
  const d=DF();
  if(fpm>d.grade.hard){showCallout('HARD LANDING',getC('--red'));}
  else if(fpm<d.grade.greased){showCallout('GREASED!',getC('--grn'));}
  else showCallout('TOUCHDOWN',getC('--ink'));
  if(fpm>d.crashFpm||Math.abs(S.x)>RWY.W/2+d.veerEnd||S.pitch>d.crashPitch||Math.abs(S.roll)>d.crashRoll||S.V*MS_TO_KT<d.crashVkt)
    setTimeout(()=>endGame('crash'),500);
}

//==================================================================
// 讲评
//==================================================================
const repEl=$('report');
// arcade 平台落地评分上报(同源 SDK,可缺省)
function arcadeSubmit(score){
  try{
    if(window.arcade&&window.arcade.score&&typeof window.arcade.score.submit==='function'){
      window.arcade.score.submit(Math.round(score));
    }
  }catch(_){}
}
function endGame(reason){
  if(S.phase==='ended')return;
  // 自由飞:非着陆类失误(飞过头/复飞/偏出/冲出)不强制结算,自动重新进近反复练习
  if((typeof CONFIG!=='undefined'&&CONFIG.freeFlight)&&['overfly','goaround','veeroff','overrun'].includes(reason)){
    showCallout('自由飞 · 重新进近',getC('--cyan'),'repositioning');
    setTimeout(doReset,800);
    return;
  }
  S.phase='ended';S.ended=true;
  Sound.warnTone(false);
  const td=S.touchdown;
  if(reason==='goaround'){
    showReport('—',getC('--cyan'),'已复飞 (Go-Around)',
      '你中止进近重新爬升。复飞是飞行员最重要的安全决策之一——不稳定就果断走,这是成熟而非失败。',
      [['决策','GO-AROUND','复飞离场'],['离场高度',Math.round(S.alt*M_TO_FT)+' ft','正爬升']],
      [['good','果断复飞,没有勉强一个不稳定的进近。'],['','下次:在约 1000 ft 前完成构型(襟翼全放、起落架放下、速度稳定),如仍不稳定就再走一次。']]);
    return;
  }
  if(['overfly','overrun','veeroff','crash'].includes(reason)||(reason==='stopped'&&td&&td.stall)){crashedReport(reason,td);return;}
  let score=100,notes=[];
  const gr=DF().grade;
  const fpm=td?td.vsFpm:0,xoff=td?Math.abs(td.xOff):0,tdz=td?td.zPos:0,vkt=td?td.vAtKt:0;
  if(fpm>gr.hard){score-=45;notes.push(['crit','接地下降率 '+(fpm|0)+' fpm,重着陆,起落架和乘客都不会喜欢(理想 <300)。']);}
  else if(fpm>gr.firm){score-=22;notes.push(['bad','接地下降率 '+(fpm|0)+' fpm 偏硬,入口稍早、更柔和地带杆能改善。']);}
  else if(fpm>gr.greased){score-=6;notes.push(['good','接地下降率 '+(fpm|0)+' fpm,稳健的标准着陆。']);}
  else notes.push(['good','接地下降率 '+(fpm|0)+' fpm,非常柔和的奶油落地。']);
  if(tdz<RWY.tdzStart){score-=25;notes.push(['bad','接地点距入口仅 '+(tdz|0)+' m,几乎贴着入口,余量太小。']);}
  else if(tdz>RWY.tdzEnd){score-=25;notes.push(['bad','接地点距入口 '+(tdz|0)+' m,长着陆吃掉刹车余量。']);}
  else notes.push(['good','接地点距入口 '+(tdz|0)+' m,落在接地区内(目标 '+RWY.aim+' m)。']);
  if(xoff>10){score-=20;notes.push(['bad','接地偏离中线 '+xoff.toFixed(1)+' m,横向对准需加强。']);}
  else if(xoff>4){score-=8;notes.push(['','接地偏离中线 '+xoff.toFixed(1)+' m,略偏,可更早用小坡度修正。']);}
  else notes.push(['good','接地几乎压在中线上(偏差 '+xoff.toFixed(1)+' m)。']);
  if(vkt>165){score-=12;notes.push(['','接地速度 '+(vkt|0)+' kt 偏快,容易飘和长着陆。']);}
  else if(vkt<120){score-=15;notes.push(['bad','接地速度 '+(vkt|0)+' kt 偏慢,接近失速边缘。']);}
  if(td&&td.pitch>11){score-=15;notes.push(['crit','接地仰角 '+td.pitch.toFixed(1)+'°,几乎擦机尾。']);}
  if(td&&Math.abs(td.roll)>6){score-=12;notes.push(['bad','接地坡度 '+td.roll.toFixed(1)+'°,单边轮先接地,有擦翼风险。']);}
  score=clamp(score,0,100);
  arcadeSubmit(score);
  let grade,gc,verdict;
  if(score>=93){grade='A';gc=getC('--grn');verdict='教科书级着陆';}
  else if(score>=82){grade='B';gc=getC('--grn');verdict='漂亮的着陆';}
  else if(score>=68){grade='C';gc=getC('--amb');verdict='合格,有提升空间';}
  else if(score>=50){grade='D';gc=getC('--amb');verdict='勉强落地';}
  else{grade='E';gc=getC('--red');verdict='粗糙的着陆';}
  showReport(grade,gc,verdict,
    '综合评分 '+(score|0)+'/100。着陆质量取决于稳定进近——下滑道、中线、速度在最后 30 秒都不能松手。',
    [['触地下降率',(fpm|0)+' fpm',fpm<300?'柔和':(fpm<600?'偏硬':'重着陆')],
     ['接地速度',(vkt|0)+' kt','Vref≈140'],
     ['接地点',(tdz|0)+' m','目标 '+RWY.aim+' m'],
     ['中线偏差',xoff.toFixed(1)+' m',xoff<4?'良好':'偏移']],notes);
}
function crashedReport(reason,td){
  const map={
    overfly:['飞越跑道未接地','你在跑道上空没及时接地飞过了头。下滑道偏高或拉平过早会导致此结果。'],
    overrun:['冲出跑道末端','接地后没在剩余跑道内停住。长着陆+反推/刹车不足是主因——接地后立刻全展扰流板、拉反推、踩刹车。'],
    veeroff:['冲出跑道边线','横向失控偏出跑道。接地后要持续修正保持中线。'],
    crash:['重着陆 / 失控接地','接地参数超出结构限制(下降率/坡度/仰角过大或速度过低)。'],
  };
  let info=map[reason]||['坠毁',''];
  if(reason==='stopped'&&td&&td.stall)info=['失速接地','接地前已失速,飞机是掉下来而非飞下来。保持速度在 Vref 以上。'];
  let notes=[],metrics;
  if(td){
    metrics=[['触地下降率',(td.vsFpm|0)+' fpm',td.vsFpm>600?'过大':''],['接地速度',(td.vAtKt|0)+' kt',td.vAtKt<120?'过慢':''],['接地点',(td.zPos|0)+' m',''],['中线偏差',Math.abs(td.xOff).toFixed(1)+' m','']];
    if(td.vsFpm>600)notes.push(['crit','下降率 '+(td.vsFpm|0)+' fpm 远超结构限制。']);
    if(td.vAtKt<120)notes.push(['crit','接地速度仅 '+(td.vAtKt|0)+' kt,已失速。']);
    if(Math.abs(td.roll)>10)notes.push(['crit','接地坡度 '+td.roll.toFixed(1)+'°,单轮重击。']);
    if(td.pitch>13)notes.push(['crit','仰角 '+td.pitch.toFixed(1)+'° 擦尾。']);
  }else metrics=[['结果',reason==='overfly'?'飞越':'失败',''],['高度',Math.round(S.alt*M_TO_FT)+' ft','']];
  notes.push(['','建议:从稳定进近练起——保持 3° 下滑道(PAPI 两白两红)、对准中线、速度锁定 Vref,在入口轻柔拉平。']);
  showReport('F',getC('--red'),info[0],info[1],metrics,notes);
}
function showReport(grade,gColor,verdict,sub,metrics,notes){
  $('rGrade').textContent=grade;$('rGrade').style.color=gColor;
  $('rVerdict').textContent=verdict;$('rSub').textContent=sub;
  const mEl=$('rMetrics');mEl.innerHTML='';
  metrics.forEach(m=>{const d=document.createElement('div');d.className='metric';d.innerHTML='<div class="mk">'+m[0]+'</div><div class="mv">'+m[1]+'</div><div class="mn">'+(m[2]||'')+'</div>';mEl.appendChild(d);});
  const nEl=$('rNotes');nEl.innerHTML='';
  notes.forEach(n=>{const li=document.createElement('li');li.className=n[0];li.textContent=n[1];nEl.appendChild(li);});
  repEl.classList.add('show');
}
function doReset(){
  repEl.classList.remove('show');
  ap.level='off';ap.active=false;ap.mode='track';ap.said='';ap.fd.valid=false;
  ap.axes={pitch:'auto',roll:'auto',throttle:'auto',rudder:'auto'};
  ap.engage={pitch:1,roll:1,throttle:1,rudder:1};ap.manualT={pitch:0,roll:0,throttle:0,rudder:0};
  resetState();S.started=true;
  syncThrottleUI();syncFlapUI();syncSysUI();updateStickKnob();updateRudderUI();updateEmmaBtn();
  calloutEl.classList.remove('show');
  if(typeof revealTags==='function')revealTags(4500);
}
$('rAgain').addEventListener('click',doReset);
$('btnReset').addEventListener('click',doReset);
// 3D 投影 + 外景渲染(project/drawWorld/drawTerrain/drawAirport/drawScenery/
// drawApproachLights/drawRunway/drawPAPI/drawHUD/time-of-day) 已抽到 render.js
// (在本文件之前加载)。世界画布变量 W/Hh/DPR/focal/cx/cy/world/wctx 亦在 render.js。
// PFD(气压/空速/姿态/航向/ILS) 与飞行指引十字仍在本文件下方。

//------------------ PFD ------------------
const pfd=$('pfd'),pctx=pfd.getContext('2d');
let PW=0,PH=0;
function resizePFD(){const r=pfd.parentElement.getBoundingClientRect();PW=r.width;PH=r.height;pfd.width=Math.max(1,PW*DPR);pfd.height=Math.max(1,PH*DPR);pfd.style.width=PW+'px';pfd.style.height=PH+'px';pctx.setTransform(DPR,0,0,DPR,0,0);}
function drawPFD(){
  const r=pfd.parentElement.getBoundingClientRect();if(Math.abs(r.width-PW)>1||Math.abs(r.height-PH)>1)resizePFD();
  const ctx=pctx;ctx.clearRect(0,0,PW,PH);ctx.fillStyle='#04060a';ctx.fillRect(0,0,PW,PH);
  // 电气失效:PFD 失电 → 黑屏 + 红 X "ATT FAIL"
  if(typeof ELEC!=='undefined'&&!ELEC.pfdPower()){
    ctx.fillStyle='#000';ctx.fillRect(0,0,PW,PH);
    ctx.strokeStyle='#ff4a3d';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(PW*0.2,PH*0.2);ctx.lineTo(PW*0.8,PH*0.8);ctx.moveTo(PW*0.8,PH*0.2);ctx.lineTo(PW*0.2,PH*0.8);ctx.stroke();
    ctx.fillStyle='#ff4a3d';ctx.font='700 13px '+MONO;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('ATT FAIL',PW/2,PH/2);
    return;
  }
  const fmaH=14,tw=Math.min(46,PW*0.145),bh=Math.min(26,PH*0.13),aiX=tw+5,aiY=fmaH+3,aiW=PW-tw*2-10,aiH=PH-bh-fmaH-8;
  // AC 失电(电池备份):降亮度运行(degraded)
  const dim=(typeof ELEC!=='undefined'&&!ELEC.acPower());
  if(dim)ctx.globalAlpha=0.55;
  drawAttitude(ctx,aiX,aiY,aiW,aiH);
  drawSpeedTape(ctx,3,aiY,tw-2,aiH);
  drawAltTape(ctx,PW-tw+1,aiY,tw-5,aiH);
  drawHeadingTape(ctx,aiX,PH-bh-2,aiW,bh);
  drawILS(ctx,aiX,aiY,aiW,aiH);
  drawFMA(ctx,fmaH);
  ctx.globalAlpha=1;
}
function drawFMA(ctx,h){
  ctx.fillStyle='rgba(6,10,16,.92)';ctx.fillRect(0,0,PW,h);
  ctx.font='700 8px '+MONO;ctx.textBaseline='middle';
  ctx.strokeStyle='#1b2230';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,h);ctx.lineTo(PW,h);ctx.stroke();
  if(ap.level==='off'){
    const fbwOn=(typeof FBW!=='undefined'&&typeof SYS!=='undefined'&&SYS.get('features','fbw'));
    const law=fbwOn?(FBW.law==='NORMAL'?'NORMAL LAW':'DIRECT (DEGRADED)'):'DIRECT LAW';
    ctx.textAlign='left';ctx.fillStyle='#2ee68f';ctx.fillText('MANUAL',4,h/2);
    ctx.textAlign='right';ctx.fillStyle=(fbwOn&&FBW.law==='NORMAL')?'#2ad8ff':'#ffb02e';ctx.fillText(law,PW-4,h/2);
    return;
  }
  const nm={track:'APPR',flare:'FLARE',goaround:'GO-AR',reposition:'REPOS',rollout:'ROLL'}[ap.mode]||ap.mode;
  ctx.textAlign='left';ctx.fillStyle=ap.level==='assist'?'#ffb02e':'#2ad8ff';
  ctx.fillText((ap.level==='assist'?'AST ':'EMMA ')+nm,4,h/2);
  // 四轴接管状态:P 俯仰 / R 横滚 / T 油门 / Y 偏航(脚舵)。青=EMMA飞,琥珀=你接管,灰=assist(全你飞)
  ctx.textAlign='center';
  const axes=[['P','pitch'],['R','roll'],['T','throttle'],['Y','rudder']];
  let xx=PW-9;
  for(let i=axes.length-1;i>=0;i--){
    const a=axes[i][1],auto=(ap.level==='control'&&ap.axes[a]==='auto');
    ctx.fillStyle=ap.level==='assist'?'#5a6478':(auto?'#2ad8ff':'#ffb02e');
    ctx.fillText(axes[i][0],xx,h/2); xx-=12;
  }
}
// 飞行指引十字(assist 档主用,control 档亦确认 EMMA 目标):把机头飞到两根品红指令杆交点即对准
const fdsvg=$('fdcross');
function drawFlightDirector(){
  if(ap.level==='off'||!ap.fd.valid||S.onGround){fdsvg.classList.remove('show');return;}
  const ex=clamp((ap.fd.roll-S.roll)*7,-260,260);       // 横滚误差→竖直指令杆左右
  const ey=clamp(-(ap.fd.pitch-S.pitch)*16,-150,150);   // 俯仰误差→水平指令杆上下(上=需抬头)
  const cxp=500,cyp=290,col=ap.level==='assist'?'#ffb02e':'#ff5cc8';
  let s='';
  s+='<g stroke="#ffe000" stroke-width="2.4" fill="none" opacity="0.85"><line x1="'+(cxp-46)+'" y1="'+cyp+'" x2="'+(cxp-14)+'" y2="'+cyp+'"/><line x1="'+(cxp+14)+'" y1="'+cyp+'" x2="'+(cxp+46)+'" y2="'+cyp+'"/></g>';
  s+='<circle cx="'+cxp+'" cy="'+cyp+'" r="3" fill="#ffe000" opacity="0.9"/>';
  s+='<line x1="'+(cxp-72)+'" y1="'+(cyp+ey)+'" x2="'+(cxp+72)+'" y2="'+(cyp+ey)+'" stroke="'+col+'" stroke-width="3" opacity="0.95"/>';
  s+='<line x1="'+(cxp+ex)+'" y1="'+(cyp-72)+'" x2="'+(cxp+ex)+'" y2="'+(cyp+72)+'" stroke="'+col+'" stroke-width="3" opacity="0.95"/>';
  fdsvg.innerHTML=s;fdsvg.classList.add('show');
}
function drawAttitude(ctx,x,y,w,h){
  const cxx=x+w/2,cyy=y+h/2,ppd=h/26;
  ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
  ctx.translate(cxx,cyy);ctx.rotate(-S.roll*RAD);
  const off=S.pitch*ppd,big=Math.max(w,h)*2;
  const sk=ctx.createLinearGradient(0,-big,0,off);sk.addColorStop(0,'#0e4fa0');sk.addColorStop(1,'#4a8ad4');ctx.fillStyle=sk;ctx.fillRect(-big,-big,big*2,big+off);
  const gd=ctx.createLinearGradient(0,off,0,big);gd.addColorStop(0,'#9a6a26');gd.addColorStop(1,'#5a3f18');ctx.fillStyle=gd;ctx.fillRect(-big,off,big*2,big);
  ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-big,off);ctx.lineTo(big,off);ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,.92)';ctx.fillStyle='#fff';ctx.lineWidth=1.5;ctx.font='9px '+MONO;ctx.textAlign='center';ctx.textBaseline='middle';
  for(let d=-90;d<=90;d+=10){if(d===0)continue;const ly=(S.pitch-d)*ppd;if(Math.abs(ly)>h*0.62)continue;const half=(d%20===0)?34:18;ctx.beginPath();ctx.moveTo(-half,ly);ctx.lineTo(half,ly);ctx.stroke();if(d%20===0){ctx.fillText(Math.abs(d),-half-12,ly);ctx.fillText(Math.abs(d),half+12,ly);}}
  ctx.restore();
  ctx.save();ctx.translate(cxx,cyy);ctx.strokeStyle='#fff';ctx.fillStyle='#fff';ctx.lineWidth=1.4;const aR=h*0.42;
  for(const a of[-60,-45,-30,-20,-10,0,10,20,30,45,60]){const aa=(-90+a)*RAD,r2=aR-(Math.abs(a)%30===0?9:5);ctx.beginPath();ctx.moveTo(Math.cos(aa)*aR,Math.sin(aa)*aR);ctx.lineTo(Math.cos(aa)*r2,Math.sin(aa)*r2);ctx.stroke();}
  ctx.beginPath();ctx.moveTo(0,-aR);ctx.lineTo(-7,-aR+11);ctx.lineTo(7,-aR+11);ctx.closePath();ctx.fill();
  ctx.rotate(-S.roll*RAD);ctx.fillStyle='#ffe000';ctx.beginPath();ctx.moveTo(0,-aR+12);ctx.lineTo(-6,-aR+22);ctx.lineTo(6,-aR+22);ctx.closePath();ctx.fill();ctx.restore();
  ctx.save();ctx.translate(cxx,cyy);ctx.strokeStyle='#ffe000';ctx.lineWidth=3.5;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(-w*0.30,0);ctx.lineTo(-w*0.13,0);ctx.lineTo(-w*0.10,9);ctx.moveTo(w*0.30,0);ctx.lineTo(w*0.13,0);ctx.lineTo(w*0.10,9);ctx.stroke();
  ctx.fillStyle='#ffe000';ctx.fillRect(-2.5,-2.5,5,5);ctx.restore();
  const ballY=y+h-9,ballR=w*0.16;
  ctx.strokeStyle='#56627e';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(cxx-8,ballY-5);ctx.lineTo(cxx-8,ballY+5);ctx.moveTo(cxx+8,ballY-5);ctx.lineTo(cxx+8,ballY+5);ctx.stroke();
  const bx=cxx+clamp(S.beta/14,-1,1)*ballR;
  ctx.fillStyle=Math.abs(S.beta)<2.2?'#2ee68f':'#ffe000';
  ctx.beginPath();ctx.arc(bx,ballY,4,0,7);ctx.fill();
  ctx.strokeStyle='#2a3142';ctx.lineWidth=1;ctx.strokeRect(x,y,w,h);
}
function drawSpeedTape(ctx,x,y,w,h){
  const ias=S.V*MS_TO_KT;ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.fillStyle='rgba(9,13,19,.92)';ctx.fillRect(x,y,w,h);
  const cyy=y+h/2,ppu=h/60,yStall=cyy+(ias-vStall()*MS_TO_KT)*ppu;
  ctx.fillStyle='rgba(255,70,50,.38)';if(yStall<y+h)ctx.fillRect(x,Math.max(y,yStall),w,y+h-Math.max(y,yStall));
  const yV=cyy+(ias-140)*ppu;if(yV>y&&yV<y+h){ctx.fillStyle='#2ee68f';ctx.fillRect(x,yV-1,w,2);}
  ctx.font='11px '+MONO;ctx.textBaseline='middle';const base=Math.round(ias/10)*10;
  for(let i=-4;i<=4;i++){const v=base+i*10;if(v<0)continue;const yy=cyy+(ias-v)*ppu;if(yy<y-6||yy>y+h+6)continue;ctx.strokeStyle='#3a4458';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,yy);ctx.lineTo(x+5,yy);ctx.stroke();ctx.fillStyle='#cdd6e6';ctx.textAlign='left';ctx.fillText(v,x+7,yy);}
  const tr=clamp(S.vTrend*10,-40,40);if(Math.abs(tr)>1){const yt=cyy-tr*ppu;ctx.strokeStyle='#2ee68f';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(x+w-3,cyy);ctx.lineTo(x+w-3,yt);ctx.stroke();ctx.beginPath();ctx.moveTo(x+w-3,yt);ctx.lineTo(x+w-6,yt+(tr>0?4:-4));ctx.lineTo(x+w,yt+(tr>0?4:-4));ctx.closePath();ctx.fillStyle='#2ee68f';ctx.fill();}
  ctx.restore();
  ctx.fillStyle='#0a0e15';ctx.strokeStyle=S.stall?'#ff4a3d':'#2ee68f';ctx.lineWidth=1.6;const by=y+h/2-12;ctx.fillRect(x,by,w,24);ctx.strokeRect(x,by,w,24);
  ctx.fillStyle=S.stall?'#ff4a3d':'#fff';ctx.font='700 15px '+MONO;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(Math.round(ias),x+w/2,y+h/2);
  ctx.fillStyle='#56607a';ctx.font='8px '+MONO;ctx.fillText('IAS',x+w/2,y+8);ctx.strokeStyle='#2a3142';ctx.strokeRect(x,y,w,h);
}
function drawAltTape(ctx,x,y,w,h){
  const alt=S.alt*M_TO_FT;ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.fillStyle='rgba(9,13,19,.92)';ctx.fillRect(x,y,w,h);
  const cyy=y+h/2,ppu=h/600,base=Math.round(alt/100)*100;ctx.font='10px '+MONO;ctx.textBaseline='middle';
  for(let i=-4;i<=4;i++){const v=base+i*100,yy=cyy+(alt-v)*ppu;if(yy<y-6||yy>y+h+6)continue;ctx.strokeStyle='#3a4458';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,yy);ctx.lineTo(x+5,yy);ctx.stroke();ctx.fillStyle='#cdd6e6';ctx.textAlign='left';ctx.fillText(v,x+7,yy);}
  const gy=cyy+(alt-0)*ppu;if(gy>y&&gy<y+h){ctx.strokeStyle='#ffb02e';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,gy);ctx.lineTo(x+w,gy);ctx.stroke();}
  ctx.restore();
  ctx.fillStyle='#0a0e15';ctx.strokeStyle='#2ad8ff';ctx.lineWidth=1.6;const by=y+h/2-12;ctx.fillRect(x,by,w,24);ctx.strokeRect(x,by,w,24);
  ctx.fillStyle='#fff';ctx.font='700 13px '+MONO;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(Math.round(alt),x+w/2,y+h/2);
  ctx.fillStyle='#56607a';ctx.font='8px '+MONO;ctx.fillText('ALT',x+w/2,y+8);ctx.strokeStyle='#2a3142';ctx.strokeRect(x,y,w,h);
}
function drawHeadingTape(ctx,x,y,w,h){
  ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.fillStyle='rgba(9,13,19,.92)';ctx.fillRect(x,y,w,h);
  const baseH=(typeof RWY!=='undefined'&&RWY.hdg!=null?RWY.hdg:270)+S.hdg,cxx=x+w/2,ppd=w/60;ctx.font='10px '+MONO;ctx.textBaseline='middle';ctx.textAlign='center';
  for(let d=-40;d<=40;d+=5){let hd=(baseH+d+360)%360,xx=cxx+d*ppd;if(xx<x||xx>x+w)continue;if(d%10===0){ctx.strokeStyle='#3a4458';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(xx,y);ctx.lineTo(xx,y+6);ctx.stroke();ctx.fillStyle='#cdd6e6';ctx.fillText(('0'+Math.round(hd/10)).slice(-2),xx,y+16);}else{ctx.strokeStyle='#2a3142';ctx.beginPath();ctx.moveTo(xx,y);ctx.lineTo(xx,y+3);ctx.stroke();}}
  ctx.restore();ctx.fillStyle='#ffe000';ctx.beginPath();ctx.moveTo(x+w/2,y);ctx.lineTo(x+w/2-5,y-7);ctx.lineTo(x+w/2+5,y-7);ctx.closePath();ctx.fill();ctx.strokeStyle='#2a3142';ctx.strokeRect(x,y,w,h);
}
function drawILS(ctx,x,y,w,h){
  const dthr=Math.max(50,-S.z),locDev=Math.atan2(S.x,dthr)*DEG;let gsDev=0;if(-S.z>0)gsDev=Math.atan2(S.alt,-S.z)*DEG-GS_DEG;
  const locDot=clamp(locDev/2.5,-1.1,1.1),gsDot=clamp(-gsDev/0.7,-1.1,1.1);
  const gx=x+w-9,gcy=y+h/2,gr=h*0.34;ctx.strokeStyle='#56627e';ctx.lineWidth=1;for(const dd of[-1,-.5,.5,1]){ctx.beginPath();ctx.arc(gx,gcy+dd*gr,2.2,0,7);ctx.stroke();}ctx.beginPath();ctx.moveTo(gx-6,gcy);ctx.lineTo(gx+6,gcy);ctx.stroke();
  ctx.fillStyle='#ff5cc8';let gyy=gcy+gsDot*gr;ctx.beginPath();ctx.moveTo(gx,gyy-5);ctx.lineTo(gx-5,gyy);ctx.lineTo(gx,gyy+5);ctx.lineTo(gx+5,gyy);ctx.closePath();ctx.fill();
  const ly=y+h-9,lcx=x+w/2,lr=w*0.30;ctx.strokeStyle='#56627e';for(const dd of[-1,-.5,.5,1]){ctx.beginPath();ctx.arc(lcx+dd*lr,ly,2.2,0,7);ctx.stroke();}ctx.beginPath();ctx.moveTo(lcx,ly-6);ctx.lineTo(lcx,ly+6);ctx.stroke();
  ctx.fillStyle='#ff5cc8';let lxx=lcx+locDot*lr;ctx.beginPath();ctx.moveTo(lxx-5,ly);ctx.lineTo(lxx,ly-5);ctx.lineTo(lxx+5,ly);ctx.lineTo(lxx,ly+5);ctx.closePath();ctx.fill();
}

//==================================================================
// 运行期 UI + 主循环
//==================================================================
// EICAS:按发动机数动态生成 N1 列(2 或 4 发),每列 N1 条+数值+EGT
function renderEICAS(){
  const m=$('n1mod'); if(!m||typeof ENGINES==='undefined'||!ENGINES.list.length)return;
  let h='<div class="lbl" style="margin-bottom:5px;">N1 % · '+ENGINES.count+' ENG</div><div class="n1row">';
  for(const e of ENGINES.list){
    h+='<div class="n1unit"><div class="n1bar"><div class="n1redline"></div><div class="n1fill" id="n1fill'+e.id+'"></div></div>'
      +'<div class="n1num" id="n1num'+e.id+'">'+Math.round(e.n1*100)+'</div>'
      +'<div class="n1tag">E'+e.id+'</div>'
      +'<div class="egtnum" id="egt'+e.id+'">'+Math.round(e.egt)+'°</div></div>';
  }
  m.innerHTML=h+'</div>';
}
function syncRuntimeUI(){
  const avg=Math.round((typeof ENGINES!=='undefined'&&ENGINES.list.length?ENGINES.avgN1():S.N1)*100);
  $('thrN1').textContent=avg+'%';
  if(typeof ENGINES!=='undefined'&&ENGINES.list.length){
    const rev=S.reverse&&S.onGround;
    for(const e of ENGINES.list){
      const f=$('n1fill'+e.id),nu=$('n1num'+e.id),eg=$('egt'+e.id);
      if(f){f.style.height=Math.round(e.n1*100)+'%';f.classList.toggle('rev',rev&&e.state==='run');f.classList.toggle('failed',e.state==='fail'||e.state==='off');}
      if(nu){nu.textContent=Math.round(e.n1*100);nu.classList.toggle('failed',e.state==='fail'||e.state==='off');}
      if(eg){eg.textContent=Math.round(e.egt)+'°';eg.classList.toggle('hot',e.egt>850);}
    }
  } else { const n1=avg; const f1=$('n1fillL'),f2=$('n1fillR');if(f1)f1.style.height=n1+'%';if(f2)f2.style.height=n1+'%'; }
  const pm={approach:'进近',flare:'拉平',rollout:'滑跑',goaround:'复飞',ended:'结束'};
  $('phasetxt').textContent=pm[S.phase]||S.phase;
  $('phaseBadge').classList.toggle('warn',S.phase==='flare'||S.phase==='goaround');
  if(S.phase!==_lastPhase){_lastPhase=S.phase;revealTags();}   // 相位变化短暂回显信息角标
  if(typeof PANELS!=='undefined')PANELS.sync();                // 刷新当前打开面板读数
}
let _lastPhase='';
//------------------ 主警告/警戒灯 + 警告音 + 消音(recall) ------------------
const mWarn=$('mWarn'),mCaut=$('mCaut');
const masterAck={warn:false,caut:false};
let _alertTimer=null;
function setAlert(on){
  if(on&&!_alertTimer){_alertTimer=setInterval(()=>Sound.blip(880,0.18),900);Sound.blip(880,0.18);}
  else if(!on&&_alertTimer){clearInterval(_alertTimer);_alertTimer=null;}
}
function updateMaster(){
  if(typeof FAILURES==='undefined')return;
  const w=FAILURES.hasWarning(), c=FAILURES.hasCaution();
  if(!w)masterAck.warn=false; if(!c)masterAck.caut=false;   // 故障消失则 recall 复位
  if(mWarn)mWarn.classList.toggle('on',w&&!masterAck.warn);
  if(mCaut)mCaut.classList.toggle('on',c&&!masterAck.caut);
  setAlert(w&&!masterAck.warn);                              // 仅 warning 级响警告音
}
if(mWarn)mWarn.addEventListener('click',()=>{masterAck.warn=true;updateMaster();});
if(mCaut)mCaut.addEventListener('click',()=>{masterAck.caut=true;updateMaster();});

// FPS 计数(滑动平均)+ 渲染统计显示
let _fps=0,_fpsAcc=0,_fpsN=0;const fpsHud=$('fpsHud');
function updateFpsHud(){
  if(!fpsHud)return;
  const on=(typeof SYS!=='undefined'&&SYS.get('features','fpsHud'));
  fpsHud.style.display=on?'block':'none';
  if(on){const rs=(typeof RSTATS!=='undefined')?RSTATS:{gen:0,drawn:0,culled:0};
    fpsHud.textContent='FPS '+_fps+' · 对象 '+rs.drawn+'/'+rs.gen+' (剔'+rs.culled+')';}
}
let last=performance.now(),acc=0;const STEP=1/120;
function loop(now){
  let dt=(now-last)/1000;last=now;if(dt>0.1)dt=0.1;
  _fpsAcc+=dt;_fpsN++;if(_fpsAcc>=0.5){_fps=Math.round(_fpsN/_fpsAcc);_fpsAcc=0;_fpsN=0;updateFpsHud();}
  try{
    pollInputs();acc+=dt;let n=0;
    while(acc>=STEP&&n<8){if(ap.level!=='off')autopilot(STEP);updatePhysics(STEP);acc-=STEP;n++;}
    if(acc>STEP)acc=0;
    if(typeof FAILURES!=='undefined'){ FAILURES.step(dt); if(S.started&&S.phase!=='ended')FAILURES.randomInject(dt); }   // 推进故障连锁 + MTBF 随机注入
    if(typeof SPATIAL!=='undefined')SPATIAL.update(dt,S);   // 空间迷向错觉(只偏外景,PFD 真实)
    if(typeof TUTORIAL!=='undefined')TUTORIAL.update(S,dt); // 新手教学逐帧检测完成→自动进下一步
    Sound.update(dt); updateMaster();
    syncRuntimeUI();drawWorld();drawPFD();drawFlightDirector();
  }catch(err){console.error(err);}
  requestAnimationFrame(loop);
}

//==================================================================
// 弹层 / 设置 / 启动
//==================================================================
const splashEl=$('splash'),helpEl=$('help'),btnSound=$('btnSound'),swSound=$('swSound');
// HUD 精简:飞行中自动隐藏顶部信息角标,腾出飞行视野
const appEl=$('app');
let hudAutoHide=true,_tagsTimer=null;
function revealTags(holdMs){
  if(!appEl)return;
  appEl.classList.remove('tags-hidden');
  clearTimeout(_tagsTimer);
  if(hudAutoHide&&S.started&&S.phase!=='ended')_tagsTimer=setTimeout(()=>appEl.classList.add('tags-hidden'),holdMs||3500);
}
function startFlight(){
  splashEl.classList.remove('show');
  S.started=true;
  Sound.init();Sound.resume();Sound.setMaster();
  revealTags(4500);
  setTimeout(()=>Sound.say('cleared to land, runway two seven'),300);
  if(typeof TUTORIAL!=='undefined'&&typeof SYS!=='undefined'&&SYS.get('features','tutorial'))TUTORIAL.start();
}
$('startBtn').addEventListener('click',startFlight);
$('helpHint').addEventListener('click',()=>helpEl.classList.add('show'));
$('btnHelp').addEventListener('click',()=>{Sound.init();Sound.resume();helpEl.classList.add('show');});
$('helpClose').addEventListener('click',()=>helpEl.classList.remove('show'));
function setSoundIcon(){btnSound.style.color=cfg.sound?getC('--grn'):getC('--ink-dim');$('sndWave').style.opacity=cfg.sound?'1':'0.2';}
function toggleSound(){cfg.sound=!cfg.sound;swSound.classList.toggle('on',cfg.sound);Sound.init();Sound.resume();Sound.setMaster();setSoundIcon();if(!cfg.sound&&'speechSynthesis'in window)window.speechSynthesis.cancel();}
btnSound.addEventListener('click',toggleSound);
swSound.addEventListener('click',toggleSound);
swGyro.addEventListener('click',()=>{const on=!swGyro.classList.contains('on');swGyro.classList.toggle('on',on);if(on)enableGyro();else disableGyro();});
$('swInvert').addEventListener('click',()=>{cfg.invertPitch=!cfg.invertPitch;$('swInvert').classList.toggle('on',cfg.invertPitch);setPitchRaw(S.pitchInRaw);});
$('swTurb').addEventListener('click',()=>{cfg.turb=!cfg.turb;$('swTurb').classList.toggle('on',cfg.turb);if(typeof SYS!=='undefined')SYS.set('features','turbulence',cfg.turb);if(typeof applyConfig==='function')applyConfig();});
$('swClean').addEventListener('click',()=>{hudAutoHide=!hudAutoHide;$('swClean').classList.toggle('on',hudAutoHide);if(typeof SYS!=='undefined')SYS.set('features','cleanHud',hudAutoHide);if(hudAutoHide)revealTags();else{clearTimeout(_tagsTimer);appEl.classList.remove('tags-hidden');}});
window.setHudClean=function(on){hudAutoHide=on;$('swClean').classList.toggle('on',on);if(on)revealTags();else{clearTimeout(_tagsTimer);appEl.classList.remove('tags-hidden');}};   // 供系统总控面板调
// 新手教学开关:开则飞行中即起教学,关则收起浮层(系统总控面板亦可调,见 systems.js)
$('swTut').addEventListener('click',()=>{
  const on=!$('swTut').classList.contains('on');
  $('swTut').classList.toggle('on',on);
  if(typeof SYS!=='undefined')SYS.set('features','tutorial',on);
  if(typeof TUTORIAL!=='undefined'){ if(on&&S.started)TUTORIAL.start(); else if(!on)TUTORIAL.stop(); }
});
window.setTutorial=function(on){ $('swTut').classList.toggle('on',on); if(typeof TUTORIAL!=='undefined'){ if(on&&S.started)TUTORIAL.start(); else if(!on)TUTORIAL.stop(); } };
// 设备三屏手动覆盖
document.querySelectorAll('.seg-opt[data-dev]').forEach(s=>{
  s.addEventListener('click',()=>{
    const d=s.dataset.dev;
    DeviceMode.setForced(DeviceMode.forced===d?null:d); // 再点同档 = 取消手动,回自动
  });
});
// 时段切换(黄昏/正午/夜间) — 影响 render.js 的 tod() 调色板
const TOD_KEY='fa.tod';
function setTod(t){
  cfg.tod=t;try{localStorage.setItem(TOD_KEY,t);}catch(_){}
  document.querySelectorAll('.seg-opt[data-tod]').forEach(s=>s.classList.toggle('on',s.dataset.tod===t));
}
document.querySelectorAll('.seg-opt[data-tod]').forEach(s=>s.addEventListener('click',()=>setTod(s.dataset.tod)));
try{const tv=localStorage.getItem(TOD_KEY);if(tv==='dusk'||tv==='noon'||tv==='night')setTod(tv);}catch(_){}

//------------------ 飞行设置面板(难度/起始/风/自由飞) ------------------
const configEl=$('config');
function updateWindUI(){
  const v=$('cfgWindVal');if(v)v.textContent=CONFIG.windDir+'° / '+CONFIG.windSpeed+' kt';
  const wb=$('windBadge');if(wb)wb.innerHTML='风 <b>'+CONFIG.windDir+'/'+('0'+CONFIG.windSpeed).slice(-2)+'</b>'+(curDiff().shear?' 切变':' 阵风');
  const bw=$('briefWind');if(bw)bw.textContent=CONFIG.windDir+'/'+('0'+CONFIG.windSpeed).slice(-2);
}
function updateAcUI(){
  const v=$('cfgAcVal'); if(v&&typeof AIRCRAFT!=='undefined'){ const a=AIRCRAFT[CONFIG.aircraft]||AIRCRAFT.narrow; v.textContent=a.name+' · Vref '+a.vref; }
}
function updateAirportUI(){
  if(typeof RWY==='undefined')return;
  const v=$('cfgApVal'); if(v)v.textContent=(RWY.aptName||'维加国际')+' '+(RWY.icao||'ZVGA')+' · RWY '+(RWY.name||'27');
  const b=$('apprBadge'); if(b)b.innerHTML='APPR · RWY <b>'+(RWY.name||'27')+'</b> · ILS '+(RWY.ils||'110.30');
}
function syncConfigUI(){
  document.querySelectorAll('.seg-opt[data-diff]').forEach(s=>s.classList.toggle('on',s.dataset.diff===CONFIG.diff));
  document.querySelectorAll('.seg-opt[data-start]').forEach(s=>s.classList.toggle('on',s.dataset.start===CONFIG.start));
  document.querySelectorAll('.seg-opt[data-ap]').forEach(s=>s.classList.toggle('on',s.dataset.ap===CONFIG.airport));
  document.querySelectorAll('.seg-opt[data-ac]').forEach(s=>s.classList.toggle('on',s.dataset.ac===CONFIG.aircraft));
  document.querySelectorAll('.seg-opt[data-eng]').forEach(s=>s.classList.toggle('on',+s.dataset.eng===CONFIG.engines));
  document.querySelectorAll('.seg-opt[data-wx]').forEach(s=>s.classList.toggle('on',s.dataset.wx===CONFIG.weather));
  updateAcUI(); updateAirportUI();
  const ws=$('cfgWindSpeed');if(ws)ws.value=CONFIG.windSpeed;
  const wd=$('cfgWindDir');if(wd)wd.value=CONFIG.windDir;
  $('swFree').classList.toggle('on',CONFIG.freeFlight);
  updateWindUI();
}
document.querySelectorAll('.seg-opt[data-diff]').forEach(s=>s.addEventListener('click',()=>{applyDifficulty(s.dataset.diff);syncConfigUI();}));
document.querySelectorAll('.seg-opt[data-start]').forEach(s=>s.addEventListener('click',()=>{CONFIG.start=s.dataset.start;saveConfig();syncConfigUI();}));
document.querySelectorAll('.seg-opt[data-ap]').forEach(s=>s.addEventListener('click',()=>{
  CONFIG.airport=s.dataset.ap;
  if(typeof applyAirport==='function')applyAirport(CONFIG.airport);   // 逐字段写 RWY + WPTS + PAPI
  resetState();                                                       // 按新机场重置(标高/航路)
  saveConfig(); syncConfigUI(); updateAirportUI();
}));
document.querySelectorAll('.seg-opt[data-ac]').forEach(s=>s.addEventListener('click',()=>{
  CONFIG.aircraft=s.dataset.ac;
  if(typeof applyAircraft==='function')applyAircraft(CONFIG.aircraft);   // 逐字段写 AC + 发动机数 + 燃油容量
  resetState();                                                          // 按新机型 vref 重置起始速度/状态
  saveConfig(); syncConfigUI(); syncSysUI();
}));
document.querySelectorAll('.seg-opt[data-eng]').forEach(s=>s.addEventListener('click',()=>{CONFIG.engines=+s.dataset.eng;saveConfig();if(typeof ENGINES!=='undefined'){ENGINES.setCount(CONFIG.engines);resetState();}syncConfigUI();}));
document.querySelectorAll('.seg-opt[data-wx]').forEach(s=>s.addEventListener('click',()=>{CONFIG.weather=s.dataset.wx;if(typeof WEATHER!=='undefined')WEATHER.preset(CONFIG.weather);saveConfig();syncConfigUI();}));
$('cfgWindSpeed').addEventListener('input',e=>{CONFIG.windSpeed=+e.target.value;applyConfig();updateWindUI();});
$('cfgWindDir').addEventListener('input',e=>{CONFIG.windDir=+e.target.value;applyConfig();updateWindUI();});
$('swFree').addEventListener('click',()=>{CONFIG.freeFlight=!CONFIG.freeFlight;$('swFree').classList.toggle('on',CONFIG.freeFlight);saveConfig();});
$('cfgHint').addEventListener('click',()=>{syncConfigUI();configEl.classList.add('show');});
$('cfgBack').addEventListener('click',()=>configEl.classList.remove('show'));
$('cfgStart').addEventListener('click',()=>{
  applyConfig();configEl.classList.remove('show');
  doReset();                     // 按新起始/天气重置并起飞
  startFlight();
});

window.addEventListener('resize',()=>{DeviceMode.apply();setLayout();resizeWorld();resizePFD();});
window.addEventListener('orientationchange',()=>setTimeout(()=>{DeviceMode.apply();setLayout();resizeWorld();resizePFD();},200));

// 初始化
if(typeof loadConfig==='function'){loadConfig();applyConfig();resetState();S.started=false;}
// 中央 SYS 开关注册表:让已实现功能受 SYS 统一管辖(FA组15 总控面板的基础)
if(typeof SYS!=='undefined'){
  cfg.turb=SYS.get('features','turbulence');
  hudAutoHide=SYS.get('features','cleanHud');
  if(typeof CONFIG!=='undefined')CONFIG.freeFlight=SYS.get('features','freeFlight');
  cfg.sound=SYS.get('features','sound');
  $('swTurb').classList.toggle('on',cfg.turb);
  $('swClean').classList.toggle('on',hudAutoHide);
  $('swSound').classList.toggle('on',cfg.sound);
  $('swTut').classList.toggle('on',SYS.get('features','tutorial'));
  if(typeof applyConfig==='function')applyConfig();
}
// 多发引擎:按配置初始化发动机数(默认 2,可配 4)+ 渲染 EICAS
if(typeof ENGINES!=='undefined'){ ENGINES.setCount((typeof CONFIG!=='undefined'&&CONFIG.engines)||2); resetState(); }
// 面板框架:建选择器 tab 条(飞行 + 引擎 + 后续数十种面板)
if(typeof PANELS!=='undefined')PANELS.init();
DeviceMode.init();
if(typeof syncConfigUI==='function')syncConfigUI();
setLayout();resizeWorld();resizePFD();
syncThrottleUI();syncFlapUI();syncSysUI();updateStickKnob();updateRudderUI();updateEmmaBtn();setSoundIcon();
requestAnimationFrame(loop);
