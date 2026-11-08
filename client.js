window.__ModuleLoader__.load({
  id: 'power-dsh',
  factory(require) {
    const React = require('react');
    const { Menu, Tooltip, StateDot, Modal, Button } = require('@deepseek-ai/dsh-client-ui-primitives');
    const h = React.createElement;
    const namespace = 'power-dsh';
    // Keep this literal JSON-compatible so the repository check can compare keys.
    const dictionaries = {
      "en": {
        "title": "PowerDSH",
        "generalTab": "General",
        "notificationsEnabled": "Task notifications",
        "notificationsDescription": "Send desktop notifications when tasks finish, fail, or need confirmation.",
        "notificationSoundEnabled": "Notification sound",
        "notificationSoundDescription": "Play task notification sounds.",
        "notificationSound": "Alert sound",
        "notificationToneDescription": "Choose a system alert sound.",
        "notificationSoundPreview": "Preview",
        "notificationSoundDefault": "System default",
        "notificationSoundMissing": "Selected sound unavailable",
        "notificationSoundUnavailable": "Could not load system sounds. Re-enable power-dsh, then try again.",
        "notificationSoundFailed": "Could not play the system sound. Check audio settings and try again.",
        "notificationSoundTestTitle": "power-dsh sound test",
        "notificationSoundTestBody": "This notification uses the system default sound.",
        "soundSystemDefault": "Default beep",
        "soundSystemAsterisk": "Information",
        "soundSystemExclamation": "Exclamation",
        "soundSystemHand": "Critical stop",
        "soundSystemQuestion": "Question",
        "notificationComplete": "Task completed",
        "notificationError": "Task failed",
        "notificationInput": "Input required",
        "notificationApproval": "Approval required",
        "notificationBody": "Return to DSH to view the task.",
        "notificationUnsupported": "Desktop notifications are unavailable in this environment.",
        "notificationPermission": "Allow notifications for DSH in your browser or system settings, then try again.",
        "notificationFailed": "Could not deliver the notification. Check browser and system notification settings.",
        "notificationUnavailable": "Task notifications have not loaded yet. Re-enable power-dsh, then try again.",
        "enhancementsTab": "Enhancements",
        "simplifyTab": "Simplify",
        "personalizationTab": "Personalization",
        "personalizationEnabled": "Personalization",
        "personalizationDescription": "Manage global instructions",
        "skillManagerEnabled": "Skill management",
        "skillManagerDescription": "Manage skills in settings",
        "skillsTab": "Skills",
        "skillsDescription": "Manage skills available to DSH",
        "skillSearch": "Search skills",
        "skillSources": "Filter by source",
        "skillAllSources": "All sources",
        "skillWorkspace": "Project",
        "skillNoProjects": "No imported projects",
        "skillPreinstalledGroup": "Built-in",
        "skillPersonalGroup": "User",
        "skillPreinstalledDescription": "Included with DSH or plugins",
        "skillPersonalDescription": "Loaded from local skill directories",
        "skillScope": "Skill scope",
        "skillUserScope": "Global",
        "skillProjectScope": "Project",
        "skillEmpty": "No skills available",
        "skillNoMatches": "No matching skills",
        "skillIncomplete": "The skill catalog is incomplete. Refresh before changing skills.",
        "skillLoadFailed": "Could not load skills. Please try again.",
        "skillSaveFailed": "Could not change this skill. Please try again.",
        "skillManagerOutdated": "The Host has not loaded skill management yet. Re-enable power-dsh, then try again.",
        "skillPersonalSource": "User",
        "skillProjectSource": "Project",
        "skillPluginSource": "Plugin",
        "skillCustomSource": "Custom",
        "skillBundledSource": "Built-in",
        "skillSourceDisabled": "Disabled by its source",
        "skillUnavailable": "Managed by its provider",
        "skillUnsupported": "This source does not support individual changes",
        "skillLegacyScope": "The project for this older setting could not be determined",
        "mcpManagerEnabled": "MCP management",
        "mcpManagerDescription": "Manage MCP in settings",
        "mcpTab": "MCP",
        "mcpDescription": "Manage MCP servers available in DSH",
        "mcpProfileDescription": "Configured in the current DSH profile",
        "mcpPresetDescription": "Included with DSH modes",
        "mcpOtherDescription": "Provided by other configuration sources",
        "mcpPersonalDescription": "MCP configured by the user",
        "mcpPreinstalledDescription": "Included with modes or plugins",
        "mcpPluginSource": "Provided by plugin",
        "mcpManagerSource": "MCP configuration",
        "mcpPluginManaged": "Managed by its providing plugin",
        "mcpManagerManaged": "Manage this entry in the native MCP settings",
        "mcpSearch": "Search MCP",
        "mcpLocalType": "Local",
        "mcpHttpType": "HTTP",
        "mcpTools": "Tools",
        "mcpToolCount": "{count} tools",
        "mcpSingleTool": "1 tool",
        "mcpNoTools": "No loaded tools",
        "mcpDisabled": "Disabled",
        "mcpNoAvailableTools": "No available tools",
        "mcpEmpty": "No MCP servers configured",
        "mcpNoMatches": "No matching MCP servers",
        "mcpProfileSource": "Current configuration",
        "mcpPresetSource": "Provided by mode",
        "mcpOtherSource": "Other sources",
        "mcpRuntimePending": "Pending",
        "mcpRuntimeLoading": "Loading",
        "mcpRuntimeActive": "Running",
        "mcpRuntimeFailed": "Failed to load",
        "mcpRuntimeUnloading": "Unloading",
        "mcpRuntimeInactive": "Not running",
        "mcpStateUnknown": "State unavailable",
        "mcpPresetManaged": "Managed by its mode",
        "mcpConditional": "Enabled state is controlled by a condition",
        "mcpUnaddressable": "This configuration does not support individual changes",
        "mcpManagementRequired": "This environment does not allow configuration changes",
        "mcpReadOnly": "This entry cannot be changed",
        "mcpIncomplete": "The MCP list is incomplete. Refresh before changing servers.",
        "mcpLoadFailed": "Could not load MCP servers. Please try again.",
        "mcpChangeFailed": "Could not change this MCP server. Please try again.",
        "mcpRestartRequired": "The setting was saved. Restart DSH to apply it.",
        "mcpChangeOverridden": "Another configuration overrides this setting.",
        "mcpChangeUncertain": "The result could not be confirmed. Review the current state before trying again.",
        "mcpUnavailable": "MCP management is currently unavailable.",
        "mcpManagerOutdated": "The Host has not loaded MCP management yet. Re-enable power-dsh, then try again.",
        "retry": "Retry",
        "settingsLocation": "Global instructions ({path})",
        "globalPromptPlaceholder": "Add custom instructions",
        "globalPrompt": "Global instructions",
        "promptTooLong": "Instructions exceed the 20,000 character limit.",
        "promptConflict": "These instructions changed elsewhere. Copy your draft, then cancel to load the latest version.",
        "save": "Save",
        "cancel": "Cancel",
        "saving": "Saving…",
        "description": "A DSH enhancement plugin",
        "blockTodo": "Simplify Todo tool",
        "blockTodoDescription": "Stop generating to-do lists during harness execution",
        "blockOfficialTelemetry": "Simplify official feedback and telemetry",
        "blockTelemetryDescription": "Disable usage statistics, environment data collection, Session-log uploads, and plugin inventory reporting",
        "blockOfficialAccount": "Simplify official sign-in and model integrations",
        "blockAccountDescription": "Disable official sign-in, account UI, and built-in model integrations.",
        "blockOfficialSearch": "Simplify official search",
        "blockSearchDescription": "Disable built-in web search while keeping web fetch and third-party MCP search.",
        "showThemeSwitcher": "Appearance shortcut",
        "themeSwitcherDescription": "Quickly switch appearance at the bottom of the sidebar",
        "appearance": "Appearance",
        "themeLight": "Light",
        "themeDark": "Dark",
        "themeSystem": "System",
        "switchTo": "Switch to",
        "showRestartButton": "Show restart button",
        "restartDescription": "Restart the DSH application",
        "restart": "Restart DSH",
        "restartConfirm": "Running tasks will stop and unsaved content may be lost.",
        "restartAction": "Restart",
        "close": "Close",
        "restartFailed": "Could not restart DSH. Check whether quitting was cancelled, then try again.",
        "restartUnavailable": "Restart is unavailable. Re-enable PowerDSH and try again.",
        "restartBusy": "DSH is already preparing to restart.",
        "showRefreshButton": "Show refresh button",
        "refreshDescription": "Reload the current interface",
        "moreActions": "More actions",
        "refresh": "Refresh interface",
        "refreshFailed": "Could not refresh the interface. Please try again.",
        "showVersion": "Show version number",
        "versionDescription": "Show the version number at the upper left. Click it to check for updates",
        "loading": "Loading settings…",
        "unavailable": "Settings are currently unavailable.",
        "readOnly": "These settings are read-only.",
        "saveFailed": "Could not save this setting. Please try again.",
        "settingsOutdated": "The Host has not loaded personalization yet. Re-enable power-dsh in plugin management, then try again.",
        "versionUnavailable": "DSH version information is currently unavailable.",
        "openUpdate": "Check for updates",
        "updating": "Opening native updates…",
        "updateFailed": "Could not open updates. Please try again.",
        "desktopOnly": "Open the DSH desktop app to check for updates."
      },
      "zh": {
        "title": "PowerDSH",
        "generalTab": "通用",
        "notificationsEnabled": "任务通知",
        "notificationsDescription": "任务完成、失败或需要确认时发送桌面通知。",
        "notificationSoundEnabled": "通知声音",
        "notificationSoundDescription": "开启任务通知提示音。",
        "notificationSound": "提示音",
        "notificationToneDescription": "选择系统提示音。",
        "notificationSoundPreview": "试听",
        "notificationSoundDefault": "系统默认",
        "notificationSoundMissing": "所选提示音不可用",
        "notificationSoundUnavailable": "无法加载系统提示音，请重新启用 power-dsh 后重试。",
        "notificationSoundFailed": "无法播放系统提示音，请检查声音设置后重试。",
        "notificationSoundTestTitle": "power-dsh 声音测试",
        "notificationSoundTestBody": "这条通知使用系统默认提示音。",
        "soundSystemDefault": "默认提示",
        "soundSystemAsterisk": "信息",
        "soundSystemExclamation": "警告",
        "soundSystemHand": "错误",
        "soundSystemQuestion": "询问",
        "notificationComplete": "任务已完成",
        "notificationError": "任务出错",
        "notificationInput": "等待输入",
        "notificationApproval": "请求审批",
        "notificationBody": "返回 DSH 查看任务。",
        "notificationUnsupported": "当前环境不支持桌面通知。",
        "notificationPermission": "请在浏览器或系统设置中允许 DSH 发送通知后重试。",
        "notificationFailed": "通知发送失败，请检查浏览器和系统通知设置。",
        "notificationUnavailable": "任务通知尚未加载，请重新启用 power-dsh 后重试。",
        "enhancementsTab": "增强",
        "simplifyTab": "精简",
        "personalizationTab": "个性化",
        "personalizationEnabled": "个性化",
        "personalizationDescription": "管理全局提示词",
        "skillManagerEnabled": "技能管理",
        "skillManagerDescription": "在设置中管理技能",
        "skillsTab": "技能",
        "skillsDescription": "管理 DSH 中可用的技能",
        "skillSearch": "搜索技能",
        "skillSources": "按来源筛选",
        "skillAllSources": "全部来源",
        "skillWorkspace": "项目",
        "skillNoProjects": "暂无已导入项目",
        "skillPreinstalledGroup": "内置",
        "skillPersonalGroup": "用户",
        "skillPreinstalledDescription": "随 DSH 或插件提供",
        "skillPersonalDescription": "从本机技能目录加载",
        "skillScope": "技能范围",
        "skillUserScope": "全局",
        "skillProjectScope": "项目",
        "skillEmpty": "暂无可用技能",
        "skillNoMatches": "未找到匹配技能",
        "skillIncomplete": "技能目录不完整，请刷新后再修改。",
        "skillLoadFailed": "无法加载技能，请重试。",
        "skillSaveFailed": "无法修改此技能，请重试。",
        "skillManagerOutdated": "技能管理尚未在后端加载，请重新启用 power-dsh 后重试。",
        "skillPersonalSource": "用户",
        "skillProjectSource": "项目",
        "skillPluginSource": "插件",
        "skillCustomSource": "自定义",
        "skillBundledSource": "内置",
        "skillSourceDisabled": "已由来源禁用",
        "skillUnavailable": "由提供方管理",
        "skillUnsupported": "此来源暂不支持单独启停",
        "skillLegacyScope": "旧设置无法确定所属项目",
        "mcpManagerEnabled": "MCP 管理",
        "mcpManagerDescription": "在设置中管理 MCP",
        "mcpTab": "MCP",
        "mcpDescription": "管理 DSH 中可用的 MCP",
        "mcpProfileDescription": "来自当前 DSH 配置",
        "mcpPresetDescription": "随 DSH 模式提供",
        "mcpOtherDescription": "来自其他配置来源",
        "mcpPersonalDescription": "用户配置的 MCP",
        "mcpPreinstalledDescription": "随模式或插件提供",
        "mcpPluginSource": "插件提供",
        "mcpManagerSource": "MCP 配置",
        "mcpPluginManaged": "由提供插件管理",
        "mcpManagerManaged": "请在原生 MCP 设置中管理",
        "mcpSearch": "搜索 MCP",
        "mcpLocalType": "本地",
        "mcpHttpType": "HTTP",
        "mcpTools": "工具",
        "mcpToolCount": "{count} 个工具",
        "mcpSingleTool": "1 个工具",
        "mcpNoTools": "暂无已加载工具",
        "mcpDisabled": "已关闭",
        "mcpNoAvailableTools": "暂无可用工具",
        "mcpEmpty": "暂无 MCP 配置",
        "mcpNoMatches": "未找到匹配的 MCP",
        "mcpProfileSource": "当前配置",
        "mcpPresetSource": "模式提供",
        "mcpOtherSource": "其他来源",
        "mcpRuntimePending": "等待中",
        "mcpRuntimeLoading": "加载中",
        "mcpRuntimeActive": "运行中",
        "mcpRuntimeFailed": "加载失败",
        "mcpRuntimeUnloading": "卸载中",
        "mcpRuntimeInactive": "未运行",
        "mcpStateUnknown": "状态不可用",
        "mcpPresetManaged": "由模式管理",
        "mcpConditional": "启用状态由条件控制",
        "mcpUnaddressable": "此配置暂不支持单独启停",
        "mcpManagementRequired": "当前环境不允许修改配置",
        "mcpReadOnly": "此条目暂不支持更改",
        "mcpIncomplete": "MCP 列表不完整，请刷新后再修改。",
        "mcpLoadFailed": "无法加载 MCP，请重试。",
        "mcpChangeFailed": "无法修改此 MCP，请重试。",
        "mcpRestartRequired": "设置已保存，请重启 DSH 后生效。",
        "mcpChangeOverridden": "此设置被其他配置覆盖。",
        "mcpChangeUncertain": "无法确认修改结果，请核对当前状态后重试。",
        "mcpUnavailable": "MCP 管理暂不可用。",
        "mcpManagerOutdated": "MCP 管理尚未在后端加载，请重新启用 power-dsh 后重试。",
        "retry": "重试",
        "settingsLocation": "全局指令（{path}）",
        "globalPromptPlaceholder": "添加自定义指令",
        "globalPrompt": "全局提示词",
        "promptTooLong": "提示词超过 20,000 字符上限。",
        "promptConflict": "内容已在其他位置更改，请先复制草稿，再取消以载入最新内容。",
        "save": "保存",
        "cancel": "取消",
        "saving": "正在保存…",
        "description": "DSH 增强插件",
        "blockTodo": "精简Todo工具",
        "blockTodoDescription": "harness执行过程中不再生成待办列表",
        "blockOfficialTelemetry": "精简官方反馈与遥测",
        "blockTelemetryDescription": "停用使用统计、环境信息采集、会话日志及插件清单上报",
        "blockOfficialAccount": "精简官方登录与模型接入",
        "blockAccountDescription": "停用官方登录、账号界面及内置模型接入。",
        "blockOfficialSearch": "精简官方搜索",
        "blockSearchDescription": "停用内置网页搜索，保留网页抓取与第三方 MCP 搜索。",
        "showThemeSwitcher": "外观快捷切换",
        "themeSwitcherDescription": "在侧栏底部快捷切换外观",
        "appearance": "外观",
        "themeLight": "浅色",
        "themeDark": "深色",
        "themeSystem": "跟随系统",
        "switchTo": "切换为",
        "showRestartButton": "显示重启按钮",
        "restartDescription": "重新启动 DSH 应用",
        "restart": "重启 DSH",
        "restartConfirm": "运行中的任务会停止，未保存的内容可能丢失。",
        "restartAction": "重启",
        "close": "关闭",
        "restartFailed": "未能重启 DSH。请检查是否取消了退出，然后重试。",
        "restartUnavailable": "重启暂不可用，请重新启用 PowerDSH 后重试。",
        "restartBusy": "DSH 正在准备重启。",
        "showRefreshButton": "显示刷新按钮",
        "refreshDescription": "重新加载当前界面",
        "moreActions": "更多操作",
        "refresh": "刷新界面",
        "refreshFailed": "无法刷新界面，请重试。",
        "showVersion": "显示版本号",
        "versionDescription": "在左上角显示版本号，点击检查更新",
        "loading": "正在加载设置…",
        "unavailable": "设置暂不可用。",
        "readOnly": "当前设置为只读。",
        "saveFailed": "无法保存此设置，请重试。",
        "settingsOutdated": "个性化功能尚未在后端加载，请在插件管理中重新启用 power-dsh 后重试。",
        "versionUnavailable": "DSH 版本信息暂不可用。",
        "openUpdate": "检查更新",
        "updating": "正在打开原生更新…",
        "updateFailed": "无法打开更新，请重试。",
        "desktopOnly": "请在 DSH 桌面端检查更新。"
      }
    };
    const styles = `
      .power-dsh-page { min-width:0; width:100%; color:var(--dsw-alias-label-primary); font:inherit; line-height:22px; overflow-wrap:anywhere; }
      .power-dsh-page > header { display:flex; flex-direction:column; gap:12px; }
      .power-dsh-page .power-dsh-title { margin:0; color:var(--dsw-alias-label-primary); font-size:16px; font-weight:500; line-height:24px; }
      .power-dsh-page > header .power-dsh-description { margin:0; color:var(--dsw-alias-label-tertiary); font-size:14px; font-weight:400; line-height:22px; }
      .power-dsh-page .power-dsh-description { margin:0; color:var(--dsw-alias-label-secondary); font-size:13px; line-height:20px; }
      .power-dsh-page .power-dsh-tabs { display:flex; align-items:flex-end; gap:22px; margin-top:14px; border-bottom:.5px solid var(--dsw-alias-border-l2); }
      .power-dsh-page .power-dsh-tab { position:relative; border:0; padding:7px 1px 9px; background:transparent; color:var(--dsw-alias-label-tertiary); font:inherit; font-size:13px; line-height:20px; cursor:pointer; }
      .power-dsh-page .power-dsh-tab[aria-selected="true"] { color:var(--dsw-alias-label-primary); }
      .power-dsh-page .power-dsh-tab[aria-selected="true"]::after { position:absolute; right:0; bottom:-1px; left:0; height:2px; border-radius:2px 2px 0 0; background:var(--dsw-alias-label-primary); content:""; }
      .power-dsh-page .power-dsh-tab:focus-visible { outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; border-radius:2px; }
      .power-dsh-page .power-dsh-fields { display:flex; flex-direction:column; width:100%; margin-top:14px; }
      .power-dsh-page .power-dsh-setting-row { display:flex; align-items:center; justify-content:space-between; gap:24px; padding:16px 0; border-bottom:.5px solid var(--dsw-alias-border-l2); }
      .power-dsh-page .power-dsh-fields > .power-dsh-setting-row:last-of-type { border-bottom:none; }
      .power-dsh-page .power-dsh-setting-copy { min-width:0; }
      .power-dsh-page .power-dsh-setting-label { color:var(--dsw-alias-label-primary); font-size:14px; font-weight:400; line-height:20px; }
      .power-dsh-page .power-dsh-setting-copy .power-dsh-description { margin-top:4px; color:var(--dsw-alias-label-secondary); font-size:12px; font-weight:400; line-height:18px; }
      .power-dsh-page .power-dsh-sound-controls { display:flex; align-items:center; justify-content:flex-end; flex-wrap:wrap; gap:8px; flex:none; max-width:50%; }
      .power-dsh-page .power-dsh-sound-select { box-sizing:border-box; display:inline-flex; align-items:center; justify-content:center; gap:12px; min-height:36px; max-width:100%; padding:0 14px; border:0; border-radius:var(--dsw-radius-md); background:var(--dsw-alias-bg-module-platform); color:var(--dsw-alias-label-primary); font:inherit; font-size:14px; line-height:22px; cursor:pointer; }
      .power-dsh-page .power-dsh-sound-preview { display:inline-flex; align-items:center; justify-content:center; flex:none; width:36px; height:36px; padding:0; border:0; border-radius:var(--dsw-radius-md); background:transparent; color:var(--dsw-alias-label-secondary); cursor:pointer; }
      .power-dsh-page .power-dsh-sound-preview:disabled { opacity:.5; cursor:default; }
      .power-dsh-page .power-dsh-sound-preview:focus-visible { outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; }
      @media (hover:hover) { .power-dsh-page .power-dsh-sound-preview:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover); } }
      .power-dsh-page .power-dsh-sound-select:disabled { opacity:.5; cursor:default; }
      .power-dsh-page .power-dsh-sound-select:focus-visible { outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; }
      @media (hover:hover) { .power-dsh-page .power-dsh-sound-select:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover); } }
      .power-dsh-page .power-dsh-switch { box-sizing:border-box; position:relative; flex:0 0 auto; width:36px; height:20px; padding:2px; border:0; border-radius:999px; corner-shape:round; background:var(--dsw-alias-border-l3); cursor:pointer; transition:background-color 120ms ease,opacity 120ms ease; }
      .power-dsh-page .power-dsh-switch[aria-checked="true"] { background:var(--dsw-alias-brand-primary); }
      .power-dsh-page .power-dsh-switch:focus-visible { outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; }
      .power-dsh-page .power-dsh-switch:disabled { cursor:default; opacity:0.5; }
      .power-dsh-page .power-dsh-switch[aria-busy="true"] { opacity:.8; }
      .power-dsh-page .power-dsh-switch-thumb { display:block; width:16px; height:16px; border-radius:50%; corner-shape:round; background:var(--dsw-alias-label-primary-foreground); transition:transform 120ms ease; }
      .power-dsh-page .power-dsh-switch[aria-checked="false"] .power-dsh-switch-thumb { background:var(--dsw-alias-switch-thumb); }
      .power-dsh-page .power-dsh-switch[aria-checked="true"] .power-dsh-switch-thumb { transform:translateX(16px); }
      .power-dsh-page .power-dsh-prompt-editor { display:flex; flex-direction:column; gap:8px; padding:16px 0; }
      .power-dsh-page .power-dsh-prompt-input { box-sizing:border-box; display:block; width:100%; max-width:100%; min-height:260px; margin:0; padding:12px 14px; resize:vertical; border:.5px solid var(--dsw-alias-border-l4); border-radius:var(--dsw-radius-lg); background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); font:inherit; font-size:14px; line-height:22px; transition:border-color 120ms ease,box-shadow 120ms ease; }
      .power-dsh-page .power-dsh-prompt-input::placeholder { color:var(--dsw-alias-label-caption); }
      .power-dsh-page .power-dsh-prompt-input:focus { outline:none; border-color:var(--dsw-alias-border-l3); box-shadow:0 0 0 1px var(--dsw-alias-state-business-primary); }
      .power-dsh-page .power-dsh-prompt-input[aria-invalid="true"] { border-color:var(--dsw-alias-state-error-primary); }
      .power-dsh-page .power-dsh-prompt-input:disabled { opacity:.5; cursor:default; }
      .power-dsh-page .power-dsh-prompt-action:focus-visible { outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; }
      .power-dsh-page .power-dsh-prompt-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:8px; }
      .power-dsh-page .power-dsh-prompt-action { box-sizing:border-box; display:inline-flex; align-items:center; justify-content:center; gap:4px; height:36px; border:.5px solid transparent; border-radius:var(--dsw-radius-md); padding:0 14px; background:transparent; color:var(--dsw-alias-label-primary); font:inherit; font-size:14px; line-height:22px; box-shadow:inset 0 0 0 var(--dsh-hairline-width,.5px) var(--dsh-button-outline-color,var(--dsw-alias-border-l3)); cursor:pointer; }
      .power-dsh-page .power-dsh-prompt-action[data-primary] { border:none; box-shadow:none; background:var(--dsw-alias-button-primary-fill); color:var(--dsw-alias-label-primary-foreground); }
      @media (hover:hover) { .power-dsh-page .power-dsh-prompt-action:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover); } .power-dsh-page .power-dsh-prompt-action[data-primary]:hover:not(:disabled) { background:var(--dsw-alias-button-primary-hover); } }
      .power-dsh-page .power-dsh-prompt-action:disabled { opacity:.4; cursor:not-allowed; }
      .power-dsh-page .power-dsh-skill-navigation { display:flex; align-items:flex-end; flex-wrap:wrap; gap:12px; margin-top:14px; border-bottom:.5px solid var(--dsw-alias-border-l2); }
      .power-dsh-page .power-dsh-skill-navigation > .power-dsh-tabs { margin-top:0; border-bottom:0; }
      /* Reserve the host scroll gutter only for the options column containing this page. */
      [data-shortcut-modal="settings"] > div:has(:is(.power-dsh-skills-page,.power-dsh-mcp-page)) { scrollbar-gutter:stable; }
      /* Adapted from DSH PluginInventorySettingsTab (MIT); see docs/third-party-notices.md. */
      .power-dsh-page:is(.power-dsh-skills-page,.power-dsh-mcp-page) { container:power-dsh-skills / inline-size; max-width:760px; display:flex; flex-direction:column; gap:12px; }
      .power-dsh-page:is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-navigation { margin-top:2px; }
      .power-dsh-skills-page .power-dsh-tab:focus-visible { color:var(--dsw-alias-label-primary); }
      .power-dsh-skills-page .power-dsh-tab:focus-visible::after { position:absolute; right:0; bottom:-1px; left:0; height:2px; border-radius:2px 2px 0 0; background:var(--dsw-alias-label-primary); content:""; }
      @media (hover:hover) { .power-dsh-skills-page .power-dsh-tab:hover:not(:disabled) { color:var(--dsw-alias-label-primary); } }
      :is(.power-dsh-skills-page,.power-dsh-mcp-page) > header .power-dsh-title { font-size:18px; font-weight:600; }
      :is(.power-dsh-skills-page,.power-dsh-mcp-page) > header .power-dsh-description { font-size:13px; }
      :is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-panel { display:flex; flex-direction:column; gap:12px; padding-top:2px; }
      :is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-search-field { position:relative; display:flex; align-items:center; width:100%; color:var(--dsw-alias-label-tertiary); }
      :is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-search-field > svg { position:absolute; left:12px; pointer-events:none; }
      :is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-search-field input { box-sizing:border-box; width:100%; height:36px; border:.5px solid var(--dsw-alias-border-l4); border-radius:var(--dsw-radius-md); padding:0 34px 0 36px; outline:none; background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); font:inherit; font-size:13px; }
      :is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-search-field input::placeholder { color:var(--dsw-alias-label-tertiary); }
      :is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-search-field input:focus-visible { border-color:var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)) 18%,transparent); }
      :is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-cards { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin:0; padding:0; list-style:none; }
      :is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-card { display:flex; flex-direction:column; min-width:0; overflow:hidden; border:.5px solid var(--dsw-alias-settings-card-stroke); border-radius:var(--dsw-radius-xl); background:var(--dsw-alias-settings-card-fill); }
      :is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-card-content { box-sizing:border-box; display:flex; flex:1 1 auto; flex-direction:column; align-items:stretch; gap:2px; width:100%; min-height:52px; padding:12px 14px; }
      :is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-card-main { display:flex; align-items:center; justify-content:space-between; gap:12px; min-width:0; }
      :is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-card .power-dsh-switch { width:28px; height:16px; }
      :is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-card .power-dsh-switch::before { content:""; position:absolute; inset:-4px; }
      :is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-card .power-dsh-switch-thumb { width:12px; height:12px; }
      :is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-card .power-dsh-switch[aria-checked="true"] .power-dsh-switch-thumb { transform:translateX(12px); }
      :is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-card-title { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:14px; line-height:20px; font-weight:500; }
      :is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-card-description { display:-webkit-box; overflow:hidden; color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:18px; text-wrap:pretty; -webkit-box-orient:vertical; -webkit-line-clamp:2; }
      :is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-card-meta { display:flex; align-items:center; gap:6px; min-width:0; margin-top:auto; padding-top:6px; }
      .power-dsh-mcp-page .power-dsh-skill-cards { align-items:start; }
      .power-dsh-mcp-page .power-dsh-skill-card-content[data-expandable="true"] { cursor:pointer; }
      .power-dsh-mcp-page .power-dsh-mcp-runtime { display:inline-flex; flex:none; align-items:center; gap:6px; min-height:18px; white-space:nowrap; color:var(--dsw-alias-label-secondary); font-size:12px; line-height:18px; }
      .power-dsh-mcp-page .power-dsh-mcp-runtime[data-state="failed"] { color:var(--dsw-alias-state-error-primary); }
      .power-dsh-mcp-page .power-dsh-skill-card[data-open="true"] { border-color:var(--dsw-alias-border-l3); }
      .power-dsh-mcp-page .power-dsh-skill-card[data-open="true"] > .power-dsh-skill-card-content { background:var(--dsw-alias-interactive-bg-hover); }
      .power-dsh-mcp-page .power-dsh-skill-card-content:has(> .power-dsh-mcp-card-toggle:focus-visible) { outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:-2px; }
      .power-dsh-mcp-page .power-dsh-mcp-card-toggle { display:flex; flex:none; align-items:center; justify-content:space-between; gap:12px; width:100%; min-width:0; min-height:24px; margin-top:4px; border:0; border-radius:var(--dsw-radius-xs); padding:0; background:transparent; color:var(--dsw-alias-label-secondary); font:inherit; font-size:12px; line-height:18px; text-align:left; cursor:pointer; }
      .power-dsh-mcp-page .power-dsh-mcp-card-toggle > .power-dsh-skill-chevron { transform:none; }
      .power-dsh-mcp-page .power-dsh-mcp-card-toggle[aria-expanded="true"] > .power-dsh-skill-chevron { transform:rotate(180deg); }
      .power-dsh-mcp-page .power-dsh-mcp-card-toggle:focus-visible { outline:none; }
      .power-dsh-mcp-page .power-dsh-skill-card > .power-dsh-skill-card-content[data-expandable="true"]:active { background:var(--dsw-alias-interactive-bg-active); }
      @media (hover:hover) { .power-dsh-mcp-page .power-dsh-skill-card-content[data-expandable="true"]:hover { background:var(--dsw-alias-interactive-bg-hover); } }
      .power-dsh-mcp-page .power-dsh-mcp-card-meta { display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-top:4px; }
      .power-dsh-mcp-page .power-dsh-mcp-transport { display:inline-flex; flex:none; align-items:center; justify-content:center; border:.5px solid var(--dsw-alias-border-l4); border-radius:999px; corner-shape:round; padding:1px 8px; background:transparent; color:var(--dsw-alias-label-tertiary); font-size:11px; line-height:17px; font-weight:500; white-space:nowrap; }
      .power-dsh-mcp-page .power-dsh-mcp-card-placeholder { display:flex; align-items:center; min-height:24px; margin-top:4px; color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:18px; }
      .power-dsh-mcp-page .power-dsh-mcp-tools-summary { flex:1; min-width:0; }
      .power-dsh-mcp-page .power-dsh-mcp-tools { border-top:.5px solid var(--dsw-alias-border-l2); padding:10px 14px 12px; background:var(--dsw-alias-bg-module-platform); color:var(--dsw-alias-label-secondary); font-size:12px; line-height:18px; }
      .power-dsh-mcp-page .power-dsh-mcp-tools ul { display:flex; flex-direction:column; gap:8px; margin:0; padding:0; list-style:none; }
      .power-dsh-mcp-page .power-dsh-mcp-tool-name { min-width:0; overflow-wrap:anywhere; }
      .power-dsh-mcp-page .power-dsh-mcp-tools p { margin:0; }
      :is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-origin { display:block; box-sizing:border-box; flex:0 1 auto; min-width:0; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; border-radius:var(--dsw-radius-xs); padding:1px 6px; background:var(--dsw-alias-bg-module-platform); color:var(--dsw-alias-label-secondary); font-family:var(--ds-font-family-code); font-size:12px; line-height:18px; }
      :is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-group { display:flex; flex-direction:column; gap:10px; }
      :is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-group + .power-dsh-skill-group { border-top:.5px solid var(--dsw-alias-border-l2); padding-top:14px; }
      :is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-group-header { display:flex; align-items:center; gap:8px; min-height:36px; }
      :is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-group-toggle { display:flex; flex:none; align-items:center; gap:8px; border:0; padding:0; background:transparent; color:inherit; font:inherit; text-align:left; cursor:pointer; }
      :is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-group-toggle:focus-visible { outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; }
      :is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-group-title { color:var(--dsw-alias-label-primary); font-size:14px; line-height:22px; font-weight:400; }
      :is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-group-body { display:flex; flex-direction:column; gap:10px; }
      :is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-group-description { margin:-6px 0 0 20px; color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:18px; }
      :is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-chevron { flex:none; color:var(--dsw-alias-label-tertiary); }
      :is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-group-toggle > .power-dsh-skill-chevron { transform:rotate(-90deg); }
      :is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-group-toggle[aria-expanded="true"] > .power-dsh-skill-chevron { transform:none; }
      @container power-dsh-skills (max-width:520px) { :is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-cards { grid-template-columns:minmax(0,1fr); } }
      @media (pointer:coarse) { :is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-search-field input { font-size:16px; } }
      @media (prefers-reduced-motion:no-preference) { :is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-chevron { transition:transform 140ms var(--ds-ease-in-out); } }
      .power-dsh-skills-page .power-dsh-project-trigger { box-sizing:border-box; display:inline-flex; flex:none; align-items:center; gap:12px; width:200px; min-width:0; height:36px; max-width:100%; white-space:nowrap; border:0; border-radius:var(--dsw-radius-md); padding:0 14px; background:var(--dsw-alias-bg-module-platform); color:var(--dsw-alias-label-primary); font:inherit; font-size:14px; line-height:22px; cursor:pointer; }
      .power-dsh-skills-page .power-dsh-project-search-row { display:flex; align-items:center; flex-wrap:wrap; gap:12px; min-width:0; }
      .power-dsh-skills-page .power-dsh-project-search-row > .power-dsh-skill-search-field { flex:1 1 180px; min-width:0; width:auto; }
      .power-dsh-skills-page .power-dsh-project-menu { min-width:0; max-width:100%; }
      .power-dsh-skills-page .power-dsh-project-trigger-label { flex:1; min-width:0; overflow:hidden; text-align:left; text-overflow:ellipsis; }
      .power-dsh-skills-page .power-dsh-project-trigger > svg { flex:none; color:var(--dsw-alias-label-tertiary); }
      .power-dsh-skills-page .power-dsh-project-trigger:active:not(:disabled) { background:var(--dsw-alias-interactive-bg-active); }
      @media (hover:hover) { .power-dsh-skills-page .power-dsh-project-trigger:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover); } }
      .power-dsh-skills-page .power-dsh-project-trigger:focus-visible { outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; }
      .power-dsh-skills-page .power-dsh-project-trigger:disabled { opacity:.5; cursor:default; }
      :is(.power-dsh-skills-page,.power-dsh-mcp-page) > header .power-dsh-description { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .power-dsh-page .power-dsh-skill-reason { margin:4px 0 0; color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:18px; }
      .power-dsh-page .power-dsh-skill-empty { padding:48px 0; text-align:center; color:var(--dsw-alias-label-tertiary); }
      .power-dsh-page .power-dsh-skill-notice { margin:12px 0; }
      .power-dsh-page .power-dsh-notice { margin-top:8px; }
      .power-dsh-page .power-dsh-error { margin:0; color:var(--dsw-alias-label-primary); font:inherit; }
      @media (prefers-reduced-motion:reduce) { .power-dsh-page .power-dsh-switch, .power-dsh-page .power-dsh-switch-thumb, .power-dsh-page .power-dsh-prompt-input { transition:none; } }
    `;
    // An additive seat owns this badge. The brand's SVG and hidden label stay native.
    const badgeStyles = `
      .power-dsh-version-seat { display:block; flex:1 1 100%; min-width:0; width:100%; height:0; }
      .power-dsh-version-seat .power-dsh-version-badge { position:fixed; left:207px; top:30px; z-index:5; box-sizing:border-box; margin:0; padding:0; border:0; border-radius:2px; background:transparent; color:var(--dsw-alias-label-secondary); font:inherit; font-size:12px; font-weight:400; line-height:16px; letter-spacing:0; white-space:nowrap; text-overflow:ellipsis; overflow:hidden; pointer-events:auto; cursor:pointer; -webkit-app-region:no-drag; }
      html[data-platform="darwin"] .power-dsh-version-seat .power-dsh-version-badge { top:64px; }
      html[data-windows-titlebar] .power-dsh-version-seat .power-dsh-version-badge { top:calc(var(--dsh-windows-titlebar-height,32px) + 20px); }
      .power-dsh-version-seat .power-dsh-version-badge:disabled { cursor:default; }
      .power-dsh-version-seat .power-dsh-version-badge:not(:disabled):hover { color:var(--dsw-alias-label-primary); text-decoration:none; }
      .power-dsh-version-seat .power-dsh-version-badge:focus-visible { outline:2px solid var(--dsw-alias-brand-primary); outline-offset:2px; }
      .power-dsh-version-seat .power-dsh-version-error { position:fixed; left:16px; top:92px; z-index:6; max-width:240px; padding:8px 12px; border:1px solid var(--dsw-alias-border-l1); border-radius:6px; background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-state-error-primary); font-size:12px; line-height:18px; pointer-events:auto; -webkit-app-region:no-drag; }
    `;

    const appearanceStyles = `
      .power-dsh-appearance-seat { display:block; width:100%; height:0; }
      .power-dsh-appearance-seat .power-dsh-appearance-button { position:fixed; bottom:16px; z-index:5; display:flex; align-items:center; justify-content:center; box-sizing:border-box; width:32px; height:32px; padding:0; border:0; border-radius:var(--dsw-radius-md); background:transparent; color:var(--dsw-alias-label-primary); font:inherit; cursor:pointer; pointer-events:auto; -webkit-app-region:no-drag; }
      .power-dsh-appearance-seat .power-dsh-appearance-button:hover { background-color:var(--dsw-alias-interactive-bg-hover); }
      .power-dsh-appearance-seat .power-dsh-appearance-button:focus-visible { outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; }
      .power-dsh-appearance-seat .power-dsh-appearance-button:disabled { opacity:.5; cursor:default; }
      .power-dsh-appearance-seat .power-dsh-theme-error { position:fixed; bottom:56px; z-index:6; max-width:240px; padding:8px; border-radius:var(--dsw-radius-md); background:var(--dsw-alias-bg-layer-1); font-size:12px; color:var(--dsw-alias-state-error-primary); }
    `;
    const headerStyles = `
      .power-dsh-header-seat { display:block; width:100%; height:0; }
      .power-dsh-header-seat .power-dsh-header-menu { position:fixed; top:12px; z-index:5; width:28px; height:28px; pointer-events:auto; -webkit-app-region:no-drag; }
      html[data-platform="darwin"] .power-dsh-header-seat .power-dsh-header-menu { top:11px; }
      html[data-windows-titlebar] .power-dsh-header-seat .power-dsh-header-menu { top:calc((var(--dsh-windows-titlebar-height,32px) - 28px) / 2); z-index:1101; }
      .power-dsh-header-seat .power-dsh-header-button { display:flex; align-items:center; justify-content:center; width:28px; height:28px; padding:0; border:0; border-radius:var(--dsw-radius-md); background:transparent; color:var(--dsw-alias-label-secondary); cursor:pointer; -webkit-app-region:no-drag; }
      .power-dsh-header-seat .power-dsh-header-button:is(:hover,[aria-expanded="true"]) { background:var(--dsw-alias-interactive-bg-hover); color:var(--dsw-alias-label-primary); }
      .power-dsh-header-seat .power-dsh-header-button:focus-visible { outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; }
      .power-dsh-header-seat .power-dsh-header-error { position:fixed; top:48px; z-index:6; max-width:240px; padding:8px 12px; border:1px solid var(--dsw-alias-border-l1); border-radius:var(--dsw-radius-md); background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-state-error-primary); font-size:12px; line-height:18px; pointer-events:auto; -webkit-app-region:no-drag; }
      html[data-windows-titlebar] .power-dsh-header-seat .power-dsh-header-error { top:calc(var(--dsh-windows-titlebar-height,32px) + 4px); z-index:1101; }
    `;

    function useHeaderPosition(visible, offset = 0) {
      const [position, setPosition] = React.useState(null);
      const seat = React.useRef(null);
      React.useLayoutEffect(() => {
        if (!visible || !seat.current) return;
        let menu = null;
        // Windows owns its caption menus in the desktop preload, outside the plugin DOM.
        // Read that chrome's outer box only; menu labels and Shadow DOM stay desktop-owned.
        const measure = () => {
          const windows = document.documentElement.hasAttribute('data-windows-titlebar');
          const nextMenu = windows ? document.querySelector('[data-windows-menu]') : null;
          if (menu !== nextMenu) {
            if (menu) observer?.unobserve(menu);
            menu = nextMenu;
            if (menu) observer?.observe(menu);
          }
          const rect = menu?.getBoundingClientRect();
          const next = windows
            ? rect?.width > 0 ? rect.right + 4 : null
            : Math.max(8, seat.current.getBoundingClientRect().right - 60 - offset);
          setPosition(previous => previous === next ? previous : next);
        };
        const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
        observer?.observe(seat.current);
        // The native menu can mount after the sidebar or be recreated by the desktop shell.
        const chromeObserver = typeof MutationObserver === 'function' ? new MutationObserver(measure) : null;
        chromeObserver?.observe(document.body, { childList: true });
        chromeObserver?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-windows-titlebar'] });
        measure();
        window.addEventListener('resize', measure);
        window.visualViewport?.addEventListener('resize', measure);
        return () => {
          observer?.disconnect();
          chromeObserver?.disconnect();
          window.removeEventListener('resize', measure);
          window.visualViewport?.removeEventListener('resize', measure);
        };
      }, [visible, offset]);
      return { seat, position };
    }

    function HeaderActions({ wide, source, t, restartSource, loadRestartStatus, restartApp }) {
      const config = useSnapshot(source);
      const status = useSnapshot(restartSource);
      const ready = wide && config.status === 'ready';
      const refreshVisible = ready && config.value?.showRefreshButton === true;
      const restartRequested = ready && config.value?.showRestartButton === true && isMacDesktop();
      const restartVisible = restartRequested && status.supported;
      const visible = refreshVisible || restartVisible;
      const latestWide = React.useRef(wide);
      latestWide.current = wide;
      const mounted = useMounted();
      React.useEffect(() => {
        if (!restartRequested) return;
        void loadRestartStatus();
        const timer = window.setInterval(loadRestartStatus, 2000);
        return () => window.clearInterval(timer);
      }, [restartRequested]);
      const { seat, position } = useHeaderPosition(visible);
      const [menuOpen, setMenuOpen] = React.useState(false);
      const [confirming, setConfirming] = React.useState(false);
      const [error, setError] = React.useState('');
      const menuRequest = React.useRef(false);
      const confirmation = React.useRef(false);
      const closeMenu = () => {
        menuRequest.current = false;
        setMenuOpen(false);
      };
      const closeConfirmation = () => {
        confirmation.current = false;
        setConfirming(false);
      };
      React.useEffect(() => {
        closeMenu();
        if (!restartVisible || status.running) closeConfirmation();
      }, [refreshVisible, restartVisible, status.running]);
      React.useEffect(() => {
        if (position === null) closeMenu();
      }, [position]);
      const canUse = field => {
        const current = source.getSnapshot();
        return mounted.current && latestWide.current && current.status === 'ready' && current.value?.[field] === true;
      };
      const canRestart = () => {
        const current = restartSource.getSnapshot();
        return canUse('showRestartButton') && isMacDesktop() && current.supported && !current.running;
      };
      const request = confirmation.current;
      const confirmRestart = () => {
        if (!request || confirmation.current !== request || !canRestart()) return;
        closeConfirmation();
        void restartApp();
      };
      const menu = menuRequest.current;
      const select = id => {
        if (!menu || menuRequest.current !== menu || !mounted.current) return;
        closeMenu();
        if (id === 'refresh' && canUse('showRefreshButton')) {
          setError('');
          try { window.location.reload(); }
          catch (_failure) { setError(t('refreshFailed')); }
        } else if (id === 'restart' && canRestart() && !confirmation.current) {
          confirmation.current = {};
          setConfirming(true);
        }
      };
      if (!visible) return null;
      const message = (refreshVisible && error) || (restartVisible && status.error && t(status.error));
      return h('span', { className: 'power-dsh-header-seat', ref: seat },
        h('style', null, headerStyles),
        h('span', { className: 'power-dsh-header-menu',
          style: position === null ? { visibility: 'hidden' } : { left: position },
        }, h(Menu, {
          open: menuOpen && position !== null, onClose: closeMenu, onSelect: select,
          align: 'end', portal: true, autoFocus: true,
          items: [
            ...(refreshVisible ? [{ id: 'refresh', label: t('refresh') }] : []),
            ...(restartVisible ? [{ id: 'restart', label: t('restart'), disabled: status.running }] : []),
          ],
          anchor: h('button', {
            type: 'button', className: 'power-dsh-header-button',
            title: t('moreActions'), 'aria-label': t('moreActions'), 'aria-haspopup': 'menu',
            'aria-expanded': menuOpen && position !== null,
            onClick: event => {
              event.stopPropagation();
              if (position === null || !mounted.current || !latestWide.current || confirmation.current) return;
              if (menuRequest.current) closeMenu();
              else { menuRequest.current = {}; setMenuOpen(true); }
            },
          }, h(NativeIcon, { glyph: 'ellipsis-outline' })),
        })),
        message && h('span', { role: 'alert', className: 'power-dsh-header-error',
          style: position === null ? { visibility: 'hidden' } : { left: Math.max(8, position - 200) },
        }, message),
        h(Modal, {
          open: confirming && restartVisible && !status.running, onClose: closeConfirmation,
          title: t('restart'), closeLabel: t('close'), description: t('restartConfirm'),
          footer: h(React.Fragment, null,
            h(Button, { variant: 'outline', 'data-modal-autofocus': true, onClick: closeConfirmation }, t('cancel')),
            h(Button, { variant: 'primary', disabled: status.running, onClick: confirmRestart }, t('restartAction'))),
        }));
    }

    function isMacDesktop() {
      return window.dshDesktop?.protocolVersion === 1 && window.location.protocol === 'dsh-app:'
        && document.documentElement.getAttribute('data-platform') === 'darwin';
    }

    const themeChoices = [
      { id: 'light', key: 'themeLight', glyph: 'light-outline' },
      { id: 'dark', key: 'themeDark', glyph: 'dark-outline' },
      { id: 'system', key: 'themeSystem', glyph: 'followsystem-outline' },
    ];
    // Reuse the very same sprite symbols as the native Appearance controls.
    function NativeIcon({ glyph, size = 16 }) {
      const id = `dsw-icon-${glyph}-medium`;
      return h('svg', { width: size, height: size, 'data-icon': id, 'aria-hidden': true, focusable: false },
        h('use', { href: `#${id}` }));
    }
    function AppearanceButton({ wide, source, t, themeSource, themeForm, setTheme, footerBusy }) {
      const config = useSnapshot(source);
      const theme = useSnapshot(themeSource);
      const writable = useSnapshot(themeForm);
      const busy = useSnapshot(footerBusy);
      const [error, setError] = React.useState('');
      const [position, setPosition] = React.useState(null);
      const seat = React.useRef(null);
      const visible = wide && !busy && config.status === 'ready' && config.value?.showThemeSwitcher === true && theme !== null;
      React.useLayoutEffect(() => {
        if (!visible || !seat.current) return;
        const measure = () => setPosition(Math.max(0, seat.current.getBoundingClientRect().right - 40));
        measure();
        const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
        observer?.observe(seat.current);
        window.addEventListener('resize', measure);
        window.visualViewport?.addEventListener('resize', measure);
        return () => {
          observer?.disconnect();
          window.removeEventListener('resize', measure);
          window.visualViewport?.removeEventListener('resize', measure);
        };
      }, [visible]);
      if (!visible) return null;
      const currentIndex = themeChoices.findIndex(choice => choice.id === theme.preference);
      const current = themeChoices[currentIndex] || themeChoices[2];
      const next = themeChoices[(currentIndex + 1) % themeChoices.length];
      const title = `${t('appearance')} · ${t(current.key)} · ${t('switchTo')} ${t(next.key)}`;
      // Native connection and update indicators have priority in this shared space.
      return h('span', { className: 'power-dsh-appearance-seat', ref: seat },
        h('style', null, appearanceStyles),
        h('button', {
          type: 'button', className: 'power-dsh-appearance-button', title: error || title,
          style: position === null ? { visibility: 'hidden' } : { left: position },
          'aria-label': title, disabled: writable.status !== 'ready' || !writable.writable,
          onClick: event => {
            event.stopPropagation();
            try { setTheme(next.id); setError(''); }
            catch (failure) { setError(failure?.message || t('saveFailed')); }
          },
        }, h(NativeIcon, { glyph: current.glyph })),
        error && h('span', { className: 'power-dsh-theme-error', role: 'alert',
          style: position === null ? { visibility: 'hidden' } : { left: Math.max(8, position - 208) },
        }, error));
    }

    // Lucide Puzzle, ISC licensed; see docs/third-party-notices.md.
    function Icon({ size = 16 }) {
      return h('svg', {
        viewBox: '0 0 24 24', width: size, height: size,
        fill: 'none', stroke: 'currentColor', strokeWidth: 2,
        strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': true, focusable: false,
      }, h('path', {
        d: 'M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z',
      }));
    }

    function PersonalizationIcon({ size = 16 }) {
      return h('svg', {
        width: size, height: size, viewBox: '0 0 16 16', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round',
        'aria-hidden': true, focusable: false,
      }, h('circle', { cx: 8, cy: 4.5, r: 2.5 }),
      h('path', { d: 'M3 14v-1a5 5 0 0 1 10 0v1' }));
    }

    // Lucide Sparkles, ISC licensed; see docs/third-party-notices.md.
    function SkillsIcon({ size = 16 }) {
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': true, focusable: false,
      }, h('path', { d: 'M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z' }),
      h('path', { d: 'M20 2v4' }),
      h('path', { d: 'M22 4h-4' }),
      h('circle', { cx: 4, cy: 20, r: 2 }));
    }

    // Lucide Cable, ISC licensed; see docs/third-party-notices.md.
    function McpIcon({ size = 16 }) {
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': true, focusable: false,
      }, h('path', { d: 'M17 19a1 1 0 0 1-1-1v-2a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2a1 1 0 0 1-1 1z' }),
      h('path', { d: 'M17 21v-2' }),
      h('path', { d: 'M19 14V6.5a1 1 0 0 0-7 0v11a1 1 0 0 1-7 0V10' }),
      h('path', { d: 'M21 21v-2' }),
      h('path', { d: 'M3 5V3' }),
      h('path', { d: 'M4 10a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2a2 2 0 0 1-2 2z' }),
      h('path', { d: 'M7 5V3' }));
    }

    function observable(getSnapshot) {
      const listeners = new Set();
      return {
        getSnapshot,
        subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
        notify() { for (const listener of listeners) listener(); },
      };
    }
    function useSnapshot(source) {
      return React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
    }
    function useMounted() {
      const mounted = React.useRef(true);
      React.useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
      }, []);
      return mounted;
    }

    // Read native sources in the plugin context; components only receive snapshots and callbacks.
    function notificationRunner(ctx, form, t, reportError, playSound) {
      const records = new Map();
      const visible = new Map();
      let active = true;
      let enabled = false;
      let generation = ctx.connection.generation.getSnapshot();
      function closeAll() {
        for (const notification of visible.values()) {
          notification.onclick = notification.onerror = notification.onclose = null;
          notification.close();
        }
        visible.clear();
      }
      function send(id, row, kind) {
        if (!active || window.Notification?.permission !== 'granted') return;
        try {
          const preferences = form.getSnapshot().value;
          const sound = preferences?.notificationSound || 'default';
          const localTone = preferences?.notificationSoundEnabled === true && sound !== 'default' && ctx.connection.isLoopback;
          const notification = new window.Notification(t(`notification${kind}`), {
            body: (row.displayTitle || row.title || t('notificationBody')).slice(0, 160),
            tag: `power-dsh:${id}`,
            // Omit silent to respect system defaults; a replacement is still a new reminder.
            ...(preferences?.notificationSoundEnabled === true && !localTone ? { renotify: true } : { silent: true }),
          });
          visible.get(id)?.close();
          visible.set(id, notification);
          if (localTone) void playSound(sound, false).catch(() => { if (active) reportError('notificationSoundFailed'); });
          notification.onclick = () => { window.focus(); notification.close(); };
          notification.onclose = () => { if (visible.get(id) === notification) visible.delete(id); };
          notification.onerror = () => {
            if (active) reportError('notificationFailed');
            notification.close();
          };
        } catch (_error) {
          reportError('notificationFailed');
        }
      }
      function run(seed = false) {
        if (!active) return;
        const currentGeneration = ctx.connection.generation.getSnapshot();
        if (generation !== currentGeneration) { generation = currentGeneration; records.clear(); closeAll(); seed = true; }
        if (generation === undefined) { records.clear(); return; }
        const settings = form.getSnapshot();
        const nextEnabled = settings.status === 'ready' && settings.value?.notificationsEnabled === true;
        if (nextEnabled !== enabled) { seed = true; enabled = nextEnabled; if (!enabled) closeAll(); }
        const list = ctx.sessions.list.getSnapshot();
        if (list.phase !== 'ready') { records.clear(); return; }
        const statuses = ctx.uiSession.sessionStatus.getSnapshot();
        for (const id of list.ids) {
          const row = list.byId[id];
          if (row.origin === 'subagent') continue;
          const status = statuses.get(id);
          const pending = status?.pendingInteraction;
          const running = status?.running ?? row.running;
          const outcome = row.projectionValues?.powerDshNotifications;
          const previous = records.get(id);
          const current = previous && !seed ? previous : {
            seq: outcome?.seq, running, attention: false, seen: new Set(pending ? [pending.key] : []),
          };
          if (running && !current.running) current.attention = false;
          const fresh = previous !== undefined && !seed;
          const pendingFresh = pending && !current.seen.has(pending.key);
          if (pending) current.seen.add(pending.key);
          if (fresh && pendingFresh && pending.review === undefined && pending.answerable !== false && running
            && (pending.kind === 'approval' || pending.kind === 'question' || pending.kind === 'plan-review')) {
            current.attention = true;
            if (enabled) send(id, row, pending.kind === 'approval' ? 'Approval' : 'Input');
          }
          const advanced = outcome && current.seq !== undefined && outcome.seq > current.seq;
          if (fresh && advanced && enabled) {
            // A pending question/approval owns the reminder while it awaits an answer.
            if (outcome.reason === 'blocked') {
              if (!pending && !current.attention) send(id, row, 'Input');
            } else if (!pending && (outcome.reason === 'completed' || outcome.reason === 'error')) {
              const inFront = !document.hidden && document.hasFocus() && (row.retainedBy?.mainView ?? 0) > 0;
              if (!inFront) send(id, row, outcome.reason === 'error' ? 'Error' : 'Complete');
            }
          }
          if (advanced) current.seen = new Set(pending ? [pending.key] : []);
          current.seq = outcome?.seq;
          current.running = running;
          records.set(id, current);
        }
        const live = new Set(list.ids);
        for (const id of records.keys()) if (!live.has(id)) {
          records.delete(id);
          visible.get(id)?.close();
          visible.delete(id);
        }
      }
      run(true);
      const offList = ctx.sessions.list.subscribe(() => run());
      const offStatus = ctx.uiSession.sessionStatus.subscribe(() => run());
      const offForm = form.subscribe(() => run());
      const offConnection = ctx.connection.generation.subscribe(() => run(true));
      return () => { active = false; offList(); offStatus(); offForm(); offConnection(); closeAll(); records.clear(); };
    }

    function SettingsPage({ t, source, form, version, setAccountBlocked, setTelemetryBlocked, setTodoBlocked, setSearchBlocked, savePreference, notificationsSource, setNotificationsEnabled, soundsSource, loadSystemSounds, playSystemSound }) {
      const sounds = useSnapshot(soundsSource);
      const [soundMenuOpen, setSoundMenuOpen] = React.useState(false);
      React.useEffect(() => { void loadSystemSounds(); }, []);
      const snapshot = useSnapshot(source);
      React.useEffect(() => {
        if (snapshot.value?.notificationsEnabled !== true) setSoundMenuOpen(false);
      }, [snapshot.value?.notificationsEnabled]);
      const notifications = useSnapshot(notificationsSource);
      const [activeTab, setActiveTab] = React.useState('general');
      const tabRefs = React.useRef({});
      const tabs = [
        { id: 'general', fields: [['showVersion', 'versionDescription'], ['showThemeSwitcher', 'themeSwitcherDescription'], ['showRefreshButton', 'refreshDescription'], ['showRestartButton', 'restartDescription'], ['notificationsEnabled', 'notificationsDescription'], ['notificationSoundEnabled']] },
        { id: 'enhancements', fields: [['personalizationEnabled', 'personalizationDescription'], ['skillManagerEnabled', 'skillManagerDescription'], ['mcpManagerEnabled', 'mcpManagerDescription']] },
        { id: 'simplify', fields: [['blockOfficialAccount', 'blockAccountDescription'], ['blockOfficialSearch', 'blockSearchDescription'], ['blockOfficialTelemetry', 'blockTelemetryDescription'], ['blockTodo', 'blockTodoDescription']] },
      ];
      const [saving, setSaving] = React.useState(null);
      const [error, setError] = React.useState(null);
      const pending = React.useRef(false);
      const mounted = useMounted();
      const id = React.useId();
      const ready = snapshot.status === 'ready';
      const disabled = !ready || !snapshot.writable || Boolean(saving);
      const notice = !ready ? t(snapshot.status === 'loading' ? 'loading' : 'unavailable')
        : !snapshot.writable ? t('readOnly') : !version ? t('versionUnavailable') : null;
      async function save(field, next) {
        if (disabled || pending.current) return;
        if ((field === 'notificationSoundEnabled' || field === 'notificationSound') && source.getSnapshot().value?.notificationsEnabled !== true) return;
        if (field === 'notificationSound' && (sounds.status !== 'ready' || sounds.playing
          || !source.getSnapshot().value?.notificationSoundEnabled || !sounds.value.sounds.some(sound => sound.id === next))) return;
        pending.current = true;
        setSaving({ field, value: next });
        setError(null);
        try {
          if (field === 'blockOfficialAccount') await setAccountBlocked(next);
          else if (field === 'blockOfficialTelemetry') await setTelemetryBlocked(next);
          else if (field === 'blockTodo') await setTodoBlocked(next);
          else if (field === 'blockOfficialSearch') await setSearchBlocked(next);
          else if (field === 'notificationsEnabled') await setNotificationsEnabled(next);
          else if (field === 'notificationSound') {
            if (source.getSnapshot().value?.notificationSound !== next) await savePreference(field, next);
            if (mounted.current) await playSystemSound(next, true);
          }
          else if (field === 'personalizationEnabled' || field === 'skillManagerEnabled' || field === 'mcpManagerEnabled' || field === 'notificationSoundEnabled') await savePreference(field, next);
          else if (!await form.set(field, next)) throw new Error(t('saveFailed'));
        } catch (failure) {
          if (mounted.current && field !== 'personalizationEnabled') setError({ field, message: failure?.message || t('saveFailed') });
        } finally {
          pending.current = false;
          if (mounted.current) setSaving(null);
        }
      }
      function selectTab(tab, focus = false) {
        if (saving || pending.current) return;
        setActiveTab(tab);
        if (focus) tabRefs.current[tab]?.focus();
      }
      function onTabKeyDown(event, index) {
        const nextIndex = { ArrowLeft: (index + tabs.length - 1) % tabs.length, ArrowRight: (index + 1) % tabs.length, Home: 0, End: tabs.length - 1 }[event.key];
        if (nextIndex === undefined) return;
        event.preventDefault();
        selectTab(tabs[nextIndex].id, true);
      }
      const soundName = sound => sound.id === 'default' ? t('notificationSoundDefault')
        : sound.id.startsWith('win:') ? t(`sound${sound.id.slice(4)}`) : sound.name;
      function soundRow() {
        if (snapshot.value?.notificationsEnabled !== true) return null;
        const field = 'notificationSoundEnabled';
        const control = `${id}-${field}`;
        const busy = saving?.field === field;
        const checked = busy ? saving.value : snapshot.value?.[field] === true;
        const soundId = snapshot.value?.notificationSound || 'default';
        const choices = sounds.value?.sounds || [{ id: 'default', name: 'default' }];
        const current = choices.find(sound => sound.id === soundId);
        const soundDisabled = disabled || !snapshot.value?.notificationsEnabled || !snapshot.value?.notificationSoundEnabled
          || sounds.status !== 'ready' || sounds.playing;
        const soundError = error?.field === 'notificationSound' || error?.field === field ? error.message : sounds.error ? t(sounds.error) : '';
        return h(React.Fragment, { key: field },
          h('div', { className: 'power-dsh-setting-row' },
            h('div', { className: 'power-dsh-setting-copy' },
              h('div', { id: `${control}-label`, className: 'power-dsh-setting-label' }, t(field)),
              h('div', { id: `${control}-description`, className: 'power-dsh-description' }, t('notificationSoundDescription')),
              error?.field === field && h('div', { role: 'alert', className: 'power-dsh-error' }, error.message)),
            h('button', {
              id: control, type: 'button', role: 'switch', className: 'power-dsh-switch',
              'aria-checked': checked, 'aria-labelledby': `${control}-label`, 'aria-describedby': `${control}-description`,
              'aria-busy': busy, disabled: disabled || !snapshot.value?.notificationsEnabled,
              onClick: () => { setSoundMenuOpen(false); return save(field, !checked); },
            }, h('span', { className: 'power-dsh-switch-thumb', 'aria-hidden': true }))),
          checked && h('div', { className: 'power-dsh-setting-row' },
            h('div', { className: 'power-dsh-setting-copy' },
              h('div', { id: `${control}-sound-label`, className: 'power-dsh-setting-label' }, t('notificationSound')),
              h('div', { id: `${control}-sound-description`, className: 'power-dsh-description' }, t('notificationToneDescription')),
              soundError && error?.field !== field && h('div', { role: 'alert', className: 'power-dsh-error' }, soundError),
              sounds.status === 'error' && h('button', { type: 'button', className: 'power-dsh-prompt-action', onClick: loadSystemSounds }, t('retry'))),
          h('div', { className: 'power-dsh-sound-controls' },
            h(Menu, {
              open: soundMenuOpen && !soundDisabled, onClose: () => setSoundMenuOpen(false), selectedId: soundId,
              align: 'end', portal: true, autoFocus: true, minWidthFromAnchor: true,
              items: choices.map(sound => ({ id: sound.id, label: soundName(sound) })),
              onSelect: next => { setSoundMenuOpen(false); return save('notificationSound', next); },
              anchor: h('button', {
                type: 'button', className: 'power-dsh-sound-select', disabled: soundDisabled,
                'aria-label': t('notificationSound'), 'aria-describedby': `${control}-sound-description`,
                'aria-haspopup': 'menu', 'aria-expanded': soundMenuOpen && !soundDisabled,
                'aria-busy': sounds.playing || saving?.field === 'notificationSound',
                onClick: () => { if (!soundDisabled) setSoundMenuOpen(value => !value); },
              }, sounds.status === 'remote' ? t('notificationSoundDefault') : current ? soundName(current) : t(sounds.status === 'ready' ? 'notificationSoundMissing' : 'notificationSoundDefault'), h('svg', {
                width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4,
                strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false,
              }, h('path', { d: 'm4 6 4 4 4-4' }))),
            }),
            h('button', {
              type: 'button', className: 'power-dsh-sound-preview', disabled: soundDisabled || !current,
              title: t('notificationSoundPreview'), 'aria-label': t('notificationSoundPreview'), 'aria-busy': sounds.playing,
              onClick: () => { if (!soundDisabled && current) return playSystemSound(soundId, true); },
            }, h('svg', { width: 20, height: 20, viewBox: '0 0 16 16', 'aria-hidden': true, focusable: false },
              h('circle', { cx: 8, cy: 8, r: 6, fill: 'none', stroke: 'currentColor', strokeWidth: 1.3 }),
              h('path', { d: 'm6.5 5 4 3-4 3z', fill: 'currentColor' }))))));
      }
      function row(field, descriptionKey) {
        if (field === 'notificationSoundEnabled') return soundRow();
        const control = `${id}-${field}`;
        const busy = saving?.field === field;
        const checked = busy ? saving.value : snapshot.value?.[field] === true;
        return h('div', { className: 'power-dsh-setting-row', key: field },
          h('div', { className: 'power-dsh-setting-copy' },
            h('div', { id: `${control}-label`, className: 'power-dsh-setting-label' }, t(field)),
            h('div', { id: `${control}-description`, className: 'power-dsh-description' }, t(descriptionKey)),
            (error?.field === field || (field === 'notificationsEnabled' && notifications.error))
              && h('div', { className: 'power-dsh-error', role: 'alert' }, error?.field === field ? error.message : t(notifications.error))),
          h('button', {
            id: control, type: 'button', role: 'switch', className: 'power-dsh-switch',
            'aria-checked': checked,
            'aria-labelledby': `${control}-label`, 'aria-describedby': `${control}-description`,
            'aria-busy': busy, disabled: disabled || (field === 'notificationSoundEnabled' && snapshot.value?.notificationsEnabled !== true),
            onClick: () => save(field, !checked),
          }, h('span', { className: 'power-dsh-switch-thumb', 'aria-hidden': true })));
      }
      return h('section', { className: 'power-dsh-page', 'aria-label': t('title') },
        h('style', null, styles),
        h('header', null,
          h('h2', { className: 'power-dsh-title' }, t('title')),
          h('p', { className: 'power-dsh-description' }, t('description'))),
        h('div', { className: 'power-dsh-tabs', role: 'tablist', 'aria-label': t('title') },
          ...tabs.map((tab, index) => h('button', {
            id: `${id}-tab-${tab.id}`, type: 'button', role: 'tab', className: 'power-dsh-tab',
            ref: element => { tabRefs.current[tab.id] = element; },
            'aria-selected': activeTab === tab.id, 'aria-controls': `${id}-panel-${tab.id}`,
            tabIndex: activeTab === tab.id ? 0 : -1, disabled: Boolean(saving),
            onClick: () => selectTab(tab.id), onKeyDown: event => onTabKeyDown(event, index),
          }, t(`${tab.id}Tab`)))),
        h('div', {
          id: `${id}-panel-${activeTab}`, className: 'power-dsh-fields', role: 'tabpanel',
          'aria-labelledby': `${id}-tab-${activeTab}`,
        }, ...tabs.find(tab => tab.id === activeTab).fields.map(([field, descriptionKey]) => row(field, descriptionKey))),
        notice && h('p', { className: 'power-dsh-description power-dsh-notice', role: 'status' }, notice));
    }

    function PersonalizationPage({ t, source, instructionsSource, loadInstructions, saveInstructions }) {
      const snapshot = useSnapshot(source);
      const instructions = useSnapshot(instructionsSource);
      const settingsPath = instructions.value?.path ?? '';
      const [saving, setSaving] = React.useState(false);
      const [error, setError] = React.useState(null);
      const [draft, setDraft] = React.useState(null);
      const pending = React.useRef(false);
      const mounted = useMounted();
      const id = React.useId();
      const savedPrompt = instructions.value?.text ?? '';
      const prompt = draft?.text ?? savedPrompt;
      const dirty = prompt !== savedPrompt;
      const conflict = draft !== null && draft.base !== instructions.value?.revision && dirty;
      const tooLong = prompt.length > 20000;
      const ready = snapshot.status === 'ready' && instructions.status === 'ready';
      const disabled = !ready || !snapshot.writable || saving || !snapshot.value?.personalizationEnabled;
      const notice = instructions.error || (!ready ? t(instructions.status === 'loading' ? 'loading' : 'unavailable')
        : !snapshot.writable ? t('readOnly') : null);
      React.useEffect(() => {
        void loadInstructions();
        const refresh = () => { void loadInstructions(); };
        window.addEventListener('focus', refresh);
        return () => window.removeEventListener('focus', refresh);
      }, []);
      async function savePrompt() {
        if (disabled || pending.current || conflict || tooLong || !dirty) return;
        pending.current = true;
        setSaving(true);
        setError(null);
        try {
          await saveInstructions(prompt, instructions.value.revision);
          if (mounted.current) setDraft(null);
        } catch (failure) {
          if (mounted.current) setError(failure?.message || t('saveFailed'));
        } finally {
          pending.current = false;
          if (mounted.current) setSaving(false);
        }
      }
      return h('section', { className: 'power-dsh-page', 'aria-label': t('personalizationTab') },
        h('style', null, styles),
        h('header', null,
          h('h2', { className: 'power-dsh-title' }, t('personalizationTab')),
          h('p', { id: `${id}-prompt-description`, className: 'power-dsh-description' },
            settingsPath && t('settingsLocation').replace('{path}', () => settingsPath))),
        h('div', { className: 'power-dsh-prompt-editor' },
            h('textarea', {
              id: `${id}-globalPrompt`, className: 'power-dsh-prompt-input', value: prompt,
              'aria-label': t('globalPrompt'), placeholder: t('globalPromptPlaceholder'), disabled,
              'aria-describedby': `${id}-prompt-description${conflict || tooLong || error ? ` ${id}-prompt-error` : ''}`,
              'aria-invalid': Boolean(conflict || tooLong || error),
              onChange: event => {
                setDraft({ text: event.target.value, base: draft?.base ?? instructions.value?.revision });
                setError(null);
              },
            }),
            (conflict || tooLong || error) && h('p', {
              id: `${id}-prompt-error`, role: 'alert', className: 'power-dsh-error',
            }, conflict ? t('promptConflict') : tooLong ? t('promptTooLong') : error),
            h('div', { className: 'power-dsh-prompt-actions' },
              h('button', {
                type: 'button', className: 'power-dsh-prompt-action', disabled: disabled || draft === null,
                onClick: () => { setDraft(null); setError(null); void loadInstructions(); },
              }, t('cancel')),
              h('button', {
                type: 'button', className: 'power-dsh-prompt-action', 'data-primary': true,
                disabled: disabled || !dirty || conflict || tooLong, 'aria-busy': saving,
                onClick: savePrompt,
              }, t(saving ? 'saving' : 'save')))),
        notice && h('p', { className: 'power-dsh-description power-dsh-notice', role: 'status' }, notice));
    }

    function skillSource(source) {
      if (source === 'user' || source.startsWith('user-')) return 'skillPersonalSource';
      if (source === 'project' || source.startsWith('project-')) return 'skillProjectSource';
      if (source === 'runtime' || source === 'plugin') return 'skillPluginSource';
      if (source === 'custom') return 'skillCustomSource';
      if (source === 'bundled' || source.startsWith('bundled-')) return 'skillBundledSource';
      return source;
    }

    function SkillSearchIcon() {
      return h('svg', { width: 16, height: 16, viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', 'aria-hidden': true },
        h('circle', { cx: 8.5, cy: 8.5, r: 5.5 }), h('path', { d: 'm13 13 4 4' }));
    }
    function SkillChevron() {
      return h('svg', { className: 'power-dsh-skill-chevron', width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, h('path', { d: 'm4 6 4 4 4-4' }));
    }

    function SkillsPage({ t, source, skillsSource, loadSkills, setSkillEnabled }) {
      const config = useSnapshot(source);
      const snapshot = useSnapshot(skillsSource);
      const catalog = snapshot.value;
      const scope = snapshot.scope || 'user';
      const scopeTabs = React.useRef({});
      const [projectMenuOpen, setProjectMenuOpen] = React.useState(false);
      const [query, setQuery] = React.useState('');
      const [error, setError] = React.useState(null);
      const [groupsOpen, setGroupsOpen] = React.useState({ preinstalled: false, personal: true });
      const mounted = useMounted();
      const pending = React.useRef(false);
      const id = React.useId();
      const busy = snapshot.status === 'loading' || Boolean(snapshot.saving);
      React.useEffect(() => { setProjectMenuOpen(false); }, [scope, busy]);
      const writable = config.status === 'ready' && config.writable && config.value?.skillManagerEnabled === true;
      const disabled = busy || !writable || snapshot.status !== 'ready' || !catalog?.complete;
      React.useEffect(() => {
        void loadSkills();
        const refresh = () => { void loadSkills(); };
        window.addEventListener('focus', refresh);
        return () => window.removeEventListener('focus', refresh);
      }, []);
      const sourceLabel = value => ['skillPersonalSource', 'skillProjectSource', 'skillPluginSource', 'skillCustomSource', 'skillBundledSource'].includes(value) ? t(value) : value;
      const displaySource = skill => scope === 'user'
        ? ['runtime', 'plugin', 'bundled'].includes(skill.source) || skill.source.startsWith('bundled-') ? 'skillBundledSource' : 'skillPersonalSource'
        : skillSource(skill.source);
      const needle = query.trim().toLocaleLowerCase();
      const rows = (catalog?.skills ?? []).filter(skill =>
        `${skill.name} ${skill.description} ${skill.origin} ${sourceLabel(displaySource(skill))}`.toLocaleLowerCase().includes(needle));
      function changeScope(next) {
        if (busy || pending.current || scope === next) return;
        setError(null);
        return loadSkills('', next);
      }
      function scopeTab(value, label) {
        return h('button', {
          id: `${id}-scope-${value}`, type: 'button', role: 'tab', className: 'power-dsh-tab',
          ref: element => { scopeTabs.current[value] = element; },
          'aria-selected': scope === value, 'aria-controls': `${id}-skill-panel`,
          tabIndex: scope === value ? 0 : -1, disabled: busy,
          onClick: () => changeScope(value),
          onKeyDown: event => {
            const next = event.key === 'Home' ? 'user' : event.key === 'End' ? 'project'
              : event.key === 'ArrowLeft' || event.key === 'ArrowRight' ? value === 'user' ? 'project' : 'user' : null;
            if (!next || busy || pending.current) return;
            event.preventDefault();
            changeScope(next);
            scopeTabs.current[next]?.focus();
          },
        }, t(label));
      }
      const projectWorkspaces = catalog?.workspaces ?? snapshot.workspaces;
      const projectContext = () => {
        if (scope !== 'project') return null;
        const cwd = catalog?.cwd || snapshot.cwd;
        const values = projectWorkspaces ?? [];
        const selected = values.some(project => project.path === cwd) ? cwd : '';
        const current = values.find(project => project.path === selected);
        return h(Menu, {
          open: projectMenuOpen && !busy && values.length > 0,
          align: 'end', portal: true, autoFocus: true, minWidthFromAnchor: true, className: 'power-dsh-project-menu',
          selectedId: selected || undefined,
          items: values.map(project => ({
            id: project.path,
            label: h('span', { title: project.path }, values.some(other => other.path !== project.path && other.title === project.title)
              ? `${project.title} (${project.path})` : project.title),
          })),
          onClose: () => setProjectMenuOpen(false),
          onSelect: path => {
            setProjectMenuOpen(false);
            const latest = skillsSource.getSnapshot();
            const projects = latest.value?.workspaces ?? latest.workspaces ?? [];
            if (latest.scope !== 'project' || latest.status === 'loading' || latest.saving || pending.current
              || !projects.some(project => project.path === path) || path === latest.cwd) return;
            setError(null);
            return loadSkills(path, 'project');
          },
          anchor: h('button', {
            type: 'button', className: 'power-dsh-project-trigger', disabled: busy || values.length === 0,
            title: current?.path, 'aria-label': t('skillWorkspace'), 'aria-haspopup': 'menu',
            'aria-expanded': projectMenuOpen && !busy && values.length > 0,
            onClick: () => {
              const latest = skillsSource.getSnapshot();
              if (latest.scope !== 'project' || latest.status === 'loading' || latest.saving || pending.current
                || !(latest.value?.workspaces ?? latest.workspaces ?? []).length) return;
              setProjectMenuOpen(open => !open);
            },
          }, h('span', { className: 'power-dsh-project-trigger-label' }, current?.title || t(values.length ? 'skillWorkspace' : 'skillNoProjects')),
          h('svg', { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, h('path', { d: 'm4 6 4 4 4-4' }))),
        });
      };
      async function toggle(skill) {
        const latest = skillsSource.getSnapshot();
        if (disabled || pending.current || !skill.canToggle || skill.reason || latest.scope !== scope || latest.cwd !== catalog?.cwd) return;
        pending.current = true;
        setError(null);
        try {
          await setSkillEnabled(skill.name, !skill.enabled);
        } catch (failure) {
          if (mounted.current) setError({ name: skill.name, message: failure?.message || t('skillSaveFailed') });
        } finally {
          pending.current = false;
        }
      }
      // Adapted from DSH PluginCard (MIT); see docs/third-party-notices.md.
      const renderCard = skill => {
        const index = catalog.skills.indexOf(skill);
        const control = `${id}-skill-${index}`;
        const identity = JSON.stringify([scope, catalog.cwd, skill.name]);
        const reasonKey = { 'source-disabled': 'skillSourceDisabled', incomplete: 'skillIncomplete', unsupported: 'skillUnsupported', 'legacy-scope': 'skillLegacyScope' }[skill.reason];
        const reason = reasonKey ? t(reasonKey) : skill.reason || !skill.canToggle ? t('skillUnavailable') : '';
        return h('li', { key: identity, className: 'power-dsh-skill-card', 'data-skill': skill.name },
          h('div', { className: 'power-dsh-skill-card-content' },
            h('div', { className: 'power-dsh-skill-card-main' },
              h('span', { id: `${control}-name`, className: 'power-dsh-skill-card-title', title: skill.path || skill.name }, skill.name),
              h('button', {
                id: control, type: 'button', role: 'switch', className: 'power-dsh-switch',
                'aria-checked': skill.enabled, 'aria-labelledby': `${control}-name`,
                'aria-describedby': [skill.description && `${control}-description`, reason && `${control}-reason`, error?.name === skill.name && `${control}-error`].filter(Boolean).join(' ') || undefined,
                'aria-busy': snapshot.saving?.name === skill.name,
                disabled: Boolean(disabled || !skill.canToggle || skill.reason), onClick: () => toggle(skill),
              }, h('span', { className: 'power-dsh-switch-thumb', 'aria-hidden': true }))),
            skill.description && h(Tooltip, { label: skill.description, side: 'top', portal: true, delayMs: 0, maxWidth: 400 },
              h('span', { id: `${control}-description`, className: 'power-dsh-skill-card-description', tabIndex: 0 }, skill.description)),
            reason && h('p', { id: `${control}-reason`, className: 'power-dsh-skill-reason' }, reason),
            error?.name === skill.name && h('p', { id: `${control}-error`, className: 'power-dsh-error', role: 'alert' }, error.message),
            skill.origin && h('div', { className: 'power-dsh-skill-card-meta' },
              h(Tooltip, { label: skill.origin.startsWith('.') ? skill.path || skill.origin : skill.origin, side: 'top', portal: true, delayMs: 0, maxWidth: 400 },
                h('span', { className: 'power-dsh-skill-origin', tabIndex: 0 }, skill.origin)))));
      };
      const renderGroup = (group, label, selectedRows) => {
        if (selectedRows.length === 0) return null;
        const open = Boolean(needle) || groupsOpen[group];
        const titleId = `${id}-group-${group}`;
        return h('section', { key: group, className: 'power-dsh-skill-group', 'aria-labelledby': titleId },
          h('div', { className: 'power-dsh-skill-group-header' },
            h('button', {
              id: titleId, type: 'button', className: 'power-dsh-skill-group-toggle',
              'aria-expanded': open, 'aria-controls': `${titleId}-body`,
              onClick: () => { if (!needle) setGroupsOpen(current => ({ ...current, [group]: !current[group] })); },
            }, h(SkillChevron), h('span', { className: 'power-dsh-skill-group-title' }, t(label)))),
          h('p', { className: 'power-dsh-skill-group-description' }, t(group === 'preinstalled' ? 'skillPreinstalledDescription' : 'skillPersonalDescription')),
          open && h('div', { id: `${titleId}-body`, className: 'power-dsh-skill-group-body' },
            h('ul', { className: 'power-dsh-skill-cards' }, selectedRows.map(renderCard))));
      };
      return h('section', { className: 'power-dsh-page power-dsh-skills-page', 'aria-label': t('skillsTab') },
        h('style', null, styles),
        h('header', null,
          h('h2', { className: 'power-dsh-title' }, t('skillsTab')),
          h('p', { className: 'power-dsh-description' }, t('skillsDescription'))),
        h('div', { className: 'power-dsh-skill-navigation' },
          h('div', { className: 'power-dsh-tabs', role: 'tablist', 'aria-label': t('skillScope') },
            scopeTab('user', 'skillUserScope'), scopeTab('project', 'skillProjectScope'))),
        h('div', { id: `${id}-skill-panel`, className: 'power-dsh-skill-panel', role: 'tabpanel', 'aria-labelledby': `${id}-scope-${scope}` },
        h('div', { className: scope === 'project' ? 'power-dsh-project-search-row' : 'power-dsh-global-search-row' },
          scope === 'project' && projectContext(),
          catalog && h('label', { className: 'power-dsh-skill-search-field' }, h(SkillSearchIcon), h('input', {
            type: 'search', value: query, placeholder: t('skillSearch'), 'aria-label': t('skillSearch'),
            onChange: event => setQuery(event.target.value),
          }))),
        snapshot.status === 'loading' && h('p', { className: 'power-dsh-description power-dsh-skill-notice', role: 'status' }, t('loading')),
        snapshot.error && h('div', { className: 'power-dsh-skill-notice', role: 'alert' },
          h('p', { className: 'power-dsh-error' }, snapshot.error),
          h('button', { type: 'button', className: 'power-dsh-prompt-action', disabled: busy, onClick: () => loadSkills() }, t('retry'))),
        catalog && !catalog.complete && h('p', { className: 'power-dsh-description power-dsh-skill-notice', role: 'status' }, t('skillIncomplete')),
        config.status === 'ready' && !config.writable && h('p', { className: 'power-dsh-description power-dsh-skill-notice' }, t('readOnly')),
        catalog && (scope === 'project' ? h('ul', { className: 'power-dsh-skill-cards' }, rows.map(renderCard))
          : [renderGroup('personal', 'skillPersonalGroup', rows.filter(skill => displaySource(skill) !== 'skillBundledSource')),
            renderGroup('preinstalled', 'skillPreinstalledGroup', rows.filter(skill => displaySource(skill) === 'skillBundledSource'))]),
        catalog && snapshot.status === 'ready' && catalog.complete && rows.length === 0
          && h('p', { className: 'power-dsh-skill-empty' }, t(scope === 'project' && projectWorkspaces?.length === 0 ? 'skillNoProjects' : query ? 'skillNoMatches' : 'skillEmpty'))));
    }

    function canChangeMcp(server) {
      return server?.stateKnown && server.canToggle
        && ['profile', 'manager'].includes(server.source) && !server.reason;
    }

    function McpPage({ t, source, mcpSource, loadMcpServers, setMcpServerEnabled }) {
      const config = useSnapshot(source);
      const snapshot = useSnapshot(mcpSource);
      const catalog = snapshot.value;
      const [query, setQuery] = React.useState('');
      const [groupsOpen, setGroupsOpen] = React.useState({ user: true, builtin: false });
      const [expandedServers, setExpandedServers] = React.useState(() => new Set());
      const [error, setError] = React.useState(null);
      const mounted = useMounted();
      const pending = React.useRef(false);
      const id = React.useId();
      const busy = snapshot.status === 'loading' || Boolean(snapshot.saving);
      const writable = config.status === 'ready' && config.writable && config.value?.mcpManagerEnabled === true;
      const disabled = busy || !writable || snapshot.status !== 'ready' || !catalog?.complete;
      React.useEffect(() => {
        void loadMcpServers();
        const refresh = () => { void loadMcpServers(); };
        const timer = window.setInterval(() => {
          const latest = mcpSource.getSnapshot();
          if (!document.hidden && latest.status === 'ready' && !latest.saving) return loadMcpServers(true);
        }, 2000);
        window.addEventListener('focus', refresh);
        return () => {
          window.clearInterval(timer);
          window.removeEventListener('focus', refresh);
        };
      }, []);
      const safeSourceLabel = value => ({ profile: t('mcpProfileSource'), plugin: t('mcpPluginSource'), manager: t('mcpManagerSource') })[value] || value;
      const typeLabel = transport => ({ stdio: t('mcpLocalType'), 'streamable-http': t('mcpHttpType') })[transport] || '';
      const groupLabel = group => t(group === 'builtin' ? 'skillPreinstalledGroup' : 'skillPersonalGroup');
      const needle = query.trim().toLocaleLowerCase();
      const rows = (catalog?.servers ?? []).filter(server =>
        `${server.name} ${server.tools.join(' ')} ${server.origin} ${server.source} ${safeSourceLabel(server.source)} ${groupLabel(server.group)} ${typeLabel(server.transport)}`.toLocaleLowerCase().includes(needle));
      function contextAvailable() {
        const latest = mcpSource.getSnapshot();
        const config = source.getSnapshot();
        return mounted.current && !pending.current && latest.status !== 'loading' && !latest.saving
          && latest.value === catalog
          && config.status === 'ready' && config.value?.mcpManagerEnabled === true;
      }
      async function toggle(server) {
        if (disabled || !contextAvailable() || !canChangeMcp(server)) return;
        pending.current = true;
        setError(null);
        try {
          await setMcpServerEnabled(server.id, !server.enabled);
        } catch (failure) {
          if (mounted.current) setError({ id: server.id, message: failure?.message || t('mcpChangeFailed') });
        } finally {
          pending.current = false;
        }
      }
      const renderCard = server => {
        const transportLabel = typeLabel(server.transport);
        const off = server.stateKnown && !server.enabled;
        const displayState = off ? 'disabled' : server.runtimeState;
        const runtimeLabel = { pending: 'mcpRuntimePending', loading: 'mcpRuntimeLoading', active: 'mcpRuntimeActive',
          failed: 'mcpRuntimeFailed', unloading: 'mcpRuntimeUnloading', inactive: 'mcpRuntimeInactive', disabled: 'mcpDisabled' }[displayState];
        const transitioning = ['pending', 'loading', 'unloading'].includes(displayState);
        const expandable = !off && server.tools.length > 0;
        const expanded = expandable && expandedServers.has(server.id);
        const summary = server.tools.length === 1 ? t('mcpSingleTool')
          : server.tools.length ? t('mcpToolCount').replace('{count}', () => String(server.tools.length)) : t('mcpNoTools');
        const control = `${id}-mcp-${catalog.servers.indexOf(server)}`;
        const reasonKey = { 'preset-managed': 'mcpPresetManaged', 'plugin-managed': 'mcpPluginManaged', 'manager-managed': 'mcpManagerManaged', conditional: 'mcpConditional', unaddressable: 'mcpUnaddressable', 'management-required': 'mcpManagementRequired' }[server.reason];
        const reason = !server.stateKnown ? t('mcpStateUnknown') : reasonKey ? t(reasonKey)
          : !canChangeMcp(server) ? t('mcpReadOnly') : '';
        const describedBy = [reason && `${control}-reason`, error?.id === server.id && `${control}-error`].filter(Boolean).join(' ') || undefined;
        const toggleExpanded = () => {
          const latest = mcpSource.getSnapshot().value?.servers.find(item => item.id === server.id);
          if (!mounted.current || !latest || (latest.stateKnown && !latest.enabled) || latest.tools.length === 0) return;
          setExpandedServers(current => {
            const next = new Set(current);
            if (next.has(server.id)) next.delete(server.id); else next.add(server.id);
            return next;
          });
        };
        return h('li', { key: server.id, className: 'power-dsh-skill-card', 'data-mcp': server.id, 'data-open': expanded, 'aria-labelledby': `${control}-name`, 'aria-describedby': describedBy },
          h('div', { className: 'power-dsh-skill-card-content', 'data-expandable': expandable, onClick: expandable ? event => {
            if (event.defaultPrevented || event.target?.closest?.('button, a, input, select, textarea, [role="switch"]')) return;
            toggleExpanded();
          } : undefined },
            h('div', { className: 'power-dsh-skill-card-main' },
              h(Tooltip, { label: server.name, side: 'top', portal: true, delayMs: 0, maxWidth: 400 },
                h('span', { id: `${control}-name`, className: 'power-dsh-skill-card-title', tabIndex: 0, 'aria-describedby': describedBy }, server.name)),
              server.stateKnown ? h('button', {
                id: control, type: 'button', role: 'switch', className: 'power-dsh-switch',
                'aria-checked': server.enabled, 'aria-labelledby': `${control}-name`,
                'aria-describedby': describedBy, 'aria-busy': snapshot.saving?.id === server.id,
                disabled: Boolean(disabled || !canChangeMcp(server)),
                onClick: () => toggle(server),
              }, h('span', { className: 'power-dsh-switch-thumb', 'aria-hidden': true }))
                : h('span', { className: 'power-dsh-description', 'aria-hidden': true }, '—')),
            (transportLabel || runtimeLabel) && h('div', { className: 'power-dsh-mcp-card-meta' },
              transportLabel && h('span', { id: `${control}-transport`, className: 'power-dsh-mcp-transport', 'data-transport': server.transport }, transportLabel),
              runtimeLabel && h('span', { className: 'power-dsh-mcp-runtime', 'data-state': displayState, role: 'status',
                'aria-label': transitioning ? t(runtimeLabel) : undefined },
                h(StateDot, { state: transitioning ? 'ongoing' : { active: 'done', failed: 'error', inactive: 'idle', disabled: 'idle' }[displayState] }),
                !transitioning && t(runtimeLabel))),
            expandable ? h('button', {
              type: 'button', className: 'power-dsh-mcp-card-toggle',
              'aria-expanded': expanded, 'aria-controls': `${control}-tools`,
              'aria-labelledby': `${control}-name ${control}-summary`, 'aria-describedby': describedBy,
              onClick: toggleExpanded,
            }, h('span', { id: `${control}-summary`, className: 'power-dsh-mcp-tools-summary' }, summary), h(SkillChevron))
              : h('div', { className: 'power-dsh-mcp-card-placeholder', 'data-state': off ? 'disabled' : 'empty' }, t(off ? 'mcpNoAvailableTools' : 'mcpNoTools')),
            reason && h('p', { id: `${control}-reason`, className: 'power-dsh-skill-reason' }, reason),
            error?.id === server.id && h('p', { id: `${control}-error`, className: 'power-dsh-error', role: 'alert' }, error.message)),
          expandable && h('div', { id: `${control}-tools`, className: 'power-dsh-mcp-tools', hidden: !expanded, role: 'region', 'aria-labelledby': `${control}-name` },
            expanded && (server.tools.length
              ? h('ul', { 'aria-label': t('mcpTools') }, server.tools.map(tool => h('li', { key: tool, className: 'power-dsh-mcp-tool-name' }, tool)))
              : h('p', null, t('mcpNoTools')))));

      };
      const renderGroup = group => {
        const selectedRows = rows.filter(server => server.group === group);
        if (selectedRows.length === 0) return null;
        const open = Boolean(needle) || groupsOpen[group];
        const titleId = `${id}-mcp-group-${group}`;
        return h('section', { key: group, className: 'power-dsh-skill-group', 'aria-labelledby': titleId },
          h('div', { className: 'power-dsh-skill-group-header' },
            h('button', {
              id: titleId, type: 'button', className: 'power-dsh-skill-group-toggle',
              'aria-expanded': open, 'aria-controls': `${titleId}-body`,
              onClick: () => { if (!needle) setGroupsOpen(current => ({ ...current, [group]: !current[group] })); },
            }, h(SkillChevron), h('span', { className: 'power-dsh-skill-group-title' }, groupLabel(group)))),
          h('p', { className: 'power-dsh-skill-group-description' }, t(group === 'builtin' ? 'mcpPreinstalledDescription' : 'mcpPersonalDescription')),
          open && h('div', { id: `${titleId}-body`, className: 'power-dsh-skill-group-body' },
            h('ul', { className: 'power-dsh-skill-cards' }, selectedRows.map(renderCard))));
      };
      return h('section', { className: 'power-dsh-page power-dsh-mcp-page', 'aria-label': t('mcpTab') },
        h('style', null, styles),
        h('header', null,
          h('h2', { className: 'power-dsh-title' }, t('mcpTab')),
          h('p', { className: 'power-dsh-description' }, t('mcpDescription'))),
        h('div', { className: 'power-dsh-skill-panel' },
        h('div', { className: 'power-dsh-global-search-row' },
        catalog && h('label', { className: 'power-dsh-skill-search-field' }, h(SkillSearchIcon), h('input', {
          type: 'search', value: query, disabled: busy,
          placeholder: t('mcpSearch'), 'aria-label': t('mcpSearch'),
          onChange: event => { if (contextAvailable()) setQuery(event.target.value); },
        }))),
        snapshot.status === 'loading' && h('p', { className: 'power-dsh-description power-dsh-skill-notice', role: 'status' }, t('loading')),
        snapshot.error && h('div', { className: 'power-dsh-skill-notice', role: 'alert' },
          h('p', { className: 'power-dsh-error' }, snapshot.error),
          h('button', { type: 'button', className: 'power-dsh-prompt-action', disabled: busy, onClick: () => loadMcpServers() }, t('retry'))),
        catalog && !catalog.complete && h('p', { className: 'power-dsh-description power-dsh-skill-notice', role: 'status' }, t('mcpIncomplete')),
        config.status === 'ready' && !config.writable && h('p', { className: 'power-dsh-description power-dsh-skill-notice' }, t('readOnly')),
        error && !catalog?.servers.some(server => server.id === error.id)
          && h('p', { className: 'power-dsh-error power-dsh-skill-notice', role: 'alert' }, error.message),
        catalog && ['user', 'builtin'].map(renderGroup),
        catalog && snapshot.status === 'ready' && catalog.complete && rows.length === 0
          && h('p', { className: 'power-dsh-skill-empty' }, t(query ? 'mcpNoMatches' : 'mcpEmpty'))));
    }

    function VersionBadge({ wide, t, source, version }) {
      const snapshot = useSnapshot(source);
      const visible = wide && snapshot.status === 'ready' && snapshot.value?.showVersion === true && Boolean(version);
      const seat = React.useRef(null);
      const [available, setAvailable] = React.useState(64);
      const [busy, setBusy] = React.useState(false);
      const [error, setError] = React.useState('');
      const pending = React.useRef(false);
      const mounted = useMounted();
      React.useEffect(() => {
        if (!visible || !seat.current) return;
        const element = seat.current;
        const measure = () => setAvailable(Math.max(0, element.getBoundingClientRect().right - 209));
        measure();
        if (typeof ResizeObserver !== 'function') return;
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        return () => observer.disconnect();
      }, [visible]);
      if (!visible) return null;
      const updates = window.dshDesktop?.protocolVersion === 1 ? window.dshDesktop.updates : undefined;
      const canUpdate = typeof updates?.open === 'function';
      const title = error || t(busy ? 'updating' : canUpdate ? 'openUpdate' : 'desktopOnly');
      async function openUpdate() {
        if (!canUpdate || pending.current) return;
        pending.current = true;
        setBusy(true);
        setError('');
        try {
          // User approved this native flow, including downloads and native install confirmation.
          await updates.open();
        } catch (failure) {
          if (mounted.current) setError(failure?.message || t('updateFailed'));
        } finally {
          pending.current = false;
          if (mounted.current) setBusy(false);
        }
      }
      return h('span', { className: 'power-dsh-version-seat', ref: seat },
        h('style', null, badgeStyles),
        h('button', {
          type: 'button', className: 'power-dsh-version-badge',
          style: { maxWidth: `${available}px` }, title,
          'aria-label': `DSH ${version} · ${title}`, 'aria-busy': busy,
          disabled: !canUpdate || busy, onClick: openUpdate,
        }, version.replace(/^v/, '')),
        error && h('span', { className: 'power-dsh-version-error', role: 'alert' }, error));
    }

    return {
      inject: ['slots', 'locale', 'configForms', 'remote', 'typert'],
      async apply(ctx) {
        // Explicit strict contract matching the Host-owned policy operation.
        await ctx.remote.$mount({
          package: 'power-dsh',
          descriptors: [{
            id: 'power-dsh#powerDsh/restartStatus', service: 'powerDsh', namespace: 'powerDsh', method: 'restartStatus',
            invocation: { kind: 'direct' }, parameters: [],
            result: { mode: 'strict', typeSymbol: 'power-dsh#RestartStatus', create: () => ({ parse(value) {
              if (!value || typeof value.supported !== 'boolean' || typeof value.running !== 'boolean'
                || !['', 'restartFailed'].includes(value.error)) throw new TypeError('Invalid restart status');
              return { supported: value.supported, running: value.running, error: value.error };
            } }) },
          }, {
            id: 'power-dsh#powerDsh/restartApp', service: 'powerDsh', namespace: 'powerDsh', method: 'restartApp',
            invocation: { kind: 'direct' }, parameters: [],
            result: { mode: 'strict', typeSymbol: 'power-dsh#RestartAccepted', create: () => ({ parse(value) {
              if (!value || value.accepted !== true) throw new TypeError('Invalid restart acceptance');
              return { accepted: true };
            } }) },
          }, {
            id: 'power-dsh#powerDsh/listSystemSounds', service: 'powerDsh', namespace: 'powerDsh', method: 'listSystemSounds',
            invocation: { kind: 'direct' }, parameters: [],
            result: { mode: 'strict', typeSymbol: 'power-dsh#SystemSounds', create: () => ({ parse(value) {
              if (!value || !['darwin', 'win32', 'other'].includes(value.platform) || !Array.isArray(value.sounds)
                || value.sounds.some(row => !row || typeof row.id !== 'string' || typeof row.name !== 'string')) throw new TypeError('Invalid system sounds');
              return { platform: value.platform, sounds: value.sounds.map(row => ({ id: row.id, name: row.name })) };
            } }) },
          }, {
            id: 'power-dsh#powerDsh/playSystemSound', service: 'powerDsh', namespace: 'powerDsh', method: 'playSystemSound',
            invocation: { kind: 'direct' },
            parameters: [
              { name: 'id', wire: 'id', source: 'json', codec: { mode: 'strict', typeSymbol: 'string', create: () => ({ parse(value) {
                if (typeof value !== 'string') throw new TypeError('Expected a string');
                return value;
              } }) } },
              { name: 'preview', wire: 'preview', source: 'json', codec: { mode: 'strict', typeSymbol: 'boolean', create: () => ({ parse(value) {
                if (typeof value !== 'boolean') throw new TypeError('Expected a boolean');
                return value;
              } }) } },
            ],
            result: { mode: 'strict', typeSymbol: 'power-dsh#SoundPlayback', create: () => ({ parse(value) {
              if (!value || typeof value.played !== 'boolean') throw new TypeError('Invalid sound playback');
              return { played: value.played };
            } }) },
          }, ...[
            ['setAccountBlocked', 'AccountPolicyResult'],
            ['setTelemetryBlocked', 'TelemetryPolicyResult'],
            ['setTodoBlocked', 'TodoPolicyResult'],
            ['setSearchBlocked', 'SearchPolicyResult'],
          ].map(([method, resultType]) => ({
            id: `power-dsh#powerDsh/${method}`,
            service: 'powerDsh', namespace: 'powerDsh', method,
            invocation: { kind: 'direct' },
            parameters: [{ name: 'blocked', wire: 'blocked', source: 'json', codec: {
              mode: 'strict', typeSymbol: 'boolean', create: () => ({ parse(value) {
                if (typeof value !== 'boolean') throw new TypeError('blocked must be boolean');
                return value;
              } }),
            } }],
            result: { mode: 'strict', typeSymbol: `power-dsh#${resultType}`, create: () => ({ parse(value) {
              if (!value || typeof value.blocked !== 'boolean') throw new TypeError('Invalid policy result');
              return { blocked: value.blocked };
            } }) },
          })), ...['readPersonalization', 'savePersonalization'].map(method => ({
            id: `power-dsh#powerDsh/${method}`,
            service: 'powerDsh', namespace: 'powerDsh', method,
            invocation: { kind: 'direct' },
            parameters: (method === 'readPersonalization' ? [] : ['text', 'revision']).map(name => ({
              name, wire: name, source: 'json', codec: {
                mode: 'strict', typeSymbol: 'string',
                create: () => ({ parse(value) {
                  if (typeof value !== 'string') throw new TypeError('Expected a string');
                  return value;
                } }),
              },
            })),
            result: {
              mode: 'strict', typeSymbol: 'power-dsh#PersonalizationFile',
              create: () => ({ parse(value) {
                if (!value || typeof value.path !== 'string' || typeof value.text !== 'string'
                  || typeof value.revision !== 'string' || !/^[a-f\d]{64}$/.test(value.revision)) throw new TypeError('Invalid instruction file');
                return { path: value.path, text: value.text, revision: value.revision };
              } }),
            },
          })), ...['listSkills', 'setSkillEnabled'].map(method => ({
            id: `power-dsh#powerDsh/${method}`,
            service: 'powerDsh', namespace: 'powerDsh', method,
            invocation: { kind: 'direct' },
            parameters: (method === 'listSkills' ? ['cwd', 'scope'] : ['cwd', 'scope', 'name', 'enabled']).map(name => ({
              name, wire: name, source: 'json', codec: {
                mode: 'strict', typeSymbol: name === 'enabled' ? 'boolean' : 'string',
                create: () => ({ parse(value) {
                  if (typeof value !== (name === 'enabled' ? 'boolean' : 'string')) throw new TypeError(name === 'enabled' ? 'Expected a boolean' : 'Expected a string');
                  return value;
                } }),
              },
            })),
            result: {
              mode: 'strict', typeSymbol: 'power-dsh#SkillCatalog',
              create: () => ({ parse(value) {
                if (!value || typeof value.cwd !== 'string' || !['user', 'project'].includes(value.scope)
                  || !Array.isArray(value.workspaces) || value.workspaces.some(project => !project || typeof project.path !== 'string' || typeof project.title !== 'string')
                  || typeof value.complete !== 'boolean' || !Array.isArray(value.skills)) throw new TypeError('Invalid skill catalog');
                return {
                  cwd: value.cwd, scope: value.scope, workspaces: value.workspaces.map(project => ({ path: project.path, title: project.title })), complete: value.complete,
                  skills: value.skills.map(skill => {
                    if (!skill || ['name', 'description', 'source', 'origin', 'path', 'reason'].some(key => typeof skill[key] !== 'string')
                      || ['enabled', 'modelInvocable', 'userInvocable', 'canToggle'].some(key => typeof skill[key] !== 'boolean')
                      || skill.enabled !== (skill.modelInvocable || skill.userInvocable)) throw new TypeError('Invalid skill entry');
                    return {
                      name: skill.name, description: skill.description, source: skill.source, origin: skill.origin, path: skill.path,
                      enabled: skill.enabled, modelInvocable: skill.modelInvocable, userInvocable: skill.userInvocable,
                      canToggle: skill.canToggle, reason: skill.reason,
                    };
                  }),
                };
              } }),
            },
          })), ...['listMcpServers', 'setMcpServerEnabled'].map(method => ({
            id: `power-dsh#powerDsh/${method}`,
            service: 'powerDsh', namespace: 'powerDsh', method,
            invocation: { kind: 'direct' },
            parameters: (method === 'listMcpServers' ? [] : ['id', 'enabled']).map(name => ({
              name, wire: name, source: 'json', codec: {
                mode: 'strict', typeSymbol: name === 'enabled' ? 'boolean' : 'string',
                create: () => ({ parse(value) {
                  if (typeof value !== (name === 'enabled' ? 'boolean' : 'string')) throw new TypeError(name === 'enabled' ? 'Expected a boolean' : 'Expected a string');
                  return value;
                } }),
              },
            })),
            result: {
              mode: 'strict', typeSymbol: 'power-dsh#McpCatalog',
              create: () => ({ parse(value) {
                if (!value || typeof value.complete !== 'boolean' || !Array.isArray(value.servers)) throw new TypeError('Invalid MCP catalog');
                return {
                  complete: value.complete,
                  servers: value.servers.map(server => {
                    if (!server || ['id', 'name', 'source', 'origin', 'reason'].some(key => typeof server[key] !== 'string')
                      || !Array.isArray(server.tools) || server.tools.some(tool => typeof tool !== 'string')
                      || !['user', 'builtin'].includes(server.group)
                      || !['stdio', 'streamable-http', 'unknown'].includes(server.transport)
                      || !['pending', 'loading', 'active', 'failed', 'unloading', 'inactive', 'disabled', 'unknown'].includes(server.runtimeState)
                      || ['enabled', 'stateKnown', 'canToggle'].some(key => typeof server[key] !== 'boolean')) throw new TypeError('Invalid MCP entry');
                    return {
                      id: server.id, name: server.name, tools: server.tools.slice(), source: server.source, origin: server.origin, group: server.group, enabled: server.enabled,
                      stateKnown: server.stateKnown, runtimeState: server.runtimeState, transport: server.transport, canToggle: server.canToggle, reason: server.reason,
                    };
                  }),
                };
              } }),
            },
          }))],
        });
        // Mount creates the namespace first; the child then declares its dependency.
        // Injecting it in the mounting parent would prevent that parent from starting.
        ctx.inject(['remote.powerDsh'], (ctx) => {
          const setBlocked = async (method, blocked) => {
            const result = await ctx.remote.powerDsh[method](blocked);
            // Fold accepted Host state back into the shared configuration mirror.
            await ctx.configForms.describe().load();
            if (!result.ok) throw new Error(result.error.message);
          };
          for (const [language, dictionary] of Object.entries(dictionaries)) {
            ctx.effect(() => ctx.locale.register(namespace, language, dictionary));
          }
          let instructions = { status: 'loading', value: null, error: '' };
          const instructionsSource = observable(() => instructions);
          let active = true;
          let fileGeneration = 0;
          ctx.effect(() => () => { active = false; fileGeneration++; });
          const loadInstructions = async () => {
            const generation = ++fileGeneration;
            try {
              const result = await ctx.remote.powerDsh.readPersonalization();
              if (!active || generation !== fileGeneration) return;
              if (!result.ok) throw new Error(result.error.message);
              instructions = { status: 'ready', value: result.value, error: '' };
            } catch (failure) {
              if (!active || generation !== fileGeneration) return;
              instructions = { ...instructions, status: 'error', error: failure?.message || t('unavailable') };
            }
            instructionsSource.notify();
          };
          const saveInstructions = async (text, revision) => {
            ++fileGeneration;
            const result = await ctx.remote.powerDsh.savePersonalization(text, revision);
            if (!result.ok) {
              await loadInstructions();
              throw new Error(result.error.message);
            }
            if (!active) return;
            ++fileGeneration;
            instructions = { status: 'ready', value: result.value, error: '' };
            instructionsSource.notify();
          };
          let skillCatalog = { status: 'loading', value: null, cwd: '', scope: 'user', workspaces: [], error: '', saving: null };
          const skillsSource = observable(() => skillCatalog);
          let skillGeneration = 0;
          let skillWritePending = false;
          let selectedProjectCwd = '';
          ctx.effect(() => () => { skillGeneration++; });
          const loadSkills = async (cwd = '', scope = skillCatalog.scope) => {
            if (!active || skillWritePending) return;
            scope = scope || 'user';
            cwd = scope === 'project' ? cwd || selectedProjectCwd || skillCatalog.cwd : '';
            if (scope === 'project') selectedProjectCwd = cwd;
            const generation = ++skillGeneration;
            const sameContext = scope === skillCatalog.scope && (scope === 'user' || cwd === skillCatalog.cwd);
            skillCatalog = { ...skillCatalog, cwd, scope, value: sameContext ? skillCatalog.value : null, status: 'loading', error: '' };
            skillsSource.notify();
            try {
              const result = await ctx.remote.powerDsh.listSkills(cwd, scope);
              if (!active || generation !== skillGeneration) return;
              if (!result.ok) throw new Error(result.error.message);
              skillCatalog = { status: 'ready', value: result.value, cwd: result.value.cwd, scope: result.value.scope, workspaces: result.value.workspaces, error: '', saving: null };
              if (result.value.scope === 'project') selectedProjectCwd = result.value.cwd;
            } catch (failure) {
              if (!active || generation !== skillGeneration) return;
              skillCatalog = { ...skillCatalog, status: 'error', error: failure?.message || t('skillLoadFailed') };
            }
            skillsSource.notify();
          };
          const setSkillEnabled = async (name, enabled) => {
            const config = form.getSnapshot();
            if (!active || skillWritePending || skillCatalog.status !== 'ready' || !skillCatalog.value?.complete
              || config.status !== 'ready' || !config.writable || config.value?.skillManagerEnabled !== true) return;
            const skill = skillCatalog.value.skills.find(candidate => candidate.name === name);
            if (!skill?.canToggle || skill.reason) return;
            const { scope } = skillCatalog;
            const cwd = scope === 'project' ? skillCatalog.cwd : '';
            const generation = ++skillGeneration;
            skillWritePending = true;
            skillCatalog = { ...skillCatalog, saving: { name }, error: '' };
            skillsSource.notify();
            try {
              const result = await ctx.remote.powerDsh.setSkillEnabled(cwd, scope, name, enabled);
              if (!result.ok) throw new Error(result.error.message);
              if (!active || generation !== skillGeneration) return;
              skillCatalog = { status: 'ready', value: result.value, cwd: result.value.cwd, scope: result.value.scope, workspaces: result.value.workspaces, error: '', saving: null };
              skillsSource.notify();
            } catch (failure) {
              skillWritePending = false;
              if (active && generation === skillGeneration) {
                skillCatalog = { ...skillCatalog, saving: null };
                await loadSkills(cwd, scope);
              }
              throw failure;
            } finally {
              skillWritePending = false;
            }
          };
          let mcpCatalog = { status: 'loading', value: null, error: '', saving: null };
          const mcpSource = observable(() => mcpCatalog);
          let mcpGeneration = 0;
          let mcpWritePending = false;
          let mcpBackgroundPending = false;
          ctx.effect(() => () => { mcpGeneration++; });
          const mcpErrorMessage = (message, fallback) => t([
            'mcpLoadFailed', 'mcpChangeFailed', 'mcpRestartRequired', 'mcpChangeOverridden', 'mcpChangeUncertain', 'mcpUnavailable',
          ].includes(message) ? message : fallback);
          const mirrorMcpCatalog = value => {
            mcpCatalog = { status: 'ready', value, error: '', saving: null };
          };
          const loadMcpServers = async (background = false) => {
            if (!active || mcpWritePending || background && (mcpBackgroundPending || mcpCatalog.status !== 'ready')) return;
            const generation = ++mcpGeneration;
            if (background) mcpBackgroundPending = true;
            else {
              mcpCatalog = { ...mcpCatalog, status: 'loading', error: '' };
              mcpSource.notify();
            }
            try {
              const result = await ctx.remote.powerDsh.listMcpServers();
              if (!active || generation !== mcpGeneration) return;
              if (!result.ok) throw new Error(result.error.message);
              mirrorMcpCatalog(result.value);
            } catch (failure) {
              if (!active || generation !== mcpGeneration) return;
              mcpCatalog = { ...mcpCatalog, status: 'error', error: mcpErrorMessage(failure?.message, 'mcpLoadFailed') };
            } finally {
              if (background) mcpBackgroundPending = false;
            }
            mcpSource.notify();
          };
          const setMcpServerEnabled = async (id, enabled) => {
            const config = form.getSnapshot();
            if (!active || mcpWritePending || mcpCatalog.status !== 'ready' || !mcpCatalog.value?.complete
              || config.status !== 'ready' || !config.writable || config.value?.mcpManagerEnabled !== true) return;
            const server = mcpCatalog.value.servers.find(candidate => candidate.id === id);
            if (!canChangeMcp(server) || typeof enabled !== 'boolean' || server.enabled === enabled) return;
            const generation = ++mcpGeneration;
            mcpWritePending = true;
            mcpCatalog = { ...mcpCatalog, saving: { id }, error: '' };
            mcpSource.notify();
            try {
              const result = await ctx.remote.powerDsh.setMcpServerEnabled(id, enabled);
              if (!result.ok) throw new Error(result.error.message);
              if (!active || generation !== mcpGeneration) return;
              mirrorMcpCatalog(result.value);
              mcpSource.notify();
            } catch (failure) {
              mcpWritePending = false;
              if (active && generation === mcpGeneration) {
                mcpCatalog = { ...mcpCatalog, saving: null };
                await loadMcpServers();
              }
              throw new Error(mcpErrorMessage(failure?.message, 'mcpChangeFailed'));
            } finally {
              mcpWritePending = false;
            }
          };
          const canonicalForm = ctx.configForms.get(namespace);
          // Existing managed installs keep their legacy entry ID; never migrate preferences here.
          // get() returns cached controllers even for missing IDs; use snapshot availability.
          const legacyForms = ['dsh-x-mod', 'dsh-mod'].map(id => ctx.configForms.get(id));
          const selectedForm = () => canonicalForm.getSnapshot().status !== 'unavailable' ? canonicalForm
            : legacyForms.find(candidate => candidate.getSnapshot().status !== 'unavailable') ?? canonicalForm;
          const form = {
            getSnapshot: () => selectedForm().getSnapshot(),
            set: (field, value) => selectedForm().set(field, value),
            subscribe(listener) {
              const unsubscribe = [canonicalForm, ...legacyForms].map(candidate => candidate.subscribe(listener));
              return () => unsubscribe.forEach(off => off());
            },
          };
          const source = {
            subscribe: (listener) => form.subscribe(listener),
            getSnapshot: () => form.getSnapshot(),
          };
          let restartState = { supported: false, running: false, error: '' };
          const restartSource = observable(() => restartState);
          let restartReadPending = false;
          let restartGeneration = 0;
          let restartWritePending = false;
          const publishRestart = patch => { restartState = { ...restartState, ...patch }; restartSource.notify(); };
          const loadRestartStatus = async () => {
            if (!active || !isMacDesktop() || restartReadPending || restartWritePending) return;
            restartReadPending = true;
            const generation = restartGeneration;
            try {
              const reply = await ctx.remote.powerDsh.restartStatus();
              if (!active || restartWritePending || generation !== restartGeneration) return;
              if (!reply.ok) throw new Error('restartUnavailable');
              publishRestart(reply.value);
            } catch (_failure) {
              if (active && generation === restartGeneration) publishRestart({ error: 'restartUnavailable' });
            } finally { restartReadPending = false; }
          };
          const restartApp = async () => {
            if (!active || !isMacDesktop() || restartWritePending || restartState.running
              || !restartState.supported || form.getSnapshot().value?.showRestartButton !== true) return;
            restartWritePending = true;
            restartGeneration++;
            publishRestart({ running: true, error: '' });
            try {
              const reply = await ctx.remote.powerDsh.restartApp();
              if (!reply.ok) throw new Error(reply.error.message);
            } catch (failure) {
              if (active) publishRestart({ running: false,
                error: ['restartBusy', 'restartUnavailable'].includes(failure?.message) ? failure.message : 'restartFailed' });
            } finally {
              restartWritePending = false;
              if (active && restartState.running) void loadRestartStatus();
            }
          };
          const rawVersion = window.__DSH_BOOT__?.release?.version;
          const version = typeof rawVersion === 'string' && rawVersion.trim() ? rawVersion.trim() : null;
          const t = ctx.locale.bind(namespace);
          let soundState = { status: 'idle', value: null, error: '', playing: false };
          const soundsSource = observable(() => soundState);
          let soundConnection = null;
          let soundGeneration = 0;
          let soundPreview = null;
          const publishSound = patch => { soundState = { ...soundState, ...patch }; soundsSource.notify(); };
          ctx.effect(() => () => { soundGeneration++; soundPreview?.close(); });
          const loadSystemSounds = async () => {
            if (!active || soundState.status === 'loading') return;
            if (!soundConnection) { publishSound({ status: 'waiting', error: '' }); return; }
            if (!soundConnection.isLoopback) { publishSound({ status: 'remote', value: null, error: '' }); return; }
            const generation = ++soundGeneration;
            publishSound({ status: 'loading', error: '' });
            try {
              const reply = await ctx.remote.powerDsh.listSystemSounds();
              if (!active || generation !== soundGeneration) return;
              if (!reply.ok) throw new Error('notificationSoundUnavailable');
              publishSound({ status: 'ready', value: reply.value, error: '' });
            } catch (_failure) {
              if (active && generation === soundGeneration) publishSound({ status: 'error', error: 'notificationSoundUnavailable' });
            }
          };
          const playSystemSound = async (id, preview) => {
            const preferences = form.getSnapshot();
            if (!active || !soundConnection?.isLoopback || preferences.status !== 'ready'
              || !preferences.value?.notificationsEnabled || !preferences.value?.notificationSoundEnabled) return;
            if (preview && (!preferences.writable || soundState.playing || soundState.status !== 'ready'
              || (preferences.value?.notificationSound || 'default') !== id
              || !soundState.value.sounds.some(sound => sound.id === id))) return;
            if (preview) publishSound({ playing: true, error: '' });
            try {
              if (preview && id === 'default') {
                if (window.Notification?.permission !== 'granted') throw new Error('notificationPermission');
                soundPreview?.close();
                soundPreview = new window.Notification(t('notificationSoundTestTitle'), {
                  body: t('notificationSoundTestBody'), tag: `power-dsh-sound-test:${Date.now()}`, renotify: true,
                });
                soundPreview.onerror = () => { if (active) publishSound({ error: 'notificationSoundFailed' }); };
              } else {
                const reply = await ctx.remote.powerDsh.playSystemSound(id, preview);
                if (!reply.ok) throw new Error('notificationSoundFailed');
              }
            } catch (failure) {
              if (active) publishSound({ error: failure?.message === 'notificationPermission' ? 'notificationPermission' : 'notificationSoundFailed' });
              if (!preview) throw failure;
            } finally {
              if (active && preview) publishSound({ playing: false });
            }
          };
          let notificationError = '';
          let notificationReady = false;
          const notificationsSource = observable(() => notificationSnapshot);
          let notificationSnapshot = { error: '' };
          const reportNotificationError = error => {
            if (!active || notificationError === error) return;
            notificationError = error;
            notificationSnapshot = { error };
            notificationsSource.notify();
          };
          const checkNotificationPermission = () => {
            if (form.getSnapshot().value?.notificationsEnabled !== true) { soundPreview?.close(); reportNotificationError(''); return; }
            reportNotificationError(!window.Notification ? 'notificationUnsupported'
              : window.Notification.permission !== 'granted' ? 'notificationPermission'
                : !notificationReady ? 'notificationUnavailable' : '');
          };
          ctx.inject(['connection'], child => {
            child.effect(() => {
              soundConnection = child.connection;
              if (soundState.status !== 'idle') void loadSystemSounds();
              return () => {
                soundConnection = null;
                soundGeneration++;
                publishSound({ status: 'waiting', value: null, error: '', playing: false });
              };
            });
          });
          ctx.inject(['sessions', 'uiSession', 'connection'], child => {
            child.effect(() => {
              notificationReady = true;
              const dispose = notificationRunner(child, form, t, reportNotificationError, playSystemSound);
              checkNotificationPermission();
              return () => { dispose(); notificationReady = false; checkNotificationPermission(); };
            });
          });
          ctx.effect(() => form.subscribe(checkNotificationPermission));
          ctx.effect(() => {
            window.addEventListener('focus', checkNotificationPermission);
            checkNotificationPermission();
            return () => window.removeEventListener('focus', checkNotificationPermission);
          });
          const setNotificationsEnabled = async enabled => {
            if (enabled) {
              if (!notificationReady) throw new Error(t('notificationUnavailable'));
              if (!window.Notification) throw new Error(t('notificationUnsupported'));
              // Request before any other await so the browser keeps this click's user activation.
              const permission = window.Notification.permission === 'default'
                ? await window.Notification.requestPermission() : window.Notification.permission;
              if (!active) return;
              if (permission !== 'granted') throw new Error(t('notificationPermission'));
            }
            await savePreference('notificationsEnabled', enabled);
            reportNotificationError('');
          };
          const savePreference = async (field, value) => {
            // Client files can be newer than the Host schema; refresh its mirror before writing.
            await ctx.configForms.describe().load();
            const latest = form.getSnapshot();
            if (typeof latest.value?.[field] !== (field === 'notificationSound' ? 'string' : 'boolean')) {
              if (field === 'notificationsEnabled' || field === 'notificationSoundEnabled' || field === 'notificationSound') throw new Error(t('notificationUnavailable'));
              throw new Error(t(field === 'mcpManagerEnabled' ? 'mcpManagerOutdated' : field === 'skillManagerEnabled' ? 'skillManagerOutdated' : 'settingsOutdated'));
            }
            if (!await form.set(field, value)) throw new Error(t('saveFailed'));
          };
          ctx.slots.inject('settings.section', () => ctx.slots.register({
            name: 'settings.section', id: 'power-dsh', order: 50,
            locale: namespace, label: () => t('title'),
          }, (props) => h(SettingsPage, {
            ...props, source, form, version, savePreference, notificationsSource, setNotificationsEnabled,
            soundsSource, loadSystemSounds, playSystemSound,
            setAccountBlocked: blocked => setBlocked('setAccountBlocked', blocked),
            setTelemetryBlocked: blocked => setBlocked('setTelemetryBlocked', blocked),
            setTodoBlocked: blocked => setBlocked('setTodoBlocked', blocked),
            setSearchBlocked: blocked => setBlocked('setSearchBlocked', blocked),
          })));
          ctx.slots.inject('settings.section.icon', () => ctx.slots.register({
            name: 'settings.section.icon', id: 'power-dsh',
          }, Icon));
          // The Mod switch owns a separate native settings entry and its icon.
          function preferenceSlot(field, name, options, component) {
            ctx.slots.inject(name, () => {
              let release = null;
              const sync = () => {
                const snapshot = form.getSnapshot();
                const enabled = snapshot.status === 'ready' && snapshot.value?.[field] === true;
                if (enabled && !release) release = ctx.slots.register({ name, ...options }, component);
                else if (!enabled && release) { release(); release = null; }
              };
              sync();
              const unsubscribe = form.subscribe(sync);
              return () => { unsubscribe(); release?.(); };
            });
          }
          preferenceSlot('personalizationEnabled', 'settings.section', {
            id: 'power-dsh-personalization', order: 51, locale: namespace,
            label: () => t('personalizationTab'),
          }, props => h(PersonalizationPage, { ...props, source, instructionsSource, loadInstructions, saveInstructions }));
          preferenceSlot('personalizationEnabled', 'settings.section.icon', { id: 'power-dsh-personalization' }, PersonalizationIcon);
          preferenceSlot('skillManagerEnabled', 'settings.section', {
            id: 'power-dsh-skills', order: 52, locale: namespace, label: () => t('skillsTab'),
          }, props => h(SkillsPage, { ...props, source, skillsSource, loadSkills, setSkillEnabled }));
          preferenceSlot('skillManagerEnabled', 'settings.section.icon', { id: 'power-dsh-skills' }, SkillsIcon);
          preferenceSlot('mcpManagerEnabled', 'settings.section', {
            id: 'power-dsh-mcp', order: 53, locale: namespace, label: () => t('mcpTab'),
          }, props => h(McpPage, { ...props, source, mcpSource, loadMcpServers, setMcpServerEnabled }));
          preferenceSlot('mcpManagerEnabled', 'settings.section.icon', { id: 'power-dsh-mcp' }, McpIcon);
          // The current shell holds connecting for up to 800ms, recovery for
          // 2000ms, and then fades out for 150ms. Allow 3000ms after recovery.
          let connectionBusy = true;
          let updateBusy = false;
          const footerBusy = observable(() => connectionBusy || updateBusy);
          ctx.inject(['connection'], child => child.effect(() => {
            let timer;
            const state = child.connection.state;
            let previous = state?.getSnapshot();
            connectionBusy = previous !== 'connected';
            const sync = () => {
              const next = state.getSnapshot();
              if (next === previous) return;
              window.clearTimeout(timer);
              if (next !== 'connected') connectionBusy = true;
              else if (previous !== 'connected') {
                connectionBusy = true;
                timer = window.setTimeout(() => { connectionBusy = false; footerBusy.notify(); }, 3000);
              }
              previous = next;
              footerBusy.notify();
            };
            const unsubscribe = state?.subscribe(sync);
            footerBusy.notify();
            return () => { unsubscribe?.(); window.clearTimeout(timer); };
          }));
          ctx.effect(() => {
            const bridge = window.dshDesktop?.protocolVersion === 1 ? window.dshDesktop.updates : undefined;
            if (typeof bridge?.status !== 'function' || typeof bridge?.subscribe !== 'function') return;
            let active = true;
            let received = false;
            updateBusy = true;
            footerBusy.notify();
            const publish = presentation => {
              if (!active) return;
              updateBusy = presentation?.phase !== 'idle';
              footerBusy.notify();
            };
            const unsubscribe = bridge.subscribe(presentation => { received = true; publish(presentation); });
            bridge.status().then(presentation => { if (!received) publish(presentation); }, () => {
              // A failed native status read also displays a retry indicator.
              if (active && !received) { updateBusy = true; footerBusy.notify(); }
            });
            return () => { active = false; unsubscribe(); };
          });
          let themeBinding = null;
          const unavailableForm = { status: 'unavailable', writable: false };
          const themeSource = observable(() => themeBinding?.theme.getTheme() ?? null);
          const themeForm = observable(() => themeBinding?.form.getSnapshot() ?? unavailableForm);
          const setTheme = id => {
            if (!themeBinding) throw new Error(t('unavailable'));
            themeBinding.theme.setTheme(id);
          };
          ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
            name: 'sidebar.footer.action', id: 'power-dsh-footer', order: 50, locale: namespace,
          }, props => h('span', {
            className: 'power-dsh-footer-seat',
            style: { display: 'block', flex: '1 1 100%', minWidth: 0, width: '100%', height: 0, alignSelf: 'flex-end' },
          }, h(VersionBadge, { ...props, source, version }), h(AppearanceButton, {
            ...props, source, themeSource, themeForm, setTheme, footerBusy,
          }), h(HeaderActions, { ...props, source, restartSource, loadRestartStatus, restartApp }))));
          // Only the appearance button depends on theme; the version badge remains registered.
          ctx.inject(['theme'], child => {
            const binding = { theme: child.theme, form: child.configForms.get('ui-theme') };
            const notify = () => { themeSource.notify(); themeForm.notify(); };
            child.effect(() => {
              themeBinding = binding;
              notify();
              return () => { themeBinding = null; notify(); };
            });
            child.on('theme/change', themeSource.notify);
            child.effect(() => binding.form.subscribe(themeForm.notify));
          });
        });
      },
    };
  },
});
