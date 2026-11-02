# NULL//ASCENT 实施计划

## 目标
在 GitHub 上交付完整可玩的浏览器 3D 动作 Roguelite，采用 Babylon.js WebGPU 优先与 WebGL2 回退，避免单文件内联 AppBlock 的初始化和状态耦合问题。

## 架构
Vite + 原生 ES Modules + Babylon.js。游戏规则拆成可单测的纯函数，渲染、输入、音频、UI 与战斗状态分离。渲染层只通过游戏状态快照消费数据，不让 Babylon 对象进入规则测试。Playwright 验证浏览器主流程，Vitest 验证波次、伤害、升级与构筑。

## 技术栈
- Node.js 22
- Babylon.js 8.x
- Vite 7.x
- Vitest 3.x
- Playwright 1.x
- WebGPU 首选，Babylon EngineFactory / WebGL2 兼容路径

## 任务
1. 项目底座：Vite、模块入口、引擎初始化、WebGPU/WebGL2 状态检测、错误提示、响应式画布。
2. 规则内核：玩家属性、敌人定义、波次调度、伤害与碰撞、升级草案、标签协同、胜败条件，先写失败测试。
3. 视觉场景：工业竞技场、PBR 材质、程序化表面细节、环境光、阴影、Bloom、粒子与角色组合模型。
4. 战斗：玩家移动/瞄准/射击/冲刺/技能，四种敌人行为、敌弹、危险区预警、Boss 三阶段。
5. Roguelite：回响碎片、经验升级、三选一、标签套装、五战区推进、结算与本地永久记录。
6. 视听/UI：原创 Web Audio 合成层、战斗提示音、菜单、暂停、设置、HUD、升级面板、胜负结算。
7. 验收：Vitest、生产构建、Playwright 流程、无控制台错误、键鼠输入、分辨率、WebGPU/WebGL2 分支检查；修复所有阻断缺陷。

## 质量门槛
- 不允许只提交首页或静态展示场景。
- 不允许用球体/方块占位冒充完成角色与敌人。
- 不允许将 WebGPU 兼容性错误静默吞掉。
- 不允许将第三方账号、MCP 审批或付费服务设为前置条件。
- 每个关键规则先写测试，再实现；最终结论必须有新鲜构建和测试证据。
