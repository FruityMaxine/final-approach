"use strict";
//==================================================================
// RUNWAY — 多跑道选择 + 盘旋进近(circle-to-land)  ·  FA组21 Tick3
//   每机场 runways[](主+对向+交叉)可选择降落,选定 → 改写 RWY 字段
//   (号/朝向/长宽/ILS/PAPI)+ 重算风分量(applyWind 以 RWY.hdg 为基准,
//   选对向跑道则顶风↔顺风互换、侧风翻向)→ 选风向有利跑道成为策略。
//   盘旋进近:起始横向偏置 + 航向偏转,逼玩家目视机动对正中线(非直线进近)。
//   依赖运行期全局:CONFIG/RWY/AIRPORTS/applyAirport/applyWind/curAirport/S。
//   面板"跑道/RWY":列跑道(号/长/ILS/风分量)+ 选择 + 盘旋开关。
//==================================================================
const RUNWAY={
  label:'跑道/RWY',
  D2R: Math.PI/180,
  _sig:null,

  // 当前机场跑道列表(带每跑道顶/侧风分量)
  list(){
    const a=(typeof curAirport==='function')?curAirport():null;
    const rws=(a&&a.runways)?a.runways:[];
    const wd=(typeof CONFIG!=='undefined')?CONFIG.windDir:280;
    const ws=(typeof CONFIG!=='undefined')?CONFIG.windSpeed:8;
    return rws.map((rw,i)=>{
      const off=(wd-rw.hdg)*this.D2R;
      const hw=ws*Math.cos(off);            // +顶风 / -顺风
      const xw=ws*Math.sin(off);            // +右侧风 / -左侧风
      return {idx:i, id:rw.id, hdg:rw.hdg, W:rw.W, L:rw.L, ils:rw.ils,
              papi:rw.papi, hw:Math.round(hw), xw:Math.round(xw)};
    });
  },
  sel(){ return (typeof CONFIG!=='undefined' && CONFIG.rwySel)|0; },
  circleOn(){ return !!(typeof CONFIG!=='undefined' && CONFIG.circleApp); },

  // 选跑道 → 写 RWY + 重算风 + 持久化(下次 doReset 应用)
  select(idx){
    if(typeof CONFIG==='undefined')return;
    CONFIG.rwySel=idx|0;
    if(typeof applyAirport==='function')applyAirport(CONFIG.airport, CONFIG.rwySel);
    if(typeof applyWind==='function')applyWind();    // RWY.hdg 变 → 风分量重算
    if(typeof saveConfig==='function')saveConfig();
    if(typeof updateWindUI==='function')updateWindUI();
  },
  toggleCircle(){
    if(typeof CONFIG==='undefined')return;
    CONFIG.circleApp=!CONFIG.circleApp;
    if(typeof saveConfig==='function')saveConfig();
  },

  // 盘旋进近:resetState 末调用,横向偏置 + 航向偏转(玩家须目视转弯对正)
  applyCircle(S){
    if(!this.circleOn()||!S)return;
    const side=((this.sel()%2)===1)?-1:1;     // 跑道别交替偏置方向,增变化
    S.x = 430*side;                            // 起始横向偏离中线 ~430m
    S.hdg = -10*side;                          // 航向偏向中线 10°(度,玩家须转弯对正)
    S.circling = true;
  },

  // —— 面板(下方仪表区,高密度) ——
  build(){
    return '<div class="rwy-pan">'
      +'<div class="rwy-cur" id="rwyCur"></div>'
      +'<div class="rwy-list" id="rwyList"></div>'
      +'<button class="rwy-circle" id="rwyCircle"></button>'
      +'<div class="rwy-note">对向跑道(号±18)反向落:顶风↔顺风互换 · 选顺风跑道侧风更小 · 盘旋进近起始偏置中线须目视转弯对正</div>'
      +'</div>';
  },
  _wcol(v,warnPos){
    if(warnPos){ const m=Math.abs(v); return m>25?'var(--red)':(m>15?'var(--amb)':'var(--grn)'); }
    return v>=0?'var(--grn)':'var(--amb)';   // 顶风绿 / 顺风琥珀
  },
  _renderInto(host){
    const a=(typeof curAirport==='function')?curAirport():null;
    const nm=a?a.name:'—';
    const rws=this.list(), sel=this.sel();
    host.querySelector('#rwyCur').innerHTML='<span class="rwy-apt">'+nm+'</span><span class="rwy-active">现用 RWY '
      +(rws[sel]?rws[sel].id:'--')+'</span>';
    host.querySelector('#rwyList').innerHTML=rws.map(r=>{
      const on=(r.idx===sel);
      const hwT=r.hw>=0?('HW '+r.hw):('TW '+(-r.hw));   // 顶/顺风
      const xwT='XW '+Math.abs(r.xw)+(r.xw>0?'R':(r.xw<0?'L':''));
      const ilsT=r.ils?('ILS '+r.ils):'目视 VIS';
      return '<button class="rwy-card'+(on?' on':'')+'" data-rw="'+r.idx+'">'
        +'<div class="rwy-hd"><b>'+r.id+'</b><span class="rwy-hdg">'+('00'+r.hdg).slice(-3)+'°</span></div>'
        +'<div class="rwy-spec">'+r.L+'m · '+r.W+'m · '+ilsT+'</div>'
        +'<div class="rwy-wind"><span style="color:'+this._wcol(r.hw,false)+'">'+hwT+'</span>'
        +'<span style="color:'+this._wcol(r.xw,true)+'">'+xwT+'</span></div>'
        +'</button>';
    }).join('');
    const c=this.circleOn();
    host.querySelector('#rwyCircle').className='rwy-circle'+(c?' on':'');
    host.querySelector('#rwyCircle').innerHTML='盘旋进近 circle-to-land '+(c?'ON':'OFF');
  },
  wire(host){
    const self=this; this._sig=null;
    this._renderInto(host);
    if(host._rwyWired)return;          // 监听只挂一次(panels.show 每开都调 wire)
    host._rwyWired=true;
    host.addEventListener('click',e=>{
      const card=e.target.closest('[data-rw]'), cir=e.target.closest('#rwyCircle');
      if(card){ self.select(+card.dataset.rw); self._sig=null; self._renderInto(host); }
      else if(cir){ self.toggleCircle(); self._sig=null; self._renderInto(host); }
    });
  },
  sync(host){
    const rws=this.list();
    const sig=[this.sel(),this.circleOn(),(typeof CONFIG!=='undefined'?CONFIG.airport:''),
               (typeof CONFIG!=='undefined'?CONFIG.windDir+'/'+CONFIG.windSpeed:'')].join('|');
    if(sig===this._sig)return;
    this._sig=sig; this._renderInto(host);
  },
};

if(typeof PANELS!=='undefined')PANELS.register('rwy',RUNWAY);
if(typeof window!=='undefined')window.RUNWAY=RUNWAY;
