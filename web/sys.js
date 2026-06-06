"use strict";
//==================================================================
// SYS — 中央系统开关注册表  ·  "一切皆可开关" 之基石
//   四类:features(功能) / failures(故障) / env(环境) / panels(面板框架槽位)
//   每项 {on, label, desc}。register/get/set/toggle/list + localStorage 持久化。
//   后续每个功能/故障/面板都在此登记一项,FA组15 建总控面板统一开关。
//   本文件最先加载(置 config.js 之前),纯自含,不依赖其他模块。
//==================================================================
const SYS={
  features:{}, failures:{}, env:{}, panels:{},
  _key:'fa.sys', _cats:['features','failures','env','panels'],
  // 登记一项开关(已存在则不覆盖,保留持久化值)
  register(cat,id,def){
    if(!this[cat])this[cat]={};
    if(!(id in this[cat]))this[cat][id]={on:!!(def&&def.on),label:(def&&def.label)||id,desc:(def&&def.desc)||''};
    return this[cat][id];
  },
  get(cat,id){ return !!(this[cat]&&this[cat][id]&&this[cat][id].on); },
  set(cat,id,on){ if(this[cat]&&this[cat][id]){this[cat][id].on=!!on;this.save();} return this.get(cat,id); },
  toggle(cat,id){ if(this[cat]&&this[cat][id]){this[cat][id].on=!this[cat][id].on;this.save();} return this.get(cat,id); },
  list(cat){ return Object.keys(this[cat]||{}).map(id=>Object.assign({id},this[cat][id])); },
  // 仅持久化 on 值(label/desc 由代码登记,避免旧缓存固化文案)
  save(){ try{const o={};for(const c of this._cats){o[c]={};for(const id in this[c])o[c][id]=this[c][id].on;}localStorage.setItem(this._key,JSON.stringify(o));}catch(_){} },
  load(){ try{const o=JSON.parse(localStorage.getItem(this._key)||'null');if(o)for(const c of this._cats)if(o[c])for(const id in o[c])if(this[c]&&this[c][id])this[c][id].on=!!o[c][id];}catch(_){} },
};

// —— 默认登记:组10 已实现的功能(成为可开关项) ——
SYS.register('features','turbulence',{on:true, label:'颠簸 / 阵风', desc:'大气湍流扰动'});
SYS.register('features','freeFlight',{on:false,label:'自由飞模式', desc:'轻微失误不强制结束,反复练习'});
SYS.register('features','cleanHud',  {on:true, label:'精简飞行视野',desc:'飞行中自动隐藏信息角标'});
SYS.register('features','emmaAssist',{on:true, label:'EMMA AI 副驾',desc:'分轴接管 / 辅助驾驶'});
SYS.register('features','sound',     {on:true, label:'声音',       desc:'发动机 / 风噪 / 语音回报'});
SYS.register('features','fuelSystem',{on:true, label:'燃油系统',   desc:'三油箱耗油/泵/交输/饥饿熄火(关=无限油)'});
SYS.register('features','fpsHud',    {on:false,label:'FPS / 渲染统计',desc:'显示帧率+绘制对象数(调试)'});
SYS.register('features','fbw',       {on:true, label:'电传飞控 FBW',desc:'正常法则(松杆1g/坡度保持+包线保护);关=直接操纵'});
SYS.register('features','tutorial',  {on:false,label:'新手分步教学',desc:'逐步引导完整进近(对中线/下滑道/拉平/反推),满足条件自动进下一步'});

// —— 环境(随难度/天气) ——
SYS.register('env','windShear',{on:false,label:'风切变',     desc:'低空顶风骤变(硬核档自动开)'});
SYS.register('env','spatialD',  {on:true, label:'空间迷向',   desc:'无外参照(夜/IMC)前庭错觉,外景偏但仪表真'});
SYS.register('env','icing',     {on:false,label:'结冰',       desc:'积冰增重/升失速速度/降操纵效率(需除冰)'});
SYS.register('env','gusts',    {on:true, label:'阵风',       desc:'随机阵风'});
SYS.register('env','randomFailures',{on:false,label:'随机故障',desc:'按难度 MTBF 泊松随机注入故障(硬核档涌现)'});

// —— 故障槽位(FA组12 落地连锁逻辑,先登记可触发开关) ——
SYS.register('failures','engineFail',{on:false,label:'发动机失效',desc:'手动触发引擎停车(组12)'});
SYS.register('failures','engineFire',{on:false,label:'发动机起火',desc:'(组12)'});
SYS.register('failures','hydFail',   {on:false,label:'液压故障',  desc:'操纵沉重 / 扰流板失效(组12)'});
SYS.register('failures','elecFail',  {on:false,label:'电气故障',  desc:'仪表 / 灯光失效(组12)'});
SYS.register('failures','fuelLeak',  {on:false,label:'燃油泄漏',  desc:'(组12)'});
SYS.register('failures','tireBurst', {on:false,label:'爆胎',     desc:'接地爆胎(组12)'});
SYS.register('failures','windshear', {on:false,label:'风切变',   desc:'微下击暴流(weather 驱动)'});
SYS.register('failures','icing',     {on:false,label:'积冰',     desc:'结冰(weather 驱动)'});

