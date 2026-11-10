(function() {

// src/shared/types/diagnostics.ts
/** Bound and redact the small text fields admitted to user-visible diagnostics. */
	function sanitizeDiagnosticText(text) {
		return text.slice(0, 4096).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").replace(/\b(?:authorization|proxy-authorization|cookie|set-cookie)\s*[:=][^\r\n]*/gi, "[redacted]").replace(/\b(?:bearer|basic)\s+[^\s,;]+/gi, "[redacted]").replace(/\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|password|passwd|credential)\b\s*["']?\s*[:=][^\r\n]*/gi, "[redacted]").replace(/\b(?:https?|file|wss?):\/\/[^\s<>"']+/gi, "[url]").replace(/(?:[A-Za-z]:[\\/]|\\\\)[^\s<>"']+/g, "[path]").replace(/\/(?:[^\s/<>"']+\/)+[^\s<>"']*/g, "[path]").slice(0, 2048);
	}
	/** Build copyable diagnostic text only from selected fields, never arbitrary error data. */
	function diagnosticReport(info) {
		return [
			"PowerDSH",
			`Code: ${sanitizeDiagnosticText(info.code)}`,
			`Operation: ${sanitizeDiagnosticText(info.operation)}`,
			`Message: ${sanitizeDiagnosticText(info.message)}`,
			`Observed: ${sanitizeDiagnosticText(info.observedAt)}`,
			...info.version ? [`DSH: ${sanitizeDiagnosticText(info.version)}`] : [],
			...info.platform ? [`Platform: ${sanitizeDiagnosticText(info.platform)}`] : [],
			...[
				["Stage", info.context?.stage],
				["Check", info.context?.check],
				["Result", info.context?.result],
				["Expected", info.context?.expected],
				["Actual", info.context?.actual],
				["State", info.context?.state],
				["Recovery", info.context?.recovery]
			].flatMap(([label, value]) => typeof value === "string" ? [`${label}: ${sanitizeDiagnosticText(value)}`] : [])
		].join("\n");
	}

// src/shared/client/error-feedback.ts
	const styles$12 = `
.power-dsh-feedback { min-width:0; color:var(--dsw-alias-state-error-primary); font:inherit; font-size:12px; line-height:18px; overflow-wrap:anywhere; }
.power-dsh-feedback[data-placement="page"] { margin:12px 0 0; padding:12px 14px; border:.5px solid var(--dsw-alias-settings-card-stroke); border-radius:var(--dsw-radius-lg); background:var(--dsw-alias-settings-card-fill); font-size:13px; line-height:20px; }
.power-dsh-feedback[data-placement="inline"] { margin:4px 0 0; }
.power-dsh-feedback[data-placement="compact"] { box-sizing:border-box; max-width:min(280px,calc(100vw - 16px)); max-height:calc(100vh - 72px); overflow:auto; padding:10px 12px; border:.5px solid var(--dsw-alias-border-l2); border-radius:var(--dsw-radius-md); background:var(--dsw-alias-bg-layer-1); pointer-events:auto; -webkit-app-region:no-drag; }
.power-dsh-error-actions { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:start; gap:0 8px; margin-top:8px; color:var(--dsw-alias-label-secondary); }
.power-dsh-error-details { grid-area:1 / 1 / 2 / 3; min-width:0; }
.power-dsh-error-disclosure { max-width:100%; }
.power-dsh-error-actions[data-has-retry="true"] .power-dsh-error-disclosure { max-width:calc(100% - 80px); }
.power-dsh-error-chevron { flex:none; transition:transform 120ms ease; }
.power-dsh-error-disclosure[aria-expanded="true"] .power-dsh-error-chevron { transform:rotate(180deg); }
.power-dsh-error-retry { grid-area:1 / 2; position:relative; }
.power-dsh-error-panel { margin-top:10px; padding:10px 12px; border-radius:var(--dsw-radius-md); background:var(--dsw-alias-bg-module-platform); color:var(--dsw-alias-label-secondary); }
.power-dsh-error-report { box-sizing:border-box; max-width:100%; max-height:200px; overflow:auto; margin:0; color:inherit; font-family:var(--ds-font-family-code,monospace); font-size:12px; line-height:18px; white-space:pre-wrap; overflow-wrap:anywhere; user-select:text; }
.power-dsh-error-panel-footer { display:flex; align-items:center; justify-content:flex-end; flex-wrap:wrap; gap:4px 8px; margin-top:8px; padding-top:8px; border-top:.5px solid var(--dsw-alias-border-l2); }
.power-dsh-error-disclosure:focus-visible,.power-dsh-error-retry:focus-visible,.power-dsh-error-copy:focus-visible,.power-dsh-error-report:focus-visible { outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary)); outline-offset:2px; }
.power-dsh-copy-status { flex:1 1 120px; color:var(--dsw-alias-label-secondary); font-size:12px; line-height:18px; }
@media (prefers-reduced-motion:reduce) { .power-dsh-error-chevron { transition:none; } }
`;
	/** One visual treatment for product errors, with optional recovery and copyable details. */
	function createErrorFeedback(React, Button) {
		const h = React.createElement;
		function ErrorDetails({ t, message, code, operation, context, observedAt: suppliedObservedAt }) {
			const [expanded, setExpanded] = React.useState(false);
			const panelId = React.useId();
			const [copyState, setCopyState] = React.useState("idle");
			const [mountedAt] = React.useState(() => (/* @__PURE__ */ new Date()).toISOString());
			const observedAt = suppliedObservedAt ?? mountedAt;
			const active = React.useRef(true);
			const generation = React.useRef(0);
			const pending = React.useRef(false);
			React.useEffect(() => {
				active.current = true;
				pending.current = false;
				setCopyState("idle");
				return () => {
					active.current = false;
					generation.current++;
					pending.current = false;
				};
			}, []);
			const rawVersion = window.__DSH_BOOT__?.release?.version;
			const marker = typeof document !== "undefined" ? document.documentElement?.getAttribute("data-platform") : null;
			const report = diagnosticReport({
				code,
				operation,
				message,
				observedAt,
				context,
				platform: marker === "win32" || marker === "darwin" || marker === "linux" ? marker : void 0,
				version: typeof rawVersion === "string" ? rawVersion : void 0
			});
			async function copy() {
				if (pending.current || !active.current) return;
				const startedIn = generation.current;
				pending.current = true;
				setCopyState("pending");
				try {
					if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
					await navigator.clipboard.writeText(report);
					if (active.current && generation.current === startedIn) setCopyState("copied");
				} catch {
					if (active.current && generation.current === startedIn) setCopyState("failed");
				} finally {
					if (generation.current === startedIn) pending.current = false;
				}
			}
			return h("div", { className: "power-dsh-error-details" }, h(Button, {
				variant: "ghost",
				size: "sm",
				className: "power-dsh-error-disclosure",
				"aria-expanded": expanded,
				"aria-controls": panelId,
				onClick: () => setExpanded(!expanded)
			}, t("errorDetails"), h("svg", {
				className: "power-dsh-error-chevron",
				width: 14,
				height: 14,
				viewBox: "0 0 16 16",
				"aria-hidden": true,
				focusable: false
			}, h("use", { href: "#dsw-icon-chevron-down-outline-regular" }))), h("div", {
				id: panelId,
				className: "power-dsh-error-panel",
				hidden: !expanded
			}, h("pre", {
				className: "power-dsh-error-report",
				tabIndex: 0
			}, report), h("div", { className: "power-dsh-error-panel-footer" }, (copyState === "copied" || copyState === "failed") && h("span", {
				className: "power-dsh-copy-status",
				role: "status"
			}, t(copyState === "copied" ? "errorInfoCopied" : "errorInfoCopyFailed")), h(Button, {
				variant: "outline",
				size: "sm",
				className: "power-dsh-error-copy",
				onClick: copy,
				disabled: copyState === "pending",
				"aria-busy": copyState === "pending"
			}, t("copyErrorInfo")))));
		}
		return function errorFeedback(props) {
			const { t, code, operation, id, placement = "inline", className = "", style, retry, disabled } = props;
			const message = sanitizeDiagnosticText(props.message);
			const { context, observedAt } = props;
			const diagnosticKey = JSON.stringify([
				code,
				operation,
				message,
				observedAt,
				context?.stage,
				context?.check,
				context?.result,
				context?.expected,
				context?.actual,
				context?.state,
				context?.recovery
			]);
			return h("div", {
				id,
				role: "alert",
				"data-error-code": code,
				onClick: (event) => event.stopPropagation(),
				className: `power-dsh-error power-dsh-feedback ${className}`.trim(),
				"data-placement": placement,
				"data-tone": "error",
				style
			}, message, h("style", null, styles$12), h("div", {
				className: "power-dsh-error-actions",
				"data-has-retry": Boolean(retry)
			}, h(ErrorDetails, {
				key: diagnosticKey,
				t,
				message,
				code,
				operation,
				context,
				observedAt
			}), retry && h(Button, {
				variant: "outline",
				size: "sm",
				className: "power-dsh-error-retry",
				disabled,
				onClick: retry
			}, t("retry"))));
		};
	}

// src/shared/client/runtime.ts
	function createRuntime(React, primitives) {
		const h = React.createElement;
		function observable(getSnapshot) {
			const listeners = /* @__PURE__ */ new Set();
			return {
				getSnapshot,
				subscribe(listener) {
					listeners.add(listener);
					return () => listeners.delete(listener);
				},
				notify() {
					for (const listener of listeners) listener();
				}
			};
		}
		function useSnapshot(source) {
			return React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
		}
		function useMounted() {
			const mounted = React.useRef(true);
			React.useEffect(() => {
				mounted.current = true;
				return () => {
					mounted.current = false;
				};
			}, []);
			return mounted;
		}
		function NativeIcon({ glyph, size = 16 }) {
			const id = `dsw-icon-${glyph}-medium`;
			return h("svg", {
				width: size,
				height: size,
				"data-icon": id,
				"aria-hidden": true,
				focusable: false
			}, h("use", { href: `#${id}` }));
		}
		return {
			React,
			h,
			...primitives,
			observable,
			useSnapshot,
			useMounted,
			NativeIcon,
			errorFeedback: createErrorFeedback(React, primitives.Button)
		};
	}
	function errorMessage(error) {
		return typeof error === "object" && error !== null && "message" in error && typeof error.message === "string" ? error.message : void 0;
	}

// src/shared/client/settings-form.ts
	function createSettingsForm(ctx, namespace) {
		const canonicalForm = ctx.configForms.get(namespace);
		const legacyForms = ["dsh-x-mod", "dsh-mod"].map((id) => ctx.configForms.get(id));
		const selectedForm = () => canonicalForm.getSnapshot().status !== "unavailable" ? canonicalForm : legacyForms.find((candidate) => candidate.getSnapshot().status !== "unavailable") ?? canonicalForm;
		return {
			getSnapshot: () => selectedForm().getSnapshot(),
			set: (field, value) => selectedForm().set(field, value),
			subscribe(listener) {
				const unsubscribe = [canonicalForm, ...legacyForms].map((candidate) => candidate.subscribe(listener));
				return () => unsubscribe.forEach((off) => off());
			}
		};
	}
	function createPreferenceSaver(ctx, form, t) {
		return async (field, value, unavailable = "settingsOutdated", type = "boolean") => {
			await ctx.configForms.describe().load();
			if (typeof form.getSnapshot().value?.[field] !== type) throw new Error(t(unavailable));
			if (!await form.set(field, value)) throw new Error(t("saveFailed"));
		};
	}
	function preferenceSlot(ctx, form, field, name, options, component) {
		ctx.slots.inject(name, () => {
			let release = null;
			const sync = () => {
				const snapshot = form.getSnapshot();
				const enabled = snapshot.status === "ready" && snapshot.value?.[field] === true;
				if (enabled && !release) release = ctx.slots.register({
					name,
					...options
				}, component);
				else if (!enabled && release) {
					release();
					release = null;
				}
			};
			sync();
			const unsubscribe = form.subscribe(sync);
			return () => {
				unsubscribe();
				release?.();
			};
		});
	}

// src/shared/client/shell-styles.ts
	const styles$11 = `
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
.power-dsh-page .power-dsh-switch { box-sizing:border-box; position:relative; flex:0 0 auto; width:36px; height:20px; padding:2px; border:0; border-radius:999px; corner-shape:round; background:var(--dsw-alias-border-l3); cursor:pointer; transition:background-color 120ms ease,opacity 120ms ease; }
.power-dsh-page .power-dsh-switch[aria-checked="true"] { background:var(--dsw-alias-brand-primary); }
.power-dsh-page .power-dsh-switch:focus-visible { outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; }
.power-dsh-page .power-dsh-switch:disabled { cursor:default; opacity:0.5; }
.power-dsh-page .power-dsh-switch[aria-busy="true"] { opacity:.8; }
.power-dsh-page .power-dsh-switch-thumb { display:block; width:16px; height:16px; border-radius:50%; corner-shape:round; background:var(--dsw-alias-label-primary-foreground); transition:transform 120ms ease; }
.power-dsh-page .power-dsh-switch[aria-checked="false"] .power-dsh-switch-thumb { background:var(--dsw-alias-switch-thumb); }
.power-dsh-page .power-dsh-switch[aria-checked="true"] .power-dsh-switch-thumb { transform:translateX(16px); }
.power-dsh-page .power-dsh-notice { margin:12px 0 0; color:var(--dsw-alias-label-tertiary); font-size:13px; font-weight:400; line-height:20px; }
@media (prefers-reduced-motion:reduce) { .power-dsh-page .power-dsh-switch, .power-dsh-page .power-dsh-switch-thumb, .power-dsh-page .power-dsh-prompt-input { transition:none; } }
.power-dsh-page .power-dsh-prompt-action:focus-visible { outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; }
.power-dsh-page .power-dsh-prompt-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:8px; }
.power-dsh-page .power-dsh-prompt-action { box-sizing:border-box; display:inline-flex; align-items:center; justify-content:center; gap:4px; height:36px; border:.5px solid transparent; border-radius:var(--dsw-radius-md); padding:0 14px; background:transparent; color:var(--dsw-alias-label-primary); font:inherit; font-size:14px; line-height:22px; box-shadow:inset 0 0 0 var(--dsh-hairline-width,.5px) var(--dsh-button-outline-color,var(--dsw-alias-border-l3)); cursor:pointer; }
.power-dsh-page .power-dsh-prompt-action[data-primary] { border:none; box-shadow:none; background:var(--dsw-alias-button-primary-fill); color:var(--dsw-alias-label-primary-foreground); }
@media (hover:hover) { .power-dsh-page .power-dsh-prompt-action:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover); } .power-dsh-page .power-dsh-prompt-action[data-primary]:hover:not(:disabled) { background:var(--dsw-alias-button-primary-hover); } }
.power-dsh-page .power-dsh-prompt-action:disabled { opacity:.4; cursor:not-allowed; }
`;

