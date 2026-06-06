"use strict";
//==================================================================
// SD — 系统显示(System Display)只读 synoptic 多页(组18 Tick2)
//   区别于 HYD/ELEC/FUEL 控制面板:SD 纯只读示意图(管路/汇流条/流向/通断),
//   无控制按钮。6 页:HYD/ELEC/FUEL/BLEED/ENG/STATUS,页按钮循环,逐帧 sync
//   刷新压力/通断/流向。+ 推力模式 CLB/MCT/TOGA(S.throttle/phase 派生)。
//   高密度小字,手机零横滚。依赖运行期全局:S/HYD/ELEC/FUEL/ENGINES/FAILURES。
//==================================================================
const SD={
  label:'SD系统显示',
  page:'HYD', PAGES:['HYD','ELEC','FUEL','BLEED','ENG','STATUS'],

  _thrust(){
    if(typeof S==='undefined')return 'IDLE';
    if(S.phase==='goaround'||(S.onGround&&S.throttle>0.82))return 'TOGA';
    if(S.throttle>0.62)return 'CLB';
    if(S.throttle>0.18)return 'MCT';
    return 'IDLE';
  },
  _bar(frac,cls){ return '<div class="sd-bar"><i class="'+(cls||'')+'" style="height:'+Math.round(Math.max(0,Math.min(1,frac))*100)+'%"></i></div>'; },
  _node(lbl,on,val){ return '<div class="sd-node '+(on?'on':'off')+'"><span>'+lbl+'</span>'+(val!=null?'<b>'+val+'</b>':'')+'</div>'; },

  _HYD(){
    if(typeof HYD==='undefined')return '<div class="sd-empty">液压系统未就绪</div>';
    const tag={A:'ENG1 PUMP',B:'ENG2 PUMP',C:'ELEC PUMP'};
    let h='<div class="sd-grid3">';
    for(const k of ['A','B','C']){ const s=HYD.sys[k], psi=Math.round(s.press*3000), ok=s.press>0.5&&!s.failed;
      h+='<div class="sd-col"><div class="sd-h">HYD '+k+'</div>'
        +this._bar(s.press,ok?'g':'r')
        +'<div class="sd-val '+(ok?'':'lo')+'">'+psi+'<small>PSI</small></div>'
        +'<div class="sd-tag">'+tag[k]+'</div>'
        +'<div class="sd-st '+(ok?'ok':'wr')+'">'+(ok?'NORM':'LO PR')+'</div></div>';
    }
    return h+'</div><div class="sd-foot">A=主操纵 · B=扰流板/起落架 · C=刹车/备份</div>';
  },
  _ELEC(){
    if(typeof ELEC==='undefined')return '<div class="sd-empty">电气系统未就绪</div>';
    const g1=ELEC.genPower(ELEC.gen1)>0.5&&ELEC.gen1.on, g2=ELEC.genPower(ELEC.gen2)>0.5&&ELEC.gen2.on;
    const ac=ELEC.busAC>0.5&&!ELEC.failed, dc=ELEC.busDC>0.5&&!ELEC.failed, bat=ELEC.bat.on;
    let h='<div class="sd-elec">'
      +'<div class="sd-row">'+this._node('GEN 1',g1)+this._node('GEN 2',g2)+'</div>'
      +'<div class="sd-line '+(ac?'live':'dead')+'"></div>'
      +'<div class="sd-busrow"><div class="sd-bus '+(ac?'live':'dead')+'">AC BUS</div></div>'
      +'<div class="sd-line '+(dc?'live':'dead')+'"></div>'
      +'<div class="sd-busrow"><div class="sd-bus '+(dc?'live':'dead')+'">DC BUS</div>'
        +this._node('TRU',ac)+this._node('BAT '+Math.round(ELEC.bat.charge*100)+'%',bat)+'</div>'
      +'</div><div class="sd-foot">绿=带电 · 暗=失电。发动机失效→对应 GEN 失电,电池备份 PFD</div>';
    return h;
  },
  _FUEL(){
    if(typeof FUEL==='undefined')return '<div class="sd-empty">燃油系统未就绪</div>';
    const T=FUEL.tanks, P=FUEL.pump, lbl={left:'L 主箱',center:'C 中央',right:'R 主箱'};
    let h='<div class="sd-grid3">';
    for(const k of ['left','center','right']){ const t=T[k], frac=t.qty/t.cap, on=P[k];
      h+='<div class="sd-col"><div class="sd-h">'+lbl[k]+'</div>'+this._bar(frac,frac<0.12?'r':'g')
        +'<div class="sd-val">'+Math.round(t.qty)+'<small>KG</small></div>'
        +this._node('PUMP',on)+(t.leak>0?'<div class="sd-st wr">LEAK '+t.leak+'</div>':'')+'</div>';
    }
    h+='</div><div class="sd-xf '+(FUEL.xfeed?'open':'shut')+'">交输活门 XFEED · '+(FUEL.xfeed?'OPEN':'SHUT')+'</div>'
      +'<div class="sd-foot">总油量 '+Math.round(FUEL.total())+' KG · 流向 '+( (typeof ENGINES!=='undefined')?ENGINES.count:2 )+' 发</div>';
    return h;
  },
  _BLEED(){
    const e0=(typeof ENGINES!=='undefined'&&ENGINES.list[0])?ENGINES.list[0]:null;
    const e1=(typeof ENGINES!=='undefined'&&ENGINES.list[1])?ENGINES.list[1]:null;
    const b1=e0&&(e0.state==='run'||e0.state==='idle'), b2=e1&&(e1.state==='run'||e1.state==='idle');
    let h='<div class="sd-grid3">'
      +'<div class="sd-col"><div class="sd-h">ENG1 引气</div>'+this._node('BLEED',b1)+'<div class="sd-st '+(b1?'ok':'wr')+'">'+(b1?'AVAIL':'OFF')+'</div></div>'
      +'<div class="sd-col"><div class="sd-h">APU 引气</div>'+this._node('APU',false)+'<div class="sd-st wr">OFF</div></div>'
      +'<div class="sd-col"><div class="sd-h">ENG2 引气</div>'+this._node('BLEED',b2)+'<div class="sd-st '+(b2?'ok':'wr')+'">'+(b2?'AVAIL':'OFF')+'</div></div>'
      +'</div><div class="sd-busrow"><div class="sd-bus '+((b1||b2)?'live':'dead')+'">PACK / 增压</div></div>'
      +'<div class="sd-foot">引气供增压与防冰。发动机运转→引气可用;地面可用 APU 引气</div>';
    return h;
  },
  _ENG(){
    if(typeof ENGINES==='undefined')return '<div class="sd-empty">发动机未就绪</div>';
    let h='<table class="sd-tbl"><tr><th>ENG</th><th>N2</th><th>OIL P</th><th>OIL T</th><th>VIB</th><th>FF</th></tr>';
    for(const e of ENGINES.list){
      h+='<tr><td>'+e.id+'</td><td>'+Math.round(e.n2*100)+'</td><td>'+Math.round(e.n2*78+8)+'</td>'
        +'<td>'+Math.round(60+e.egt*0.11)+'</td><td>'+(e.fire?4.8:e.n1*0.7).toFixed(1)+'</td><td>'+e.ff.toFixed(1)+'</td></tr>';
    }
    return h+'</table><div class="sd-foot">二次参数:N2% / 滑油压 PSI / 滑油温 ℃ / 振动 / 燃流 t/h</div>';
  },
  _STATUS(){
    const inop=[];
    if(typeof FAILURES!=='undefined')for(const f of FAILURES.activeList())inop.push(f.msg);
    if(typeof HYD!=='undefined')for(const k of ['A','B','C'])if(HYD.sys[k].press<0.5)inop.push('HYD '+k);
    if(typeof ELEC!=='undefined'){ if(ELEC.genPower(ELEC.gen1)<0.5)inop.push('GEN 1'); if(ELEC.genPower(ELEC.gen2)<0.5)inop.push('GEN 2'); if(ELEC.failed)inop.push('ELEC BUS'); }
    if(typeof ENGINES!=='undefined')for(const e of ENGINES.list){ if(e.state==='fail')inop.push('ENG '+e.id); if(e.fire)inop.push('ENG '+e.id+' FIRE'); }
    const h=inop.length?('<div class="sd-inop">'+inop.map(x=>'<div class="sd-inopx">'+x+'</div>').join('')+'</div>')
      :'<div class="sd-allok">ALL SYSTEMS NORMAL</div>';
    return h+'<div class="sd-foot">INOP / 失效设备一览(液压/电气/发动机/故障)</div>';
  },

  render(host){ const scr=host?host.querySelector('#sdScreen'):null; if(scr)scr.innerHTML=this['_'+this.page]();
    const tm=host?host.querySelector('#sdThr'):null; if(tm){ const m=this._thrust(); tm.textContent=m; tm.className='sd-thr m-'+m; }
    if(host)host.querySelectorAll('[data-sdp]').forEach(b=>b.classList.toggle('on',b.dataset.sdp===this.page));
  },
  build(){
    let h='<div class="syspanel"><div class="sp-title">SD 系统显示 · <span class="sd-thr m-IDLE" id="sdThr">IDLE</span></div>'
      +'<div class="sd-tabs">'+this.PAGES.map(p=>'<button class="sd-tab'+(p===this.page?' on':'')+'" data-sdp="'+p+'">'+p+'</button>').join('')+'</div>'
      +'<div class="sd-screen" id="sdScreen"></div>'
      +'<div class="sp-hint">只读系统综合显示(synoptic)。绿=正常/带电,红/暗=失压/失电。逐帧实时刷新,反映液压/电气/燃油/引气真实态。控制请用各系统面板。</div></div>';
    return h;
  },
  wire(host){
    const self=this;
    host.querySelectorAll('[data-sdp]').forEach(b=>b.addEventListener('click',()=>{ self.page=b.dataset.sdp; self.render(host); }));
    this.render(host);
  },
  sync(host){ this.render(host); },   // 逐帧实时刷新
};

if(typeof PANELS!=='undefined')PANELS.register('sd',SD);
if(typeof window!=='undefined')window.SD=SD;