// —— 面板框架注册表(FA组11 Tick4 起注册真实面板;此处先占位声明) ——
// 面板框架:每个驾驶舱面板在此登记一项,注册即可被面板选择器切换 → 支持数十种面板
SYS.register('panels','flight',{on:true,label:'飞行面板',      desc:'主飞行操纵 + PFD'});
SYS.register('panels','engine',{on:true,label:'引擎 / 系统面板',desc:'多发控制 / 点火 / 启动机'});
SYS.register('panels','fuel',  {on:true,label:'燃油面板',      desc:'三油箱 / 泵 / 交输活门'});
SYS.register('panels','failures',{on:true,label:'故障 / ECAM', desc:'故障注入 + ECAM 告警列表'});
SYS.register('panels','hyd',   {on:true,label:'液压面板',     desc:'三液压源 A/B/C 压力 / 泵'});
SYS.register('panels','elec',  {on:true,label:'电气面板',     desc:'电池 / 发电机 / 汇流条'});
SYS.register('panels','mcdu',  {on:true,label:'MCDU 飞控电脑',  desc:'屏幕四周 LSK + 键盘多页 CDU(旗舰件)'});
SYS.register('panels','systems',{on:true,label:'系统总控',     desc:'所有功能/故障/环境/面板开关集中一处'});
SYS.register('panels','replay', {on:true,label:'回放',         desc:'飞行轨迹复盘:下滑剖面+航迹+时间轴 scrub'});
SYS.register('panels','nd',     {on:true,label:'ND 导航',      desc:'导航显示:航向环+航路点+跑道+ILS航道+风矢量+量程圈'});
SYS.register('panels','afs',    {on:true,label:'AFS/FCU',      desc:'自动飞行控制板:HDG/ALT/SPD/V·S 选定 + NAV/APPR managed'});
SYS.register('panels','atc',    {on:true,label:'无线电',       desc:'ATC 空管语音通信:指令序列 + 消息日志 + 应答'});
SYS.register('panels','wxr',    {on:true,label:'气象雷达',     desc:'WXR 扇形扫描气象回波:绿/黄/红强度 + 量程 + GAIN/TILT'});
SYS.register('panels','lights', {on:true,label:'灯光',         desc:'夜航光环境:进近灯/边灯/RAIL/REIL/滑行道/着陆/频闪/信标/航行灯 + 时段'});
SYS.register('panels','sd',     {on:true,label:'SD系统',       desc:'系统显示 synoptic:HYD/ELEC/FUEL/BLEED/ENG/STATUS 只读示意 + 推力模式'});
SYS.register('panels','perf',   {on:true,label:'性能',         desc:'PERF 性能计算:V1/VR/V2/Vref/Vapp + 起降距离余量(按质量/跑道/风)'});
SYS.register('panels','ecl',    {on:true,label:'检查单',       desc:'电子检查单:进近/着陆/复飞+ENG FIRE/FAIL/HYD LO,自动感知+手动勾'});
SYS.register('panels','scn',    {on:true,label:'训练情景',     desc:'故障情景训练:起火/失效/液压/风切变剧本注入+处置评分 debrief'});
SYS.register('panels','hist',   {on:true,label:'履历',         desc:'着陆履历+成就:评分历史/统计(均分/最佳/奶油率)/6 类成就解锁'});
SYS.register('panels','ghost',  {on:true,label:'幽灵',         desc:'幽灵轨迹对比:叠加该机场历史最佳进近线供追逐'});
SYS.register('panels','wb',     {on:true,label:'载重',         desc:'载重平衡 W&B:装载分布→总重/CG%MAC/配平+CG 包线(联动性能/MCDU)'});
SYS.register('panels','proc',   {on:true,label:'程序',         desc:'SID/STAR 程序进近:多机场进场程序库,程序点并入 F-PLN + ND 显示'});
SYS.register('panels','chart',  {on:true,label:'航图',         desc:'进近图/航图:平面进近图 + 垂直剖面(静态参考,区别于 ND)'});
SYS.register('panels','precip', {on:true,label:'降水',         desc:'降水天气+污染跑道:雨/雪渲染+干/湿/雪 μ 摩擦(降刹车效能)'});

SYS.load();
if(typeof window!=='undefined')window.SYS=SYS;