// src/shared/client/settings-shell.ts
	function createSettingsPage(runtime) {
		const { React, h, useSnapshot, useMounted, errorFeedback } = runtime;
		function SettingsPage({ t, source, form, version, features, close }) {
			const snapshot = useSnapshot(source);
			const [activeTab, setActiveTab] = React.useState("general");
			const tabRefs = React.useRef({});
			const tabs = [
				"general",
				"interface",
				"enhancements",
				"simplify",
				"other"
			].map((id) => ({ id }));
			const [saving, setSaving] = React.useState(null);
			const [error, setError] = React.useState(null);
			const pending = React.useRef(false);
			const mounted = useMounted();
			const id = React.useId();
			const ready = snapshot.status === "ready";
			const disabled = !ready || !snapshot.writable || Boolean(saving);
			const notice = !ready ? t(snapshot.status === "loading" ? "loading" : "unavailable") : !snapshot.writable ? t("readOnly") : !version ? t("versionUnavailable") : null;
			const noticeError = snapshot.status === "unavailable";
			async function save(field, next) {
				if (disabled || pending.current) return;
				const setting = fields.find((setting) => setting.field === field);
				if (!setting || setting.canSave && !setting.canSave(next)) return;
				pending.current = true;
				setSaving({
					field,
					value: next
				});
				setError(null);
				try {
					if (setting.save) await setting.save(next, { mounted });
					else if (!await form.set(field, next)) throw new Error(t("saveFailed"));
				} catch (failure) {
					if (mounted.current && !setting.hideError) setError({
						field,
						message: errorMessage(failure) || t("saveFailed")
					});
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
				const nextIndex = {
					ArrowLeft: (index + tabs.length - 1) % tabs.length,
					ArrowRight: (index + 1) % tabs.length,
					Home: 0,
					End: tabs.length - 1
				}[event.key];
				if (nextIndex === void 0) return;
				event.preventDefault();
				selectTab(tabs[nextIndex].id, true);
			}
			const viewContext = {
				snapshot,
				disabled,
				saving,
				error,
				save,
				id,
				leaveSettings: close
			};
			const fields = features.flatMap((feature) => feature.useSettings ? feature.useSettings(viewContext) : feature.settings || []);
			const allSettings = features.flatMap((feature) => feature.settings || []);
			for (const setting of allSettings) if (!fields.some((field) => field.field === setting.field)) fields.push(setting);
			function row(setting) {
				if (setting.hidden) return null;
				if (setting.render) return setting.render();
				const { field, description: descriptionKey } = setting;
				const control = `${id}-${field}`;
				const busy = saving?.field === field;
				const checked = busy ? saving.value === true : snapshot.value?.[field] === true;
				const saveError = error?.field === field ? error.message : void 0;
				const failure = saveError ? void 0 : setting.failure;
				const fieldError = saveError ?? failure?.message ?? setting.error;
				return h("div", {
					className: "power-dsh-setting-row",
					key: field
				}, h("div", { className: "power-dsh-setting-copy" }, h("div", {
					id: `${control}-label`,
					className: "power-dsh-setting-label"
				}, t(field)), h("div", {
					id: `${control}-description`,
					className: "power-dsh-description"
				}, t(descriptionKey ?? "")), fieldError && errorFeedback({
					t,
					id: `${control}-error`,
					message: fieldError,
					code: saveError ? "PD-SETTINGS-SAVE" : failure?.code ?? "PD-SETTINGS-RUNTIME",
					operation: failure?.operation ?? `settings.${field}`,
					context: failure?.context,
					observedAt: failure?.observedAt
				})), h("button", {
					id: control,
					type: "button",
					role: "switch",
					className: "power-dsh-switch",
					"aria-checked": checked,
					"aria-labelledby": `${control}-label`,
					"aria-describedby": `${control}-description${fieldError ? ` ${control}-error` : ""}`,
					"aria-invalid": Boolean(fieldError),
					"aria-busy": busy,
					disabled,
					onClick: () => save(field, !checked)
				}, h("span", {
					className: "power-dsh-switch-thumb",
					"aria-hidden": true
				})));
			}
			return h("section", {
				className: "power-dsh-page",
				"aria-label": t("title")
			}, h("style", null, styles$11 + features.map((feature) => feature.styles || "").join("")), h("header", null, h("h2", { className: "power-dsh-title" }, t("title")), h("p", { className: "power-dsh-description" }, t("description"))), notice && (noticeError ? errorFeedback({
				t,
				message: notice,
				code: "PD-SETTINGS-LOAD",
				operation: "settings.load",
				placement: "page"
			}) : h("p", {
				className: "power-dsh-notice",
				role: "status",
				"data-tone": "neutral"
			}, notice)), h("div", {
				className: "power-dsh-tabs",
				role: "tablist",
				"aria-label": t("title")
			}, ...tabs.map((tab, index) => h("button", {
				id: `${id}-tab-${tab.id}`,
				type: "button",
				role: "tab",
				className: "power-dsh-tab",
				ref: (element) => {
					tabRefs.current[tab.id] = element;
				},
				"aria-selected": activeTab === tab.id,
				"aria-controls": `${id}-panel-${tab.id}`,
				tabIndex: activeTab === tab.id ? 0 : -1,
				disabled: Boolean(saving),
				onClick: () => selectTab(tab.id),
				onKeyDown: (event) => onTabKeyDown(event, index)
			}, t(`${tab.id}Tab`)))), h("div", {
				id: `${id}-panel-${activeTab}`,
				className: "power-dsh-fields",
				role: "tabpanel",
				"aria-labelledby": `${id}-tab-${activeTab}`
			}, ...fields.filter((field) => field.category === activeTab).map(row)));
		}
		return SettingsPage;
	}

// src/shared/client/sidebar-styles.ts
	const styles$10 = `
.power-dsh-header-seat { display:block; width:100%; height:0; }
.power-dsh-header-seat .power-dsh-header-menu { position:fixed; top:12px; z-index:5; width:28px; height:28px; pointer-events:auto; -webkit-app-region:no-drag; }
html[data-platform="darwin"] .power-dsh-header-seat .power-dsh-header-menu { top:11px; }
html[data-windows-titlebar]:has(.power-dsh-header-menu) { --dsh-windows-menu-start:80px; }
html[data-windows-titlebar] .power-dsh-header-seat .power-dsh-header-menu { top:calc((var(--dsh-windows-titlebar-height,32px) - 28px) / 2); z-index:1101; }
.power-dsh-header-seat .power-dsh-header-button { display:flex; align-items:center; justify-content:center; width:28px; height:28px; padding:0; border:0; border-radius:var(--dsw-radius-md); background:transparent; color:var(--dsw-alias-label-secondary); cursor:pointer; -webkit-app-region:no-drag; }
.power-dsh-header-seat .power-dsh-header-button:is(:hover,[aria-expanded="true"]) { background:var(--dsw-alias-interactive-bg-hover); color:var(--dsw-alias-label-primary); }
.power-dsh-header-seat .power-dsh-header-button:focus-visible { outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; }
.power-dsh-header-seat .power-dsh-header-error { position:fixed; top:48px; z-index:6; }
html[data-windows-titlebar] .power-dsh-header-seat .power-dsh-header-error { top:calc(var(--dsh-windows-titlebar-height,32px) + 4px); z-index:1101; }
`;

// src/shared/client/sidebar-shell.ts
	function createHeaderActions(runtime) {
		const { React, h, Menu, useMounted, NativeIcon, errorFeedback } = runtime;
		function useHeaderPosition(visible, offset = 0) {
			const [position, setPosition] = React.useState(null);
			const seat = React.useRef(null);
			React.useLayoutEffect(() => {
				if (!visible || !seat.current) return;
				const element = seat.current;
				const measure = () => {
					const next = document.documentElement.hasAttribute("data-windows-titlebar") ? 44 : Math.max(8, element.getBoundingClientRect().right - 60 - offset);
					setPosition((previous) => previous === next ? previous : next);
				};
				const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
				observer?.observe(element);
				const chromeObserver = typeof MutationObserver === "function" ? new MutationObserver(measure) : null;
				chromeObserver?.observe(document.documentElement, {
					attributes: true,
					attributeFilter: ["data-windows-titlebar"]
				});
				measure();
				window.addEventListener("resize", measure);
				window.visualViewport?.addEventListener("resize", measure);
				return () => {
					observer?.disconnect();
					chromeObserver?.disconnect();
					window.removeEventListener("resize", measure);
					window.visualViewport?.removeEventListener("resize", measure);
				};
			}, [visible, offset]);
			return {
				seat,
				position
			};
		}
		function HeaderActions({ wide, source, t, actions }) {
			const latestWide = React.useRef(wide);
			latestWide.current = wide;
			const mounted = useMounted();
			const contributions = actions.map((action) => action({
				wide,
				latestWide,
				mounted,
				source,
				t
			}));
			const visibleActions = contributions.filter((action) => action.visible);
			const visible = visibleActions.length > 0;
			const { seat, position } = useHeaderPosition(visible);
			const [menuOpen, setMenuOpen] = React.useState(false);
			const menuRequest = React.useRef(false);
			const closeMenu = () => {
				menuRequest.current = false;
				setMenuOpen(false);
			};
			React.useEffect(() => {
				closeMenu();
			}, contributions.flatMap((action) => [action.visible, action.disabled]));
			React.useEffect(() => {
				if (position === null) closeMenu();
			}, [position]);
			const menu = menuRequest.current;
			const select = (id) => {
				if (!menu || menuRequest.current !== menu || !mounted.current || !latestWide.current) return;
				closeMenu();
				const action = contributions.find((action) => action.id === id);
				if (action?.canUse()) action.select();
			};
			if (!visible) return null;
			const message = visibleActions.find((action) => action.error)?.error;
			return h("span", {
				className: "power-dsh-header-seat",
				ref: seat
			}, h("style", null, styles$10), h("span", {
				className: "power-dsh-header-menu",
				style: position === null ? { visibility: "hidden" } : { left: position }
			}, h(Menu, {
				open: menuOpen && position !== null,
				onClose: closeMenu,
				onSelect: select,
				align: "end",
				portal: true,
				autoFocus: true,
				items: visibleActions.map(({ id, label, disabled }) => ({
					id,
					label,
					...disabled ? { disabled } : {}
				})),
				anchor: h("button", {
					type: "button",
					className: "power-dsh-header-button",
					title: t("moreActions"),
					"aria-label": t("moreActions"),
					"aria-haspopup": "menu",
					"aria-expanded": menuOpen && position !== null,
					onClick: (event) => {
						event.stopPropagation();
						if (position === null || !mounted.current || !latestWide.current || contributions.some((action) => action.isConfirming?.())) return;
						if (menuRequest.current) closeMenu();
						else {
							menuRequest.current = {};
							setMenuOpen(true);
						}
					}
				}, h(NativeIcon, { glyph: "ellipsis-outline" }))
			})), message && errorFeedback({
				t,
				message,
				code: "PD-HEADER-ACTION",
				operation: visibleActions.find((action) => action.error).id,
				placement: "compact",
				className: "power-dsh-header-error",
				style: position === null ? { visibility: "hidden" } : { left: Math.max(8, position - 200) }
			}), ...contributions.map((action) => action.dialog));
		}
		return HeaderActions;
	}

// src/features/account-blocking/client.ts
	function createClientFeature$17(runtime, env) {
		const { ctx } = env;
		const setAccountBlocked = async (blocked) => {
			const result = await ctx.remote.powerDsh.setAccountBlocked(blocked);
			await ctx.configForms.describe().load();
			if (!result.ok) throw new Error(result.error.message);
		};
		return {
			settings: [{
				field: "blockOfficialAccount",
				description: "blockAccountDescription",
				save: (next) => setAccountBlocked(next === true)
			}],
			api: { setAccountBlocked }
		};
	}

// src/features/account-blocking/definition.ts
	const definition$17 = Object.freeze({
		id: "account-blocking",
		category: "simplify",
		order: 8,
		keys: Object.freeze(["blockOfficialAccount"]),
		spec: "src/features/account-blocking/spec.md"
	});

// src/features/account-blocking/locales.ts
	const locales$18 = {
		"en": {
			"blockOfficialAccount": "Disable official sign-in and model integrations",
			"blockAccountDescription": "Disable official sign-in, account UI, and built-in model integrations."
		},
		"zh": {
			"blockOfficialAccount": "停用官方登录与模型接入",
			"blockAccountDescription": "停用官方登录、账号界面及内置模型接入。"
		}
	};

// src/shared/types/protocol.ts
	function isArray(value) {
		return Array.isArray(value);
	}
	function isStringArray(value) {
		return isArray(value) && value.every((item) => typeof item === "string");
	}
	/** Validate external wire objects before reading their fields. */
	function isRecord(value) {
		return typeof value === "object" && value !== null;
	}
	function hasStrings(value, keys) {
		return keys.every((key) => typeof value[key] === "string");
	}
	function hasBooleans(value, keys) {
		return keys.every((key) => typeof value[key] === "boolean");
	}
	function isOneOf(value, values) {
		return typeof value === "string" && values.includes(value);
	}

// src/shared/rpc/codecs.ts
	const booleanCodec = {
		mode: "strict",
		typeSymbol: "boolean",
		create: () => ({ parse(value) {
			if (typeof value !== "boolean") throw new TypeError("Expected a boolean");
			return value;
		} })
	};
	const stringCodec = {
		mode: "strict",
		typeSymbol: "string",
		create: () => ({ parse(value) {
			if (typeof value !== "string") throw new TypeError("Expected a string");
			return value;
		} })
	};
	function policyRpc(method, resultType) {
		return {
			id: `power-dsh#powerDsh/${method}`,
			service: "powerDsh",
			namespace: "powerDsh",
			method,
			invocation: { kind: "direct" },
			parameters: [{
				name: "blocked",
				wire: "blocked",
				source: "json",
				codec: booleanCodec
			}],
			result: {
				mode: "strict",
				typeSymbol: `power-dsh#${resultType}`,
				create: () => ({ parse(value) {
					if (!isRecord(value) || typeof value.blocked !== "boolean") throw new TypeError("Invalid policy result");
					return { blocked: value.blocked };
				} })
			}
		};
	}

// src/features/account-blocking/rpc.ts
	const ACCOUNT_RPC = policyRpc("setAccountBlocked", "AccountPolicyResult");
	const rpc$12 = [ACCOUNT_RPC];

// src/features/appearance-shortcut/styles.ts
	const styles$9 = `
.power-dsh-appearance-seat { display:block; width:100%; height:0; }
.power-dsh-appearance-seat .power-dsh-appearance-button { position:fixed; bottom:16px; z-index:5; display:flex; align-items:center; justify-content:center; box-sizing:border-box; width:32px; height:32px; padding:0; border:0; border-radius:var(--dsw-radius-md); background:transparent; color:var(--dsw-alias-label-primary); font:inherit; cursor:pointer; pointer-events:auto; -webkit-app-region:no-drag; }
.power-dsh-appearance-seat .power-dsh-appearance-button:hover { background-color:var(--dsw-alias-interactive-bg-hover); }
.power-dsh-appearance-seat .power-dsh-appearance-button:focus-visible { outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; }
.power-dsh-appearance-seat .power-dsh-appearance-button:disabled { opacity:.5; cursor:default; }
.power-dsh-appearance-seat .power-dsh-theme-error { position:fixed; bottom:56px; z-index:6; }
`;

// src/features/appearance-shortcut/client.ts
	function createClientFeature$16(runtime, env) {
		const { React, h, observable, useSnapshot, NativeIcon, errorFeedback } = runtime;
		const { ctx, source, t } = env;
		const themeChoices = [
			{
				id: "light",
				key: "themeLight",
				glyph: "light-outline"
			},
			{
				id: "dark",
				key: "themeDark",
				glyph: "dark-outline"
			},
			{
				id: "system",
				key: "themeSystem",
				glyph: "followsystem-outline"
			}
		];
		function AppearanceButton({ wide, source, t, themeSource, themeForm, setTheme, footerBusy }) {
			const config = useSnapshot(source);
			const theme = useSnapshot(themeSource);
			const writable = useSnapshot(themeForm);
			const busy = useSnapshot(footerBusy);
			const [error, setError] = React.useState("");
			const [position, setPosition] = React.useState(null);
			const seat = React.useRef(null);
			const visible = wide && !busy && config.status === "ready" && config.value?.showThemeSwitcher === true && theme !== null;
			React.useLayoutEffect(() => {
				if (!visible || !seat.current) return;
				const element = seat.current;
				const measure = () => setPosition(Math.max(0, element.getBoundingClientRect().right - 40));
				measure();
				const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
				observer?.observe(element);
				window.addEventListener("resize", measure);
				window.visualViewport?.addEventListener("resize", measure);
				return () => {
					observer?.disconnect();
					window.removeEventListener("resize", measure);
					window.visualViewport?.removeEventListener("resize", measure);
				};
			}, [visible]);
			if (!visible) return null;
			const currentIndex = themeChoices.findIndex((choice) => choice.id === theme.preference);
			const current = themeChoices[currentIndex] || themeChoices[2];
			const next = themeChoices[(currentIndex + 1) % themeChoices.length];
			const title = `${t("appearance")} · ${t(current.key)} · ${t("switchTo")} ${t(next.key)}`;
			return h("span", {
				className: "power-dsh-appearance-seat",
				ref: seat
			}, h("style", null, styles$9), h("button", {
				type: "button",
				className: "power-dsh-appearance-button",
				title: error || title,
				style: position === null ? { visibility: "hidden" } : { left: position },
				"aria-label": title,
				disabled: writable.status !== "ready" || !writable.writable,
				onClick: (event) => {
					event.stopPropagation();
					try {
						setTheme(next.id);
						setError("");
					} catch (failure) {
						setError(errorMessage(failure) || t("saveFailed"));
					}
				}
			}, h(NativeIcon, { glyph: current.glyph })), error && errorFeedback({
				t,
				message: error,
				code: "PD-APPEARANCE-SAVE",
				operation: "theme.setTheme",
				placement: "compact",
				className: "power-dsh-theme-error",
				style: position === null ? { visibility: "hidden" } : { left: Math.max(8, position - 208) }
			}));
		}
		let connectionBusy = true;
		let updateBusy = false;
		const footerBusy = observable(() => connectionBusy || updateBusy);
		ctx.inject(["connection"], (child) => child.effect(() => {
			let timer;
			const state = child.connection.state;
			let previous = state?.getSnapshot();
			connectionBusy = previous !== "connected";
			const sync = () => {
				const next = state.getSnapshot();
				if (next === previous) return;
				window.clearTimeout(timer);
				if (next !== "connected") connectionBusy = true;
				else if (previous !== "connected") {
					connectionBusy = true;
					timer = window.setTimeout(() => {
						connectionBusy = false;
						footerBusy.notify();
					}, 3e3);
				}
				previous = next;
				footerBusy.notify();
			};
			const unsubscribe = state?.subscribe(sync);
			footerBusy.notify();
			return () => {
				unsubscribe?.();
				window.clearTimeout(timer);
			};
		}));
		ctx.effect(() => {
			const bridge = window.dshDesktop?.protocolVersion === 1 ? window.dshDesktop.updates : void 0;
			if (typeof bridge?.status !== "function" || typeof bridge?.subscribe !== "function") return;
			let active = true;
			let received = false;
			updateBusy = true;
			footerBusy.notify();
			const publish = (presentation) => {
				if (!active) return;
				updateBusy = presentation?.phase !== "idle";
				footerBusy.notify();
			};
			const unsubscribe = bridge.subscribe((presentation) => {
				received = true;
				publish(presentation);
			});
			bridge.status().then((presentation) => {
				if (!received) publish(presentation);
			}, () => {
				if (active && !received) {
					updateBusy = true;
					footerBusy.notify();
				}
			});
			return () => {
				active = false;
				unsubscribe();
			};
		});
		let themeBinding = null;
		const unavailableForm = {
			status: "unavailable",
			writable: false
		};
		const themeSource = observable(() => themeBinding?.theme.getTheme() ?? null);
		const themeForm = observable(() => themeBinding?.form.getSnapshot() ?? unavailableForm);
		const setTheme = (id) => {
			if (!themeBinding) throw new Error(t("unavailable"));
			themeBinding.theme.setTheme(id);
		};
		ctx.inject(["theme"], (child) => {
			const binding = {
				theme: child.theme,
				form: child.configForms.get("ui-theme")
			};
			const notify = () => {
				themeSource.notify();
				themeForm.notify();
			};
			child.effect(() => {
				themeBinding = binding;
				notify();
				return () => {
					themeBinding = null;
					notify();
				};
			});
			child.on("theme/change", themeSource.notify);
			child.effect(() => binding.form.subscribe(themeForm.notify));
		});
		return {
			settings: [{
				field: "showThemeSwitcher",
				description: "themeSwitcherDescription"
			}],
			sidebar: (props) => h(AppearanceButton, {
				...props,
				source,
				themeSource,
				themeForm,
				setTheme,
				footerBusy
			})
		};
	}

// src/features/appearance-shortcut/definition.ts
	const definition$16 = Object.freeze({
		id: "appearance-shortcut",
		category: "interface",
		order: 4,
		keys: Object.freeze(["showThemeSwitcher"]),
		spec: "src/features/appearance-shortcut/spec.md"
	});

// src/features/appearance-shortcut/locales.ts
	const locales$17 = {
		"en": {
			"showThemeSwitcher": "Appearance shortcut",
			"themeSwitcherDescription": "Quickly switch appearance at the bottom of the sidebar",
			"appearance": "Appearance",
			"themeLight": "Light",
			"themeDark": "Dark",
			"themeSystem": "System",
			"switchTo": "Switch to"
		},
		"zh": {
			"showThemeSwitcher": "外观快捷切换",
			"themeSwitcherDescription": "在侧栏底部快捷切换外观",
			"appearance": "外观",
			"themeLight": "浅色",
			"themeDark": "深色",
			"themeSystem": "跟随系统",
			"switchTo": "切换为"
		}
	};

// src/features/double-click-rename/client.ts
	function isGestureNode(node) {
		return typeof node === "object" && node !== null && "getAttribute" in node && typeof node.getAttribute === "function";
	}
	function createClientFeature$15(runtime, env) {
		const { ctx, form, savePreference } = env;
		function bindDoubleClickRenameBlocker(form) {
			let listening = false;
			const enabled = () => {
				const snapshot = form.getSnapshot();
				return snapshot.status === "ready" && snapshot.value?.blockDoubleClickRename === true;
			};
			const onDoubleClick = (event) => {
				if (!enabled() || event.button !== 0) return;
				for (const node of event.composedPath()) {
					if (!isGestureNode(node)) continue;
					const role = node.getAttribute("role");
					if ([
						"BUTTON",
						"INPUT",
						"TEXTAREA",
						"SELECT",
						"A"
					].includes(node.tagName ?? "") || node.isContentEditable || [
						"button",
						"link",
						"textbox",
						"combobox",
						"switch",
						"menuitem"
					].includes(role ?? "")) return;
					if (role !== "treeitem") continue;
					if (node.getAttribute("data-row-key")?.startsWith("session:")) event.stopPropagation();
					return;
				}
			};
			const sync = () => {
				const next = enabled();
				if (next === listening) return;
				listening = next;
				if (next) window.addEventListener("dblclick", onDoubleClick, true);
				else window.removeEventListener("dblclick", onDoubleClick, true);
			};
			const unsubscribe = form.subscribe(sync);
			sync();
			return () => {
				unsubscribe();
				if (listening) window.removeEventListener("dblclick", onDoubleClick, true);
			};
		}
		ctx.effect(() => bindDoubleClickRenameBlocker(form));
		return { settings: [{
			field: "blockDoubleClickRename",
			description: "blockDoubleClickRenameDescription",
			save: (next) => savePreference("blockDoubleClickRename", next === true)
		}] };
	}

// src/features/double-click-rename/definition.ts
	const definition$15 = Object.freeze({
		id: "double-click-rename",
		category: "other",
		order: 3,
		keys: Object.freeze(["blockDoubleClickRename"]),
		spec: "src/features/double-click-rename/spec.md"
	});

// src/features/double-click-rename/locales.ts
	const locales$16 = {
		"en": {
			"blockDoubleClickRename": "Block double-click renaming",
			"blockDoubleClickRenameDescription": "Disable double-click renaming of session titles in the sidebar"
		},
		"zh": {
			"blockDoubleClickRename": "屏蔽双击重命名",
			"blockDoubleClickRenameDescription": "屏蔽侧栏会话标题的双击重命名操作"
		}
	};

// src/shared/client/catalog-styles.ts
	const styles$8 = `
/* Reserve the host scroll gutter only for the options column containing this page. */
[data-shortcut-modal="settings"] > div:has(:is(.power-dsh-skills-page,.power-dsh-mcp-page)) { scrollbar-gutter:stable; }
/* Adapted from DSH PluginInventorySettingsTab (MIT); see docs/third-party-notices.md. */
.power-dsh-page:is(.power-dsh-skills-page,.power-dsh-mcp-page) { container:power-dsh-skills / inline-size; max-width:760px; display:flex; flex-direction:column; gap:12px; }
.power-dsh-page:is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-navigation { margin-top:2px; }
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
:is(.power-dsh-skills-page,.power-dsh-mcp-page) > header .power-dsh-description { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.power-dsh-page .power-dsh-skill-reason { margin:4px 0 0; color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:18px; }
.power-dsh-page .power-dsh-skill-empty { padding:48px 0; text-align:center; color:var(--dsw-alias-label-tertiary); }
.power-dsh-page .power-dsh-skill-notice { margin:12px 0; }
`;

// src/shared/client/catalog-ui.ts
	function createCatalogUI({ h }) {
		function SkillSearchIcon() {
			return h("svg", {
				width: 16,
				height: 16,
				viewBox: "0 0 20 20",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.4,
				strokeLinecap: "round",
				"aria-hidden": true
			}, h("circle", {
				cx: 8.5,
				cy: 8.5,
				r: 5.5
			}), h("path", { d: "m13 13 4 4" }));
		}
		function SkillChevron() {
			return h("svg", {
				className: "power-dsh-skill-chevron",
				width: 14,
				height: 14,
				viewBox: "0 0 16 16",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.4,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": true
			}, h("path", { d: "m4 6 4 4 4-4" }));
		}
		return {
			SkillSearchIcon,
			SkillChevron
		};
	}

// src/features/mcp/styles.ts
	const styles$7 = `
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
`;

// src/features/mcp/client.ts
	function hasClosest(target) {
		return typeof target === "object" && target !== null && "closest" in target && typeof target.closest === "function";
	}
	const runtimeDots = {
		pending: "ongoing",
		loading: "ongoing",
		unloading: "ongoing",
		active: "done",
		failed: "error",
		inactive: "idle",
		disabled: "idle",
		unknown: "idle"
	};
	function createClientFeature$14(runtime, env) {
		const { React, h, Tooltip, StateDot, observable, useSnapshot, useMounted, errorFeedback } = runtime;
		const { ctx, form, source, t, savePreference, preferenceSlot, namespace } = env;
		const styles = styles$11 + styles$8 + styles$7;
		const { SkillSearchIcon, SkillChevron } = createCatalogUI(runtime);
		function McpIcon({ size = 16 }) {
			return h("svg", {
				width: size,
				height: size,
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 2,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": true,
				focusable: false
			}, h("path", { d: "M17 19a1 1 0 0 1-1-1v-2a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2a1 1 0 0 1-1 1z" }), h("path", { d: "M17 21v-2" }), h("path", { d: "M19 14V6.5a1 1 0 0 0-7 0v11a1 1 0 0 1-7 0V10" }), h("path", { d: "M21 21v-2" }), h("path", { d: "M3 5V3" }), h("path", { d: "M4 10a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2a2 2 0 0 1-2 2z" }), h("path", { d: "M7 5V3" }));
		}
		function canChangeMcp(server) {
			return Boolean(server && server.stateKnown && server.canToggle && ["profile", "manager"].includes(server.source) && !server.reason);
		}
		function McpPage({ t, source, mcpSource, loadMcpServers, setMcpServerEnabled }) {
			const config = useSnapshot(source);
			const snapshot = useSnapshot(mcpSource);
			const catalog = snapshot.value;
			const [query, setQuery] = React.useState("");
			const [groupsOpen, setGroupsOpen] = React.useState({
				user: true,
				builtin: false
			});
			const [expandedServers, setExpandedServers] = React.useState(() => /* @__PURE__ */ new Set());
			const [error, setError] = React.useState(null);
			const mounted = useMounted();
			const pending = React.useRef(false);
			const id = React.useId();
			const busy = snapshot.status === "loading" || Boolean(snapshot.saving);
			const writable = config.status === "ready" && config.writable && config.value?.mcpManagerEnabled === true;
			const disabled = busy || !writable || snapshot.status !== "ready" || !catalog?.complete;
			React.useEffect(() => {
				loadMcpServers();
				const refresh = () => {
					loadMcpServers();
				};
				const timer = window.setInterval(() => {
					const latest = mcpSource.getSnapshot();
					if (!document.hidden && latest.status === "ready" && !latest.saving) return loadMcpServers(true);
				}, 2e3);
				window.addEventListener("focus", refresh);
				return () => {
					window.clearInterval(timer);
					window.removeEventListener("focus", refresh);
				};
			}, []);
			const safeSourceLabel = (value) => ({
				profile: t("mcpProfileSource"),
				plugin: t("mcpPluginSource"),
				manager: t("mcpManagerSource")
			})[value] || value;
			const typeLabel = (transport) => ({
				stdio: t("mcpLocalType"),
				"streamable-http": t("mcpHttpType")
			})[transport] || "";
			const groupLabel = (group) => t(group === "builtin" ? "skillPreinstalledGroup" : "skillPersonalGroup");
			const needle = query.trim().toLocaleLowerCase();
			const rows = (catalog?.servers ?? []).filter((server) => `${server.name} ${server.tools.join(" ")} ${server.origin} ${server.source} ${safeSourceLabel(server.source)} ${groupLabel(server.group)} ${typeLabel(server.transport)}`.toLocaleLowerCase().includes(needle));
			function contextAvailable() {
				const latest = mcpSource.getSnapshot();
				const config = source.getSnapshot();
				return mounted.current && !pending.current && latest.status !== "loading" && !latest.saving && latest.value === catalog && config.status === "ready" && config.value?.mcpManagerEnabled === true;
			}
			async function toggle(server) {
				if (disabled || !contextAvailable() || !canChangeMcp(server)) return;
				pending.current = true;
				setError(null);
				try {
					await setMcpServerEnabled(server.id, !server.enabled);
				} catch (failure) {
					if (mounted.current) setError({
						id: server.id,
						message: errorMessage(failure) || t("mcpChangeFailed")
					});
				} finally {
					pending.current = false;
				}
			}
			const renderCard = (server) => {
				const transportLabel = typeLabel(server.transport);
				const off = server.stateKnown && !server.enabled;
				const displayState = off ? "disabled" : server.runtimeState;
				const runtimeLabel = {
					pending: "mcpRuntimePending",
					loading: "mcpRuntimeLoading",
					active: "mcpRuntimeActive",
					failed: "mcpRuntimeFailed",
					unloading: "mcpRuntimeUnloading",
					inactive: "mcpRuntimeInactive",
					disabled: "mcpDisabled"
				}[displayState];
				const transitioning = [
					"pending",
					"loading",
					"unloading"
				].includes(displayState);
				const expandable = !off && server.tools.length > 0;
				const expanded = expandable && expandedServers.has(server.id);
				const summary = server.tools.length === 1 ? t("mcpSingleTool") : server.tools.length ? t("mcpToolCount").replace("{count}", () => String(server.tools.length)) : t("mcpNoTools");
				const control = `${id}-mcp-${catalog.servers.indexOf(server)}`;
				const reasonKey = {
					"preset-managed": "mcpPresetManaged",
					"plugin-managed": "mcpPluginManaged",
					"manager-managed": "mcpManagerManaged",
					conditional: "mcpConditional",
					unaddressable: "mcpUnaddressable",
					"management-required": "mcpManagementRequired"
				}[server.reason];
				const reason = !server.stateKnown ? t("mcpStateUnknown") : reasonKey ? t(reasonKey) : !canChangeMcp(server) ? t("mcpReadOnly") : "";
				const describedBy = [reason && `${control}-reason`, error?.id === server.id && `${control}-error`].filter(Boolean).join(" ") || void 0;
				const toggleExpanded = () => {
					const latest = mcpSource.getSnapshot().value?.servers.find((item) => item.id === server.id);
					if (!mounted.current || !latest || latest.stateKnown && !latest.enabled || latest.tools.length === 0) return;
					setExpandedServers((current) => {
						const next = new Set(current);
						if (next.has(server.id)) next.delete(server.id);
						else next.add(server.id);
						return next;
					});
				};
				return h("li", {
					key: server.id,
					className: "power-dsh-skill-card",
					"data-mcp": server.id,
					"data-open": expanded,
					"aria-labelledby": `${control}-name`,
					"aria-describedby": describedBy
				}, h("div", {
					className: "power-dsh-skill-card-content",
					"data-expandable": expandable,
					onClick: expandable ? (event) => {
						if (event.defaultPrevented || hasClosest(event.target) && event.target.closest("button, a, input, select, textarea, [role=\"switch\"]")) return;
						toggleExpanded();
					} : void 0
				}, h("div", { className: "power-dsh-skill-card-main" }, h(Tooltip, {
					label: server.name,
					side: "top",
					portal: true,
					delayMs: 0,
					maxWidth: 400
				}, h("span", {
					id: `${control}-name`,
					className: "power-dsh-skill-card-title",
					tabIndex: 0,
					"aria-describedby": describedBy
				}, server.name)), server.stateKnown ? h("button", {
					id: control,
					type: "button",
					role: "switch",
					className: "power-dsh-switch",
					"aria-checked": server.enabled,
					"aria-labelledby": `${control}-name`,
					"aria-describedby": describedBy,
					"aria-busy": snapshot.saving?.id === server.id,
					disabled: Boolean(disabled || !canChangeMcp(server)),
					onClick: () => toggle(server)
				}, h("span", {
					className: "power-dsh-switch-thumb",
					"aria-hidden": true
				})) : h("span", {
					className: "power-dsh-description",
					"aria-hidden": true
				}, "—")), (transportLabel || runtimeLabel) && h("div", { className: "power-dsh-mcp-card-meta" }, transportLabel && h("span", {
					id: `${control}-transport`,
					className: "power-dsh-mcp-transport",
					"data-transport": server.transport
				}, transportLabel), runtimeLabel && h("span", {
					className: "power-dsh-mcp-runtime",
					"data-state": displayState,
					role: "status",
					"aria-label": transitioning ? t(runtimeLabel) : void 0
				}, h(StateDot, { state: runtimeDots[displayState] }), !transitioning && t(runtimeLabel))), expandable ? h("button", {
					type: "button",
					className: "power-dsh-mcp-card-toggle",
					"aria-expanded": expanded,
					"aria-controls": `${control}-tools`,
					"aria-labelledby": `${control}-name ${control}-summary`,
					"aria-describedby": describedBy,
					onClick: toggleExpanded
				}, h("span", {
					id: `${control}-summary`,
					className: "power-dsh-mcp-tools-summary"
				}, summary), h(SkillChevron)) : h("div", {
					className: "power-dsh-mcp-card-placeholder",
					"data-state": off ? "disabled" : "empty"
				}, t(off ? "mcpNoAvailableTools" : "mcpNoTools")), reason && h("p", {
					id: `${control}-reason`,
					className: "power-dsh-skill-reason"
				}, reason), error?.id === server.id && errorFeedback({
					t,
					id: `${control}-error`,
					message: error.message,
					code: "PD-MCP-CHANGE",
					operation: "setMcpServerEnabled"
				})), expandable && h("div", {
					id: `${control}-tools`,
					className: "power-dsh-mcp-tools",
					hidden: !expanded,
					role: "region",
					"aria-labelledby": `${control}-name`
				}, expanded && (server.tools.length ? h("ul", { "aria-label": t("mcpTools") }, server.tools.map((tool) => h("li", {
					key: tool,
					className: "power-dsh-mcp-tool-name"
				}, tool))) : h("p", null, t("mcpNoTools")))));
			};
			const renderGroup = (group) => {
				const selectedRows = rows.filter((server) => server.group === group);
				if (selectedRows.length === 0) return null;
				const open = Boolean(needle) || groupsOpen[group];
				const titleId = `${id}-mcp-group-${group}`;
				return h("section", {
					key: group,
					className: "power-dsh-skill-group",
					"aria-labelledby": titleId
				}, h("div", { className: "power-dsh-skill-group-header" }, h("button", {
					id: titleId,
					type: "button",
					className: "power-dsh-skill-group-toggle",
					"aria-expanded": open,
					"aria-controls": `${titleId}-body`,
					onClick: () => {
						if (!needle) setGroupsOpen((current) => ({
							...current,
							[group]: !current[group]
						}));
					}
				}, h(SkillChevron), h("span", { className: "power-dsh-skill-group-title" }, groupLabel(group)))), h("p", { className: "power-dsh-skill-group-description" }, t(group === "builtin" ? "mcpPreinstalledDescription" : "mcpPersonalDescription")), open && h("div", {
					id: `${titleId}-body`,
					className: "power-dsh-skill-group-body"
				}, h("ul", { className: "power-dsh-skill-cards" }, selectedRows.map(renderCard))));
			};
			return h("section", {
				className: "power-dsh-page power-dsh-mcp-page",
				"aria-label": t("mcpTab")
			}, h("style", null, styles), h("header", null, h("h2", { className: "power-dsh-title" }, t("mcpTab")), h("p", { className: "power-dsh-description" }, t("mcpDescription"))), snapshot.status === "loading" && h("p", {
				className: "power-dsh-notice",
				role: "status"
			}, t("loading")), snapshot.error && errorFeedback({
				t,
				message: snapshot.error,
				code: "PD-MCP-LOAD",
				operation: "listMcpServers",
				placement: "page",
				retry: () => loadMcpServers(),
				disabled: busy
			}), h("div", { className: "power-dsh-skill-panel" }, h("div", { className: "power-dsh-global-search-row" }, catalog && h("label", { className: "power-dsh-skill-search-field" }, h(SkillSearchIcon), h("input", {
				type: "search",
				value: query,
				disabled: busy,
				placeholder: t("mcpSearch"),
				"aria-label": t("mcpSearch"),
				onChange: (event) => {
					if (contextAvailable()) setQuery(event.target.value);
				}
			}))), catalog && !catalog.complete && h("p", {
				className: "power-dsh-description power-dsh-skill-notice",
				role: "status"
			}, t("mcpIncomplete")), config.status === "ready" && !config.writable && h("p", { className: "power-dsh-description power-dsh-skill-notice" }, t("readOnly")), error && !catalog?.servers.some((server) => server.id === error.id) && errorFeedback({
				t,
				message: error.message,
				code: "PD-MCP-CHANGE",
				operation: "setMcpServerEnabled",
				placement: "page"
			}), catalog && ["user", "builtin"].map(renderGroup), catalog && snapshot.status === "ready" && catalog.complete && rows.length === 0 && h("p", { className: "power-dsh-skill-empty" }, t(query ? "mcpNoMatches" : "mcpEmpty"))));
		}
		let active = true;
		ctx.effect(() => () => {
			active = false;
		});
		let mcpCatalog = {
			status: "loading",
			value: null,
			error: "",
			saving: null
		};
		const mcpSource = observable(() => mcpCatalog);
		let mcpGeneration = 0;
		let mcpWritePending = false;
		let mcpBackgroundPending = false;
		ctx.effect(() => () => {
			mcpGeneration++;
		});
		const mcpErrorMessage = (message, fallback) => t([
			"mcpLoadFailed",
			"mcpProviderInitFailed",
			"mcpPluginsLoadFailed",
			"mcpBundlesLoadFailed",
			"mcpPresetsLoadFailed",
			"mcpProvidersLoadFailed",
			"mcpMetadataLoadFailed",
			"mcpChangeFailed",
			"mcpRestartRequired",
			"mcpChangeOverridden",
			"mcpChangeUncertain",
			"mcpUnavailable"
		].includes(message ?? "") ? message : fallback);
		const mirrorMcpCatalog = (value) => {
			mcpCatalog = {
				status: "ready",
				value,
				error: "",
				saving: null
			};
		};
		const loadMcpServers = async (background = false) => {
			if (!active || mcpWritePending || background && (mcpBackgroundPending || mcpCatalog.status !== "ready")) return;
			const generation = ++mcpGeneration;
			if (background) mcpBackgroundPending = true;
			else {
				mcpCatalog = {
					...mcpCatalog,
					status: "loading",
					error: ""
				};
				mcpSource.notify();
			}
			try {
				const result = await ctx.remote.powerDsh.listMcpServers();
				if (!active || generation !== mcpGeneration) return;
				if (!result.ok) throw new Error(result.error.message);
				mirrorMcpCatalog(result.value);
			} catch (failure) {
				if (!active || generation !== mcpGeneration) return;
				mcpCatalog = {
					...mcpCatalog,
					status: "error",
					error: mcpErrorMessage(errorMessage(failure), "mcpLoadFailed")
				};
			} finally {
				if (background) mcpBackgroundPending = false;
			}
			mcpSource.notify();
		};
		const setMcpServerEnabled = async (id, enabled) => {
			const config = form.getSnapshot();
			if (!active || mcpWritePending || mcpCatalog.status !== "ready" || !mcpCatalog.value?.complete || config.status !== "ready" || !config.writable || config.value?.mcpManagerEnabled !== true) return;
			const server = mcpCatalog.value.servers.find((candidate) => candidate.id === id);
			if (!canChangeMcp(server) || typeof enabled !== "boolean" || server.enabled === enabled) return;
			const generation = ++mcpGeneration;
			mcpWritePending = true;
			mcpCatalog = {
				...mcpCatalog,
				saving: { id },
				error: ""
			};
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
					mcpCatalog = {
						...mcpCatalog,
						saving: null
					};
					await loadMcpServers();
				}
				throw new Error(mcpErrorMessage(errorMessage(failure), "mcpChangeFailed"));
			} finally {
				mcpWritePending = false;
			}
		};
		preferenceSlot("mcpManagerEnabled", "settings.section", {
			id: "power-dsh-mcp",
			order: 53,
			locale: namespace,
			label: () => t("mcpTab")
		}, (props) => h(McpPage, {
			...props,
			source,
			mcpSource,
			loadMcpServers,
			setMcpServerEnabled
		}));
		preferenceSlot("mcpManagerEnabled", "settings.section.icon", { id: "power-dsh-mcp" }, McpIcon);
		return {
			settings: [{
				field: "mcpManagerEnabled",
				description: "mcpManagerDescription",
				save: (next) => savePreference("mcpManagerEnabled", next === true, "mcpManagerOutdated")
			}],
			api: {
				mcpSource,
				loadMcpServers,
				setMcpServerEnabled
			}
		};
	}

// src/features/mcp/definition.ts
	const definition$14 = Object.freeze({
		id: "mcp",
		category: "enhance",
		order: 8,
		keys: Object.freeze(["mcpManagerEnabled"]),
		spec: "src/features/mcp/spec.md"
	});

// src/features/mcp/locales.ts
	const locales$15 = {
		"en": {
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
			"mcpProviderInitFailed": "Could not initialize MCP discovery. Re-enable PowerDSH, then try again. (MCP-INIT)",
			"mcpPluginsLoadFailed": "Could not read the plugin list. Check the native plugin settings, then try again. (MCP-PLUGINS)",
			"mcpBundlesLoadFailed": "Could not read the bundle list. Check the native plugin settings, then try again. (MCP-BUNDLES)",
			"mcpPresetsLoadFailed": "Could not read the mode list. Check the mode settings, then try again. (MCP-PRESETS)",
			"mcpProvidersLoadFailed": "Could not read MCP instances or tools. Please try again. (MCP-PROVIDERS)",
			"mcpMetadataLoadFailed": "Could not assemble MCP entries. Please try again. (MCP-METADATA)",
			"mcpChangeFailed": "Could not change this MCP server. Please try again.",
			"mcpRestartRequired": "The setting was saved. Restart DSH to apply it.",
			"mcpChangeOverridden": "Another configuration overrides this setting.",
			"mcpChangeUncertain": "The result could not be confirmed. Review the current state before trying again.",
			"mcpUnavailable": "MCP management is currently unavailable.",
			"mcpManagerOutdated": "The Host has not loaded MCP management yet. Re-enable power-dsh, then try again."
		},
		"zh": {
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
			"mcpProviderInitFailed": "无法初始化 MCP 发现，请重新启用 PowerDSH 后重试。（MCP-INIT）",
			"mcpPluginsLoadFailed": "无法读取插件清单，请检查原生插件设置后重试。（MCP-PLUGINS）",
			"mcpBundlesLoadFailed": "无法读取插件包清单，请检查原生插件设置后重试。（MCP-BUNDLES）",
			"mcpPresetsLoadFailed": "无法读取模式清单，请检查模式设置后重试。（MCP-PRESETS）",
			"mcpProvidersLoadFailed": "无法读取 MCP 实例或工具，请重试。（MCP-PROVIDERS）",
			"mcpMetadataLoadFailed": "无法整理 MCP 条目，请重试。（MCP-METADATA）",
			"mcpChangeFailed": "无法修改此 MCP，请重试。",
			"mcpRestartRequired": "设置已保存，请重启 DSH 后生效。",
			"mcpChangeOverridden": "此设置被其他配置覆盖。",
			"mcpChangeUncertain": "无法确认修改结果，请核对当前状态后重试。",
			"mcpUnavailable": "MCP 管理暂不可用。",
			"mcpManagerOutdated": "MCP 管理尚未在后端加载，请重新启用 power-dsh 后重试。"
		}
	};

// src/features/mcp/rpc.ts
	const mcpCatalogCodec = {
		mode: "strict",
		typeSymbol: "power-dsh#McpCatalog",
		create: () => ({ parse(value) {
			if (!isRecord(value) || typeof value.complete !== "boolean" || !isArray(value.servers)) throw new TypeError("Invalid MCP catalog");
			const servers = value.servers.map((row) => {
				if (!isRecord(row) || !hasStrings(row, [
					"id",
					"name",
					"source",
					"origin",
					"reason"
				]) || !isOneOf(row.group, ["user", "builtin"]) || !isOneOf(row.transport, [
					"stdio",
					"streamable-http",
					"unknown"
				]) || !isOneOf(row.runtimeState, [
					"pending",
					"loading",
					"active",
					"failed",
					"unloading",
					"inactive",
					"disabled",
					"unknown"
				]) || !isStringArray(row.tools) || !hasBooleans(row, [
					"enabled",
					"stateKnown",
					"canToggle"
				])) throw new TypeError("Invalid MCP entry");
				return {
					id: row.id,
					name: row.name,
					source: row.source,
					origin: row.origin,
					group: row.group,
					enabled: row.enabled,
					stateKnown: row.stateKnown,
					runtimeState: row.runtimeState,
					transport: row.transport,
					canToggle: row.canToggle,
					reason: row.reason,
					tools: row.tools.slice()
				};
			});
			return {
				complete: value.complete,
				servers
			};
		} })
	};
	function mcpRpc(method, fields) {
		return {
			id: `power-dsh#powerDsh/${method}`,
			service: "powerDsh",
			namespace: "powerDsh",
			method,
			invocation: { kind: "direct" },
			parameters: fields.map((name) => ({
				name,
				wire: name,
				source: "json",
				codec: name === "enabled" ? booleanCodec : stringCodec
			})),
			result: mcpCatalogCodec
		};
	}
	const LIST_MCP_SERVERS_RPC = mcpRpc("listMcpServers", []);
	const SET_MCP_SERVER_ENABLED_RPC = mcpRpc("setMcpServerEnabled", ["id", "enabled"]);
	const rpc$11 = [LIST_MCP_SERVERS_RPC, SET_MCP_SERVER_ENABLED_RPC];

// src/features/notifications/styles.ts
	const styles$6 = `
.power-dsh-page .power-dsh-sound-controls { display:flex; align-items:center; justify-content:flex-end; flex-wrap:wrap; gap:8px; flex:none; max-width:50%; }
.power-dsh-page .power-dsh-sound-select { box-sizing:border-box; display:inline-flex; align-items:center; justify-content:center; gap:12px; min-height:36px; max-width:100%; padding:0 14px; border:0; border-radius:var(--dsw-radius-md); background:var(--dsw-alias-bg-module-platform); color:var(--dsw-alias-label-primary); font:inherit; font-size:14px; line-height:22px; cursor:pointer; }
.power-dsh-page .power-dsh-sound-preview { display:inline-flex; align-items:center; justify-content:center; flex:none; width:36px; height:36px; padding:0; border:0; border-radius:var(--dsw-radius-md); background:transparent; color:var(--dsw-alias-label-secondary); cursor:pointer; }
.power-dsh-page .power-dsh-sound-preview:disabled { opacity:.5; cursor:default; }
.power-dsh-page .power-dsh-sound-preview:focus-visible { outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; }
@media (hover:hover) { .power-dsh-page .power-dsh-sound-preview:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover); } }
.power-dsh-page .power-dsh-sound-select:disabled { opacity:.5; cursor:default; }
.power-dsh-page .power-dsh-sound-select:focus-visible { outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; }
@media (hover:hover) { .power-dsh-page .power-dsh-sound-select:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover); } }
`;

