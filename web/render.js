"use strict";
//==================================================================
// RENDER — 3D 投影 + 外景世界  ·  独立模块
//   依赖 game.js 全局(运行期):S/RWY/PAPI/GS_DEG/WIND/RAD/DEG/
//   M_TO_FT/MS_TO_KT/MS_TO_FPM/clamp/lerp/getC/cfg
//   本文件顶层只查自身 DOM(world/hudsvg,均在 <body> 末已就绪)+ 纯字面量,
//   不触碰 game.js 全局,故加载顺序在 game.js 之前安全。
//==================================================================
const MONO="ui-monospace,Menlo,Consolas,monospace";
const world=document.getElementById('world'),wctx=world.getContext('2d');
const hudsvg=document.getElementById('hudsvg');
let W=0,Hh=0,DPR=1,focal=900,cx=0,cy=0;

function resizeWorld(){
  DPR=Math.min(window.devicePixelRatio||1,2);
  const r=world.parentElement.getBoundingClientRect();
  W=r.width;Hh=r.height;
  world.width=Math.max(1,W*DPR);world.height=Math.max(1,Hh*DPR);
  world.style.width=W+'px';world.style.height=Hh+'px';
  wctx.setTransform(DPR,0,0,DPR,0,0);
  cx=W/2;cy=Hh/2;focal=W*0.95;
}
function resizeWorldIfNeeded(){const r=world.parentElement.getBoundingClientRect();if(Math.abs(r.width-W)>1||Math.abs(r.height-Hh)>1)resizeWorld();}
const NEAR=1;   // 近平面(相机前 1m);多边形跨此面时裁剪而非整体丢弃
// 世界坐标 → 相机空间{r右,u上,z前}。投影分两步,便于近平面裁剪。
function toCamera(px,py,pz){
  const yaw=S.hdg*RAD,pit=S.pitch*RAD,rol=S.roll*RAD;
  const cp=Math.cos(pit),sp=Math.sin(pit),cyaw=Math.cos(yaw),syaw=Math.sin(yaw);
  const fx=cp*syaw,fy=sp,fz=cp*cyaw;
  let rx=fz,rz=-fx;const rl=Math.hypot(rx,rz)||1;rx/=rl;rz/=rl;
  let ux=fy*rz, uy=fz*rx-fx*rz, uz=-fy*rx;
  const cr=Math.cos(rol),sr=Math.sin(rol);
  const r2x=rx*cr+ux*sr,r2y=uy*sr,r2z=rz*cr+uz*sr;
  const u2x=ux*cr-rx*sr,u2y=uy*cr,u2z=uz*cr-rz*sr;
  const dx=px-S.x,dy=py-S.alt,dz=pz-S.z;
  return { r:dx*r2x+dy*r2y+dz*r2z, u:dx*u2x+dy*u2y+dz*u2z, z:dx*fx+dy*fy+dz*fz };
}
function projectCam(c){ return {x:cx+focal*c.r/c.z, y:cy-focal*c.u/c.z, z:c.z}; }
function project(px,py,pz){ const c=toCamera(px,py,pz); return c.z<=NEAR?null:projectCam(c); }
// Sutherland-Hodgman 近平面裁剪:输入相机空间顶点环,保留 z>=NEAR 一侧,跨界处插值切割
function clipPolyNear(cam){
  const out=[],n=cam.length;
  for(let i=0;i<n;i++){
    const A=cam[i],B=cam[(i+1)%n],Ain=A.z>=NEAR,Bin=B.z>=NEAR;
    if(Ain)out.push(A);
    if(Ain!==Bin){ const t=(NEAR-A.z)/(B.z-A.z); out.push({r:A.r+(B.r-A.r)*t,u:A.u+(B.u-A.u)*t,z:NEAR}); }
  }
  return out;
}
// 世界坐标多边形 → 相机空间 → 近平面裁剪 → 投影填充(跨近平面切割,不再整体丢弃)
function fillPoly3d(ptsWorld,col){
  const cam=ptsWorld.map(p=>toCamera(p[0],p[1],p[2]));
  const cl=clipPolyNear(cam); if(cl.length<3)return false;
  wctx.fillStyle=col;wctx.beginPath();
  for(let i=0;i<cl.length;i++){const s=projectCam(cl[i]);if(i===0)wctx.moveTo(s.x,s.y);else wctx.lineTo(s.x,s.y);}
  wctx.closePath();wctx.fill();return true;
}
// 四边形(世界坐标四点)经近平面裁剪填充
function quad3d(a,b,c,d,col){ fillPoly3d([a,b,c,d],col); }

