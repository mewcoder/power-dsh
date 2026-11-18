# 首页鲸鱼触发

## 标识、入口与范围

功能 id `home-whale`；设置 → power-dsh → 界面的「输入框聚焦播放鲸鱼」默认关闭。开启后在空白首页第一次主动点击可编辑输入框，或通过 Tab 移入输入框时播放一次。自动聚焦、点击空白、同次首页内反复点击或聚焦不触发；离开首页后重新进入恢复一次机会。

## 配置与行为

`homeWhaleFocusEnabled` 通过原生 configForms 独立持久化。仅用公开 conversation.hero.frame hoc slot 的 pixel-whale 同 id 优先级覆盖装饰层，原样透传 children；关闭恢复原生装饰注册。不修改 DSH 文件、宿主布局、其他 DOM 或全局 CSS，不模拟点击，不读取 React 内部状态。

自有 canvas 复用官方 MIT 鲸鱼图集（来源与许可见第三方声明），使用局部样式、原生主题色和独立渲染器。输入框识别仅发生于本层事件路径，使用已核对的 data-composer-input/contenteditable 标记。Tab 意图只在同一浏览器事件内有效。减少动态效果、页面隐藏和 canvas 不可见时不播放；卸载释放帧、媒体查询、观察器和图像。

## 生命周期、权限与兼容

Inspect 当前不可用；接口依据为 DSH 0.2.2-rc.1 官方提交 fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159 的 ui-conversation hero.frame、ui-slots 优先级覆盖与 ui-brand-official。资源内置，不使用网络、文件写入、Host RPC 或额外依赖。较旧宿主无此 slot 时不注册。关闭保留偏好，不停止或更改会话。

## 验收条件与验证

覆盖默认关闭、只注册一个装饰、点击/键盘意图、自动聚焦和重复触发排除、首页重新进入、卸载和资源释放；检查实际产物包含图集和许可。真实页面、浅深主题及键盘链路需与夹具结果区分记录。