// src/features/notifications/client.ts
	function createClientFeature$13(runtime, env) {
		const { React, h, Menu, observable, useSnapshot, errorFeedback } = runtime;
		const { ctx, form, source, t, savePreference } = env;
		const styles = styles$6;
		let active = true;
		ctx.effect(() => () => {
			active = false;
		});
		function notificationRunner(ctx, form, t, reportError, playSound) {
			const records = /* @__PURE__ */ new Map();
			const visible = /* @__PURE__ */ new Map();
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
				if (!active || window.Notification?.permission !== "granted") return;
				try {
					const preferences = form.getSnapshot().value;
					const sound = preferences?.notificationSound || "default";
					const localTone = preferences?.notificationSoundEnabled === true && sound !== "default" && ctx.connection.isLoopback;
					const notification = new window.Notification(t(`notification${kind}`), {
						body: (row.displayTitle || row.title || t("notificationBody")).slice(0, 160),
						tag: `power-dsh:${id}`,
						...preferences?.notificationSoundEnabled === true && !localTone ? { renotify: true } : { silent: true }
					});
					visible.get(id)?.close();
					visible.set(id, notification);
					if (localTone) playSound(sound, false).catch(() => {
						if (active) reportError("notificationSoundFailed");
					});
					notification.onclick = () => {
						window.focus();
						notification.close();
					};
					notification.onclose = () => {
						if (visible.get(id) === notification) visible.delete(id);
					};
					notification.onerror = () => {
						if (active) reportError("notificationFailed");
						notification.close();
					};
				} catch (_error) {
					reportError("notificationFailed");
				}
			}
			function run(seed = false) {
				if (!active) return;
				const currentGeneration = ctx.connection.generation.getSnapshot();
				if (generation !== currentGeneration) {
					generation = currentGeneration;
					records.clear();
					closeAll();
					seed = true;
				}
				if (generation === void 0) {
					records.clear();
					return;
				}
				const settings = form.getSnapshot();
				const nextEnabled = settings.status === "ready" && settings.value?.notificationsEnabled === true;
				if (nextEnabled !== enabled) {
					seed = true;
					enabled = nextEnabled;
					if (!enabled) closeAll();
				}
				const list = ctx.sessions.list.getSnapshot();
				if (list.phase !== "ready") {
					records.clear();
					return;
				}
				const statuses = ctx.uiSession.sessionStatus.getSnapshot();
				for (const id of list.ids) {
					const row = list.byId[id];
					if (row.origin === "subagent") continue;
					const status = statuses.get(id);
					const pending = status?.pendingInteraction;
					const running = status?.running ?? row.running;
					const outcome = row.projectionValues?.powerDshNotifications;
					const previous = records.get(id);
					const current = previous && !seed ? previous : {
						seq: outcome?.seq,
						running,
						attention: false,
						seen: new Set(pending ? [pending.key] : [])
					};
					if (running && !current.running) current.attention = false;
					const fresh = previous !== void 0 && !seed;
					const pendingFresh = pending && !current.seen.has(pending.key);
					if (pending) current.seen.add(pending.key);
					if (fresh && pendingFresh && pending.review === void 0 && pending.answerable !== false && running && (pending.kind === "approval" || pending.kind === "question" || pending.kind === "plan-review")) {
						current.attention = true;
						if (enabled) send(id, row, pending.kind === "approval" ? "Approval" : "Input");
					}
					const advanced = outcome && current.seq !== void 0 && outcome.seq > current.seq;
					if (fresh && advanced && enabled) {
						if (outcome.reason === "blocked") {
							if (!pending && !current.attention) send(id, row, "Input");
						} else if (!pending && (outcome.reason === "completed" || outcome.reason === "error")) {
							if (!(!document.hidden && document.hasFocus() && (row.retainedBy?.mainView ?? 0) > 0)) send(id, row, outcome.reason === "error" ? "Error" : "Complete");
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
			return () => {
				active = false;
				offList();
				offStatus();
				offForm();
				offConnection();
				closeAll();
				records.clear();
			};
		}
		let soundState = {
			status: "idle",
			value: null,
			error: "",
			playing: false
		};
		const soundsSource = observable(() => soundState);
		let soundConnection = null;
		let soundGeneration = 0;
		let soundPreview = null;
		const publishSound = (patch) => {
			soundState = {
				...soundState,
				...patch
			};
			soundsSource.notify();
		};
		ctx.effect(() => () => {
			soundGeneration++;
			soundPreview?.close();
		});
		const loadSystemSounds = async () => {
			if (!active || soundState.status === "loading") return;
			if (!soundConnection) {
				publishSound({
					status: "waiting",
					error: ""
				});
				return;
			}
			if (!soundConnection.isLoopback) {
				publishSound({
					status: "remote",
					value: null,
					error: ""
				});
				return;
			}
			const generation = ++soundGeneration;
			publishSound({
				status: "loading",
				error: ""
			});
			try {
				const reply = await ctx.remote.powerDsh.listSystemSounds();
				if (!active || generation !== soundGeneration) return;
				if (!reply.ok) throw new Error("notificationSoundUnavailable");
				publishSound({
					status: "ready",
					value: reply.value,
					error: ""
				});
			} catch (_failure) {
				if (active && generation === soundGeneration) publishSound({
					status: "error",
					error: "notificationSoundUnavailable"
				});
			}
		};
		const playSystemSound = async (id, preview) => {
			const preferences = form.getSnapshot();
			if (!active || !soundConnection?.isLoopback || preferences.status !== "ready" || !preferences.value?.notificationsEnabled || !preferences.value?.notificationSoundEnabled) return;
			if (preview && (!preferences.writable || soundState.playing || soundState.status !== "ready" || (preferences.value?.notificationSound || "default") !== id || !soundState.value?.sounds.some((sound) => sound.id === id))) return;
			if (preview) publishSound({
				playing: true,
				error: ""
			});
			try {
				if (preview && id === "default") {
					if (window.Notification?.permission !== "granted") throw new Error("notificationPermission");
					soundPreview?.close();
					soundPreview = new window.Notification(t("notificationSoundTestTitle"), {
						body: t("notificationSoundTestBody"),
						tag: `power-dsh-sound-test:${Date.now()}`,
						renotify: true
					});
					soundPreview.onerror = () => {
						if (active) publishSound({ error: "notificationSoundFailed" });
					};
				} else if (!(await ctx.remote.powerDsh.playSystemSound(id, preview)).ok) throw new Error("notificationSoundFailed");
			} catch (failure) {
				if (active) publishSound({ error: errorMessage(failure) === "notificationPermission" ? "notificationPermission" : "notificationSoundFailed" });
				if (!preview) throw failure;
			} finally {
				if (active && preview) publishSound({ playing: false });
			}
		};
		let notificationError = "";
		let notificationReady = false;
		const notificationsSource = observable(() => notificationSnapshot);
		let notificationSnapshot = { error: "" };
		const reportNotificationError = (error) => {
			if (!active || notificationError === error) return;
			notificationError = error;
			notificationSnapshot = { error };
			notificationsSource.notify();
		};
		const checkNotificationPermission = () => {
			if (form.getSnapshot().value?.notificationsEnabled !== true) {
				soundPreview?.close();
				reportNotificationError("");
				return;
			}
			reportNotificationError(!window.Notification ? "notificationUnsupported" : window.Notification.permission !== "granted" ? "notificationPermission" : !notificationReady ? "notificationUnavailable" : "");
		};
		ctx.inject(["connection"], (child) => {
			child.effect(() => {
				soundConnection = child.connection;
				if (soundState.status !== "idle") loadSystemSounds();
				return () => {
					soundConnection = null;
					soundGeneration++;
					publishSound({
						status: "waiting",
						value: null,
						error: "",
						playing: false
					});
				};
			});
		});
		ctx.inject([
			"sessions",
			"uiSession",
			"connection"
		], (child) => {
			child.effect(() => {
				notificationReady = true;
				const dispose = notificationRunner(child, form, t, reportNotificationError, playSystemSound);
				checkNotificationPermission();
				return () => {
					dispose();
					notificationReady = false;
					checkNotificationPermission();
				};
			});
		});
		ctx.effect(() => form.subscribe(checkNotificationPermission));
		ctx.effect(() => {
			window.addEventListener("focus", checkNotificationPermission);
			checkNotificationPermission();
			return () => window.removeEventListener("focus", checkNotificationPermission);
		});
		const setNotificationsEnabled = async (enabled) => {
			if (enabled) {
				if (!notificationReady) throw new Error(t("notificationUnavailable"));
				if (!window.Notification) throw new Error(t("notificationUnsupported"));
				const permission = window.Notification.permission === "default" ? await window.Notification.requestPermission() : window.Notification.permission;
				if (!active) return;
				if (permission !== "granted") throw new Error(t("notificationPermission"));
			}
			await savePreference("notificationsEnabled", enabled, "notificationUnavailable");
			reportNotificationError("");
		};
		const mainSetting = {
			field: "notificationsEnabled",
			description: "notificationsDescription",
			save: (next) => setNotificationsEnabled(next === true)
		};
		const soundSetting = {
			field: "notificationSoundEnabled",
			save: (next) => savePreference("notificationSoundEnabled", next === true, "notificationUnavailable"),
			canSave: () => source.getSnapshot().value?.notificationsEnabled === true
		};
		const toneSetting = {
			field: "notificationSound",
			hidden: true,
			canSave: (next) => {
				const sounds = soundsSource.getSnapshot();
				const config = source.getSnapshot();
				return config.value?.notificationsEnabled === true && config.value?.notificationSoundEnabled === true && sounds.status === "ready" && !sounds.playing && !!sounds.value?.sounds.some((sound) => sound.id === next);
			},
			save: async (next, { mounted }) => {
				if (typeof next === "string" && source.getSnapshot().value?.notificationSound !== next) await savePreference("notificationSound", next, "notificationUnavailable", "string");
				if (mounted.current && typeof next === "string") await playSystemSound(next, true);
			}
		};
		function useSettings({ snapshot, disabled, saving, error, save, id }) {
			const sounds = useSnapshot(soundsSource);
			const notifications = useSnapshot(notificationsSource);
			const [soundMenuOpen, setSoundMenuOpen] = React.useState(false);
			React.useEffect(() => {
				loadSystemSounds();
			}, []);
			React.useEffect(() => {
				if (snapshot.value?.notificationsEnabled !== true) setSoundMenuOpen(false);
			}, [snapshot.value?.notificationsEnabled]);
			const soundName = (sound) => sound.id === "default" ? t("notificationSoundDefault") : sound.id.startsWith("win:") ? t(`sound${sound.id.slice(4)}`) : sound.name;
			function soundRow() {
				if (snapshot.value?.notificationsEnabled !== true) return null;
				const field = "notificationSoundEnabled";
				const control = `${id}-${field}`;
				const busy = saving?.field === field;
				const checked = busy ? saving.value === true : snapshot.value?.[field] === true;
				const soundId = snapshot.value?.notificationSound || "default";
				const choices = sounds.value?.sounds || [{
					id: "default",
					name: "default"
				}];
				const current = choices.find((sound) => sound.id === soundId);
				const soundDisabled = disabled || !snapshot.value?.notificationsEnabled || !snapshot.value?.notificationSoundEnabled || sounds.status !== "ready" || sounds.playing;
				const soundError = error?.field === "notificationSound" || error?.field === field ? error.message : sounds.error ? t(sounds.error) : "";
				return h(React.Fragment, { key: field }, h("div", { className: "power-dsh-setting-row" }, h("div", { className: "power-dsh-setting-copy" }, h("div", {
					id: `${control}-label`,
					className: "power-dsh-setting-label"
				}, t(field)), h("div", {
					id: `${control}-description`,
					className: "power-dsh-description"
				}, t("notificationSoundDescription")), error?.field === field && errorFeedback({
					t,
					id: `${control}-error`,
					message: error.message,
					code: "PD-NOTIFICATION-SOUND-SAVE",
					operation: "settings.notificationSoundEnabled"
				})), h("button", {
					id: control,
					type: "button",
					role: "switch",
					className: "power-dsh-switch",
					"aria-checked": checked,
					"aria-labelledby": `${control}-label`,
					"aria-describedby": `${control}-description${error?.field === field ? ` ${control}-error` : ""}`,
					"aria-invalid": error?.field === field,
					"aria-busy": busy,
					disabled: disabled || !snapshot.value?.notificationsEnabled,
					onClick: () => {
						setSoundMenuOpen(false);
						return save(field, !checked);
					}
				}, h("span", {
					className: "power-dsh-switch-thumb",
					"aria-hidden": true
				}))), checked && h("div", { className: "power-dsh-setting-row" }, h("div", { className: "power-dsh-setting-copy" }, h("div", {
					id: `${control}-sound-label`,
					className: "power-dsh-setting-label"
				}, t("notificationSound")), h("div", {
					id: `${control}-sound-description`,
					className: "power-dsh-description"
				}, t("notificationToneDescription")), soundError && error?.field !== field && errorFeedback({
					t,
					id: `${control}-sound-error`,
					message: soundError,
					code: "PD-NOTIFICATION-SOUND",
					operation: sounds.status === "error" ? "listSystemSounds" : "playSystemSound",
					retry: sounds.status === "error" ? loadSystemSounds : void 0
				})), h("div", { className: "power-dsh-sound-controls" }, h(Menu, {
					open: soundMenuOpen && !soundDisabled,
					onClose: () => setSoundMenuOpen(false),
					selectedId: soundId,
					align: "end",
					portal: true,
					autoFocus: true,
					minWidthFromAnchor: true,
					items: choices.map((sound) => ({
						id: sound.id,
						label: soundName(sound)
					})),
					onSelect: (next) => {
						setSoundMenuOpen(false);
						return save("notificationSound", next);
					},
					anchor: h("button", {
						type: "button",
						className: "power-dsh-sound-select",
						disabled: soundDisabled,
						"aria-label": t("notificationSound"),
						"aria-describedby": `${control}-sound-description${soundError && error?.field !== field ? ` ${control}-sound-error` : ""}`,
						"aria-invalid": Boolean(soundError && error?.field !== field),
						"aria-haspopup": "menu",
						"aria-expanded": soundMenuOpen && !soundDisabled,
						"aria-busy": sounds.playing || saving?.field === "notificationSound",
						onClick: () => {
							if (!soundDisabled) setSoundMenuOpen((value) => !value);
						}
					}, sounds.status === "remote" ? t("notificationSoundDefault") : current ? soundName(current) : t(sounds.status === "ready" ? "notificationSoundMissing" : "notificationSoundDefault"), h("svg", {
						width: 16,
						height: 16,
						viewBox: "0 0 16 16",
						fill: "none",
						stroke: "currentColor",
						strokeWidth: 1.4,
						strokeLinecap: "round",
						strokeLinejoin: "round",
						"aria-hidden": true,
						focusable: false
					}, h("path", { d: "m4 6 4 4 4-4" })))
				}), h("button", {
					type: "button",
					className: "power-dsh-sound-preview",
					disabled: soundDisabled || !current,
					title: t("notificationSoundPreview"),
					"aria-label": t("notificationSoundPreview"),
					"aria-busy": sounds.playing,
					onClick: () => {
						if (!soundDisabled && current) return playSystemSound(soundId, true);
					}
				}, h("svg", {
					width: 20,
					height: 20,
					viewBox: "0 0 16 16",
					"aria-hidden": true,
					focusable: false
				}, h("circle", {
					cx: 8,
					cy: 8,
					r: 6,
					fill: "none",
					stroke: "currentColor",
					strokeWidth: 1.3
				}), h("path", {
					d: "m6.5 5 4 3-4 3z",
					fill: "currentColor"
				}))))));
			}
			return [{
				...mainSetting,
				error: notifications.error && t(notifications.error)
			}, {
				...soundSetting,
				render: soundRow
			}];
		}
		return {
			settings: [
				mainSetting,
				soundSetting,
				toneSetting
			],
			useSettings,
			styles,
			api: {
				notificationsSource,
				setNotificationsEnabled,
				soundsSource,
				loadSystemSounds,
				playSystemSound
			}
		};
	}

// src/features/notifications/definition.ts
	const definition$13 = Object.freeze({
		id: "notifications",
		category: "general",
		order: 0,
		keys: Object.freeze([
			"notificationsEnabled",
			"notificationSoundEnabled",
			"notificationSound"
		]),
		spec: "src/features/notifications/spec.md"
	});

// src/features/notifications/locales.ts
	const locales$14 = {
		"en": {
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
			"notificationUnavailable": "Task notifications have not loaded yet. Re-enable power-dsh, then try again."
		},
		"zh": {
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
			"notificationUnavailable": "任务通知尚未加载，请重新启用 power-dsh 后重试。"
		}
	};

// src/features/notifications/rpc.ts
	const soundCatalogCodec = {
		mode: "strict",
		typeSymbol: "power-dsh#SystemSounds",
		create: () => ({ parse(value) {
			if (!isRecord(value) || !isOneOf(value.platform, [
				"darwin",
				"win32",
				"other"
			]) || !isArray(value.sounds) || !value.sounds.every((row) => isRecord(row) && typeof row.id === "string" && typeof row.name === "string")) throw new TypeError("Invalid system sounds");
			return {
				platform: value.platform,
				sounds: value.sounds.map((row) => ({
					id: row.id,
					name: row.name
				}))
			};
		} })
	};
	const LIST_SYSTEM_SOUNDS_RPC = {
		id: "power-dsh#powerDsh/listSystemSounds",
		service: "powerDsh",
		namespace: "powerDsh",
		method: "listSystemSounds",
		invocation: { kind: "direct" },
		parameters: [],
		result: soundCatalogCodec
	};
	const PLAY_SYSTEM_SOUND_RPC = {
		id: "power-dsh#powerDsh/playSystemSound",
		service: "powerDsh",
		namespace: "powerDsh",
		method: "playSystemSound",
		invocation: { kind: "direct" },
		parameters: [{
			name: "id",
			wire: "id",
			source: "json",
			codec: stringCodec
		}, {
			name: "preview",
			wire: "preview",
			source: "json",
			codec: booleanCodec
		}],
		result: {
			mode: "strict",
			typeSymbol: "power-dsh#SoundPlayback",
			create: () => ({ parse(value) {
				if (!isRecord(value) || typeof value.played !== "boolean") throw new TypeError("Invalid sound playback");
				return { played: value.played };
			} })
		}
	};
	const rpc$10 = [LIST_SYSTEM_SOUNDS_RPC, PLAY_SYSTEM_SOUND_RPC];

// src/features/personalization/styles.ts
	const styles$5 = `
.power-dsh-page .power-dsh-prompt-editor { display:flex; flex-direction:column; gap:8px; padding:16px 0; }
.power-dsh-page .power-dsh-prompt-input { box-sizing:border-box; display:block; width:100%; max-width:100%; min-height:260px; margin:0; padding:12px 14px; resize:vertical; border:.5px solid var(--dsw-alias-border-l4); border-radius:var(--dsw-radius-lg); background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); font:inherit; font-size:14px; line-height:22px; transition:border-color 120ms ease,box-shadow 120ms ease; }
.power-dsh-page .power-dsh-prompt-input::placeholder { color:var(--dsw-alias-label-caption); }
.power-dsh-page .power-dsh-prompt-input:focus { outline:none; border-color:var(--dsw-alias-border-l3); box-shadow:0 0 0 1px var(--dsw-alias-state-business-primary); }
.power-dsh-page .power-dsh-prompt-input[aria-invalid="true"] { border-color:var(--dsw-alias-state-error-primary); }
.power-dsh-page .power-dsh-prompt-input:disabled { opacity:.5; cursor:default; }
`;

// src/features/personalization/client.ts
	function createClientFeature$12(runtime, env) {
		const { React, h, observable, useSnapshot, useMounted, errorFeedback } = runtime;
		const { ctx, source, t, savePreference, preferenceSlot, namespace } = env;
		const styles = styles$11 + styles$5;
		function PersonalizationIcon({ size = 16 }) {
			return h("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.3,
				strokeLinecap: "round",
				"aria-hidden": true,
				focusable: false
			}, h("circle", {
				cx: 8,
				cy: 4.5,
				r: 2.5
			}), h("path", { d: "M3 14v-1a5 5 0 0 1 10 0v1" }));
		}
		function PersonalizationPage({ t, source, instructionsSource, loadInstructions, saveInstructions }) {
			const snapshot = useSnapshot(source);
			const instructions = useSnapshot(instructionsSource);
			const settingsPath = instructions.value?.path ?? "";
			const [saving, setSaving] = React.useState(false);
			const [error, setError] = React.useState(null);
			const [draft, setDraft] = React.useState(null);
			const pending = React.useRef(false);
			const mounted = useMounted();
			const id = React.useId();
			const savedPrompt = instructions.value?.text ?? "";
			const prompt = draft?.text ?? savedPrompt;
			const dirty = prompt !== savedPrompt;
			const conflict = draft !== null && draft.base !== instructions.value?.revision && dirty;
			const tooLong = prompt.length > 2e4;
			const ready = snapshot.status === "ready" && instructions.status === "ready";
			const disabled = !ready || !snapshot.writable || saving || !snapshot.value?.personalizationEnabled;
			const noticeError = Boolean(instructions.error) || snapshot.status === "unavailable" || instructions.status === "error";
			const notice = instructions.error || (snapshot.status === "unavailable" ? t("unavailable") : !ready ? t(snapshot.status === "loading" || instructions.status === "loading" ? "loading" : "unavailable") : !snapshot.writable ? t("readOnly") : null);
			React.useEffect(() => {
				loadInstructions();
				const refresh = () => {
					loadInstructions();
				};
				window.addEventListener("focus", refresh);
				return () => window.removeEventListener("focus", refresh);
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
					if (mounted.current) setError(errorMessage(failure) || t("saveFailed"));
				} finally {
					pending.current = false;
					if (mounted.current) setSaving(false);
				}
			}
			return h("section", {
				className: "power-dsh-page",
				"aria-label": t("personalizationTab")
			}, h("style", null, styles), h("header", null, h("h2", { className: "power-dsh-title" }, t("personalizationTab")), h("p", {
				id: `${id}-prompt-description`,
				className: "power-dsh-description"
			}, settingsPath && t("settingsLocation").replace("{path}", () => settingsPath))), notice && (noticeError ? errorFeedback({
				t,
				message: notice,
				code: "PD-PERSONALIZATION-LOAD",
				operation: "readPersonalization",
				placement: "page",
				retry: loadInstructions
			}) : h("p", {
				className: "power-dsh-notice",
				role: "status",
				"data-tone": "neutral"
			}, notice)), h("div", { className: "power-dsh-prompt-editor" }, h("textarea", {
				id: `${id}-globalPrompt`,
				className: "power-dsh-prompt-input",
				value: prompt,
				"aria-label": t("globalPrompt"),
				placeholder: t("globalPromptPlaceholder"),
				disabled,
				"aria-describedby": `${id}-prompt-description${conflict || tooLong || error ? ` ${id}-prompt-error` : ""}`,
				"aria-invalid": Boolean(conflict || tooLong || error),
				onChange: (event) => {
					setDraft({
						text: event.target.value,
						base: draft?.base ?? instructions.value?.revision
					});
					setError(null);
				}
			}), (conflict || tooLong || error) && errorFeedback({
				t,
				id: `${id}-prompt-error`,
				message: conflict ? t("promptConflict") : tooLong ? t("promptTooLong") : error,
				code: conflict ? "PD-PERSONALIZATION-CONFLICT" : tooLong ? "PD-PERSONALIZATION-LIMIT" : "PD-PERSONALIZATION-SAVE",
				operation: "savePersonalization"
			}), h("div", { className: "power-dsh-prompt-actions" }, h("button", {
				type: "button",
				className: "power-dsh-prompt-action",
				disabled: disabled || draft === null,
				onClick: () => {
					setDraft(null);
					setError(null);
					loadInstructions();
				}
			}, t("cancel")), h("button", {
				type: "button",
				className: "power-dsh-prompt-action",
				"data-primary": true,
				disabled: disabled || !dirty || conflict || tooLong,
				"aria-busy": saving,
				onClick: savePrompt
			}, t(saving ? "saving" : "save")))));
		}
		let active = true;
		let instructions = {
			status: "loading",
			value: null,
			error: ""
		};
		const instructionsSource = observable(() => instructions);
		let fileGeneration = 0;
		ctx.effect(() => () => {
			active = false;
			fileGeneration++;
		});
		const loadInstructions = async () => {
			const generation = ++fileGeneration;
			try {
				const result = await ctx.remote.powerDsh.readPersonalization();
				if (!active || generation !== fileGeneration) return;
				if (!result.ok) throw new Error(result.error.message);
				instructions = {
					status: "ready",
					value: result.value,
					error: ""
				};
			} catch (failure) {
				if (!active || generation !== fileGeneration) return;
				instructions = {
					...instructions,
					status: "error",
					error: errorMessage(failure) || t("unavailable")
				};
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
			instructions = {
				status: "ready",
				value: result.value,
				error: ""
			};
			instructionsSource.notify();
		};
		preferenceSlot("personalizationEnabled", "settings.section", {
			id: "power-dsh-personalization",
			order: 51,
			locale: namespace,
			label: () => t("personalizationTab")
		}, (props) => h(PersonalizationPage, {
			...props,
			source,
			instructionsSource,
			loadInstructions,
			saveInstructions
		}));
		preferenceSlot("personalizationEnabled", "settings.section.icon", { id: "power-dsh-personalization" }, PersonalizationIcon);
		return {
			settings: [{
				field: "personalizationEnabled",
				description: "personalizationDescription",
				save: (next) => savePreference("personalizationEnabled", next === true, "settingsOutdated"),
				hideError: true
			}],
			api: {
				instructionsSource,
				loadInstructions,
				saveInstructions
			}
		};
	}

// src/features/personalization/definition.ts
	const definition$12 = Object.freeze({
		id: "personalization",
		category: "enhance",
		order: 9,
		keys: Object.freeze(["personalizationEnabled"]),
		spec: "src/features/personalization/spec.md"
	});

// src/features/personalization/locales.ts
	const locales$13 = {
		"en": {
			"personalizationTab": "Global instructions",
			"personalizationEnabled": "Global instructions",
			"personalizationDescription": "Edit global instructions in settings",
			"settingsLocation": "{path}",
			"globalPromptPlaceholder": "Add custom instructions",
			"globalPrompt": "Global instructions",
			"promptTooLong": "Instructions exceed the 20,000 character limit.",
			"promptConflict": "These instructions changed elsewhere. Copy your draft, then cancel to load the latest version."
		},
		"zh": {
			"personalizationTab": "全局指令",
			"personalizationEnabled": "全局指令",
			"personalizationDescription": "在设置中编辑全局指令",
			"settingsLocation": "{path}",
			"globalPromptPlaceholder": "添加自定义指令",
			"globalPrompt": "全局指令",
			"promptTooLong": "全局指令超过 20,000 字符上限。",
			"promptConflict": "内容已在其他位置更改，请先复制草稿，再取消以载入最新内容。"
		}
	};

// src/features/personalization/rpc.ts
	const fileCodec = {
		mode: "strict",
		typeSymbol: "power-dsh#PersonalizationFile",
		create: () => ({ parse(value) {
			if (!isRecord(value) || typeof value.path !== "string" || typeof value.text !== "string" || typeof value.revision !== "string" || !/^[a-f\d]{64}$/.test(value.revision)) throw new TypeError("Invalid instruction file");
			return {
				path: value.path,
				text: value.text,
				revision: value.revision
			};
		} })
	};
	function fileRpc(method, fields) {
		return {
			id: `power-dsh#powerDsh/${method}`,
			service: "powerDsh",
			namespace: "powerDsh",
			method,
			invocation: { kind: "direct" },
			parameters: fields.map((name) => ({
				name,
				wire: name,
				source: "json",
				codec: stringCodec
			})),
			result: fileCodec
		};
	}
	const READ_PERSONALIZATION_RPC = fileRpc("readPersonalization", []);
	const SAVE_PERSONALIZATION_RPC = fileRpc("savePersonalization", ["text", "revision"]);
	const rpc$9 = [READ_PERSONALIZATION_RPC, SAVE_PERSONALIZATION_RPC];

// src/features/refresh-button/client.ts
	function createClientFeature$11(runtime, env) {
		const { React, useSnapshot } = runtime;
		const { source, t } = env;
		function useHeaderAction({ wide, latestWide, mounted }) {
			const config = useSnapshot(source);
			const visible = wide && config.status === "ready" && config.value?.showRefreshButton === true;
			const [error, setError] = React.useState("");
			const canUse = () => {
				const current = source.getSnapshot();
				return mounted.current && latestWide.current && current.status === "ready" && current.value?.showRefreshButton === true;
			};
			return {
				id: "refresh",
				label: t("refresh"),
				visible,
				error,
				canUse,
				select() {
					setError("");
					try {
						window.location.reload();
					} catch (_failure) {
						setError(t("refreshFailed"));
					}
				}
			};
		}
		return {
			settings: [{
				field: "showRefreshButton",
				description: "refreshDescription"
			}],
			headerAction: useHeaderAction
		};
	}

// src/features/refresh-button/definition.ts
	const definition$11 = Object.freeze({
		id: "refresh-button",
		category: "other",
		order: 1,
		keys: Object.freeze(["showRefreshButton"]),
		spec: "src/features/refresh-button/spec.md"
	});

// src/features/refresh-button/locales.ts
	const locales$12 = {
		"en": {
			"showRefreshButton": "Show refresh button",
			"refreshDescription": "Reload the current interface",
			"refresh": "Refresh interface",
			"refreshFailed": "Could not refresh the interface. Please try again."
		},
		"zh": {
			"showRefreshButton": "显示刷新按钮",
			"refreshDescription": "重新加载当前界面",
			"refresh": "刷新界面",
			"refreshFailed": "无法刷新界面，请重试。"
		}
	};

// src/features/restart-button/client.ts
	function createClientFeature$10(runtime, env) {
		const { React, h, Modal, Button, observable, useSnapshot } = runtime;
		const { ctx, form, source, t } = env;
		function isMacDesktop() {
			return window.dshDesktop?.protocolVersion === 1 && window.location.protocol === "dsh-app:" && document.documentElement.getAttribute("data-platform") === "darwin";
		}
		let active = true;
		ctx.effect(() => () => {
			active = false;
			restartGeneration++;
		});
		let restartState = {
			supported: false,
			running: false,
			error: ""
		};
		const restartSource = observable(() => restartState);
		let restartReadPending = false;
		let restartGeneration = 0;
		let restartWritePending = false;
		const publishRestart = (patch) => {
			restartState = {
				...restartState,
				...patch
			};
			restartSource.notify();
		};
		const loadRestartStatus = async () => {
			if (!active || !isMacDesktop() || restartReadPending || restartWritePending) return;
			restartReadPending = true;
			const generation = restartGeneration;
			try {
				const reply = await ctx.remote.powerDsh.restartStatus();
				if (!active || restartWritePending || generation !== restartGeneration) return;
				if (!reply.ok) throw new Error("restartUnavailable");
				publishRestart(reply.value);
			} catch (_failure) {
				if (active && generation === restartGeneration) publishRestart({ error: "restartUnavailable" });
			} finally {
				restartReadPending = false;
			}
		};
		const restartApp = async () => {
			if (!active || !isMacDesktop() || restartWritePending || restartState.running || !restartState.supported || form.getSnapshot().value?.showRestartButton !== true) return;
			restartWritePending = true;
			restartGeneration++;
			publishRestart({
				running: true,
				error: ""
			});
			try {
				const reply = await ctx.remote.powerDsh.restartApp();
				if (!reply.ok) throw new Error(reply.error.message);
			} catch (failure) {
				const message = errorMessage(failure);
				if (active) publishRestart({
					running: false,
					error: message === "restartBusy" || message === "restartUnavailable" ? message : "restartFailed"
				});
			} finally {
				restartWritePending = false;
				if (active && restartState.running) loadRestartStatus();
			}
		};
		function useHeaderAction({ wide, latestWide, mounted }) {
			const config = useSnapshot(source);
			const status = useSnapshot(restartSource);
			const requested = wide && config.status === "ready" && config.value?.showRestartButton === true && isMacDesktop();
			const visible = requested && status.supported;
			React.useEffect(() => {
				if (!requested) return;
				loadRestartStatus();
				const timer = window.setInterval(loadRestartStatus, 2e3);
				return () => window.clearInterval(timer);
			}, [requested]);
			const [confirming, setConfirming] = React.useState(false);
			const confirmation = React.useRef(false);
			const closeConfirmation = () => {
				confirmation.current = false;
				setConfirming(false);
			};
			React.useEffect(() => {
				if (!visible || status.running) closeConfirmation();
			}, [visible, status.running]);
			const canUse = () => {
				const current = source.getSnapshot();
				const status = restartSource.getSnapshot();
				return mounted.current && latestWide.current && current.status === "ready" && current.value?.showRestartButton === true && isMacDesktop() && status.supported && !status.running;
			};
			const request = confirmation.current;
			const confirmRestart = () => {
				if (!request || confirmation.current !== request || !canUse()) return;
				closeConfirmation();
				restartApp();
			};
			return {
				id: "restart",
				label: t("restart"),
				visible,
				disabled: status.running,
				error: status.error && t(status.error),
				canUse,
				isConfirming: () => Boolean(confirmation.current),
				select() {
					if (!confirmation.current) {
						confirmation.current = {};
						setConfirming(true);
					}
				},
				dialog: h(Modal, {
					open: confirming && visible && !status.running,
					onClose: closeConfirmation,
					title: t("restart"),
					closeLabel: t("close"),
					description: t("restartConfirm"),
					footer: h(React.Fragment, null, h(Button, {
						variant: "outline",
						"data-modal-autofocus": true,
						onClick: closeConfirmation
					}, t("cancel")), h(Button, {
						variant: "primary",
						disabled: status.running,
						onClick: confirmRestart
					}, t("restartAction")))
				})
			};
		}
		return {
			settings: [{
				field: "showRestartButton",
				description: "restartDescription",
				hidden: !isMacDesktop()
			}],
			headerAction: useHeaderAction,
			api: {
				restartSource,
				loadRestartStatus,
				restartApp
			}
		};
	}

// src/features/restart-button/definition.ts
	const definition$10 = Object.freeze({
		id: "restart-button",
		category: "other",
		order: 2,
		keys: Object.freeze(["showRestartButton"]),
		spec: "src/features/restart-button/spec.md"
	});

// src/features/restart-button/locales.ts
	const locales$11 = {
		"en": {
			"showRestartButton": "Show restart button",
			"restartDescription": "Restart the application",
			"restart": "Restart application",
			"restartConfirm": "Running tasks will stop and unsaved content may be lost.",
			"restartAction": "Restart application",
			"restartFailed": "Could not restart DSH. Check whether quitting was cancelled, then try again.",
			"restartUnavailable": "Restart is unavailable. Re-enable PowerDSH and try again.",
			"restartBusy": "DSH is already preparing to restart."
		},
		"zh": {
			"showRestartButton": "显示重启按钮",
			"restartDescription": "重新启动应用",
			"restart": "重启应用",
			"restartConfirm": "运行中的任务会停止，未保存的内容可能丢失。",
			"restartAction": "重启应用",
			"restartFailed": "未能重启 DSH。请检查是否取消了退出，然后重试。",
			"restartUnavailable": "重启暂不可用，请重新启用 PowerDSH 后重试。",
			"restartBusy": "DSH 正在准备重启。"
		}
	};

// src/features/restart-button/rpc.ts
	const RESTART_STATUS_RPC = {
		id: "power-dsh#powerDsh/restartStatus",
		service: "powerDsh",
		namespace: "powerDsh",
		method: "restartStatus",
		invocation: { kind: "direct" },
		parameters: [],
		result: {
			mode: "strict",
			typeSymbol: "power-dsh#RestartStatus",
			create: () => ({ parse(value) {
				if (!isRecord(value) || typeof value.supported !== "boolean" || typeof value.running !== "boolean" || !isOneOf(value.error, ["", "restartFailed"])) throw new TypeError("Invalid restart status");
				return {
					supported: value.supported,
					running: value.running,
					error: value.error
				};
			} })
		}
	};
	const RESTART_APP_RPC = {
		id: "power-dsh#powerDsh/restartApp",
		service: "powerDsh",
		namespace: "powerDsh",
		method: "restartApp",
		invocation: { kind: "direct" },
		parameters: [],
		result: {
			mode: "strict",
			typeSymbol: "power-dsh#RestartAccepted",
			create: () => ({ parse(value) {
				if (!isRecord(value) || value.accepted !== true) throw new TypeError("Invalid restart acceptance");
				return { accepted: true };
			} })
		}
	};
	const rpc$8 = [RESTART_STATUS_RPC, RESTART_APP_RPC];

// src/features/search-blocking/client.ts
	function createClientFeature$9(runtime, env) {
		const { ctx } = env;
		const setSearchBlocked = async (blocked) => {
			const result = await ctx.remote.powerDsh.setSearchBlocked(blocked);
			await ctx.configForms.describe().load();
			if (!result.ok) throw new Error(result.error.message);
		};
		return {
			settings: [{
				field: "blockOfficialSearch",
				description: "blockSearchDescription",
				save: (next) => setSearchBlocked(next === true)
			}],
			api: { setSearchBlocked }
		};
	}

// src/features/search-blocking/definition.ts
	const definition$9 = Object.freeze({
		id: "search-blocking",
		category: "simplify",
		order: 9,
		keys: Object.freeze(["blockOfficialSearch"]),
		spec: "src/features/search-blocking/spec.md"
	});

// src/features/search-blocking/locales.ts
	const locales$10 = {
		"en": {
			"blockOfficialSearch": "Disable official search",
			"blockSearchDescription": "Disable built-in WebSearch while keeping WebFetch."
		},
		"zh": {
			"blockOfficialSearch": "停用官方搜索",
			"blockSearchDescription": "关闭内置 WebSearch，保留 WebFetch。"
		}
	};

// src/features/search-blocking/rpc.ts
	const SEARCH_RPC = policyRpc("setSearchBlocked", "SearchPolicyResult");
	const rpc$7 = [SEARCH_RPC];

// src/features/skills/styles.ts
	const styles$4 = `
.power-dsh-page .power-dsh-skill-navigation { display:flex; align-items:flex-end; flex-wrap:wrap; gap:12px; margin-top:14px; border-bottom:.5px solid var(--dsw-alias-border-l2); }
.power-dsh-page .power-dsh-skill-navigation > .power-dsh-tabs { margin-top:0; border-bottom:0; }
.power-dsh-skills-page .power-dsh-tab:focus-visible { color:var(--dsw-alias-label-primary); }
.power-dsh-skills-page .power-dsh-tab:focus-visible::after { position:absolute; right:0; bottom:-1px; left:0; height:2px; border-radius:2px 2px 0 0; background:var(--dsw-alias-label-primary); content:""; }
@media (hover:hover) { .power-dsh-skills-page .power-dsh-tab:hover:not(:disabled) { color:var(--dsw-alias-label-primary); } }
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
`;

// src/features/skills/client.ts
	function createClientFeature$8(runtime, env) {
		const { React, h, Menu, Tooltip, observable, useSnapshot, useMounted, errorFeedback } = runtime;
		const { ctx, form, source, t, savePreference, preferenceSlot, namespace } = env;
		const styles = styles$11 + styles$8 + styles$4;
		const { SkillSearchIcon, SkillChevron } = createCatalogUI(runtime);
		function SkillsIcon({ size = 16 }) {
			return h("svg", {
				width: size,
				height: size,
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 2,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": true,
				focusable: false
			}, h("path", { d: "M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" }), h("path", { d: "M20 2v4" }), h("path", { d: "M22 4h-4" }), h("circle", {
				cx: 4,
				cy: 20,
				r: 2
			}));
		}
		function skillSource(source) {
			if (source === "user" || source.startsWith("user-")) return "skillPersonalSource";
			if (source === "project" || source.startsWith("project-")) return "skillProjectSource";
			if (source === "runtime" || source === "plugin") return "skillPluginSource";
			if (source === "custom") return "skillCustomSource";
			if (source === "bundled" || source.startsWith("bundled-")) return "skillBundledSource";
			return source;
		}
		function SkillsPage({ t, source, skillsSource, loadSkills, setSkillEnabled }) {
			const config = useSnapshot(source);
			const snapshot = useSnapshot(skillsSource);
			const catalog = snapshot.value;
			const scope = snapshot.scope || "user";
			const scopeTabs = React.useRef({});
			const [projectMenuOpen, setProjectMenuOpen] = React.useState(false);
			const [query, setQuery] = React.useState("");
			const [error, setError] = React.useState(null);
			const [groupsOpen, setGroupsOpen] = React.useState({
				preinstalled: false,
				personal: true
			});
			const mounted = useMounted();
			const pending = React.useRef(false);
			const id = React.useId();
			const busy = snapshot.status === "loading" || Boolean(snapshot.saving);
			React.useEffect(() => {
				setProjectMenuOpen(false);
			}, [scope, busy]);
			const writable = config.status === "ready" && config.writable && config.value?.skillManagerEnabled === true;
			const disabled = busy || !writable || snapshot.status !== "ready" || !catalog?.complete;
			React.useEffect(() => {
				loadSkills();
				const refresh = () => {
					loadSkills();
				};
				window.addEventListener("focus", refresh);
				return () => window.removeEventListener("focus", refresh);
			}, []);
			const sourceLabel = (value) => [
				"skillPersonalSource",
				"skillProjectSource",
				"skillPluginSource",
				"skillCustomSource",
				"skillBundledSource"
			].includes(value) ? t(value) : value;
			const displaySource = (skill) => scope === "user" ? [
				"runtime",
				"plugin",
				"bundled"
			].includes(skill.source) || skill.source.startsWith("bundled-") ? "skillBundledSource" : "skillPersonalSource" : skillSource(skill.source);
			const needle = query.trim().toLocaleLowerCase();
			const rows = (catalog?.skills ?? []).filter((skill) => `${skill.name} ${skill.description} ${skill.origin} ${sourceLabel(displaySource(skill))}`.toLocaleLowerCase().includes(needle));
			function changeScope(next) {
				if (busy || pending.current || scope === next) return;
				setError(null);
				return loadSkills("", next);
			}
			function scopeTab(value, label) {
				return h("button", {
					id: `${id}-scope-${value}`,
					type: "button",
					role: "tab",
					className: "power-dsh-tab",
					ref: (element) => {
						scopeTabs.current[value] = element;
					},
					"aria-selected": scope === value,
					"aria-controls": `${id}-skill-panel`,
					tabIndex: scope === value ? 0 : -1,
					disabled: busy,
					onClick: () => changeScope(value),
					onKeyDown: (event) => {
						const next = event.key === "Home" ? "user" : event.key === "End" ? "project" : event.key === "ArrowLeft" || event.key === "ArrowRight" ? value === "user" ? "project" : "user" : null;
						if (!next || busy || pending.current) return;
						event.preventDefault();
						changeScope(next);
						scopeTabs.current[next]?.focus();
					}
				}, t(label));
			}
			const projectWorkspaces = catalog?.workspaces ?? snapshot.workspaces;
			const projectContext = () => {
				if (scope !== "project") return null;
				const cwd = catalog?.cwd || snapshot.cwd;
				const values = projectWorkspaces ?? [];
				const selected = values.some((project) => project.path === cwd) ? cwd : "";
				const current = values.find((project) => project.path === selected);
				return h(Menu, {
					open: projectMenuOpen && !busy && values.length > 0,
					align: "end",
					portal: true,
					autoFocus: true,
					minWidthFromAnchor: true,
					className: "power-dsh-project-menu",
					selectedId: selected || void 0,
					items: values.map((project) => ({
						id: project.path,
						label: h("span", { title: project.path }, values.some((other) => other.path !== project.path && other.title === project.title) ? `${project.title} (${project.path})` : project.title)
					})),
					onClose: () => setProjectMenuOpen(false),
					onSelect: (path) => {
						setProjectMenuOpen(false);
						const latest = skillsSource.getSnapshot();
						const projects = latest.value?.workspaces ?? latest.workspaces ?? [];
						if (latest.scope !== "project" || latest.status === "loading" || latest.saving || pending.current || !projects.some((project) => project.path === path) || path === latest.cwd) return;
						setError(null);
						return loadSkills(path, "project");
					},
					anchor: h("button", {
						type: "button",
						className: "power-dsh-project-trigger",
						disabled: busy || values.length === 0,
						title: current?.path,
						"aria-label": t("skillWorkspace"),
						"aria-haspopup": "menu",
						"aria-expanded": projectMenuOpen && !busy && values.length > 0,
						onClick: () => {
							const latest = skillsSource.getSnapshot();
							if (latest.scope !== "project" || latest.status === "loading" || latest.saving || pending.current || !(latest.value?.workspaces ?? latest.workspaces ?? []).length) return;
							setProjectMenuOpen((open) => !open);
						}
					}, h("span", { className: "power-dsh-project-trigger-label" }, current?.title || t(values.length ? "skillWorkspace" : "skillNoProjects")), h("svg", {
						width: 16,
						height: 16,
						viewBox: "0 0 16 16",
						fill: "none",
						stroke: "currentColor",
						strokeWidth: 1.4,
						strokeLinecap: "round",
						strokeLinejoin: "round",
						"aria-hidden": true
					}, h("path", { d: "m4 6 4 4 4-4" })))
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
					if (mounted.current) setError({
						name: skill.name,
						message: errorMessage(failure) || t("skillSaveFailed")
					});
				} finally {
					pending.current = false;
				}
			}
			const renderCard = (skill) => {
				const index = catalog.skills.indexOf(skill);
				const control = `${id}-skill-${index}`;
				const identity = JSON.stringify([
					scope,
					catalog.cwd,
					skill.name
				]);
				const reasonKey = {
					"source-disabled": "skillSourceDisabled",
					incomplete: "skillIncomplete",
					unsupported: "skillUnsupported",
					"legacy-scope": "skillLegacyScope"
				}[skill.reason];
				const reason = reasonKey ? t(reasonKey) : skill.reason || !skill.canToggle ? t("skillUnavailable") : "";
				return h("li", {
					key: identity,
					className: "power-dsh-skill-card",
					"data-skill": skill.name
				}, h("div", { className: "power-dsh-skill-card-content" }, h("div", { className: "power-dsh-skill-card-main" }, h("span", {
					id: `${control}-name`,
					className: "power-dsh-skill-card-title",
					title: skill.path || skill.name
				}, skill.name), h("button", {
					id: control,
					type: "button",
					role: "switch",
					className: "power-dsh-switch",
					"aria-checked": skill.enabled,
					"aria-labelledby": `${control}-name`,
					"aria-describedby": [
						skill.description && `${control}-description`,
						reason && `${control}-reason`,
						error?.name === skill.name && `${control}-error`
					].filter(Boolean).join(" ") || void 0,
					"aria-busy": snapshot.saving?.name === skill.name,
					disabled: Boolean(disabled || !skill.canToggle || skill.reason),
					onClick: () => toggle(skill)
				}, h("span", {
					className: "power-dsh-switch-thumb",
					"aria-hidden": true
				}))), skill.description && h(Tooltip, {
					label: skill.description,
					side: "top",
					portal: true,
					delayMs: 0,
					maxWidth: 400
				}, h("span", {
					id: `${control}-description`,
					className: "power-dsh-skill-card-description",
					tabIndex: 0
				}, skill.description)), reason && h("p", {
					id: `${control}-reason`,
					className: "power-dsh-skill-reason"
				}, reason), error?.name === skill.name && errorFeedback({
					t,
					id: `${control}-error`,
					message: error.message,
					code: "PD-SKILLS-CHANGE",
					operation: "setSkillEnabled"
				}), skill.origin && h("div", { className: "power-dsh-skill-card-meta" }, h(Tooltip, {
					label: skill.origin.startsWith(".") ? skill.path || skill.origin : skill.origin,
					side: "top",
					portal: true,
					delayMs: 0,
					maxWidth: 400
				}, h("span", {
					className: "power-dsh-skill-origin",
					tabIndex: 0
				}, skill.origin)))));
			};
			const renderGroup = (group, label, selectedRows) => {
				if (selectedRows.length === 0) return null;
				const open = Boolean(needle) || groupsOpen[group];
				const titleId = `${id}-group-${group}`;
				return h("section", {
					key: group,
					className: "power-dsh-skill-group",
					"aria-labelledby": titleId
				}, h("div", { className: "power-dsh-skill-group-header" }, h("button", {
					id: titleId,
					type: "button",
					className: "power-dsh-skill-group-toggle",
					"aria-expanded": open,
					"aria-controls": `${titleId}-body`,
					onClick: () => {
						if (!needle) setGroupsOpen((current) => ({
							...current,
							[group]: !current[group]
						}));
					}
				}, h(SkillChevron), h("span", { className: "power-dsh-skill-group-title" }, t(label)))), h("p", { className: "power-dsh-skill-group-description" }, t(group === "preinstalled" ? "skillPreinstalledDescription" : "skillPersonalDescription")), open && h("div", {
					id: `${titleId}-body`,
					className: "power-dsh-skill-group-body"
				}, h("ul", { className: "power-dsh-skill-cards" }, selectedRows.map(renderCard))));
			};
			return h("section", {
				className: "power-dsh-page power-dsh-skills-page",
				"aria-label": t("skillsTab")
			}, h("style", null, styles), h("header", null, h("h2", { className: "power-dsh-title" }, t("skillsTab")), h("p", { className: "power-dsh-description" }, t("skillsDescription"))), snapshot.status === "loading" && h("p", {
				className: "power-dsh-notice",
				role: "status"
			}, t("loading")), snapshot.error && errorFeedback({
				t,
				message: snapshot.error,
				code: "PD-SKILLS-LOAD",
				operation: "listSkills",
				placement: "page",
				retry: () => loadSkills(),
				disabled: busy
			}), h("div", { className: "power-dsh-skill-navigation" }, h("div", {
				className: "power-dsh-tabs",
				role: "tablist",
				"aria-label": t("skillScope")
			}, scopeTab("user", "skillUserScope"), scopeTab("project", "skillProjectScope"))), h("div", {
				id: `${id}-skill-panel`,
				className: "power-dsh-skill-panel",
				role: "tabpanel",
				"aria-labelledby": `${id}-scope-${scope}`
			}, h("div", { className: scope === "project" ? "power-dsh-project-search-row" : "power-dsh-global-search-row" }, scope === "project" && projectContext(), catalog && h("label", { className: "power-dsh-skill-search-field" }, h(SkillSearchIcon), h("input", {
				type: "search",
				value: query,
				placeholder: t("skillSearch"),
				"aria-label": t("skillSearch"),
				onChange: (event) => setQuery(event.target.value)
			}))), catalog && !catalog.complete && h("p", {
				className: "power-dsh-description power-dsh-skill-notice",
				role: "status"
			}, t("skillIncomplete")), config.status === "ready" && !config.writable && h("p", { className: "power-dsh-description power-dsh-skill-notice" }, t("readOnly")), catalog && (scope === "project" ? h("ul", { className: "power-dsh-skill-cards" }, rows.map(renderCard)) : [renderGroup("personal", "skillPersonalGroup", rows.filter((skill) => displaySource(skill) !== "skillBundledSource")), renderGroup("preinstalled", "skillPreinstalledGroup", rows.filter((skill) => displaySource(skill) === "skillBundledSource"))]), catalog && snapshot.status === "ready" && catalog.complete && rows.length === 0 && h("p", { className: "power-dsh-skill-empty" }, t(scope === "project" && projectWorkspaces?.length === 0 ? "skillNoProjects" : query ? "skillNoMatches" : "skillEmpty"))));
		}
		let active = true;
		ctx.effect(() => () => {
			active = false;
		});
		let skillCatalog = {
			status: "loading",
			value: null,
			cwd: "",
			scope: "user",
			workspaces: [],
			error: "",
			saving: null
		};
		const skillsSource = observable(() => skillCatalog);
		let skillGeneration = 0;
		let skillWritePending = false;
		let selectedProjectCwd = "";
		ctx.effect(() => () => {
			skillGeneration++;
		});
		const loadSkills = async (cwd = "", scope = skillCatalog.scope) => {
			if (!active || skillWritePending) return;
			scope = scope || "user";
			cwd = scope === "project" ? cwd || selectedProjectCwd || skillCatalog.cwd : "";
			if (scope === "project") selectedProjectCwd = cwd;
			const generation = ++skillGeneration;
			const sameContext = scope === skillCatalog.scope && (scope === "user" || cwd === skillCatalog.cwd);
			skillCatalog = {
				...skillCatalog,
				cwd,
				scope,
				value: sameContext ? skillCatalog.value : null,
				status: "loading",
				error: ""
			};
			skillsSource.notify();
			try {
				const result = await ctx.remote.powerDsh.listSkills(cwd, scope);
				if (!active || generation !== skillGeneration) return;
				if (!result.ok) throw new Error(result.error.message);
				skillCatalog = {
					status: "ready",
					value: result.value,
					cwd: result.value.cwd,
					scope: result.value.scope,
					workspaces: result.value.workspaces,
					error: "",
					saving: null
				};
				if (result.value.scope === "project") selectedProjectCwd = result.value.cwd;
			} catch (failure) {
				if (!active || generation !== skillGeneration) return;
				skillCatalog = {
					...skillCatalog,
					status: "error",
					error: errorMessage(failure) || t("skillLoadFailed")
				};
			}
			skillsSource.notify();
		};
		const setSkillEnabled = async (name, enabled) => {
			const config = form.getSnapshot();
			if (!active || skillWritePending || skillCatalog.status !== "ready" || !skillCatalog.value?.complete || config.status !== "ready" || !config.writable || config.value?.skillManagerEnabled !== true) return;
			const skill = skillCatalog.value.skills.find((candidate) => candidate.name === name);
			if (!skill?.canToggle || skill.reason) return;
			const { scope } = skillCatalog;
			const cwd = scope === "project" ? skillCatalog.cwd : "";
			const generation = ++skillGeneration;
			skillWritePending = true;
			skillCatalog = {
				...skillCatalog,
				saving: { name },
				error: ""
			};
			skillsSource.notify();
			try {
				const result = await ctx.remote.powerDsh.setSkillEnabled(cwd, scope, name, enabled);
				if (!result.ok) throw new Error(result.error.message);
				if (!active || generation !== skillGeneration) return;
				skillCatalog = {
					status: "ready",
					value: result.value,
					cwd: result.value.cwd,
					scope: result.value.scope,
					workspaces: result.value.workspaces,
					error: "",
					saving: null
				};
				skillsSource.notify();
			} catch (failure) {
				skillWritePending = false;
				if (active && generation === skillGeneration) {
					skillCatalog = {
						...skillCatalog,
						saving: null
					};
					await loadSkills(cwd, scope);
				}
				throw failure;
			} finally {
				skillWritePending = false;
			}
		};
		preferenceSlot("skillManagerEnabled", "settings.section", {
			id: "power-dsh-skills",
			order: 52,
			locale: namespace,
			label: () => t("skillsTab")
		}, (props) => h(SkillsPage, {
			...props,
			source,
			skillsSource,
			loadSkills,
			setSkillEnabled
		}));
		preferenceSlot("skillManagerEnabled", "settings.section.icon", { id: "power-dsh-skills" }, SkillsIcon);
		return {
			settings: [{
				field: "skillManagerEnabled",
				description: "skillManagerDescription",
				save: (next) => savePreference("skillManagerEnabled", next === true, "skillManagerOutdated")
			}],
			api: {
				skillsSource,
				loadSkills,
				setSkillEnabled
			}
		};
	}

// src/features/skills/definition.ts
	const definition$8 = Object.freeze({
		id: "skills",
		category: "enhance",
		order: 7,
		keys: Object.freeze(["skillManagerEnabled", "disabledSkills"]),
		spec: "src/features/skills/spec.md"
	});

// src/features/skills/locales.ts
	const locales$9 = {
		"en": {
			"skillManagerEnabled": "Skill management",
			"skillManagerDescription": "Manage skills in settings",
			"skillsTab": "Skills",
			"skillsDescription": "Manage skills available to DSH",
			"skillSearch": "Search skills",
			"skillSources": "Filter by source",
			"skillAllSources": "All sources",
			"skillWorkspace": "Project",
			"skillNoProjects": "No imported projects",
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
			"skillLegacyScope": "The project for this older setting could not be determined"
		},
		"zh": {
			"skillManagerEnabled": "技能管理",
			"skillManagerDescription": "在设置中管理技能",
			"skillsTab": "技能",
			"skillsDescription": "管理 DSH 中可用的技能",
			"skillSearch": "搜索技能",
			"skillSources": "按来源筛选",
			"skillAllSources": "全部来源",
			"skillWorkspace": "项目",
			"skillNoProjects": "暂无已导入项目",
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
			"skillLegacyScope": "旧设置无法确定所属项目"
		}
	};

// src/features/skills/rpc.ts
	const skillCatalogCodec = {
		mode: "strict",
		typeSymbol: "power-dsh#SkillCatalog",
		create: () => ({ parse(value) {
			if (!isRecord(value) || typeof value.cwd !== "string" || !isOneOf(value.scope, ["user", "project"]) || typeof value.complete !== "boolean" || !isArray(value.workspaces) || !value.workspaces.every((item) => isRecord(item) && typeof item.path === "string" && typeof item.title === "string") || !isArray(value.skills)) throw new TypeError("Invalid skill catalog");
			const skills = value.skills.map((row) => {
				if (!isRecord(row) || !hasStrings(row, [
					"name",
					"description",
					"source",
					"path",
					"origin",
					"reason"
				]) || !hasBooleans(row, [
					"enabled",
					"modelInvocable",
					"userInvocable",
					"canToggle"
				]) || row.enabled !== (row.modelInvocable || row.userInvocable)) throw new TypeError("Invalid skill entry");
				return {
					name: row.name,
					description: row.description,
					source: row.source,
					path: row.path,
					origin: row.origin,
					enabled: row.enabled,
					modelInvocable: row.modelInvocable,
					userInvocable: row.userInvocable,
					canToggle: row.canToggle,
					reason: row.reason
				};
			});
			return {
				cwd: value.cwd,
				scope: value.scope,
				workspaces: value.workspaces.map((item) => ({
					path: item.path,
					title: item.title
				})),
				complete: value.complete,
				skills
			};
		} })
	};
	function skillRpc(method, fields) {
		return {
			id: `power-dsh#powerDsh/${method}`,
			service: "powerDsh",
			namespace: "powerDsh",
			method,
			invocation: { kind: "direct" },
			parameters: fields.map((name) => ({
				name,
				wire: name,
				source: "json",
				codec: name === "enabled" ? booleanCodec : stringCodec
			})),
			result: skillCatalogCodec
		};
	}
	const LIST_SKILLS_RPC = skillRpc("listSkills", ["cwd", "scope"]);
	const SET_SKILL_ENABLED_RPC = skillRpc("setSkillEnabled", [
		"cwd",
		"scope",
		"name",
		"enabled"
	]);
	const rpc$6 = [LIST_SKILLS_RPC, SET_SKILL_ENABLED_RPC];

// src/features/telemetry-blocking/client.ts
	function createClientFeature$7(runtime, env) {
		const { ctx } = env;
		const setTelemetryBlocked = async (blocked) => {
			const result = await ctx.remote.powerDsh.setTelemetryBlocked(blocked);
			await ctx.configForms.describe().load();
			if (!result.ok) throw new Error(result.error.message);
		};
		return {
			settings: [{
				field: "blockOfficialTelemetry",
				description: "blockTelemetryDescription",
				save: (next) => setTelemetryBlocked(next === true)
			}],
			api: { setTelemetryBlocked }
		};
	}

// src/features/telemetry-blocking/definition.ts
	const definition$7 = Object.freeze({
		id: "telemetry-blocking",
		category: "simplify",
		order: 10,
		keys: Object.freeze(["blockOfficialTelemetry"]),
		spec: "src/features/telemetry-blocking/spec.md"
	});

// src/features/telemetry-blocking/locales.ts
	const locales$8 = {
		"en": {
			"blockOfficialTelemetry": "Disable official feedback and telemetry",
			"blockTelemetryDescription": "Disable usage statistics, environment data collection, Session-log uploads, and plugin inventory reporting"
		},
		"zh": {
			"blockOfficialTelemetry": "停用官方反馈与遥测",
			"blockTelemetryDescription": "停用使用统计、环境信息采集、会话日志及插件清单上报"
		}
	};

// src/features/telemetry-blocking/rpc.ts
	const TELEMETRY_RPC = policyRpc("setTelemetryBlocked", "TelemetryPolicyResult");
	const rpc$5 = [TELEMETRY_RPC];

// src/features/todo-blocking/client.ts
	function createClientFeature$6(runtime, env) {
		const { ctx } = env;
		const setTodoBlocked = async (blocked) => {
			const result = await ctx.remote.powerDsh.setTodoBlocked(blocked);
			await ctx.configForms.describe().load();
			if (!result.ok) throw new Error(result.error.message);
		};
		return {
			settings: [{
				field: "blockTodo",
				description: "blockTodoDescription",
				save: (next) => setTodoBlocked(next === true)
			}],
			api: { setTodoBlocked }
		};
	}

// src/features/todo-blocking/definition.ts
	const definition$6 = Object.freeze({
		id: "todo-blocking",
		category: "simplify",
		order: 11,
		keys: Object.freeze(["blockTodo"]),
		spec: "src/features/todo-blocking/spec.md"
	});

// src/features/todo-blocking/locales.ts
	const locales$7 = {
		"en": {
			"blockTodo": "Disable Todo tool",
			"blockTodoDescription": "Stop generating to-do lists in new conversations"
		},
		"zh": {
			"blockTodo": "停用 Todo 工具",
			"blockTodoDescription": "新对话中不再生成待办列表"
		}
	};

// src/features/todo-blocking/rpc.ts
	const TODO_RPC = policyRpc("setTodoBlocked", "TodoPolicyResult");
	const rpc$4 = [TODO_RPC];

// src/features/plan-blocking/client.ts
	function createClientFeature$5(runtime, env) {
		const { ctx } = env;
		const setPlanBlocked = async (blocked) => {
			const result = await ctx.remote.powerDsh.setPlanBlocked(blocked);
			await ctx.configForms.describe().load();
			if (!result.ok) throw new Error(result.error.message);
		};
		return {
			settings: [{
				field: "blockPlan",
				description: "blockPlanDescription",
				save: (next) => setPlanBlocked(next === true)
			}],
			api: { setPlanBlocked }
		};
	}

// src/features/plan-blocking/definition.ts
	const definition$5 = Object.freeze({
		id: "plan-blocking",
		category: "simplify",
		order: 11.5,
		keys: Object.freeze(["blockPlan"]),
		spec: "src/features/plan-blocking/spec.md"
	});

// src/features/plan-blocking/locales.ts
	const locales$6 = {
		en: {
			blockPlan: "Disable Plan mode",
			blockPlanDescription: "Disable the built-in Plan mode for new conversations"
		},
		zh: {
			blockPlan: "停用 Plan 模式",
			blockPlanDescription: "停用新对话的内置计划模式"
		}
	};

// src/features/plan-blocking/rpc.ts
	const PLAN_RPC = policyRpc("setPlanBlocked", "PlanPolicyResult");
	const rpc$3 = [PLAN_RPC];

// src/features/goal-blocking/client.ts
	function createClientFeature$4(runtime, env) {
		const { ctx } = env;
		const setGoalBlocked = async (blocked) => {
			const result = await ctx.remote.powerDsh.setGoalBlocked(blocked);
			await ctx.configForms.describe().load();
			if (!result.ok) throw new Error(result.error.message);
		};
		return {
			settings: [{
				field: "blockGoal",
				description: "blockGoalDescription",
				save: (next) => setGoalBlocked(next === true)
			}],
			api: { setGoalBlocked }
		};
	}

// src/features/goal-blocking/definition.ts
	const definition$4 = Object.freeze({
		id: "goal-blocking",
		category: "simplify",
		order: 11.75,
		keys: Object.freeze(["blockGoal"]),
		spec: "src/features/goal-blocking/spec.md"
	});

// src/features/goal-blocking/locales.ts
	const locales$5 = {
		en: {
			blockGoal: "Disable Goal mode",
			blockGoalDescription: "Disable the built-in Goal mode for new conversations"
		},
		zh: {
			blockGoal: "停用 Goal 模式",
			blockGoalDescription: "停用新对话的内置目标模式"
		}
	};

// src/features/goal-blocking/rpc.ts
	const GOAL_RPC = policyRpc("setGoalBlocked", "GoalPolicyResult");
	const rpc$2 = [GOAL_RPC];

// src/features/version-display/styles.ts
	const styles$3 = `
.power-dsh-version-seat { display:block; flex:1 1 100%; min-width:0; width:100%; height:0; }
.power-dsh-version-seat .power-dsh-version-badge { position:fixed; left:207px; top:30px; z-index:5; box-sizing:border-box; margin:0; padding:0; border:0; border-radius:2px; background:transparent; color:var(--dsw-alias-label-secondary); font:inherit; font-size:12px; font-weight:400; line-height:16px; letter-spacing:0; white-space:nowrap; text-overflow:ellipsis; overflow:hidden; pointer-events:auto; cursor:pointer; -webkit-app-region:no-drag; }
html[data-platform="darwin"] .power-dsh-version-seat .power-dsh-version-badge { top:64px; }
html[data-windows-titlebar] .power-dsh-version-seat .power-dsh-version-badge { top:calc(var(--dsh-windows-titlebar-height,32px) + 20px); }
.power-dsh-version-seat .power-dsh-version-badge:disabled { cursor:default; }
.power-dsh-version-seat .power-dsh-version-badge:not(:disabled):hover { color:var(--dsw-alias-label-primary); text-decoration:none; }
.power-dsh-version-seat .power-dsh-version-badge:focus-visible { outline:2px solid var(--dsw-alias-brand-primary); outline-offset:2px; }
.power-dsh-version-seat .power-dsh-version-error { position:fixed; left:16px; top:92px; z-index:6; }
`;

// src/features/version-display/client.ts
	function createClientFeature$3(runtime, env) {
		const { React, h, useSnapshot, useMounted, errorFeedback } = runtime;
		const { source, t, version } = env;
		function VersionBadge({ wide, t, source, version }) {
			const snapshot = useSnapshot(source);
			const visible = wide && snapshot.status === "ready" && snapshot.value?.showVersion === true && Boolean(version);
			const seat = React.useRef(null);
			const [available, setAvailable] = React.useState(64);
			const [busy, setBusy] = React.useState(false);
			const [error, setError] = React.useState("");
			const pending = React.useRef(false);
			const mounted = useMounted();
			React.useEffect(() => {
				if (!visible || !seat.current) return;
				const element = seat.current;
				const measure = () => setAvailable(Math.max(0, element.getBoundingClientRect().right - 209));
				measure();
				if (typeof ResizeObserver !== "function") return;
				const observer = new ResizeObserver(measure);
				observer.observe(element);
				return () => observer.disconnect();
			}, [visible]);
			if (!visible) return null;
			const updates = window.dshDesktop?.protocolVersion === 1 ? window.dshDesktop.updates : void 0;
			const canUpdate = typeof updates?.open === "function";
			const title = error || t(busy ? "updating" : canUpdate ? "openUpdate" : "desktopOnly");
			async function openUpdate() {
				if (!canUpdate || pending.current) return;
				pending.current = true;
				setBusy(true);
				setError("");
				try {
					await updates.open();
				} catch (failure) {
					if (mounted.current) setError(errorMessage(failure) || t("updateFailed"));
				} finally {
					pending.current = false;
					if (mounted.current) setBusy(false);
				}
			}
			return h("span", {
				className: "power-dsh-version-seat",
				ref: seat
			}, h("style", null, styles$3), h("button", {
				type: "button",
				className: "power-dsh-version-badge",
				style: { maxWidth: `${available}px` },
				title,
				"aria-label": `DSH ${version} · ${title}`,
				"aria-busy": busy,
				disabled: !canUpdate || busy,
				onClick: openUpdate
			}, version.replace(/^v/, "")), error && errorFeedback({
				t,
				message: error,
				code: "PD-UPDATE-OPEN",
				operation: "desktop.updates.open",
				placement: "compact",
				className: "power-dsh-version-error"
			}));
		}
		return {
			settings: [{
				field: "showVersion",
				description: "versionDescription"
			}],
			sidebar: (props) => h(VersionBadge, {
				...props,
				source,
				version
			})
		};
	}

// src/features/version-display/definition.ts
	const definition$3 = Object.freeze({
		id: "version-display",
		category: "interface",
		order: 6,
		keys: Object.freeze(["showVersion"]),
		spec: "src/features/version-display/spec.md"
	});

// src/features/version-display/locales.ts
	const locales$4 = {
		"en": {
			"showVersion": "Show version number",
			"versionDescription": "Show the version number at the upper left. Click it to check for updates",
			"openUpdate": "Check for updates",
			"updating": "Opening native updates…",
			"updateFailed": "Could not open updates. Please try again.",
			"desktopOnly": "Open the DSH desktop app to check for updates."
		},
		"zh": {
			"showVersion": "显示版本号",
			"versionDescription": "在左上角显示版本号，点击检查更新",
			"openUpdate": "检查更新",
			"updating": "正在打开原生更新…",
			"updateFailed": "无法打开更新，请重试。",
			"desktopOnly": "请在 DSH 桌面端检查更新。"
		}
	};

// src/features/thinking-effort/levels.ts
/** The same sequence as the native model seat: Default only when the model declares no default effort. */
	function effortChoices(reasoning, defaultLabel) {
		if (!reasoning || reasoning.efforts.length === 0) return [];
		const result = [];
		if (reasoning.defaultEffort === void 0) result.push({
			id: void 0,
			label: defaultLabel
		});
		for (const level of reasoning.efforts) result.push({
			id: level.id,
			label: level.name
		});
		return result;
	}
	/** Resolve the index of the effort the Host actually reports, without inventing a level. */
	function currentChoiceIndex(choices, effectiveEffort) {
		const found = choices.findIndex((choice) => choice.id === effectiveEffort);
		return found < 0 ? 0 : found;
	}
	/** Default (undefined effort) lights no bar; the i-th declared level lights i bars. */
	function litBars(choices, index) {
		return choices.slice(0, index + 1).filter((choice) => choice.id !== void 0).length;
	}
	const VIEW_WIDTH = 44;
	const VIEW_HEIGHT = 14;
	const BAR_WIDTH = 3;
	const BAR_GAP = 2;
	/** One bar per declared level, centered in a fixed-width glyph so switching models never moves the button. */
	function barGeometry(count, active, viewWidth = VIEW_WIDTH) {
		if (count <= 0) return [];
		const natural = count * BAR_WIDTH + (count - 1) * BAR_GAP;
		const scale = Math.min(1, viewWidth / natural);
		const width = BAR_WIDTH * scale;
		const gap = BAR_GAP * scale;
		const offset = (viewWidth - (count * width + (count - 1) * gap)) / 2;
		const round = (value) => Math.round(value * 100) / 100;
		const fullHeight = 13;
		return Array.from({ length: count }, (_, index) => {
			const height = fullHeight * (index + 1) / count;
			return {
				x: round(offset + index * (width + gap)),
				y: round(VIEW_HEIGHT - height),
				width: round(width),
				height: round(height),
				filled: index < active
			};
		});
	}
	const ARC_CENTER_X = 8;
	const ARC_CENTER_Y = 8.5;
	const ARC_TRACK = "M3.4041 13.096C2.49514 12.187 1.87614 11.0288 1.62537 9.76798C1.37459 8.50716 1.50331 7.20028 1.99525 6.01261C2.48719 4.82494 3.32025 3.80981 4.3891 3.09557C5.45795 2.38134 6.71458 2.00008 8.0001 2C9.28563 2.00008 10.5423 2.38134 11.6111 3.09557C12.68 3.80981 13.513 4.82494 14.005 6.01261C14.4969 7.20028 14.6256 8.50716 14.3748 9.76798C14.1241 11.0288 13.5051 12.187 12.5961 13.096";
	const ARC_TICK_INNER = 5;
	const ARC_TICK_OUTER = 6.25;
	const ARC_START_DEG = 225;
	const ARC_SWEEP_DEG = 270;
	const ARC_TICK_FRACTIONS = [
		0,
		.25,
		.5,
		.75,
		1
	];
	const ARC_HUB_RADIUS = 1;
	/** A fixed host-style gauge: light arc and ticks, plus one accent needle that turns from low to high. */
	function arcGeometry(count, active) {
		const round = (value) => Math.round(value * 100) / 100;
		const hub = {
			cx: ARC_CENTER_X,
			cy: ARC_CENTER_Y,
			r: ARC_HUB_RADIUS
		};
		if (count <= 0) return {
			track: "",
			ticks: [],
			needle: null,
			hub,
			auto: true
		};
		const at = (radius, fraction) => {
			const angle = (ARC_START_DEG - ARC_SWEEP_DEG * fraction) * Math.PI / 180;
			return [round(ARC_CENTER_X + radius * Math.cos(angle)), round(ARC_CENTER_Y - radius * Math.sin(angle))];
		};
		const ticks = ARC_TICK_FRACTIONS.map((fraction) => {
			const [x1, y1] = at(ARC_TICK_INNER, fraction);
			const [x2, y2] = at(ARC_TICK_OUTER, fraction);
			return {
				x1,
				y1,
				x2,
				y2
			};
		});
		const auto = active <= 0;
		const step = count <= 1 ? .5 : (Math.min(active, count) - 1) / (count - 1);
		const rotation = auto ? -180 : 90 - (ARC_START_DEG - ARC_SWEEP_DEG * step);
		return {
			track: ARC_TRACK,
			ticks,
			hub,
			auto,
			needle: {
				x1: ARC_CENTER_X,
				y1: ARC_CENTER_Y,
				x2: ARC_CENTER_X,
				y2: 3.4000000000000004,
				rotation: round(rotation)
			}
		};
	}

// src/features/thinking-effort/styles.ts
	const styles$2 = `
.power-dsh-effort-button { display:inline-flex; align-items:center; justify-content:center; box-sizing:border-box; width:28px; height:28px; min-width:28px; order:1; margin-left:-8px; margin-right:-8px; padding:0; border:none; border-radius:var(--dsw-radius-sm); outline:none; box-shadow:none; background:transparent; color:var(--dsw-alias-label-secondary); font:inherit; cursor:pointer; }
.power-dsh-effort-button:focus-visible { outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; }
.power-dsh-effort-button:disabled { cursor:default; }
.power-dsh-effort-bars { display:block; flex:none; }
.power-dsh-effort-bar-on { fill:var(--dsw-alias-state-business-primary); }
.power-dsh-effort-bar-off { fill:currentColor; }
.power-dsh-effort-arc-track { stroke:currentColor; stroke-width:1.2; opacity:.42; }
.power-dsh-effort-arc-tick { stroke:currentColor; stroke-width:.95; opacity:.55; }
.power-dsh-effort-arc-needle, .power-dsh-effort-arc-hub { color:var(--dsw-alias-state-business-primary); }
.power-dsh-effort-arc-needle { stroke:currentColor; stroke-width:1.2; transform-box:view-box; transform-origin:8px 8.5px; transition:transform 180ms cubic-bezier(.2,.7,.3,1); }
.power-dsh-effort-arc-hub { fill:currentColor; stroke:none; }
.power-dsh-effort-arc-auto { color:var(--dsw-alias-label-tertiary); }
.power-dsh-effort-arc-max { color:var(--dsw-alias-state-warn-primary); }
@media (prefers-reduced-motion:reduce) { .power-dsh-effort-arc-needle { transition:none; } }
`;
	const settingsStyles$1 = `
.power-dsh-page .power-dsh-effort-style-select { box-sizing:border-box; display:inline-flex; align-items:center; justify-content:center; gap:12px; min-height:36px; max-width:100%; padding:0 14px; border:0; border-radius:var(--dsw-radius-md); background:var(--dsw-alias-bg-module-platform); color:var(--dsw-alias-label-primary); font:inherit; font-size:14px; line-height:22px; cursor:pointer; }
.power-dsh-page .power-dsh-effort-style-select:disabled { opacity:.5; cursor:default; }
.power-dsh-page .power-dsh-effort-style-select:focus-visible { outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; }
@media (hover:hover) { .power-dsh-page .power-dsh-effort-style-select:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover); } }
`;

// src/features/thinking-effort/client.ts
	const EMPTY_SNAPSHOT$1 = {
		current: null,
		groups: [],
		status: "idle",
		error: null
	};
	const GLYPHS = ["signal", "arc"];
	function resolveGlyph(value) {
		return value === "signal" ? "signal" : "arc";
	}
	function resolveDirectory(service, sessionId) {
		if (!service || !sessionId) return null;
		try {
			return service.directoryFor(sessionId);
		} catch {
			return null;
		}
	}
	function createClientFeature$2(runtime, env) {
		const { React, h, Tooltip, Menu, observable, useSnapshot, errorFeedback } = runtime;
		const { ctx, t, savePreference, preferenceSlot, source } = env;
		const emptyStore = observable(() => EMPTY_SNAPSHOT$1);
		let directories = null;
		const availability = observable(() => directories !== null);
		ctx.inject(["modelDirectories"], (child) => {
			const service = child.modelDirectories;
			if (!service || typeof service.directoryFor !== "function") return;
			child.effect(() => {
				directories = service;
				availability.notify();
				return () => {
					directories = null;
					availability.notify();
				};
			});
		});
		function renderGraphic(glyph, count, active, rotation, isMax) {
			if (glyph === "arc") {
				const geometry = arcGeometry(count, active);
				const stateClass = geometry.auto ? " power-dsh-effort-arc-auto" : isMax ? " power-dsh-effort-arc-max" : "";
				return h("svg", {
					className: "power-dsh-effort-bars",
					width: 24,
					height: 24,
					viewBox: "0 0 16 16",
					"aria-hidden": true,
					focusable: false
				}, h("path", {
					className: "power-dsh-effort-arc-track",
					d: geometry.track,
					fill: "none",
					strokeLinecap: "round"
				}), ...geometry.ticks.map((tick, index) => h("line", {
					key: `tick-${index}`,
					className: "power-dsh-effort-arc-tick",
					x1: tick.x1,
					y1: tick.y1,
					x2: tick.x2,
					y2: tick.y2,
					strokeLinecap: "round"
				})), geometry.needle && h("line", {
					className: `power-dsh-effort-arc-needle${stateClass}`,
					x1: geometry.needle.x1,
					y1: geometry.needle.y1,
					x2: geometry.needle.x2,
					y2: geometry.needle.y2,
					strokeLinecap: "round",
					style: { transform: `rotate(${rotation}deg)` }
				}), h("circle", {
					className: `power-dsh-effort-arc-hub${stateClass}`,
					cx: geometry.hub.cx,
					cy: geometry.hub.cy,
					r: geometry.hub.r
				}));
			}
			return h("svg", {
				className: "power-dsh-effort-bars",
				width: 20,
				height: 14,
				viewBox: "0 0 20 14",
				"aria-hidden": true,
				focusable: false
			}, ...barGeometry(count, active, 20).map((bar) => h("rect", {
				className: bar.filled ? "power-dsh-effort-bar-on" : "power-dsh-effort-bar-off",
				x: bar.x,
				y: bar.y,
				width: bar.width,
				height: bar.height,
				rx: bar.width / 2,
				ry: bar.width / 2,
				opacity: bar.filled ? 1 : .3
			})));
		}
		function ThinkingEffortButton(props) {
			const available = useSnapshot(availability);
			const glyph = resolveGlyph(useSnapshot(source).value?.thinkingEffortGlyph);
			const [error, setError] = React.useState("");
			const [pending, setPending] = React.useState(false);
			const [needleMotion, setNeedleMotion] = React.useState({
				target: -180,
				rotation: -180
			});
			const directory = available ? resolveDirectory(directories, props.sessionId) : null;
			const snapshot = useSnapshot(directory?.store ?? emptyStore);
			React.useEffect(() => {
				if (directory) directory.load().catch(() => {});
			}, [directory]);
			if (!directory || !snapshot.current) return null;
			const current = snapshot.current;
			const reasoning = (snapshot.groups.find((candidate) => candidate.id === current.provider)?.models.find((candidate) => candidate.id === current.model))?.reasoning;
			const choices = effortChoices(reasoning, t("effortDefault"));
			if (choices.length === 0) return null;
			const index = currentChoiceIndex(choices, current.reasoningEffort ?? reasoning?.defaultEffort);
			const selected = choices[index] ?? choices[0];
			const next = choices[(index + 1) % choices.length];
			const busy = pending || snapshot.status === "loading" || snapshot.status === "selecting";
			const hint = error || `${t("effortLabel")}：${selected.label} · ${t("effortSwitchTo")} ${next.label}`;
			const count = reasoning?.efforts.length ?? 0;
			const active = litBars(choices, index);
			const target = arcGeometry(count, active).needle?.rotation ?? -180;
			let rotation = needleMotion.rotation;
			if (target !== needleMotion.target) {
				let delta = target - needleMotion.target;
				if (active === 0 || needleMotion.target === -180) delta = (delta + 540) % 360 - 180;
				rotation += delta;
				setNeedleMotion({
					target,
					rotation
				});
			}
			const graphic = renderGraphic(glyph, count, active, rotation, selected.id === "max");
			const button = h("button", {
				type: "button",
				className: "power-dsh-effort-button",
				"aria-label": hint,
				"aria-busy": busy ? true : void 0,
				disabled: busy,
				onClick: (event) => {
					event.stopPropagation();
					if (busy) return;
					setError("");
					setPending(true);
					const selection = {
						provider: current.provider,
						model: current.model,
						...next.id === void 0 ? {} : { reasoningEffort: next.id }
					};
					return directory.select(selection).then((result) => {
						if (!result.ok) setError(`${t("effortSwitchFailed")} ${result.error?.message ?? ""}`.trim());
					}, (failure) => {
						setError(`${t("effortSwitchFailed")} ${errorMessage(failure) ?? ""}`.trim());
					}).finally(() => {
						setPending(false);
					});
				}
			}, graphic);
			return h(React.Fragment, null, h("style", null, styles$2), h(Tooltip, {
				label: hint,
				side: "top",
				portal: true,
				delayMs: 0,
				maxWidth: 400
			}, button));
		}
		preferenceSlot("showThinkingEffortSwitcher", "conversation.input.right", {
			id: "power-dsh-thinking-effort",
			order: 100
		}, ThinkingEffortButton);
		const mainSetting = {
			field: "showThinkingEffortSwitcher",
			description: "thinkingEffortDescription",
			save: (next) => savePreference("showThinkingEffortSwitcher", next === true)
		};
		const glyphSetting = {
			field: "thinkingEffortGlyph",
			hidden: true,
			canSave: () => source.getSnapshot().value?.showThinkingEffortSwitcher === true,
			save: (next) => {
				if (typeof next === "string" && GLYPHS.includes(next)) return savePreference("thinkingEffortGlyph", next, void 0, "string");
				return Promise.resolve();
			}
		};
		function useSettings({ snapshot, disabled, saving, error, save, id }) {
			const [menuOpen, setMenuOpen] = React.useState(false);
			const enabled = snapshot.value?.showThinkingEffortSwitcher === true;
			React.useEffect(() => {
				if (!enabled) setMenuOpen(false);
			}, [enabled]);
			const currentGlyph = resolveGlyph(snapshot.value?.thinkingEffortGlyph);
			const glyphLabel = (glyph) => t(glyph === "arc" ? "glyphArc" : "glyphSignal");
			function styleRow() {
				if (!enabled) return null;
				const field = "thinkingEffortGlyph";
				const control = `${id}-${field}`;
				const busy = saving?.field === field;
				const fieldError = error?.field === field ? error.message : "";
				return h("div", {
					className: "power-dsh-setting-row",
					key: field
				}, h("div", { className: "power-dsh-setting-copy" }, h("div", {
					id: `${control}-label`,
					className: "power-dsh-setting-label"
				}, t("thinkingEffortGlyph")), h("div", {
					id: `${control}-description`,
					className: "power-dsh-description"
				}, t("thinkingEffortGlyphDescription")), fieldError && errorFeedback({
					t,
					id: `${control}-error`,
					message: fieldError,
					code: "PD-EFFORT-STYLE-SAVE",
					operation: "settings.thinkingEffortGlyph"
				})), h(Menu, {
					open: menuOpen && !disabled,
					onClose: () => setMenuOpen(false),
					selectedId: currentGlyph,
					align: "end",
					portal: true,
					autoFocus: true,
					minWidthFromAnchor: true,
					items: GLYPHS.map((glyph) => ({
						id: glyph,
						label: glyphLabel(glyph)
					})),
					onSelect: (next) => {
						setMenuOpen(false);
						return save(field, next);
					},
					anchor: h("button", {
						type: "button",
						className: "power-dsh-effort-style-select",
						disabled: disabled || busy,
						"aria-label": t("thinkingEffortGlyph"),
						"aria-describedby": `${control}-description${fieldError ? ` ${control}-error` : ""}`,
						"aria-invalid": Boolean(fieldError),
						"aria-haspopup": "menu",
						"aria-expanded": menuOpen && !disabled,
						"aria-busy": busy,
						onClick: () => {
							if (!disabled) setMenuOpen((value) => !value);
						}
					}, glyphLabel(currentGlyph), h("svg", {
						width: 16,
						height: 16,
						viewBox: "0 0 16 16",
						fill: "none",
						stroke: "currentColor",
						strokeWidth: 1.4,
						strokeLinecap: "round",
						strokeLinejoin: "round",
						"aria-hidden": true,
						focusable: false
					}, h("path", { d: "m4 6 4 4 4-4" })))
				}));
			}
			return [mainSetting, {
				...glyphSetting,
				hidden: false,
				render: styleRow
			}];
		}
		return {
			settings: [mainSetting, glyphSetting],
			useSettings,
			styles: settingsStyles$1
		};
	}

// src/features/thinking-effort/definition.ts
	const definition$2 = Object.freeze({
		id: "thinking-effort",
		category: "interface",
		order: 3,
		keys: Object.freeze(["showThinkingEffortSwitcher", "thinkingEffortGlyph"]),
		spec: "src/features/thinking-effort/spec.md"
	});

// src/features/thinking-effort/locales.ts
	const locales$3 = {
		"en": {
			"showThinkingEffortSwitcher": "Quick reasoning level switch",
			"thinkingEffort": "Reasoning level",
			"thinkingEffortDescription": "Show a reasoning level switch beside the model selector",
			"effortLabel": "Reasoning level",
			"effortDefault": "Default",
			"effortSwitchTo": "Click to switch to",
			"effortSwitchFailed": "Could not change reasoning level. Please try again.",
			"thinkingEffortGlyph": "Reasoning level switch button style",
			"thinkingEffortGlyphDescription": "Customize the quick switch button beside the model selector",
			"glyphSignal": "Signal bars",
			"glyphArc": "Gauge"
		},
		"zh": {
			"showThinkingEffortSwitcher": "快捷推理等级切换",
			"thinkingEffort": "推理等级",
			"thinkingEffortDescription": "在模型选择旁显示推理等级切换按钮",
			"effortLabel": "推理等级",
			"effortDefault": "默认",
			"effortSwitchTo": "点击切换到",
			"effortSwitchFailed": "无法切换推理等级，请重试。",
			"thinkingEffortGlyph": "推理等级切换按钮样式",
			"thinkingEffortGlyphDescription": "设置模型选择旁的快捷切换按钮外观。",
			"glyphSignal": "信号格",
			"glyphArc": "仪表盘"
		}
	};

// src/features/flowing-background/pattern.ts
	const vertexSource = `
attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;
	const fragmentSource = `
precision mediump float;
uniform vec2 u_resolution;
uniform vec2 u_cssSize;
uniform vec2 u_driftA;
uniform vec2 u_driftB;
uniform vec2 u_phase;

float lattice(vec2 point) {
  return fract(sin(point.x * 12.9898 + point.y * 78.233) * 43758.5453123);
}
float valueField(vec2 point) {
  vec2 origin = floor(point);
  vec2 local = fract(point);
  vec2 weight = local * local * (3.0 - 2.0 * local);
  vec4 corners = vec4(lattice(origin), lattice(origin + vec2(1.0, 0.0)),
                      lattice(origin + vec2(0.0, 1.0)), lattice(origin + vec2(1.0)));
  return dot(corners, vec4((1.0 - weight.x) * (1.0 - weight.y),
                          weight.x * (1.0 - weight.y),
                          (1.0 - weight.x) * weight.y, weight.x * weight.y));
}
void main() {
  // scale=.5 -> .0035 CSS pixels per field unit; rotation=-5 degrees.
  vec2 p = (gl_FragCoord.xy / u_resolution - 0.5) * u_cssSize * 0.0035;
  float angle = -0.0872664626;
  p = vec2(cos(angle) * p.x - sin(angle) * p.y,
           sin(angle) * p.x + cos(angle) * p.y) + vec2(0.5, 1.15);

  float direction = valueField(p + u_driftA) * 6.28318530718;
  float distance = valueField(p * 2.0 - u_driftB) * 0.8;
  p += distance * vec2(cos(direction), sin(direction));
  // swirl=12/50, eight passes, evaluated in sequence on both axes.
  for (int pass = 1; pass <= 8; pass++) {
    float order = float(pass);
    float phaseX = order * 1.5 * p.y;
    p.x += 0.24 / order * (u_phase.y * cos(phaseX) - u_phase.x * sin(phaseX));
    float phaseY = order * p.x;
    p.y += 0.24 / order * (u_phase.y * cos(phaseY) - u_phase.x * sin(phaseY));
  }

  // checks scale=10/100 and proportion=.5. Softness=1 blends BLUE -> WHITE -> WHITE.
  // Both broad transitions matter: one sharp blue-alpha contour does not match.
  float coverage = 0.5 + 0.5 * sin(p.x * 0.85) * cos(p.y * 0.85);
  float blueShare = (1.0 - smoothstep(0.0, 0.7, coverage))
                  * (1.0 - smoothstep(0.3, 1.0, coverage));
  // Express the opaque RGB pattern + its original mask/base as an equivalent
  // transparent layer over white, so the additive slot never paints white over text.
  float fromTop = 1.0 - gl_FragCoord.y / u_resolution.y;
  float mask = fromTop < 0.0898
    ? mix(252.0 / 255.0, 232.0 / 255.0, fromTop / 0.0898)
    : (232.0 / 255.0) * (1.0 - fromTop) / (1.0 - 0.0898);
  float patternAlpha = blueShare * mask;
  float baseAlpha = (1.0 - fromTop) * (1.0 - mask);
  float alpha = patternAlpha + baseAlpha;
  vec3 blue = vec3(138.0, 163.0, 214.0) / 255.0;
  vec3 base = vec3(156.0, 193.0, 231.0) / 255.0;
  vec3 ink = (blue * patternAlpha + base * baseAlpha) / max(alpha, 0.00001);
  gl_FragColor = vec4(ink, alpha);
}
`;
	/** Bounded phases preserve the current homepage's .07-unit/second initial drift. */
	function samplePatternMotion(seconds) {
		const tau = Math.PI * 2;
		const drift = (period) => {
			const angle = (seconds % period + period) % period / period * tau;
			const radius = .07 * period / tau;
			const sine = Math.sin(angle);
			const cosine = Math.cos(angle);
			return [radius * (sine + cosine - 1), radius * (sine + 1 - cosine)];
		};
		const phase = (seconds % 90 + 90) % 90 / 90 * tau;
		return {
			a: drift(420),
			b: drift(460),
			phase: [Math.sin(phase), Math.cos(phase)]
		};
	}
	/** Own every GPU allocation; unsupported or rejected shaders leave the CSS artwork. */
	function createPatternRenderer(canvas) {
		const gl = canvas.getContext("webgl", {
			alpha: true,
			antialias: false,
			depth: false,
			premultipliedAlpha: false
		});
		if (!gl) return null;
		const compile = (type, source) => {
			const shader = gl.createShader(type);
			if (!shader) return null;
			gl.shaderSource(shader, source);
			gl.compileShader(shader);
			if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
			gl.deleteShader(shader);
			return null;
		};
		const vertex = compile(gl.VERTEX_SHADER, vertexSource);
		if (!vertex) return null;
		const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
		if (!fragment) {
			gl.deleteShader(vertex);
			return null;
		}
		const program = gl.createProgram();
		if (!program) {
			gl.deleteShader(vertex);
			gl.deleteShader(fragment);
			return null;
		}
		const disposeShaders = () => {
			gl.deleteProgram(program);
			gl.deleteShader(vertex);
			gl.deleteShader(fragment);
		};
		gl.attachShader(program, vertex);
		gl.attachShader(program, fragment);
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			disposeShaders();
			return null;
		}
		const buffer = gl.createBuffer();
		if (!buffer) {
			disposeShaders();
			return null;
		}
		const position = gl.getAttribLocation(program, "a_position");
		const resolution = gl.getUniformLocation(program, "u_resolution");
		const size = gl.getUniformLocation(program, "u_cssSize");
		const driftA = gl.getUniformLocation(program, "u_driftA");
		const driftB = gl.getUniformLocation(program, "u_driftB");
		const phase = gl.getUniformLocation(program, "u_phase");
		const dispose = () => {
			gl.deleteBuffer(buffer);
			disposeShaders();
		};
		if (position < 0 || [
			resolution,
			size,
			driftA,
			driftB,
			phase
		].some((location) => location === null)) {
			dispose();
			return null;
		}
		gl.useProgram(program);
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
			-1,
			-1,
			1,
			-1,
			-1,
			1,
			1,
			1
		]), gl.STATIC_DRAW);
		gl.enableVertexAttribArray(position);
		gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
		return {
			draw(seconds, cssWidth, cssHeight) {
				const motion = samplePatternMotion(seconds);
				gl.viewport(0, 0, canvas.width, canvas.height);
				gl.uniform2f(resolution, canvas.width, canvas.height);
				gl.uniform2f(size, Math.max(1, cssWidth), Math.max(1, cssHeight));
				gl.uniform2f(driftA, ...motion.a);
				gl.uniform2f(driftB, ...motion.b);
				gl.uniform2f(phase, ...motion.phase);
				gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
			},
			dispose
		};
	}

// src/features/flowing-background/animation.ts
/** Bound backing-store size even on very large windows and high-DPI screens. */
	function canvasSize(width, height, ratio) {
		const w = Math.max(1, width || 1);
		const h = Math.max(1, height || 1);
		const scale = Math.min(Math.max(1, ratio || 1), 1.5, Math.sqrt(2e6 / (w * h)));
		return {
			width: Math.max(1, Math.floor(w * scale)),
			height: Math.max(1, Math.floor(h * scale))
		};
	}
	/** Own the pattern's frame chain, visibility, motion preference and GPU lifetime. */
	function startAnimation(canvas, win = window, doc = document, region) {
		let renderer = createPatternRenderer(canvas);
		if (!renderer) return () => {};
		canvas.style.background = "none";
		const motion = win.matchMedia("(prefers-reduced-motion: reduce)");
		let frame = null;
		let disposed = false;
		let previous = null;
		let elapsed = 0;
		let lastPaint = -Infinity;
		let cssWidth = 1;
		let cssHeight = 1;
		const paint = () => renderer?.draw(elapsed / 1e3, cssWidth, cssHeight);
		const cancel = () => {
			if (frame !== null) win.cancelAnimationFrame(frame);
			frame = null;
			previous = null;
		};
		const tick = (time) => {
			frame = null;
			if (disposed || !renderer || doc.hidden || motion.matches) return;
			if (previous !== null) elapsed += Math.min(100, Math.max(0, time - previous));
			previous = time;
			if (time - lastPaint >= 1e3 / 24) {
				paint();
				lastPaint = time;
			}
			frame = win.requestAnimationFrame(tick);
		};
		const sync = () => {
			cancel();
			if (disposed || !renderer || doc.hidden) return;
			paint();
			lastPaint = -Infinity;
			if (!motion.matches) frame = win.requestAnimationFrame(tick);
		};
		const resize = () => {
			cssWidth = Math.max(1, region?.clientWidth ?? win.innerWidth);
			cssHeight = Math.max(1, region?.clientHeight ?? win.innerHeight);
			const size = canvasSize(cssWidth, cssHeight, win.devicePixelRatio);
			canvas.width = size.width;
			canvas.height = size.height;
			sync();
		};
		const lost = (event) => {
			event.preventDefault();
			cancel();
			renderer?.dispose();
			renderer = null;
			canvas.style.background = "";
		};
		const restored = () => {
			if (disposed) return;
			renderer = createPatternRenderer(canvas);
			canvas.style.background = renderer ? "none" : "";
			resize();
		};
		const observer = region && typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
		if (region) observer?.observe(region);
		win.addEventListener("resize", resize);
		doc.addEventListener("visibilitychange", sync);
		motion.addEventListener("change", sync);
		canvas.addEventListener("webglcontextlost", lost);
		canvas.addEventListener("webglcontextrestored", restored);
		resize();
		return () => {
			if (disposed) return;
			disposed = true;
			cancel();
			observer?.disconnect();
			win.removeEventListener("resize", resize);
			doc.removeEventListener("visibilitychange", sync);
			motion.removeEventListener("change", sync);
			canvas.removeEventListener("webglcontextlost", lost);
			canvas.removeEventListener("webglcontextrestored", restored);
			renderer?.dispose();
			renderer = null;
			canvas.style.background = "";
		};
	}

// src/features/flowing-background/styles.ts
	const styles$1 = `
.power-dsh-flowing-background {
  position: absolute; inset: 0; z-index: -1; overflow: hidden; pointer-events: none !important;
  user-select: none; contain: strict;
}
.power-dsh-flowing-background canvas {
  display: block; width: 100%; height: 100%; pointer-events: none !important;
  background: linear-gradient(180deg, rgba(156, 193, 231, .4) 0%, transparent 100%);
}
.power-dsh-flowing-background img.power-dsh-wallpaper {
  display: block; width: 100%; height: 100%; object-fit: cover; pointer-events: none !important;
  background: var(--dsw-alias-bg-base);
}
`;
	const settingsStyles = `
.power-dsh-page .power-dsh-background-controls { display:inline-flex; align-items:center; flex:none; gap:8px; }
.power-dsh-page .power-dsh-background-style-select { box-sizing:border-box; display:inline-flex; align-items:center; justify-content:center; gap:12px; min-height:36px; max-width:100%; padding:0 14px; border:0; border-radius:var(--dsw-radius-md); background:var(--dsw-alias-bg-module-platform); color:var(--dsw-alias-label-primary); font:inherit; font-size:14px; line-height:22px; cursor:pointer; }
.power-dsh-page .power-dsh-background-style-select:disabled { opacity:.5; cursor:default; }
.power-dsh-page .power-dsh-background-style-select:focus-visible { outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; }
@media (hover:hover) { .power-dsh-page .power-dsh-background-style-select:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover); } }
.power-dsh-page .power-dsh-background-tune-trigger { display:inline-flex; align-items:center; justify-content:center; flex:none; width:28px; height:28px; padding:0; }

.power-dsh-background-seat { display:block; width:100%; height:0; }
/* Matches the appearance shortcut beside it: fixed on the footer row, 32x32. */
.power-dsh-background-shortcut { position:fixed; bottom:16px; z-index:5; display:inline-flex; align-items:center; justify-content:center; box-sizing:border-box; width:32px; height:32px; border:0; border-radius:var(--dsw-radius-md); padding:0; background:transparent; color:var(--dsw-alias-label-primary); font:inherit; cursor:pointer; pointer-events:auto; -webkit-app-region:no-drag; }
@media (hover:hover) { .power-dsh-background-shortcut:hover { background:var(--dsw-alias-interactive-bg-hover); } }
.power-dsh-background-shortcut:active { background:var(--dsw-alias-interactive-bg-active); }
.power-dsh-background-shortcut:disabled { opacity:.5; cursor:default; }
.power-dsh-background-shortcut:focus-visible { outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary)); outline-offset:2px; }
.power-dsh-page .power-dsh-slider-field { display:inline-flex; align-items:center; gap:10px; min-width:190px; justify-content:flex-end; }
.power-dsh-page .power-dsh-slider { box-sizing:border-box; width:150px; margin:0; accent-color:var(--dsw-alias-state-business-primary); cursor:pointer; }
.power-dsh-page .power-dsh-slider:disabled { opacity:.5; cursor:default; }
.power-dsh-page .power-dsh-slider-value { min-width:44px; text-align:right; font-variant-numeric:tabular-nums; color:var(--dsw-alias-label-secondary); font-size:13px; }
.power-dsh-wallpaper-row { display:flex; align-items:center; gap:10px; min-width:0; }
.power-dsh-wallpaper-details { display:flex; flex:1 1 auto; align-items:center; gap:10px; min-width:0; }
.power-dsh-wallpaper-thumb { flex:none; display:inline-flex; width:44px; height:30px; overflow:hidden; border-radius:var(--dsw-radius-sm); background:var(--dsw-alias-bg-layer-1); }
.power-dsh-wallpaper-preview { display:block; width:100%; height:100%; object-fit:cover; }
.power-dsh-wallpaper-copy { display:flex; flex-direction:column; gap:1px; min-width:0; }
.power-dsh-wallpaper-name { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--dsw-alias-label-primary); font-size:13px; line-height:18px; }
.power-dsh-wallpaper-hint { color:var(--dsw-alias-label-tertiary); font-size:11px; line-height:16px; }
.power-dsh-wallpaper-actions { display:flex; flex:none; align-items:center; gap:2px; }
/* Mirrors the native modal close control: 28x28, transparent, hover fill only. */
.power-dsh-wallpaper-icon { flex:none; display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; border:0; border-radius:var(--dsw-radius-sm); padding:0; background:transparent; color:var(--dsw-alias-label-secondary); cursor:pointer; }
@media (hover:hover) { .power-dsh-wallpaper-icon:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover); } }
.power-dsh-wallpaper-icon:active:not(:disabled) { background:var(--dsw-alias-interactive-bg-active); }
.power-dsh-wallpaper-icon:focus-visible { outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary)); outline-offset:2px; }
.power-dsh-wallpaper-icon:disabled { opacity:.4; cursor:not-allowed; }
.power-dsh-wallpaper-icon.is-danger:hover:not(:disabled) { color:var(--dsw-alias-state-error-primary); }
:is(.power-dsh-page, .power-dsh-background-panel) .power-dsh-wallpaper-input { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; border:0; }
`;
	const panelStyles = `