//------------------ 时段(time-of-day)调色板 ------------------
const TOD={
  dusk:{sky:['#13294f','#3f6ea8','#9fb9d4','#ecc79a'], gnd:['#7d7a4e','#5d6b3c','#42562b','#26331c'],
        haze:'236,205,170', horizon:'rgba(230,210,180,.55)', sun:{x:-250,y:-26,c:'#ffe2a8',glow:'#ff9a4d'},
        bld:'#2a2f3a', bldLit:'#3a4150', win:'rgba(255,225,150,', grid:'rgba(70,80,58,', field:[['#6b7344',0.5],['#566838',0.42]], lightBoost:1.0, star:0, mtn:0.7},
  noon:{sky:['#2a5fa8','#5b8fd0','#a9c9e8','#dbe9f2'], gnd:['#6f7d46','#56683a','#3e5428','#28381c'],
        haze:'205,222,236', horizon:'rgba(210,225,235,.5)', sun:{x:110,y:-165,c:'#fffdf2',glow:'#ffffff'},
        bld:'#7a8290', bldLit:'#9aa4b2', win:'rgba(180,205,230,', grid:'rgba(86,98,70,', field:[['#74804a',0.5],['#65763e',0.42]], lightBoost:0.55, star:0, mtn:0.85},
  night:{sky:['#02040a','#06101f','#0a1828','#13212e'], gnd:['#0e140c','#0a1208','#070d05','#040703'],
        haze:'28,40,56', horizon:'rgba(40,58,78,.5)', sun:null,
        bld:'#0c1018', bldLit:'#141a26', win:'rgba(255,214,120,', grid:'rgba(28,38,30,', field:[['#10180e',0.5],['#0c140a',0.42]], lightBoost:1.8, star:80, mtn:0.45},
};
function tod(){ return TOD[(typeof cfg!=='undefined'&&cfg.tod)||'dusk']||TOD.dusk; }

