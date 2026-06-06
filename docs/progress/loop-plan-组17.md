# Loop Plan · 组17 — FCU 自动飞行 + ATC 通信 + 气象雷达 + 夜航光环境

> FA 飞行模拟器独立 betterloop。接组16(机型/机场/回放/ND 收官,d8ce50b)。停止条件 D 永续仅用户令停;用户要"勤快点"。组17 补齐驾驶舱四大拟真子系统:自动飞行控制板、空管通信、气象雷达、夜航灯光。

## 组16 复盘(收官)
Tick2 多机型(v0.26)/Tick3 多机场(v0.27)/Tick4 回放(v0.28)/Tick5 ND(v0.29)。22 模块 10 面板。详见 loop-plan-组16-final.md。

## 组17 主题:驾驶舱四大子系统
betterloop-auditor(opus)两轮审定:首轮 Tick2/3/4 PASS、Tick5 WEAK(与现有灯光渲染重叠);Tick5 按"放大方向1"升格为跨层重构 D + 新灯种 + 灯光透雾后复审 **PASS**。四候选全 PASS。挂接点全核实(ap{}/autopilot/Sound.say/WEATHER/render 灯光散落点实测存在)。

### Tick 2 — FCU 自动飞行控制板 + AP 模式 (B+C, ~210行) → v0.30.0.0
- 新建 afs.js:afs.tgt{hdgSel,altSel,spdSel,vsSel}+afs.modes{lat:HDG/NAV,ver:ALT/VS/APPR,spd:MANAGED/SEL}。PANELS"AFS/FCU"面板:旋钮按钮调目标+模式按钮。
- autopilot(dt)(emma.js:76)扩展:EMMA 非 control 但 AP engaged 时按 FCU 模式飞(HDG/ALT 保持、SPD 自动油门、NAV 沿 WPTS 横导、APPR 截获 ILS)。afs 提供目标,autopilot 消费。
- 文件:afs.js(新)、emma.js、sys.js、index.html、game.css、game.json。验收:FCU 调目标+选模式→AP 真按 FCU 飞(Playwright 驱动验目标跟踪)。

### Tick 3 — ATC 语音通信 + 无线电面板 (A+B, ~220行) → v0.31.0.0
- 新建 atc.js:ATC 指令状态机(放行/进近/落地许可/复飞),按 S.phase/alt/距离触发;Sound.say 语音播报。PANELS"无线电/ATC"面板:消息日志+应答按钮(WILCO/ROGER/SAY AGAIN)+频率。
- 文件:atc.js(新)、game.js(phase 钩子)、sys.js、index.html、game.css、game.json。验收:进近阶段触发 ATC 指令+日志+应答(Playwright)。

### Tick 4 — 天气雷达 WXR 面板 (B, ~190行) → v0.32.0.0
- 新建 wxr.js:PANELS"气象雷达 WXR"面板:canvas 扇形扫描回波(WEATHER.preset/visibility+确定性噪声生成),绿/黄/红分级,量程 20/40/80NM,GAIN/TILT,距离衰减,逐帧 sync 扫描线。
- 文件:wxr.js(新)、sys.js、index.html、game.css、game.json。验收:开 WXR→回波渲染+量程切换+扫描(Playwright)。

### Tick 5 — 夜航/低能见度光环境系统(跨层重构 D, ~290总/~220净, ~6文件) → v0.33.0.0
- **重构搬迁**:render.js 现有 drawApproachLights(:294-309)+drawRunway 边灯(:323)灯光逻辑抽进 lights.js LIGHTS.drawGround(T) 统一门控(render 净减~30/lights 接收~40,不计入净增护栏)。
- **净新增**:LIGHTS 状态{landing,taxi,strobe,nav,beacon,logo,rwyEdge,approachLt}+灯光面板;新灯种 RAIL 顺序闪导轨/REIL 跑道识别频闪/滑行道蓝边灯/机身航行灯(红左·绿右·白尾)+白频闪 strobe/信标 beacon 红闪;landing 灯近地光锥+IMC 灯光透雾衰减(接 WEATHER.visibility);cfg.tod 纳入环境面板。
- 文件:lights.js(新)、render.js、sys.js、index.html、game.css、game.json。验收:灯光面板开关真控各灯渲染+新灯种全落地+透雾随能见度(Playwright)。
- auditor 提醒:务必兑现 7 类新灯种全落地+真搬迁(非 render 原地加灯凑行);LIGHTS 开关为总闸、lightBoost 为强度系数厘清优先级。

## 进度
- [x] Tick1 计划(本文件 + auditor 两轮 4/4 PASS + 挂接点核实) — 2026-06-06
- [x] Tick2 v0.30 FCU 自动飞行控制板(afs.js AFS+FCU面板/AP主开关+4目标块+8模式/AFS.update按FCU模式写S/EMMA优先让位;AP真按FCU飞实测PASS) — 2026-06-06
- [x] Tick3 v0.31 ATC语音通信(atc.js 指令状态机:放行/继续/风报/落地许可/复飞/脱离+Sound.say+应答WILCO/ROGER;手机零横滚;指令真触发+应答实测PASS) — 2026-06-06
- [x] Tick4 v0.32 天气雷达WXR(wxr.js 扇形扫描+确定性回波hash+绿黄红分级+量程20/40/80+GAIN/TILT+扫描线动画;晴空0回波IMC120真增密+手机零横滚实测PASS) — 2026-06-06
- [ ] Tick5 v0.33 夜航光环境系统