.power-dsh-background-panel {
  position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 60;
  box-sizing: border-box; display: flex; flex-direction: column; isolation: isolate;
  width: min(380px, calc(100vw - 48px)); max-height: calc(100vh - 48px);
  padding: 0 0 24px; overflow: hidden; border: 0; border-radius: var(--dsw-radius-panel);
  background: transparent; color: var(--dsw-alias-label-primary);
  box-shadow: var(--dsw-elevation-prominent); pointer-events: auto; font: inherit;
}
.power-dsh-background-panel-material {
  position: absolute; inset: 0; z-index: -1; border-radius: inherit; pointer-events: none;
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-2) 32%, transparent);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
}
.power-dsh-background-panel-head { display: flex; flex: none; align-items: center; justify-content: space-between; gap: 8px; padding: 22px 14px 12px 24px; }
.power-dsh-background-panel-title { margin: 0; font-size: 16px; line-height: 24px; font-weight: 500; }
.power-dsh-background-panel-close { flex: none; width: 28px; height: 28px; padding: 0; color: var(--dsw-alias-label-secondary); }
.power-dsh-background-panel-body { display: flex; flex-direction: column; gap: 20px; min-height: 0; padding: 8px 24px 0; overflow-y: auto; }
.power-dsh-background-panel-slider { display: flex; flex-direction: column; gap: 10px; }
.power-dsh-background-panel-row { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.power-dsh-background-panel-label { font-size: 14px; line-height: 22px; color: var(--dsw-alias-label-primary); }
.power-dsh-background-panel-value { font-size: 12px; line-height: 18px; font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-secondary); }
.power-dsh-background-panel .power-dsh-slider { box-sizing: border-box; width: 100%; height: 20px; margin: 0; accent-color: var(--dsw-alias-brand-primary); cursor: pointer; }
/* The native range paints its own focus ring; adding an outline drew a second box. */
.power-dsh-background-panel .power-dsh-slider:focus-visible { outline: none; }
.power-dsh-background-panel .power-dsh-slider:disabled { opacity: .4; cursor: not-allowed; }
/* Grouping: each block states what it changes, so the panel reads top-down. */
.power-dsh-background-panel-section { display: flex; flex-direction: column; gap: 12px; }
.power-dsh-background-panel-section + .power-dsh-background-panel-section { padding-top: 16px; border-top: .5px solid var(--dsw-alias-border-l2); }
.power-dsh-background-panel-section-title { font-size: 12px; line-height: 18px; font-weight: 500; color: var(--dsw-alias-label-secondary); }
.power-dsh-background-panel-hint { margin: -4px 0 0; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); }
/* Type choice as a plain radio group: two labelled options, no dropdown. */
.power-dsh-background-kind { margin: 0; border: 0; padding: 0; }
.power-dsh-background-kind > legend { padding: 0; }
/* The two options sit on one line, side by side. */
.power-dsh-background-options { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 18px; }
.power-dsh-background-radio { display: inline-flex; align-items: center; gap: 6px; min-height: 24px; color: var(--dsw-alias-label-primary); font-size: 13px; line-height: 18px; cursor: pointer; }
.power-dsh-background-radio input { flex: none; width: 14px; height: 14px; margin: 0; accent-color: var(--dsw-alias-brand-primary); cursor: pointer; }
.power-dsh-background-radio input:disabled { cursor: default; }
.power-dsh-background-radio input:disabled + .power-dsh-background-radio-label { opacity: .5; }
.power-dsh-background-radio input:focus-visible { outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-brand-primary)); outline-offset: 2px; }
.power-dsh-background-panel .power-dsh-setting-row { display: flex; flex-direction: column; align-items: stretch; gap: 12px; padding-top: 20px; border-top: .5px solid var(--dsw-alias-border-l2); }
.power-dsh-background-panel .power-dsh-setting-label { font-size: 14px; line-height: 22px; }
.power-dsh-background-panel .power-dsh-description { margin-top: 4px; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
@media (max-width:360px) {
  .power-dsh-background-panel .power-dsh-wallpaper-hint { display: none; }
}
`;

// src/features/flowing-background/attachment.ts
	const nativeStylesheets = {
		layout: "@deepseek-ai/dsh-client-ui-layout/AppFrame.module.css",
		sidebar: "@deepseek-ai/dsh-client-ui-sidebar/SidebarRoot.module.css",
		workspace: "@deepseek-ai/dsh-client-ui-workspace/WorkspaceBrowser.module.css"
	};
	const failure = (stage, check, result, expected, actual) => ({
		state: "unavailable",
		stage,
		check,
		result,
		...expected === void 0 ? {} : {
			expected,
			actual
		}
	});
	/** CSS-module hashes differ between npm and Desktop builds of the same version. */
	function nativeClasses(doc) {
		let issue = null;
		const read = (owner, name, required = true) => {
			const module = nativeStylesheets[owner];
			const sheets = doc.querySelectorAll(`style[data-plugin-css="${module}"]`);
			if (sheets.length !== 1) {
				if (required) issue ??= failure("styles", `${owner}.stylesheet`, sheets.length ? "ambiguous" : "missing", "1", String(sheets.length));
				return null;
			}
			const pattern = new RegExp(`\\.([A-Za-z0-9_-]+_${name})(?![A-Za-z0-9_-])`, "g");
			const names = [...new Set([...(sheets[0].textContent ?? "").matchAll(pattern)].map((match) => match[1]))];
			if (names.length === 1) return names[0];
			if (required) issue ??= failure("styles", `${owner}.${name}`, names.length ? "ambiguous" : "missing", "1", String(names.length));
			return null;
		};
		const frame = read("layout", "frame");
		const sidebarCol = read("layout", "sidebarCol");
		const centerCol = read("layout", "centerCol");
		const sidebarRoot = read("sidebar", "root");
		const scrollFade = read("sidebar", "scrollFade", false);
		const workspaceRoot = read("workspace", "root", false);
		const workspaceBody = read("workspace", "treeBody", false);
		const fade = read("workspace", "fade", false);
		return frame && sidebarCol && centerCol && sidebarRoot ? { classes: {
			frame,
			sidebarCol,
			centerCol,
			sidebarRoot,
			scrollFade,
			workspaceFade: workspaceRoot && workspaceBody && fade ? {
				root: workspaceRoot,
				body: workspaceBody,
				fade
			} : null
		} } : {
			classes: null,
			failure: issue
		};
	}
	/** Restore a declaration only while it still belongs to this attachment. */
	function change(element, property, value, priority = "important") {
		const before = element.style.getPropertyValue(property);
		const beforePriority = element.style.getPropertyPriority(property);
		element.style.setProperty(property, value, priority);
		return () => {
			if (element.style.getPropertyValue(property) !== value || element.style.getPropertyPriority(property) !== priority) return;
			if (before) element.style.setProperty(property, before, beforePriority);
			else element.style.removeProperty(property);
		};
	}
	/** Apply opacity and frosted blur to an owned layer without re-attaching it. */
	function applyAppearance(layer, appearance) {
		const alpha = Math.min(100, Math.max(0, Number.isFinite(appearance.opacity) ? appearance.opacity : 100)) / 100;
		const opacity = alpha < 1 ? String(alpha) : "";
		if (layer.style.getPropertyValue("opacity") !== opacity) {
			if (opacity) layer.style.setProperty("opacity", opacity);
			else layer.style.removeProperty("opacity");
		}
		const blur = Math.min(40, Math.max(0, Number.isFinite(appearance.blur) ? appearance.blur : 0));
		const artwork = layer.querySelector(".power-dsh-artwork");
		if (!artwork) return;
		const declarations = {
			filter: blur > 0 ? `blur(${blur}px)` : "",
			position: "",
			inset: "",
			width: "",
			height: ""
		};
		for (const [property, value] of Object.entries(declarations)) {
			if (artwork.style.getPropertyValue(property) === value) continue;
			if (value) artwork.style.setProperty(property, value);
			else artwork.style.removeProperty(property);
		}
	}
	function watchBackground(report, doc = document, win = window, animate = startAnimation, appearance = {
		opacity: 100,
		blur: 0
	}, readAppearance, subscribeAppearance) {
		let current = null;
		let disposed = false;
		let failedTarget = null;
		const findFrame = (classes) => {
			const roots = [...new Set([...doc.querySelectorAll("[data-shell-overlay]")].map((overlay) => overlay.parentElement).filter((target) => target !== null && target.isConnected && target.matches(`.${classes.frame}`)))];
			const visible = roots.filter((target) => target.clientWidth > 0 && target.clientHeight > 0);
			if (visible.length !== 1) return {
				target: null,
				failure: failure("frame", "app-frame", visible.length > 1 ? "ambiguous" : roots.length ? "hidden" : "missing", "1 visible frame", String(visible.length))
			};
			const target = visible[0];
			const computed = win.getComputedStyle(target);
			if (computed.position !== "relative") return {
				target: null,
				failure: failure("frame", "frame.position", "unsupported", "relative", [
					"static",
					"absolute",
					"fixed",
					"sticky"
				].includes(computed.position) ? computed.position : "other")
			};
			if (computed.display !== "grid") return {
				target: null,
				failure: failure("frame", "frame.display", "unsupported", "grid", [
					"flex",
					"block",
					"none",
					"inline",
					"contents"
				].includes(computed.display) ? computed.display : "other")
			};
			for (const [check, selector] of [
				["frame.bottom", "[data-shell-bottom]"],
				["frame.rightbar", "[data-rightbar-col]"],
				["frame.sidebar", `.${classes.sidebarCol}`],
				["frame.center", `.${classes.centerCol}`]
			]) if (!target.querySelector(`:scope > ${selector}`)) return {
				target: null,
				failure: failure("frame", check, "missing", "1 direct child", "0")
			};
			return { target };
		};
		const clear = () => {
			current?.dispose();
			current = null;
		};
		const sync = () => {
			if (disposed) return;
			const mapping = nativeClasses(doc);
			if (!mapping.classes) {
				clear();
				failedTarget = null;
				report(mapping.failure);
				return;
			}
			const classes = mapping.classes;
			const frame = findFrame(classes);
			if (!frame.target) {
				clear();
				failedTarget = null;
				report(frame.failure);
				return;
			}
			const target = frame.target;
			if (current?.target === target && current.layer.parentElement === target) {
				if (win.getComputedStyle(target).isolation !== "isolate") {
					clear();
					failedTarget = target;
					report(failure("frame", "frame.isolation", "changed", "isolate", "not isolated"));
					return;
				}
				try {
					current.refresh(classes);
					return;
				} catch {
					clear();
					failedTarget = target;
					report(failure("initialization", "attachment.refresh", "failed", "completed", "exception"));
					return;
				}
			}
			if (target === failedTarget) return;
			failedTarget = null;
			clear();
			const restores = [];
			const surfaces = /* @__PURE__ */ new Map();
			const fades = /* @__PURE__ */ new Map();
			const refresh = (names) => {
				if (readAppearance) applyAppearance(layer, readAppearance());
				const css = `${styles$1}
html[data-windows-titlebar] .${names.frame}:has(> .power-dsh-flowing-background)::before { background: transparent !important; }
html[data-windows-titlebar] .${names.frame}:not([data-sidebar-drawer]):has(> .power-dsh-flowing-background) > .${names.sidebarCol} { border-right: 0.5px solid var(--dsw-alias-border-l3) !important; }`;
				if (sheet.textContent !== css) sheet.textContent = css;
				const nextFades = /* @__PURE__ */ new Set();
				for (const sidebar of target.querySelectorAll(`.${names.sidebarRoot}`)) {
					if (names.scrollFade) for (const fade of sidebar.querySelectorAll(`.${names.scrollFade}[aria-hidden="true"]`)) nextFades.add(fade);
					const workspace = names.workspaceFade;
					if (!workspace) continue;
					for (const root of sidebar.querySelectorAll(`.${workspace.root}`)) for (const body of root.querySelectorAll(`.${workspace.body}`)) for (const fade of body.querySelectorAll(`:scope > .${workspace.fade}`)) if (fade.tagName.toLowerCase() === "span") nextFades.add(fade);
				}
				for (const [element, restore] of fades) if (!nextFades.has(element)) {
					restore();
					fades.delete(element);
				}
				for (const element of nextFades) if (!fades.has(element)) fades.set(element, change(element, "display", "none"));
				const drawer = target.hasAttribute("data-sidebar-drawer");
				const selectors = `.${names.sidebarCol}, .${names.centerCol}, .${names.sidebarRoot}`;
				const next = new Set([...target.querySelectorAll(selectors)].filter((element) => !drawer || !element.matches(`.${names.sidebarCol}, .${names.sidebarRoot}`)));
				for (const content of target.querySelectorAll("[data-conversation-content]")) {
					const root = content.parentElement;
					if (!root?.matches("[data-phase]")) continue;
					next.add(root);
					for (const seat of content.querySelectorAll("[data-composer-seat][data-conversation-region=\"composer\"]")) next.add(seat);
				}
				for (const [element, restore] of surfaces) if (!next.has(element)) {
					restore();
					surfaces.delete(element);
				}
				for (const element of next) {
					if (surfaces.has(element)) continue;
					const color = change(element, "background-color", "transparent");
					const image = change(element, "background-image", "none");
					surfaces.set(element, () => {
						image();
						color();
					});
				}
			};
			const layer = doc.createElement("div");
			layer.className = "power-dsh-flowing-background";
			const initial = readAppearance ? readAppearance() : appearance;
			const wallpaper = initial.wallpaper ?? null;
			layer.setAttribute("data-kind", wallpaper ? "wallpaper" : "pattern");
			layer.setAttribute("aria-hidden", "true");
			const sheet = doc.createElement("style");
			sheet.textContent = styles$1;
			let stop = () => {};
			let canvas = null;
			if (wallpaper) {
				const image = doc.createElement("img");
				image.className = "power-dsh-wallpaper power-dsh-artwork";
				image.setAttribute("alt", "");
				image.setAttribute("draggable", "false");
				image.src = wallpaper.dataUrl;
				layer.append(sheet, image);
			} else {
				canvas = doc.createElement("canvas");
				canvas.className = "power-dsh-artwork";
				layer.append(sheet, canvas);
			}
			applyAppearance(layer, initial);
			const dispose = () => {
				stop();
				layer.remove();
				for (const restore of surfaces.values()) restore();
				surfaces.clear();
				for (const restore of fades.values()) restore();
				fades.clear();
				restores.reverse().forEach((restore) => restore());
			};
			try {
				restores.push(change(target, "isolation", "isolate", ""));
				restores.push(change(target, "background-color", "var(--dsw-alias-bg-base)"));
				refresh(classes);
				target.appendChild(layer);
				if (canvas) stop = animate(canvas, win, doc, target);
				current = {
					target,
					layer,
					refresh,
					dispose
				};
				report({ state: "attached" });
			} catch {
				dispose();
				failedTarget = target;
				report(failure("initialization", "attachment.initialize", "failed", "completed", "exception"));
			}
		};
		if (!doc.body) {
			report(failure("environment", "document.body", "missing", "available", "missing"));
			return () => {};
		}
		if (typeof win.MutationObserver !== "function") {
			report(failure("environment", "mutation-observer", "unsupported", "available", "missing"));
			return () => {};
		}
		const observer = new win.MutationObserver(sync);
		if (doc.head) observer.observe(doc.head, {
			childList: true,
			subtree: true,
			characterData: true
		});
		observer.observe(doc.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: [
				"data-phase",
				"data-shell-overlay",
				"data-shell-bottom",
				"data-rightbar-col",
				"data-sidebar-drawer",
				"hidden",
				"class",
				"style"
			]
		});
		sync();
		const offAppearance = subscribeAppearance?.(() => {
			if (!disposed && current && readAppearance) applyAppearance(current.layer, readAppearance());
		});
		return () => {
			if (disposed) return;
			disposed = true;
			offAppearance?.();
			observer.disconnect();
			clear();
		};
	}

// src/features/flowing-background/diagnostics.ts
	const frameCopy = {
		missing: {
			reason: "flowingBackgroundFrameMissing",
			recovery: "flowingBackgroundRecoveryWait"
		},
		hidden: {
			reason: "flowingBackgroundFrameHidden",
			recovery: "flowingBackgroundRecoveryWait"
		},
		ambiguous: {
			reason: "flowingBackgroundFrameAmbiguous",
			recovery: "flowingBackgroundRecoveryUpdate"
		},
		unsupported: {
			reason: "flowingBackgroundFrameUnsupported",
			recovery: "flowingBackgroundRecoveryUpdate"
		},
		changed: {
			reason: "flowingBackgroundFrameChanged",
			recovery: "flowingBackgroundRecoveryRetry"
		}
	};
	const resultLabels = {
		missing: "flowingBackgroundResultMissing",
		ambiguous: "flowingBackgroundResultAmbiguous",
		hidden: "flowingBackgroundResultHidden",
		unsupported: "flowingBackgroundResultUnsupported",
		changed: "flowingBackgroundResultChanged",
		failed: "flowingBackgroundResultFailed"
	};
	const strategies = {
		styles: {
			code: "PD-BACKGROUND-LAYOUT",
			stage: "flowingBackgroundStageStyles",
			resolve(result) {
				if (result === "missing") return {
					reason: "flowingBackgroundStylesMissing",
					recovery: "flowingBackgroundRecoveryWait"
				};
				return {
					reason: "flowingBackgroundStylesAmbiguous",
					recovery: "flowingBackgroundRecoveryUpdate"
				};
			}
		},
		frame: {
			code: "PD-BACKGROUND-LAYOUT",
			stage: "flowingBackgroundStageFrame",
			resolve: (result) => frameCopy[result]
		},
		initialization: {
			code: "PD-BACKGROUND-INIT",
			stage: "flowingBackgroundStageInitialization",
			resolve: () => ({
				reason: "flowingBackgroundInitializationFailed",
				recovery: "flowingBackgroundRecoveryRetry"
			})
		},
		environment: {
			code: "PD-BACKGROUND-ENVIRONMENT",
			stage: "flowingBackgroundStageEnvironment",
			resolve: () => ({
				reason: "flowingBackgroundEnvironmentUnavailable",
				recovery: "flowingBackgroundRecoveryUpdate"
			})
		}
	};
	/** Compare only the authored evidence used to identify an observed background fault. */
	function sameFailure(left, right) {
		return left.stage === right.stage && left.check === right.check && left.result === right.result && left.expected === right.expected && left.actual === right.actual;
	}
	/** Select a stage strategy, then assemble localized feedback and stable copyable evidence. */
	function presentFailure(issue, observedAt, t) {
		const strategy = strategies[issue.stage];
		const copy = strategy.resolve(issue.result);
		return {
			message: `${t("flowingBackgroundLayoutUnavailable")} ${t(copy.reason)} ${t(copy.recovery)}`,
			code: strategy.code,
			operation: "flowing-background.attach",
			observedAt,
			context: {
				stage: `${issue.stage} (${t(strategy.stage)})`,
				check: issue.check,
				result: `${issue.result} (${t(resultLabels[issue.result])})`,
				expected: issue.expected,
				actual: issue.actual,
				state: t("flowingBackgroundStatePreserved"),
				recovery: t(copy.recovery)
			}
		};
	}

// src/features/flowing-background/client.ts
	const KINDS = ["pattern", "wallpaper"];
	const MAX_WALLPAPER_BYTES = 26214400;
	const ACCEPTED = [
		"image/png",
		"image/jpeg",
		"image/webp"
	];
	function resolveKind(value) {
		return value === "wallpaper" ? "wallpaper" : "pattern";
	}
	/** Clamp a numeric preference, falling back when it is missing or malformed. */
	function resolveNumber(value, fallback, min, max) {
		const parsed = typeof value === "number" ? value : Number(value);
		return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
	}
	/** Keeps the lifecycle controller renderable in environments without a live form source. */
	const EMPTY_SNAPSHOT = {
		status: "ready",
		writable: false,
		value: {}
	};
	const EMPTY_SOURCE = {
		subscribe: () => () => {},
		getSnapshot: () => EMPTY_SNAPSHOT
	};
	/** Read a picked image as a data URL without leaving the renderer. */
	function readImage(file) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onerror = () => reject(/* @__PURE__ */ new Error("read failed"));
			reader.onload = () => {
				const result = reader.result;
				if (typeof result === "string" && /^data:image\/(?:png|jpeg|webp);base64,/.test(result)) resolve(result);
				else reject(/* @__PURE__ */ new Error("read failed"));
			};
			reader.readAsDataURL(file);
		});
	}
	function createClientFeature$1(runtime, env) {
		const { React, h, Button, Tooltip, NativeIcon, observable, useSnapshot, errorFeedback } = runtime;
		const { ctx, t, source } = env;
		let fault = null;
		const attachment = observable(() => fault);
		let wallpaper = {
			status: "idle",
			value: null,
			error: ""
		};
		const wallpaperSource = observable(() => wallpaper);
		let generation = 0;
		let active = true;
		ctx?.effect?.(() => () => {
			active = false;
			generation++;
		});
		const publishWallpaper = (patch) => {
			wallpaper = {
				...wallpaper,
				...patch
			};
			wallpaperSource.notify();
		};
		const loadWallpaper = async () => {
			const current = ++generation;
			if (wallpaper.status !== "ready") publishWallpaper({
				status: "loading",
				error: ""
			});
			try {
				const reply = await ctx.remote.powerDsh.readWallpaper();
				if (!active || current !== generation) return;
				if (!reply.ok) throw new Error(reply.error.message);
				publishWallpaper({
					status: "ready",
					value: reply.value,
					error: ""
				});
			} catch (failure) {
				if (!active || current !== generation) return;
				publishWallpaper({
					status: "error",
					error: errorMessage(failure) || t("flowingBackgroundWallpaperReadFailed")
				});
			}
		};
		const saveWallpaper = async (dataUrl, name) => {
			const current = ++generation;
			const reply = await ctx.remote.powerDsh.saveWallpaper(dataUrl, name);
			if (!active || current !== generation) return;
			if (!reply.ok) throw new Error(reply.error.message || t("flowingBackgroundWallpaperSaveFailed"));
			publishWallpaper({
				status: "ready",
				value: reply.value,
				error: ""
			});
		};
		const clearWallpaper = async () => {
			const current = ++generation;
			const reply = await ctx.remote.powerDsh.clearWallpaper();
			if (!active || current !== generation) return;
			if (!reply.ok) throw new Error(reply.error.message || t("flowingBackgroundWallpaperSaveFailed"));
			publishWallpaper({
				status: "ready",
				value: null,
				error: ""
			});
		};
		ctx?.effect?.(() => {
			const sync = () => {
				const snapshot = source.getSnapshot();
				if (snapshot.status !== "ready") return;
				if (snapshot.value?.flowingBackgroundEnabled !== true) return;
				if (resolveKind(snapshot.value?.flowingBackgroundKind) !== "wallpaper") return;
				if (wallpaper.status === "idle") loadWallpaper();
			};
			sync();
			return source.subscribe(sync);
		});
		const readStyle = (snapshot) => ({
			kind: resolveKind(snapshot.value?.flowingBackgroundKind),
			opacity: resolveNumber(snapshot.value?.flowingBackgroundOpacity, 100, 0, 100),
			blur: resolveNumber(snapshot.value?.flowingBackgroundBlur, 0, 0, 40)
		});
		function BackgroundController() {
			const snapshot = useSnapshot(source ?? EMPTY_SOURCE);
			const asset = useSnapshot(wallpaperSource);
			const panel = useSnapshot(panelStore);
			const kind = panel.open ? panel.kind : readStyle(snapshot).kind;
			const dataUrl = kind === "wallpaper" ? asset.value?.dataUrl : void 0;
			const name = kind === "wallpaper" ? asset.value?.name : void 0;
			React.useLayoutEffect(() => {
				let firstReport = true;
				const read = () => {
					const current = readStyle(source?.getSnapshot() ?? EMPTY_SOURCE.getSnapshot());
					return {
						opacity: panelState.open ? panelState.opacity : current.opacity,
						blur: panelState.open ? panelState.blur : current.blur,
						wallpaper: dataUrl ? {
							dataUrl,
							name: name ?? ""
						} : null
					};
				};
				return watchBackground((status) => {
					if (status.state === "attached") {
						if (fault) {
							fault = null;
							attachment.notify();
						}
					} else if (firstReport || !fault || !sameFailure(fault.issue, status)) {
						fault = {
							issue: status,
							observedAt: (/* @__PURE__ */ new Date()).toISOString()
						};
						attachment.notify();
					}
					firstReport = false;
				}, void 0, void 0, void 0, read(), read, (listener) => {
					const offForm = (source ?? EMPTY_SOURCE).subscribe(listener);
					const offPanel = panelStore.subscribe(listener);
					return () => {
						offForm();
						offPanel();
					};
				});
			}, [dataUrl, name]);
			return null;
		}
		function Background() {
			return h(BackgroundController);
		}
		env.preferenceSlot("flowingBackgroundEnabled", "shell.overlay", {
			id: "power-dsh-flowing-background",
			order: -100,
			locale: env.namespace
		}, Background);
		let panelState = {
			open: false,
			kind: "pattern",
			opacity: 100,
			blur: 0,
			saving: false,
			error: ""
		};
		const panelStore = observable(() => panelState);
		const publishPanel = (patch) => {
			if (Object.entries(patch).every(([key, value]) => panelState[key] === value)) return;
			panelState = {
				...panelState,
				...patch
			};
			panelStore.notify();
		};
		const openPanel = (leave) => {
			const snapshot = source.getSnapshot();
			if (!leave || panelState.open || snapshot.status !== "ready" || !snapshot.writable) return;
			const { kind, opacity, blur } = readStyle(snapshot);
			publishPanel({
				open: true,
				kind,
				opacity,
				blur,
				saving: false,
				error: ""
			});
			leave();
			if (kind === "wallpaper" && wallpaper.status === "idle") loadWallpaper();
		};
		const finishPanel = () => publishPanel({
			open: false,
			error: ""
		});
		const savePanel = async () => {
			if (!active || !panelState.open || panelState.saving) return false;
			const snapshot = source.getSnapshot();
			if (snapshot.status !== "ready" || !snapshot.writable) return false;
			const { kind, opacity, blur } = panelState;
			publishPanel({
				saving: true,
				error: ""
			});
			try {
				if (kind !== readStyle(source.getSnapshot()).kind) await env.savePreference("flowingBackgroundKind", kind, void 0, "string");
				const after = readStyle(source.getSnapshot());
				if (opacity !== after.opacity) await env.savePreference("flowingBackgroundOpacity", opacity, void 0, "number");
				if (blur !== after.blur) await env.savePreference("flowingBackgroundBlur", blur, void 0, "number");
				return true;
			} catch (failure) {
				if (active) {
					const restored = readStyle(source.getSnapshot());
					publishPanel({
						kind: restored.kind,
						opacity: restored.opacity,
						blur: restored.blur,
						error: errorMessage(failure) || t("saveFailed")
					});
				}
				return false;
			} finally {
				if (active) publishPanel({ saving: false });
			}
		};
		let panelCommit;
		const commitPanel = () => {
			if (panelCommit) return panelCommit;
			const task = savePanel();
			panelCommit = task;
			task.then(() => {
				if (panelCommit === task) panelCommit = void 0;
			});
			return task;
		};
		const closePanel = async () => {
			if (pickingState.picking) return;
			if (await commitPanel()) finishPanel();
		};
		ctx?.effect?.(() => {
			const off = source.subscribe(() => {
				const snapshot = source.getSnapshot();
				if (panelState.open && (snapshot.status !== "ready" || !snapshot.writable || snapshot.value?.flowingBackgroundEnabled !== true)) finishPanel();
			});
			return () => {
				off();
				if (panelState.open) finishPanel();
			};
		});
		function TuningPanel() {
			const state = useSnapshot(panelStore);
			const asset = useSnapshot(wallpaperSource);
			const operation = useSnapshot(pickingStore);
			const title = t("flowingBackgroundTuneTitle");
			if (!state.open) return null;
			const wallpaper = state.kind === "wallpaper";
			return h("div", {
				className: "power-dsh-background-panel",
				role: "dialog",
				"aria-label": title,
				"aria-busy": state.saving,
				onKeyDown: (event) => {
					if (event.key === "Escape") {
						event.preventDefault();
						event.stopPropagation();
						closePanel();
					}
				}
			}, h("style", null, settingsStyles + panelStyles + styles$12), h("div", {
				className: "power-dsh-background-panel-material",
				"aria-hidden": true
			}), h("div", { className: "power-dsh-background-panel-head" }, h("h2", { className: "power-dsh-background-panel-title" }, title), h(Button, {
				type: "button",
				variant: "ghost",
				size: "sm",
				className: "power-dsh-background-panel-close",
				"aria-label": t("flowingBackgroundTuneDone"),
				title: t("flowingBackgroundTuneDone"),
				disabled: state.saving || operation.picking,
				onClick: closePanel
			}, h("svg", {
				width: 14,
				height: 14,
				viewBox: "0 0 14 14",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.4,
				strokeLinecap: "round",
				"aria-hidden": true,
				focusable: false
			}, h("path", { d: "m3 3 8 8M11 3l-8 8" })))), h("div", { className: "power-dsh-background-panel-body" }, kindChoice(state.kind, state.saving || operation.picking), wallpaper && wallpaperRow(asset, operation, state.saving), h("div", { className: "power-dsh-background-panel-section" }, h("div", { className: "power-dsh-background-panel-section-title" }, t("flowingBackgroundTuneAppearance")), panelSlider("flowingBackgroundOpacity", "flowingBackgroundOpacity", state.opacity, 0, 100, 5, "%", "flowingBackgroundOpacityDescription"), panelSlider("flowingBackgroundBlur", "flowingBackgroundBlur", state.blur, 0, 40, 1, "px", "flowingBackgroundBlurDescription")), state.error && errorFeedback({
				t,
				message: state.error,
				code: "PD-BACKGROUND-STYLE-SAVE",
				operation: "background.tune",
				retry: async () => {
					await commitPanel();
				}
			})));
		}
		/**
		* Background type as two radios in the panel. Choosing a type only previews;
		* the panel saves it on close. Arrow keys move between the two options, which
		* is what a native radio group does.
		*/
		function kindChoice(current, disabled) {
			const control = "power-dsh-background-kind";
			const choose = (next) => {
				if (disabled || !panelState.open || panelState.saving || panelState.kind === next) return;
				publishPanel({ kind: next });
				if (next === "wallpaper" && wallpaper.status === "idle") loadWallpaper();
			};
			return h("fieldset", { className: "power-dsh-background-panel-section power-dsh-background-kind" }, h("legend", { className: "power-dsh-background-panel-section-title" }, t("flowingBackgroundKind")), h("div", { className: "power-dsh-background-options" }, ...KINDS.map((kind) => h("label", {
				key: kind,
				className: "power-dsh-background-radio"
			}, h("input", {
				type: "radio",
				name: control,
				value: kind,
				id: `${control}-${kind}`,
				checked: current === kind,
				disabled,
				onChange: () => choose(kind)
			}), h("span", { className: "power-dsh-background-radio-label" }, kindLabel(kind))))));
		}
		/**
		* One labelled slider. The control is a native `range`, so arrows, Home/End and
		* Page Up/Down all work; it stays enabled while a save is in flight and only
		* blocks new writes, so dragging never loses focus or the keyboard.
		*/
		function panelSlider(field, labelKey, value, min, max, step, unit, descriptionKey) {
			const control = `power-dsh-tune-${field}`;
			const description = `${control}-description`;
			return h("div", {
				className: "power-dsh-background-panel-slider",
				key: field
			}, h("div", { className: "power-dsh-background-panel-row" }, h("label", {
				htmlFor: control,
				className: "power-dsh-background-panel-label"
			}, t(labelKey)), h("span", {
				className: "power-dsh-background-panel-value",
				"aria-hidden": true
			}, `${value}${unit}`)), h("input", {
				id: control,
				type: "range",
				className: "power-dsh-slider",
				min,
				max,
				step,
				value,
				"aria-label": t(labelKey),
				"aria-describedby": description,
				"aria-valuetext": `${value}${unit}`,
				onChange: (event) => {
					if (!panelState.open) return;
					const next = Math.min(max, Math.max(min, Number(event.currentTarget.value)));
					if (Number.isFinite(next)) publishPanel(field === "flowingBackgroundOpacity" ? { opacity: next } : { blur: next });
				},
				onPointerUp: () => commitPanel(),
				onKeyUp: (event) => {
					if ([
						"ArrowLeft",
						"ArrowRight",
						"ArrowUp",
						"ArrowDown",
						"Home",
						"End",
						"PageUp",
						"PageDown"
					].includes(event.key)) return commitPanel();
				},
				onBlur: () => commitPanel()
			}), h("p", {
				id: description,
				className: "power-dsh-background-panel-hint"
			}, t(descriptionKey)));
		}
		/**
		* Short-sleeved tee, drawn in the host's own icon dialect: a 16x16 viewBox with
		* a 1px stroke and round joins, matching `edit-outline` and `trash-outline`.
		* Lucide artwork is designed on 24x24 at 2px, so scaling it to 16px made the
		* glyph read heavy and cramped beside the host icons.
		*/
		function ShirtIcon({ size = 16 }) {
			return h("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": true,
				focusable: false
			}, h("path", { d: "M6.2 2.6 2.5 4.1l1.1 2.6 1.9-.8v7.5h5V5.9l1.9.8 1.1-2.6-3.7-1.5" }), h("path", { d: "M6.2 2.6a2.4 2.4 0 0 0 3.6 0" }));
		}
		/**
		* Sidebar entry, shown when `showBackgroundShortcut` is on. It reuses the same
		* panel as the settings row; `openPanel` still refuses when the form is not
		* ready or writable, so the button reports why instead of opening an empty one.
		*/
		function BackgroundShortcut({ t }) {
			const config = useSnapshot(source ?? EMPTY_SOURCE);
			const state = useSnapshot(panelStore);
			const seat = React.useRef(null);
			const [left, setLeft] = React.useState(null);
			const visible = config.status === "ready" && config.writable && config.value?.showBackgroundShortcut === true;
			React.useLayoutEffect(() => {
				if (!visible || !seat.current) return;
				const element = seat.current;
				const measure = () => {
					const anchor = element.parentElement?.querySelector(".power-dsh-appearance-button") ?? element;
					setLeft(Math.max(0, anchor.getBoundingClientRect().right - 72));
				};
				measure();
				const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
				observer?.observe(element);
				window.addEventListener("resize", measure);
				window.visualViewport?.addEventListener("resize", measure);
				return () => {
					observer?.disconnect();
					window.removeEventListener("resize", measure);
					window.visualViewport?.removeEventListener("resize", measure);
				};
			}, [visible]);
			if (!visible) return null;
			const label = config.value?.flowingBackgroundEnabled === true ? t("flowingBackgroundTuneOpen") : t("flowingBackgroundEnabled");
			return h(React.Fragment, null, h("style", null, settingsStyles + panelStyles), h("span", {
				className: "power-dsh-background-seat",
				ref: seat
			}, h(Tooltip, {
				label,
				side: "top",
				portal: true,
				delayMs: 200,
				maxWidth: 320
			}, h("button", {
				type: "button",
				className: "power-dsh-background-shortcut",
				style: left === null ? { visibility: "hidden" } : { left },
				"aria-label": label,
				"aria-haspopup": "dialog",
				"aria-expanded": state.open,
				onClick: () => {
					if (state.open) {
						closePanel();
						return;
					}
					openPanel(() => {});
				}
			}, h(ShirtIcon)))));
		}
		ctx?.slots?.inject?.("shell.overlay", () => ctx.slots.register({
			name: "shell.overlay",
			id: "power-dsh-background-tune",
			order: -99,
			locale: env.namespace
		}, TuningPanel));
		let pickingState = {
			picking: false,
			error: ""
		};
		const pickingStore = observable(() => pickingState);
		const publishPicking = (patch) => {
			if (patch.picking === pickingState.picking && patch.error === pickingState.error) return;
			pickingState = {
				...pickingState,
				...patch
			};
			pickingStore.notify();
		};
		const setPicking = (next) => publishPicking({ picking: next });
		const setWallpaperError = (message) => publishPicking({ error: message });
		let fileInput = null;
		const kindLabel = (kind) => t(kind === "wallpaper" ? "flowingBackgroundKindWallpaper" : "flowingBackgroundKindPattern");
		const mainSetting = {
			field: "flowingBackgroundEnabled",
			description: "flowingBackgroundDescription"
		};
		const kindSetting = {
			field: "flowingBackgroundKind",
			description: "flowingBackgroundKindDescription",
			hidden: true
		};
		const opacitySetting = {
			field: "flowingBackgroundOpacity",
			description: "flowingBackgroundOpacityDescription",
			hidden: true
		};
		const blurSetting = {
			field: "flowingBackgroundBlur",
			description: "flowingBackgroundBlurDescription",
			hidden: true
		};
		const shortcutSetting = {
			field: "showBackgroundShortcut",
			description: "showBackgroundShortcutDescription",
			canSave: () => source.getSnapshot().value?.flowingBackgroundEnabled === true
		};
		const canEditWallpaper = () => {
			const snapshot = source.getSnapshot();
			return active && panelState.open && snapshot.status === "ready" && snapshot.writable && snapshot.value?.flowingBackgroundEnabled === true && readStyle(snapshot).kind === "wallpaper";
		};
		function wallpaperRow(asset, operation, disabled) {
			const control = "power-dsh-tune-wallpaper";
			const busy = operation.picking || asset.status === "loading";
			const failure = operation.error || asset.error;
			const choose = () => {
				if (!disabled && !busy && canEditWallpaper()) fileInput?.click();
			};
			async function picked(event) {
				const input = event.currentTarget;
				const file = input.files?.[0];
				input.value = "";
				if (!file || disabled || !canEditWallpaper() || pickingState.picking) return;
				setWallpaperError("");
				if (!ACCEPTED.includes(file.type)) {
					setWallpaperError(t("flowingBackgroundWallpaperUnsupported"));
					return;
				}
				if (file.size > MAX_WALLPAPER_BYTES) {
					setWallpaperError(t("flowingBackgroundWallpaperTooLarge"));
					return;
				}
				setPicking(true);
				try {
					const dataUrl = await readImage(file);
					if (!canEditWallpaper()) return;
					await saveWallpaper(dataUrl, file.name);
				} catch (failure) {
					setWallpaperError(errorMessage(failure) || t("flowingBackgroundWallpaperSaveFailed"));
				} finally {
					setPicking(false);
				}
			}
			async function remove() {
				if (disabled || busy || !canEditWallpaper()) return;
				setWallpaperError("");
				setPicking(true);
				try {
					await clearWallpaper();
				} catch (failure) {
					setWallpaperError(errorMessage(failure) || t("flowingBackgroundWallpaperSaveFailed"));
				} finally {
					setPicking(false);
				}
			}
			return h("div", {
				className: "power-dsh-wallpaper-row",
				key: "flowingBackgroundWallpaper"
			}, h("div", { className: "power-dsh-wallpaper-details" }, h("span", {
				className: "power-dsh-wallpaper-thumb",
				"aria-hidden": true
			}, asset.value && h("img", {
				className: "power-dsh-wallpaper-preview",
				src: asset.value.dataUrl,
				alt: "",
				draggable: false
			})), h("span", { className: "power-dsh-wallpaper-copy" }, h("span", {
				id: `${control}-label`,
				className: "power-dsh-wallpaper-name",
				title: asset.value?.name
			}, asset.value ? asset.value.name : t("flowingBackgroundWallpaperEmpty")), h("span", {
				id: `${control}-description`,
				className: "power-dsh-wallpaper-hint"
			}, t("flowingBackgroundWallpaperDescription")))), h("div", {
				className: "power-dsh-wallpaper-actions",
				role: "group",
				"aria-labelledby": `${control}-label`
			}, h(Tooltip, {
				label: t(asset.value ? "flowingBackgroundWallpaperReplace" : "flowingBackgroundWallpaperChoose"),
				side: "top",
				portal: true
			}, h("button", {
				type: "button",
				className: "power-dsh-wallpaper-icon",
				disabled: disabled || busy,
				"aria-label": t(asset.value ? "flowingBackgroundWallpaperReplace" : "flowingBackgroundWallpaperChoose"),
				"aria-describedby": `${control}-description${failure ? ` ${control}-error` : ""}`,
				"aria-busy": busy,
				onClick: choose
			}, h(NativeIcon, { glyph: "edit-outline" }))), asset.value && h(Tooltip, {
				label: t("flowingBackgroundWallpaperRemove"),
				side: "top",
				portal: true
			}, h("button", {
				type: "button",
				className: "power-dsh-wallpaper-icon is-danger",
				"aria-label": t("flowingBackgroundWallpaperRemove"),
				disabled: disabled || busy,
				onClick: remove
			}, h(NativeIcon, { glyph: "trash-outline" }))), h("input", {
				ref: (element) => {
					fileInput = element;
				},
				type: "file",
				className: "power-dsh-wallpaper-input",
				tabIndex: -1,
				accept: ACCEPTED.join(","),
				"aria-hidden": true,
				disabled: disabled || busy,
				onChange: picked
			})), failure && errorFeedback({
				t,
				id: `${control}-error`,
				message: failure,
				code: "PD-BACKGROUND-WALLPAPER",
				operation: "saveWallpaper",
				retry: asset.status === "error" ? loadWallpaper : void 0
			}));
		}
		function useSettings({ snapshot, disabled, saving, error, save, id, leaveSettings }) {
			const failed = useSnapshot(attachment);
			const openedTune = useSnapshot(panelStore).open;
			const enabled = snapshot.value?.flowingBackgroundEnabled === true;
			const main = !failed || !enabled ? mainSetting : {
				...mainSetting,
				failure: presentFailure(failed.issue, failed.observedAt, t)
			};
			const failure = "failure" in main ? main.failure : void 0;
			/**
			* The adjustment entry sits on the main row itself: there is no separate
			* "background type" row any more, because the panel owns that choice.
			*/
			function mainRow() {
				const control = `${id}-flowingBackgroundEnabled`;
				return h("div", {
					className: "power-dsh-setting-row",
					key: "flowingBackgroundMain"
				}, h("div", { className: "power-dsh-setting-copy" }, h("div", {
					id: `${control}-label`,
					className: "power-dsh-setting-label"
				}, t("flowingBackgroundEnabled")), h("div", {
					id: `${control}-description`,
					className: "power-dsh-description"
				}, t("flowingBackgroundDescription")), failure && errorFeedback({
					t,
					id: `${control}-error`,
					message: failure.message,
					code: failure.code,
					operation: failure.operation,
					context: failure.context,
					observedAt: failure.observedAt
				})), h("div", { className: "power-dsh-background-controls" }, enabled && h(Tooltip, {
					label: t("flowingBackgroundTuneOpen"),
					side: "top",
					portal: true
				}, h(Button, {
					type: "button",
					variant: "ghost",
					size: "sm",
					className: "power-dsh-background-tune-trigger",
					id: `${id}-flowingBackgroundTune`,
					disabled: disabled || !leaveSettings,
					"aria-label": t("flowingBackgroundTuneOpen"),
					"aria-describedby": `${control}-description`,
					"aria-haspopup": "dialog",
					"aria-expanded": openedTune,
					onClick: () => {
						if (!disabled) openPanel(leaveSettings);
					}
				}, h("svg", {
					width: 16,
					height: 16,
					viewBox: "0 0 16 16",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: 1.4,
					strokeLinecap: "round",
					"aria-hidden": true,
					focusable: false
				}, h("path", { d: "M2 4h3m4 0h5M2 12h5m4 0h3" }), h("circle", {
					cx: 7,
					cy: 4,
					r: 2
				}), h("circle", {
					cx: 9,
					cy: 12,
					r: 2
				})))), h("button", {
					type: "button",
					role: "switch",
					className: "power-dsh-switch",
					id: control,
					"aria-checked": enabled,
					"aria-labelledby": `${control}-label`,
					"aria-describedby": `${control}-description`,
					"aria-busy": saving?.field === "flowingBackgroundEnabled",
					disabled: disabled || saving?.field === "flowingBackgroundEnabled",
					onClick: () => save("flowingBackgroundEnabled", !enabled)
				}, h("span", {
					className: "power-dsh-switch-thumb",
					"aria-hidden": true
				}))));
			}
			return [{
				...main,
				render: mainRow
			}, shortcutSetting];
		}
		return {
			settings: [
				mainSetting,
				kindSetting,
				opacitySetting,
				blurSetting,
				shortcutSetting
			],
			useSettings,
			styles: settingsStyles + panelStyles,
			sidebar: (props) => h(BackgroundShortcut, { ...props }),
			api: {
				wallpaperSource,
				loadWallpaper,
				saveWallpaper,
				clearWallpaper
			}
		};
	}

// src/features/flowing-background/definition.ts
	const definition$1 = Object.freeze({
		id: "flowing-background",
		category: "interface",
		order: 5,
		keys: Object.freeze([
			"flowingBackgroundEnabled",
			"flowingBackgroundKind",
			"flowingBackgroundOpacity",
			"flowingBackgroundBlur",
			"showBackgroundShortcut"
		]),
		spec: "src/features/flowing-background/spec.md"
	});

// src/features/flowing-background/locales.ts
	const locales$2 = {
		en: {
			flowingBackgroundEnabled: "Custom background",
			flowingBackgroundDescription: "Choose a soft animated background for the interface",
			flowingBackgroundOpacity: "Background opacity",
			flowingBackgroundOpacityDescription: "0% hides the background; 100% shows it fully",
			flowingBackgroundBlur: "Background blur",
			flowingBackgroundBlurDescription: "0px keeps the background sharp; higher values add blur",
			showBackgroundShortcut: "Quick background switch",
			showBackgroundShortcutDescription: "Quickly adjust the background at the bottom of the sidebar",
			flowingBackgroundKind: "Background type",
			flowingBackgroundKindDescription: "Choose the built-in flow or your own wallpaper",
			flowingBackgroundKindPattern: "Homepage flow",
			flowingBackgroundKindWallpaper: "Custom wallpaper",
			flowingBackgroundWallpaper: "Wallpaper image",
			flowingBackgroundWallpaperDescription: "PNG / JPEG / WebP · Max 25 MB",
			flowingBackgroundWallpaperEmpty: "No wallpaper",
			flowingBackgroundWallpaperChoose: "Choose image",
			flowingBackgroundWallpaperReplace: "Replace",
			flowingBackgroundWallpaperRemove: "Remove",
			flowingBackgroundTuneOpen: "Adjust background",
			flowingBackgroundTuneTitle: "Background",
			flowingBackgroundTuneAppearance: "Appearance",
			flowingBackgroundTuneDone: "Close",
			flowingBackgroundWallpaperReadFailed: "The saved wallpaper could not be read.",
			flowingBackgroundWallpaperSaveFailed: "The wallpaper could not be saved.",
			flowingBackgroundWallpaperUnsupported: "Choose a PNG, JPEG or WebP image.",
			flowingBackgroundWallpaperTooLarge: "The image must be no larger than 25 MB.",
			flowingBackgroundLayoutUnavailable: "The background could not be displayed. The native interface is preserved.",
			flowingBackgroundStageStyles: "Style recognition",
			flowingBackgroundStageFrame: "Application layout checks",
			flowingBackgroundStageInitialization: "Background initialization",
			flowingBackgroundStageEnvironment: "Browser capabilities",
			flowingBackgroundStylesMissing: "Required application styles have not been identified.",
			flowingBackgroundStylesAmbiguous: "Required application styles could not be identified uniquely.",
			flowingBackgroundFrameMissing: "A required application layout element was not found.",
			flowingBackgroundFrameHidden: "The application frame has no visible area.",
			flowingBackgroundFrameAmbiguous: "More than one application frame was found.",
			flowingBackgroundFrameUnsupported: "The application layout does not meet the background requirements.",
			flowingBackgroundFrameChanged: "The application frame styles changed after the background was attached.",
			flowingBackgroundInitializationFailed: "An unexpected error occurred while preparing the background.",
			flowingBackgroundEnvironmentUnavailable: "A required browser capability or document element is unavailable.",
			flowingBackgroundResultMissing: "Not found",
			flowingBackgroundResultAmbiguous: "Not unique",
			flowingBackgroundResultHidden: "No visible area",
			flowingBackgroundResultUnsupported: "Unsupported",
			flowingBackgroundResultChanged: "Changed after attachment",
			flowingBackgroundResultFailed: "Initialization failed",
			flowingBackgroundStatePreserved: "The saved background setting is unchanged. The background is hidden and the native interface is preserved.",
			flowingBackgroundRecoveryWait: "Checks resume automatically when the page layout or styles change. If the problem persists after loading, update PowerDSH and reload the interface; copy the error information if it still fails.",
			flowingBackgroundRecoveryUpdate: "Update PowerDSH and reload the interface. If the problem persists, copy the error information for a bug report.",
			flowingBackgroundRecoveryRetry: "Turn the background off and on to retry. If the problem persists, copy the error information for a bug report."
		},
		zh: {
			flowingBackgroundEnabled: "自定义背景",
			flowingBackgroundDescription: "为界面选择柔和的动态背景",
			flowingBackgroundOpacity: "背景不透明度",
			flowingBackgroundOpacityDescription: "0% 隐藏背景，100% 完全显示背景",
			flowingBackgroundBlur: "背景模糊",
			flowingBackgroundBlurDescription: "0px 保持清晰，数值越大背景越模糊",
			showBackgroundShortcut: "快捷切换背景",
			showBackgroundShortcutDescription: "在侧栏底部快捷调节背景",
			flowingBackgroundKind: "背景类型",
			flowingBackgroundKindDescription: "选择官网流动图案或自己的壁纸",
			flowingBackgroundKindPattern: "官网流动",
			flowingBackgroundKindWallpaper: "自定义壁纸",
			flowingBackgroundWallpaper: "壁纸图片",
			flowingBackgroundWallpaperDescription: "PNG / JPEG / WebP · 最大 25 MB",
			flowingBackgroundWallpaperEmpty: "未设置壁纸",
			flowingBackgroundWallpaperChoose: "选择图片",
			flowingBackgroundWallpaperReplace: "更换",
			flowingBackgroundWallpaperRemove: "移除",
			flowingBackgroundTuneOpen: "调节背景",
			flowingBackgroundTuneTitle: "背景设置",
			flowingBackgroundTuneAppearance: "外观",
			flowingBackgroundTuneDone: "关闭",
			flowingBackgroundWallpaperReadFailed: "无法读取已保存的壁纸。",
			flowingBackgroundWallpaperSaveFailed: "壁纸保存失败。",
			flowingBackgroundWallpaperUnsupported: "请选择 PNG、JPEG 或 WebP 图片。",
			flowingBackgroundWallpaperTooLarge: "图片不能超过 25 MB。",
			flowingBackgroundLayoutUnavailable: "背景未能显示，已保留原生界面。",
			flowingBackgroundStageStyles: "样式识别",
			flowingBackgroundStageFrame: "应用布局检查",
			flowingBackgroundStageInitialization: "背景初始化",
			flowingBackgroundStageEnvironment: "浏览器能力检查",
			flowingBackgroundStylesMissing: "尚未识别到必需的应用样式。",
			flowingBackgroundStylesAmbiguous: "无法唯一识别必需的应用样式。",
			flowingBackgroundFrameMissing: "未找到必需的应用布局元素。",
			flowingBackgroundFrameHidden: "应用框架当前没有可见区域。",
			flowingBackgroundFrameAmbiguous: "检测到多个应用框架，无法确认背景目标。",
			flowingBackgroundFrameUnsupported: "当前应用布局不符合背景挂载要求。",
			flowingBackgroundFrameChanged: "背景挂载后，应用框架样式发生了变化。",
			flowingBackgroundInitializationFailed: "准备背景时发生了意外错误。",
			flowingBackgroundEnvironmentUnavailable: "当前缺少必需的浏览器能力或页面元素。",
			flowingBackgroundResultMissing: "未找到",
			flowingBackgroundResultAmbiguous: "不唯一",
			flowingBackgroundResultHidden: "无可见区域",
			flowingBackgroundResultUnsupported: "不支持",
			flowingBackgroundResultChanged: "挂载后发生变化",
			flowingBackgroundResultFailed: "初始化失败",
			flowingBackgroundStatePreserved: "背景开关的已保存值未更改，背景暂时隐藏，原生界面已保留。",
			flowingBackgroundRecoveryWait: "页面布局或样式变化后会自动重新检查。加载完成后仍失败，请更新 PowerDSH 并重新加载界面；仍无法恢复请复制错误信息反馈。",
			flowingBackgroundRecoveryUpdate: "请更新 PowerDSH 并重新加载界面；仍失败请复制错误信息反馈。",
			flowingBackgroundRecoveryRetry: "可关闭后重新开启背景重试；仍失败请复制错误信息反馈。"
		}
	};

// src/features/flowing-background/rpc.ts
	const wallpaperCodec = {
		mode: "strict",
		typeSymbol: "power-dsh#WallpaperAsset",
		create: () => ({ parse(value) {
			if (!isRecord(value) || typeof value.name !== "string" || typeof value.mime !== "string" || typeof value.bytes !== "number" || typeof value.dataUrl !== "string" || !value.dataUrl.startsWith("data:image/")) throw new TypeError("Invalid wallpaper asset");
			return {
				name: value.name,
				mime: value.mime,
				bytes: value.bytes,
				dataUrl: value.dataUrl
			};
		} })
	};
	const nullableWallpaperCodec = {
		mode: "strict",
		typeSymbol: "power-dsh#WallpaperAsset?",
		create: () => ({ parse(value) {
			return value === null ? null : wallpaperCodec.create().parse(value);
		} })
	};
	const clearedCodec = {
		mode: "strict",
		typeSymbol: "power-dsh#WallpaperCleared",
		create: () => ({ parse(value) {
			if (!isRecord(value) || value.cleared !== true) throw new TypeError("Invalid wallpaper clear result");
			return { cleared: true };
		} })
	};
	function descriptor(method, fields, result) {
		return {
			id: `power-dsh#powerDsh/${method}`,
			service: "powerDsh",
			namespace: "powerDsh",
			method,
			invocation: { kind: "direct" },
			parameters: fields.map((name) => ({
				name,
				wire: name,
				source: "json",
				codec: stringCodec
			})),
			result
		};
	}
	const READ_WALLPAPER_RPC = descriptor("readWallpaper", [], nullableWallpaperCodec);
	const SAVE_WALLPAPER_RPC = descriptor("saveWallpaper", ["dataUrl", "name"], wallpaperCodec);
	const CLEAR_WALLPAPER_RPC = descriptor("clearWallpaper", [], clearedCodec);
	const rpc$1 = [
		READ_WALLPAPER_RPC,
		SAVE_WALLPAPER_RPC,
		CLEAR_WALLPAPER_RPC
	];

