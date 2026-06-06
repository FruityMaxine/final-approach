"use strict";
//==================================================================
// FPLN — 飞行计划保存 / 导入导出  ·  FA组21 Tick4
//   把当前 CONFIG(机场/机型/天气/风/跑道/盘旋/难度/起始)快照为存档槽,
//   或编码为带版本前缀的 base64 分享码,跨设备/分享他人一键重建。
//   多存档槽(localStorage 'fa.fpln') + 导出码(剪贴板/文本框) + 导入码(校验重建)。
//   版本前缀 'FA1' 防跨版本损坏:异前缀软降级+提示,非静默失败。
//   依赖运行期全局:CONFIG/DIFF/STARTS/AIRCRAFT/AIRPORTS/applyConfig/
//   syncConfigUI/updateAirportUI/updateWindUI/ENGINES/resetState/curAirport。
//==================================================================
const FPLN={
  label:'计划/FPLN',
  KEY:'fa.fpln',
  VER:'FA1',
  FIELDS:['diff','start','windDir','windSpeed','freeFlight','engines','weather','aircraft','airport','rwySel','circleApp'],
  slots:[],
  _sig:null, _msg:'', _msgKind:'',

  load(){ try{const o=JSON.parse(localStorage.getItem(this.KEY)||'null');if(Array.isArray(o))this.slots=o;}catch(_){} },
  save(){ try{localStorage.setItem(this.KEY,JSON.stringify(this.slots));}catch(_){} },

  // 当前 CONFIG 快照(仅取 FIELDS)
  snapshot(){ const c={}; for(const f of this.FIELDS)c[f]=CONFIG[f]; return c; },

  // —— 编码/解码(版本前缀 + base64) ——
  encode(cfg){ try{ return this.VER+'.'+btoa(unescape(encodeURIComponent(JSON.stringify(cfg)))); }catch(_){ return ''; } },
  decode(code){
    if(typeof code!=='string'||code.indexOf('.')<0){ return {ok:false,msg:'分享码格式无效'}; }
    const pre=code.slice(0,code.indexOf('.')), body=code.slice(code.indexOf('.')+1);
    if(pre.slice(0,2)!=='FA'){ return {ok:false,msg:'非 FINAL APPROACH 分享码'}; }
    let cfg=null;
    try{ cfg=JSON.parse(decodeURIComponent(escape(atob(body)))); }catch(_){ return {ok:false,msg:'分享码已损坏(解码失败)'}; }
    if(!cfg||typeof cfg!=='object'){ return {ok:false,msg:'分享码内容无效'}; }
    const cross=(pre!==this.VER);
    return {ok:true, cfg, cross, msg:cross?('跨版本('+pre+')载入,未知项已回退默认'):''};
  },

  // 校验并写回 CONFIG(逐字段守卫,同 loadConfig)+ 重建 + UI 同步
  applyCfg(c){
    if(!c)return false;
    if(DIFF[c.diff])CONFIG.diff=c.diff;
    if(STARTS[c.start])CONFIG.start=c.start;
    if(typeof c.windDir==='number')CONFIG.windDir=c.windDir;
    if(typeof c.windSpeed==='number')CONFIG.windSpeed=c.windSpeed;
    CONFIG.freeFlight=!!c.freeFlight;
    if(c.engines===2||c.engines===4)CONFIG.engines=c.engines;
    if(['clear','mist','imc','lowvis'].includes(c.weather))CONFIG.weather=c.weather;
    if(typeof AIRCRAFT!=='undefined'&&AIRCRAFT[c.aircraft])CONFIG.aircraft=c.aircraft;
    if(typeof AIRPORTS!=='undefined'&&AIRPORTS[c.airport])CONFIG.airport=c.airport;
    if(typeof c.rwySel==='number')CONFIG.rwySel=c.rwySel;
    CONFIG.circleApp=!!c.circleApp;
    if(typeof applyConfig==='function')applyConfig();
    if(typeof ENGINES!=='undefined'&&ENGINES.setCount)ENGINES.setCount(CONFIG.engines);
    if(typeof resetState==='function')resetState();
    if(typeof syncConfigUI==='function')syncConfigUI();
    if(typeof updateAirportUI==='function')updateAirportUI();
    if(typeof updateWindUI==='function')updateWindUI();
    if(typeof syncSysUI==='function')syncSysUI();
    return true;
  },

  serialize(){ return this.encode(this.snapshot()); },
  deserialize(code){ const r=this.decode(code); if(!r.ok){ this._setMsg(r.msg,'bad'); return false; }
    this.applyCfg(r.cfg); this._setMsg(r.cross?r.msg:'分享码已载入','ok'); return true; },

  // —— 存档槽 ——
  _bj(ts){ const d=new Date(ts+8*3600000); const p=n=>('0'+n).slice(-2);
    return p(d.getUTCMonth()+1)+'-'+p(d.getUTCDate())+' '+p(d.getUTCHours())+':'+p(d.getUTCMinutes()); },
  _summary(){
    const a=(typeof curAirport==='function')?curAirport():null;
    const apt=a?a.name:CONFIG.airport;
    const rw=(a&&a.runways&&a.runways[CONFIG.rwySel])?a.runways[CONFIG.rwySel].id:'';
    const ac=(typeof AIRCRAFT!=='undefined'&&AIRCRAFT[CONFIG.aircraft])?AIRCRAFT[CONFIG.aircraft].name:CONFIG.aircraft;
    const df=(DIFF[CONFIG.diff]||{}).name||CONFIG.diff;
    return apt+' '+rw+' · '+ac+' · '+df;
  },
  saveSlot(){
    const now=(typeof Date!=='undefined'&&Date.now)?Date.now():0;
    this.slots.unshift({name:this._summary(), ts:now, cfg:this.snapshot()});
    if(this.slots.length>12)this.slots.length=12;   // 上限 12 槽
    this.save(); this._setMsg('已保存当前计划','ok');
  },
  loadSlot(i){ const s=this.slots[i]; if(!s)return; this.applyCfg(s.cfg); this._setMsg('已读取「'+s.name+'」','ok'); },
  delSlot(i){ if(this.slots[i]){ this.slots.splice(i,1); this.save(); this._setMsg('已删除存档','ok'); } },

  _setMsg(m,k){ this._msg=m; this._msgKind=k||''; },

  // —— 面板(下方仪表区,高密度) ——
  build(){
    return '<div class="fp-pan">'
      +'<button class="fp-save" id="fpSave">保存当前配置为存档</button>'
      +'<div class="fp-slots" id="fpSlots"></div>'
      +'<div class="fp-io">'
        +'<div class="fp-iolab">导出分享码(长按选中复制)</div>'
        +'<textarea class="fp-code" id="fpCode" readonly rows="2"></textarea>'
        +'<button class="fp-cp" id="fpCopy">复制到剪贴板</button>'
      +'</div>'
      +'<div class="fp-io">'
        +'<div class="fp-iolab">导入分享码</div>'
        +'<input class="fp-in" id="fpIn" placeholder="粘贴 FA1.xxxx 分享码" />'
        +'<button class="fp-imp" id="fpImp">应用导入</button>'
      +'</div>'
      +'<div class="fp-msg" id="fpMsg"></div>'
      +'</div>';
  },
  _renderInto(host){
    const slots=this.slots;
    const sl=host.querySelector('#fpSlots');
    sl.innerHTML = slots.length ? slots.map((s,i)=>
      '<div class="fp-slot"><div class="fp-sinfo"><b>'+s.name+'</b><span class="fp-st">'+this._bj(s.ts)+'</span></div>'
      +'<div class="fp-sbtn"><button class="fp-load" data-fl="'+i+'">读取</button>'
      +'<button class="fp-del" data-fd="'+i+'">删</button></div></div>').join('')
      : '<div class="fp-empty">暂无存档,点上方保存当前配置</div>';
    const code=host.querySelector('#fpCode'); if(code&&document.activeElement!==code)code.value=this.serialize();
    const msg=host.querySelector('#fpMsg');
    msg.className='fp-msg'+(this._msgKind?(' '+this._msgKind):''); msg.textContent=this._msg||'';
  },
  wire(host){
    const self=this; this._sig=null;
    this._renderInto(host);
    if(host._fpWired)return;          // 监听只挂一次(panels.show 每开都调 wire)
    host._fpWired=true;
    host.addEventListener('click',e=>{
      const sv=e.target.closest('#fpSave'), ld=e.target.closest('[data-fl]'), dl=e.target.closest('[data-fd]'),
            cp=e.target.closest('#fpCopy'), im=e.target.closest('#fpImp');
      if(sv){ self.saveSlot(); }
      else if(ld){ self.loadSlot(+ld.dataset.fl); }
      else if(dl){ self.delSlot(+dl.dataset.fd); }
      else if(cp){ const t=host.querySelector('#fpCode'); try{ navigator.clipboard.writeText(t.value); self._setMsg('已复制分享码','ok'); }catch(_){ t.select(); self._setMsg('已选中,请手动复制','ok'); } }
      else if(im){ const v=host.querySelector('#fpIn').value.trim(); if(v)self.deserialize(v); else self._setMsg('请先粘贴分享码','bad'); }
      else return;
      self._sig=null; self._renderInto(host);
    });
  },
  sync(host){
    const sig=[this.slots.length, this._msg, (typeof CONFIG!=='undefined'?JSON.stringify(this.snapshot()):'')].join('|');
    if(sig===this._sig)return;
    this._sig=sig; this._renderInto(host);
  },
};

FPLN.load();
if(typeof PANELS!=='undefined')PANELS.register('fpln',FPLN);
if(typeof window!=='undefined')window.FPLN=FPLN;
