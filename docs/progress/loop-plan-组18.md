# Loop Plan · 组18 — SD 系统显示 + PERF 性能计算 + ECL 检查单 + 故障情景训练

> FA 飞行模拟器独立 betterloop。接组17(FCU/ATC/WXR/夜航 + UI 两轮修复收官,5b44802)。停止条件 D 永续仅用户令停;用户要"勤快点"。组18 补齐运行类拟真:系统综合显示、起降性能、电子检查单、故障情景训练。

## 组17 复盘(收官)
Tick2 FCU(v0.30)/布局重构(v0.30.1.1)/Tick3 ATC(v0.31)/Tick4 WXR(v0.32)/Tick5 夜航光环境(v0.33)/密度致密化(v0.34)。25 模块 14 面板。详见 loop-plan-组17-final.md。两轮用户 UI 反馈已修(布局架构 + 信息密度),铁律存记忆 feedback_fa_panel_layout(4 条)。

## 组18 主题:运行类拟真四件
betterloop-auditor(opus)审 **4/4 全 PASS**。挂接点全核实无重叠(SD synoptic 只读 vs 现有控制面板正交;PERF/ECL/情景全新无现状)。**每 tick 必含手机零横滚 + 高密度小控件(UI 铁律)**。

### Tick 2 — SD 系统显示(只读 synoptic 多页) (B, ~190行) → v0.35.0.0
- 新建 sd.js:PANELS"SD系统显示"(sys.js panels.sd)。只读管路/汇流条示意图(区别于现有控制面板):HYD 三源管路+泵+压力+蓄压器;ELEC 汇流条+发电机+电池+TR+通断线;FUEL 三油箱+交输+流向箭头;BLEED 引气+APU;ENG 二次(OIL/VIB/N2);STATUS INOP 列表。页按钮循环 synoptic,逐帧 sync 刷流向/通断。+推力模式 CLB/MCT/TOGA(throttle/phase 派生)。高密度小字,手机零横滚。
- 文件:sd.js(新)、sys.js、index.html、game.css、game.json。验收:开 SD→synoptic 真绘+页切换+读 HYD/ELEC/FUEL 实时态(Playwright 手机零横滚)。

### Tick 3 — 性能计算 PERF 页(V 速度+起降距离) (C, ~190行) → v0.36.0.0
- 新建 perf.js:PANELS"性能/PERF"(sys.js panels.perf)。按 AC 质量(dryMass+FUEL)+RWY 长/标高+WIND.head+襟翼+OAT 算 V1/VR/V2/Vref/Vapp(简化教学公式)+起飞 TODR/着陆 LDR+跑道余量(够/不够变色)。OAT/襟翼步进输入。结果写 AFS.tgt.spdSel/MCDU VAPP 闭环。高密度读数网格。
- 文件:perf.js(新)、sys.js、index.html、game.css、game.json、afs.js或mcdu.js(写回)。验收:改质量/跑道→V 速度+距离余量真变+写 AFS(Playwright)。auditor 提醒:公式标注"简化教学用"。

### Tick 4 — 电子检查单 ECL(正常+非正常,自动感知) (A+B, ~185行) → v0.37.0.0
- 新建 checklist.js:PANELS"检查单"(sys.js panels.ecl)。检查单库:正常(进近/着陆/复飞)+非正常(ENG FAIL/FIRE/HYD LO)。每项{text,sense?(S)→bool}:起落架由 S.gearDown 自动绿勾、襟翼由 S.flaps 感知,手动项点击勾选;按 S.phase/故障自动推荐当前单+完成度。高密度列表小行距,手机零横滚。
- 文件:checklist.js(新)、sys.js、index.html、game.css、game.json。验收:gear 放下→对应项自动绿勾+手动项点击勾+phase 切换荐单(Playwright)。

### Tick 5 — 故障情景训练 + 处置评分 (A+C, ~220行) → v0.38.0.0
- 新建 scenario.js:PANELS"训练情景"(sys.js panels.scn)。预设剧本(单发失效@短五边/液压全失/发动机起火/风切变),按 alt/phase 注入 FAILURES;监测玩家处置(响应时间/正确动作如失火→灭火手柄/复飞决断);结束给评分+debrief(时间线+对错)。情景选择器+开始/重置。game.js loop 加 scenario.step 钩子(同 ENGINES/FAILURES/ATC.step 链)。
- 文件:scenario.js(新)、game.js(loop 钩子)、sys.js、index.html、game.css、game.json。验收:选剧本→条件注入故障+监测处置+评分 debrief(Playwright)。

## Auditor 落地提醒(非阻断)
1. Tick3 PERF 公式 UI/注释标注"简化教学用,非真实 AFM"。
2. 4 面板均守 UI 铁律(手机零横滚+高密度小控件),实现后 Playwright 截图核验。
3. Tick2 SD 须只读 synoptic(无控制按钮)以区别于现有 HYD/ELEC/FUEL 控制面板。
4. 顺序 Tick2→3→4→5;各建独立新文件仅共享只读全局态,无写冲突。

## 进度
- [x] Tick1 计划(本文件 + auditor 4/4 PASS + 挂接点核实无重叠) — 2026-06-06
- [x] Tick2 v0.35 SD系统显示(sd.js 6页只读synoptic:HYD/ELEC/FUEL/BLEED/ENG/STATUS+推力模式CLB/MCT/TOGA;读实时态+页切+HYD失效真反映+手机零横滚实测PASS) — 2026-06-06
- [x] Tick3 v0.36 PERF性能计算(perf.js V1/VR/V2/Vref/Vapp+TODR/LDR+跑道余量变色,随质量/跑道/风/OAT;应用Vapp写AFS闭环;手机零横滚实测PASS) — 2026-06-06
- [x] Tick4 v0.37 ECL检查单(checklist.js 6套单正常+非正常/自动感知sense(S)绿勾+手动勾/荐单按phase故障/进度条;自动感知+手动+荐单+手机零横滚实测PASS) — 2026-06-06
- [ ] Tick5 v0.38 故障情景训练