// src/features/archive/archive-catalog.ts
	function comparator(sortBy) {
		if (sortBy === "created") return (a, b) => b.createdAt - a.createdAt;
		return (a, b) => b.updatedAt - a.updatedAt;
	}
	/**
	* Group archived sessions by workspace, keeping the native workspace order and
	* placing sessions without a workspace in one trailing group. Search matches
	* the session title or its workspace title; the optional project filter keeps
	* one workspace, and the optional sort orders rows inside each group.
	*/
	function groupArchivedSessions(catalog, query, ungroupedLabel, options = {}) {
		const sortBy = options.sortBy ?? "updated";
		const projectId = options.projectId ?? "";
		const needle = query.trim().toLocaleLowerCase();
		const rows = catalog.sessions.filter((row) => {
			if (projectId && row.workspaceId !== projectId) return false;
			return !needle || `${row.title} ${row.workspaceTitle}`.toLocaleLowerCase().includes(needle);
		});
		const order = [];
		const groups = /* @__PURE__ */ new Map();
		for (const workspace of catalog.workspaces) {
			order.push(workspace.workspaceId);
			groups.set(workspace.workspaceId, {
				key: workspace.workspaceId,
				title: workspace.title,
				sessions: []
			});
		}
		const ungroupedKey = "__ungrouped__";
		for (const row of rows) {
			const key = row.workspaceId || ungroupedKey;
			let group = groups.get(key);
			if (!group) {
				group = {
					key,
					title: row.workspaceTitle || ungroupedLabel,
					sessions: []
				};
				groups.set(key, group);
				order.push(key);
			}
			group.sessions.push(row);
		}
		const compare = comparator(sortBy);
		return order.map((key) => groups.get(key)).filter((group) => group.sessions.length > 0).map((group) => ({
			...group,
			sessions: [...group.sessions].sort(compare)
		}));
	}

