"use strict";
//==================================================================
// FBW — 电传飞控(fly-by-wire)  ·  独立模块
//   正常法则:侧杆 = 需求(俯仰 load factor / 横滚 rate),松杆保持(1g 航迹 / 坡度)。
//   包线保护:bank≤67° / pitch 限 / α-floor 失速 / overspeed。
//   液压或电气失则降级直接法则。SYS.features.fbw 开关。
//   依赖 game.js 运行期全局:clamp/RAD/DEG/AC/MS_TO_KT/HYD/ELEC。
//==================================================================
const FBW={
  gT:null,                 // 保持的飞行路径角(1g 航迹)
  law:'NORMAL',            // NORMAL / DIRECT(降级)
  BANK_SOFT:33, BANK_HARD:67, PITCH_MIN:-15, PITCH_MAX:30, PRATE:9, RRATE:36,
  reset(){ this.gT=null; this.law='NORMAL'; },
  // 是否降级直接法则(液压低 / 交流失电)
  degraded(){ return ((typeof HYD!=='undefined'&&HYD.ctrlGain()<0.6) || (typeof ELEC!=='undefined'&&!ELEC.acPower())); },
  // 正常法则:更新 S.pitch / S.roll。返回是否生效(false=应走直接法则)
  apply(S,pitchIn,rollIn,dt,hg){
    if(this.degraded()){ this.law='DIRECT'; return false; }
    this.law='NORMAL';
    const gammaDeg=S.gamma*DEG, aoa=S.pitch-gammaDeg;
    const stallA=AC.aoaStall+AC.flapStallBonus[S.flaps];
    // —— 横滚:rate 需求 + 松杆保持坡度 + 软/硬限保护 ——
    if(Math.abs(rollIn)>0.03){ S.roll+=rollIn*this.RRATE*dt*hg; }
    else if(Math.abs(S.roll)>this.BANK_SOFT){           // 松杆超软限→自动回到软限(保护)
      S.roll-=Math.sign(S.roll)*Math.min(Math.abs(S.roll)-this.BANK_SOFT,this.RRATE*0.4*dt);
    }                                                    // 软限内松杆=保持坡度(不回中,与直接法则不同)
    S.roll=clamp(S.roll,-this.BANK_HARD,this.BANK_HARD); // 硬限 67°
    // —— 俯仰:load factor 需求 / 松杆 1g 保持航迹 ——
    if(Math.abs(pitchIn)>0.03){ S.pitch+=pitchIn*this.PRATE*dt*hg; this.gT=S.gamma; }
    else {
      if(this.gT===null)this.gT=S.gamma;
      const err=(this.gT-S.gamma)*DEG;                   // 1g:调俯仰使航迹角回到保持值
      S.pitch+=clamp(err*0.6,-this.PRATE,this.PRATE)*dt;
    }
    // —— α-floor 失速保护:高迎角禁继续抬头并自动微下压 ——
    if(aoa>stallA-2){ if(pitchIn>0.03)S.pitch-=(aoa-(stallA-2))*0.4*dt; this.gT=S.gamma; }
    // —— overspeed 保护:超速自动抬头减速 ——
    const vkt=S.V*MS_TO_KT;
    if(vkt>185)S.pitch+=(vkt-185)*0.02*dt;
    S.pitch=clamp(S.pitch,this.PITCH_MIN,this.PITCH_MAX);
    return true;
  },
};
if(typeof window!=='undefined')window.FBW=FBW;