//------------------ 确定性随机(布景/星空/城市一次成形,不逐帧抖) ------------------
function mkRng(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
const RG=mkRng(20260606);
// 星空(屏幕空间,夜间用)
const STARS=Array.from({length:120},()=>({x:RG()*2-1,y:RG()*0.9,r:RG()*1.1+0.3,b:RG()*0.6+0.3}));
// 远处城市剪影(地平线一排楼,黄昏/夜间 skyline)
const CITY=Array.from({length:26},(_,i)=>({x:-560+i*44+RG()*12,w:20+RG()*22,h:14+RG()*46,lit:RG()}));
// 跑道两侧布景:建筑(b)/树(t),沿进近走廊 x±,z 散布
const SCENERY=[];
for(let i=0;i<46;i++){
  const side=RG()<0.5?-1:1;
  const xx=side*(70+RG()*240);
  const zz=-1400+RG()*5200;
  if(RG()<0.42){ // 建筑
    const w=18+RG()*46, d=18+RG()*40, h=10+RG()*46;
    SCENERY.push({k:'b',x:xx,z:zz,w,d,h,seed:RG()});
  }else{ // 树
    SCENERY.push({k:'t',x:xx+(RG()*30-15),z:zz,h:6+RG()*9});
  }
}
SCENERY.sort((a,b)=>b.z-a.z); // 远→近,画家算法

//------------------ 基础绘制 ------------------
function dot(p,r,col,glow){wctx.fillStyle=col;if(glow){wctx.shadowBlur=glow;wctx.shadowColor=col;}wctx.beginPath();wctx.arc(p.x,p.y,r,0,7);wctx.fill();if(glow)wctx.shadowBlur=0;}
function quad(p1,p2,p3,p4,col){if(!(p1&&p2&&p3&&p4))return;wctx.fillStyle=col;wctx.beginPath();wctx.moveTo(p1.x,p1.y);wctx.lineTo(p2.x,p2.y);wctx.lineTo(p3.x,p3.y);wctx.lineTo(p4.x,p4.y);wctx.closePath();wctx.fill();}
// 3D 盒(建筑):底面 y=0 到 yTop,x0..x1 × z0..z1。可见面按投影深度排序后填,带顶/明/暗三色。
function worldBox(x0,x1,z0,z1,yTop,colTop,colLit,colDark,winSpec){
  const F=[
    {p:[[x0,yTop,z0],[x1,yTop,z0],[x1,yTop,z1],[x0,yTop,z1]],col:colTop,tag:'top'},
    {p:[[x0,0,z0],[x1,0,z0],[x1,yTop,z0],[x0,yTop,z0]],col:colLit,tag:'zn'},
    {p:[[x0,0,z1],[x1,0,z1],[x1,yTop,z1],[x0,yTop,z1]],col:colDark,tag:'zf'},
    {p:[[x0,0,z0],[x0,0,z1],[x0,yTop,z1],[x0,yTop,z0]],col:colDark,tag:'xl'},
    {p:[[x1,0,z0],[x1,0,z1],[x1,yTop,z1],[x1,yTop,z0]],col:colLit,tag:'xr'},
  ];
  const drawn=[];
  for(const f of F){
    const cl=clipPolyNear(f.p.map(p=>toCamera(p[0],p[1],p[2]))); if(cl.length<3)continue;
    let mz=0;for(const c of cl)mz+=c.z;mz/=cl.length;
    drawn.push({scr:cl.map(projectCam),mz,col:f.col,tag:f.tag});
  }
  drawn.sort((a,b)=>b.mz-a.mz);
  for(const d of drawn){
    const a=d.scr;
    wctx.fillStyle=d.col;wctx.beginPath();wctx.moveTo(a[0].x,a[0].y);for(let i=1;i<a.length;i++)wctx.lineTo(a[i].x,a[i].y);wctx.closePath();wctx.fill();
    // 窗格灯(夜间/黄昏的 zn/xr 朝向面)
    if(winSpec&&(d.tag==='zn'||d.tag==='xr')){
      const minx=Math.min(...a.map(p=>p.x)),maxx=Math.max(...a.map(p=>p.x)),topy=Math.min(...a.map(p=>p.y)),boty=Math.max(...a.map(p=>p.y));
      const cols=Math.max(2,Math.min(6,(maxx-minx)/9|0)),rows=Math.max(2,Math.min(8,(boty-topy)/9|0));
      for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
        if(((r*7+c*13+(d.tag==='zn'?0:5))%5)>2)continue;
        const wx=minx+(c+0.5)/cols*(maxx-minx),wy=topy+(r+0.4)/rows*(boty-topy);
        wctx.fillStyle=winSpec+(0.55+((r+c)%3)*0.12)+')';wctx.fillRect(wx-1.1,wy-1.4,2.2,2.8);
      }
    }
  }
}
// 地面直线:近平面裁剪后画(一端在相机后则切到近平面,不再整体跳过)
function groundLine(x0,z0,x1,z1,col,wd){
  let A=toCamera(x0,0,z0),B=toCamera(x1,0,z1);
  const Ain=A.z>=NEAR,Bin=B.z>=NEAR; if(!Ain&&!Bin)return;
  if(Ain!==Bin){ const t=(NEAR-A.z)/(B.z-A.z),P={r:A.r+(B.r-A.r)*t,u:A.u+(B.u-A.u)*t,z:NEAR}; if(Ain)B=P;else A=P; }
  const a=projectCam(A),b=projectCam(B);
  wctx.strokeStyle=col;wctx.lineWidth=wd;wctx.beginPath();wctx.moveTo(a.x,a.y);wctx.lineTo(b.x,b.y);wctx.stroke();
}

