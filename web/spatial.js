"use strict";
//==================================================================
// SPATIAL — 空间迷向(前庭错觉)  ·  独立模块
//   无外参照(夜/IMC/缺地标)时身体姿态感知漂移:倾斜错觉 leans + 躯体重力错觉。
//   错觉只偏"外景视觉"(render 相机),PFD 姿态仪用真实姿态——信仪表才正。
//   依赖 game.js/render 运行期:clamp/lerp/M_TO_FT/cfg/WEATHER/SYS/S。
//==================================================================
const SPATIAL={
  leanRoll:0,        // 倾斜错觉:外景视觉横滚偏置(度)
  somatoPitch:0,     // 躯体重力错觉:外景视觉俯仰偏置(度,加速→感觉抬头)
  refLoss:0,         // 无外参照度 0..1
  _lastV:null,
  reset(){ this.leanRoll=0;this.somatoPitch=0;this.refLoss=0;this._lastV=null; },
  active(){ return (typeof SYS==='undefined')||SYS.get('env','spatialD'); },
  update(dt,S){
    if(!this.active()){ this.leanRoll=lerp(this.leanRoll,0,Math.min(1,dt*2));this.somatoPitch=lerp(this.somatoPitch,0,Math.min(1,dt*2));this.refLoss=0;return; }
    // 无外参照度:夜 + 低能见/云中 + (高空缺地标)
    let rl=0;
    const night=(typeof cfg!=='undefined'&&cfg.tod==='night');
    const vis=(typeof WEATHER!=='undefined')?WEATHER.visibility:10000;
    const ceil=(typeof WEATHER!=='undefined')?WEATHER.ceiling:5000;
    const altft=S.alt*M_TO_FT;
    if(night)rl+=0.5;
    if(vis<3500)rl+=0.5*clamp((3500-vis)/3000,0,1);
    if(altft>ceil)rl+=0.4;                              // 云中
    this.refLoss=clamp(rl,0,1);
    if(this.refLoss>0.2){
      const maxLean=this.refLoss*9;                     // 错觉最大幅度(度)
      // 倾斜错觉 leans:缓慢游走的横滚错觉偏置(感觉水平实则缓坡)
      const tgt=Math.sin((S.t||0)*0.11+0.7)*maxLean;
      this.leanRoll=lerp(this.leanRoll,tgt,Math.min(1,dt*0.25));
      // 躯体重力错觉:加速度→俯仰错觉(加速感觉抬头)
      const accel=(S.V-(this._lastV!=null?this._lastV:S.V))/Math.max(dt,1e-3);
      this.somatoPitch=lerp(this.somatoPitch,clamp(accel*0.5,-7,7)*this.refLoss,Math.min(1,dt*0.6));
    } else {
      this.leanRoll=lerp(this.leanRoll,0,Math.min(1,dt*0.5));
      this.somatoPitch=lerp(this.somatoPitch,0,Math.min(1,dt*0.5));
    }
    this._lastV=S.V;
  },
};
if(typeof window!=='undefined')window.SPATIAL=SPATIAL;
