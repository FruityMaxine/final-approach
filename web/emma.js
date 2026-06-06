"use strict";
//==================================================================
// EMMA — AI 副驾(分轴接管)  ·  独立模块
//   依赖 game.js 提供的全局:S/AC/RWY/GS_DEG/WIND/crosswindAt/clamp/lerp/
//   RAD/DEG/M_TO_FT/MS_TO_KT/MS_TO_FPM/Sound/getC/showCallout/
//   syncThrottleUI/syncFlapUI/syncSysUI/updateStickKnob/updateRudderUI/
//   updateEmmaBtn/setPitchRaw  —— 这些在 game.js 顶层声明,运行期可见。
//   本文件只做纯定义,顶层不触碰外部全局,故加载顺序在 game.js 之前亦安全。
//==================================================================

// 接管等级:off(全手动) / control(EMMA 飞,分轴可夺) / assist(只给飞行指引十字,不抢杆)
// 每根轴独立:pitch/roll/throttle/rudder 各自 'auto'(EMMA) 或 'manual'(你)
const EMMA={ RETAKE_SEC:3.0, RAMP_SEC:1.5 };
const ap={
  level:'off',          // off | control | assist
  active:false,         // = (level==='control'),供物理/渲染快速判断
  mode:'track',         // 子模式 track/flare/goaround/reposition/rollout
  t:0, said:'',
  axes:{pitch:'auto',roll:'auto',throttle:'auto',rudder:'auto'},
  manualT:{pitch:0,roll:0,throttle:0,rudder:0},   // 该轴脱离输入的累计秒
  engage:{pitch:1,roll:1,throttle:1,rudder:1},    // 接管渐入 0→1(消开头抖动)
  fd:{pitch:0,roll:0,valid:false},                // 飞行指引目标(给 assist 十字)
};

function emmaSay(t){ if(ap.said!==t){ ap.said=t; showCallout('EMMA',getC('--cyan')); Sound.say(t); setTimeout(()=>{if(ap.said===t)ap.said='';},1600);} }

// —— 分轴:把某轴标记为手动并复位计时(任何用户输入调用) ——
function grabAxis(axis){
  if(ap.level==='off')return;       // 全手动时无所谓接管
  ap.manualT[axis]=0;
  if(ap.axes[axis]!=='manual'){
    ap.axes[axis]='manual';
    if(ap.level==='control')Sound.blip(300,0.05);   // 轻提示:你接过这根轴
  }
}
// —— 每帧推进各轴计时;手动轴静默超时 → 自动交还 EMMA(带渐入) ——
function emmaAxisTimers(dt){
  if(ap.level!=='control')return;
  for(const a of ['pitch','roll','throttle','rudder']){
    if(ap.axes[a]==='manual'){
      ap.manualT[a]+=dt;
      if(ap.manualT[a]>EMMA.RETAKE_SEC){
        ap.axes[a]='auto'; ap.engage[a]=0;          // 渐入复位,消抖
      }
    }
  }
}
function allAuto(){ ap.axes.pitch='auto';ap.axes.roll='auto';ap.axes.throttle='auto';ap.axes.rudder='auto'; }

// —— 三档循环:off → control → assist → off ——
function setEmmaLevel(level){
  ap.level=level; ap.active=(level==='control'); ap.said='';
  if(level==='control'){
    ap.t=0; allAuto();
    ap.engage={pitch:0,roll:0,throttle:0,rudder:0};   // 全轴渐入,杜绝开头抖动
    const altft=S.alt*M_TO_FT,vkt=S.V*MS_TO_KT,vs=S.V*Math.sin(S.gamma)*MS_TO_FPM;
    ap.mode=(S.stall||vkt<116||(altft<300&&Math.abs(S.x)>50)||(altft<40&&vs<-900))?'goaround':'track';
    showCallout('EMMA HAS CONTROL',getC('--cyan'),'i have control');
  }else if(level==='assist'){
    ap.t=0; ap.fd.valid=false;
    showCallout('EMMA ASSIST · 飞行指引',getC('--amb'),'flight director');
  }else{ // off
    S.reverse=false;S.brake=false;ap.fd.valid=false;
    showCallout('YOU HAVE CONTROL',getC('--amb'),'manual');
  }
  updateEmmaBtn();syncSysUI();
}
function cycleEMMA(){ setEmmaLevel(ap.level==='off'?'control':(ap.level==='control'?'assist':'off')); }
// 兼容旧名:giveAP=进 control;releaseAP=回 off
function giveAP(){ setEmmaLevel('control'); }
function releaseAP(){ if(ap.level!=='off')setEmmaLevel('off'); }

