"use strict";
//==================================================================
// MCDU — 多用途控制显示组件(A320 风格飞控电脑)· 旗舰面板
//   屏幕四周实体键:左 1L-6L + 右 1R-6R 共 12 行选键(LSK);
//   下方功能键(INIT/F-PLN/PERF/PROG/RAD NAV…切页)+ QWERTY 字母键
//   + 数字键 + 划写区(scratchpad)。多页 CDU,翻页真切页。
//   本 tick(组15 Tick3):布局 + 交互闭环(字母→scratchpad 回显 / 翻页真切页
//   / LSK 把 scratchpad 写入对应行);字段语义闭环(写 WIND/WPTS)留 Tick4。
//   依赖运行期全局:PANELS / S / FUEL / AC / WPTS / MS_TO_KT / M_TO_FT / MS_TO_FPM。
//==================================================================
const MCDU={
  label:'MCDU',
  page:'FPLN', scratch:'', msg:'', entries:{},
  // FMGC 状态:MCDU 输入写此,页面 render 读此显已输入值(青色 ent);部分联动真仿真。
  fmgc:{ costIndex:null, crzFL:350, vapp:null, wind:null },

  // —— 实时仿真读数(防御式:模块未就绪给占位) ——
  _kias(){ return (typeof S!=='undefined'&&typeof MS_TO_KT!=='undefined')?Math.round(S.V*MS_TO_KT):0; },
  _altft(){ return (typeof S!=='undefined'&&typeof M_TO_FT!=='undefined')?Math.round(S.alt*M_TO_FT):0; },
  _vsfpm(){ return (typeof S!=='undefined'&&typeof MS_TO_FPM!=='undefined')?Math.round(S.V*Math.sin(S.gamma)*MS_TO_FPM):0; },
  _fuel(){ return (typeof FUEL!=='undefined')?Math.round(FUEL.total()):0; },
  _tank(id){ return (typeof FUEL!=='undefined'&&FUEL.tanks[id])?Math.round(FUEL.tanks[id].qty):0; },
  _distRW(){ return (typeof S!=='undefined')?Math.max(0,(-S.z)/1852).toFixed(1):'--'; },
  _hdg(){ return (typeof S!=='undefined')?Math.round((270+S.hdg+360)%360):270; },

  // —— LSK 行写入 ——
  ent(lsk){ const e=this.entries[this.page]; return e?e[lsk]:undefined; },
  setPage(p){ if(this.pages[p]){ this.page=p; this.msg=''; } },
  key(k){
    if(k==='SP')this.scratch+=' ';
    else if(k==='OVFY')this.scratch+='Δ';
    else if(k==='CLR'){ if(this.scratch.length)this.scratch=this.scratch.slice(0,-1); else this.msg=''; }
    else if(k==='+/-')this.scratch+=(this.scratch.endsWith('-')?'':'-');
    else this.scratch+=k;
    if(this.scratch.length>22)this.scratch=this.scratch.slice(0,22);
    this.msg='';
  },
  // 功能字段已提交值的显示(青色 ent);无则返 null(render 用页面默认占位)
  fieldDisp(id){ const f=MCDU_FIELDS[this.page]; if(f&&f[id]&&f[id].disp)return f[id].disp(); return null; },
  lsk(id){
    const ff=MCDU_FIELDS[this.page], f=ff&&ff[id];
    if(f){                                              // —— 功能字段:解析 + 格式校验 + 写仿真 ——
      if(!this.scratch){ if(f.clear){f.clear();this.msg='';} else this.msg='NOT ALLOWED'; return; }
      const res=f.commit(this.scratch);
      if(res&&res.ok){ this.scratch=''; this.msg=''; }
      else this.msg=(res&&res.err)||'FORMAT ERROR';     // 拒收,保留 scratchpad
      return;
    }
    if(this.scratch){ (this.entries[this.page]=this.entries[this.page]||{})[id]=this.scratch; this.scratch=''; }
    else if(this.ent(id)!=null){ this.scratch=this.ent(id); delete this.entries[this.page][id]; }
    else this.msg='NOT ALLOWED';
  },

  // —— 屏幕重绘(当前页 6 行 + scratchpad;实时页逐帧由 sync 调用) ——
  renderScreen(host){
    const scr=host?host.querySelector('#cduScreen'):document.getElementById('cduScreen');
    if(!scr)return;
    const pg=this.pages[this.page], d=(pg?pg.call(this):{title:this.page,rows:[]});
    let h='<div class="cdu-title">'+(d.title||this.page)+'</div>';
    for(let i=0;i<6;i++){
      const r=d.rows[i]||{};
      h+='<div class="cdu-line"><div class="cdu-lbl l">'+(r.ll||'')+'</div><div class="cdu-lbl r">'+(r.rl||'')+'</div></div>';
      const lf=this.fieldDisp((i+1)+'L'), rf=this.fieldDisp((i+1)+'R');
      const le=(lf!=null?lf:this.ent((i+1)+'L')), re=(rf!=null?rf:this.ent((i+1)+'R'));
      const lv=(le!=null?le:(r.lv||'')), rv=(re!=null?re:(r.rv||''));
      h+='<div class="cdu-line"><div class="cdu-val l '+(le!=null?'ent':(r.lc||''))+'">'+lv+'</div>'
        +'<div class="cdu-val r '+(re!=null?'ent':(r.rc||''))+'">'+rv+'</div></div>';
    }
    h+='<div class="cdu-scratch'+(this.msg?' msg':'')+'">'
      +(this.msg?this.msg:(this.scratch.replace(/</g,'&lt;')+'<span class="cur">▮</span>'))+'</div>';
    scr.innerHTML=h;
    if(host){
      host.querySelectorAll('.fnk').forEach(f=>f.classList.toggle('on',f.dataset.page===this.page));
      host.querySelectorAll('.lsk').forEach(l=>l.classList.toggle('has',this.fieldDisp(l.dataset.lsk)!=null||this.ent(l.dataset.lsk)!=null));
    }
  },

  // —— 面板装配 ——
  build(){
    let h='<div class="mcdu"><div class="mcdu-unit">';
    h+='<div class="lsk-col left">';
    for(let i=1;i<=6;i++)h+='<div class="lsk" data-lsk="'+i+'L" title="'+i+'L"></div>';
    h+='</div><div class="cdu-screen" id="cduScreen"></div><div class="lsk-col right">';
    for(let i=1;i<=6;i++)h+='<div class="lsk" data-lsk="'+i+'R" title="'+i+'R"></div>';
    h+='</div></div>';
    h+='<div class="mcdu-keys"><div class="fn-grid">';
    for(const fk of MCDU_FN)h+='<div class="fnk" data-page="'+fk[1]+'">'+fk[0]+'</div>';
    h+='</div><div class="kbd-wrap"><div class="alpha-grid">';
    for(const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ')h+='<div class="mk" data-key="'+c+'">'+c+'</div>';
    h+='<div class="mk fnsp" data-key="/">/</div><div class="mk fnsp" data-key="SP">SP</div>'
      +'<div class="mk fnsp" data-key="OVFY">OVFY</div><div class="mk clr" data-key="CLR">CLR</div>';
    h+='</div><div class="num-grid">';
    for(const n of ['1','2','3','4','5','6','7','8','9','.','0','+/-'])h+='<div class="mk num" data-key="'+n+'">'+n+'</div>';
    h+='</div></div>';
    h+='<div class="sp-hint">A320 风格 CDU:字母 / 数字键 → 划写区(scratchpad)回显;功能键(INIT / F-PLN / PERF…)切换页面真切页;'
      +'行选键(LSK 1L-6L / 1R-6R)把划写区写入对应行(再点取回)。字段闭环逻辑(写 WIND / 航路)见后续 tick。</div>';
    h+='</div></div>';
    return h;
  },
  wire(host){
    const self=this;
    host.querySelectorAll('[data-key]').forEach(b=>b.addEventListener('click',()=>{ self.key(b.dataset.key); self.renderScreen(host); }));
    host.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>{ self.setPage(b.dataset.page); self.renderScreen(host); }));
    host.querySelectorAll('[data-lsk]').forEach(b=>b.addEventListener('click',()=>{ self.lsk(b.dataset.lsk); self.renderScreen(host); }));
    this.renderScreen(host);
  },
  sync(host){ this.renderScreen(host); },   // 逐帧刷新(PROG / FUEL / F-PLN 实时读数)
};

