"use strict";
//==================================================================
// WB — 载重平衡 Weight & Balance(组19 Tick4)
//   5 站位装载(前/后货舱·客舱前/后·燃油)→ 总重 GW + 重心 CG%MAC(加权臂)
//   + 配平 TRIM + CG 包线绿/红。payload 计入 AC.m(联动失速/性能/MCDU)。
//   依赖运行期全局:AC/FUEL/PERF/MCDU。高密度装载网格,手机零横滚。
//==================================================================
const WB={
  label:'载重 W&B',
  // 站位载重 kg(燃油由 FUEL 实时,不在此调)
  load:{ fwdCargo:1500, aftCargo:1500, paxFwd:4000, paxAft:4000 },
  STEP:600, MAXST:9000,
  // 各站位臂(%MAC 位置);空机 OEW 在 25%MAC,燃油在 27%(臂展放大让装载有杠杆)
  ARM:{ dry:25, fwdCargo:2, aftCargo:65, paxFwd:15, paxAft:42, fuel:27 },
  ENV:[22,29],   // CG 安全包线 %MAC(收紧:极端装载可超限)

  payload(){ const L=this.load; return L.fwdCargo+L.aftCargo+L.paxFwd+L.paxAft; },   // 不含燃油(燃油在 FUEL.total)
  gw(){ const dry=(typeof AC!=='undefined')?AC.dryMass:44000, fuel=(typeof FUEL!=='undefined')?FUEL.total():18000; return dry+this.payload()+fuel; },
  cg(){
    const dry=(typeof AC!=='undefined')?AC.dryMass:44000, fuel=(typeof FUEL!=='undefined')?FUEL.total():18000, L=this.load, A=this.ARM;
    const gw=dry+this.payload()+fuel; if(gw<=0)return 25;
    const mom=dry*A.dry+L.fwdCargo*A.fwdCargo+L.aftCargo*A.aftCargo+L.paxFwd*A.paxFwd+L.paxAft*A.paxAft+fuel*A.fuel;
    return mom/gw;
  },
  inEnv(){ const c=this.cg(); return c>=this.ENV[0]&&c<=this.ENV[1]; },
  trim(){ return (this.cg()-25)*0.42; },   // 配平随 CG(简化)
  adj(k,dir){ this.load[k]=Math.max(0,Math.min(this.MAXST,this.load[k]+dir*this.STEP)); },

  //------------------ 面板 ------------------
  STATIONS:[['fwdCargo','前货舱'],['paxFwd','客舱前'],['paxAft','客舱后'],['aftCargo','后货舱']],
  render(host){
    const s=host?host.querySelector('#wbScreen'):null; if(!s)return;
    const cg=this.cg(), gw=this.gw(), ok=this.inEnv(), tr=this.trim();
    // 签名缓存:载重/CG/GW 不变则不重建 DOM(避免逐帧重建致按钮点击失效)
    const sig=Object.values(this.load).join(',')+'|'+cg.toFixed(2)+'|'+Math.round(gw);
    if(sig===this._sig)return; this._sig=sig;
    let rows='';
    for(const [k,nm] of this.STATIONS){
      rows+='<div class="wb-st"><span class="wb-nm">'+nm+'</span>'
        +'<button class="wb-b" data-wb="'+k+'" data-dir="-1">−</button>'
        +'<b class="wb-v">'+this.load[k]+'</b>'
        +'<button class="wb-b" data-wb="'+k+'" data-dir="1">+</button></div>';
    }
    // CG 包线条:18..32 绿,marker 当前 cg(范围画到 14..36)
    const lo=14,hi=36, pct=v=>Math.max(0,Math.min(100,(v-lo)/(hi-lo)*100));
    const env='<div class="wb-env"><i class="wb-envg" style="left:'+pct(this.ENV[0])+'%;width:'+(pct(this.ENV[1])-pct(this.ENV[0]))+'%"></i>'
      +'<i class="wb-mk '+(ok?'ok':'no')+'" style="left:'+pct(cg)+'%"></i></div>';
    s.innerHTML='<div class="wb-grid">'+rows+'</div>'
      +'<div class="wb-out"><div class="wb-cell"><span>总重 GW</span><b>'+Math.round(gw)+'<small>KG</small></b></div>'
      +'<div class="wb-cell '+(ok?'ok':'no')+'"><span>重心 CG</span><b>'+cg.toFixed(1)+'<small>%MAC</small></b></div>'
      +'<div class="wb-cell"><span>配平 TRIM</span><b>'+(tr>=0?'UP ':'DN ')+Math.abs(tr).toFixed(1)+'</b></div></div>'
      +'<div class="wb-envlbl">CG 包线 '+this.ENV[0]+'–'+this.ENV[1]+'%MAC '+(ok?'· 安全':'· <span class="wb-warn">超限!</span>')+'</div>'+env;
  },
  build(){
    return '<div class="syspanel"><div class="sp-title">载重平衡 W&B</div>'
      +'<div class="wb-screen" id="wbScreen"></div>'
      +'<div class="sp-hint">调各站位装载(kg):前舱→CG 前移、后舱→CG 后移。CG 须在绿区包线内(超限红);总重与配平随之变,并联动失速速度 / 性能 / MCDU。</div></div>';
  },
  wire(host){
    const self=this;
    host.querySelector('#wbScreen').addEventListener('click',e=>{
      const btn=e.target.closest('[data-wb]'); if(btn){ self.adj(btn.dataset.wb,+btn.dataset.dir); self._sig=null; self.render(host); }
    });
    this._sig=null; this.render(host);
  },
  sync(host){ this.render(host); },   // 逐帧(燃油消耗→GW/CG 变)
};

if(typeof PANELS!=='undefined')PANELS.register('wb',WB);
if(typeof window!=='undefined')window.WB=WB;