//==================================================================
// 自驾计算:算各轴目标 → 仅写 auto 轴(乘渐入增益) → 存飞行指引
//==================================================================
function autopilot(dt){
  if(ap.level==='off')return;
  ap.t+=dt;
  emmaAxisTimers(dt);
  // auto 轴渐入增益爬升
  for(const a of ['pitch','roll','throttle','rudder'])
    if(ap.axes[a]==='auto')ap.engage[a]=Math.min(1,ap.engage[a]+dt/EMMA.RAMP_SEC);

  const altft=S.alt*M_TO_FT, vkt=S.V*MS_TO_KT, distToThr=Math.max(1,-S.z);
  const gsDeg=S.z<0?Math.atan2(S.alt,distToThr)*DEG:0, onGS=gsDeg-GS_DEG;
  const cw=crosswindAt(S.alt), latGS=S.V*Math.sin(S.hdg*RAD)+cw;
  const drive=(ap.level==='control');   // assist 只算 FD 不写舵面

  // 把目标姿态/舵量按轴施加;auto 轴才写,manual 轴留给用户;assist 全不写
  function applyTargets(tP,tR,tRud,tThr){
    ap.fd.pitch=tP; ap.fd.roll=tR; ap.fd.valid=true;   // 飞行指引始终记录
    if(!drive)return;
    if(ap.axes.pitch==='auto'){ const g=ap.engage.pitch; S.pitchIn=clamp((tP-S.pitch)*0.6,-1,1)*g; S.pitchInRaw=S.pitchIn; }
    if(ap.axes.roll==='auto'){ const g=ap.engage.roll; S.rollIn=clamp((tR-S.roll)*0.12,-1,1)*g; }
    if(ap.axes.rudder==='auto'){ const g=ap.engage.rudder; S.rudder=lerp(S.rudder,clamp(tRud,-1,1),Math.min(1,dt*4)*g); }
    if(ap.axes.throttle==='auto'){ const g=ap.engage.throttle; S.throttle=clamp(lerp(S.throttle,tThr,Math.min(1,dt*2.2)*g),0,1); syncThrottleUI(); }
    updateStickKnob();updateRudderUI();
  }

  // 地面滑跑:反推+刹车+脚舵保持中线
  if(S.onGround){ ap.mode='rollout';
    if(drive){ S.reverse=true; S.brake=(vkt>35); syncSysUI(); }
    applyTargets(0.5,0,clamp(-S.x*0.06-S.hdg*0.12,-1,1),0); return; }
  // 重新进近:平滑回到进近起点(仅 control)
  if(ap.mode==='reposition'){
    if(!drive){ ap.mode='track'; return; }
    const k=Math.min(1,dt*0.7);
    S.z=lerp(S.z,-4520,k);S.alt=lerp(S.alt,245,k);S.x=lerp(S.x,0,k);S.V=lerp(S.V,72,k);
    S.hdg=lerp(S.hdg,0,k);S.pitch=lerp(S.pitch,4,k);S.roll=lerp(S.roll,0,k);
    S.gamma=lerp(S.gamma,-3*RAD,k);S.N1=lerp(S.N1,0.25,k);S.throttle=lerp(S.throttle,0.20,k);S.beta=lerp(S.beta,0,k);
    S.flaps=2;S.gearDown=true;S.spoilerOut=false;S.spoilerArmed=true;
    syncThrottleUI();syncFlapUI();syncSysUI();
    if(Math.abs(S.z+4520)<80){ ap.mode='track'; S.phase='approach'; S.calls={}; S.lastBand=9999; emmaSay('established'); }
    return;
  }
  // 复飞爬升
  if(ap.mode==='goaround'){ if(drive)S.gearDown=true; if(drive)S.phase='goaround';
    applyTargets(12,0,clamp(-S.hdg*0.1,-1,1),1.0);
    if(altft>900){ ap.mode='reposition'; emmaSay('repositioning for approach'); } return; }
  // 包线判定 → 不可救则复飞
  const unsafe=S.stall||vkt<116||(altft<500&&Math.abs(S.x)>55)||(altft<300&&onGS>1.7)||(altft<240&&Math.abs(S.x)>32&&Math.abs(latGS)>3);
  if(unsafe&&altft>40&&drive){ ap.mode='goaround'; emmaSay('go around'); applyTargets(12,0,0,1.0); return; }
  // 拉平:渐抬机头 + decrab 蹬正 + 收油
  if(altft<32){ ap.mode='flare';
    const tp=lerp(4.5,7.0,clamp((32-altft)/26,0,1));
    applyTargets(tp,0,clamp(-S.hdg*0.5-S.x*0.02,-1,1),0.0); return; }
  // 跟踪:速度环/下滑道环/中线环(含侧风修正)/协调
  ap.mode='track'; if(drive)S.phase=(altft<120?'flare':'approach');
  const tThr=clamp(0.20-(vkt-140)*0.018,0,0.55);
  const tGamma=clamp(-GS_DEG-onGS*0.9,-5,-1.2)*RAD;
  const tPitch=clamp(S.pitch+(tGamma-S.gamma)*DEG*0.35,0.5,9);
  const tRoll=clamp(-S.x*0.85-latGS*3.2,-16,16);
  const tRud=clamp(-S.beta*0.04-S.hdg*0.03,-0.6,0.6);
  applyTargets(tPitch,tRoll,tRud,tThr);
}