//==================================================================
// 世界主绘制
//==================================================================
function drawWorld(){
  resizeWorldIfNeeded();
  const T=tod();
  wctx.clearRect(0,0,W,Hh);
  const pit=S.pitch*RAD,rol=S.roll*RAD,hy=focal*Math.tan(pit);
  const BIG=Math.hypot(W,Hh)*1.5;
  wctx.save();wctx.translate(cx,cy);wctx.rotate(rol);
  const sky=wctx.createLinearGradient(0,-BIG,0,hy);
  sky.addColorStop(0,T.sky[0]);sky.addColorStop(.45,T.sky[1]);sky.addColorStop(.82,T.sky[2]);sky.addColorStop(1,T.sky[3]);
  wctx.fillStyle=sky;wctx.fillRect(-BIG,-BIG,BIG*2,BIG+hy);
  drawSkyDecor(hy,BIG,T);
  const gnd=wctx.createLinearGradient(0,hy,0,BIG);
  gnd.addColorStop(0,T.gnd[0]);gnd.addColorStop(.18,T.gnd[1]);gnd.addColorStop(.55,T.gnd[2]);gnd.addColorStop(1,T.gnd[3]);
  wctx.fillStyle=gnd;wctx.fillRect(-BIG,hy,BIG*2,BIG);
  const haze=wctx.createLinearGradient(0,hy-50,0,hy+30);
  haze.addColorStop(0,'rgba('+T.haze+',0)');haze.addColorStop(.6,'rgba('+T.haze+',.5)');haze.addColorStop(1,'rgba('+T.haze+',0)');
  wctx.fillStyle=haze;wctx.fillRect(-BIG,hy-50,BIG*2,80);
  wctx.strokeStyle=T.horizon;wctx.lineWidth=1.5;wctx.beginPath();wctx.moveTo(-BIG,hy);wctx.lineTo(BIG,hy);wctx.stroke();
  wctx.restore();

  drawTerrain(T);      // 地形网格/田块 — 速度高度参照
  drawScenery(T);      // 跑道两侧建筑/树
  drawAirport(T);      // 航站楼/塔台/机库
  drawApproachLights(T);
  drawRunway(T);
  drawPAPI();
  drawHUD();
}

