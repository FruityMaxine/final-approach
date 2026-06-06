"use strict";
//==================================================================
// WXR — 气象雷达(Weather Radar)面板(组17 Tick4)
//   扇形扫描显示:本机底部中心,扇形向上 ±60°。极坐标回波场——
//   程序生成回波单元(确定性 hash 按格 + WEATHER 强度:能见度越低回波越密越强),
//   绿/黄/红三级 + 距离衰减 + 量程 20/40/80NM + GAIN/TILT + 扫描线动画。
//   依赖运行期全局:S/WEATHER/RAD/PANELS。手机零横向溢出。
//==================================================================
function _wxrH01(n){ n=(n^0x9e3779b9)>>>0; n=Math.imul(n^(n>>>15),n|1)>>>0; n^=n+Math.imul(n^(n>>>7),n|61); return ((n^(n>>>14))>>>0)/4294967296; }

const WXR={
  label:'气象雷达',
  range:40, RANGES:[20,40,80],
  gain:0,  GAINS:[-1,0,1],   // CAL / NORM / MAX
  tilt:0,  TILTS:[-5,0,5],
  scan:0, echoCount:0,
  NB:25, NR:9,

  // 当前气象强度(0 晴 → 1 低能见/强对流),由 WEATHER.visibility 推
  severity(){
    const vis=(typeof WEATHER!=='undefined')?WEATHER.visibility:10000;
    let s=Math.max(0,Math.min(1,(10000-vis)/9200));
    s*=(1-Math.abs(this.tilt)/30);                 // 倾角偏离→见到的低云回波减少
    return s;
  },

  build(){
    const rb=this.RANGES.map(r=>'<button class="wxr-b'+(r===this.range?' on':'')+'" data-rng="'+r+'">'+r+'</button>').join('');
    const gb=['CAL','NORM','MAX'].map((g,i)=>'<button class="wxr-b'+(this.GAINS[i]===this.gain?' on':'')+'" data-gain="'+this.GAINS[i]+'">'+g+'</button>').join('');
    const tb=['DN','0','UP'].map((g,i)=>'<button class="wxr-b'+(this.TILTS[i]===this.tilt?' on':'')+'" data-tilt="'+this.TILTS[i]+'">'+g+'</button>').join('');
    return '<div class="syspanel"><div class="sp-title">气象雷达 WXR</div>'
      +'<canvas id="wxrCanvas" class="wxr-canvas" width="380" height="340"></canvas>'
      +'<div class="wxr-ctl"><span class="wxr-lbl">量程NM</span>'+rb+'</div>'
      +'<div class="wxr-ctl"><span class="wxr-lbl">增益</span>'+gb+'<span class="wxr-lbl" style="margin-left:8px;">倾角</span>'+tb+'</div>'
      +'<div class="wxr-legend"><span class="wxr-k g">绿 小雨</span><span class="wxr-k y">黄 中雨</span><span class="wxr-k r">红 强对流</span></div>'
      +'<div class="sp-hint">扇形扫描气象回波:绿/黄/红 = 降水强度递增。能见度越低回波越密(切天气可见)。量程缩放、增益提亮、倾角调俯仰扫描带。</div></div>';
  },
  wire(host){
    const self=this;
    host.querySelectorAll('[data-rng]').forEach(b=>b.addEventListener('click',()=>{ self.range=+b.dataset.rng; self._mark(host); }));
    host.querySelectorAll('[data-gain]').forEach(b=>b.addEventListener('click',()=>{ self.gain=+b.dataset.gain; self._mark(host); }));
    host.querySelectorAll('[data-tilt]').forEach(b=>b.addEventListener('click',()=>{ self.tilt=+b.dataset.tilt; self._mark(host); }));
    this.draw(host);
  },
  _mark(host){
    host.querySelectorAll('[data-rng]').forEach(b=>b.classList.toggle('on',+b.dataset.rng===this.range));
    host.querySelectorAll('[data-gain]').forEach(b=>b.classList.toggle('on',+b.dataset.gain===this.gain));
    host.querySelectorAll('[data-tilt]').forEach(b=>b.classList.toggle('on',+b.dataset.tilt===this.tilt));
    this.draw(host);
  },
  sync(host){ this.scan+=0.045; if(this.scan>1)this.scan=0; this.draw(host); },   // 扫描线推进

  draw(host){
    const cv=host?host.querySelector('#wxrCanvas'):null; if(!cv)return;
    const ctx=cv.getContext('2d'), W=cv.width, H=cv.height;
    ctx.clearRect(0,0,W,H); ctx.fillStyle='#04080b'; ctx.fillRect(0,0,W,H);
    const cx=W/2, cy=H*0.92, R=H*0.86, rad=(typeof RAD!=='undefined')?RAD:Math.PI/180;
    const sev=this.severity(), gboost=this.gain*0.16;
    const seed=(typeof S!=='undefined')?Math.floor((-S.z)/1500):0;
    const NB=this.NB, NR=this.NR, span=60, dB=span*2/NB;
    const pol=(bDeg,r)=>{ const a=bDeg*rad; return [cx+Math.sin(a)*r, cy-Math.cos(a)*r]; };
    // 量程圈
    ctx.strokeStyle='#143040'; ctx.lineWidth=1;
    for(const f of [0.5,1]){ ctx.beginPath();
      for(let bd=-span;bd<=span;bd+=4){ const[x,y]=pol(bd,R*f); bd===-span?ctx.moveTo(x,y):ctx.lineTo(x,y);} ctx.stroke(); }
    ctx.strokeStyle='#0e2230'; for(const bd of [-60,-30,0,30,60]){ const[x,y]=pol(bd,R); ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(x,y); ctx.stroke(); }
    ctx.fillStyle='#3a5566'; ctx.font='9px monospace'; ctx.textAlign='center';
    ctx.fillText((this.range/2)+'',cx,cy-R*0.5+11); ctx.fillText(this.range+'',cx,cy-R+11);
    // 回波单元(极格)
    let cnt=0;
    for(let bi=0;bi<NB;bi++){
      const bDeg=-span+bi*dB+dB/2;
      for(let ri=1;ri<=NR;ri++){
        const rFrac=ri/NR;
        let inten=_wxrH01(bi*131+ri*977+seed*7919);
        inten=inten*inten;                                   // 收紧:多数弱,少数强(聚团感)
        let eff=inten*(0.30+sev*1.45)+gboost-rFrac*0.10;     // 强度 = 噪声×天气 + 增益 − 距离衰减(晴空近乎无回波)
        if(eff<0.34)continue;
        cnt++;
        const col=eff>0.72?'#ff4a3d':(eff>0.52?'#ffb02e':'#2ee68f');
        const r0=R*(rFrac-1/NR), r1=R*rFrac, b0=bDeg-dB/2+0.6, b1=bDeg+dB/2-0.6;
        const[x0,y0]=pol(b0,r0),[x1,y1]=pol(b1,r0),[x2,y2]=pol(b1,r1),[x3,y3]=pol(b0,r1);
        ctx.fillStyle=col; ctx.globalAlpha=0.78; ctx.beginPath();
        ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.lineTo(x2,y2); ctx.lineTo(x3,y3); ctx.closePath(); ctx.fill();
      }
    }
    ctx.globalAlpha=1; this.echoCount=cnt;
    // 扫描线(左右往返)
    const sweep=-span+Math.abs(this.scan*2-1)*span*2;        // -60..+60..-60
    ctx.strokeStyle='rgba(46,230,143,.55)'; ctx.lineWidth=2; const[sx,sy]=pol(sweep,R);
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(sx,sy); ctx.stroke();
    // 本机符号
    ctx.fillStyle='#cfd6e0'; ctx.beginPath(); ctx.moveTo(cx,cy-8); ctx.lineTo(cx-6,cy+5); ctx.lineTo(cx+6,cy+5); ctx.closePath(); ctx.fill();
  },
};

if(typeof PANELS!=='undefined')PANELS.register('wxr',WXR);
if(typeof window!=='undefined')window.WXR=WXR;
