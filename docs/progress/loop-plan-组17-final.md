# Loop Plan · 组17-final — 收官复盘(FCU + ATC + WXR + 夜航光环境 + 布局重构)

> FA 飞行模拟器独立 betterloop。组17 收尾。停止条件 D 永续——仅用户令停;用户要"勤快点"。本组含一次用户驱动的紧急 UI 架构重构(面板布局)。

## 组17 实绩

| Tick | 版本 | 交付 | 实测红线 |
|---|---|---|---|
| Tick1 | — | 计划组,auditor 两轮全 PASS(Tick5 升格跨层重构) | — |
| Tick2 | v0.30.0.0 | FCU 自动飞行控制板(afs.js) | AP 真按 FCU 模式飞(HDG→roll/ALT→pitch),EMMA 优先让位 |
| — | v0.30.1.1 | **面板布局架构重构**(用户反馈) | 飞行视野永不被盖+面板入仪表区+手机零横滚(全 12+面板) |
| Tick3 | v0.31.0.0 | ATC 空管语音通信(atc.js) | 指令序列真触发+WILCO 应答+手机零横滚 |
| Tick4 | v0.32.0.0 | 天气雷达 WXR(wxr.js) | 晴空 0 回波 / IMC 120 真增密+扫描动画+手机零横滚 |
| Tick5 | v0.33.0.0 | 夜航光环境(lights.js,跨层重构 D) | 真搬迁(drawApproachLights 移除)+7 类新灯种+透雾+手机零横滚 |

## 关键事件:两次用户反馈驱动的修复

1. **Service Worker 缓存坑**(arcade,commit 087d7d0):游戏更新玩家刷新看不到=SW cache-first 无失效。修 /games network-first + 缓存 v2。记忆 [[reference_arcade_sw_cache]]。
2. **面板布局架构**(v0.30.1.x):面板原全屏盖飞行视野=架构错误。重构为飞行视野永占上方+面板入下方仪表区切换+手机零横向滚动。记忆 [[feedback_fa_panel_layout]]。今后所有面板必过手机视口实测。

## 累计成果

- **模块** 22→25(afs/atc/wxr/lights);**面板** 10→14(AFS/FCU·无线电·气象雷达·灯光)。
- **自动飞行**:FCU 选定模式(HDG/ALT/SPD/V·S)+ NAV/APPR managed,与 EMMA 三态协调。
- **通信**:ATC 指令序列 + 语音 + 应答。
- **气象**:WXR 扇形扫描回波,接 WEATHER 真联动。
- **光环境**:灯光逻辑集中 lights.js,RAIL/REIL/滑行道/机身灯/着陆光锥 7 类新灯 + 灯光透雾。
- **UX**:面板布局架构修复——飞行视野永不被盖,手机零横向滚动(全面板)。

## 下一步:进组18(D 永续)

派 betterloop-auditor(opus)审 4 候选,方向候选:
1. 客舱/推力管理 EICAS 二次页(推力模式 CLB/MCT/TOGA + 引擎二次参数 + 液压/电气总览页)
2. 性能计算页(起降距离/V 速度自动算,接机型重量/跑道长/风/标高)
3. 多人/幽灵对比(同跑道他人轨迹回放叠加)
4. 程序进近 SID/STAR + 复飞程序(MCDU F-PLN 扩展沿程序点)
5. 故障情景训练模式(预设故障剧本 + 处置评分)

auditor 全 PASS 落 loop-plan-组18.md 再继续。