function drawSkyDecor(hy,BIG,T){
  const sh=-S.hdg*7;
  // 星空(夜)
  if(T.star>0){wctx.fillStyle='#fff';for(let i=0;i<T.star;i++){const st=STARS[i];const sx=st.x*BIG+sh*0.4,sy=-BIG*0.5+st.y*(hy+BIG*0.5);wctx.globalAlpha=st.b;wctx.beginPath();wctx.arc(sx,sy,st.r,0,7);wctx.fill();}wctx.globalAlpha=1;}
  // 太阳/月
  if(T.sun){const sx=T.sun.x+sh*0.6,sy=hy+T.sun.y;const g=wctx.createRadialGradient(sx,sy,2,sx,sy,70);g.addColorStop(0,T.sun.c);g.addColorStop(.25,T.sun.glow);g.addColorStop(1,'rgba(0,0,0,0)');wctx.fillStyle=g;wctx.beginPath();wctx.arc(sx,sy,70,0,7);wctx.fill();wctx.fillStyle=T.sun.c;wctx.beginPath();wctx.arc(sx,sy,13,0,7);wctx.fill();}
  // 远山(两层剪影)
  for(const layer of [{c:'#5a6378',o:0.5*T.mtn,amp:46,base:hy+6,ph:0.6,sc:520},{c:'#3a4055',o:0.7*T.mtn,amp:70,base:hy+10,ph:0,sc:430}]){
    wctx.fillStyle=layer.c;wctx.globalAlpha=layer.o;wctx.beginPath();wctx.moveTo(-BIG,layer.base);
    for(let xx=-BIG;xx<=BIG;xx+=40){const y=layer.base-Math.max(0,(Math.sin((xx+sh*2)/layer.sc+layer.ph)*0.6+Math.sin((xx)/(layer.sc*0.37)+1.7)*0.4))*layer.amp;wctx.lineTo(xx,y);}
    wctx.lineTo(BIG,layer.base+200);wctx.lineTo(-BIG,layer.base+200);wctx.closePath();wctx.fill();
  }
  wctx.globalAlpha=1;
  // 远处城市天际线(地平线上一排楼 + 窗灯)
  for(const c of CITY){
    const x=c.x+sh*1.1,y=hy-c.h;wctx.fillStyle=T===TOD.night?'#0a0f18':'#42495a';wctx.globalAlpha=0.82;
    wctx.fillRect(x,y,c.w,c.h);
    if(c.lit>0.4){wctx.fillStyle=T.win+(T===TOD.night?0.9:0.4)+')';wctx.globalAlpha=1;
      for(let wy=y+3;wy<hy-2;wy+=5)for(let wx=x+2;wx<x+c.w-2;wx+=5)if(((wx+wy)|0)%3===0)wctx.fillRect(wx,wy,1.6,2);}
    wctx.globalAlpha=1;
  }
  // 云带(随时段调暖冷)
  wctx.globalAlpha=1;
  const cloudCol=T===TOD.night?'180,195,215':'255,232,205';
  const clouds=[[-340,-70,150,18,.42],[120,-120,210,24,.36],[420,-58,170,20,.4],[-120,-150,120,16,.3],[330,-180,150,18,.28],[-460,-130,130,15,.3]];
  for(const c of clouds){
    const x=c[0]+sh*1.6,y=hy+c[1],w=c[2],h=c[3];
    const g=wctx.createLinearGradient(0,y-h,0,y+h);
    g.addColorStop(0,'rgba('+cloudCol+','+c[4]+')');g.addColorStop(1,'rgba('+cloudCol+','+(c[4]*0.4)+')');
    wctx.fillStyle=g;wctx.beginPath();
    for(let i=0;i<5;i++){const ex=x+(i-2)*w*0.32,ey=y-Math.sin(i*1.1)*h*0.4,er=w*(0.34-Math.abs(i-2)*0.05);wctx.ellipse(ex,ey,er,er*0.5,0,0,7);}
    wctx.fill();
  }
}

//------------------ 地形网格 + 田块(给速度/高度/下沉视觉参照) ------------------
function drawTerrain(T){
  const near=S.z+60, far=5200;
  // 田块色斑(大块四边形铺地,patchwork 农田)
  const tiles=[[-900,-300,400,1400],[300,1000,-200,900],[-1300,-600,1600,2900],[700,1500,1200,2600],
               [-700,-100,3200,4600],[200,900,3400,5000],[-1500,-900,-400,800],[900,1700,-300,1000]];
  for(let i=0;i<tiles.length;i++){const t=tiles[i],fc=T.field[i%2];
    if(t[3]<=S.z+NEAR)continue;
    quad3d([t[0],-0.2,t[2]],[t[1],-0.2,t[2]],[t[1],-0.2,t[3]],[t[0],-0.2,t[3]],'rgba('+hexRgb(fc[0])+','+fc[1]+')');  // 近平面裁剪
  }
  // 网格:横向距离杆(constant z)+ 纵向线(constant x),faded
  for(let z=200;z<=far;z+=250){const f=clamp(1.1-z/5200,0.06,0.5);groundLine(-1600,z,1600,z,T.grid+f+')',1);}
  for(let x=-1500;x<=1500;x+=300){if(Math.abs(x)<60)continue;groundLine(x,Math.max(near,-200),x,far,T.grid+'0.32)',1);}
}
function hexRgb(h){const n=parseInt(h.slice(1),16);return ((n>>16)&255)+','+((n>>8)&255)+','+(n&255);}

