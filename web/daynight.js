"use strict";
//==================================================================
// DAYNIGHT — 连续昼夜系统 + 动态太阳光照  ·  FA组21 Tick5
//   离散三时段(dusk/noon/night)升级为连续 todMin(0-1439 分钟):
//   太阳高度角驱动天空渐变 + 灯光强度连续过渡 + 时间可暂停/加速流动。
//   核心:palette() 按太阳高度在 night→dusk→noon 三档调色板间插值,
//   render.js tod() 改读它 → 所有下游(天空/地面/建筑/灯光 lightBoost)自动连续。
//   兼容:旧 cfg.tod 枚举保留(setTod 映射到代表分钟);isNight() 替散落夜判定。
//   依赖运行期全局:TOD(render.js 调色板)/cfg/clamp/lerp。
//==================================================================
const DAYNIGHT={
  label:'昼夜/TIME',
  KEY:'fa.daynight',
  todMin:1080,                 // 默认 18:00(对应旧 dusk)
  rate:0,                      // 时间流速倍率(0=暂停)
  RATES:[0,1,60,600],
  _sig:null,

  on(){ return true; },        // 连续模式常驻(tod() 始终读插值调色板)
  load(){ try{const o=JSON.parse(localStorage.getItem(this.KEY)||'null');
    if(o){ if(typeof o.todMin==='number')this.todMin=((o.todMin%1440)+1440)%1440; if(this.RATES.includes(o.rate))this.rate=o.rate; } }catch(_){} },
  save(){ try{localStorage.setItem(this.KEY,JSON.stringify({todMin:Math.round(this.todMin),rate:this.rate}));}catch(_){} },

  // 推进时间(loop 每帧调,实时 dt 秒)。rate=倍率:1x→1 实秒=1 模拟秒
  step(dt){
    if(this.rate>0){ this.todMin=(this.todMin + dt*this.rate/60)%1440; if(this.todMin<0)this.todMin+=1440; this._syncCoarse(); this._saveThrottle(dt); }
  },
  _acc:0,
  _saveThrottle(dt){ this._acc+=dt; if(this._acc>3){ this._acc=0; this.save(); } },
  setMin(m){ this.todMin=((m%1440)+1440)%1440; this._syncCoarse(); this.save(); },
  setRate(r){ if(this.RATES.includes(r)){ this.rate=r; this.save(); } },

  // 旧 cfg.tod 粗标签同步(LIGHTS 面板时段选择器 + spatial 回退用)
  _syncCoarse(){ if(typeof cfg==='undefined')return; const e=this.sunElev(); cfg.tod = e>18?'noon':(e<-2?'night':'dusk'); },

  // 太阳高度角(度):午夜 -60,日出/日落 0(6:00/18:00),正午 +60
  sunElev(){ return 60*Math.sin((this.todMin/1440)*2*Math.PI - Math.PI/2); },
  isNight(){ return this.sunElev() < -6; },   // 民用暮光以下算夜(空间迷向)
  hhmm(){ const h=Math.floor(this.todMin/60),m=Math.floor(this.todMin%60),p=n=>('0'+n).slice(-2); return p(h)+':'+p(m); },
  phase(){ const e=this.sunElev(); return e>25?'白昼':(e>0?'晨昏':(e>-8?'暮光':'夜间')); },

  // —— 调色板插值(返回与 TOD 同构对象,供 render tod() 使用) ——
  _hex(c){ const n=parseInt(c.slice(1),16); return [(n>>16)&255,(n>>8)&255,n&255]; },
  _toHex(a){ return '#'+a.map(v=>('0'+Math.round(clamp(v,0,255)).toString(16)).slice(-2)).join(''); },
  _lerpHex(a,b,t){ const x=this._hex(a),y=this._hex(b); return this._toHex([0,1,2].map(i=>x[i]+(y[i]-x[i])*t)); },
  _lerpTriple(a,b,t){ const x=a.split(',').map(Number),y=b.split(',').map(Number); return [0,1,2].map(i=>Math.round(x[i]+(y[i]-x[i])*t)).join(','); },
  _lerpPal(A,B,t){
    const L=(a,b)=>this._lerpHex(a,b,t), N=(a,b)=>a+(b-a)*t;
    return {
      sky: A.sky.map((c,i)=>L(c,B.sky[i])),
      gnd: A.gnd.map((c,i)=>L(c,B.gnd[i])),
      haze: this._lerpTriple(A.haze,B.haze,t),
      horizon: t<0.5?A.horizon:B.horizon,
      sun: (t<0.5?A.sun:B.sun),
      bld: L(A.bld,B.bld), bldLit: L(A.bldLit,B.bldLit),
      win: t<0.5?A.win:B.win, grid: t<0.5?A.grid:B.grid,
      field: t<0.5?A.field:B.field,
      lightBoost: N(A.lightBoost,B.lightBoost),
      star: N(A.star,B.star), mtn: N(A.mtn,B.mtn),
    };
  },
  palette(){
    if(typeof TOD==='undefined')return null;
    const e=this.sunElev();
    if(e>=18)return TOD.noon;                                  // 白昼
    if(e>=0)  return this._lerpPal(TOD.dusk, TOD.noon, e/18);  // 晨昏→白昼
    if(e>=-8) return this._lerpPal(TOD.night, TOD.dusk, (e+8)/8); // 暮光→晨昏
    return TOD.night;                                          // 夜间
  },

  // —— 面板(下方仪表区,高密度) ——
  build(){
    return '<div class="dn-pan">'
      +'<div class="dn-top"><div class="dn-clock" id="dnClock">--:--</div>'
        +'<div class="dn-meta"><span class="dn-phase" id="dnPhase">—</span><span class="dn-sun" id="dnSun">SUN —</span></div></div>'
      +'<div class="dn-rate" id="dnRate"></div>'
      +'<div class="dn-slider"><span class="dn-sl">00:00</span>'
        +'<input type="range" id="dnSlide" min="0" max="1439" step="1" class="dn-range"/><span class="dn-sl">24:00</span></div>'
      +'<div class="dn-note">太阳高度角驱动天空/灯光连续过渡 · 时间流速暂停~600x · 拖滑块手动设时刻</div>'
      +'</div>';
  },
  _renderInto(host){
    host.querySelector('#dnClock').textContent=this.hhmm();
    host.querySelector('#dnPhase').textContent=this.phase();
    host.querySelector('#dnSun').textContent='SUN '+Math.round(this.sunElev())+'°';
    const labels={0:'暂停',1:'1x',60:'60x',600:'600x'};
    host.querySelector('#dnRate').innerHTML=this.RATES.map(r=>
      '<button class="dn-ropt'+(this.rate===r?' on':'')+'" data-dr="'+r+'">'+labels[r]+'</button>').join('');
    const sl=host.querySelector('#dnSlide'); if(sl&&document.activeElement!==sl)sl.value=Math.round(this.todMin);
  },
  wire(host){
    const self=this; this._sig=null;
    this._renderInto(host);
    if(host._dnWired)return;          // 监听只挂一次(panels.show 每开都调 wire)
    host._dnWired=true;
    host.addEventListener('click',e=>{
      const r=e.target.closest('[data-dr]');
      if(r){ self.setRate(+r.dataset.dr); self._sig=null; self._renderInto(host); }
    });
    const sl=host.querySelector('#dnSlide');
    if(sl)sl.addEventListener('input',e=>{ self.setRate(0); self.setMin(+e.target.value); self._sig=null; self._renderInto(host); });
  },
  sync(host){
    const sig=[Math.round(this.todMin/2),this.rate].join('|');   // 时钟随流动刷新(2min 粒度)
    if(sig===this._sig)return;
    this._sig=sig; this._renderInto(host);
  },
};

DAYNIGHT.load();
if(typeof PANELS!=='undefined')PANELS.register('time',DAYNIGHT);
if(typeof window!=='undefined')window.DAYNIGHT=DAYNIGHT;
