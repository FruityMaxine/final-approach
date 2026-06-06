"use strict";
//==================================================================
// PRECIP — 降水天气 + 湿滑/污染跑道(组20 Tick3)
//   ①降水渲染:render drawWorld 末叠加雨丝(斜线粒子)/雪花(飘落点),风挡雨痕。
//   ②跑道污染 dry/wet/snow → mu() 摩擦系数;game.js:441 刹车项接乘 mu()
//     (湿/雪→刹车效能降→刹车距离增、易冲出 overrun)。
//   依赖运行期全局:wctx(世界 canvas ctx)/S。高密度开关面板,手机零横滚。
//==================================================================
const PRECIP={
  label:'降水/PRECIP',
  type:'none', intensity:0.6, runwayState:'dry', _drawn:0, _parts:null, _sig:null,
  MU:{dry:1.0, wet:0.55, snow:0.35},
  mu(){ return this.MU[this.runwayState]!=null?this.MU[this.runwayState]:1; },
  set(type){ this.type=type; this.runwayState=(type==='rain')?'wet':(type==='snow'?'snow':'dry'); this._sig=null; },

  _ensure(){ if(this._parts)return; this._parts=[]; for(let i=0;i<120;i++)this._parts.push({x:Math.random(),y:Math.random(),v:0.5+Math.random()*0.6}); },
  draw(){
    if(this.type==='none'||typeof wctx==='undefined')return;
    const cv=wctx.canvas, W=cv.width, H=cv.height, t=(typeof S!=='undefined')?(S.t||0):0;
    const spd=(typeof S!=='undefined')?Math.max(0.3,S.V/72):1; this._drawn++; this._ensure();
    wctx.save();
    if(this.type==='rain'){
      wctx.strokeStyle='rgba(170,190,220,'+(0.22+0.32*this.intensity)+')'; wctx.lineWidth=1;
      const slant=6+spd*8, len=11+this.intensity*16;
      for(const p of this._parts){ const ph=(p.y+t*p.v*1.0)%1, x=p.x*W, y=ph*H;
        wctx.beginPath(); wctx.moveTo(x,y); wctx.lineTo(x-slant*0.35,y+len); wctx.stroke(); }
      wctx.fillStyle='rgba(150,170,200,0.05)'; wctx.beginPath(); wctx.ellipse(W/2,H,W*0.6,H*0.12,0,Math.PI,0); wctx.fill();   // 风挡雨痕
    } else if(this.type==='snow'){
      wctx.fillStyle='rgba(235,242,250,'+(0.45+0.32*this.intensity)+')';
      for(const p of this._parts){ const ph=(p.y+t*p.v*0.28)%1, x=(p.x+Math.sin((ph+p.x)*6.2)*0.02)*W, y=ph*H;
        wctx.beginPath(); wctx.arc(x,y,1+this.intensity*1.6,0,7); wctx.fill(); }
    }
    wctx.restore();
  },

  //------------------ 降水/跑道状态面板 ------------------
  STATE_NM:{dry:'干燥',wet:'潮湿',snow:'积雪'},
  render(host){
    if(!host)return; const sc=host.querySelector('#pcScreen'); if(!sc)return;
    const sig=this.type+'|'+this.intensity.toFixed(2)+'|'+this.runwayState; if(sig===this._sig)return; this._sig=sig;
    const mu=this.mu(), wet=this.runwayState!=='dry';
    sc.innerHTML='<div class="pc-row"><span class="pc-lbl">降水</span>'
      +['none','无','rain','雨','snow','雪'].reduce((a,v,i,arr)=>{ if(i%2)return a; return a+'<button class="pc-b'+(this.type===v?' on':'')+'" data-pc="'+v+'">'+arr[i+1]+'</button>'; },'')+'</div>'
      +'<div class="pc-row"><span class="pc-lbl">强度</span><button class="pc-b" data-int="-1">−</button><b class="pc-int">'+Math.round(this.intensity*100)+'%</b><button class="pc-b" data-int="1">+</button></div>'
      +'<div class="pc-out"><div class="pc-cell"><span>跑道状态</span><b class="'+(wet?'wr':'')+'">'+this.STATE_NM[this.runwayState]+'</b></div>'
      +'<div class="pc-cell"><span>摩擦系数 μ</span><b class="'+(wet?'wr':'')+'">'+mu.toFixed(2)+'</b></div>'
      +'<div class="pc-cell"><span>刹车效能</span><b class="'+(wet?'wr':'')+'">'+Math.round(mu*100)+'%</b></div></div>';
  },
  build(){
    return '<div class="syspanel"><div class="sp-title">降水 / 污染跑道</div><div class="pc-screen" id="pcScreen"></div>'
      +'<div class="sp-hint">降水(雨/雪)在飞行视野渲染,并污染跑道:潮湿 μ0.55 / 积雪 μ0.35,刹车效能下降→刹车距离增长、易冲出跑道。落地前评估跑道状态。</div></div>';
  },
  wire(host){
    const self=this;
    host.querySelector('#pcScreen').addEventListener('click',e=>{
      const t=e.target.closest('[data-pc]'); if(t){ self.set(t.dataset.pc); self.render(host); return; }
      const i=e.target.closest('[data-int]'); if(i){ self.intensity=Math.max(0.1,Math.min(1,self.intensity+ +i.dataset.int*0.2)); self._sig=null; self.render(host); }
    });
    this._sig=null; this.render(host);
  },
  sync(host){ this.render(host); },
};

if(typeof PANELS!=='undefined')PANELS.register('precip',PRECIP);
if(typeof window!=='undefined')window.PRECIP=PRECIP;