// src/features/archive/styles.ts
	const styles = `
.power-dsh-archive-page .power-dsh-skill-panel { gap:18px; }
.power-dsh-archive-page .power-dsh-archive-toolbar { display:flex; flex-wrap:wrap; align-items:center; gap:10px; }
.power-dsh-archive-page .power-dsh-archive-toolbar .power-dsh-skill-search-field { flex:1 1 220px; width:auto; }
.power-dsh-archive-page .power-dsh-archive-select { box-sizing:border-box; display:inline-flex; align-items:center; gap:8px; height:36px; max-width:220px; border:.5px solid var(--dsw-alias-border-l4); border-radius:var(--dsw-radius-md); padding:0 10px 0 12px; background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); font:inherit; font-size:13px; cursor:pointer; }
.power-dsh-archive-page .power-dsh-archive-select:disabled { opacity:.5; cursor:default; }
.power-dsh-archive-page .power-dsh-archive-select:focus-visible { outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; }
.power-dsh-archive-page .power-dsh-archive-select-label { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.power-dsh-archive-page .power-dsh-archive-select > svg { flex:none; color:var(--dsw-alias-label-tertiary); }
.power-dsh-archive-page .power-dsh-archive-menu { min-width:0; max-width:100%; }
.power-dsh-archive-page .power-dsh-archive-group { display:flex; flex-direction:column; gap:8px; }
.power-dsh-archive-page .power-dsh-archive-group + .power-dsh-archive-group { border-top:.5px solid var(--dsw-alias-border-l2); padding-top:14px; }
.power-dsh-archive-page .power-dsh-archive-group-header { display:flex; align-items:center; gap:8px; min-height:28px; }
.power-dsh-archive-page .power-dsh-archive-group-toggle { display:flex; flex:1 1 auto; align-items:center; gap:8px; min-width:0; border:0; border-radius:var(--dsw-radius-sm); padding:0; background:transparent; color:inherit; font:inherit; text-align:left; cursor:pointer; }
.power-dsh-archive-page .power-dsh-archive-group-toggle:hover { color:var(--dsw-alias-label-primary); }
.power-dsh-archive-page .power-dsh-archive-group-toggle:focus-visible { outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; }
.power-dsh-archive-page .power-dsh-archive-group-toggle > .power-dsh-skill-chevron { flex:none; color:var(--dsw-alias-label-tertiary); transform:rotate(-90deg); }
.power-dsh-archive-page .power-dsh-archive-group-toggle[aria-expanded="true"] > .power-dsh-skill-chevron { transform:none; }
.power-dsh-archive-page .power-dsh-archive-group-folder { display:inline-flex; flex:none; color:var(--dsw-alias-label-tertiary); }
.power-dsh-archive-page .power-dsh-archive-group-title { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--dsw-alias-label-primary); font-size:14px; line-height:22px; font-weight:500; }
.power-dsh-archive-page .power-dsh-archive-count { flex:none; color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:18px; }
.power-dsh-archive-page .power-dsh-archive-rows { margin:0; padding:0; list-style:none; overflow:hidden; border:.5px solid var(--dsw-alias-settings-card-stroke); border-radius:var(--dsw-radius-xl); background:var(--dsw-alias-settings-card-fill); }
.power-dsh-archive-page .power-dsh-archive-row { display:flex; align-items:center; gap:12px; padding:12px 14px; }
.power-dsh-archive-page .power-dsh-archive-row + .power-dsh-archive-row { border-top:.5px solid var(--dsw-alias-border-l2); }
.power-dsh-archive-page .power-dsh-archive-row-main { display:flex; flex:1 1 auto; flex-direction:column; gap:2px; min-width:0; }
.power-dsh-archive-page .power-dsh-archive-row-title { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--dsw-alias-label-primary); font-size:14px; line-height:20px; }
.power-dsh-archive-page .power-dsh-archive-row-time { color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:18px; }
.power-dsh-archive-page .power-dsh-archive-row-actions { display:flex; flex:none; align-items:center; gap:4px; }
/* Row and dialog buttons follow the native Models settings buttons; see docs/third-party-notices.md. */
.power-dsh-archive-page .power-dsh-archive-action { box-sizing:border-box; display:inline-flex; align-items:center; justify-content:center; height:28px; border:.5px solid var(--dsw-alias-border-l3); border-radius:var(--dsw-radius-sm); padding:0 10px; background:transparent; color:var(--dsw-alias-label-primary); font:inherit; font-size:12px; line-height:18px; cursor:pointer; }
.power-dsh-archive-page .power-dsh-archive-action-danger { border-color:transparent; color:var(--dsw-alias-state-error-primary); }
@media (hover:hover) {
  .power-dsh-archive-page .power-dsh-archive-action:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover-solid); }
  .power-dsh-archive-page .power-dsh-archive-action-danger:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover-danger); }
}
.power-dsh-archive-page .power-dsh-archive-action:disabled { opacity:.4; cursor:default; }
.power-dsh-archive-page .power-dsh-archive-action:focus-visible { outline:none; box-shadow:0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); }
.power-dsh-archive-confirm-delete:not(:disabled) { --dsh-button-outline-color:var(--dsw-alias-state-error-primary); color:var(--dsw-alias-state-error-primary); }
@media (hover:hover) { .power-dsh-archive-confirm-delete:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover-danger); } }
@media (prefers-reduced-motion:no-preference) { .power-dsh-archive-page .power-dsh-archive-group-toggle > .power-dsh-skill-chevron { transition:transform 140ms var(--ds-ease-in-out); } }
`;

