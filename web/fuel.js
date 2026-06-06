"use strict";
//==================================================================
// FUEL — 燃油系统  ·  独立模块
//   三油箱(左/中/右)+ 泵 + 交输活门 crossfeed。各发动机按 FF 耗油,
//   油箱抽空 + 无 crossfeed → 对应发动机燃油饥饿 → flameout(engines 状态机 fail)。
//   油量影响总重 AC.m。注册"燃油"面板(第 2 个面板,验证框架可扩)。
//   依赖 game.js/engines.js 运行期全局。
//==================================================================
const FUEL={
  RATE:1.0,                        // FF→kg/s 标定
  tanks:{ left:{qty:5500,cap:5500,leak:0}, center:{qty:7000,cap:7000,leak:0}, right:{qty:5500,cap:5500,leak:0} },
  pump:{ left:true, center:true, right:true },
  xfeed:false,                     // 交输活门(默认关)
  starveT:0,
  reset(){ // qty 复位到当前 cap(支持机型库切换后的容量;applyAircraft 已写 cap)
           this.tanks.left.qty=this.tanks.left.cap; this.tanks.center.qty=this.tanks.center.cap; this.tanks.right.qty=this.tanks.right.cap;
           this.tanks.left.leak=this.tanks.center.leak=this.tanks.right.leak=0;
           this.pump.left=this.pump.center=this.pump.right=true; this.xfeed=false; },
  total(){ return this.tanks.left.qty+this.tanks.center.qty+this.tanks.right.qty; },
  capTotal(){ return this.tanks.left.cap+this.tanks.center.cap+this.tanks.right.cap; },
  side(e){ return e.x<0?'left':'right'; },
  // 某发动机的供油优先序:中央先用 → 同侧;crossfeed 开则追加另一侧
  sourceFor(e){
    const s=this.side(e), o=s==='left'?'right':'left';
    const seq=['center',s];
    if(this.xfeed)seq.push(o);
    return seq.filter(t=>this.pump[t]);     // 泵关的油箱不供油
  },
  draw(seq,need){
    let got=0;
    for(const t of seq){
      if(got>=need)break;
      const take=Math.min(this.tanks[t].qty, need-got);
      this.tanks[t].qty-=take; got+=take;
    }
    return got;
  },
  step(dt){
    if(typeof SYS!=='undefined'&&!SYS.get('features','fuelSystem'))return;   // 简化档:无限油
    // 漏油(fuelLeak 故障置 tank.leak):持续流失,最终该侧发动机饥饿熄火
    for(const k of ['left','center','right']){ const t=this.tanks[k]; if(t.leak>0)t.qty=Math.max(0,t.qty-t.leak*dt); }
    if(typeof ENGINES==='undefined')return;
    for(const e of ENGINES.list){
      if(e.state!=='run'&&e.state!=='idle'&&e.state!=='start')continue;
      const need=e.ff*this.RATE*dt;
      const got=this.draw(this.sourceFor(e),need);
      if(got<need*0.5){                       // 供油不足 → 燃油饥饿熄火(真连锁)
        e.fuelStarve=true; e.state='fail';
      }
    }
    // 油量影响总重(干重 + 当前油量 + W&B 装载)
    if(typeof AC!=='undefined'){ AC.m=AC.dryMass+this.total()+(typeof WB!=='undefined'?WB.payload():0); }
  },
};
if(typeof window!=='undefined')window.FUEL=FUEL;

//------------------ 燃油面板(第 2 个注册面板,验证框架可扩到数十个) ------------------
if(typeof PANELS!=='undefined'){
  PANELS.register('fuel',{
    label:'燃油',
    build(){
      const T=FUEL.tanks;
      const bar=(id,t,nm)=>'<div class="tank"><div class="tank-nm">'+nm+'</div>'
        +'<div class="tank-bar"><div class="tank-fill" id="tf_'+id+'"></div></div>'
        +'<div class="tank-q" id="tq_'+id+'">0</div>'
        +'<button class="eng-btn" data-pump="'+id+'">泵 PUMP</button></div>';
      return '<div class="syspanel"><div class="sp-title">燃油系统 · 三油箱 / 交输</div>'
        +'<div class="fuel-row">'+bar('left',T.left,'左 LEFT')+bar('center',T.center,'中 CENTER')+bar('right',T.right,'右 RIGHT')+'</div>'
        +'<div class="fuel-ctl"><button class="eng-btn xfeed" data-xfeed="1">交输活门 CROSSFEED</button>'
        +'<div class="fuel-total">总油量 <b id="fuel_total">0</b> kg</div></div>'
        +'<div class="sp-hint">中央油箱先用 → 同侧机翼油箱。某箱抽空且交输活门关 → 对应发动机燃油饥饿熄火。开交输活门可跨侧供油。</div></div>';
    },
    wire(host){
      host.querySelectorAll('[data-pump]').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.pump;FUEL.pump[k]=!FUEL.pump[k];this.sync(host);}));
      const xf=host.querySelector('[data-xfeed]'); if(xf)xf.addEventListener('click',()=>{FUEL.xfeed=!FUEL.xfeed;this.sync(host);});
    },
    sync(host){
      if(!host)return; const g=id=>document.getElementById(id);
      for(const id of ['left','center','right']){
        const t=FUEL.tanks[id], pct=Math.max(0,Math.min(100,t.qty/t.cap*100));
        if(g('tf_'+id))g('tf_'+id).style.height=pct+'%';
        if(g('tq_'+id))g('tq_'+id).textContent=Math.round(t.qty);
        const pb=host.querySelector('[data-pump="'+id+'"]'); if(pb)pb.classList.toggle('on',FUEL.pump[id]);
      }
      if(g('fuel_total'))g('fuel_total').textContent=Math.round(FUEL.total());
      const xf=host.querySelector('[data-xfeed]'); if(xf)xf.classList.toggle('on',FUEL.xfeed);
    },
  });
}
