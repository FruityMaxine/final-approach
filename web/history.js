"use strict";
//==================================================================
// HISTORY — 着陆履历 + 成就系统(组19 Tick2)
//   每次着陆 showReport 末调 HISTORY.record(),存 localStorage(fa.hist 环形 50)。
//   面板:历史评分列表 + 统计(总数/均分/最佳/丝滑率)+ 成就网格(6 类)。
//   依赖运行期全局:AIRCRAFT/CONFIG/RWY。高密度小行,手机零横滚。
//==================================================================
const HISTORY={
  label:'履历',
  KEY:'fa.hist', MAX:50, records:[], _sig:null,

  load(){ try{ const v=JSON.parse(localStorage.getItem(this.KEY)||'[]'); if(Array.isArray(v))this.records=v; }catch(_){ this.records=[]; } },
  save(){ try{ localStorage.setItem(this.KEY,JSON.stringify(this.records)); }catch(_){} },
  record(r){
    const rec={ score:r.score|0, grade:r.grade||'—', fpm:r.fpm|0, tdz:r.tdz|0, xoff:+(r.xoff||0),
      aircraft:(typeof AIRCRAFT!=='undefined'&&typeof CONFIG!=='undefined'&&AIRCRAFT[CONFIG.aircraft])?AIRCRAFT[CONFIG.aircraft].name:'—',
      airport:(typeof RWY!=='undefined'&&RWY.aptName)?RWY.aptName:'—', t:Date.now() };
    this.records.push(rec); if(this.records.length>this.MAX)this.records.shift(); this.save(); this._sig=null;
  },

  stats(){
    const r=this.records, n=r.length; if(!n)return {n:0,avg:0,best:0,greaser:0};
    let sum=0,best=0,gr=0; for(const x of r){ sum+=x.score; if(x.score>best)best=x.score; if(x.fpm<150&&x.grade!=='F')gr++; }
    return { n, avg:Math.round(sum/n), best, greaser:Math.round(gr/n*100) };
  },
  achievements(){
    const r=this.records;
    const acs=new Set(r.map(x=>x.aircraft)), aps=new Set(r.map(x=>x.airport));
    const last3=r.slice(-3);
    return [
      {id:'first', name:'初次着陆',  ok:r.length>=1},
      {id:'agrade',name:'A 级着陆',  ok:r.some(x=>x.grade==='A')},
      {id:'greaser',name:'奶油落地 <150fpm', ok:r.some(x=>x.fpm<150&&x.grade!=='F')},
      {id:'allac', name:'飞遍 4 机型', ok:acs.size>=4&&!acs.has('—')},
      {id:'allap', name:'到访 4 机场', ok:aps.size>=4&&!aps.has('—')},
      {id:'streak',name:'连续 3 次 A', ok:last3.length===3&&last3.every(x=>x.grade==='A')},
    ];
  },

  build(){
    return '<div class="syspanel"><div class="sp-title">飞行履历 · 成就</div>'
      +'<div class="hi-stats" id="hiStats"></div>'
      +'<div class="hi-sec">成就</div><div class="hi-ach" id="hiAch"></div>'
      +'<div class="hi-sec">着陆记录</div><div class="hi-list" id="hiList"></div>'
      +'<div class="sp-hint">每次着陆自动记录评分(本地保存,最近 50 次)。统计含均分/最佳/奶油率;成就达成点亮。</div></div>';
  },
  wire(host){ this._sig=null; this.render(host); },
  sync(host){ this.render(host); },
  render(host){
    if(!host)return;
    const sig=this.records.length+'|'+this.records.map(x=>x.score).join(',');
    if(sig===this._sig)return; this._sig=sig;
    const s=this.stats();
    const gst=host.querySelector('#hiStats');
    if(gst)gst.innerHTML=['总着陆 '+s.n,'均分 '+s.avg,'最佳 '+s.best,'奶油率 '+s.greaser+'%']
      .map(t=>{const p=t.split(' ');return '<div class="hi-stat"><span>'+p[0]+'</span><b>'+p.slice(1).join(' ')+'</b></div>';}).join('');
    const ga=host.querySelector('#hiAch');
    if(ga)ga.innerHTML=this.achievements().map(a=>'<div class="hi-badge '+(a.ok?'on':'off')+'">'+a.name+'</div>').join('');
    const gl=host.querySelector('#hiList');
    if(gl){ const r=this.records.slice().reverse();
      gl.innerHTML=r.length? r.slice(0,30).map(x=>{
        const tm=new Date(x.t), hh=String(tm.getHours()).padStart(2,'0')+':'+String(tm.getMinutes()).padStart(2,'0');
        return '<div class="hi-row"><span class="hi-g g-'+x.grade+'">'+x.grade+'</span>'
          +'<span class="hi-sc">'+x.score+'</span>'
          +'<span class="hi-meta">'+x.aircraft+' · '+x.airport+'</span>'
          +'<span class="hi-tm">'+hh+'</span></div>'; }).join('')
        : '<div class="hi-empty">尚无记录 · 完成一次着陆后显示</div>'; }
  },
};
HISTORY.load();

if(typeof PANELS!=='undefined')PANELS.register('hist',HISTORY);
if(typeof window!=='undefined')window.HISTORY=HISTORY;