// src/features/archive/client.ts
	function createClientFeature(runtime, env) {
		const { React, h, Menu, Modal, Button, Tooltip, observable, useSnapshot, useMounted, errorFeedback } = runtime;
		const { ctx, t, savePreference, preferenceSlot, namespace } = env;
		const styles$13 = styles$11 + styles$8 + styles;
		const { SkillSearchIcon, SkillChevron } = createCatalogUI(runtime);
		function ArchiveIcon({ size = 16 }) {
			return h("svg", {
				width: size,
				height: size,
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 2,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": true,
				focusable: false
			}, h("rect", {
				x: 2,
				y: 3,
				width: 20,
				height: 5,
				rx: 1
			}), h("path", { d: "M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" }), h("path", { d: "M10 12h4" }));
		}
		function FolderIcon({ size = 16 }) {
			return h("svg", {
				width: size,
				height: size,
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 2,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": true,
				focusable: false
			}, h("path", { d: "M4 20a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2z" }));
		}
		const deleteErrorKeys = [
			"archiveDeleteUnavailable",
			"archiveDeleteLive",
			"archiveDeleteUnsupported",
			"archiveDeleteUnsafe",
			"archiveNotArchived",
			"archiveInvalidSession",
			"archiveDeleteIncomplete",
			"archiveDeleteCheckFailed",
			"archiveDeleteStatFailed",
			"archiveDeleteUnarchiveFailed",
			"archiveDeleteRemoveFailed"
		];
		const archiveErrorMessage = (message, fallback) => {
			if (message?.includes("archiveUnavailable")) return t("archiveUnavailable");
			const key = message ? deleteErrorKeys.find((candidate) => message.includes(candidate)) : void 0;
			return t(key ?? fallback);
		};
		function ArchiveSelect({ label, value, options, disabled, onChange }) {
			const [open, setOpen] = React.useState(false);
			const current = options.find((option) => option.id === value) ?? options[0];
			return h(Menu, {
				open: open && !disabled,
				align: "end",
				portal: true,
				autoFocus: true,
				minWidthFromAnchor: true,
				className: "power-dsh-archive-menu",
				selectedId: value,
				items: options.map((option) => ({
					id: option.id,
					label: option.label
				})),
				onClose: () => setOpen(false),
				onSelect: (id) => {
					setOpen(false);
					if (id !== value) onChange(id);
				},
				anchor: h("button", {
					type: "button",
					className: "power-dsh-archive-select",
					disabled: Boolean(disabled),
					"aria-haspopup": "menu",
					"aria-expanded": open && !disabled,
					"aria-label": label,
					onClick: () => setOpen((state) => !state)
				}, h("span", { className: "power-dsh-archive-select-label" }, current?.label ?? label), h("svg", {
					width: 16,
					height: 16,
					viewBox: "0 0 16 16",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: 1.4,
					strokeLinecap: "round",
					strokeLinejoin: "round",
					"aria-hidden": true
				}, h("path", { d: "m4 6 4 4 4-4" })))
			});
		}
		function ArchivePage({ t, archiveSource, loadArchivedSessions, restoreArchivedSession, deleteArchivedSession }) {
			const snapshot = useSnapshot(archiveSource);
			const catalog = snapshot.value;
			const [query, setQuery] = React.useState("");
			const [sortBy, setSortBy] = React.useState("updated");
			const [projectId, setProjectId] = React.useState("");
			const [restoring, setRestoring] = React.useState(null);
			const [deleting, setDeleting] = React.useState(null);
			const [confirming, setConfirming] = React.useState(null);
			const [closedGroups, setClosedGroups] = React.useState({});
			const [error, setError] = React.useState(null);
			const id = React.useId();
			const mounted = useMounted();
			const pending = React.useRef(false);
			const busy = snapshot.status === "loading" || restoring !== null || deleting !== null;
			React.useEffect(() => {
				loadArchivedSessions();
				const refresh = () => {
					loadArchivedSessions();
				};
				window.addEventListener("focus", refresh);
				return () => window.removeEventListener("focus", refresh);
			}, []);
			const groups = catalog ? groupArchivedSessions(catalog, query, t("archiveUngrouped"), {
				sortBy,
				projectId
			}) : [];
			const sortOptions = [{
				id: "updated",
				label: t("archiveSortUpdated")
			}, {
				id: "created",
				label: t("archiveSortCreated")
			}];
			const projectOptions = [{
				id: "all",
				label: t("archiveAllProjects")
			}, ...(catalog?.workspaces ?? []).map((workspace) => ({
				id: workspace.workspaceId,
				label: workspace.title
			}))];
			const projectValue = projectId || "all";
			const disabled = busy || snapshot.status !== "ready" || !catalog?.complete;
			async function restore(sessionId) {
				if (disabled || pending.current) return;
				pending.current = true;
				setRestoring(sessionId);
				setError(null);
				try {
					await restoreArchivedSession(sessionId);
				} catch (failure) {
					if (mounted.current) setError({
						id: sessionId,
						message: archiveErrorMessage(errorMessage(failure), "archiveRestoreFailed")
					});
				} finally {
					pending.current = false;
					if (mounted.current) setRestoring(null);
				}
			}
			async function confirmDelete(sessionId) {
				if (pending.current) return;
				pending.current = true;
				setDeleting(sessionId);
				setError(null);
				try {
					await deleteArchivedSession(sessionId);
					if (mounted.current) setConfirming(null);
				} catch (failure) {
					if (mounted.current) {
						setConfirming(null);
						setError({
							id: sessionId,
							message: archiveErrorMessage(errorMessage(failure), "archiveDeleteFailed")
						});
					}
				} finally {
					pending.current = false;
					if (mounted.current) setDeleting(null);
				}
			}
			const renderRow = (row) => {
				const rowBusy = restoring === row.sessionId || deleting === row.sessionId;
				const time = row.updatedAt > 0 ? new Date(row.updatedAt).toLocaleString() : "";
				const name = row.title || t("archiveUntitled");
				return h("li", {
					key: row.sessionId,
					className: "power-dsh-archive-row",
					"data-archive": row.sessionId
				}, h("div", { className: "power-dsh-archive-row-main" }, h(Tooltip, {
					label: row.title || row.sessionId,
					side: "top",
					portal: true,
					delayMs: 0,
					maxWidth: 480
				}, h("span", {
					className: "power-dsh-archive-row-title",
					tabIndex: 0
				}, name)), time && h("span", { className: "power-dsh-archive-row-time" }, time), error?.id === row.sessionId && errorFeedback({
					t,
					id: `${row.sessionId}-error`,
					message: error.message,
					code: "PD-ARCHIVE-ACTION",
					operation: "archiveSession"
				})), h("div", { className: "power-dsh-archive-row-actions" }, h("button", {
					type: "button",
					className: "power-dsh-archive-action power-dsh-archive-action-danger",
					"data-delete": row.sessionId,
					"aria-label": `${t("archiveDelete")} ${name}`,
					disabled: disabled || rowBusy,
					"aria-busy": deleting === row.sessionId,
					onClick: () => {
						if (mounted.current) setConfirming(row);
					}
				}, t(deleting === row.sessionId ? "archiveDeleting" : "archiveDelete")), h("button", {
					type: "button",
					className: "power-dsh-archive-action",
					"data-restore": row.sessionId,
					"aria-label": `${t("archiveRestore")} ${name}`,
					disabled: disabled || rowBusy,
					"aria-busy": restoring === row.sessionId,
					onClick: () => restore(row.sessionId)
				}, t(restoring === row.sessionId ? "archiveRestoring" : "archiveRestore"))));
			};
			const renderGroup = (group, index) => {
				const titleId = `${id}-archive-group-${index}`;
				const open = Boolean(query.trim()) || !closedGroups[group.key];
				return h("section", {
					key: group.key,
					className: "power-dsh-archive-group",
					"aria-labelledby": titleId
				}, h("div", { className: "power-dsh-archive-group-header" }, h("button", {
					id: titleId,
					type: "button",
					className: "power-dsh-archive-group-toggle",
					"aria-expanded": open,
					"aria-controls": `${titleId}-body`,
					onClick: () => {
						if (query.trim()) return;
						if (mounted.current) setClosedGroups((current) => ({
							...current,
							[group.key]: !current[group.key]
						}));
					}
				}, h(SkillChevron), h("span", { className: "power-dsh-archive-group-folder" }, h(FolderIcon)), h("span", { className: "power-dsh-archive-group-title" }, group.title)), h("span", { className: "power-dsh-archive-count" }, t("archiveCount").replace("{count}", () => String(group.sessions.length)))), open && h("ul", {
					id: `${titleId}-body`,
					className: "power-dsh-archive-rows"
				}, group.sessions.map(renderRow)));
			};
			return h("section", {
				className: "power-dsh-page power-dsh-skills-page power-dsh-archive-page",
				"aria-label": t("archiveTab")
			}, h("style", null, styles$13), h("header", null, h("h2", { className: "power-dsh-title" }, t("archiveTab")), h("p", { className: "power-dsh-description" }, t("archiveDescription"))), snapshot.status === "loading" && h("p", {
				className: "power-dsh-notice",
				role: "status"
			}, t("loading")), snapshot.status === "error" && errorFeedback({
				t,
				message: snapshot.error || t("archiveLoadFailed"),
				code: "PD-ARCHIVE-LOAD",
				operation: "listArchivedSessions",
				placement: "page",
				retry: loadArchivedSessions,
				disabled: busy
			}), h("div", { className: "power-dsh-skill-panel" }, catalog && h("div", { className: "power-dsh-archive-toolbar" }, h("label", { className: "power-dsh-skill-search-field" }, h(SkillSearchIcon), h("input", {
				type: "search",
				value: query,
				disabled: busy,
				placeholder: t("archiveSearch"),
				"aria-label": t("archiveSearch"),
				onChange: (event) => {
					if (mounted.current) setQuery(event.target.value);
				}
			})), h(ArchiveSelect, {
				label: t("archiveSortLabel"),
				value: sortBy,
				options: sortOptions,
				disabled: busy,
				onChange: (value) => {
					if (mounted.current) setSortBy(value);
				}
			}), h(ArchiveSelect, {
				label: t("archiveProjectLabel"),
				value: projectValue,
				options: projectOptions,
				disabled: busy,
				onChange: (value) => {
					if (mounted.current) setProjectId(value === "all" ? "" : value);
				}
			})), catalog && snapshot.status === "ready" && groups.map(renderGroup), catalog && snapshot.status === "ready" && groups.length === 0 && h("p", { className: "power-dsh-skill-empty" }, t(query || projectId ? "archiveNoMatches" : "archiveEmpty"))), error && !(catalog?.sessions ?? []).some((row) => row.sessionId === error.id) && errorFeedback({
				t,
				message: error.message,
				code: "PD-ARCHIVE-ACTION",
				operation: "archiveSession",
				placement: "page"
			}), confirming && h(Modal, {
				open: true,
				onClose: () => {
					if (deleting === null) setConfirming(null);
				},
				title: t("archiveDeleteTitle"),
				closeLabel: t("close"),
				description: t("archiveDeleteDescription").replace("{name}", () => confirming.title || t("archiveUntitled")),
				footer: h(React.Fragment, null, h(Button, {
					variant: "outline",
					"data-modal-autofocus": true,
					disabled: deleting !== null,
					onClick: () => {
						if (deleting === null) setConfirming(null);
					}
				}, t("cancel")), h(Button, {
					variant: "outline",
					className: "power-dsh-archive-confirm-delete",
					disabled: deleting !== null,
					onClick: () => {
						confirmDelete(confirming.sessionId);
					}
				}, t(deleting !== null ? "archiveDeleting" : "archiveDeleteConfirm")))
			}));
		}
		let active = true;
		let archive = {
			status: "loading",
			value: null,
			error: ""
		};
		const archiveSource = observable(() => archive);
		let generation = 0;
		ctx.effect(() => () => {
			active = false;
			generation++;
		});
		const loadArchivedSessions = async () => {
			const current = ++generation;
			if (archive.status !== "ready") {
				archive = {
					...archive,
					status: "loading",
					error: ""
				};
				archiveSource.notify();
			}
			try {
				const result = await ctx.remote.powerDsh.listArchivedSessions();
				if (!active || current !== generation) return;
				if (!result.ok) throw new Error(result.error.message);
				archive = {
					status: "ready",
					value: result.value,
					error: ""
				};
			} catch (failure) {
				if (!active || current !== generation) return;
				archive = {
					...archive,
					status: "error",
					error: archiveErrorMessage(errorMessage(failure), "archiveLoadFailed")
				};
			}
			archiveSource.notify();
		};
		const restoreArchivedSession = async (sessionId) => {
			const current = ++generation;
			const result = await ctx.remote.powerDsh.restoreArchivedSession(sessionId);
			if (!active || current !== generation) return;
			if (!result.ok) {
				await loadArchivedSessions();
				throw new Error(result.error.message);
			}
			archive = {
				status: "ready",
				value: result.value,
				error: ""
			};
			archiveSource.notify();
		};
		const deleteArchivedSession = async (sessionId) => {
			const current = ++generation;
			const result = await ctx.remote.powerDsh.deleteArchivedSession(sessionId);
			if (!active || current !== generation) return;
			if (!result.ok) {
				await loadArchivedSessions();
				throw new Error(result.error.message);
			}
			archive = {
				status: "ready",
				value: result.value,
				error: ""
			};
			archiveSource.notify();
		};
		preferenceSlot("archiveManagerEnabled", "settings.section", {
			id: "power-dsh-archive",
			order: 54,
			locale: namespace,
			label: () => t("archiveTab")
		}, (props) => h(ArchivePage, {
			...props,
			archiveSource,
			loadArchivedSessions,
			restoreArchivedSession,
			deleteArchivedSession
		}));
		preferenceSlot("archiveManagerEnabled", "settings.section.icon", { id: "power-dsh-archive" }, ArchiveIcon);
		return {
			settings: [{
				field: "archiveManagerEnabled",
				description: "archiveManagerDescription",
				save: (next) => savePreference("archiveManagerEnabled", next === true, "archiveOutdated"),
				hideError: true
			}],
			api: {
				archiveSource,
				loadArchivedSessions,
				restoreArchivedSession,
				deleteArchivedSession
			}
		};
	}