//------------------ 跑道两侧布景:建筑/树 ------------------
function drawScenery(T){
  for(const o of SCENERY){
    if(o.z<S.z+30||o.z-S.z>5600)continue;            // 剔除相机后/过远
    if(o.k==='b'){
      const lit=(o.seed>0.5),top=lit?T.bldLit:T.bld;
      worldBox(o.x-o.w/2,o.x+o.w/2,o.z-o.d/2,o.z+o.d/2,o.h,top,T.bldLit,T.bld,(T.lightBoost>0.7?T.win:null));
    }else{
      // 树:锥形(底盘+绿冠)
      const b=project(o.x,0,o.z),tp=project(o.x,o.h,o.z);if(!b||!tp)continue;
      const wd=clamp(220/b.z,1,9);
      wctx.fillStyle=T===TOD.night?'#0d1a0e':'#2f4a24';
      wctx.beginPath();wctx.moveTo(tp.x,tp.y);wctx.lineTo(b.x-wd,b.y);wctx.lineTo(b.x+wd,b.y);wctx.closePath();wctx.fill();
    }
  }
}

//------------------ 机场:航站楼 + 塔台 + 机库(跑道左侧) ------------------
function drawAirport(T){
  // 航站楼(长低建筑,跑道左侧平行)
  worldBox(-150,-95,180,560,16,T.bldLit,T.bldLit,T.bld,(T.lightBoost>0.7?T.win:null));
  // 廊桥/小附属
  worldBox(-95,-80,230,250,8,T.bld,T.bldLit,T.bld,null);
  worldBox(-95,-80,330,350,8,T.bld,T.bldLit,T.bld,null);
  // 塔台(细高 + 顶部塔帽)
  worldBox(-128,-118,610,620,34,T.bld,T.bldLit,T.bld,null);
  worldBox(-134,-112,608,622,42,T.bldLit,T.bldLit,T.bld,(T.lightBoost>0.7?T.win:null));
  // 塔台顶红灯(夜间航障灯)
  const bl=project(-123,46,615);if(bl)dot(bl,clamp(120/bl.z,1,3.4)*(0.6+0.4*Math.sin(S.t*4)),'rgba(255,60,40,.95)',8);
  // 机库(右侧大跨)
  worldBox(95,170,260,360,20,T.bld,T.bldLit,T.bld,null);
  worldBox(95,170,420,520,20,T.bld,T.bldLit,T.bld,null);
  // 左侧平行滑行道
  const hw=RWY.W/2;
  for(let z=120;z<RWY.L;z+=60){quad3d([-hw-30,0.02,z],[-hw-18,0.02,z],[-hw-18,0.02,z+38],[-hw-30,0.02,z+38],'rgba(60,66,76,.7)');}
}

//------------------ 进近灯(ALSF 式:中线灯排 + 横排 + 顺序闪 rabbit) ------------------
function drawApproachLights(T){
  const rabbit=Math.floor((S.t*3)%15),boost=T.lightBoost;
  for(let i=1;i<=16;i++){
    const zz=-i*55,p=project(0,0.5,zz);
    if(p&&p.z<9500){
      const fade=clamp((1.5-p.z/3400)*boost,0.12,1);
      const flash=(i>=9&&(16-i)===rabbit)?1.9:1;
      dot(p,clamp(135/p.z,0.6,4.6)*flash,'rgba(255,250,225,'+fade+')',flash>1?10:(boost>1.3?5:0));
    }
    // 每隔几灯一道横排(crossbar)
    if(i%3===0)for(let xo=-15;xo<=15;xo+=5){if(xo===0)continue;const q=project(xo,0.5,zz);if(q&&q.z<7200)dot(q,clamp(105/q.z,0.45,2.8),'rgba(255,248,215,'+clamp((1.3-q.z/3200)*boost,0.1,0.9)+')',boost>1.3?3:0);}
  }
  // 入口绿灯排(threshold)
  const hw=RWY.W/2;
  for(let x=-hw;x<=hw;x+=6){const p=project(x,0.4,0);if(p&&p.z<5000)dot(p,clamp(95/p.z,0.5,2.6),'rgba(70,255,140,'+clamp(1.2*boost,0.3,1)+')',boost>1.3?4:0);}
}

