"use strict";
//==================================================================
// ENGINES — 多发引擎模型(可配 2/4 发)  ·  独立模块
//   每发独立 N1/N2/EGT/FF + 状态机(off/start/idle/run/fail/fire)。
//   总推力 = Σ各发;不对称推力(失效/单发)产生偏航力矩接入 game.js 侧向物理。
//   依赖 game.js 全局(运行期):AC/clamp/lerp。SYS 登记引擎开关。
//   顶层只定义,加载置 game.js 之前。
//==================================================================
const ENGINES={
  count:2, list:[], REVF:0.42,
  // 横向力臂(归一):决定不对称推力的偏航大小
  layout(n){ return n===4 ? [-3.0,-1.4,1.4,3.0] : [-2.4,2.4]; },
  setCount(n){
    n=(n===4?4:2); this.count=n;
    this.list=this.layout(n).map((x,i)=>({
      id:i+1, x, n1:0.25, n2:0.62, egt:430, ff:0.6,
      state:'run', throttleOvr:null, fuelCut:false, fire:false, starter:false, ign:false, pump:true
    }));
    if(typeof renderEICAS==='function')renderEICAS();
  },
  reset(){ for(const e of this.list){ e.n1=0.25;e.n2=0.62;e.egt=430;e.ff=0.6;e.state='run';e.throttleOvr=null;e.fuelCut=false;e.fire=false;e.starter=false;e.ign=false;e.pump=true; } },
  anyRun(){ return this.list.some(e=>e.state==='run'||e.state==='idle'); },
  avgN1(){ if(!this.list.length)return 0; let s=0; for(const e of this.list)s+=e.n1; return s/this.list.length; },

  // 每发推进:状态机 + spool + EGT/FF。cmd=公共油门(0..1)
  step(dt, cmd){
    cmd=clamp(cmd,0,1);
    for(const e of this.list){
      if(e.fire&&e.state!=='off'&&e.state!=='fail')e.state='fail';     // 起火→失效
      const t=(e.throttleOvr!=null?clamp(e.throttleOvr,0,1):cmd);       // 单发油门覆盖(Tick4 用)
      if(e.fuelCut){                                                    // 断油停车
        e.state='off'; e.n1=Math.max(0,e.n1-dt*0.25); e.n2=Math.max(0,e.n2-dt*0.20); e.ff=0; e.egt=Math.max(40,e.egt-dt*60);
      } else if(e.state==='fail'){                                      // 失效退转
        e.n1=Math.max(0,e.n1-dt*0.30); e.n2=Math.max(0.05,e.n2-dt*0.22); e.ff=0; e.egt=Math.max(40,e.egt-dt*45);
        if(e.n1<0.02&&e.n2<0.08)e.state='off';
      } else if(e.state==='off'){
        if(e.starter){ e.n2=Math.min(0.30,e.n2+dt*0.10); if(e.n2>=0.20&&e.ign)e.state='start'; }
        else { e.n1=Math.max(0,e.n1-dt*0.2); e.n2=Math.max(0,e.n2-dt*0.15); e.ff=0; e.egt=Math.max(40,e.egt-dt*30); }
      } else if(e.state==='start'){                                    // 点火起转
        e.n2=Math.min(0.62,e.n2+dt*0.18); e.n1=Math.min(0.25,e.n1+dt*0.12);
        e.egt=Math.min(560,e.egt+dt*180); e.ff=0.5;
        if(e.n2>=0.58)e.state='idle';
      } else {                                                         // idle/run:跟油门 spool
        const sp=(t>e.n1?0.55:0.95);
        e.n1=clamp(e.n1+(t-e.n1)*Math.min(1,dt*sp*2.4),0.18,1);
        e.n2=clamp(lerp(e.n2,0.55+e.n1*0.45,Math.min(1,dt*2)),0,1.05);
        e.egt=lerp(e.egt,380+e.n1*520,Math.min(1,dt*1.5));
        e.ff=clamp(0.3+e.n1*2.4,0,3.0);
        e.state='run';
      }
    }
  },
  // 总推力(N):各发之和;地面反推取负
  totalThrust(reverse,onGround){
    let T=0; const per=AC.maxThrust/this.count;
    for(const e of this.list){
      let t=e.n1*per;
      if(reverse&&onGround&&e.state==='run')t=-e.n1*per*this.REVF;
      T+=t;
    }
    return T;
  },
  // 不对称推力偏航(rad/s 贡献):对称时为 0;单发失效产生可控偏航
  yawFromThrust(){
    let m=0; const per=AC.maxThrust/this.count;
    for(const e of this.list)m+=e.x*(e.n1*per);
    return m/(AC.maxThrust*6);
  },
  // 故障注入接口(SYS/系统面板调用)
  failEngine(i,on){ const e=this.list[i]; if(e){ if(on){e.state='fail';}else{e.state='run';e.n2=Math.max(e.n2,0.4);} } },
  fireEngine(i,on){ const e=this.list[i]; if(e)e.fire=!!on; },
  cutoff(i,on){ const e=this.list[i]; if(e)e.fuelCut=!!on; },
};
if(typeof window!=='undefined')window.ENGINES=ENGINES;