// src/features/archive/definition.ts
	const definition = Object.freeze({
		id: "archive",
		category: "enhance",
		order: 10,
		keys: Object.freeze(["archiveManagerEnabled"]),
		spec: "src/features/archive/spec.md"
	});

// src/features/archive/locales.ts
	const locales$1 = {
		"en": {
			"archiveManagerEnabled": "Archive management",
			"archiveManagerDescription": "Review and restore archived sessions",
			"archiveTab": "Archive",
			"archiveDescription": "Review and restore archived sessions in DSH",
			"archiveSearch": "Search archived sessions",
			"archiveEmpty": "No archived sessions",
			"archiveNoMatches": "No matching archived sessions",
			"archiveCount": "{count} sessions",
			"archiveSortLabel": "Sort",
			"archiveSortUpdated": "Last updated",
			"archiveSortCreated": "Created",
			"archiveProjectLabel": "Project",
			"archiveAllProjects": "All projects",
			"archiveRestore": "Restore",
			"archiveRestoring": "Restoring…",
			"archiveRestoreFailed": "Could not restore this session. Please try again.",
			"archiveDelete": "Delete",
			"archiveDeleteTitle": "Delete session?",
			"archiveDeleteDescription": "This permanently deletes session “{name}” and its transcript. This cannot be undone.",
			"archiveDeleteConfirm": "Delete permanently",
			"archiveDeleting": "Deleting…",
			"archiveDeleteFailed": "Could not delete this session. Please try again.",
			"archiveDeleteLive": "This session is still running. Stop it before deleting.",
			"archiveDeleteUnavailable": "Deleting sessions is unavailable in this Host.",
			"archiveDeleteUnsupported": "This session store cannot be deleted safely.",
			"archiveDeleteUnsafe": "Refusing to delete through a symbolic link.",
			"archiveNotArchived": "This session is not archived.",
			"archiveInvalidSession": "This session reference is invalid.",
			"archiveDeleteIncomplete": "Could not fully remove this session. It may still appear.",
			"archiveDeleteCheckFailed": "Could not read the archive state. Please try again.",
			"archiveDeleteStatFailed": "Could not locate this session's storage, so nothing was deleted.",
			"archiveDeleteUnarchiveFailed": "Could not update the archive state, so nothing was deleted.",
			"archiveDeleteRemoveFailed": "Could not delete the session files. Check disk permissions and try again.",
			"archiveLoadFailed": "Could not load archived sessions. Please try again.",
			"archiveUnavailable": "Archive management is currently unavailable.",
			"archiveUntitled": "Untitled session",
			"archiveUngrouped": "Ungrouped",
			"archiveOutdated": "Archive management is not loaded in the Host yet. Re-enable power-dsh, then try again."
		},
		"zh": {
			"archiveManagerEnabled": "归档管理",
			"archiveManagerDescription": "查看并恢复已归档会话",
			"archiveTab": "归档",
			"archiveDescription": "查看并恢复 DSH 中已归档的会话",
			"archiveSearch": "搜索已归档会话",
			"archiveEmpty": "暂无归档会话",
			"archiveNoMatches": "未找到匹配的归档会话",
			"archiveCount": "{count} 个会话",
			"archiveSortLabel": "排序方式",
			"archiveSortUpdated": "更新时间",
			"archiveSortCreated": "创建时间",
			"archiveProjectLabel": "项目",
			"archiveAllProjects": "所有项目",
			"archiveRestore": "取消归档",
			"archiveRestoring": "正在取消归档…",
			"archiveRestoreFailed": "无法恢复此会话，请重试。",
			"archiveDelete": "删除",
			"archiveDeleteTitle": "删除会话？",
			"archiveDeleteDescription": "将永久删除会话“{name}”及其对话记录，此操作不可恢复。",
			"archiveDeleteConfirm": "永久删除",
			"archiveDeleting": "正在删除…",
			"archiveDeleteFailed": "无法删除此会话，请重试。",
			"archiveDeleteLive": "该会话仍在运行，请先停止后再删除。",
			"archiveDeleteUnavailable": "当前 Host 不支持删除会话。",
			"archiveDeleteUnsupported": "该会话存储无法安全删除。",
			"archiveDeleteUnsafe": "拒绝通过符号链接删除。",
			"archiveNotArchived": "该会话不在归档中。",
			"archiveInvalidSession": "会话标识无效。",
			"archiveDeleteIncomplete": "未能彻底移除该会话，可能仍会显示。",
			"archiveDeleteCheckFailed": "无法读取归档状态，请重试。",
			"archiveDeleteStatFailed": "无法定位该会话的存储文件，未执行删除。",
			"archiveDeleteUnarchiveFailed": "无法更新归档状态，未执行删除。",
			"archiveDeleteRemoveFailed": "删除会话文件失败，请检查磁盘权限后重试。",
			"archiveLoadFailed": "无法加载归档会话，请重试。",
			"archiveUnavailable": "归档管理暂不可用。",
			"archiveUntitled": "未命名会话",
			"archiveUngrouped": "未归类",
			"archiveOutdated": "归档管理尚未在后端加载，请重新启用 power-dsh 后重试。"
		}
	};

// src/features/archive/rpc.ts
	const archiveCatalogCodec = {
		mode: "strict",
		typeSymbol: "power-dsh#ArchiveCatalog",
		create: () => ({ parse(value) {
			if (!isRecord(value) || typeof value.complete !== "boolean" || !isArray(value.workspaces) || !isArray(value.sessions)) throw new TypeError("Invalid archive catalog");
			const workspaces = value.workspaces.map((row) => {
				if (!isRecord(row) || !hasStrings(row, ["workspaceId", "title"])) throw new TypeError("Invalid archive workspace");
				return {
					workspaceId: row.workspaceId,
					title: row.title
				};
			});
			const sessions = value.sessions.map((row) => {
				if (!isRecord(row) || !hasStrings(row, [
					"sessionId",
					"title",
					"workspaceId",
					"workspaceTitle"
				]) || typeof row.updatedAt !== "number" || !Number.isFinite(row.updatedAt) || typeof row.createdAt !== "number" || !Number.isFinite(row.createdAt)) throw new TypeError("Invalid archive session");
				return {
					sessionId: row.sessionId,
					title: row.title,
					workspaceId: row.workspaceId,
					workspaceTitle: row.workspaceTitle,
					updatedAt: row.updatedAt,
					createdAt: row.createdAt
				};
			});
			return {
				complete: value.complete,
				workspaces,
				sessions
			};
		} })
	};
	function archiveRpc(method, fields) {
		return {
			id: `power-dsh#powerDsh/${method}`,
			service: "powerDsh",
			namespace: "powerDsh",
			method,
			invocation: { kind: "direct" },
			parameters: fields.map((name) => ({
				name,
				wire: name,
				source: "json",
				codec: stringCodec
			})),
			result: archiveCatalogCodec
		};
	}
	const LIST_ARCHIVED_SESSIONS_RPC = archiveRpc("listArchivedSessions", []);
	const RESTORE_ARCHIVED_SESSION_RPC = archiveRpc("restoreArchivedSession", ["sessionId"]);
	const DELETE_ARCHIVED_SESSION_RPC = archiveRpc("deleteArchivedSession", ["sessionId"]);
	const rpc = [
		LIST_ARCHIVED_SESSIONS_RPC,
		RESTORE_ARCHIVED_SESSION_RPC,
		DELETE_ARCHIVED_SESSION_RPC
	];

// src/app/client-features.ts
	const clientFeatures = [
		{
			definition: definition$3,
			create: createClientFeature$3,
			locales: locales$4,
			rpc: []
		},
		{
			definition: definition$16,
			create: createClientFeature$16,
			locales: locales$17,
			rpc: []
		},
		{
			definition: definition$11,
			create: createClientFeature$11,
			locales: locales$12,
			rpc: []
		},
		{
			definition: definition$10,
			create: createClientFeature$10,
			locales: locales$11,
			rpc: rpc$8
		},
		{
			definition: definition$13,
			create: createClientFeature$13,
			locales: locales$14,
			rpc: rpc$10
		},
		{
			definition: definition$12,
			create: createClientFeature$12,
			locales: locales$13,
			rpc: rpc$9
		},
		{
			definition: definition$8,
			create: createClientFeature$8,
			locales: locales$9,
			rpc: rpc$6
		},
		{
			definition: definition$14,
			create: createClientFeature$14,
			locales: locales$15,
			rpc: rpc$11
		},
		{
			definition: definition$17,
			create: createClientFeature$17,
			locales: locales$18,
			rpc: rpc$12
		},
		{
			definition: definition$9,
			create: createClientFeature$9,
			locales: locales$10,
			rpc: rpc$7
		},
		{
			definition: definition$7,
			create: createClientFeature$7,
			locales: locales$8,
			rpc: rpc$5
		},
		{
			definition: definition$6,
			create: createClientFeature$6,
			locales: locales$7,
			rpc: rpc$4
		},
		{
			definition: definition$5,
			create: createClientFeature$5,
			locales: locales$6,
			rpc: rpc$3
		},
		{
			definition: definition$4,
			create: createClientFeature$4,
			locales: locales$5,
			rpc: rpc$2
		},
		{
			definition: definition$15,
			create: createClientFeature$15,
			locales: locales$16,
			rpc: []
		},
		{
			definition: definition$2,
			create: createClientFeature$2,
			locales: locales$3,
			rpc: []
		},
		{
			definition: definition$1,
			create: createClientFeature$1,
			locales: locales$2,
			rpc: rpc$1
		},
		{
			definition,
			create: createClientFeature,
			locales: locales$1,
			rpc
		}
	];

// src/shared/client/locales.ts
	const locales = {
		"en": {
			"title": "PowerDSH",
			"generalTab": "General",
			"interfaceTab": "Interface",
			"enhancementsTab": "Management",
			"simplifyTab": "Simplify",
			"otherTab": "Other",
			"skillPreinstalledGroup": "Built-in",
			"skillPersonalGroup": "User",
			"retry": "Retry",
			"errorDetails": "Error information",
			"copyErrorInfo": "Copy error information",
			"errorInfoCopied": "Error information copied.",
			"errorInfoCopyFailed": "Could not copy. Select the text above and copy it manually.",
			"save": "Save",
			"cancel": "Cancel",
			"saving": "Saving…",
			"description": "A DSH enhancement plugin",
			"close": "Close",
			"moreActions": "More actions",
			"loading": "Loading settings…",
			"unavailable": "Settings are currently unavailable.",
			"readOnly": "These settings are read-only.",
			"saveFailed": "Could not save this setting. Please try again.",
			"versionUnavailable": "DSH version information is currently unavailable.",
			"settingsOutdated": "This feature has not loaded in the Host yet. Re-enable power-dsh in plugin management, then try again."
		},
		"zh": {
			"title": "PowerDSH",
			"generalTab": "通用",
			"interfaceTab": "界面",
			"enhancementsTab": "管理",
			"simplifyTab": "精简",
			"otherTab": "其他",
			"skillPreinstalledGroup": "内置",
			"skillPersonalGroup": "用户",
			"retry": "重试",
			"errorDetails": "错误信息",
			"copyErrorInfo": "复制错误信息",
			"errorInfoCopied": "已复制错误信息。",
			"errorInfoCopyFailed": "复制失败，请选择上方文本手动复制。",
			"save": "保存",
			"cancel": "取消",
			"saving": "正在保存…",
			"description": "DSH 增强插件",
			"close": "关闭",
			"moreActions": "更多操作",
			"loading": "正在加载设置…",
			"unavailable": "设置暂不可用。",
			"readOnly": "当前设置为只读。",
			"saveFailed": "无法保存此设置，请重试。",
			"versionUnavailable": "DSH 版本信息暂不可用。",
			"settingsOutdated": "该功能尚未在后端加载，请在插件管理中重新启用 power-dsh 后重试。"
		}
	};

// src/app/locales.ts
	function composeDictionaries(contributions) {
		const result = {
			en: {},
			zh: {}
		};
		for (const contribution of contributions) for (const language of ["en", "zh"]) {
			if (Object.keys(contribution.en).sort().join() !== Object.keys(contribution.zh).sort().join()) throw new Error("Locale key mismatch");
			for (const [key, value] of Object.entries(contribution[language])) {
				if (Object.hasOwn(result[language], key)) throw new Error(`Duplicate locale key: ${key}`);
				result[language][key] = value;
			}
		}
		return result;
	}
	function featureDictionaries(features = clientFeatures) {
		return composeDictionaries([locales, ...features.map((feature) => feature.locales)]);
	}
	const dictionaries = featureDictionaries();

// src/app/rpc.ts
	function composeRpc(descriptors) {
		const ids = /* @__PURE__ */ new Set();
		const methods = /* @__PURE__ */ new Set();
		for (const descriptor of descriptors) {
			if (ids.has(descriptor.id)) throw new Error(`Duplicate RPC id: ${descriptor.id}`);
			if (methods.has(descriptor.method)) throw new Error(`Duplicate RPC method: ${descriptor.method}`);
			ids.add(descriptor.id);
			methods.add(descriptor.method);
		}
		return descriptors;
	}
	const MOD_RPC = composeRpc([
		RESTART_STATUS_RPC,
		RESTART_APP_RPC,
		LIST_SYSTEM_SOUNDS_RPC,
		PLAY_SYSTEM_SOUND_RPC,
		ACCOUNT_RPC,
		TELEMETRY_RPC,
		TODO_RPC,
		PLAN_RPC,
		GOAL_RPC,
		SEARCH_RPC,
		READ_PERSONALIZATION_RPC,
		SAVE_PERSONALIZATION_RPC,
		LIST_SKILLS_RPC,
		SET_SKILL_ENABLED_RPC,
		LIST_MCP_SERVERS_RPC,
		SET_MCP_SERVER_ENABLED_RPC,
		LIST_ARCHIVED_SESSIONS_RPC,
		RESTORE_ARCHIVED_SESSION_RPC,
		DELETE_ARCHIVED_SESSION_RPC,
		READ_WALLPAPER_RPC,
		SAVE_WALLPAPER_RPC,
		CLEAR_WALLPAPER_RPC
	]);

// src/app/client.ts
	function createClient(React, primitives, selectedFeatures = clientFeatures) {
		const runtime = createRuntime(React, primitives);
		const { h } = runtime;
		const SettingsPage = createSettingsPage(runtime);
		const HeaderActions = createHeaderActions(runtime);
		const dictionaries = featureDictionaries(selectedFeatures);
		const selectedRpc = composeRpc(selectedFeatures.flatMap((feature) => feature.rpc));
		const rpcIds = new Set(selectedRpc.map((descriptor) => descriptor.id));
		const descriptors = MOD_RPC.filter((descriptor) => rpcIds.has(descriptor.id));
		if (descriptors.length !== selectedRpc.length) throw new Error("Unregistered Client RPC contribution");
		function Icon({ size = 16 }) {
			return h("svg", {
				viewBox: "0 0 24 24",
				width: size,
				height: size,
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 2,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": true,
				focusable: false
			}, h("path", { d: "M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z" }));
		}
		return {
			inject: [
				"slots",
				"locale",
				"configForms",
				"remote",
				"typert"
			],
			async apply(ctx) {
				await ctx.remote.$mount({
					package: "power-dsh",
					descriptors
				});
				ctx.inject(descriptors.length ? ["remote.powerDsh"] : [], (ctx) => {
					const namespace = "power-dsh";
					for (const [language, dictionary] of Object.entries(dictionaries)) ctx.effect(() => ctx.locale.register(namespace, language, dictionary));
					const t = ctx.locale.bind(namespace);
					const form = createSettingsForm(ctx, namespace);
					const source = {
						subscribe: (listener) => form.subscribe(listener),
						getSnapshot: () => form.getSnapshot()
					};
					const rawVersion = window.__DSH_BOOT__?.release?.version;
					const version = typeof rawVersion === "string" && rawVersion.trim() ? rawVersion.trim() : null;
					const savePreference = createPreferenceSaver(ctx, form, t);
					const preferenceSlot$1 = (field, name, options, component) => preferenceSlot(ctx, form, field, name, options, component);
					const ids = /* @__PURE__ */ new Set();
					const fields = /* @__PURE__ */ new Set();
					const features = [...selectedFeatures].sort((a, b) => a.definition.order - b.definition.order).map(({ definition, create }) => {
						if (ids.has(definition.id)) throw new Error(`Duplicate Client feature: ${definition.id}`);
						ids.add(definition.id);
						const feature = create(runtime, {
							ctx,
							form,
							source,
							t,
							version,
							namespace,
							savePreference,
							preferenceSlot: preferenceSlot$1
						});
						for (const setting of feature.settings || []) {
							if (fields.has(setting.field)) throw new Error(`Duplicate Client setting: ${setting.field}`);
							if (!definition.keys.includes(setting.field)) throw new Error(`Unowned Client setting: ${setting.field}`);
							fields.add(setting.field);
							setting.category = definition.category === "enhance" ? "enhancements" : definition.category;
						}
						return {
							...feature,
							definition
						};
					});
					const api = features.reduce((result, feature) => ({
						...result,
						...feature.api
					}), {});
					ctx.slots.inject("settings.section", () => ctx.slots.register({
						name: "settings.section",
						id: namespace,
						order: 50,
						locale: namespace,
						label: () => t("title")
					}, (props) => h(SettingsPage, {
						...props,
						source,
						form,
						version,
						savePreference,
						features,
						...api
					})));
					ctx.slots.inject("settings.section.icon", () => ctx.slots.register({
						name: "settings.section.icon",
						id: namespace
					}, Icon));
					const sidebar = features.filter((feature) => feature.sidebar);
					const actions = features.flatMap((feature) => feature.headerAction ? [feature.headerAction] : []);
					ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
						name: "sidebar.footer.action",
						id: "power-dsh-footer",
						order: 50,
						locale: namespace
					}, (props) => h("span", {
						className: "power-dsh-footer-seat",
						style: {
							display: "block",
							flex: "1 1 100%",
							minWidth: 0,
							width: "100%",
							height: 0,
							alignSelf: "flex-end"
						}
					}, ...sidebar.map((feature) => feature.sidebar(props)), h(HeaderActions, {
						...props,
						source,
						actions
					}))));
				});
			}
		};
	}

// src/client.ts
	window.__ModuleLoader__.load({
		id: "power-dsh",
		factory(require) {
			return createClient(require("react"), require("@deepseek-ai/dsh-client-ui-primitives"));
		}
	});

})();