//------------------ 跑道(+ 距离剩余牌) ------------------
function drawRunway(T){
  const hw=RWY.W/2,seg=50,boost=T.lightBoost;
  for(let z0=0;z0<RWY.L;z0+=seg){const z1=Math.min(z0+seg,RWY.L);const shade=z0<RWY.L*0.5?'#3c424c':'#363c45';quad3d([-hw,0,z0],[hw,0,z0],[hw,0,z1],[-hw,0,z1],shade);}   // 跑道主面:近平面裁剪,贴近不消失
  for(let i=0;i<8;i++){const w8=(RWY.W-8)/8,x0=-hw+4+i*w8;quad3d([x0,0.03,3],[x0+w8*0.62,0.03,3],[x0+w8*0.62,0.03,26],[x0,0.03,26],'rgba(248,248,252,.92)');}
  const pn=project(0,0.04,135);
  if(pn&&pn.z<2600){const sc=clamp(focal/pn.z*0.6,4,90);wctx.save();wctx.translate(pn.x,pn.y);wctx.rotate(S.roll*RAD);wctx.fillStyle='rgba(245,248,255,.9)';wctx.font='700 '+sc+'px '+MONO;wctx.textAlign='center';wctx.textBaseline='middle';wctx.fillText('27',0,0);wctx.restore();}
  for(let zz=40;zz<RWY.L;zz+=60)quad3d([-0.45,0.03,zz],[0.45,0.03,zz],[0.45,0.03,zz+30],[-0.45,0.03,zz+30],'rgba(250,250,255,.82)');
  for(const s of[-1,1])quad3d([s*6,0.03,RWY.aim-30],[s*9.5,0.03,RWY.aim-30],[s*9.5,0.03,RWY.aim+30],[s*6,0.03,RWY.aim+30],'rgba(245,245,250,.9)');
  for(const s of[-1,1])quad3d([s*6,0.03,RWY.aim-330],[s*9.5,0.03,RWY.aim-330],[s*9.5,0.03,RWY.aim-300],[s*6,0.03,RWY.aim-300],'rgba(245,245,250,.82)');
  for(let z0=0;z0<RWY.L;z0+=seg){const z1=Math.min(z0+seg,RWY.L);for(const sx of[-hw,hw]){const a=project(sx,0.02,z0),b=project(sx,0.02,z1);if(a&&b){wctx.strokeStyle='rgba(242,242,247,.82)';wctx.lineWidth=clamp(180/Math.min(a.z,b.z),1,5);wctx.beginPath();wctx.moveTo(a.x,a.y);wctx.lineTo(b.x,b.y);wctx.stroke();}}}
  // 边灯(夜间增亮)
  for(let zz=0;zz<=RWY.L;zz+=120)for(const side of[-hw-1.5,hw+1.5]){const p=project(side,0.5,zz);if(p&&p.z<7000)dot(p,clamp(95/p.z,0.4,2.6),zz>RWY.L-500?'rgba(255,90,60,.92)':'rgba(255,250,225,'+clamp(0.85*boost,0.4,1)+')',boost>1.3?3:0);}
  // 距离剩余牌(每 600m 一块,跑道右侧;显示剩余千英尺)
  for(let z=600;z<RWY.L;z+=600){
    const remFt=Math.round((RWY.L-z)*M_TO_FT/1000);
    const a=project(hw+5,0,z),b=project(hw+5,4.2,z);if(!a||!b||a.z>3500)continue;
    const wpx=clamp(340/a.z,3,30);
    wctx.fillStyle='#111';wctx.fillRect(b.x-wpx,b.y,wpx*2,a.y-b.y);
    wctx.fillStyle='#ffd23a';wctx.font='700 '+clamp(wpx*0.9,4,22)+'px '+MONO;wctx.textAlign='center';wctx.textBaseline='middle';
    wctx.fillText(remFt,b.x,(a.y+b.y)/2);
  }
}
function drawPAPI(){
  const dz=PAPI.z-S.z;if(dz<=0)return;
  const ang=Math.atan2(S.alt-PAPI.y,dz)*DEG, thr=[2.5,2.83,3.16,3.5];
  for(let i=0;i<4;i++){const p=project(PAPI.x-i*4,PAPI.y+1.3,PAPI.z);if(!p)continue;dot(p,clamp(165/p.z,1.2,5.2),ang>thr[i]?'rgba(255,255,255,.96)':'rgba(255,70,50,.96)',9);}
}

