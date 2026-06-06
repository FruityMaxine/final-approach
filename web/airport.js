"use strict";
//==================================================================
// AIRPORT — 多跑道机场布局  ·  独立模块(避 render.js 膨胀)
//   主跑道 27 仍由 render.js drawRunway 画(进近用);本模块画副跑道(平行/交叉)
//   + 滑行道网 + 停机坪。任意位置/朝向跑道用 rwPt 变换 + quad3d 裁剪绘制。
//   依赖 render.js 运行期全局:quad3d/project/dot/wctx/MONO/clamp/RAD/focal。
//==================================================================
const AIRPORT={
  // 副跑道(主 27 在 game.js RWY,此处为额外跑道)
  runways:[
    {id:'27R', hdg:270, cx:-130, cz:1500, W:42, L:2800},   // 平行跑道(左)
    {id:'33',  hdg:330, cx:220,  cz:1000, W:40, L:2200},   // 交叉跑道(不同朝向)
  ],
  // 滑行道段[x0,z0,x1,z1,宽]
  taxiways:[
    [-22.5,200,-90,200,16],[-90,200,-90,1400,18],[-90,1400,-22.5,1400,16],
    [-90,700,-130,700,16],[-90,1100,-130,1100,16],
  ],
  // 停机坪(航站楼前)
  apron:{x0:-150,x1:-92,z0:560,z1:900},
  // 跑道局部(沿向 along / 横向 across)→ 世界坐标[x,y,z]
  rwPt(rw,along,across,y){ const a=(rw.hdg-270)*RAD,sa=Math.sin(a),ca=Math.cos(a);
    return [rw.cx+along*sa+across*ca, y, rw.cz+along*ca-across*sa]; },
  drawRunwayAt(rw,T){
    const hw=rw.W/2,hl=rw.L/2,seg=90;
    for(let s=-hl;s<hl;s+=seg){const s1=Math.min(s+seg,hl);
      quad3d(this.rwPt(rw,s,-hw,0),this.rwPt(rw,s,hw,0),this.rwPt(rw,s1,hw,0),this.rwPt(rw,s1,-hw,0),'#373d47');}
    // 中线虚线
    for(let s=-hl+20;s<hl;s+=60)quad3d(this.rwPt(rw,s,-0.6,0.03),this.rwPt(rw,s,0.6,0.03),this.rwPt(rw,s+28,0.6,0.03),this.rwPt(rw,s+28,-0.6,0.03),'rgba(250,250,255,.62)');
    // 入口斑马 + 跑道号(近阈端 s=-hl)
    for(let i=0;i<6;i++){const a0=-hw+4+i*(rw.W-8)/6;quad3d(this.rwPt(rw,-hl+4,a0,0.03),this.rwPt(rw,-hl+4,a0+(rw.W-8)/6*0.6,0.03),this.rwPt(rw,-hl+22,a0+(rw.W-8)/6*0.6,0.03),this.rwPt(rw,-hl+22,a0,0.03),'rgba(244,244,250,.8)');}
    const np=this.rwPt(rw,-hl+45,0,0.04),pn=project(np[0],np[1],np[2]);
    if(pn&&pn.z<3000){const sc=clamp(focal/pn.z*0.5,4,70);wctx.save();wctx.translate(pn.x,pn.y);wctx.fillStyle='rgba(240,244,252,.85)';wctx.font='700 '+sc+'px '+MONO;wctx.textAlign='center';wctx.textBaseline='middle';wctx.fillText(rw.id,0,0);wctx.restore();}
    // 边灯
    for(let s=-hl;s<=hl;s+=130)for(const sx of[-hw-1,hw+1]){const p=project(...this.rwPt(rw,s,sx,0.5));if(p&&p.z<6000)dot(p,clamp(80/p.z,0.4,2),'rgba(255,250,225,'+clamp(0.7*T.lightBoost,0.3,1)+')',T.lightBoost>1.3?2:0);}
  },
  draw(T){
    // 停机坪
    const ap=this.apron;quad3d([ap.x0,0.02,ap.z0],[ap.x1,0.02,ap.z0],[ap.x1,0.02,ap.z1],[ap.x0,0.02,ap.z1],'rgba(54,60,70,.85)');
    for(let z=ap.z0+20;z<ap.z1;z+=40)quad3d([ap.x0+2,0.03,z],[ap.x1-2,0.03,z],[ap.x1-2,0.03,z+1.5],[ap.x0+2,0.03,z+1.5],'rgba(230,200,90,.5)'); // 停机位线
    // 滑行道
    for(const t of this.taxiways){const dx=t[2]-t[0],dz=t[3]-t[1],len=Math.hypot(dx,dz)||1,nx=-dz/len*t[4]/2,nz=dx/len*t[4]/2;
      quad3d([t[0]+nx,0.02,t[1]+nz],[t[0]-nx,0.02,t[1]-nz],[t[2]-nx,0.02,t[3]-nz],[t[2]+nx,0.02,t[3]+nz],'rgba(58,64,74,.8)');}
    // 副跑道(远→近排序避叠错)
    const rws=this.runways.slice().sort((a,b)=>b.cz-a.cz);
    for(const rw of rws)this.drawRunwayAt(rw,T);
  },
};
if(typeof window!=='undefined')window.AIRPORT=AIRPORT;
