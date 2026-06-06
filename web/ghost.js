"use strict";
//==================================================================
// GHOST — 幽灵轨迹对比(组19 Tick3)
//   着陆评分超该机场历史最佳→存轻量轨迹({z,alt,x})到 localStorage(per 机场)。
//   下次同机场进近:render drawWorld 末叠加半透明幽灵航迹虚线 + 幽灵机标记,
//   用 render 既有 project(world→screen)投影,与真实世界投影一致。
//   区别于 REPLAY(着陆后静态复盘图表)——GHOST 是进近中第一视角实时跨次对比。
//   依赖运行期全局:S/RWY/project/wctx/NEAR/REPLAY。高密度开关面板,手机零横滚。
//==================================================================
const GHOST={
  label:'幽灵',
  KEY:'fa.ghost', enabled:false, best:{}, _drawn:0,

  load(){ try{ const v=JSON.parse(localStorage.getItem(this.KEY)||'{}'); if(v&&typeof v==='object')this.best=v; }catch(_){ this.best={}; } },
  save(){ try{ localStorage.setItem(this.KEY,JSON.stringify(this.best)); }catch(_){} },
  _key(){ return (typeof RWY!=='undefined'&&RWY.aptName)?RWY.aptName:'—'; },

  // 着陆后:本次评分超该机场最佳→存轨迹
  maybeSave(airport,buf,score){
    if(!airport||!buf||buf.length<3)return false;
    const cur=this.best[airport]; if(cur&&cur.score>=score)return false;
    this.best[airport]={ score:Math.round(score), pts:buf.map(p=>({z:Math.round(p.z),alt:+(+p.alt).toFixed(1),x:+(+p.x).toFixed(1)})) };
    this.save(); return true;
  },
  clearCur(){ const k=this._key(); if(this.best[k]){ delete this.best[k]; this.save(); } },
  curBest(){ const g=this.best[this._key()]; return g?g.score:null; },

  _interp(pts,z){
    if(z<=pts[0].z)return {alt:pts[0].alt,x:pts[0].x};
    const last=pts[pts.length-1]; if(z>=last.z)return {alt:last.alt,x:last.x};
    for(let i=1;i<pts.length;i++){ if(pts[i].z>=z){ const a=pts[i-1],c=pts[i],f=(z-a.z)/((c.z-a.z)||1);
      return {alt:a.alt+(c.alt-a.alt)*f, x:a.x+(c.x-a.x)*f}; } }
    return {alt:last.alt,x:last.x};
  },

  // render drawWorld 末调:叠加幽灵航迹 + 幽灵机标记
  draw(){
    if(!this.enabled||typeof project!=='function'||typeof wctx==='undefined')return;
    const g=this.best[this._key()]; if(!g||!g.pts||g.pts.length<2)return;
    const pts=g.pts; this._drawn++;
    wctx.save();
    // 幽灵航迹虚线(青,半透明)
    wctx.strokeStyle='rgba(42,216,255,.5)'; wctx.lineWidth=2; wctx.setLineDash([7,6]);
    wctx.beginPath(); let started=false;
    for(const pt of pts){ const p=project(pt.x,pt.alt,pt.z); if(!p){ started=false; continue; } started?wctx.lineTo(p.x,p.y):wctx.moveTo(p.x,p.y); started=true; }
    wctx.stroke(); wctx.setLineDash([]);
    // 幽灵机标记:本机前方 150m 处最佳线位置
    const la=S.z+150, h=this._interp(pts,la), p=project(h.x,h.alt,la);
    if(p){ wctx.fillStyle='rgba(42,216,255,.55)'; wctx.strokeStyle='rgba(42,216,255,.85)'; wctx.lineWidth=1.5;
      const r=Math.max(4,Math.min(14,120/p.z));
      wctx.beginPath(); wctx.arc(p.x,p.y,r,0,7); wctx.stroke();
      wctx.beginPath(); wctx.moveTo(p.x-r*1.5,p.y); wctx.lineTo(p.x+r*1.5,p.y); wctx.moveTo(p.x,p.y-r); wctx.lineTo(p.x,p.y+r); wctx.stroke();
    }
    wctx.restore();
  },

  //------------------ 幽灵开关面板 ------------------
  build(){
    return '<div class="syspanel"><div class="sp-title">幽灵轨迹对比</div>'
      +'<div class="gh-row"><div class="gh-txt"><b>叠加幽灵航迹</b><span>飞行视野显示该机场历史最佳进近轨迹(青色虚线 + 幽灵机)</span></div><div class="sw" id="ghSw"></div></div>'
      +'<div class="gh-best" id="ghBest"></div>'
      +'<div class="gh-ctl"><button class="gh-clr" id="ghClr">清除当前机场幽灵</button></div>'
      +'<div class="sp-hint">每个机场保存你的最佳进近轨迹(评分更高自动覆盖)。开启后下次同机场进近,飞行视野叠加最佳线供对比追逐。区别于"回放"(着陆后静态复盘)。</div></div>';
  },
  wire(host){
    const self=this;
    const sw=host.querySelector('#ghSw'); if(sw)sw.addEventListener('click',()=>{ self.enabled=!self.enabled; self.render(host); });
    const clr=host.querySelector('#ghClr'); if(clr)clr.addEventListener('click',()=>{ self.clearCur(); self.render(host); });
    this.render(host);
  },
  render(host){
    if(!host)return;
    const sw=host.querySelector('#ghSw'); if(sw)sw.classList.toggle('on',this.enabled);
    const bs=host.querySelector('#ghBest'); if(bs){ const b=this.curBest();
      bs.innerHTML=b!=null? '<span>'+this._key()+' 最佳进近评分</span><b>'+b+'</b>' : '<span>'+this._key()+'</span><b class="none">暂无幽灵 · 完成一次着陆后生成</b>'; }
  },
  sync(host){ this.render(host); },
};
GHOST.load();

if(typeof PANELS!=='undefined')PANELS.register('ghost',GHOST);
if(typeof window!=='undefined')window.GHOST=GHOST;