// —— 功能键 → 页面映射(12 键,4 列 3 行) ——
const MCDU_FN=[
  ['INIT','INIT'],   ['F-PLN','FPLN'],     ['DIR','DIR'],      ['PROG','PROG'],
  ['PERF','PERF'],   ['DATA','DATA'],      ['RAD NAV','RADNAV'],['FUEL PRED','FUEL'],
  ['SEC F-PLN','SEC'],['ATC COMM','ATC'],  ['MCDU MENU','MENU'],['AIRPORT','AIRPORT'],
];

// —— 页面注册表:每页 render → {title, rows[6]};rows 每项 {ll,lv,rl,rv,lc,rc} ——
MCDU.pages={
  MENU(){ return {title:'MCDU MENU', rows:[
    {lv:'<FMGC',rc:''}, {lv:'<ATSU'}, {lv:'<AIDS'}, {lv:'<CFDS'},
    {ll:'SELECT DESIRED SYSTEM'}, {rv:'RETURN>'} ]}; },
  INIT(){ return {title:'INIT', rows:[
    {ll:'CO RTE', lv:'________', rl:'FROM/TO', rv:'ZSPD/ZSSS'},
    {ll:'COST INDEX', lv:'___'},                                  // 2L 功能:成本指数
    {ll:'CRZ FL/TEMP', lv:'FL350/-54°', rl:'TROPO', rv:'36090'},  // 3L 功能:巡航高度层
    {ll:'MAG WIND °/KT', lv:'___°/__', rl:'GND TEMP', rv:'+15°'}, // 4L 功能:磁航向风(写仿真)
    {ll:'FLT NBR', lv:'FA0727'},
    {ll:'IRS', lv:'ALIGNED', rl:'', rv:'ALIGN IRS>'} ]}; },
  FPLN(){ const W=(typeof WPTS!=='undefined')?WPTS:[], rows=[];
    const PROF={IAF:'210/3000', FAF:'160/1500', RW27:'140/13'};   // 各航路点目标 SPD/ALT 剖面
    for(let i=0;i<W.length&&i<5;i++){ const w=W[i], d=(typeof S!=='undefined')?((w.z-S.z)/1852):0;
      rows.push({ ll:(i===0?'':'')+ (d>0?d.toFixed(1)+'NM':'PASSED'), rl:'SPD/ALT',
                  lv:w.id, lc:'blu', rv:(PROF[w.id]||'---/----') }); }
    rows.push({ll:'', lv:'------END------'});
    return {title:'F-PLN  '+this._altft()+'FT', rows}; },
  PERF(){ return {title:'PERF APPR', rows:[
    {ll:'QNH', lv:'1013', rl:'TEMP', rv:'+15°'},
    {ll:'VAPP', lv:'140', rl:'VLS', rv:'132'},                    // 2L 功能:进近速度 VAPP
    {ll:'FLAPS/THS', lv:'FULL/UP'},
    {ll:'MDA', lv:'____', rl:'DH', rv:'200'},
    {ll:'LDG CONF', lv:'FULL'},
    {lv:'<GO AROUND', rv:'NEXT PHASE>'} ]}; },
  PROG(){ return {title:'PROG', rows:[
    {ll:'CRZ', lv:'FL350', rl:'OPT', rv:'FL370'},
    {ll:'ALT', lv:this._altft()+'FT', rl:'V/S', rv:this._vsfpm()+''},
    {ll:'SPD', lv:this._kias()+'KT', rl:'HDG', rv:this._hdg()+'°'},
    {ll:'TO RW27', lv:this._distRW()+'NM', lc:'blu'},
    {ll:'BRG/DIST', lv:'270°/'+this._distRW()},
    {ll:'REQUIRED', lv:'HIGH', rl:'ESTIMATED', rv:'0.05NM'} ]}; },
  RADNAV(){ return {title:'RAD NAV', rows:[
    {ll:'VOR1/FREQ', lv:'SHA/113.90', rl:'FREQ/VOR2', rv:'112.10/PD'},
    {ll:'CRS', lv:'270', rl:'CRS', rv:'---'},
    {ll:'ILS/FREQ', lv:'IRW27/110.30'},
    {ll:'CRS', lv:'270', rl:'SLOPE', rv:'-3.0°'},
    {ll:'ADF1/FREQ', lv:'---/----', rl:'FREQ/ADF2', rv:'----/---'},
    {} ]}; },
  FUEL(){ return {title:'FUEL PRED', rows:[
    {ll:'AT', lv:'RW27', rl:'UTC/EFOB', rv:this._fuel()+'KG'},
    {},
    {ll:'GW', lv:(typeof AC!=='undefined'?Math.round(AC.m)+'KG':'--'), rl:'CG', rv:'27.0%'},
    {ll:'L TANK', lv:this._tank('left')+'KG', rl:'R TANK', rv:this._tank('right')+'KG'},
    {ll:'CTR TANK', lv:this._tank('center')+'KG', rl:'TOTAL', rv:this._fuel()+'KG'},
    {ll:'MIN FUEL TEMP', lv:'-44°'} ]}; },
  DATA(){ return {title:'A/C STATUS', rows:[
    {ll:'ENG', lv:'CFM56-5B'},
    {ll:'ACTIVE DATA BASE', lv:'01JUN-30JUN'},
    {ll:'SECOND DATA BASE', lv:'02MAY-31MAY'},
    {},
    {ll:'CHG CODE', lv:'[ ]'},
    {ll:'IDLE/PERF', lv:'+0.0/+0.0', rl:'STATUS/XLOAD', rv:'>'} ]}; },
  DIR(){ const W=(typeof WPTS!=='undefined')?WPTS:[], rows=[{lv:'DIR TO'}];
    for(let i=0;i<W.length&&i<4;i++)rows.push({ll:i===0?'WAYPOINT':'', lv:'→'+W[i].id, lc:'blu'});
    while(rows.length<6)rows.push({});
    return {title:'DIR TO', rows}; },
  SEC(){ return {title:'SEC INDEX', rows:[
    {lv:'<COPY ACTIVE'}, {lv:'<SEC F-PLN'}, {lv:'<INIT'}, {lv:'<PERF'}, {}, {rv:'RETURN>'} ]}; },
  ATC(){ return {title:'ATC MENU', rows:[
    {lv:'<LAT REQ'}, {lv:'<VERT REQ'}, {lv:'<WHEN CAN WE'}, {lv:'<OTHER REQ'}, {}, {lv:'<MSG LOG', rv:'CONNECT>'} ]}; },
  AIRPORT(){ return {title:'AIRPORT', rows:[
    {ll:'DEST', lv:'ZSPD RW27', rl:'DIST', rv:this._distRW()+'NM'},
    {ll:'ELEV', lv:'13FT', rl:'LEN', rv:'3400M'},
    {ll:'ILS', lv:'110.30', rl:'CRS', rv:'270°'},
    {ll:'PAPI', lv:'3.0°'},
    {},
    {ll:'ALTN', lv:'ZSSS'} ]}; },
};

