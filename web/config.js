"use strict";
//==================================================================
// CONFIG — 难度预设 / 起始位置 / 天气 / 可配置项  ·  独立模块
//   依赖 game.js 全局(运行期):WIND/cfg/RAD/MS_TO_KT。本文件顶层只字面量+函数定义,
//   不触碰外部全局,加载顺序在 game.js 之前安全。
//==================================================================

// 三档难度:影响风/湍流/容差/失速余度/讲评阈值/EMMA 提示。对标微软模拟飞行的硬核但不更硬核。
const DIFF={
  rookie:{ name:'新手', windSpeed:4, gust:0.35, shear:false, emmaHint:true,
           stallMarginKt:9,          // 失速速度再降的余度(越大越不易失速)
           veerEnd:16, overflyEnd:2400, grassMu:0.06,
           crashFpm:1300, crashRoll:15, crashPitch:16, crashVkt:92, failRate:0,
           grade:{greased:200,firm:520,hard:820} },   // 讲评宽容
  real:{   name:'真实', windSpeed:8, gust:1.0, shear:false, emmaHint:false,
           stallMarginKt:0,
           veerEnd:9, overflyEnd:1500, grassMu:0.10,
           crashFpm:1000, crashRoll:11, crashPitch:14, crashVkt:100, failRate:0.004,
           grade:{greased:170,firm:360,hard:600} },
  hard:{   name:'硬核', windSpeed:16, gust:1.7, shear:true, emmaHint:false,
           stallMarginKt:-3,
           veerEnd:5, overflyEnd:900, grassMu:0.14,
           crashFpm:850, crashRoll:9, crashPitch:13, crashVkt:104, failRate:0.02,
           grade:{greased:150,firm:300,hard:540} },
};
// 起始位置:延长完整飞行体验,别一上来就贴地。z 负=跑道前距离(m),alt(m),V(m/s)
const STARTS={
  short:{  name:'短五边', z:-4520,  alt:245, V:72, label:'2.5 NM · 800 ft' },
  long:{   name:'长五边', z:-9200,  alt:520, V:80, label:'5 NM · 1700 ft' },
  cruise:{ name:'高位切入', z:-14500, alt:820, V:92, label:'7.8 NM · 2700 ft' },
};
// 当前配置(localStorage 持久化)
const CONFIG={ diff:'real', start:'short', windDir:280, windSpeed:8, freeFlight:false, engines:2, weather:'clear', aircraft:'narrow', airport:'vega', rwySel:0, circleApp:false };
const CFG_KEY='fa.config';

function curDiff(){ return DIFF[CONFIG.diff]||DIFF.real; }
function curStart(){ return STARTS[CONFIG.start]||STARTS.short; }

// 由风向/风速(相对 27 跑道,航向 270°)解出顶风/侧风分量,写入 WIND
function applyWind(){
  const base=(typeof RWY!=='undefined'&&typeof RWY.hdg==='number')?RWY.hdg:270;  // 以选定跑道朝向为基准(对向跑道→顶风↔顺风互换)
  const off=(CONFIG.windDir-base)*RAD;         // 风来向相对当前跑道
  const ms=CONFIG.windSpeed/MS_TO_KT;
  WIND.head=Math.max(0,ms*Math.cos(off));      // 顶风分量(逆风落地)
  WIND.cross=ms*Math.sin(off);                 // 侧风分量(右正)
  WIND.gustMul=curDiff().gust*(cfg.turb?1:0);  // 湍流强度(受难度+开关)
  WIND.shear=curDiff().shear;
}
// 切难度:同步该档默认风速 + 重算风场
function applyDifficulty(d){
  if(!DIFF[d])return;
  CONFIG.diff=d;
  CONFIG.windSpeed=DIFF[d].windSpeed;
  applyWind();
  saveConfig();
}
function applyConfig(){ if(typeof applyAircraft==='function')applyAircraft(CONFIG.aircraft); if(typeof applyAirport==='function')applyAirport(CONFIG.airport,CONFIG.rwySel); applyWind(); if(typeof WEATHER!=='undefined')WEATHER.preset(CONFIG.weather); saveConfig(); }
function saveConfig(){ try{localStorage.setItem(CFG_KEY,JSON.stringify(CONFIG));}catch(_){} }
function loadConfig(){
  try{const v=JSON.parse(localStorage.getItem(CFG_KEY)||'null');
    if(v&&typeof v==='object'){
      if(DIFF[v.diff])CONFIG.diff=v.diff;
      if(STARTS[v.start])CONFIG.start=v.start;
      if(typeof v.windDir==='number')CONFIG.windDir=v.windDir;
      if(typeof v.windSpeed==='number')CONFIG.windSpeed=v.windSpeed;
      CONFIG.freeFlight=!!v.freeFlight;
      if(v.engines===2||v.engines===4)CONFIG.engines=v.engines;
      if(['clear','mist','imc','lowvis'].includes(v.weather))CONFIG.weather=v.weather;
      if(typeof AIRCRAFT!=='undefined'&&AIRCRAFT[v.aircraft])CONFIG.aircraft=v.aircraft;
      if(typeof AIRPORTS!=='undefined'&&AIRPORTS[v.airport])CONFIG.airport=v.airport;
      if(typeof v.rwySel==='number')CONFIG.rwySel=v.rwySel;
      CONFIG.circleApp=!!v.circleApp;
    }
  }catch(_){}
}
