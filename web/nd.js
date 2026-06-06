"use strict";
//==================================================================
// ND — 导航显示(Navigation Display)平面图面板  ·  独立模块(组16 Tick5)
//   ARC 模式(航向上):本机符号在底部中心,航向刻度环 + 航路点平面投影 +
//   跑道 + ILS 航道射线 + 风矢量 + 同心量程圈(10/20/40NM 可切)。
//   逐帧 sync 实时刷新,读 S/WIND/WPTS/RWY 真数据投影。
//   投影:世界向量(沿迹 dz / 横向 dx)绕本机航向偏差 S.hdg 旋至航向上,
//   按量程缩放到屏幕。本机在 (cx,cy 靠下)。
//   依赖运行期全局:S / WIND / WPTS / RWY / RAD / DEG / MS_TO_KT。
//==================================================================
const ND={
  label:'ND 导航',
  range:20,                       // 量程(NM):10 / 20 / 40
  RANGES:[10,20,40],

  build(){
    return '<div class="syspanel"><div class="sp-title">导航显示 ND · ARC</div>'
      +'<canvas id="ndCanvas" class="nd-canvas" width="380" height="380"></canvas>'
      +'<div class="nd-ctl">'
      +this.RANGES.map(r=>'<button class="nd-rng'+(r===this.range?' on':'')+'" data-rng="'+r+'">'+r+' NM</button>').join('')
      +'</div>'
      +'<div class="nd-readout" id="ndReadout"></div>'
      +'<div class="sp-hint">航向上 ARC 视图:绿三角=本机,青=航路点+航道,白=跑道,琥珀=风矢量。量程环按 NM 标注;切换量程缩放显示范围。</div></div>';
  },
  wire(host){
    host.querySelectorAll('.nd-rng').forEach(b=>b.addEventListener('click',()=>{
      this.range=+b.dataset.rng;
      host.querySelectorAll('.nd-rng').forEach(x=>x.classList.toggle('on',+x.dataset.rng===this.range));
      this.draw(host);
    }));
    this.draw(host);
  },
  sync(host){ this.draw(host); },   // 逐帧实时刷新

  draw(host){
    const cv=host.querySelector('#ndCanvas'); if(!cv||typeof S==='undefined')return;
    const ctx=cv.getContext('2d'), W=cv.width, H=cv.height;
    ctx.clearRect(0,0,W,H); ctx.fillStyle='#060a10'; ctx.fillRect(0,0,W,H);
    const cx=W/2, cy=H*0.80, R=H*0.72;               // 本机靠下,量程半径
    const rng=this.range*1852, scl=R/rng;             // m→px
    const rad=(typeof RAD!=='undefined')?RAD:Math.PI/180, deg=(typeof DEG!=='undefined')?DEG:180/Math.PI;
    const hdgDev=S.hdg||0;                            // 本机相对跑道轴偏航(deg)
    const acHdg=(((typeof RWY!=='undefined'?RWY.hdg:270)+hdgDev)%360+360)%360;
    const th=hdgDev*rad;
    // 世界向量(右 dx,前 dz)→ 本机航向上屏幕坐标
    const proj=(dx,dz)=>{ const fwd=dz*Math.cos(th)+dx*Math.sin(th), rgt=dx*Math.cos(th)-dz*Math.sin(th);
      return { x:cx+rgt*scl, y:cy-fwd*scl, fwd }; };

    // —— 量程圈(同心,半 + 全) ——
    ctx.strokeStyle='#16202c'; ctx.lineWidth=1;
    for(const f of [0.5,1]){ ctx.beginPath(); ctx.arc(cx,cy,R*f,Math.PI*1.18,Math.PI*1.82,false); ctx.stroke(); }
    ctx.fillStyle='#5a6478'; ctx.font='9px monospace'; ctx.textAlign='center';
    ctx.fillText((this.range/2)+'',cx,cy-R*0.5+11); ctx.fillText(this.range+'',cx,cy-R+11);

    // —— 航向刻度环(ARC,航向上,30° 一标) ——
    ctx.strokeStyle='#2a3650'; ctx.fillStyle='#8b95a8'; ctx.font='10px monospace';
    for(let h=0;h<360;h+=10){
      let rel=h-acHdg; rel=((rel+540)%360)-180;
      if(rel<-66||rel>66)continue;
      const a=rel*rad, ox=Math.sin(a), oy=-Math.cos(a);
      const r0=R, r1=R-(h%30===0?12:7);
      ctx.beginPath(); ctx.moveTo(cx+ox*r0,cy+oy*r0); ctx.lineTo(cx+ox*r1,cy+oy*r1); ctx.stroke();
      if(h%30===0){ const lbl=(h===0?'N':h===90?'E':h===180?'S':h===270?'W':(''+(h/10|0)));
        ctx.fillText(lbl,cx+ox*(R-24),cy+oy*(R-24)+3); }
    }
    // 航向读数框(顶部)
    ctx.fillStyle='#070b12'; ctx.strokeStyle='#2ad8ff'; ctx.lineWidth=1;
    ctx.fillRect(cx-18,4,36,16); ctx.strokeRect(cx-18,4,36,16);
    ctx.fillStyle='#2ad8ff'; ctx.font='11px monospace'; ctx.fillText((''+Math.round(acHdg)).padStart(3,'0'),cx,16);
    // 航向上指针线
    ctx.strokeStyle='#2ad8ff66'; ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx,cy-R); ctx.stroke();

    // —— 跑道符号 + ILS 航道射线(沿跑道轴:dx=-S.x,dz 从阈值起) ——
    const thr=proj(-S.x, 0-S.z);                       // 跑道阈值(z=0)
    const rl=(typeof RWY!=='undefined'?RWY.L:3000);
    const far=proj(-S.x, rl-S.z);                      // 跑道远端
    // ILS 航道(阈值向进近方向延伸的虚线)
    const apf=proj(-S.x, -rng-S.z);
    ctx.strokeStyle='#2ad8ff'; ctx.setLineDash([6,5]); ctx.lineWidth=1; ctx.beginPath();
    ctx.moveTo(thr.x,thr.y); ctx.lineTo(apf.x,apf.y); ctx.stroke(); ctx.setLineDash([]);
    // 跑道矩形(阈值→远端,有宽度)
    const rwHalf=(typeof RWY!=='undefined'?RWY.W/2:22);
    const tL=proj(-S.x-rwHalf,0-S.z), tR=proj(-S.x+rwHalf,0-S.z), fL=proj(-S.x-rwHalf,rl-S.z), fR=proj(-S.x+rwHalf,rl-S.z);
    ctx.fillStyle='#cfd6e0cc'; ctx.beginPath();
    ctx.moveTo(tL.x,tL.y); ctx.lineTo(tR.x,tR.y); ctx.lineTo(fR.x,fR.y); ctx.lineTo(fL.x,fL.y); ctx.closePath(); ctx.fill();

    // —— 航路点投影 + 航路连线 + 标签 ——
    const W2=(typeof WPTS!=='undefined')?WPTS:[];
    ctx.strokeStyle='#2ad8ff88'; ctx.lineWidth=1.3; ctx.beginPath();
    let started=false;
    for(const w of W2){ const p=proj(-S.x, w.z-S.z); started?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y); started=true; }
    ctx.stroke();
    ctx.font='9px monospace';
    for(const w of W2){ const p=proj(-S.x, w.z-S.z);
      if(p.x<-20||p.x>W+20||p.y<-20||p.y>H+20)continue;
      ctx.fillStyle='#2ad8ff'; ctx.beginPath(); ctx.moveTo(p.x,p.y-4); ctx.lineTo(p.x+4,p.y); ctx.lineTo(p.x,p.y+4); ctx.lineTo(p.x-4,p.y); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#9fb2c8'; ctx.textAlign='left'; ctx.fillText(w.id,p.x+6,p.y+3); ctx.textAlign='center'; }

    // —— 风矢量(角:风来向相对本机航向) ——
    if(typeof WIND!=='undefined'){
      const head=WIND.head||0, cross=WIND.cross||0, spd=Math.hypot(head,cross)*((typeof MS_TO_KT!=='undefined')?MS_TO_KT:1.944);
      if(spd>0.5){
        const fromBrg=((typeof RWY!=='undefined'?RWY.hdg:270)+Math.atan2(cross,head)*deg+360)%360;
        let rel=fromBrg-acHdg; rel=((rel+540)%360)-180; const a=rel*rad;
        const wx=cx+R*0.62*Math.sin(a), wy=cy+ -R*0.62*Math.cos(a);
        ctx.strokeStyle='#ffb02e'; ctx.fillStyle='#ffb02e'; ctx.lineWidth=1.6;
        ctx.beginPath(); ctx.moveTo(wx,wy); ctx.lineTo(cx+R*0.40*Math.sin(a),cy-R*0.40*Math.cos(a)); ctx.stroke();
        ctx.beginPath(); ctx.arc(wx,wy,2.5,0,7); ctx.fill();
        ctx.font='9px monospace'; ctx.textAlign='left';
        ctx.fillText(Math.round(fromBrg)+'°/'+Math.round(spd)+'kt',wx+5,wy); ctx.textAlign='center';
      }
    }

    // —— 本机符号(绿三角,航向上) ——
    ctx.fillStyle='#2ee68f'; ctx.beginPath();
    ctx.moveTo(cx,cy-9); ctx.lineTo(cx-7,cy+7); ctx.lineTo(cx,cy+3); ctx.lineTo(cx+7,cy+7); ctx.closePath(); ctx.fill();

    // —— 读数 ——
    const ro=host.querySelector('#ndReadout');
    if(ro){ const gs=Math.max(0,(typeof RWY!=='undefined'?RWY.aim:300)-S.z)/1852;
      ro.innerHTML='HDG <b>'+(''+Math.round(acHdg)).padStart(3,'0')+'°</b> · 跑道 '+(typeof RWY!=='undefined'?RWY.name:'27')
        +' · 量程 '+this.range+'NM · 距阈 '+(gs>0?gs.toFixed(1):'0.0')+'NM'; }
  },
};

if(typeof PANELS!=='undefined')PANELS.register('nd',ND);
if(typeof window!=='undefined')window.ND=ND;