//==================================================================
// 功能字段注册表:页面+LSK → {commit(raw)→{ok|err}, disp()→已提交显示, clear()}
//   解析 + 格式校验(非法拒收 FORMAT ERROR)+ 写 FMGC / 真仿真。闭环非纯显示。
//==================================================================
const F=MCDU.fmgc;
const MCDU_FIELDS={
  INIT:{
    // 2L 成本指数:0-999 整数
    '2L':{ commit(raw){ if(!/^\d{1,3}$/.test(raw))return{ok:false}; F.costIndex=+raw; return{ok:true}; },
           disp(){ return F.costIndex!=null?String(F.costIndex):null; },
           clear(){ F.costIndex=null; } },
    // 3L 巡航高度层:"FL350" 或 "350"(100-430)
    '3L':{ commit(raw){ const m=raw.match(/^(?:FL)?(\d{2,3})$/); if(!m)return{ok:false,err:'FORMAT ERROR'};
             const fl=+m[1]; if(fl<10||fl>430)return{ok:false,err:'ENTRY OUT OF RANGE'}; F.crzFL=fl; return{ok:true}; },
           disp(){ return 'FL'+F.crzFL+'/-54°'; }, clear(){ F.crzFL=350; } },
    // 4L 磁航向风 "270/12":写 CONFIG.windDir/windSpeed + applyWind() 真改 WIND 分量
    '4L':{ commit(raw){ const m=raw.match(/^(\d{1,3})\/(\d{1,3})$/); if(!m)return{ok:false,err:'FORMAT ERROR'};
             const dir=+m[1], spd=+m[2]; if(dir>360||spd>99)return{ok:false,err:'ENTRY OUT OF RANGE'};
             F.wind={dir,spd};
             if(typeof CONFIG!=='undefined'){ CONFIG.windDir=dir; CONFIG.windSpeed=spd;
               if(typeof applyWind==='function')applyWind(); if(typeof saveConfig==='function')saveConfig(); }
             return{ok:true}; },
           disp(){ return F.wind?(String(F.wind.dir).padStart(3,'0')+'°/'+String(F.wind.spd).padStart(2,'0')):null; },
           clear(){ F.wind=null; } },
  },
  PERF:{
    // 2L 进近速度 VAPP:80-220 kt
    '2L':{ commit(raw){ if(!/^\d{2,3}$/.test(raw))return{ok:false,err:'FORMAT ERROR'};
             const v=+raw; if(v<80||v>220)return{ok:false,err:'ENTRY OUT OF RANGE'}; F.vapp=v; return{ok:true}; },
           disp(){ return F.vapp!=null?String(F.vapp):null; }, clear(){ F.vapp=null; } },
  },
};

if(typeof PANELS!=='undefined')PANELS.register('mcdu',MCDU);
if(typeof window!=='undefined')window.MCDU=MCDU;
