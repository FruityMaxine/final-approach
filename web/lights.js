"use strict";
//==================================================================
// LIGHTS — 夜航 / 低能见度光环境系统(组17 Tick5,跨层重构 D)
//   把原散落 render.js 的进近灯(drawApproachLights)+ 跑道边灯逻辑统一搬进此处
//   集中门控(LIGHTS.drawGround),并新增 7 类灯种 + 机身灯首视反射 + 着陆灯光锥
//   + 灯光透雾衰减(接 WEATHER.visibility)。各灯独立开关(灯光面板)。
//   LIGHTS 开关 = 总闸;T.lightBoost(时段)= 强度系数。
//   依赖运行期全局:S/RWY/WEATHER/project/dot/wctx/W/Hh/cx/cy/clamp/M_TO_FT/cfg/PANELS。
//==================================================================
const LIGHTS={
  label:'灯光',
  state:{ approachLt:true, rail:true, reil:true, rwyEdge:true, taxiway:true,
          landing:true, strobe:true, beacon:true, nav:true, logo:false },

  // —— 地面灯(每帧由 drawWorld 调,接管原进近灯+边灯 + 新地面灯种) ——
  drawGround(T){
    const boost=T.lightBoost, st=this.state;
    if(st.approachLt)this._approach(boost);     // 搬迁:ALSF 中线灯排+rabbit+crossbar+入口绿灯
    if(st.rail)this._rail(boost);               // 新:RAIL 顺序闪光导轨(进近灯外段)
    if(st.reil)this._reil(boost);               // 新:REIL 跑道识别灯(阈值两侧白频闪)
    if(st.rwyEdge)this._edge(boost);            // 搬迁:跑道边灯(红末端)
    if(st.taxiway)this._taxiway(boost);         // 新:滑行道蓝边灯
    if(st.landing)this._landingCone(T);         // 新:着陆灯近地光锥(+雾中眩光)
  },
  // —— 机身灯首视反射(每帧 drawIMC 后调:风挡角微光 + 雾/夜中频闪反射脉冲) ——
  drawAircraftGlow(T){
    const st=this.state, fog=this._fog(), night=clamp((T.lightBoost-0.55)/1.25,0,1);
    if(st.nav){                                  // 新:机翼航行灯 红左/绿右(风挡下缘微光)
      this._corner(W*0.11,Hh*0.97,'255,60,50',(0.10+0.22*fog)*(0.4+0.6*night),Hh*0.17);
      this._corner(W*0.89,Hh*0.97,'60,255,120',(0.10+0.22*fog)*(0.4+0.6*night),Hh*0.17);
    }
    if(st.strobe){                               // 新:白频闪 1.5s 双闪,雾/夜反射全屏脉冲
      const ph=(S.t||0)%1.5, on=(ph<0.05)||(ph>0.14&&ph<0.19);
      if(on){ wctx.fillStyle='rgba(255,255,255,'+((0.05+0.30*fog)*(0.4+0.6*night)).toFixed(3)+')'; wctx.fillRect(0,0,W,Hh); }
    }
    if(st.beacon){                               // 新:信标红闪(~1.2s 旋转)
      const b=Math.sin((S.t||0)*5.2);
      if(b>0.75){ wctx.fillStyle='rgba(255,40,30,'+((0.04+0.15*fog)*(0.4+0.6*night)).toFixed(3)+')'; wctx.fillRect(0,0,W,Hh); }
    }
  },

  _fog(){ return (typeof WEATHER!=='undefined')?clamp(1-WEATHER.visibility/9000,0,1):0; },
  _glowK(){ return 1+this._fog()*2.2; },        // 透雾:雾中光晕扩散(glow 半径放大)

  //------------------ 搬迁:进近灯 ALSF ------------------
  _approach(boost){
    const rabbit=Math.floor((S.t*3)%15), gk=this._glowK();
    for(let i=1;i<=16;i++){
      const zz=-i*55,p=project(0,0.5,zz);
      if(p&&p.z<9500){
        const fade=clamp((1.5-p.z/3400)*boost,0.12,1);
        const flash=(i>=9&&(16-i)===rabbit)?1.9:1;
        dot(p,clamp(135/p.z,0.6,4.6)*flash,'rgba(255,250,225,'+fade+')',(flash>1?10:(boost>1.3?5:0))*gk);
      }
      if(i%3===0)for(let xo=-15;xo<=15;xo+=5){if(xo===0)continue;const q=project(xo,0.5,zz);if(q&&q.z<7200)dot(q,clamp(105/q.z,0.45,2.8),'rgba(255,248,215,'+clamp((1.3-q.z/3200)*boost,0.1,0.9)+')',(boost>1.3?3:0)*gk);}
    }
    const hw=RWY.W/2;
    for(let x=-hw;x<=hw;x+=6){const p=project(x,0.4,0);if(p&&p.z<5000)dot(p,clamp(95/p.z,0.5,2.6),'rgba(70,255,140,'+clamp(1.2*boost,0.3,1)+')',(boost>1.3?4:0)*gk);}
  },
  //------------------ 搬迁:跑道边灯(红末端) ------------------
  _edge(boost){
    const hw=RWY.W/2, rl=(typeof RWY!=='undefined')?RWY.L:3000, gk=this._glowK();
    for(let zz=0;zz<=rl;zz+=120)for(const side of[-hw-1.5,hw+1.5]){const p=project(side,0.5,zz);if(p&&p.z<7000)dot(p,clamp(95/p.z,0.4,2.6),zz>rl-500?'rgba(255,90,60,.92)':'rgba(255,250,225,'+clamp(0.85*boost,0.4,1)+')',(boost>1.3?3:0)*gk);}
  },
  //------------------ 新:RAIL 顺序闪光导轨 ------------------
  _rail(boost){
    const seq=Math.floor((S.t*6)%8), gk=this._glowK();
    for(let i=0;i<8;i++){
      const zz=-(17+i)*55, p=project(0,0.5,zz);
      if(p&&p.z<11500&&(7-i)===seq)dot(p,clamp(150/p.z,0.8,5)*1.6,'rgba(255,255,255,'+clamp(1.1*boost,0.3,1)+')',12*gk);
    }
  },
  //------------------ 新:REIL 跑道识别灯(阈值两侧同步白频闪) ------------------
  _reil(boost){
    if((S.t%1.0)>=0.08)return;
    const hw=RWY.W/2, gk=this._glowK();
    for(const sx of[-hw-3,hw+3]){const p=project(sx,0.6,0);if(p&&p.z<6000)dot(p,clamp(140/p.z,1,5)*1.5,'rgba(255,255,255,'+clamp(1.2*boost,0.4,1)+')',13*gk);}
  },
  //------------------ 新:滑行道蓝边灯 ------------------
  _taxiway(boost){
    const hw=RWY.W/2, rl=(typeof RWY!=='undefined')?RWY.L:3000, gk=this._glowK();
    for(let zz=120;zz<rl;zz+=70){const p=project(-hw-24,0.4,zz);if(p&&p.z<6000)dot(p,clamp(80/p.z,0.4,2.2),'rgba(60,130,255,'+clamp(0.9*boost,0.35,1)+')',(boost>1.3?4:0)*gk);}
  },
  //------------------ 新:着陆灯近地光锥 + 雾中眩光 ------------------
  _landingCone(T){
    const altft=S.alt*M_TO_FT; if(altft>320||S.onGround)return;
    const k=clamp((320-altft)/320,0,1), fog=this._fog();
    const a=project(-7,0.05,30),b=project(7,0.05,30),c=project(16,0.05,380),d=project(-16,0.05,380);
    if(a&&b&&c&&d){
      const g=wctx.createLinearGradient(0,a.y,0,c.y);
      g.addColorStop(0,'rgba(255,250,225,'+(0.16*k).toFixed(3)+')'); g.addColorStop(1,'rgba(255,250,225,0)');
      wctx.fillStyle=g;wctx.beginPath();wctx.moveTo(a.x,a.y);wctx.lineTo(b.x,b.y);wctx.lineTo(c.x,c.y);wctx.lineTo(d.x,d.y);wctx.closePath();wctx.fill();
    }
    if(fog>0.2){ const xp=cx,yp=cy+Hh*0.18,rd=Hh*(0.18+0.25*fog),gg=wctx.createRadialGradient(xp,yp,0,xp,yp,rd);
      gg.addColorStop(0,'rgba(255,250,230,'+(0.10*k*fog).toFixed(3)+')');gg.addColorStop(1,'rgba(255,250,230,0)');
      wctx.fillStyle=gg;wctx.fillRect(0,0,W,Hh); }
  },
  _corner(x,y,rgb,al,rad){
    const g=wctx.createRadialGradient(x,y,0,x,y,rad);
    g.addColorStop(0,'rgba('+rgb+','+al.toFixed(3)+')'); g.addColorStop(1,'rgba('+rgb+',0)');
    wctx.fillStyle=g; wctx.fillRect(x-rad,y-rad,rad*2,rad*2);
  },

  //------------------ 灯光控制面板 ------------------
  build(){
    const LT=[['approachLt','进近灯 ALS'],['rail','顺序闪 RAIL'],['reil','跑道识别 REIL'],['rwyEdge','跑道边灯'],
              ['taxiway','滑行道蓝灯'],['landing','着陆灯'],['strobe','频闪 STROBE'],['beacon','信标 BEACON'],
              ['nav','航行灯 NAV'],['logo','标志灯']];
    let h='<div class="syspanel"><div class="sp-title">灯光控制</div><div class="lights-grid">';
    for(const [k,nm] of LT) h+='<div class="light-row" data-light="'+k+'"><span class="light-nm">'+nm+'</span><div class="sw'+(this.state[k]?' on':'')+'"></div></div>';
    h+='</div><div class="light-tod"><span class="light-nm">时段</span><div class="seg seg-todl">'
      +[['dusk','黄昏'],['noon','正午'],['night','夜间']].map(([v,n])=>'<div class="seg-opt'+(((typeof cfg!=='undefined'?cfg.tod:'dusk')===v)?' on':'')+'" data-todl="'+v+'">'+n+'</div>').join('')
      +'</div></div>'
      +'<div class="sp-hint">各灯独立开关;夜间灯效最明显。着陆灯近地投地面光锥,频闪 / 信标 / 航行灯在雾夜中反射可见(透雾衰减)。</div></div>';
    return h;
  },
  wire(host){
    const self=this;
    host.querySelectorAll('[data-light]').forEach(r=>r.addEventListener('click',()=>{
      const k=r.dataset.light; self.state[k]=!self.state[k]; self.sync(host);
    }));
    host.querySelectorAll('[data-todl]').forEach(s=>s.addEventListener('click',()=>{
      if(typeof setTod==='function')setTod(s.dataset.todl); self.sync(host);
    }));
    this.sync(host);
  },
  sync(host){
    if(!host)return;
    host.querySelectorAll('[data-light]').forEach(r=>{ const sw=r.querySelector('.sw'); if(sw)sw.classList.toggle('on',!!this.state[r.dataset.light]); });
    const tod=(typeof cfg!=='undefined')?cfg.tod:'dusk';
    host.querySelectorAll('[data-todl]').forEach(s=>s.classList.toggle('on',s.dataset.todl===tod));
  },
};

if(typeof PANELS!=='undefined')PANELS.register('lights',LIGHTS);
if(typeof window!=='undefined')window.LIGHTS=LIGHTS;
