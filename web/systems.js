"use strict";
//==================================================================
// SYSTEMS — 系统总控面板  ·  独立模块("一切皆可开关" 终极落地)
//   遍历 SYS 四类(features/failures/env/panels)自动生成所有开关 UI。
//   toggle→SYS.toggle(已 localStorage 持久化)+ 即时应用到运行态。
//   PANELS 第 7 面板。依赖 SYS/PANELS/cfg/FAILURES/CONFIG 运行期全局。
//==================================================================
const SYSCTL_CATS=[['features','功能'],['env','环境'],['failures','故障注入'],['panels','面板可见']];

// 开关改动即时应用到运行态(部分 SYS 在 init 读入 cfg,需推送;部分逐帧读则自动)
function applySysChange(cat,id){
  if(typeof SYS==='undefined')return;
  const on=SYS.get(cat,id);
  if(cat==='failures'&&typeof FAILURES!=='undefined'){ on?FAILURES.trigger(id):FAILURES.clear(id); }
  if(cat==='panels'&&typeof PANELS!=='undefined'){ PANELS.buildBar(); }            // 面板可见性即时刷新 tab 条
  if(cat==='features'){
    if(id==='turbulence'&&typeof cfg!=='undefined'){ cfg.turb=on; if(typeof applyConfig==='function')applyConfig(); }
    if(id==='sound'&&typeof cfg!=='undefined'){ cfg.sound=on; if(typeof Sound!=='undefined'&&Sound.setMaster)Sound.setMaster(); if(typeof setSoundIcon==='function')setSoundIcon(); }
    if(id==='freeFlight'&&typeof CONFIG!=='undefined'){ CONFIG.freeFlight=on; }
    if(id==='cleanHud'&&typeof window!=='undefined'&&typeof window.setHudClean==='function')window.setHudClean(on);
    // fbw/emmaAssist/fpsHud 逐帧读 SYS,自动生效
  }
  if(cat==='env'){ if(id==='icing'&&typeof WEATHER!=='undefined'&&!on)WEATHER.deIce&&0; }  // env 逐帧读,自动生效
}

if(typeof PANELS!=='undefined'){
  PANELS.register('systems',{
    label:'系统总控',
    build(){
      let h='<div class="syspanel"><div class="sp-title">系统总控 · 一切皆可开关</div>';
      for(const [cat,nm] of SYSCTL_CATS){
        const items=(typeof SYS!=='undefined')?SYS.list(cat):[];
        h+='<div class="sysctl-grp"><div class="sysctl-hd">'+nm+' · '+items.length+' 项</div>';
        for(const it of items){
          h+='<div class="sysctl-row" data-cat="'+cat+'" data-id="'+it.id+'">'
            +'<div class="sysctl-txt"><b>'+it.label+'</b><span>'+(it.desc||'')+'</span></div>'
            +'<div class="sw'+(it.on?' on':'')+'"></div></div>';
        }
        h+='</div>';
      }
      h+='<div class="sp-hint">所有功能 / 环境 / 故障 / 面板开关集中此处,改动即时生效并自动持久化(localStorage)。</div></div>';
      return h;
    },
    wire(host){
      host.querySelectorAll('.sysctl-row').forEach(r=>r.addEventListener('click',()=>{
        const cat=r.dataset.cat,id=r.dataset.id;
        if(typeof SYS!=='undefined'){ SYS.toggle(cat,id); applySysChange(cat,id); this.sync(host); }
      }));
    },
    sync(host){
      if(!host)return;
      host.querySelectorAll('.sysctl-row').forEach(r=>{
        const on=(typeof SYS!=='undefined')&&SYS.get(r.dataset.cat,r.dataset.id);
        const sw=r.querySelector('.sw'); if(sw)sw.classList.toggle('on',on);
      });
    },
  });
}