//------------------ HUD ------------------
function drawHUD(){
  const ias=Math.round(S.V*MS_TO_KT),altft=Math.round(S.alt*M_TO_FT),vs=Math.round(S.V*Math.sin(S.gamma)*MS_TO_FPM);
  const dist=(RWY.aim-S.z)/1852,c=getC('--grn');
  let s='<g font-family="'+MONO+'" fill="'+c+'">';
  s+='<rect x="24" y="262" width="96" height="42" rx="5" fill="rgba(5,9,15,.5)" stroke="'+c+'" stroke-width="1.4"/><text x="72" y="285" font-size="27" font-weight="700" text-anchor="middle">'+ias+'</text><text x="72" y="299" font-size="10" fill="#9fb" text-anchor="middle">IAS KT</text>';
  s+='<rect x="880" y="262" width="96" height="42" rx="5" fill="rgba(5,9,15,.5)" stroke="'+c+'" stroke-width="1.4"/><text x="928" y="285" font-size="27" font-weight="700" text-anchor="middle">'+altft+'</text><text x="928" y="299" font-size="10" fill="#9fb" text-anchor="middle">ALT FT</text>';
  s+='<text x="928" y="328" font-size="14" text-anchor="middle">V/S '+(vs>0?'+':'')+vs+'</text>';
  if(S.alt<300&&!S.onGround)s+='<text x="500" y="130" font-size="20" font-weight="700" text-anchor="middle">RA '+Math.max(0,altft)+'</text>';
  s+='<text x="500" y="580" font-size="13" text-anchor="middle" fill="#9fb">DIST '+(dist>0?dist.toFixed(1):'0.0')+' NM&#160;&#160;·&#160;&#160;G/S '+Math.round(Math.max(0,S.V*Math.cos(S.gamma)-WIND.head)*MS_TO_KT)+'</text>';
  const fp=project(S.x+Math.sin(S.hdg*RAD)*1000,S.alt+Math.tan(S.gamma)*1000,S.z+1000);
  if(fp){const fx=fp.x/W*1000,fy=fp.y/Hh*600;if(fx>120&&fx<880&&fy>140&&fy<520){s+='<g stroke="'+c+'" stroke-width="2" fill="none"><circle cx="'+fx.toFixed(0)+'" cy="'+fy.toFixed(0)+'" r="9"/><line x1="'+(fx-9)+'" y1="'+fy+'" x2="'+(fx-20)+'" y2="'+fy+'"/><line x1="'+(fx+9)+'" y1="'+fy+'" x2="'+(fx+20)+'" y2="'+fy+'"/><line x1="'+fx+'" y1="'+(fy-9)+'" x2="'+fx+'" y2="'+(fy-18)+'"/></g>';}}
  s+='</g>';
  hudsvg.innerHTML=s;
}
