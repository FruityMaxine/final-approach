"use strict";
//==================================================================
// TUTORIAL — 新手分步交互教学(组15 收官件)
//   状态机:7 步覆盖完整进近(对中线→下滑道/速度→决断高度→拉平→接地→反推刹停)。
//   每步 check(S)→bool 逐帧轮询,满足即自动进下一步(非点按钮),进步时 showCallout 庆祝。
//   浮层显当前步 title+hint+进度条;可随时跳过。Linear 深色风格与全局一致。
//   接入:game.js loop 调 TUTORIAL.update(S,dt);startFlight 据 SYS.features.tutorial 启动。
//   依赖运行期全局:S / showCallout / getC / M_TO_FT / MS_TO_KT / DEG / GS_DEG。
//==================================================================
const TUTORIAL={
  active:false, step:0, el:null,
  steps:[
    {id:'start', title:'欢迎登机 · 开始进近',
      hint:'你坐在左座,飞机已在 3° 下滑道上对准 27 号跑道。跟随每一步提示,把它平稳降下来。',
      check(S){ return !!S.started; }},
    {id:'loc', title:'对准跑道中线',
      hint:'用方向舵脚蹬(键盘 Z / C)配合坡度把机头对正跑道,让横向偏离逐渐收小到中线附近。',
      check(S){ return (S.alt*M_TO_FT<760)&&Math.abs(S.x)<16; }},
    {id:'gs', title:'守住下滑道与速度',
      hint:'保持 PAPI 两白两红(对准 3° 下滑道),速度锁定 Vref 140kt —— 用左侧推力杆(Shift / Ctrl)微调。',
      check(S){ const gs=tutGsDev(S); return (S.alt*M_TO_FT<430)&&Math.abs(gs)<0.55&&Math.abs(S.V*MS_TO_KT-140)<15; }},
    {id:'dh', title:'通过决断高度',
      hint:'已进入最后约 200ft。保持稳定、目视跑道,准备在入口柔和拉平。',
      check(S){ return S.alt*M_TO_FT<215; }},
    {id:'flare', title:'入口柔和拉平',
      hint:'越过跑道入口轻柔带杆,把下降率收到 300fpm 以内,同时收回油门到慢车。',
      check(S){ return S.phase==='flare'||S.onGround; }},
    {id:'td', title:'主轮接地',
      hint:'主轮触地。保持方向,蹬正脚舵守住中线,别让飞机偏出道面。',
      check(S){ return !!S.onGround; }},
    {id:'stop', title:'反推 + 刹车停住',
      hint:'拉出反推、踩刹车(空格),把飞机在跑道上平稳停下来 —— 下降率越小、停得越稳,评分越高。',
      check(S){ return S.onGround&&S.reverse&&(S.V*MS_TO_KT<35); }},
  ],

  start(){ this.active=true; this.step=0; this.ensure(); this.render(); },
  stop(){ this.active=false; if(this.el)this.el.classList.remove('show'); },
  update(S,dt){
    if(!this.active||!S||!S.started)return;
    const st=this.steps[this.step];
    if(!st){ this.finish(); return; }
    let ok=false; try{ ok=st.check(S); }catch(_){ ok=false; }
    if(ok){
      this.step++;
      if(typeof showCallout==='function'&&typeof getC==='function')
        showCallout(this.step>=this.steps.length?'教学完成':'完成 · 步'+this.step+'/'+this.steps.length, getC('--grn'));
      if(this.step>=this.steps.length){ this.finish(); return; }
    }
    this.render();
  },
  finish(){ this.active=false; this.render(true); if(this.el)setTimeout(()=>{ if(!this.active&&this.el)this.el.classList.remove('show'); },2800); },

  ensure(){
    if(this.el)return;
    const host=document.getElementById('viewport')||document.body;
    const d=document.createElement('div'); d.id='tutOverlay';
    d.innerHTML='<div class="tut-top"><span class="tut-step" id="tutStep"></span><span class="tut-skip" id="tutSkip">跳过教学</span></div>'
      +'<div class="tut-title" id="tutTitle"></div><div class="tut-hint" id="tutHint"></div>'
      +'<div class="tut-bar"><i id="tutBar"></i></div>';
    host.appendChild(d); this.el=d;
    d.querySelector('#tutSkip').addEventListener('click',()=>this.stop());
  },
  render(done){
    this.ensure(); if(!this.el)return;
    if(!this.active&&!done){ this.el.classList.remove('show'); return; }
    const n=this.steps.length, cur=Math.min(this.step,n-1);
    const st=done?{title:'教学完成',hint:'你已独立走完整个进近流程。试试在帮助里关掉教学,自己飞一次完整着陆。'}:this.steps[cur];
    const g=id=>this.el.querySelector(id);
    g('#tutStep').textContent=done?('完成 '+n+' / '+n):('步骤 '+(this.step+1)+' / '+n);
    g('#tutTitle').textContent=st.title;
    g('#tutHint').textContent=st.hint;
    g('#tutBar').style.width=Math.round((done?n:this.step)/n*100)+'%';
    this.el.classList.add('show');
  },
};

// 下滑道偏差(同 game.js drawPFD 口径:atan2(alt,-z)*DEG - GS_DEG)
function tutGsDev(S){
  if(!S)return 0; const back=-S.z;
  return (back>0)?(Math.atan2(S.alt,back)*DEG-GS_DEG):0;
}

if(typeof window!=='undefined')window.TUTORIAL=TUTORIAL;
