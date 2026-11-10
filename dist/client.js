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
	function createClientFeature$18(runtime, env) {
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
	const definition$18 = Object.freeze({
		id: "account-blocking",
		category: "simplify",
		order: 8,
		keys: Object.freeze(["blockOfficialAccount"]),
		spec: "src/features/account-blocking/spec.md"
	});

// src/features/account-blocking/locales.ts
	const locales$19 = {
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
	function createClientFeature$17(runtime, env) {
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
	const definition$17 = Object.freeze({
		id: "appearance-shortcut",
		category: "interface",
		order: 4,
		keys: Object.freeze(["showThemeSwitcher"]),
		spec: "src/features/appearance-shortcut/spec.md"
	});

// src/features/appearance-shortcut/locales.ts
	const locales$18 = {
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
	function createClientFeature$16(runtime, env) {
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
	const definition$16 = Object.freeze({
		id: "double-click-rename",
		category: "other",
		order: 3,
		keys: Object.freeze(["blockDoubleClickRename"]),
		spec: "src/features/double-click-rename/spec.md"
	});

// src/features/double-click-rename/locales.ts
	const locales$17 = {
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
	function createClientFeature$15(runtime, env) {
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
	const definition$15 = Object.freeze({
		id: "mcp",
		category: "enhance",
		order: 8,
		keys: Object.freeze(["mcpManagerEnabled"]),
		spec: "src/features/mcp/spec.md"
	});

// src/features/mcp/locales.ts
	const locales$16 = {
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
	function createClientFeature$14(runtime, env) {
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
	const definition$14 = Object.freeze({
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
	const locales$15 = {
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
	function createClientFeature$13(runtime, env) {
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
	const definition$13 = Object.freeze({
		id: "personalization",
		category: "enhance",
		order: 9,
		keys: Object.freeze(["personalizationEnabled"]),
		spec: "src/features/personalization/spec.md"
	});

// src/features/personalization/locales.ts
	const locales$14 = {
		"en": {
			"personalizationTab": "Personalization",
			"personalizationEnabled": "Personalization",
			"personalizationDescription": "Manage global instructions",
			"settingsLocation": "Global instructions ({path})",
			"globalPromptPlaceholder": "Add custom instructions",
			"globalPrompt": "Global instructions",
			"promptTooLong": "Instructions exceed the 20,000 character limit.",
			"promptConflict": "These instructions changed elsewhere. Copy your draft, then cancel to load the latest version."
		},
		"zh": {
			"personalizationTab": "个性化",
			"personalizationEnabled": "个性化",
			"personalizationDescription": "管理全局提示词",
			"settingsLocation": "全局指令（{path}）",
			"globalPromptPlaceholder": "添加自定义指令",
			"globalPrompt": "全局提示词",
			"promptTooLong": "提示词超过 20,000 字符上限。",
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
	function createClientFeature$12(runtime, env) {
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
	const definition$12 = Object.freeze({
		id: "refresh-button",
		category: "other",
		order: 1,
		keys: Object.freeze(["showRefreshButton"]),
		spec: "src/features/refresh-button/spec.md"
	});

// src/features/refresh-button/locales.ts
	const locales$13 = {
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
	function createClientFeature$11(runtime, env) {
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
	const definition$11 = Object.freeze({
		id: "restart-button",
		category: "other",
		order: 2,
		keys: Object.freeze(["showRestartButton"]),
		spec: "src/features/restart-button/spec.md"
	});

// src/features/restart-button/locales.ts
	const locales$12 = {
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
	function createClientFeature$10(runtime, env) {
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
	const definition$10 = Object.freeze({
		id: "search-blocking",
		category: "simplify",
		order: 9,
		keys: Object.freeze(["blockOfficialSearch"]),
		spec: "src/features/search-blocking/spec.md"
	});

// src/features/search-blocking/locales.ts
	const locales$11 = {
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
	function createClientFeature$9(runtime, env) {
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
	const definition$9 = Object.freeze({
		id: "skills",
		category: "enhance",
		order: 7,
		keys: Object.freeze(["skillManagerEnabled", "disabledSkills"]),
		spec: "src/features/skills/spec.md"
	});

// src/features/skills/locales.ts
	const locales$10 = {
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
	function createClientFeature$8(runtime, env) {
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
	const definition$8 = Object.freeze({
		id: "telemetry-blocking",
		category: "simplify",
		order: 10,
		keys: Object.freeze(["blockOfficialTelemetry"]),
		spec: "src/features/telemetry-blocking/spec.md"
	});

// src/features/telemetry-blocking/locales.ts
	const locales$9 = {
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
	function createClientFeature$7(runtime, env) {
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
	const definition$7 = Object.freeze({
		id: "todo-blocking",
		category: "simplify",
		order: 11,
		keys: Object.freeze(["blockTodo"]),
		spec: "src/features/todo-blocking/spec.md"
	});

// src/features/todo-blocking/locales.ts
	const locales$8 = {
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
	function createClientFeature$6(runtime, env) {
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
	const definition$6 = Object.freeze({
		id: "plan-blocking",
		category: "simplify",
		order: 11.5,
		keys: Object.freeze(["blockPlan"]),
		spec: "src/features/plan-blocking/spec.md"
	});

// src/features/plan-blocking/locales.ts
	const locales$7 = {
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
	function createClientFeature$5(runtime, env) {
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
	const definition$5 = Object.freeze({
		id: "goal-blocking",
		category: "simplify",
		order: 11.75,
		keys: Object.freeze(["blockGoal"]),
		spec: "src/features/goal-blocking/spec.md"
	});

// src/features/goal-blocking/locales.ts
	const locales$6 = {
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
	function createClientFeature$4(runtime, env) {
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
	const definition$4 = Object.freeze({
		id: "version-display",
		category: "interface",
		order: 6,
		keys: Object.freeze(["showVersion"]),
		spec: "src/features/version-display/spec.md"
	});

// src/features/version-display/locales.ts
	const locales$5 = {
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
	function createClientFeature$3(runtime, env) {
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
	const definition$3 = Object.freeze({
		id: "thinking-effort",
		category: "interface",
		order: 3,
		keys: Object.freeze(["showThinkingEffortSwitcher", "thinkingEffortGlyph"]),
		spec: "src/features/thinking-effort/spec.md"
	});

// src/features/thinking-effort/locales.ts
	const locales$4 = {
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

.power-dsh-page .power-dsh-slider-field { display:inline-flex; align-items:center; gap:10px; min-width:190px; justify-content:flex-end; }
.power-dsh-page .power-dsh-slider { box-sizing:border-box; width:150px; margin:0; accent-color:var(--dsw-alias-state-business-primary); cursor:pointer; }
.power-dsh-page .power-dsh-slider:disabled { opacity:.5; cursor:default; }
.power-dsh-page .power-dsh-slider-value { min-width:44px; text-align:right; font-variant-numeric:tabular-nums; color:var(--dsw-alias-label-secondary); font-size:13px; }
:is(.power-dsh-page, .power-dsh-background-panel) .power-dsh-wallpaper-field { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:12px; }
:is(.power-dsh-page, .power-dsh-background-panel) .power-dsh-wallpaper-details { display:flex; align-items:center; gap:12px; min-width:0; }
:is(.power-dsh-page, .power-dsh-background-panel) .power-dsh-wallpaper-actions { display:flex; align-items:center; justify-content:flex-end; gap:8px; }
:is(.power-dsh-page, .power-dsh-background-panel) .power-dsh-wallpaper-action { flex:none; white-space:nowrap; }
:is(.power-dsh-page, .power-dsh-background-panel) .power-dsh-wallpaper-preview { display:block; width:56px; height:36px; border-radius:var(--dsw-radius-sm); object-fit:cover; border:.5px solid var(--dsw-alias-border-l4); }
:is(.power-dsh-page, .power-dsh-background-panel) .power-dsh-wallpaper-name { max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--dsw-alias-label-secondary); font-size:13px; }
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
.power-dsh-background-panel .power-dsh-slider { box-sizing: border-box; width: 100%; margin: 0; accent-color: var(--dsw-alias-brand-primary); cursor: pointer; }
.power-dsh-background-panel .power-dsh-slider:disabled { opacity: .4; cursor: not-allowed; }
.power-dsh-background-panel .power-dsh-setting-row { display: flex; flex-direction: column; align-items: stretch; gap: 12px; padding-top: 20px; border-top: .5px solid var(--dsw-alias-border-l2); }
.power-dsh-background-panel .power-dsh-setting-label { font-size: 14px; line-height: 22px; }
.power-dsh-background-panel .power-dsh-description { margin-top: 4px; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
.power-dsh-background-panel .power-dsh-wallpaper-name { flex: 1; min-width: 0; max-width: none; }
.power-dsh-background-panel .power-dsh-wallpaper-preview { flex: none; width: 64px; height: 42px; }
@media (max-width:360px) {
  .power-dsh-background-panel .power-dsh-wallpaper-field { grid-template-columns:minmax(0,1fr); }
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
	function createClientFeature$2(runtime, env) {
		const { React, h, Menu, Button, Tooltip, observable, useSnapshot, errorFeedback } = runtime;
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
			const { kind } = readStyle(snapshot);
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
			const { opacity, blur } = panelState;
			publishPanel({
				saving: true,
				error: ""
			});
			try {
				const saved = readStyle(source.getSnapshot());
				if (opacity !== saved.opacity) await env.savePreference("flowingBackgroundOpacity", opacity, void 0, "number");
				if (blur !== saved.blur) await env.savePreference("flowingBackgroundBlur", blur, void 0, "number");
				return true;
			} catch (failure) {
				if (active) publishPanel({
					...readStyle(source.getSnapshot()),
					error: errorMessage(failure) || t("saveFailed")
				});
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
			const snapshot = useSnapshot(source);
			const { kind } = readStyle(snapshot);
			const title = t(kind === "wallpaper" ? "flowingBackgroundTuneWallpaperTitle" : "flowingBackgroundTunePatternTitle");
			if (!state.open) return null;
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
			}, h("path", { d: "m3 3 8 8M11 3l-8 8" })))), h("div", { className: "power-dsh-background-panel-body" }, panelSlider("flowingBackgroundOpacity", "flowingBackgroundOpacity", 100 - state.opacity, 0, 100, 5, "%"), panelSlider("flowingBackgroundBlur", "flowingBackgroundBlur", state.blur, 0, 40, 4, "px"), kind === "wallpaper" && wallpaperRow(asset, operation, state.saving), state.error && errorFeedback({
				t,
				message: state.error,
				code: "PD-BACKGROUND-STYLE-SAVE",
				operation: "background.tune",
				retry: async () => {
					await commitPanel();
				}
			})));
		}
		function panelSlider(field, labelKey, value, min, max, step, unit) {
			const control = `power-dsh-tune-${field}`;
			return h("div", {
				className: "power-dsh-background-panel-slider",
				key: field
			}, h("div", { className: "power-dsh-background-panel-row" }, h("label", {
				htmlFor: control,
				className: "power-dsh-background-panel-label"
			}, t(labelKey)), h("span", { className: "power-dsh-background-panel-value" }, `${value}${unit}`)), h("input", {
				key: field,
				id: control,
				type: "range",
				className: "power-dsh-slider",
				min,
				max,
				step,
				value,
				disabled: panelState.saving,
				"aria-label": t(labelKey),
				"aria-valuetext": `${value}${unit}`,
				onChange: (event) => {
					if (!panelState.open || panelState.saving) return;
					const next = Math.min(max, Math.max(min, Number(event.currentTarget.value)));
					if (Number.isFinite(next)) publishPanel(field === "flowingBackgroundOpacity" ? { opacity: 100 - next } : { blur: next });
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
			}));
		}
		ctx?.slots?.inject?.("shell.overlay", () => ctx.slots.register({
			name: "shell.overlay",
			id: "power-dsh-background-tune",
			order: -99,
			locale: env.namespace
		}, TuningPanel));
		let menuOpen = false;
		const menuStore = observable(() => menuOpen);
		const setMenu = (next) => {
			if (menuOpen !== next) {
				menuOpen = next;
				menuStore.notify();
			}
		};
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
			hidden: true,
			save: async (next) => {
				if (next !== "pattern" && next !== "wallpaper") throw new Error(t("saveFailed"));
				try {
					await env.savePreference("flowingBackgroundKind", next, void 0, "string");
					if (next === "pattern") {
						const saved = readStyle(source.getSnapshot());
						if (saved.opacity !== 100) await env.savePreference("flowingBackgroundOpacity", 100, void 0, "number");
						if (saved.blur !== 0) await env.savePreference("flowingBackgroundBlur", 0, void 0, "number");
					}
				} finally {
					if (active && panelState.open) {
						const { opacity, blur } = readStyle(source.getSnapshot());
						publishPanel({
							opacity,
							blur
						});
					}
				}
			}
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
				className: "power-dsh-setting-row",
				key: "flowingBackgroundWallpaper"
			}, h("div", { className: "power-dsh-setting-copy" }, h("div", {
				id: `${control}-label`,
				className: "power-dsh-setting-label"
			}, t("flowingBackgroundWallpaper")), h("div", {
				id: `${control}-description`,
				className: "power-dsh-description"
			}, t("flowingBackgroundWallpaperDescription")), failure && errorFeedback({
				t,
				id: `${control}-error`,
				message: failure,
				code: "PD-BACKGROUND-WALLPAPER",
				operation: "saveWallpaper",
				retry: asset.status === "error" ? loadWallpaper : void 0
			})), h("div", { className: "power-dsh-wallpaper-field" }, h("div", { className: "power-dsh-wallpaper-details" }, asset.value && h("img", {
				className: "power-dsh-wallpaper-preview",
				src: asset.value.dataUrl,
				alt: "",
				"aria-hidden": true,
				draggable: false
			}), h("span", {
				className: "power-dsh-wallpaper-name",
				title: asset.value?.name
			}, asset.value ? asset.value.name : t("flowingBackgroundWallpaperEmpty"))), h("div", {
				className: "power-dsh-wallpaper-actions",
				role: "group",
				"aria-labelledby": `${control}-label`
			}, h(Button, {
				type: "button",
				variant: "outline",
				size: "sm",
				className: "power-dsh-wallpaper-action",
				disabled: disabled || busy,
				"aria-describedby": `${control}-description${failure ? ` ${control}-error` : ""}`,
				"aria-busy": busy,
				onClick: choose
			}, t(asset.value ? "flowingBackgroundWallpaperReplace" : "flowingBackgroundWallpaperChoose")), asset.value && h(Button, {
				type: "button",
				variant: "outline",
				size: "sm",
				className: "power-dsh-wallpaper-action",
				disabled: disabled || busy,
				onClick: remove
			}, t("flowingBackgroundWallpaperRemove"))), h("input", {
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
			})));
		}
		function useSettings({ snapshot, disabled, saving, error, save, id, leaveSettings }) {
			const failed = useSnapshot(attachment);
			const opened = useSnapshot(menuStore);
			const openedTune = useSnapshot(panelStore).open;
			const enabled = snapshot.value?.flowingBackgroundEnabled === true;
			const { kind } = readStyle(snapshot);
			const main = !failed || !enabled ? mainSetting : {
				...mainSetting,
				failure: presentFailure(failed.issue, failed.observedAt, t)
			};
			function kindRow() {
				if (!enabled) return null;
				const field = "flowingBackgroundKind";
				const control = `${id}-${field}`;
				const busy = saving?.field === field;
				const fieldError = error?.field === field ? error.message : "";
				const adjustment = h(Tooltip, {
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
					"aria-haspopup": "dialog",
					"aria-expanded": openedTune,
					onClick: () => {
						if (!disabled) {
							setMenu(false);
							openPanel(leaveSettings);
						}
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
				}))));
				const selector = h(Menu, {
					open: opened && !disabled,
					onClose: () => setMenu(false),
					selectedId: kind,
					align: "end",
					portal: true,
					autoFocus: true,
					minWidthFromAnchor: true,
					items: KINDS.map((item) => ({
						id: item,
						label: kindLabel(item)
					})),
					onSelect: (next) => {
						setMenu(false);
						return save(field, next);
					},
					anchor: h(Button, {
						type: "button",
						variant: "ghost",
						size: "md",
						className: "power-dsh-background-style-select",
						disabled: disabled || busy,
						"aria-label": t("flowingBackgroundKind"),
						"aria-describedby": `${control}-description${fieldError ? ` ${control}-error` : ""}`,
						"aria-invalid": Boolean(fieldError),
						"aria-haspopup": "menu",
						"aria-expanded": opened && !disabled,
						"aria-busy": busy,
						onClick: () => {
							if (!disabled) setMenu(!opened);
						}
					}, kindLabel(kind), h("svg", {
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
				});
				return h("div", {
					className: "power-dsh-setting-row",
					key: field
				}, h("div", { className: "power-dsh-setting-copy" }, h("div", {
					id: `${control}-label`,
					className: "power-dsh-setting-label"
				}, t("flowingBackgroundKind")), h("div", {
					id: `${control}-description`,
					className: "power-dsh-description"
				}, t("flowingBackgroundKindDescription")), fieldError && errorFeedback({
					t,
					id: `${control}-error`,
					message: fieldError,
					code: "PD-BACKGROUND-KIND-SAVE",
					operation: `settings.${field}`
				})), h("div", { className: "power-dsh-background-controls" }, adjustment, selector));
			}
			return [main, {
				...kindSetting,
				hidden: false,
				render: kindRow
			}];
		}
		return {
			settings: [
				mainSetting,
				kindSetting,
				opacitySetting,
				blurSetting
			],
			useSettings,
			styles: settingsStyles + panelStyles,
			api: {
				wallpaperSource,
				loadWallpaper,
				saveWallpaper,
				clearWallpaper
			}
		};
	}

// src/features/flowing-background/definition.ts
	const definition$2 = Object.freeze({
		id: "flowing-background",
		category: "interface",
		order: 5,
		keys: Object.freeze([
			"flowingBackgroundEnabled",
			"flowingBackgroundKind",
			"flowingBackgroundOpacity",
			"flowingBackgroundBlur"
		]),
		spec: "src/features/flowing-background/spec.md"
	});

// src/features/flowing-background/locales.ts
	const locales$3 = {
		en: {
			flowingBackgroundEnabled: "Custom background",
			flowingBackgroundDescription: "Choose a soft animated background for the interface",
			flowingBackgroundOpacity: "Background fade",
			flowingBackgroundOpacityDescription: "0% preserves the original background; 100% fades it out",
			flowingBackgroundBlur: "Background blur",
			flowingBackgroundBlurDescription: "0px keeps the background sharp; higher values add blur",
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
			flowingBackgroundTunePatternTitle: "Adjust homepage flow",
			flowingBackgroundTuneWallpaperTitle: "Adjust wallpaper",
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
			flowingBackgroundOpacity: "背景淡化",
			flowingBackgroundOpacityDescription: "0% 保持原始背景，100% 完全淡出背景",
			flowingBackgroundBlur: "背景模糊",
			flowingBackgroundBlurDescription: "0px 保持清晰，数值越大背景越模糊",
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
			flowingBackgroundTunePatternTitle: "官网流动调节",
			flowingBackgroundTuneWallpaperTitle: "自定义壁纸调节",
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
.power-dsh-archive-page .power-dsh-archive-group-header { display:flex; align-items:center; gap:8px; min-height:28px; }
.power-dsh-archive-page .power-dsh-archive-group-folder { display:inline-flex; flex:none; color:var(--dsw-alias-label-tertiary); }
.power-dsh-archive-page .power-dsh-archive-group-title { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--dsw-alias-label-primary); font-size:14px; line-height:22px; font-weight:500; }
.power-dsh-archive-page .power-dsh-archive-count { flex:none; margin-left:auto; color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:18px; }
.power-dsh-archive-page .power-dsh-archive-rows { margin:0; padding:0; list-style:none; overflow:hidden; border:.5px solid var(--dsw-alias-settings-card-stroke); border-radius:var(--dsw-radius-xl); background:var(--dsw-alias-settings-card-fill); }
.power-dsh-archive-page .power-dsh-archive-row { display:flex; align-items:center; gap:12px; padding:12px 14px; }
.power-dsh-archive-page .power-dsh-archive-row + .power-dsh-archive-row { border-top:.5px solid var(--dsw-alias-border-l2); }
.power-dsh-archive-page .power-dsh-archive-row-main { display:flex; flex:1 1 auto; flex-direction:column; gap:2px; min-width:0; }
.power-dsh-archive-page .power-dsh-archive-row-title { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--dsw-alias-label-primary); font-size:14px; line-height:20px; }
.power-dsh-archive-page .power-dsh-archive-row-time { color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:18px; }
.power-dsh-archive-page .power-dsh-archive-restore { flex:none; height:28px; padding:0 12px; font-size:12px; line-height:18px; }
.power-dsh-archive-page .power-dsh-archive-row-actions { display:flex; flex:none; align-items:center; gap:8px; }
.power-dsh-archive-page .power-dsh-archive-icon { box-sizing:border-box; display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; border:0; border-radius:var(--dsw-radius-md); padding:0; background:transparent; color:var(--dsw-alias-label-tertiary); cursor:pointer; }
.power-dsh-archive-page .power-dsh-archive-icon:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover); }
.power-dsh-archive-page .power-dsh-archive-icon[data-danger="true"]:hover:not(:disabled) { color:var(--dsw-alias-state-error-primary); }
.power-dsh-archive-page .power-dsh-archive-icon:focus-visible { outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; }
.power-dsh-archive-page .power-dsh-archive-icon:disabled { opacity:.4; cursor:default; }
`;

// src/features/archive/client.ts
	function createClientFeature$1(runtime, env) {
		const { React, h, Menu, Modal, Button, Tooltip, observable, useSnapshot, useMounted, errorFeedback } = runtime;
		const { ctx, t, savePreference, preferenceSlot, namespace } = env;
		const styles$13 = styles$11 + styles$8 + styles;
		const { SkillSearchIcon } = createCatalogUI(runtime);
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
		function TrashIcon({ size = 16 }) {
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
			}, h("path", { d: "M3 6h18" }), h("path", { d: "M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" }), h("path", { d: "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" }), h("path", { d: "M10 11v6M14 11v6" }));
		}
		const deleteErrorKeys = [
			"archiveDeleteUnavailable",
			"archiveDeleteLive",
			"archiveDeleteUnsupported",
			"archiveDeleteUnsafe",
			"archiveNotArchived",
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
			const [error, setError] = React.useState(null);
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
				}, row.title || t("archiveUntitled"))), time && h("span", { className: "power-dsh-archive-row-time" }, time), error?.id === row.sessionId && errorFeedback({
					t,
					id: `${row.sessionId}-error`,
					message: error.message,
					code: "PD-ARCHIVE-ACTION",
					operation: "archiveSession"
				})), h("div", { className: "power-dsh-archive-row-actions" }, h("button", {
					type: "button",
					className: "power-dsh-archive-icon",
					"data-danger": "true",
					"data-delete": row.sessionId,
					"aria-label": t("archiveDelete"),
					disabled: disabled || rowBusy,
					"aria-busy": deleting === row.sessionId,
					onClick: () => {
						if (mounted.current) setConfirming(row);
					}
				}, h(TrashIcon)), h("button", {
					type: "button",
					className: "power-dsh-prompt-action power-dsh-archive-restore",
					"data-restore": row.sessionId,
					disabled: disabled || rowBusy,
					"aria-busy": restoring === row.sessionId,
					onClick: () => restore(row.sessionId)
				}, t(rowBusy ? "archiveRestoring" : "archiveRestore"))));
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
			})), catalog && snapshot.status === "ready" && groups.map((group) => h("section", {
				key: group.key,
				className: "power-dsh-archive-group",
				"aria-label": group.title
			}, h("div", { className: "power-dsh-archive-group-header" }, h("span", { className: "power-dsh-archive-group-folder" }, h(FolderIcon)), h("span", { className: "power-dsh-archive-group-title" }, group.title), h("span", { className: "power-dsh-archive-count" }, t("archiveCount").replace("{count}", () => String(group.sessions.length)))), h("ul", { className: "power-dsh-archive-rows" }, group.sessions.map(renderRow)))), catalog && snapshot.status === "ready" && groups.length === 0 && h("p", { className: "power-dsh-skill-empty" }, t(query || projectId ? "archiveNoMatches" : "archiveEmpty"))), error && !(catalog?.sessions ?? []).some((row) => row.sessionId === error.id) && errorFeedback({
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
					variant: "primary",
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
	const definition$1 = Object.freeze({
		id: "archive",
		category: "enhance",
		order: 10,
		keys: Object.freeze(["archiveManagerEnabled"]),
		spec: "src/features/archive/spec.md"
	});

// src/features/archive/locales.ts
	const locales$2 = {
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

// src/features/whale-motion/geometry.ts
	const FISH_PATH = "M22.9168 1.43018C22.6713 1.31018 22.5658 1.53918 22.4223 1.65519C22.3733 1.69269 22.3318 1.74169 22.2903 1.78669C21.9317 2.1697 21.5127 2.42121 20.9657 2.39121C20.1657 2.34621 19.4827 2.59771 18.8787 3.20973C18.7502 2.45521 18.3236 2.0047 17.6746 1.71569C17.3351 1.56568 16.9916 1.41518 16.7536 1.08867C16.5876 0.856163 16.5421 0.597155 16.4591 0.341647C16.4061 0.187643 16.3536 0.0301382 16.1761 0.00363739C15.9836 -0.0263635 15.9081 0.135141 15.8326 0.270145C15.5306 0.822162 15.4136 1.43018 15.4251 2.0462C15.4516 3.43174 16.0366 4.53527 17.1991 5.3203C17.3311 5.4103 17.3651 5.5003 17.3236 5.63181C17.2441 5.90231 17.1501 6.16482 17.0671 6.43533C17.0141 6.60784 16.9351 6.64584 16.7501 6.57033C16.1121 6.30383 15.5611 5.90931 15.074 5.4328C14.2475 4.63328 13.5 3.75075 12.568 3.05973C12.349 2.89822 12.13 2.74822 11.9034 2.60522C10.9524 1.68169 12.028 0.923165 12.277 0.833162C12.5375 0.739159 12.3675 0.41615 11.5259 0.42015C10.6844 0.42365 9.91439 0.705658 8.93286 1.08117C8.78935 1.13767 8.63835 1.17867 8.48384 1.21267C7.59332 1.04367 6.66829 1.00617 5.70226 1.11517C3.88321 1.31768 2.43016 2.1777 1.36213 3.64575C0.0790928 5.4103 -0.222916 7.41536 0.146595 9.50642C0.535106 11.7105 1.66014 13.535 3.38869 14.9616C5.18125 16.4406 7.24581 17.1657 9.60138 17.0266C11.0319 16.9441 12.6245 16.7526 14.421 15.2321C14.874 15.4576 15.3496 15.5476 16.1381 15.6151C16.7456 15.6716 17.3306 15.5851 17.7836 15.4911C18.4931 15.3411 18.4441 14.6841 18.1876 14.5636C16.1081 13.595 16.5646 13.9891 16.1496 13.67C17.2061 12.42 18.8202 10.1979 19.3182 7.17235C19.3672 6.83834 19.4297 6.36783 19.4222 6.09732C19.4182 5.93231 19.4562 5.86831 19.6447 5.84931C20.1657 5.78931 20.6712 5.64681 21.1357 5.3913C22.4833 4.65528 23.0268 3.44624 23.1548 1.9972C23.1738 1.77569 23.1508 1.54668 22.9168 1.43018ZM11.1749 14.4736C9.15936 12.889 8.18184 12.3675 7.77832 12.39C7.40081 12.4125 7.46881 12.8445 7.55182 13.126C7.63882 13.404 7.75182 13.5955 7.91033 13.8396C8.01983 14.0011 8.09533 14.2411 7.80083 14.4216C7.15181 14.8231 6.02327 14.2866 5.97027 14.2601C4.65673 13.4865 3.5587 12.4655 2.78467 11.069C2.03715 9.72493 1.60314 8.28289 1.53164 6.74384C1.51264 6.37233 1.62214 6.24082 1.99215 6.17332C2.47916 6.08332 2.98118 6.06432 3.46769 6.13582C5.52476 6.43633 7.27581 7.35586 8.74385 8.8129C9.58188 9.64243 10.2159 10.634 10.8689 11.6025C11.5634 12.631 12.3105 13.611 13.262 14.4146C13.598 14.6961 13.866 14.9101 14.1225 15.0681C13.349 15.1546 12.058 15.1731 11.1749 14.4746L11.1749 14.4736ZM12.141 8.25988C12.141 8.09488 12.273 7.96338 12.439 7.96338C12.4765 7.96338 12.5105 7.97088 12.541 7.98188C12.5825 7.99688 12.6205 8.01938 12.6505 8.05338C12.7035 8.10588 12.7335 8.18088 12.7335 8.25988C12.7335 8.42489 12.6015 8.55639 12.4355 8.55639C12.2695 8.55639 12.141 8.42489 12.141 8.25988ZM15.1415 9.79893C14.949 9.87793 14.7565 9.94544 14.5715 9.95294C14.2845 9.96794 13.9715 9.85143 13.8015 9.70893C13.5375 9.48742 13.3485 9.36342 13.2695 8.97691C13.2355 8.8119 13.2545 8.55639 13.2845 8.40989C13.3525 8.09438 13.277 7.89187 13.0545 7.70787C12.8735 7.55786 12.643 7.51636 12.39 7.51636C12.2955 7.51636 12.209 7.47486 12.1445 7.44136C12.039 7.38886 11.9519 7.25735 12.035 7.09585C12.0615 7.04335 12.19 6.91584 12.22 6.89334C12.5635 6.69784 12.9595 6.76184 13.326 6.90834C13.6655 7.04735 13.9225 7.30236 14.292 7.66287C14.6695 8.09838 14.7375 8.21838 14.9525 8.54539C15.1225 8.8009 15.277 9.06341 15.3831 9.36392C15.4471 9.55142 15.3641 9.70493 15.1415 9.79893Z";
	const TAIL_SHAPES = [
		"M22.917,1.430 L22.858,1.407 L22.805,1.397 L22.756,1.398 L22.711,1.409 L22.670,1.429 L22.631,1.454 L22.595,1.485 L22.560,1.519 L22.526,1.554 L22.492,1.590 L22.457,1.624 L22.422,1.655 L22.410,1.665 L22.398,1.675 L22.387,1.685 L22.376,1.696 L22.364,1.707 L22.353,1.718 L22.343,1.729 L22.332,1.741 L22.322,1.752 L22.311,1.764 L22.301,1.775 L22.290,1.787 L22.199,1.880 L22.106,1.967 L22.009,2.047 L21.909,2.120 L21.806,2.186 L21.699,2.244 L21.588,2.293 L21.473,2.333 L21.353,2.363 L21.229,2.383 L21.100,2.393 L20.966,2.391 L20.768,2.386 L20.575,2.394 L20.387,2.414 L20.203,2.447 L20.024,2.494 L19.849,2.554 L19.678,2.628 L19.510,2.716 L19.347,2.817 L19.187,2.933 L19.031,3.064 L18.879,3.210 L18.840,3.027 L18.790,2.857 L18.728,2.699 L18.654,2.551 L18.568,2.415 L18.472,2.288 L18.365,2.171 L18.247,2.064 L18.118,1.965 L17.980,1.874 L17.832,1.791 L17.675,1.716 L17.590,1.678 L17.505,1.640 L17.421,1.600 L17.338,1.559 L17.256,1.515 L17.176,1.468 L17.098,1.418 L17.023,1.363 L16.950,1.303 L16.881,1.238 L16.815,1.167 L16.754,1.089 L16.715,1.030 L16.680,0.970 L16.649,0.910 L16.622,0.848 L16.597,0.786 L16.575,0.724 L16.555,0.661 L16.535,0.597 L16.517,0.533 L16.498,0.470 L16.479,0.406 L16.459,0.342 L16.446,0.303 L16.432,0.265 L16.417,0.228 L16.402,0.191 L16.384,0.157 L16.364,0.125 L16.342,0.095 L16.317,0.069 L16.288,0.046 L16.255,0.027 L16.218,0.013 L16.176,0.004 L16.130,0.000 L16.089,0.004 L16.052,0.014 L16.018,0.029 L15.988,0.050 L15.960,0.075 L15.935,0.103 L15.912,0.134 L15.891,0.167 L15.871,0.201 L15.852,0.236 L15.833,0.270 L15.761,0.409 L15.697,0.551 L15.640,0.694 L15.590,0.839 L15.547,0.986 L15.511,1.134 L15.482,1.284 L15.459,1.435 L15.441,1.586 L15.430,1.739 L15.425,1.892 L15.425,2.046 L15.443,2.387 L15.485,2.715 L15.550,3.032 L15.638,3.336 L15.750,3.629 L15.886,3.908 L16.045,4.176 L16.228,4.430 L16.435,4.672 L16.666,4.901 L16.920,5.117 L17.199,5.320 L17.230,5.343 L17.257,5.365 L17.280,5.388 L17.299,5.412 L17.315,5.436 L17.326,5.460 L17.335,5.486 L17.339,5.513 L17.340,5.540 L17.338,5.569 L17.332,5.600 L17.324,5.632 L17.303,5.699 L17.283,5.766 L17.262,5.833 L17.240,5.900 L17.219,5.967 L17.197,6.034 L17.175,6.100 L17.153,6.167 L17.131,6.234 L17.109,6.301 L17.088,6.368 L17.067,6.435 L17.053,6.476 L17.038,6.510 L17.021,6.540 L17.002,6.564 L16.982,6.582 L16.958,6.596 L16.932,6.604 L16.903,6.607 L16.870,6.605 L16.834,6.599 L16.794,6.587 L16.750,6.570 L16.592,6.501 L16.438,6.427 L16.288,6.347 L16.140,6.263 L15.996,6.174 L15.855,6.080 L15.718,5.982 L15.583,5.880 L15.452,5.774 L15.323,5.664 L15.197,5.550 L15.074,5.433 L14.869,5.231 L14.666,5.027 L14.465,4.822 L14.264,4.616 L14.063,4.410 L13.861,4.206 L13.656,4.003 L13.448,3.804 L13.237,3.610 L13.020,3.420 L12.797,3.236 L12.568,3.060 L12.513,3.020 L12.458,2.980 L12.404,2.941 L12.349,2.902 L12.294,2.864 L12.239,2.826 L12.183,2.788 L12.128,2.751 L12.072,2.714 L12.016,2.677 L11.960,2.641 L11.903,2.605 L11.706,2.378 L11.584,2.160 L11.526,1.951 L11.522,1.755 L11.564,1.573 L11.640,1.407 L11.742,1.257 L11.858,1.127 L11.980,1.018 L12.097,0.932 L12.199,0.869 L12.277,0.833 L12.333,0.805 L12.370,0.770 L12.388,0.728 L12.385,0.683 L12.361,0.637 L12.315,0.590 L12.246,0.545 L12.153,0.505 L12.035,0.470 L11.892,0.443 L11.722,0.426 L11.526,0.420 L11.317,0.427 L11.110,0.444 L10.904,0.472 L10.698,0.510 L10.491,0.556 L10.282,0.611 L10.070,0.674 L9.854,0.744 L9.634,0.820 L9.407,0.902 L9.174,0.989 L8.933,1.081 L8.897,1.095 L8.860,1.108 L8.824,1.121 L8.787,1.133 L8.750,1.144 L8.712,1.155 L8.675,1.166 L8.637,1.176 L8.599,1.186 L8.561,1.195 L8.522,1.204 L8.484,1.213 L8.260,1.173 L8.036,1.139 L7.809,1.111 L7.582,1.088 L7.352,1.071 L7.121,1.060 L6.889,1.054 L6.655,1.054 L6.419,1.061 L6.182,1.073 L5.943,1.091 L5.702,1.115 L5.255,1.179 L4.823,1.271 L4.407,1.390 L4.006,1.535 L3.620,1.707 L3.251,1.906 L2.896,2.131 L2.558,2.382 L2.235,2.659 L1.928,2.963 L1.637,3.291 L1.362,3.646 L1.062,4.092 L0.801,4.547 L0.579,5.012 L0.395,5.485 L0.247,5.966 L0.135,6.454 L0.057,6.949 L0.012,7.450 L0.000,7.957 L0.019,8.469 L0.068,8.986 L0.147,9.506 L0.259,10.050 L0.402,10.577 L0.574,11.088 L0.776,11.583 L1.006,12.062 L1.265,12.526 L1.552,12.972 L1.866,13.403 L2.208,13.817 L2.575,14.215 L2.969,14.597 L3.389,14.962 L3.843,15.316 L4.308,15.638 L4.784,15.928 L5.273,16.185 L5.772,16.410 L6.284,16.601 L6.807,16.758 L7.342,16.882 L7.889,16.971 L8.448,17.025 L9.019,17.043 L9.601,17.027 L9.962,17.003 L10.330,16.971 L10.705,16.925 L11.087,16.863 L11.477,16.778 L11.874,16.669 L12.279,16.529 L12.691,16.355 L13.111,16.142 L13.540,15.887 L13.976,15.585 L14.421,15.232 L14.535,15.286 L14.651,15.334 L14.770,15.378 L14.892,15.417 L15.020,15.452 L15.154,15.483 L15.294,15.511 L15.443,15.536 L15.601,15.558 L15.769,15.579 L15.947,15.598 L16.138,15.615 L16.289,15.626 L16.439,15.632 L16.588,15.633 L16.734,15.629 L16.878,15.621 L17.019,15.610 L17.157,15.595 L17.291,15.578 L17.421,15.558 L17.547,15.537 L17.668,15.514 L17.784,15.491 L17.945,15.444 L18.078,15.379 L18.182,15.300 L18.261,15.211 L18.315,15.115 L18.348,15.016 L18.360,14.918 L18.355,14.824 L18.332,14.738 L18.296,14.664 L18.247,14.604 L18.188,14.564 L17.719,14.349 L17.343,14.183 L17.050,14.060 L16.827,13.972 L16.663,13.912 L16.544,13.873 L16.461,13.848 L16.400,13.828 L16.351,13.808 L16.300,13.780 L16.237,13.736 L16.150,13.670 L16.424,13.337 L16.717,12.965 L17.020,12.553 L17.330,12.102 L17.640,11.613 L17.943,11.087 L18.235,10.524 L18.510,9.924 L18.762,9.288 L18.984,8.617 L19.171,7.912 L19.318,7.172 L19.331,7.086 L19.343,6.996 L19.356,6.902 L19.369,6.805 L19.380,6.708 L19.391,6.611 L19.401,6.515 L19.409,6.422 L19.416,6.332 L19.421,6.248 L19.423,6.169 L19.422,6.097 L19.422,6.058 L19.424,6.023 L19.429,5.992 L19.436,5.964 L19.447,5.940 L19.461,5.919 L19.480,5.901 L19.502,5.885 L19.530,5.873 L19.562,5.863 L19.601,5.855 L19.645,5.849 L19.775,5.833 L19.904,5.812 L20.032,5.788 L20.160,5.761 L20.286,5.729 L20.411,5.694 L20.536,5.654 L20.658,5.610 L20.780,5.562 L20.900,5.510 L21.019,5.453 L21.136,5.391 L21.456,5.198 L21.744,4.985 L22.002,4.754 L22.230,4.506 L22.430,4.242 L22.603,3.962 L22.750,3.667 L22.874,3.358 L22.975,3.035 L23.054,2.701 L23.114,2.354 L23.155,1.997 L23.159,1.942 L23.160,1.886 L23.159,1.832 L23.154,1.778 L23.144,1.725 L23.131,1.674 L23.112,1.626 L23.087,1.580 L23.055,1.537 L23.017,1.497 L22.971,1.462 L22.917,1.430 Z M11.175,14.474 L10.692,14.099 L10.251,13.767 L9.851,13.476 L9.488,13.224 L9.163,13.009 L8.872,12.829 L8.615,12.683 L8.390,12.568 L8.196,12.483 L8.030,12.426 L7.891,12.396 L7.778,12.390 L7.693,12.404 L7.625,12.433 L7.572,12.475 L7.533,12.528 L7.507,12.591 L7.492,12.661 L7.487,12.736 L7.490,12.815 L7.499,12.895 L7.514,12.975 L7.532,13.053 L7.552,13.126 L7.574,13.194 L7.598,13.258 L7.622,13.320 L7.648,13.380 L7.676,13.439 L7.704,13.496 L7.734,13.552 L7.766,13.608 L7.800,13.664 L7.835,13.721 L7.872,13.780 L7.910,13.840 L7.937,13.882 L7.961,13.926 L7.981,13.973 L7.996,14.022 L8.005,14.072 L8.007,14.123 L8.001,14.175 L7.984,14.226 L7.958,14.277 L7.919,14.327 L7.867,14.375 L7.801,14.422 L7.629,14.503 L7.444,14.551 L7.248,14.569 L7.050,14.564 L6.852,14.540 L6.662,14.501 L6.484,14.454 L6.324,14.403 L6.187,14.353 L6.079,14.309 L6.005,14.277 L5.970,14.260 L5.646,14.061 L5.332,13.852 L5.027,13.632 L4.733,13.399 L4.448,13.155 L4.175,12.898 L3.913,12.628 L3.663,12.345 L3.424,12.048 L3.198,11.737 L2.985,11.410 L2.785,11.069 L2.604,10.731 L2.437,10.389 L2.284,10.043 L2.143,9.692 L2.017,9.338 L1.905,8.980 L1.806,8.617 L1.722,8.251 L1.652,7.880 L1.597,7.505 L1.557,7.127 L1.532,6.744 L1.530,6.656 L1.533,6.577 L1.544,6.507 L1.560,6.446 L1.584,6.392 L1.616,6.345 L1.656,6.304 L1.704,6.269 L1.761,6.239 L1.828,6.213 L1.905,6.192 L1.992,6.173 L2.114,6.152 L2.237,6.134 L2.360,6.119 L2.483,6.108 L2.607,6.099 L2.730,6.094 L2.854,6.092 L2.977,6.094 L3.100,6.099 L3.223,6.108 L3.346,6.120 L3.468,6.136 L3.976,6.224 L4.471,6.337 L4.953,6.476 L5.424,6.640 L5.881,6.828 L6.327,7.041 L6.760,7.277 L7.181,7.538 L7.589,7.822 L7.986,8.130 L8.371,8.460 L8.744,8.813 L8.949,9.024 L9.147,9.240 L9.338,9.463 L9.522,9.690 L9.701,9.921 L9.876,10.156 L10.046,10.393 L10.214,10.633 L10.379,10.875 L10.543,11.117 L10.706,11.360 L10.869,11.602 L11.044,11.859 L11.221,12.112 L11.402,12.363 L11.587,12.610 L11.775,12.854 L11.969,13.093 L12.168,13.327 L12.373,13.557 L12.584,13.781 L12.803,13.999 L13.028,14.210 L13.262,14.415 L13.345,14.484 L13.425,14.550 L13.502,14.613 L13.577,14.674 L13.651,14.732 L13.722,14.788 L13.792,14.841 L13.860,14.891 L13.927,14.939 L13.993,14.984 L14.058,15.027 L14.123,15.068 L13.919,15.088 L13.697,15.103 L13.460,15.110 L13.211,15.108 L12.953,15.094 L12.690,15.066 L12.424,15.021 L12.160,14.958 L11.899,14.874 L11.646,14.767 L11.404,14.635 L11.175,14.475 L11.175,14.474 Z M12.141,8.260 L12.144,8.219 L12.152,8.181 L12.164,8.144 L12.181,8.110 L12.203,8.078 L12.228,8.050 L12.256,8.025 L12.288,8.004 L12.322,7.987 L12.359,7.974 L12.398,7.966 L12.439,7.963 L12.448,7.964 L12.457,7.964 L12.466,7.965 L12.475,7.966 L12.484,7.967 L12.493,7.969 L12.501,7.970 L12.509,7.972 L12.517,7.974 L12.525,7.977 L12.533,7.979 L12.541,7.982 L12.551,7.986 L12.561,7.990 L12.571,7.995 L12.581,8.000 L12.591,8.005 L12.600,8.011 L12.609,8.017 L12.618,8.023 L12.627,8.030 L12.635,8.037 L12.643,8.045 L12.650,8.053 L12.663,8.067 L12.675,8.081 L12.686,8.097 L12.696,8.113 L12.704,8.129 L12.712,8.147 L12.718,8.165 L12.724,8.183 L12.728,8.202 L12.731,8.221 L12.733,8.240 L12.733,8.260 L12.731,8.300 L12.723,8.339 L12.710,8.376 L12.693,8.410 L12.672,8.442 L12.647,8.470 L12.618,8.495 L12.587,8.516 L12.552,8.533 L12.515,8.546 L12.476,8.554 L12.435,8.556 L12.395,8.554 L12.356,8.546 L12.319,8.533 L12.285,8.516 L12.254,8.495 L12.226,8.470 L12.201,8.442 L12.180,8.410 L12.164,8.376 L12.151,8.339 L12.144,8.300 L12.141,8.260 Z M15.142,9.799 L15.093,9.818 L15.045,9.837 L14.997,9.855 L14.949,9.872 L14.901,9.888 L14.854,9.903 L14.806,9.916 L14.759,9.927 L14.712,9.937 L14.665,9.944 L14.618,9.950 L14.572,9.953 L14.499,9.954 L14.427,9.950 L14.354,9.941 L14.282,9.928 L14.211,9.911 L14.143,9.890 L14.076,9.866 L14.013,9.839 L13.953,9.809 L13.898,9.778 L13.847,9.744 L13.802,9.709 L13.737,9.655 L13.676,9.605 L13.618,9.555 L13.564,9.507 L13.513,9.457 L13.466,9.405 L13.423,9.349 L13.384,9.289 L13.349,9.223 L13.318,9.150 L13.292,9.068 L13.270,8.977 L13.262,8.934 L13.257,8.888 L13.253,8.839 L13.252,8.789 L13.252,8.738 L13.253,8.686 L13.256,8.635 L13.260,8.585 L13.265,8.537 L13.271,8.491 L13.277,8.449 L13.284,8.410 L13.299,8.333 L13.307,8.261 L13.309,8.193 L13.305,8.129 L13.295,8.068 L13.278,8.010 L13.256,7.954 L13.228,7.902 L13.194,7.851 L13.154,7.802 L13.107,7.754 L13.055,7.708 L13.008,7.673 L12.960,7.642 L12.910,7.615 L12.858,7.592 L12.804,7.572 L12.749,7.556 L12.693,7.543 L12.634,7.533 L12.575,7.525 L12.515,7.520 L12.453,7.517 L12.390,7.516 L12.367,7.516 L12.343,7.513 L12.321,7.509 L12.299,7.504 L12.277,7.498 L12.256,7.491 L12.236,7.484 L12.216,7.476 L12.197,7.467 L12.179,7.459 L12.161,7.450 L12.145,7.441 L12.119,7.427 L12.094,7.409 L12.071,7.388 L12.051,7.364 L12.033,7.338 L12.019,7.309 L12.009,7.279 L12.003,7.246 L12.002,7.211 L12.007,7.174 L12.018,7.136 L12.035,7.096 L12.044,7.081 L12.056,7.064 L12.071,7.045 L12.088,7.025 L12.107,7.004 L12.126,6.983 L12.146,6.963 L12.165,6.944 L12.182,6.927 L12.198,6.913 L12.211,6.901 L12.220,6.893 L12.307,6.850 L12.396,6.816 L12.486,6.793 L12.578,6.778 L12.671,6.771 L12.764,6.773 L12.858,6.781 L12.953,6.796 L13.047,6.817 L13.141,6.843 L13.234,6.874 L13.326,6.908 L13.409,6.946 L13.490,6.987 L13.568,7.034 L13.645,7.086 L13.722,7.142 L13.798,7.203 L13.875,7.268 L13.953,7.338 L14.033,7.412 L14.116,7.491 L14.202,7.575 L14.292,7.663 L14.380,7.765 L14.457,7.857 L14.524,7.939 L14.583,8.013 L14.636,8.081 L14.683,8.145 L14.727,8.207 L14.770,8.268 L14.812,8.331 L14.855,8.397 L14.902,8.468 L14.953,8.545 L14.995,8.609 L15.036,8.674 L15.077,8.739 L15.116,8.804 L15.155,8.871 L15.192,8.938 L15.228,9.006 L15.262,9.075 L15.295,9.145 L15.326,9.217 L15.356,9.290 L15.383,9.364 L15.396,9.410 L15.403,9.455 L15.404,9.498 L15.398,9.539 L15.387,9.579 L15.370,9.616 L15.347,9.652 L15.317,9.686 L15.282,9.718 L15.241,9.747 L15.194,9.774 L15.142,9.799 Z",
		"M22.917,1.430 L22.858,1.407 L22.805,1.397 L22.756,1.398 L22.711,1.409 L22.670,1.429 L22.631,1.454 L22.595,1.485 L22.560,1.519 L22.526,1.554 L22.492,1.590 L22.457,1.624 L22.422,1.655 L22.410,1.665 L22.398,1.675 L22.387,1.685 L22.376,1.696 L22.364,1.707 L22.353,1.718 L22.343,1.729 L22.332,1.741 L22.322,1.752 L22.311,1.764 L22.301,1.775 L22.290,1.787 L22.199,1.880 L22.106,1.967 L22.009,2.047 L21.909,2.120 L21.806,2.186 L21.699,2.244 L21.588,2.293 L21.473,2.333 L21.353,2.363 L21.229,2.383 L21.100,2.393 L20.966,2.391 L20.768,2.386 L20.575,2.394 L20.387,2.414 L20.203,2.447 L20.024,2.494 L19.849,2.554 L19.678,2.628 L19.510,2.716 L19.347,2.817 L19.187,2.933 L19.031,3.064 L18.879,3.210 L18.840,3.027 L18.790,2.857 L18.728,2.699 L18.654,2.551 L18.568,2.415 L18.472,2.288 L18.365,2.171 L18.247,2.064 L18.118,1.965 L17.980,1.874 L17.832,1.791 L17.675,1.716 L17.590,1.678 L17.505,1.640 L17.421,1.600 L17.338,1.559 L17.256,1.515 L17.176,1.468 L17.098,1.418 L17.023,1.363 L16.950,1.303 L16.881,1.238 L16.815,1.167 L16.754,1.089 L16.715,1.030 L16.680,0.970 L16.649,0.910 L16.622,0.848 L16.597,0.786 L16.575,0.724 L16.555,0.661 L16.535,0.597 L16.517,0.533 L16.498,0.470 L16.479,0.406 L16.459,0.342 L16.446,0.303 L16.432,0.265 L16.417,0.228 L16.402,0.191 L16.384,0.157 L16.364,0.125 L16.342,0.095 L16.317,0.069 L16.288,0.046 L16.255,0.027 L16.218,0.013 L16.176,0.004 L16.130,0.000 L16.089,0.004 L16.052,0.014 L16.018,0.029 L15.988,0.050 L15.960,0.075 L15.935,0.103 L15.912,0.134 L15.891,0.167 L15.871,0.201 L15.852,0.236 L15.833,0.270 L15.761,0.409 L15.697,0.551 L15.640,0.694 L15.590,0.839 L15.547,0.986 L15.511,1.134 L15.482,1.284 L15.459,1.435 L15.441,1.586 L15.430,1.739 L15.425,1.892 L15.425,2.046 L15.443,2.387 L15.485,2.715 L15.550,3.032 L15.638,3.336 L15.750,3.629 L15.886,3.908 L16.045,4.176 L16.228,4.430 L16.435,4.672 L16.666,4.901 L16.920,5.117 L17.199,5.320 L17.230,5.343 L17.257,5.365 L17.280,5.388 L17.299,5.412 L17.315,5.436 L17.326,5.460 L17.335,5.486 L17.339,5.513 L17.340,5.540 L17.338,5.569 L17.332,5.600 L17.324,5.632 L17.303,5.699 L17.283,5.766 L17.262,5.833 L17.240,5.900 L17.219,5.967 L17.197,6.034 L17.175,6.100 L17.153,6.167 L17.131,6.234 L17.109,6.301 L17.088,6.368 L17.067,6.435 L17.053,6.476 L17.038,6.510 L17.021,6.540 L17.002,6.564 L16.982,6.582 L16.958,6.596 L16.932,6.604 L16.903,6.607 L16.870,6.605 L16.834,6.599 L16.794,6.587 L16.750,6.570 L16.592,6.501 L16.438,6.427 L16.288,6.347 L16.140,6.263 L15.996,6.174 L15.855,6.080 L15.718,5.982 L15.583,5.880 L15.452,5.774 L15.323,5.664 L15.197,5.550 L15.074,5.433 L14.869,5.231 L14.666,5.027 L14.465,4.822 L14.264,4.616 L14.063,4.410 L13.861,4.206 L13.656,4.003 L13.448,3.804 L13.237,3.610 L13.020,3.420 L12.797,3.236 L12.568,3.060 L12.513,3.020 L12.458,2.980 L12.404,2.941 L12.349,2.902 L12.294,2.864 L12.239,2.826 L12.183,2.788 L12.128,2.751 L12.072,2.714 L12.016,2.677 L11.960,2.641 L11.903,2.605 L11.706,2.378 L11.584,2.160 L11.526,1.951 L11.522,1.755 L11.564,1.573 L11.640,1.407 L11.742,1.257 L11.858,1.127 L11.980,1.018 L12.097,0.932 L12.199,0.869 L12.277,0.833 L12.333,0.805 L12.370,0.770 L12.388,0.728 L12.385,0.683 L12.361,0.637 L12.315,0.590 L12.246,0.545 L12.153,0.505 L12.035,0.470 L11.892,0.443 L11.722,0.426 L11.526,0.420 L11.317,0.427 L11.110,0.444 L10.904,0.472 L10.698,0.510 L10.491,0.556 L10.282,0.611 L10.070,0.674 L9.854,0.744 L9.634,0.820 L9.407,0.902 L9.174,0.989 L8.933,1.081 L8.897,1.095 L8.860,1.108 L8.824,1.121 L8.787,1.133 L8.750,1.144 L8.712,1.155 L8.675,1.166 L8.637,1.176 L8.599,1.186 L8.561,1.195 L8.522,1.204 L8.484,1.213 L8.260,1.173 L8.036,1.139 L7.809,1.111 L7.582,1.088 L7.352,1.071 L7.121,1.060 L6.889,1.054 L6.655,1.054 L6.419,1.061 L6.182,1.073 L5.943,1.091 L5.702,1.115 L5.255,1.179 L4.823,1.271 L4.407,1.390 L4.006,1.535 L3.620,1.707 L3.251,1.906 L2.896,2.131 L2.558,2.382 L2.235,2.659 L1.928,2.963 L1.637,3.291 L1.362,3.646 L1.062,4.092 L0.801,4.547 L0.579,5.012 L0.395,5.485 L0.247,5.966 L0.135,6.454 L0.057,6.949 L0.012,7.450 L0.000,7.957 L0.019,8.469 L0.068,8.986 L0.147,9.506 L0.259,10.050 L0.402,10.577 L0.574,11.088 L0.776,11.583 L1.006,12.062 L1.265,12.526 L1.552,12.972 L1.866,13.403 L2.208,13.817 L2.575,14.215 L2.969,14.597 L3.389,14.962 L3.843,15.316 L4.308,15.638 L4.784,15.928 L5.273,16.185 L5.772,16.410 L6.284,16.601 L6.807,16.758 L7.342,16.882 L7.889,16.971 L8.448,17.025 L9.019,17.043 L9.601,17.027 L9.962,17.003 L10.330,16.971 L10.705,16.925 L11.087,16.863 L11.477,16.778 L11.874,16.669 L12.279,16.529 L12.691,16.355 L13.111,16.142 L13.540,15.887 L13.976,15.585 L14.421,15.232 L14.535,15.286 L14.651,15.334 L14.770,15.378 L14.892,15.417 L15.020,15.452 L15.154,15.483 L15.294,15.511 L15.443,15.536 L15.601,15.558 L15.769,15.579 L15.947,15.598 L16.138,15.615 L16.289,15.626 L16.439,15.632 L16.588,15.633 L16.734,15.629 L16.878,15.621 L17.019,15.610 L17.157,15.595 L17.291,15.578 L17.421,15.558 L17.547,15.537 L17.668,15.514 L17.784,15.491 L17.945,15.444 L18.078,15.379 L18.182,15.300 L18.261,15.211 L18.315,15.115 L18.348,15.016 L18.360,14.918 L18.355,14.824 L18.332,14.738 L18.296,14.664 L18.247,14.604 L18.188,14.564 L17.719,14.349 L17.343,14.183 L17.050,14.060 L16.827,13.972 L16.663,13.912 L16.544,13.873 L16.461,13.848 L16.400,13.828 L16.351,13.808 L16.300,13.780 L16.237,13.736 L16.150,13.670 L16.424,13.337 L16.717,12.965 L17.020,12.553 L17.330,12.102 L17.640,11.613 L17.943,11.087 L18.235,10.524 L18.510,9.924 L18.762,9.288 L18.984,8.617 L19.171,7.912 L19.318,7.172 L19.331,7.086 L19.343,6.996 L19.356,6.902 L19.369,6.805 L19.380,6.708 L19.391,6.611 L19.401,6.515 L19.409,6.422 L19.416,6.332 L19.421,6.248 L19.423,6.169 L19.422,6.097 L19.422,6.058 L19.424,6.023 L19.429,5.992 L19.436,5.964 L19.447,5.940 L19.461,5.919 L19.480,5.901 L19.502,5.885 L19.530,5.873 L19.562,5.863 L19.601,5.855 L19.645,5.849 L19.775,5.833 L19.904,5.812 L20.032,5.788 L20.160,5.761 L20.286,5.729 L20.411,5.694 L20.536,5.654 L20.658,5.610 L20.780,5.562 L20.900,5.510 L21.019,5.453 L21.136,5.391 L21.456,5.198 L21.744,4.985 L22.002,4.754 L22.230,4.506 L22.430,4.242 L22.603,3.962 L22.750,3.667 L22.874,3.358 L22.975,3.035 L23.054,2.701 L23.114,2.354 L23.155,1.997 L23.159,1.942 L23.160,1.886 L23.159,1.832 L23.154,1.778 L23.144,1.725 L23.131,1.674 L23.112,1.626 L23.087,1.580 L23.055,1.537 L23.017,1.497 L22.971,1.462 L22.917,1.430 Z M11.175,14.474 L10.692,14.099 L10.251,13.767 L9.851,13.476 L9.488,13.224 L9.163,13.009 L8.872,12.829 L8.615,12.683 L8.390,12.568 L8.196,12.483 L8.030,12.426 L7.891,12.396 L7.778,12.390 L7.693,12.404 L7.625,12.433 L7.572,12.475 L7.533,12.528 L7.507,12.591 L7.492,12.661 L7.487,12.736 L7.490,12.815 L7.499,12.895 L7.514,12.975 L7.532,13.053 L7.552,13.126 L7.574,13.194 L7.598,13.258 L7.622,13.320 L7.648,13.380 L7.676,13.439 L7.704,13.496 L7.734,13.552 L7.766,13.608 L7.800,13.664 L7.835,13.721 L7.872,13.780 L7.910,13.840 L7.937,13.882 L7.961,13.926 L7.981,13.973 L7.996,14.022 L8.005,14.072 L8.007,14.123 L8.001,14.175 L7.984,14.226 L7.958,14.277 L7.919,14.327 L7.867,14.375 L7.801,14.422 L7.629,14.503 L7.444,14.551 L7.248,14.569 L7.050,14.564 L6.852,14.540 L6.662,14.501 L6.484,14.454 L6.324,14.403 L6.187,14.353 L6.079,14.309 L6.005,14.277 L5.970,14.260 L5.646,14.061 L5.332,13.852 L5.027,13.632 L4.733,13.399 L4.448,13.155 L4.175,12.898 L3.913,12.628 L3.663,12.345 L3.424,12.048 L3.198,11.737 L2.985,11.410 L2.785,11.069 L2.604,10.731 L2.437,10.389 L2.284,10.043 L2.143,9.692 L2.017,9.338 L1.905,8.980 L1.806,8.617 L1.722,8.251 L1.652,7.880 L1.597,7.505 L1.557,7.127 L1.532,6.744 L1.530,6.656 L1.533,6.577 L1.544,6.507 L1.560,6.446 L1.584,6.392 L1.616,6.345 L1.656,6.304 L1.704,6.269 L1.761,6.239 L1.828,6.213 L1.905,6.192 L1.992,6.173 L2.114,6.152 L2.237,6.134 L2.360,6.119 L2.483,6.108 L2.607,6.099 L2.730,6.094 L2.854,6.092 L2.977,6.094 L3.100,6.099 L3.223,6.108 L3.346,6.120 L3.468,6.136 L3.976,6.224 L4.471,6.337 L4.953,6.476 L5.424,6.640 L5.881,6.828 L6.327,7.041 L6.760,7.277 L7.181,7.538 L7.589,7.822 L7.986,8.130 L8.371,8.460 L8.744,8.813 L8.949,9.024 L9.147,9.240 L9.338,9.463 L9.522,9.690 L9.701,9.921 L9.876,10.156 L10.046,10.393 L10.214,10.633 L10.379,10.875 L10.543,11.117 L10.706,11.360 L10.869,11.602 L11.044,11.859 L11.221,12.112 L11.402,12.363 L11.587,12.610 L11.775,12.854 L11.969,13.093 L12.168,13.327 L12.373,13.557 L12.584,13.781 L12.803,13.999 L13.028,14.210 L13.262,14.415 L13.345,14.484 L13.425,14.550 L13.502,14.613 L13.577,14.674 L13.651,14.732 L13.722,14.788 L13.792,14.841 L13.860,14.891 L13.927,14.939 L13.993,14.984 L14.058,15.027 L14.123,15.068 L13.919,15.088 L13.697,15.103 L13.460,15.110 L13.211,15.108 L12.953,15.094 L12.690,15.066 L12.424,15.021 L12.160,14.958 L11.899,14.874 L11.646,14.767 L11.404,14.635 L11.175,14.475 L11.175,14.474 Z M12.141,8.260 L12.144,8.219 L12.152,8.181 L12.164,8.144 L12.181,8.110 L12.203,8.078 L12.228,8.050 L12.256,8.025 L12.288,8.004 L12.322,7.987 L12.359,7.974 L12.398,7.966 L12.439,7.963 L12.448,7.964 L12.457,7.964 L12.466,7.965 L12.475,7.966 L12.484,7.967 L12.493,7.969 L12.501,7.970 L12.509,7.972 L12.517,7.974 L12.525,7.977 L12.533,7.979 L12.541,7.982 L12.551,7.986 L12.561,7.990 L12.571,7.995 L12.581,8.000 L12.591,8.005 L12.600,8.011 L12.609,8.017 L12.618,8.023 L12.627,8.030 L12.635,8.037 L12.643,8.045 L12.650,8.053 L12.663,8.067 L12.675,8.081 L12.686,8.097 L12.696,8.113 L12.704,8.129 L12.712,8.147 L12.718,8.165 L12.724,8.183 L12.728,8.202 L12.731,8.221 L12.733,8.240 L12.733,8.260 L12.731,8.300 L12.723,8.339 L12.710,8.376 L12.693,8.410 L12.672,8.442 L12.647,8.470 L12.618,8.495 L12.587,8.516 L12.552,8.533 L12.515,8.546 L12.476,8.554 L12.435,8.556 L12.395,8.554 L12.356,8.546 L12.319,8.533 L12.285,8.516 L12.254,8.495 L12.226,8.470 L12.201,8.442 L12.180,8.410 L12.164,8.376 L12.151,8.339 L12.144,8.300 L12.141,8.260 Z M15.142,9.799 L15.093,9.818 L15.045,9.837 L14.997,9.855 L14.949,9.872 L14.901,9.888 L14.854,9.903 L14.806,9.916 L14.759,9.927 L14.712,9.937 L14.665,9.944 L14.618,9.950 L14.572,9.953 L14.499,9.954 L14.427,9.950 L14.354,9.941 L14.282,9.928 L14.211,9.911 L14.143,9.890 L14.076,9.866 L14.013,9.839 L13.953,9.809 L13.898,9.778 L13.847,9.744 L13.802,9.709 L13.737,9.655 L13.676,9.605 L13.618,9.555 L13.564,9.507 L13.513,9.457 L13.466,9.405 L13.423,9.349 L13.384,9.289 L13.349,9.223 L13.318,9.150 L13.292,9.068 L13.270,8.977 L13.262,8.934 L13.257,8.888 L13.253,8.839 L13.252,8.789 L13.252,8.738 L13.253,8.686 L13.256,8.635 L13.260,8.585 L13.265,8.537 L13.271,8.491 L13.277,8.449 L13.284,8.410 L13.299,8.333 L13.307,8.261 L13.309,8.193 L13.305,8.129 L13.295,8.068 L13.278,8.010 L13.256,7.954 L13.228,7.902 L13.194,7.851 L13.154,7.802 L13.107,7.754 L13.055,7.708 L13.008,7.673 L12.960,7.642 L12.910,7.615 L12.858,7.592 L12.804,7.572 L12.749,7.556 L12.693,7.543 L12.634,7.533 L12.575,7.525 L12.515,7.520 L12.453,7.517 L12.390,7.516 L12.367,7.516 L12.343,7.513 L12.321,7.509 L12.299,7.504 L12.277,7.498 L12.256,7.491 L12.236,7.484 L12.216,7.476 L12.197,7.467 L12.179,7.459 L12.161,7.450 L12.145,7.441 L12.119,7.427 L12.094,7.409 L12.071,7.388 L12.051,7.364 L12.033,7.338 L12.019,7.309 L12.009,7.279 L12.003,7.246 L12.002,7.211 L12.007,7.174 L12.018,7.136 L12.035,7.096 L12.044,7.081 L12.056,7.064 L12.071,7.045 L12.088,7.025 L12.107,7.004 L12.126,6.983 L12.146,6.963 L12.165,6.944 L12.182,6.927 L12.198,6.913 L12.211,6.901 L12.220,6.893 L12.307,6.850 L12.396,6.816 L12.486,6.793 L12.578,6.778 L12.671,6.771 L12.764,6.773 L12.858,6.781 L12.953,6.796 L13.047,6.817 L13.141,6.843 L13.234,6.874 L13.326,6.908 L13.409,6.946 L13.490,6.987 L13.568,7.034 L13.645,7.086 L13.722,7.142 L13.798,7.203 L13.875,7.268 L13.953,7.338 L14.033,7.412 L14.116,7.491 L14.202,7.575 L14.292,7.663 L14.380,7.765 L14.457,7.857 L14.524,7.939 L14.583,8.013 L14.636,8.081 L14.683,8.145 L14.727,8.207 L14.770,8.268 L14.812,8.331 L14.855,8.397 L14.902,8.468 L14.953,8.545 L14.995,8.609 L15.036,8.674 L15.077,8.739 L15.116,8.804 L15.155,8.871 L15.192,8.938 L15.228,9.006 L15.262,9.075 L15.295,9.145 L15.326,9.217 L15.356,9.290 L15.383,9.364 L15.396,9.410 L15.403,9.455 L15.404,9.498 L15.398,9.539 L15.387,9.579 L15.370,9.616 L15.347,9.652 L15.317,9.686 L15.282,9.718 L15.241,9.747 L15.194,9.774 L15.142,9.799 Z",
		"M24.424,3.622 L24.377,3.580 L24.331,3.552 L24.285,3.535 L24.239,3.529 L24.194,3.532 L24.149,3.543 L24.104,3.558 L24.059,3.577 L24.014,3.598 L23.970,3.619 L23.926,3.639 L23.882,3.655 L23.867,3.660 L23.852,3.665 L23.838,3.671 L23.823,3.677 L23.809,3.683 L23.795,3.689 L23.781,3.696 L23.767,3.703 L23.753,3.710 L23.739,3.717 L23.725,3.724 L23.711,3.731 L23.593,3.785 L23.474,3.833 L23.355,3.873 L23.236,3.906 L23.116,3.930 L22.995,3.946 L22.874,3.952 L22.752,3.948 L22.630,3.933 L22.506,3.908 L22.383,3.870 L22.258,3.820 L22.075,3.745 L21.893,3.683 L21.710,3.634 L21.526,3.600 L21.342,3.579 L21.157,3.572 L20.971,3.580 L20.783,3.602 L20.594,3.638 L20.403,3.689 L20.211,3.756 L20.016,3.837 L20.046,3.653 L20.060,3.476 L20.058,3.305 L20.042,3.141 L20.011,2.983 L19.965,2.830 L19.898,2.677 L19.806,2.525 L19.687,2.371 L19.537,2.218 L19.357,2.066 L19.143,1.916 L19.020,1.840 L18.892,1.765 L18.762,1.691 L18.630,1.618 L18.497,1.545 L18.365,1.472 L18.235,1.398 L18.107,1.324 L17.984,1.247 L17.865,1.168 L17.753,1.086 L17.648,0.999 L17.582,0.936 L17.524,0.873 L17.474,0.810 L17.429,0.747 L17.390,0.683 L17.355,0.620 L17.323,0.556 L17.293,0.492 L17.265,0.428 L17.236,0.363 L17.205,0.299 L17.173,0.235 L17.151,0.197 L17.128,0.159 L17.103,0.121 L17.075,0.085 L17.043,0.051 L17.007,0.019 L16.966,-0.010 L16.918,-0.035 L16.864,-0.057 L16.801,-0.074 L16.731,-0.086 L16.651,-0.092 L16.565,-0.092 L16.487,-0.085 L16.418,-0.071 L16.357,-0.051 L16.301,-0.027 L16.252,0.002 L16.207,0.033 L16.166,0.067 L16.129,0.103 L16.094,0.140 L16.061,0.177 L16.029,0.214 L15.911,0.363 L15.811,0.513 L15.726,0.664 L15.655,0.815 L15.596,0.967 L15.548,1.119 L15.510,1.272 L15.481,1.425 L15.460,1.578 L15.446,1.731 L15.440,1.885 L15.439,2.039 L15.459,2.378 L15.506,2.703 L15.581,3.013 L15.686,3.306 L15.820,3.583 L15.985,3.842 L16.179,4.086 L16.398,4.320 L16.634,4.550 L16.883,4.780 L17.141,5.013 L17.409,5.248 L17.437,5.275 L17.461,5.301 L17.480,5.328 L17.494,5.354 L17.504,5.380 L17.510,5.407 L17.511,5.434 L17.509,5.462 L17.502,5.490 L17.492,5.519 L17.478,5.550 L17.460,5.581 L17.422,5.649 L17.384,5.716 L17.348,5.784 L17.313,5.852 L17.279,5.920 L17.246,5.988 L17.214,6.057 L17.183,6.126 L17.154,6.196 L17.126,6.266 L17.100,6.336 L17.074,6.407 L17.058,6.449 L17.041,6.485 L17.023,6.516 L17.004,6.541 L16.982,6.560 L16.958,6.574 L16.932,6.583 L16.903,6.586 L16.870,6.584 L16.834,6.576 L16.795,6.564 L16.751,6.547 L16.595,6.474 L16.442,6.398 L16.293,6.318 L16.146,6.235 L16.003,6.148 L15.861,6.059 L15.723,5.966 L15.587,5.870 L15.453,5.770 L15.323,5.663 L15.197,5.550 L15.074,5.433 L14.869,5.231 L14.666,5.027 L14.465,4.822 L14.264,4.616 L14.063,4.410 L13.861,4.206 L13.656,4.003 L13.448,3.804 L13.237,3.610 L13.020,3.420 L12.797,3.236 L12.568,3.060 L12.513,3.020 L12.458,2.980 L12.404,2.941 L12.349,2.902 L12.294,2.864 L12.239,2.826 L12.183,2.788 L12.128,2.751 L12.072,2.714 L12.016,2.677 L11.960,2.641 L11.903,2.605 L11.706,2.378 L11.584,2.160 L11.526,1.951 L11.522,1.755 L11.564,1.573 L11.640,1.407 L11.742,1.257 L11.858,1.127 L11.980,1.018 L12.097,0.932 L12.199,0.869 L12.277,0.833 L12.333,0.805 L12.370,0.770 L12.388,0.728 L12.385,0.683 L12.361,0.637 L12.315,0.590 L12.246,0.545 L12.153,0.505 L12.035,0.470 L11.892,0.443 L11.722,0.426 L11.526,0.420 L11.317,0.427 L11.110,0.444 L10.904,0.472 L10.698,0.510 L10.491,0.556 L10.282,0.611 L10.070,0.674 L9.854,0.744 L9.634,0.820 L9.407,0.902 L9.174,0.989 L8.933,1.081 L8.897,1.095 L8.860,1.108 L8.824,1.121 L8.787,1.133 L8.750,1.144 L8.712,1.155 L8.675,1.166 L8.637,1.176 L8.599,1.186 L8.561,1.195 L8.522,1.204 L8.484,1.213 L8.260,1.173 L8.036,1.139 L7.809,1.111 L7.582,1.088 L7.352,1.071 L7.121,1.060 L6.889,1.054 L6.655,1.054 L6.419,1.061 L6.182,1.073 L5.943,1.091 L5.702,1.115 L5.255,1.179 L4.823,1.271 L4.407,1.390 L4.006,1.535 L3.620,1.707 L3.251,1.906 L2.896,2.131 L2.558,2.382 L2.235,2.659 L1.928,2.963 L1.637,3.291 L1.362,3.646 L1.062,4.092 L0.801,4.547 L0.579,5.012 L0.395,5.485 L0.247,5.966 L0.135,6.454 L0.057,6.949 L0.012,7.450 L0.000,7.957 L0.019,8.469 L0.068,8.986 L0.147,9.506 L0.259,10.050 L0.402,10.577 L0.574,11.088 L0.776,11.583 L1.006,12.062 L1.265,12.526 L1.552,12.972 L1.866,13.403 L2.208,13.817 L2.575,14.215 L2.969,14.597 L3.389,14.962 L3.843,15.316 L4.308,15.638 L4.784,15.928 L5.273,16.185 L5.772,16.410 L6.284,16.601 L6.807,16.758 L7.342,16.882 L7.889,16.971 L8.448,17.025 L9.019,17.043 L9.601,17.027 L9.962,17.003 L10.330,16.971 L10.705,16.925 L11.087,16.863 L11.477,16.778 L11.874,16.669 L12.279,16.529 L12.691,16.355 L13.111,16.142 L13.540,15.887 L13.976,15.585 L14.421,15.232 L14.535,15.286 L14.651,15.334 L14.770,15.378 L14.892,15.417 L15.020,15.452 L15.154,15.483 L15.294,15.511 L15.443,15.536 L15.601,15.558 L15.769,15.579 L15.947,15.598 L16.138,15.615 L16.289,15.626 L16.439,15.632 L16.588,15.633 L16.734,15.629 L16.878,15.621 L17.019,15.610 L17.157,15.595 L17.291,15.578 L17.421,15.558 L17.547,15.537 L17.668,15.514 L17.784,15.491 L17.945,15.444 L18.078,15.379 L18.182,15.300 L18.261,15.211 L18.315,15.115 L18.348,15.016 L18.360,14.918 L18.355,14.824 L18.332,14.738 L18.296,14.664 L18.247,14.604 L18.188,14.564 L17.719,14.349 L17.343,14.183 L17.050,14.060 L16.827,13.972 L16.663,13.912 L16.544,13.873 L16.461,13.848 L16.400,13.828 L16.351,13.808 L16.300,13.780 L16.237,13.736 L16.150,13.670 L16.424,13.337 L16.717,12.965 L17.020,12.553 L17.330,12.102 L17.640,11.613 L17.943,11.087 L18.235,10.524 L18.510,9.924 L18.762,9.288 L18.984,8.617 L19.171,7.912 L19.316,7.178 L19.327,7.098 L19.338,7.016 L19.350,6.933 L19.362,6.851 L19.375,6.770 L19.388,6.691 L19.403,6.616 L19.417,6.544 L19.432,6.476 L19.446,6.413 L19.459,6.355 L19.470,6.303 L19.477,6.275 L19.485,6.250 L19.496,6.229 L19.509,6.210 L19.524,6.195 L19.543,6.182 L19.565,6.173 L19.591,6.166 L19.621,6.161 L19.656,6.160 L19.695,6.161 L19.740,6.164 L19.872,6.174 L20.004,6.183 L20.136,6.191 L20.268,6.197 L20.401,6.202 L20.533,6.206 L20.665,6.210 L20.796,6.213 L20.928,6.216 L21.060,6.218 L21.192,6.220 L21.324,6.222 L21.693,6.229 L22.041,6.230 L22.367,6.214 L22.674,6.166 L22.960,6.060 L23.223,5.873 L23.467,5.651 L23.693,5.407 L23.903,5.142 L24.097,4.858 L24.277,4.556 L24.443,4.237 L24.466,4.187 L24.487,4.136 L24.506,4.084 L24.520,4.032 L24.531,3.979 L24.536,3.927 L24.536,3.875 L24.529,3.823 L24.515,3.772 L24.493,3.721 L24.463,3.671 L24.424,3.622 Z M11.175,14.474 L10.692,14.099 L10.251,13.767 L9.851,13.476 L9.488,13.224 L9.163,13.009 L8.872,12.829 L8.615,12.683 L8.390,12.568 L8.196,12.483 L8.030,12.426 L7.891,12.396 L7.778,12.390 L7.693,12.404 L7.625,12.433 L7.572,12.475 L7.533,12.528 L7.507,12.591 L7.492,12.661 L7.487,12.736 L7.490,12.815 L7.499,12.895 L7.514,12.975 L7.532,13.053 L7.552,13.126 L7.574,13.194 L7.598,13.258 L7.622,13.320 L7.648,13.380 L7.676,13.439 L7.704,13.496 L7.734,13.552 L7.766,13.608 L7.800,13.664 L7.835,13.721 L7.872,13.780 L7.910,13.840 L7.937,13.882 L7.961,13.926 L7.981,13.973 L7.996,14.022 L8.005,14.072 L8.007,14.123 L8.001,14.175 L7.984,14.226 L7.958,14.277 L7.919,14.327 L7.867,14.375 L7.801,14.422 L7.629,14.503 L7.444,14.551 L7.248,14.569 L7.050,14.564 L6.852,14.540 L6.662,14.501 L6.484,14.454 L6.324,14.403 L6.187,14.353 L6.079,14.309 L6.005,14.277 L5.970,14.260 L5.646,14.061 L5.332,13.852 L5.027,13.632 L4.733,13.399 L4.448,13.155 L4.175,12.898 L3.913,12.628 L3.663,12.345 L3.424,12.048 L3.198,11.737 L2.985,11.410 L2.785,11.069 L2.604,10.731 L2.437,10.389 L2.284,10.043 L2.143,9.692 L2.017,9.338 L1.905,8.980 L1.806,8.617 L1.722,8.251 L1.652,7.880 L1.597,7.505 L1.557,7.127 L1.532,6.744 L1.530,6.656 L1.533,6.577 L1.544,6.507 L1.560,6.446 L1.584,6.392 L1.616,6.345 L1.656,6.304 L1.704,6.269 L1.761,6.239 L1.828,6.213 L1.905,6.192 L1.992,6.173 L2.114,6.152 L2.237,6.134 L2.360,6.119 L2.483,6.108 L2.607,6.099 L2.730,6.094 L2.854,6.092 L2.977,6.094 L3.100,6.099 L3.223,6.108 L3.346,6.120 L3.468,6.136 L3.976,6.224 L4.471,6.337 L4.953,6.476 L5.424,6.640 L5.881,6.828 L6.327,7.041 L6.760,7.277 L7.181,7.538 L7.589,7.822 L7.986,8.130 L8.371,8.460 L8.744,8.813 L8.949,9.024 L9.147,9.240 L9.338,9.463 L9.522,9.690 L9.701,9.921 L9.876,10.156 L10.046,10.393 L10.214,10.633 L10.379,10.875 L10.543,11.117 L10.706,11.360 L10.869,11.602 L11.044,11.859 L11.221,12.112 L11.402,12.363 L11.587,12.610 L11.775,12.854 L11.969,13.093 L12.168,13.327 L12.373,13.557 L12.584,13.781 L12.803,13.999 L13.028,14.210 L13.262,14.415 L13.345,14.484 L13.425,14.550 L13.502,14.613 L13.577,14.674 L13.651,14.732 L13.722,14.788 L13.792,14.841 L13.860,14.891 L13.927,14.939 L13.993,14.984 L14.058,15.027 L14.123,15.068 L13.919,15.088 L13.697,15.103 L13.460,15.110 L13.211,15.108 L12.953,15.094 L12.690,15.066 L12.424,15.021 L12.160,14.958 L11.899,14.874 L11.646,14.767 L11.404,14.635 L11.175,14.475 L11.175,14.474 Z M12.141,8.260 L12.144,8.219 L12.152,8.181 L12.164,8.144 L12.181,8.110 L12.203,8.078 L12.228,8.050 L12.256,8.025 L12.288,8.004 L12.322,7.987 L12.359,7.974 L12.398,7.966 L12.439,7.963 L12.448,7.964 L12.457,7.964 L12.466,7.965 L12.475,7.966 L12.484,7.967 L12.493,7.969 L12.501,7.970 L12.509,7.972 L12.517,7.974 L12.525,7.977 L12.533,7.979 L12.541,7.982 L12.551,7.986 L12.561,7.990 L12.571,7.995 L12.581,8.000 L12.591,8.005 L12.600,8.011 L12.609,8.017 L12.618,8.023 L12.627,8.030 L12.635,8.037 L12.643,8.045 L12.650,8.053 L12.663,8.067 L12.675,8.081 L12.686,8.097 L12.696,8.113 L12.704,8.129 L12.712,8.147 L12.718,8.165 L12.724,8.183 L12.728,8.202 L12.731,8.221 L12.733,8.240 L12.733,8.260 L12.731,8.300 L12.723,8.339 L12.710,8.376 L12.693,8.410 L12.672,8.442 L12.647,8.470 L12.618,8.495 L12.587,8.516 L12.552,8.533 L12.515,8.546 L12.476,8.554 L12.435,8.556 L12.395,8.554 L12.356,8.546 L12.319,8.533 L12.285,8.516 L12.254,8.495 L12.226,8.470 L12.201,8.442 L12.180,8.410 L12.164,8.376 L12.151,8.339 L12.144,8.300 L12.141,8.260 Z M15.142,9.799 L15.093,9.818 L15.045,9.837 L14.997,9.855 L14.949,9.872 L14.901,9.888 L14.854,9.903 L14.806,9.916 L14.759,9.927 L14.712,9.937 L14.665,9.944 L14.618,9.950 L14.572,9.953 L14.499,9.954 L14.427,9.950 L14.354,9.941 L14.282,9.928 L14.211,9.911 L14.143,9.890 L14.076,9.866 L14.013,9.839 L13.953,9.809 L13.898,9.778 L13.847,9.744 L13.802,9.709 L13.737,9.655 L13.676,9.605 L13.618,9.555 L13.564,9.507 L13.513,9.457 L13.466,9.405 L13.423,9.349 L13.384,9.289 L13.349,9.223 L13.318,9.150 L13.292,9.068 L13.270,8.977 L13.262,8.934 L13.257,8.888 L13.253,8.839 L13.252,8.789 L13.252,8.738 L13.253,8.686 L13.256,8.635 L13.260,8.585 L13.265,8.537 L13.271,8.491 L13.277,8.449 L13.284,8.410 L13.299,8.333 L13.307,8.261 L13.309,8.193 L13.305,8.129 L13.295,8.068 L13.278,8.010 L13.256,7.954 L13.228,7.902 L13.194,7.851 L13.154,7.802 L13.107,7.754 L13.055,7.708 L13.008,7.673 L12.960,7.642 L12.910,7.615 L12.858,7.592 L12.804,7.572 L12.749,7.556 L12.693,7.543 L12.634,7.533 L12.575,7.525 L12.515,7.520 L12.453,7.517 L12.390,7.516 L12.367,7.516 L12.343,7.513 L12.321,7.509 L12.299,7.504 L12.277,7.498 L12.256,7.491 L12.236,7.484 L12.216,7.476 L12.197,7.467 L12.179,7.459 L12.161,7.450 L12.145,7.441 L12.119,7.427 L12.094,7.409 L12.071,7.388 L12.051,7.364 L12.033,7.338 L12.019,7.309 L12.009,7.279 L12.003,7.246 L12.002,7.211 L12.007,7.174 L12.018,7.136 L12.035,7.096 L12.044,7.081 L12.056,7.064 L12.071,7.045 L12.088,7.025 L12.107,7.004 L12.126,6.983 L12.146,6.963 L12.165,6.944 L12.182,6.927 L12.198,6.913 L12.211,6.901 L12.220,6.893 L12.307,6.850 L12.396,6.816 L12.486,6.793 L12.578,6.778 L12.671,6.771 L12.764,6.773 L12.858,6.781 L12.953,6.796 L13.047,6.817 L13.141,6.843 L13.234,6.874 L13.326,6.908 L13.409,6.946 L13.490,6.987 L13.568,7.034 L13.645,7.086 L13.722,7.142 L13.798,7.203 L13.875,7.268 L13.953,7.338 L14.033,7.412 L14.116,7.491 L14.202,7.575 L14.292,7.663 L14.380,7.765 L14.457,7.857 L14.524,7.939 L14.583,8.013 L14.636,8.081 L14.683,8.145 L14.727,8.207 L14.770,8.268 L14.812,8.331 L14.855,8.397 L14.902,8.468 L14.953,8.545 L14.995,8.609 L15.036,8.674 L15.077,8.739 L15.116,8.804 L15.155,8.871 L15.192,8.938 L15.228,9.006 L15.262,9.075 L15.295,9.145 L15.326,9.217 L15.356,9.290 L15.383,9.364 L15.396,9.410 L15.403,9.455 L15.404,9.498 L15.398,9.539 L15.387,9.579 L15.370,9.616 L15.347,9.652 L15.317,9.686 L15.282,9.718 L15.241,9.747 L15.194,9.774 L15.142,9.799 Z",
		"M21.182,0.147 L21.119,0.142 L21.065,0.148 L21.019,0.163 L20.980,0.187 L20.946,0.217 L20.916,0.253 L20.890,0.293 L20.867,0.336 L20.844,0.380 L20.822,0.424 L20.800,0.467 L20.775,0.507 L20.766,0.519 L20.758,0.532 L20.750,0.546 L20.742,0.559 L20.735,0.573 L20.728,0.587 L20.721,0.601 L20.714,0.615 L20.707,0.629 L20.700,0.643 L20.694,0.657 L20.687,0.671 L20.627,0.786 L20.563,0.897 L20.494,1.002 L20.420,1.101 L20.341,1.195 L20.255,1.281 L20.163,1.361 L20.065,1.432 L19.959,1.496 L19.847,1.552 L19.726,1.599 L19.597,1.636 L19.407,1.689 L19.225,1.753 L19.051,1.827 L18.885,1.913 L18.727,2.010 L18.577,2.119 L18.435,2.239 L18.300,2.372 L18.174,2.517 L18.055,2.675 L17.944,2.845 L17.841,3.029 L17.751,2.866 L17.653,2.718 L17.547,2.585 L17.433,2.465 L17.311,2.360 L17.183,2.267 L17.055,2.185 L16.929,2.113 L16.808,2.049 L16.692,1.990 L16.585,1.936 L16.485,1.883 L16.437,1.856 L16.391,1.825 L16.349,1.791 L16.308,1.754 L16.270,1.712 L16.233,1.666 L16.199,1.614 L16.165,1.557 L16.134,1.494 L16.104,1.425 L16.075,1.349 L16.047,1.265 L16.029,1.203 L16.013,1.140 L15.998,1.077 L15.984,1.012 L15.970,0.948 L15.958,0.883 L15.946,0.817 L15.935,0.751 L15.925,0.685 L15.914,0.619 L15.903,0.553 L15.893,0.486 L15.887,0.446 L15.880,0.406 L15.874,0.367 L15.867,0.328 L15.860,0.291 L15.853,0.256 L15.846,0.223 L15.838,0.193 L15.829,0.166 L15.820,0.142 L15.810,0.122 L15.797,0.106 L15.784,0.095 L15.771,0.092 L15.759,0.097 L15.748,0.107 L15.737,0.123 L15.727,0.144 L15.718,0.168 L15.709,0.196 L15.700,0.226 L15.692,0.257 L15.684,0.289 L15.675,0.320 L15.640,0.449 L15.605,0.583 L15.571,0.719 L15.538,0.859 L15.508,1.001 L15.481,1.147 L15.459,1.294 L15.440,1.443 L15.426,1.593 L15.417,1.745 L15.413,1.898 L15.414,2.052 L15.431,2.394 L15.468,2.725 L15.525,3.048 L15.601,3.361 L15.695,3.667 L15.808,3.965 L15.941,4.253 L16.098,4.529 L16.284,4.786 L16.503,5.019 L16.754,5.225 L17.040,5.403 L17.072,5.422 L17.102,5.441 L17.127,5.461 L17.150,5.481 L17.169,5.502 L17.186,5.524 L17.199,5.548 L17.209,5.572 L17.216,5.598 L17.220,5.626 L17.221,5.655 L17.219,5.686 L17.213,5.751 L17.205,5.816 L17.196,5.880 L17.185,5.945 L17.173,6.009 L17.160,6.073 L17.145,6.137 L17.130,6.201 L17.114,6.265 L17.097,6.329 L17.080,6.394 L17.062,6.459 L17.050,6.497 L17.036,6.531 L17.020,6.559 L17.002,6.582 L16.982,6.600 L16.958,6.613 L16.932,6.621 L16.903,6.625 L16.871,6.623 L16.834,6.616 L16.794,6.605 L16.750,6.590 L16.591,6.523 L16.436,6.450 L16.284,6.371 L16.136,6.286 L15.991,6.195 L15.851,6.098 L15.714,5.995 L15.581,5.888 L15.450,5.778 L15.323,5.665 L15.197,5.550 L15.074,5.433 L14.869,5.231 L14.666,5.027 L14.465,4.822 L14.264,4.616 L14.063,4.410 L13.861,4.206 L13.656,4.003 L13.448,3.804 L13.237,3.610 L13.020,3.420 L12.797,3.236 L12.568,3.060 L12.513,3.020 L12.458,2.980 L12.404,2.941 L12.349,2.902 L12.294,2.864 L12.239,2.826 L12.183,2.788 L12.128,2.751 L12.072,2.714 L12.016,2.677 L11.960,2.641 L11.903,2.605 L11.706,2.378 L11.584,2.160 L11.526,1.951 L11.522,1.755 L11.564,1.573 L11.640,1.407 L11.742,1.257 L11.858,1.127 L11.980,1.018 L12.097,0.932 L12.199,0.869 L12.277,0.833 L12.333,0.805 L12.370,0.770 L12.388,0.728 L12.385,0.683 L12.361,0.637 L12.315,0.590 L12.246,0.545 L12.153,0.505 L12.035,0.470 L11.892,0.443 L11.722,0.426 L11.526,0.420 L11.317,0.427 L11.110,0.444 L10.904,0.472 L10.698,0.510 L10.491,0.556 L10.282,0.611 L10.070,0.674 L9.854,0.744 L9.634,0.820 L9.407,0.902 L9.174,0.989 L8.933,1.081 L8.897,1.095 L8.860,1.108 L8.824,1.121 L8.787,1.133 L8.750,1.144 L8.712,1.155 L8.675,1.166 L8.637,1.176 L8.599,1.186 L8.561,1.195 L8.522,1.204 L8.484,1.213 L8.260,1.173 L8.036,1.139 L7.809,1.111 L7.582,1.088 L7.352,1.071 L7.121,1.060 L6.889,1.054 L6.655,1.054 L6.419,1.061 L6.182,1.073 L5.943,1.091 L5.702,1.115 L5.255,1.179 L4.823,1.271 L4.407,1.390 L4.006,1.535 L3.620,1.707 L3.251,1.906 L2.896,2.131 L2.558,2.382 L2.235,2.659 L1.928,2.963 L1.637,3.291 L1.362,3.646 L1.062,4.092 L0.801,4.547 L0.579,5.012 L0.395,5.485 L0.247,5.966 L0.135,6.454 L0.057,6.949 L0.012,7.450 L0.000,7.957 L0.019,8.469 L0.068,8.986 L0.147,9.506 L0.259,10.050 L0.402,10.577 L0.574,11.088 L0.776,11.583 L1.006,12.062 L1.265,12.526 L1.552,12.972 L1.866,13.403 L2.208,13.817 L2.575,14.215 L2.969,14.597 L3.389,14.962 L3.843,15.316 L4.308,15.638 L4.784,15.928 L5.273,16.185 L5.772,16.410 L6.284,16.601 L6.807,16.758 L7.342,16.882 L7.889,16.971 L8.448,17.025 L9.019,17.043 L9.601,17.027 L9.962,17.003 L10.330,16.971 L10.705,16.925 L11.087,16.863 L11.477,16.778 L11.874,16.669 L12.279,16.529 L12.691,16.355 L13.111,16.142 L13.540,15.887 L13.976,15.585 L14.421,15.232 L14.535,15.286 L14.651,15.334 L14.770,15.378 L14.892,15.417 L15.020,15.452 L15.154,15.483 L15.294,15.511 L15.443,15.536 L15.601,15.558 L15.769,15.579 L15.947,15.598 L16.138,15.615 L16.289,15.626 L16.439,15.632 L16.588,15.633 L16.734,15.629 L16.878,15.621 L17.019,15.610 L17.157,15.595 L17.291,15.578 L17.421,15.558 L17.547,15.537 L17.668,15.514 L17.784,15.491 L17.945,15.444 L18.078,15.379 L18.182,15.300 L18.261,15.211 L18.315,15.115 L18.348,15.016 L18.360,14.918 L18.355,14.824 L18.332,14.738 L18.296,14.664 L18.247,14.604 L18.188,14.564 L17.719,14.349 L17.343,14.183 L17.050,14.060 L16.827,13.972 L16.663,13.912 L16.544,13.873 L16.461,13.848 L16.400,13.828 L16.351,13.808 L16.300,13.780 L16.237,13.736 L16.150,13.670 L16.424,13.337 L16.717,12.965 L17.020,12.553 L17.330,12.102 L17.640,11.613 L17.943,11.087 L18.235,10.524 L18.510,9.924 L18.762,9.288 L18.984,8.617 L19.171,7.912 L19.320,7.168 L19.334,7.077 L19.348,6.979 L19.361,6.876 L19.373,6.768 L19.383,6.658 L19.391,6.546 L19.395,6.434 L19.396,6.324 L19.394,6.218 L19.388,6.116 L19.378,6.022 L19.365,5.936 L19.358,5.889 L19.353,5.846 L19.351,5.808 L19.352,5.774 L19.357,5.743 L19.367,5.716 L19.380,5.692 L19.399,5.671 L19.423,5.652 L19.453,5.636 L19.489,5.621 L19.531,5.608 L19.656,5.571 L19.778,5.528 L19.898,5.480 L20.016,5.426 L20.132,5.366 L20.244,5.301 L20.354,5.229 L20.460,5.150 L20.562,5.065 L20.660,4.973 L20.754,4.873 L20.843,4.766 L21.069,4.433 L21.244,4.077 L21.374,3.708 L21.469,3.339 L21.545,2.986 L21.622,2.660 L21.677,2.334 L21.705,2.003 L21.707,1.665 L21.685,1.322 L21.641,0.973 L21.576,0.620 L21.563,0.565 L21.548,0.512 L21.531,0.460 L21.510,0.410 L21.486,0.362 L21.458,0.318 L21.426,0.277 L21.388,0.240 L21.346,0.208 L21.298,0.182 L21.243,0.161 L21.182,0.147 Z M11.175,14.474 L10.692,14.099 L10.251,13.767 L9.851,13.476 L9.488,13.224 L9.163,13.009 L8.872,12.829 L8.615,12.683 L8.390,12.568 L8.196,12.483 L8.030,12.426 L7.891,12.396 L7.778,12.390 L7.693,12.404 L7.625,12.433 L7.572,12.475 L7.533,12.528 L7.507,12.591 L7.492,12.661 L7.487,12.736 L7.490,12.815 L7.499,12.895 L7.514,12.975 L7.532,13.053 L7.552,13.126 L7.574,13.194 L7.598,13.258 L7.622,13.320 L7.648,13.380 L7.676,13.439 L7.704,13.496 L7.734,13.552 L7.766,13.608 L7.800,13.664 L7.835,13.721 L7.872,13.780 L7.910,13.840 L7.937,13.882 L7.961,13.926 L7.981,13.973 L7.996,14.022 L8.005,14.072 L8.007,14.123 L8.001,14.175 L7.984,14.226 L7.958,14.277 L7.919,14.327 L7.867,14.375 L7.801,14.422 L7.629,14.503 L7.444,14.551 L7.248,14.569 L7.050,14.564 L6.852,14.540 L6.662,14.501 L6.484,14.454 L6.324,14.403 L6.187,14.353 L6.079,14.309 L6.005,14.277 L5.970,14.260 L5.646,14.061 L5.332,13.852 L5.027,13.632 L4.733,13.399 L4.448,13.155 L4.175,12.898 L3.913,12.628 L3.663,12.345 L3.424,12.048 L3.198,11.737 L2.985,11.410 L2.785,11.069 L2.604,10.731 L2.437,10.389 L2.284,10.043 L2.143,9.692 L2.017,9.338 L1.905,8.980 L1.806,8.617 L1.722,8.251 L1.652,7.880 L1.597,7.505 L1.557,7.127 L1.532,6.744 L1.530,6.656 L1.533,6.577 L1.544,6.507 L1.560,6.446 L1.584,6.392 L1.616,6.345 L1.656,6.304 L1.704,6.269 L1.761,6.239 L1.828,6.213 L1.905,6.192 L1.992,6.173 L2.114,6.152 L2.237,6.134 L2.360,6.119 L2.483,6.108 L2.607,6.099 L2.730,6.094 L2.854,6.092 L2.977,6.094 L3.100,6.099 L3.223,6.108 L3.346,6.120 L3.468,6.136 L3.976,6.224 L4.471,6.337 L4.953,6.476 L5.424,6.640 L5.881,6.828 L6.327,7.041 L6.760,7.277 L7.181,7.538 L7.589,7.822 L7.986,8.130 L8.371,8.460 L8.744,8.813 L8.949,9.024 L9.147,9.240 L9.338,9.463 L9.522,9.690 L9.701,9.921 L9.876,10.156 L10.046,10.393 L10.214,10.633 L10.379,10.875 L10.543,11.117 L10.706,11.360 L10.869,11.602 L11.044,11.859 L11.221,12.112 L11.402,12.363 L11.587,12.610 L11.775,12.854 L11.969,13.093 L12.168,13.327 L12.373,13.557 L12.584,13.781 L12.803,13.999 L13.028,14.210 L13.262,14.415 L13.345,14.484 L13.425,14.550 L13.502,14.613 L13.577,14.674 L13.651,14.732 L13.722,14.788 L13.792,14.841 L13.860,14.891 L13.927,14.939 L13.993,14.984 L14.058,15.027 L14.123,15.068 L13.919,15.088 L13.697,15.103 L13.460,15.110 L13.211,15.108 L12.953,15.094 L12.690,15.066 L12.424,15.021 L12.160,14.958 L11.899,14.874 L11.646,14.767 L11.404,14.635 L11.175,14.475 L11.175,14.474 Z M12.141,8.260 L12.144,8.219 L12.152,8.181 L12.164,8.144 L12.181,8.110 L12.203,8.078 L12.228,8.050 L12.256,8.025 L12.288,8.004 L12.322,7.987 L12.359,7.974 L12.398,7.966 L12.439,7.963 L12.448,7.964 L12.457,7.964 L12.466,7.965 L12.475,7.966 L12.484,7.967 L12.493,7.969 L12.501,7.970 L12.509,7.972 L12.517,7.974 L12.525,7.977 L12.533,7.979 L12.541,7.982 L12.551,7.986 L12.561,7.990 L12.571,7.995 L12.581,8.000 L12.591,8.005 L12.600,8.011 L12.609,8.017 L12.618,8.023 L12.627,8.030 L12.635,8.037 L12.643,8.045 L12.650,8.053 L12.663,8.067 L12.675,8.081 L12.686,8.097 L12.696,8.113 L12.704,8.129 L12.712,8.147 L12.718,8.165 L12.724,8.183 L12.728,8.202 L12.731,8.221 L12.733,8.240 L12.733,8.260 L12.731,8.300 L12.723,8.339 L12.710,8.376 L12.693,8.410 L12.672,8.442 L12.647,8.470 L12.618,8.495 L12.587,8.516 L12.552,8.533 L12.515,8.546 L12.476,8.554 L12.435,8.556 L12.395,8.554 L12.356,8.546 L12.319,8.533 L12.285,8.516 L12.254,8.495 L12.226,8.470 L12.201,8.442 L12.180,8.410 L12.164,8.376 L12.151,8.339 L12.144,8.300 L12.141,8.260 Z M15.142,9.799 L15.093,9.818 L15.045,9.837 L14.997,9.855 L14.949,9.872 L14.901,9.888 L14.854,9.903 L14.806,9.916 L14.759,9.927 L14.712,9.937 L14.665,9.944 L14.618,9.950 L14.572,9.953 L14.499,9.954 L14.427,9.950 L14.354,9.941 L14.282,9.928 L14.211,9.911 L14.143,9.890 L14.076,9.866 L14.013,9.839 L13.953,9.809 L13.898,9.778 L13.847,9.744 L13.802,9.709 L13.737,9.655 L13.676,9.605 L13.618,9.555 L13.564,9.507 L13.513,9.457 L13.466,9.405 L13.423,9.349 L13.384,9.289 L13.349,9.223 L13.318,9.150 L13.292,9.068 L13.270,8.977 L13.262,8.934 L13.257,8.888 L13.253,8.839 L13.252,8.789 L13.252,8.738 L13.253,8.686 L13.256,8.635 L13.260,8.585 L13.265,8.537 L13.271,8.491 L13.277,8.449 L13.284,8.410 L13.299,8.333 L13.307,8.261 L13.309,8.193 L13.305,8.129 L13.295,8.068 L13.278,8.010 L13.256,7.954 L13.228,7.902 L13.194,7.851 L13.154,7.802 L13.107,7.754 L13.055,7.708 L13.008,7.673 L12.960,7.642 L12.910,7.615 L12.858,7.592 L12.804,7.572 L12.749,7.556 L12.693,7.543 L12.634,7.533 L12.575,7.525 L12.515,7.520 L12.453,7.517 L12.390,7.516 L12.367,7.516 L12.343,7.513 L12.321,7.509 L12.299,7.504 L12.277,7.498 L12.256,7.491 L12.236,7.484 L12.216,7.476 L12.197,7.467 L12.179,7.459 L12.161,7.450 L12.145,7.441 L12.119,7.427 L12.094,7.409 L12.071,7.388 L12.051,7.364 L12.033,7.338 L12.019,7.309 L12.009,7.279 L12.003,7.246 L12.002,7.211 L12.007,7.174 L12.018,7.136 L12.035,7.096 L12.044,7.081 L12.056,7.064 L12.071,7.045 L12.088,7.025 L12.107,7.004 L12.126,6.983 L12.146,6.963 L12.165,6.944 L12.182,6.927 L12.198,6.913 L12.211,6.901 L12.220,6.893 L12.307,6.850 L12.396,6.816 L12.486,6.793 L12.578,6.778 L12.671,6.771 L12.764,6.773 L12.858,6.781 L12.953,6.796 L13.047,6.817 L13.141,6.843 L13.234,6.874 L13.326,6.908 L13.409,6.946 L13.490,6.987 L13.568,7.034 L13.645,7.086 L13.722,7.142 L13.798,7.203 L13.875,7.268 L13.953,7.338 L14.033,7.412 L14.116,7.491 L14.202,7.575 L14.292,7.663 L14.380,7.765 L14.457,7.857 L14.524,7.939 L14.583,8.013 L14.636,8.081 L14.683,8.145 L14.727,8.207 L14.770,8.268 L14.812,8.331 L14.855,8.397 L14.902,8.468 L14.953,8.545 L14.995,8.609 L15.036,8.674 L15.077,8.739 L15.116,8.804 L15.155,8.871 L15.192,8.938 L15.228,9.006 L15.262,9.075 L15.295,9.145 L15.326,9.217 L15.356,9.290 L15.383,9.364 L15.396,9.410 L15.403,9.455 L15.404,9.498 L15.398,9.539 L15.387,9.579 L15.370,9.616 L15.347,9.652 L15.317,9.686 L15.282,9.718 L15.241,9.747 L15.194,9.774 L15.142,9.799 Z",
		"M24.371,3.507 L24.324,3.465 L24.277,3.437 L24.231,3.422 L24.185,3.417 L24.140,3.421 L24.094,3.431 L24.050,3.448 L24.005,3.468 L23.961,3.489 L23.917,3.511 L23.873,3.532 L23.829,3.549 L23.815,3.554 L23.800,3.559 L23.786,3.565 L23.771,3.571 L23.757,3.578 L23.743,3.584 L23.729,3.591 L23.715,3.599 L23.701,3.606 L23.688,3.613 L23.674,3.620 L23.660,3.627 L23.543,3.684 L23.425,3.733 L23.307,3.776 L23.188,3.810 L23.068,3.837 L22.948,3.855 L22.827,3.863 L22.705,3.861 L22.582,3.849 L22.459,3.825 L22.334,3.790 L22.209,3.742 L22.025,3.670 L21.841,3.611 L21.657,3.566 L21.473,3.534 L21.289,3.517 L21.104,3.513 L20.918,3.524 L20.730,3.549 L20.542,3.589 L20.352,3.644 L20.161,3.713 L19.968,3.798 L19.994,3.613 L20.005,3.436 L20.001,3.266 L19.981,3.102 L19.948,2.944 L19.899,2.792 L19.830,2.641 L19.736,2.490 L19.616,2.340 L19.467,2.190 L19.287,2.041 L19.075,1.897 L18.953,1.823 L18.827,1.751 L18.699,1.679 L18.569,1.608 L18.439,1.537 L18.309,1.465 L18.181,1.393 L18.055,1.320 L17.934,1.245 L17.818,1.167 L17.708,1.086 L17.605,1.000 L17.541,0.937 L17.484,0.875 L17.434,0.812 L17.391,0.749 L17.352,0.686 L17.318,0.622 L17.286,0.559 L17.257,0.495 L17.229,0.431 L17.200,0.366 L17.170,0.302 L17.139,0.238 L17.117,0.200 L17.094,0.162 L17.070,0.125 L17.043,0.089 L17.012,0.055 L16.977,0.023 L16.936,-0.006 L16.889,-0.032 L16.836,-0.053 L16.775,-0.070 L16.706,-0.082 L16.628,-0.089 L16.544,-0.088 L16.468,-0.081 L16.401,-0.067 L16.340,-0.048 L16.286,-0.023 L16.238,0.005 L16.194,0.036 L16.154,0.070 L16.117,0.106 L16.083,0.143 L16.051,0.180 L16.019,0.216 L15.904,0.365 L15.805,0.515 L15.722,0.665 L15.652,0.816 L15.594,0.968 L15.546,1.120 L15.509,1.272 L15.480,1.425 L15.459,1.578 L15.446,1.732 L15.439,1.885 L15.439,2.039 L15.459,2.378 L15.505,2.703 L15.580,3.014 L15.683,3.308 L15.817,3.585 L15.980,3.845 L16.173,4.090 L16.389,4.325 L16.624,4.555 L16.872,4.785 L17.130,5.017 L17.398,5.251 L17.427,5.277 L17.451,5.304 L17.470,5.330 L17.485,5.356 L17.495,5.382 L17.501,5.409 L17.503,5.436 L17.500,5.463 L17.494,5.492 L17.484,5.521 L17.470,5.552 L17.453,5.583 L17.416,5.651 L17.379,5.718 L17.344,5.786 L17.309,5.854 L17.276,5.922 L17.243,5.990 L17.212,6.059 L17.182,6.128 L17.153,6.198 L17.125,6.268 L17.099,6.338 L17.074,6.408 L17.058,6.450 L17.041,6.487 L17.023,6.517 L17.004,6.542 L16.982,6.561 L16.958,6.575 L16.932,6.584 L16.903,6.587 L16.870,6.585 L16.834,6.577 L16.795,6.565 L16.751,6.548 L16.595,6.476 L16.442,6.399 L16.292,6.319 L16.146,6.236 L16.002,6.150 L15.861,6.060 L15.722,5.967 L15.586,5.871 L15.453,5.770 L15.323,5.663 L15.197,5.550 L15.074,5.433 L14.869,5.231 L14.666,5.027 L14.465,4.822 L14.264,4.616 L14.063,4.410 L13.861,4.206 L13.656,4.003 L13.448,3.804 L13.237,3.610 L13.020,3.420 L12.797,3.236 L12.568,3.060 L12.513,3.020 L12.458,2.980 L12.404,2.941 L12.349,2.902 L12.294,2.864 L12.239,2.826 L12.183,2.788 L12.128,2.751 L12.072,2.714 L12.016,2.677 L11.960,2.641 L11.903,2.605 L11.706,2.378 L11.584,2.160 L11.526,1.951 L11.522,1.755 L11.564,1.573 L11.640,1.407 L11.742,1.257 L11.858,1.127 L11.980,1.018 L12.097,0.932 L12.199,0.869 L12.277,0.833 L12.333,0.805 L12.370,0.770 L12.388,0.728 L12.385,0.683 L12.361,0.637 L12.315,0.590 L12.246,0.545 L12.153,0.505 L12.035,0.470 L11.892,0.443 L11.722,0.426 L11.526,0.420 L11.317,0.427 L11.110,0.444 L10.904,0.472 L10.698,0.510 L10.491,0.556 L10.282,0.611 L10.070,0.674 L9.854,0.744 L9.634,0.820 L9.407,0.902 L9.174,0.989 L8.933,1.081 L8.897,1.095 L8.860,1.108 L8.824,1.121 L8.787,1.133 L8.750,1.144 L8.712,1.155 L8.675,1.166 L8.637,1.176 L8.599,1.186 L8.561,1.195 L8.522,1.204 L8.484,1.213 L8.260,1.173 L8.036,1.139 L7.809,1.111 L7.582,1.088 L7.352,1.071 L7.121,1.060 L6.889,1.054 L6.655,1.054 L6.419,1.061 L6.182,1.073 L5.943,1.091 L5.702,1.115 L5.255,1.179 L4.823,1.271 L4.407,1.390 L4.006,1.535 L3.620,1.707 L3.251,1.906 L2.896,2.131 L2.558,2.382 L2.235,2.659 L1.928,2.963 L1.637,3.291 L1.362,3.646 L1.062,4.092 L0.801,4.547 L0.579,5.012 L0.395,5.485 L0.247,5.966 L0.135,6.454 L0.057,6.949 L0.012,7.450 L0.000,7.957 L0.019,8.469 L0.068,8.986 L0.147,9.506 L0.259,10.050 L0.402,10.577 L0.574,11.088 L0.776,11.583 L1.006,12.062 L1.265,12.526 L1.552,12.972 L1.866,13.403 L2.208,13.817 L2.575,14.215 L2.969,14.597 L3.389,14.962 L3.843,15.316 L4.308,15.638 L4.784,15.928 L5.273,16.185 L5.772,16.410 L6.284,16.601 L6.807,16.758 L7.342,16.882 L7.889,16.971 L8.448,17.025 L9.019,17.043 L9.601,17.027 L9.962,17.003 L10.330,16.971 L10.705,16.925 L11.087,16.863 L11.477,16.778 L11.874,16.669 L12.279,16.529 L12.691,16.355 L13.111,16.142 L13.540,15.887 L13.976,15.585 L14.421,15.232 L14.535,15.286 L14.651,15.334 L14.770,15.378 L14.892,15.417 L15.020,15.452 L15.154,15.483 L15.294,15.511 L15.443,15.536 L15.601,15.558 L15.769,15.579 L15.947,15.598 L16.138,15.615 L16.289,15.626 L16.439,15.632 L16.588,15.633 L16.734,15.629 L16.878,15.621 L17.019,15.610 L17.157,15.595 L17.291,15.578 L17.421,15.558 L17.547,15.537 L17.668,15.514 L17.784,15.491 L17.945,15.444 L18.078,15.379 L18.182,15.300 L18.261,15.211 L18.315,15.115 L18.348,15.016 L18.360,14.918 L18.355,14.824 L18.332,14.738 L18.296,14.664 L18.247,14.604 L18.188,14.564 L17.719,14.349 L17.343,14.183 L17.050,14.060 L16.827,13.972 L16.663,13.912 L16.544,13.873 L16.461,13.848 L16.400,13.828 L16.351,13.808 L16.300,13.780 L16.237,13.736 L16.150,13.670 L16.424,13.337 L16.717,12.965 L17.020,12.553 L17.330,12.102 L17.640,11.613 L17.943,11.087 L18.235,10.524 L18.510,9.924 L18.762,9.288 L18.984,8.617 L19.171,7.912 L19.316,7.178 L19.327,7.097 L19.338,7.015 L19.350,6.932 L19.362,6.849 L19.375,6.767 L19.389,6.687 L19.403,6.611 L19.417,6.538 L19.432,6.469 L19.445,6.405 L19.458,6.346 L19.468,6.293 L19.475,6.265 L19.483,6.239 L19.493,6.217 L19.506,6.198 L19.521,6.182 L19.540,6.169 L19.562,6.159 L19.588,6.152 L19.618,6.147 L19.652,6.145 L19.692,6.146 L19.736,6.149 L19.869,6.158 L20.001,6.165 L20.133,6.171 L20.265,6.176 L20.397,6.179 L20.529,6.182 L20.661,6.183 L20.793,6.184 L20.924,6.184 L21.056,6.184 L21.188,6.183 L21.319,6.182 L21.688,6.178 L22.035,6.169 L22.360,6.143 L22.666,6.084 L22.950,5.970 L23.210,5.778 L23.450,5.551 L23.671,5.303 L23.877,5.035 L24.066,4.747 L24.240,4.442 L24.401,4.121 L24.423,4.070 L24.444,4.018 L24.461,3.966 L24.475,3.914 L24.484,3.862 L24.488,3.809 L24.487,3.757 L24.480,3.705 L24.465,3.654 L24.442,3.604 L24.411,3.555 L24.371,3.507 Z M11.175,14.474 L10.692,14.099 L10.251,13.767 L9.851,13.476 L9.488,13.224 L9.163,13.009 L8.872,12.829 L8.615,12.683 L8.390,12.568 L8.196,12.483 L8.030,12.426 L7.891,12.396 L7.778,12.390 L7.693,12.404 L7.625,12.433 L7.572,12.475 L7.533,12.528 L7.507,12.591 L7.492,12.661 L7.487,12.736 L7.490,12.815 L7.499,12.895 L7.514,12.975 L7.532,13.053 L7.552,13.126 L7.574,13.194 L7.598,13.258 L7.622,13.320 L7.648,13.380 L7.676,13.439 L7.704,13.496 L7.734,13.552 L7.766,13.608 L7.800,13.664 L7.835,13.721 L7.872,13.780 L7.910,13.840 L7.937,13.882 L7.961,13.926 L7.981,13.973 L7.996,14.022 L8.005,14.072 L8.007,14.123 L8.001,14.175 L7.984,14.226 L7.958,14.277 L7.919,14.327 L7.867,14.375 L7.801,14.422 L7.629,14.503 L7.444,14.551 L7.248,14.569 L7.050,14.564 L6.852,14.540 L6.662,14.501 L6.484,14.454 L6.324,14.403 L6.187,14.353 L6.079,14.309 L6.005,14.277 L5.970,14.260 L5.646,14.061 L5.332,13.852 L5.027,13.632 L4.733,13.399 L4.448,13.155 L4.175,12.898 L3.913,12.628 L3.663,12.345 L3.424,12.048 L3.198,11.737 L2.985,11.410 L2.785,11.069 L2.604,10.731 L2.437,10.389 L2.284,10.043 L2.143,9.692 L2.017,9.338 L1.905,8.980 L1.806,8.617 L1.722,8.251 L1.652,7.880 L1.597,7.505 L1.557,7.127 L1.532,6.744 L1.530,6.656 L1.533,6.577 L1.544,6.507 L1.560,6.446 L1.584,6.392 L1.616,6.345 L1.656,6.304 L1.704,6.269 L1.761,6.239 L1.828,6.213 L1.905,6.192 L1.992,6.173 L2.114,6.152 L2.237,6.134 L2.360,6.119 L2.483,6.108 L2.607,6.099 L2.730,6.094 L2.854,6.092 L2.977,6.094 L3.100,6.099 L3.223,6.108 L3.346,6.120 L3.468,6.136 L3.976,6.224 L4.471,6.337 L4.953,6.476 L5.424,6.640 L5.881,6.828 L6.327,7.041 L6.760,7.277 L7.181,7.538 L7.589,7.822 L7.986,8.130 L8.371,8.460 L8.744,8.813 L8.949,9.024 L9.147,9.240 L9.338,9.463 L9.522,9.690 L9.701,9.921 L9.876,10.156 L10.046,10.393 L10.214,10.633 L10.379,10.875 L10.543,11.117 L10.706,11.360 L10.869,11.602 L11.044,11.859 L11.221,12.112 L11.402,12.363 L11.587,12.610 L11.775,12.854 L11.969,13.093 L12.168,13.327 L12.373,13.557 L12.584,13.781 L12.803,13.999 L13.028,14.210 L13.262,14.415 L13.345,14.484 L13.425,14.550 L13.502,14.613 L13.577,14.674 L13.651,14.732 L13.722,14.788 L13.792,14.841 L13.860,14.891 L13.927,14.939 L13.993,14.984 L14.058,15.027 L14.123,15.068 L13.919,15.088 L13.697,15.103 L13.460,15.110 L13.211,15.108 L12.953,15.094 L12.690,15.066 L12.424,15.021 L12.160,14.958 L11.899,14.874 L11.646,14.767 L11.404,14.635 L11.175,14.475 L11.175,14.474 Z M12.141,8.260 L12.144,8.219 L12.152,8.181 L12.164,8.144 L12.181,8.110 L12.203,8.078 L12.228,8.050 L12.256,8.025 L12.288,8.004 L12.322,7.987 L12.359,7.974 L12.398,7.966 L12.439,7.963 L12.448,7.964 L12.457,7.964 L12.466,7.965 L12.475,7.966 L12.484,7.967 L12.493,7.969 L12.501,7.970 L12.509,7.972 L12.517,7.974 L12.525,7.977 L12.533,7.979 L12.541,7.982 L12.551,7.986 L12.561,7.990 L12.571,7.995 L12.581,8.000 L12.591,8.005 L12.600,8.011 L12.609,8.017 L12.618,8.023 L12.627,8.030 L12.635,8.037 L12.643,8.045 L12.650,8.053 L12.663,8.067 L12.675,8.081 L12.686,8.097 L12.696,8.113 L12.704,8.129 L12.712,8.147 L12.718,8.165 L12.724,8.183 L12.728,8.202 L12.731,8.221 L12.733,8.240 L12.733,8.260 L12.731,8.300 L12.723,8.339 L12.710,8.376 L12.693,8.410 L12.672,8.442 L12.647,8.470 L12.618,8.495 L12.587,8.516 L12.552,8.533 L12.515,8.546 L12.476,8.554 L12.435,8.556 L12.395,8.554 L12.356,8.546 L12.319,8.533 L12.285,8.516 L12.254,8.495 L12.226,8.470 L12.201,8.442 L12.180,8.410 L12.164,8.376 L12.151,8.339 L12.144,8.300 L12.141,8.260 Z M15.142,9.799 L15.093,9.818 L15.045,9.837 L14.997,9.855 L14.949,9.872 L14.901,9.888 L14.854,9.903 L14.806,9.916 L14.759,9.927 L14.712,9.937 L14.665,9.944 L14.618,9.950 L14.572,9.953 L14.499,9.954 L14.427,9.950 L14.354,9.941 L14.282,9.928 L14.211,9.911 L14.143,9.890 L14.076,9.866 L14.013,9.839 L13.953,9.809 L13.898,9.778 L13.847,9.744 L13.802,9.709 L13.737,9.655 L13.676,9.605 L13.618,9.555 L13.564,9.507 L13.513,9.457 L13.466,9.405 L13.423,9.349 L13.384,9.289 L13.349,9.223 L13.318,9.150 L13.292,9.068 L13.270,8.977 L13.262,8.934 L13.257,8.888 L13.253,8.839 L13.252,8.789 L13.252,8.738 L13.253,8.686 L13.256,8.635 L13.260,8.585 L13.265,8.537 L13.271,8.491 L13.277,8.449 L13.284,8.410 L13.299,8.333 L13.307,8.261 L13.309,8.193 L13.305,8.129 L13.295,8.068 L13.278,8.010 L13.256,7.954 L13.228,7.902 L13.194,7.851 L13.154,7.802 L13.107,7.754 L13.055,7.708 L13.008,7.673 L12.960,7.642 L12.910,7.615 L12.858,7.592 L12.804,7.572 L12.749,7.556 L12.693,7.543 L12.634,7.533 L12.575,7.525 L12.515,7.520 L12.453,7.517 L12.390,7.516 L12.367,7.516 L12.343,7.513 L12.321,7.509 L12.299,7.504 L12.277,7.498 L12.256,7.491 L12.236,7.484 L12.216,7.476 L12.197,7.467 L12.179,7.459 L12.161,7.450 L12.145,7.441 L12.119,7.427 L12.094,7.409 L12.071,7.388 L12.051,7.364 L12.033,7.338 L12.019,7.309 L12.009,7.279 L12.003,7.246 L12.002,7.211 L12.007,7.174 L12.018,7.136 L12.035,7.096 L12.044,7.081 L12.056,7.064 L12.071,7.045 L12.088,7.025 L12.107,7.004 L12.126,6.983 L12.146,6.963 L12.165,6.944 L12.182,6.927 L12.198,6.913 L12.211,6.901 L12.220,6.893 L12.307,6.850 L12.396,6.816 L12.486,6.793 L12.578,6.778 L12.671,6.771 L12.764,6.773 L12.858,6.781 L12.953,6.796 L13.047,6.817 L13.141,6.843 L13.234,6.874 L13.326,6.908 L13.409,6.946 L13.490,6.987 L13.568,7.034 L13.645,7.086 L13.722,7.142 L13.798,7.203 L13.875,7.268 L13.953,7.338 L14.033,7.412 L14.116,7.491 L14.202,7.575 L14.292,7.663 L14.380,7.765 L14.457,7.857 L14.524,7.939 L14.583,8.013 L14.636,8.081 L14.683,8.145 L14.727,8.207 L14.770,8.268 L14.812,8.331 L14.855,8.397 L14.902,8.468 L14.953,8.545 L14.995,8.609 L15.036,8.674 L15.077,8.739 L15.116,8.804 L15.155,8.871 L15.192,8.938 L15.228,9.006 L15.262,9.075 L15.295,9.145 L15.326,9.217 L15.356,9.290 L15.383,9.364 L15.396,9.410 L15.403,9.455 L15.404,9.498 L15.398,9.539 L15.387,9.579 L15.370,9.616 L15.347,9.652 L15.317,9.686 L15.282,9.718 L15.241,9.747 L15.194,9.774 L15.142,9.799 Z",
		"M21.837,0.540 L21.775,0.529 L21.721,0.529 L21.673,0.540 L21.631,0.559 L21.594,0.586 L21.561,0.618 L21.531,0.655 L21.503,0.695 L21.477,0.737 L21.450,0.778 L21.423,0.818 L21.395,0.856 L21.385,0.867 L21.375,0.879 L21.366,0.892 L21.356,0.904 L21.348,0.917 L21.339,0.930 L21.331,0.944 L21.322,0.957 L21.314,0.970 L21.306,0.983 L21.298,0.997 L21.290,1.010 L21.219,1.118 L21.143,1.222 L21.064,1.319 L20.980,1.410 L20.891,1.494 L20.797,1.571 L20.697,1.641 L20.592,1.702 L20.480,1.755 L20.362,1.798 L20.237,1.832 L20.105,1.856 L19.910,1.889 L19.722,1.933 L19.542,1.989 L19.368,2.057 L19.200,2.137 L19.040,2.229 L18.886,2.334 L18.739,2.452 L18.598,2.583 L18.463,2.728 L18.335,2.886 L18.213,3.058 L18.140,2.886 L18.058,2.728 L17.967,2.585 L17.866,2.454 L17.756,2.336 L17.638,2.231 L17.516,2.136 L17.392,2.052 L17.267,1.977 L17.143,1.909 L17.020,1.848 L16.900,1.791 L16.839,1.762 L16.779,1.731 L16.722,1.697 L16.667,1.661 L16.613,1.620 L16.562,1.576 L16.512,1.527 L16.464,1.472 L16.418,1.412 L16.375,1.346 L16.333,1.273 L16.294,1.193 L16.269,1.132 L16.246,1.071 L16.225,1.009 L16.207,0.946 L16.190,0.883 L16.174,0.819 L16.159,0.755 L16.145,0.690 L16.132,0.625 L16.118,0.560 L16.105,0.495 L16.091,0.429 L16.082,0.390 L16.073,0.351 L16.064,0.312 L16.054,0.275 L16.044,0.239 L16.032,0.205 L16.020,0.174 L16.006,0.145 L15.990,0.120 L15.973,0.098 L15.953,0.081 L15.930,0.067 L15.906,0.060 L15.883,0.059 L15.862,0.066 L15.843,0.078 L15.825,0.096 L15.809,0.119 L15.794,0.145 L15.781,0.174 L15.767,0.204 L15.755,0.237 L15.743,0.270 L15.731,0.302 L15.683,0.435 L15.637,0.571 L15.595,0.710 L15.556,0.852 L15.522,0.996 L15.492,1.142 L15.467,1.290 L15.447,1.440 L15.432,1.591 L15.422,1.743 L15.417,1.896 L15.418,2.050 L15.435,2.391 L15.474,2.722 L15.534,3.042 L15.614,3.352 L15.715,3.653 L15.835,3.944 L15.977,4.226 L16.143,4.493 L16.336,4.744 L16.559,4.975 L16.812,5.185 L17.095,5.371 L17.127,5.392 L17.155,5.412 L17.180,5.433 L17.202,5.454 L17.220,5.477 L17.234,5.500 L17.246,5.524 L17.254,5.549 L17.259,5.576 L17.261,5.604 L17.260,5.634 L17.255,5.666 L17.244,5.732 L17.232,5.798 L17.219,5.863 L17.204,5.929 L17.189,5.994 L17.173,6.059 L17.156,6.124 L17.138,6.189 L17.120,6.254 L17.101,6.319 L17.083,6.385 L17.064,6.450 L17.051,6.490 L17.037,6.524 L17.020,6.552 L17.002,6.576 L16.981,6.594 L16.958,6.607 L16.932,6.615 L16.903,6.618 L16.870,6.617 L16.834,6.610 L16.794,6.599 L16.750,6.583 L16.591,6.515 L16.436,6.442 L16.285,6.363 L16.137,6.278 L15.993,6.187 L15.852,6.092 L15.715,5.991 L15.582,5.886 L15.451,5.776 L15.323,5.664 L15.197,5.550 L15.074,5.433 L14.869,5.231 L14.666,5.027 L14.465,4.822 L14.264,4.616 L14.063,4.410 L13.861,4.206 L13.656,4.003 L13.448,3.804 L13.237,3.610 L13.020,3.420 L12.797,3.236 L12.568,3.060 L12.513,3.020 L12.458,2.980 L12.404,2.941 L12.349,2.902 L12.294,2.864 L12.239,2.826 L12.183,2.788 L12.128,2.751 L12.072,2.714 L12.016,2.677 L11.960,2.641 L11.903,2.605 L11.706,2.378 L11.584,2.160 L11.526,1.951 L11.522,1.755 L11.564,1.573 L11.640,1.407 L11.742,1.257 L11.858,1.127 L11.980,1.018 L12.097,0.932 L12.199,0.869 L12.277,0.833 L12.333,0.805 L12.370,0.770 L12.388,0.728 L12.385,0.683 L12.361,0.637 L12.315,0.590 L12.246,0.545 L12.153,0.505 L12.035,0.470 L11.892,0.443 L11.722,0.426 L11.526,0.420 L11.317,0.427 L11.110,0.444 L10.904,0.472 L10.698,0.510 L10.491,0.556 L10.282,0.611 L10.070,0.674 L9.854,0.744 L9.634,0.820 L9.407,0.902 L9.174,0.989 L8.933,1.081 L8.897,1.095 L8.860,1.108 L8.824,1.121 L8.787,1.133 L8.750,1.144 L8.712,1.155 L8.675,1.166 L8.637,1.176 L8.599,1.186 L8.561,1.195 L8.522,1.204 L8.484,1.213 L8.260,1.173 L8.036,1.139 L7.809,1.111 L7.582,1.088 L7.352,1.071 L7.121,1.060 L6.889,1.054 L6.655,1.054 L6.419,1.061 L6.182,1.073 L5.943,1.091 L5.702,1.115 L5.255,1.179 L4.823,1.271 L4.407,1.390 L4.006,1.535 L3.620,1.707 L3.251,1.906 L2.896,2.131 L2.558,2.382 L2.235,2.659 L1.928,2.963 L1.637,3.291 L1.362,3.646 L1.062,4.092 L0.801,4.547 L0.579,5.012 L0.395,5.485 L0.247,5.966 L0.135,6.454 L0.057,6.949 L0.012,7.450 L0.000,7.957 L0.019,8.469 L0.068,8.986 L0.147,9.506 L0.259,10.050 L0.402,10.577 L0.574,11.088 L0.776,11.583 L1.006,12.062 L1.265,12.526 L1.552,12.972 L1.866,13.403 L2.208,13.817 L2.575,14.215 L2.969,14.597 L3.389,14.962 L3.843,15.316 L4.308,15.638 L4.784,15.928 L5.273,16.185 L5.772,16.410 L6.284,16.601 L6.807,16.758 L7.342,16.882 L7.889,16.971 L8.448,17.025 L9.019,17.043 L9.601,17.027 L9.962,17.003 L10.330,16.971 L10.705,16.925 L11.087,16.863 L11.477,16.778 L11.874,16.669 L12.279,16.529 L12.691,16.355 L13.111,16.142 L13.540,15.887 L13.976,15.585 L14.421,15.232 L14.535,15.286 L14.651,15.334 L14.770,15.378 L14.892,15.417 L15.020,15.452 L15.154,15.483 L15.294,15.511 L15.443,15.536 L15.601,15.558 L15.769,15.579 L15.947,15.598 L16.138,15.615 L16.289,15.626 L16.439,15.632 L16.588,15.633 L16.734,15.629 L16.878,15.621 L17.019,15.610 L17.157,15.595 L17.291,15.578 L17.421,15.558 L17.547,15.537 L17.668,15.514 L17.784,15.491 L17.945,15.444 L18.078,15.379 L18.182,15.300 L18.261,15.211 L18.315,15.115 L18.348,15.016 L18.360,14.918 L18.355,14.824 L18.332,14.738 L18.296,14.664 L18.247,14.604 L18.188,14.564 L17.719,14.349 L17.343,14.183 L17.050,14.060 L16.827,13.972 L16.663,13.912 L16.544,13.873 L16.461,13.848 L16.400,13.828 L16.351,13.808 L16.300,13.780 L16.237,13.736 L16.150,13.670 L16.424,13.337 L16.717,12.965 L17.020,12.553 L17.330,12.102 L17.640,11.613 L17.943,11.087 L18.235,10.524 L18.510,9.924 L18.762,9.288 L18.984,8.617 L19.171,7.912 L19.319,7.169 L19.333,7.080 L19.346,6.985 L19.359,6.885 L19.372,6.781 L19.382,6.676 L19.391,6.569 L19.398,6.463 L19.402,6.359 L19.403,6.258 L19.401,6.162 L19.395,6.073 L19.387,5.992 L19.383,5.948 L19.380,5.908 L19.381,5.872 L19.384,5.840 L19.392,5.811 L19.403,5.786 L19.418,5.764 L19.439,5.745 L19.464,5.728 L19.495,5.714 L19.532,5.702 L19.575,5.692 L19.702,5.661 L19.827,5.626 L19.950,5.586 L20.072,5.542 L20.192,5.492 L20.310,5.437 L20.426,5.376 L20.538,5.309 L20.649,5.236 L20.756,5.157 L20.860,5.072 L20.960,4.980 L21.224,4.693 L21.445,4.383 L21.627,4.058 L21.775,3.726 L21.899,3.399 L22.012,3.085 L22.100,2.767 L22.163,2.440 L22.200,2.105 L22.215,1.761 L22.207,1.410 L22.179,1.051 L22.172,0.996 L22.163,0.942 L22.151,0.888 L22.136,0.836 L22.117,0.786 L22.094,0.739 L22.066,0.695 L22.032,0.655 L21.993,0.618 L21.948,0.587 L21.896,0.561 L21.837,0.540 Z M11.175,14.474 L10.692,14.099 L10.251,13.767 L9.851,13.476 L9.488,13.224 L9.163,13.009 L8.872,12.829 L8.615,12.683 L8.390,12.568 L8.196,12.483 L8.030,12.426 L7.891,12.396 L7.778,12.390 L7.693,12.404 L7.625,12.433 L7.572,12.475 L7.533,12.528 L7.507,12.591 L7.492,12.661 L7.487,12.736 L7.490,12.815 L7.499,12.895 L7.514,12.975 L7.532,13.053 L7.552,13.126 L7.574,13.194 L7.598,13.258 L7.622,13.320 L7.648,13.380 L7.676,13.439 L7.704,13.496 L7.734,13.552 L7.766,13.608 L7.800,13.664 L7.835,13.721 L7.872,13.780 L7.910,13.840 L7.937,13.882 L7.961,13.926 L7.981,13.973 L7.996,14.022 L8.005,14.072 L8.007,14.123 L8.001,14.175 L7.984,14.226 L7.958,14.277 L7.919,14.327 L7.867,14.375 L7.801,14.422 L7.629,14.503 L7.444,14.551 L7.248,14.569 L7.050,14.564 L6.852,14.540 L6.662,14.501 L6.484,14.454 L6.324,14.403 L6.187,14.353 L6.079,14.309 L6.005,14.277 L5.970,14.260 L5.646,14.061 L5.332,13.852 L5.027,13.632 L4.733,13.399 L4.448,13.155 L4.175,12.898 L3.913,12.628 L3.663,12.345 L3.424,12.048 L3.198,11.737 L2.985,11.410 L2.785,11.069 L2.604,10.731 L2.437,10.389 L2.284,10.043 L2.143,9.692 L2.017,9.338 L1.905,8.980 L1.806,8.617 L1.722,8.251 L1.652,7.880 L1.597,7.505 L1.557,7.127 L1.532,6.744 L1.530,6.656 L1.533,6.577 L1.544,6.507 L1.560,6.446 L1.584,6.392 L1.616,6.345 L1.656,6.304 L1.704,6.269 L1.761,6.239 L1.828,6.213 L1.905,6.192 L1.992,6.173 L2.114,6.152 L2.237,6.134 L2.360,6.119 L2.483,6.108 L2.607,6.099 L2.730,6.094 L2.854,6.092 L2.977,6.094 L3.100,6.099 L3.223,6.108 L3.346,6.120 L3.468,6.136 L3.976,6.224 L4.471,6.337 L4.953,6.476 L5.424,6.640 L5.881,6.828 L6.327,7.041 L6.760,7.277 L7.181,7.538 L7.589,7.822 L7.986,8.130 L8.371,8.460 L8.744,8.813 L8.949,9.024 L9.147,9.240 L9.338,9.463 L9.522,9.690 L9.701,9.921 L9.876,10.156 L10.046,10.393 L10.214,10.633 L10.379,10.875 L10.543,11.117 L10.706,11.360 L10.869,11.602 L11.044,11.859 L11.221,12.112 L11.402,12.363 L11.587,12.610 L11.775,12.854 L11.969,13.093 L12.168,13.327 L12.373,13.557 L12.584,13.781 L12.803,13.999 L13.028,14.210 L13.262,14.415 L13.345,14.484 L13.425,14.550 L13.502,14.613 L13.577,14.674 L13.651,14.732 L13.722,14.788 L13.792,14.841 L13.860,14.891 L13.927,14.939 L13.993,14.984 L14.058,15.027 L14.123,15.068 L13.919,15.088 L13.697,15.103 L13.460,15.110 L13.211,15.108 L12.953,15.094 L12.690,15.066 L12.424,15.021 L12.160,14.958 L11.899,14.874 L11.646,14.767 L11.404,14.635 L11.175,14.475 L11.175,14.474 Z M12.141,8.260 L12.144,8.219 L12.152,8.181 L12.164,8.144 L12.181,8.110 L12.203,8.078 L12.228,8.050 L12.256,8.025 L12.288,8.004 L12.322,7.987 L12.359,7.974 L12.398,7.966 L12.439,7.963 L12.448,7.964 L12.457,7.964 L12.466,7.965 L12.475,7.966 L12.484,7.967 L12.493,7.969 L12.501,7.970 L12.509,7.972 L12.517,7.974 L12.525,7.977 L12.533,7.979 L12.541,7.982 L12.551,7.986 L12.561,7.990 L12.571,7.995 L12.581,8.000 L12.591,8.005 L12.600,8.011 L12.609,8.017 L12.618,8.023 L12.627,8.030 L12.635,8.037 L12.643,8.045 L12.650,8.053 L12.663,8.067 L12.675,8.081 L12.686,8.097 L12.696,8.113 L12.704,8.129 L12.712,8.147 L12.718,8.165 L12.724,8.183 L12.728,8.202 L12.731,8.221 L12.733,8.240 L12.733,8.260 L12.731,8.300 L12.723,8.339 L12.710,8.376 L12.693,8.410 L12.672,8.442 L12.647,8.470 L12.618,8.495 L12.587,8.516 L12.552,8.533 L12.515,8.546 L12.476,8.554 L12.435,8.556 L12.395,8.554 L12.356,8.546 L12.319,8.533 L12.285,8.516 L12.254,8.495 L12.226,8.470 L12.201,8.442 L12.180,8.410 L12.164,8.376 L12.151,8.339 L12.144,8.300 L12.141,8.260 Z M15.142,9.799 L15.093,9.818 L15.045,9.837 L14.997,9.855 L14.949,9.872 L14.901,9.888 L14.854,9.903 L14.806,9.916 L14.759,9.927 L14.712,9.937 L14.665,9.944 L14.618,9.950 L14.572,9.953 L14.499,9.954 L14.427,9.950 L14.354,9.941 L14.282,9.928 L14.211,9.911 L14.143,9.890 L14.076,9.866 L14.013,9.839 L13.953,9.809 L13.898,9.778 L13.847,9.744 L13.802,9.709 L13.737,9.655 L13.676,9.605 L13.618,9.555 L13.564,9.507 L13.513,9.457 L13.466,9.405 L13.423,9.349 L13.384,9.289 L13.349,9.223 L13.318,9.150 L13.292,9.068 L13.270,8.977 L13.262,8.934 L13.257,8.888 L13.253,8.839 L13.252,8.789 L13.252,8.738 L13.253,8.686 L13.256,8.635 L13.260,8.585 L13.265,8.537 L13.271,8.491 L13.277,8.449 L13.284,8.410 L13.299,8.333 L13.307,8.261 L13.309,8.193 L13.305,8.129 L13.295,8.068 L13.278,8.010 L13.256,7.954 L13.228,7.902 L13.194,7.851 L13.154,7.802 L13.107,7.754 L13.055,7.708 L13.008,7.673 L12.960,7.642 L12.910,7.615 L12.858,7.592 L12.804,7.572 L12.749,7.556 L12.693,7.543 L12.634,7.533 L12.575,7.525 L12.515,7.520 L12.453,7.517 L12.390,7.516 L12.367,7.516 L12.343,7.513 L12.321,7.509 L12.299,7.504 L12.277,7.498 L12.256,7.491 L12.236,7.484 L12.216,7.476 L12.197,7.467 L12.179,7.459 L12.161,7.450 L12.145,7.441 L12.119,7.427 L12.094,7.409 L12.071,7.388 L12.051,7.364 L12.033,7.338 L12.019,7.309 L12.009,7.279 L12.003,7.246 L12.002,7.211 L12.007,7.174 L12.018,7.136 L12.035,7.096 L12.044,7.081 L12.056,7.064 L12.071,7.045 L12.088,7.025 L12.107,7.004 L12.126,6.983 L12.146,6.963 L12.165,6.944 L12.182,6.927 L12.198,6.913 L12.211,6.901 L12.220,6.893 L12.307,6.850 L12.396,6.816 L12.486,6.793 L12.578,6.778 L12.671,6.771 L12.764,6.773 L12.858,6.781 L12.953,6.796 L13.047,6.817 L13.141,6.843 L13.234,6.874 L13.326,6.908 L13.409,6.946 L13.490,6.987 L13.568,7.034 L13.645,7.086 L13.722,7.142 L13.798,7.203 L13.875,7.268 L13.953,7.338 L14.033,7.412 L14.116,7.491 L14.202,7.575 L14.292,7.663 L14.380,7.765 L14.457,7.857 L14.524,7.939 L14.583,8.013 L14.636,8.081 L14.683,8.145 L14.727,8.207 L14.770,8.268 L14.812,8.331 L14.855,8.397 L14.902,8.468 L14.953,8.545 L14.995,8.609 L15.036,8.674 L15.077,8.739 L15.116,8.804 L15.155,8.871 L15.192,8.938 L15.228,9.006 L15.262,9.075 L15.295,9.145 L15.326,9.217 L15.356,9.290 L15.383,9.364 L15.396,9.410 L15.403,9.455 L15.404,9.498 L15.398,9.539 L15.387,9.579 L15.370,9.616 L15.347,9.652 L15.317,9.686 L15.282,9.718 L15.241,9.747 L15.194,9.774 L15.142,9.799 Z",
		"M23.428,1.998 L23.372,1.969 L23.320,1.953 L23.272,1.950 L23.226,1.956 L23.183,1.970 L23.142,1.992 L23.102,2.019 L23.064,2.049 L23.026,2.080 L22.989,2.112 L22.951,2.143 L22.913,2.170 L22.900,2.178 L22.887,2.187 L22.874,2.196 L22.862,2.206 L22.850,2.215 L22.838,2.225 L22.826,2.236 L22.814,2.246 L22.802,2.256 L22.791,2.267 L22.779,2.277 L22.768,2.287 L22.668,2.370 L22.565,2.447 L22.461,2.516 L22.354,2.579 L22.244,2.634 L22.132,2.680 L22.016,2.717 L21.897,2.745 L21.775,2.762 L21.650,2.770 L21.520,2.765 L21.387,2.750 L21.191,2.724 L20.999,2.711 L20.809,2.712 L20.623,2.726 L20.440,2.754 L20.259,2.795 L20.081,2.850 L19.906,2.920 L19.733,3.004 L19.562,3.103 L19.393,3.217 L19.226,3.346 L19.207,3.160 L19.175,2.986 L19.129,2.822 L19.071,2.667 L19.000,2.522 L18.917,2.386 L18.820,2.258 L18.708,2.138 L18.580,2.024 L18.436,1.918 L18.276,1.819 L18.099,1.727 L18.002,1.681 L17.904,1.636 L17.806,1.589 L17.708,1.542 L17.611,1.493 L17.515,1.441 L17.422,1.387 L17.331,1.329 L17.244,1.267 L17.161,1.200 L17.082,1.127 L17.008,1.048 L16.961,0.989 L16.920,0.930 L16.883,0.869 L16.851,0.808 L16.822,0.746 L16.797,0.684 L16.773,0.621 L16.751,0.557 L16.729,0.494 L16.707,0.430 L16.685,0.367 L16.662,0.303 L16.646,0.265 L16.630,0.227 L16.612,0.190 L16.593,0.154 L16.571,0.120 L16.547,0.088 L16.519,0.059 L16.488,0.033 L16.451,0.011 L16.410,-0.006 L16.364,-0.019 L16.311,-0.027 L16.254,-0.029 L16.202,-0.024 L16.156,-0.012 L16.115,0.005 L16.077,0.027 L16.043,0.053 L16.013,0.082 L15.985,0.114 L15.959,0.148 L15.934,0.183 L15.911,0.218 L15.888,0.253 L15.804,0.396 L15.729,0.540 L15.664,0.685 L15.609,0.832 L15.561,0.980 L15.522,1.130 L15.490,1.280 L15.465,1.432 L15.447,1.584 L15.435,1.737 L15.429,1.890 L15.429,2.044 L15.448,2.384 L15.491,2.712 L15.559,3.026 L15.652,3.328 L15.770,3.615 L15.914,3.889 L16.083,4.149 L16.276,4.398 L16.491,4.635 L16.726,4.864 L16.982,5.084 L17.258,5.296 L17.288,5.320 L17.314,5.344 L17.336,5.368 L17.354,5.392 L17.368,5.417 L17.378,5.442 L17.384,5.468 L17.387,5.495 L17.386,5.523 L17.381,5.553 L17.373,5.583 L17.362,5.616 L17.337,5.683 L17.311,5.751 L17.286,5.818 L17.260,5.886 L17.235,5.953 L17.210,6.020 L17.186,6.088 L17.161,6.155 L17.137,6.223 L17.114,6.291 L17.091,6.359 L17.069,6.427 L17.055,6.468 L17.039,6.503 L17.022,6.533 L17.003,6.557 L16.982,6.576 L16.958,6.590 L16.932,6.598 L16.903,6.601 L16.870,6.599 L16.834,6.592 L16.794,6.580 L16.750,6.564 L16.593,6.493 L16.439,6.418 L16.289,6.339 L16.142,6.255 L15.998,6.167 L15.857,6.074 L15.719,5.978 L15.584,5.877 L15.452,5.773 L15.323,5.664 L15.197,5.550 L15.074,5.433 L14.869,5.231 L14.666,5.027 L14.465,4.822 L14.264,4.616 L14.063,4.410 L13.861,4.206 L13.656,4.003 L13.448,3.804 L13.237,3.610 L13.020,3.420 L12.797,3.236 L12.568,3.060 L12.513,3.020 L12.458,2.980 L12.404,2.941 L12.349,2.902 L12.294,2.864 L12.239,2.826 L12.183,2.788 L12.128,2.751 L12.072,2.714 L12.016,2.677 L11.960,2.641 L11.903,2.605 L11.706,2.378 L11.584,2.160 L11.526,1.951 L11.522,1.755 L11.564,1.573 L11.640,1.407 L11.742,1.257 L11.858,1.127 L11.980,1.018 L12.097,0.932 L12.199,0.869 L12.277,0.833 L12.333,0.805 L12.370,0.770 L12.388,0.728 L12.385,0.683 L12.361,0.637 L12.315,0.590 L12.246,0.545 L12.153,0.505 L12.035,0.470 L11.892,0.443 L11.722,0.426 L11.526,0.420 L11.317,0.427 L11.110,0.444 L10.904,0.472 L10.698,0.510 L10.491,0.556 L10.282,0.611 L10.070,0.674 L9.854,0.744 L9.634,0.820 L9.407,0.902 L9.174,0.989 L8.933,1.081 L8.897,1.095 L8.860,1.108 L8.824,1.121 L8.787,1.133 L8.750,1.144 L8.712,1.155 L8.675,1.166 L8.637,1.176 L8.599,1.186 L8.561,1.195 L8.522,1.204 L8.484,1.213 L8.260,1.173 L8.036,1.139 L7.809,1.111 L7.582,1.088 L7.352,1.071 L7.121,1.060 L6.889,1.054 L6.655,1.054 L6.419,1.061 L6.182,1.073 L5.943,1.091 L5.702,1.115 L5.255,1.179 L4.823,1.271 L4.407,1.390 L4.006,1.535 L3.620,1.707 L3.251,1.906 L2.896,2.131 L2.558,2.382 L2.235,2.659 L1.928,2.963 L1.637,3.291 L1.362,3.646 L1.062,4.092 L0.801,4.547 L0.579,5.012 L0.395,5.485 L0.247,5.966 L0.135,6.454 L0.057,6.949 L0.012,7.450 L0.000,7.957 L0.019,8.469 L0.068,8.986 L0.147,9.506 L0.259,10.050 L0.402,10.577 L0.574,11.088 L0.776,11.583 L1.006,12.062 L1.265,12.526 L1.552,12.972 L1.866,13.403 L2.208,13.817 L2.575,14.215 L2.969,14.597 L3.389,14.962 L3.843,15.316 L4.308,15.638 L4.784,15.928 L5.273,16.185 L5.772,16.410 L6.284,16.601 L6.807,16.758 L7.342,16.882 L7.889,16.971 L8.448,17.025 L9.019,17.043 L9.601,17.027 L9.962,17.003 L10.330,16.971 L10.705,16.925 L11.087,16.863 L11.477,16.778 L11.874,16.669 L12.279,16.529 L12.691,16.355 L13.111,16.142 L13.540,15.887 L13.976,15.585 L14.421,15.232 L14.535,15.286 L14.651,15.334 L14.770,15.378 L14.892,15.417 L15.020,15.452 L15.154,15.483 L15.294,15.511 L15.443,15.536 L15.601,15.558 L15.769,15.579 L15.947,15.598 L16.138,15.615 L16.289,15.626 L16.439,15.632 L16.588,15.633 L16.734,15.629 L16.878,15.621 L17.019,15.610 L17.157,15.595 L17.291,15.578 L17.421,15.558 L17.547,15.537 L17.668,15.514 L17.784,15.491 L17.945,15.444 L18.078,15.379 L18.182,15.300 L18.261,15.211 L18.315,15.115 L18.348,15.016 L18.360,14.918 L18.355,14.824 L18.332,14.738 L18.296,14.664 L18.247,14.604 L18.188,14.564 L17.719,14.349 L17.343,14.183 L17.050,14.060 L16.827,13.972 L16.663,13.912 L16.544,13.873 L16.461,13.848 L16.400,13.828 L16.351,13.808 L16.300,13.780 L16.237,13.736 L16.150,13.670 L16.424,13.337 L16.717,12.965 L17.020,12.553 L17.330,12.102 L17.640,11.613 L17.943,11.087 L18.235,10.524 L18.510,9.924 L18.762,9.288 L18.984,8.617 L19.171,7.912 L19.318,7.174 L19.330,7.090 L19.342,7.001 L19.354,6.911 L19.367,6.818 L19.379,6.726 L19.391,6.634 L19.402,6.544 L19.413,6.457 L19.422,6.373 L19.430,6.295 L19.435,6.222 L19.438,6.156 L19.441,6.119 L19.445,6.087 L19.451,6.058 L19.461,6.033 L19.473,6.011 L19.489,5.993 L19.508,5.977 L19.532,5.964 L19.561,5.954 L19.594,5.946 L19.633,5.941 L19.677,5.938 L19.808,5.929 L19.939,5.916 L20.069,5.901 L20.199,5.883 L20.328,5.862 L20.456,5.838 L20.583,5.810 L20.710,5.779 L20.836,5.746 L20.962,5.708 L21.086,5.668 L21.210,5.624 L21.552,5.485 L21.867,5.331 L22.155,5.158 L22.415,4.963 L22.648,4.740 L22.851,4.483 L23.029,4.205 L23.184,3.910 L23.318,3.600 L23.432,3.276 L23.528,2.938 L23.606,2.587 L23.615,2.532 L23.622,2.477 L23.627,2.422 L23.627,2.368 L23.624,2.315 L23.615,2.263 L23.601,2.213 L23.581,2.164 L23.555,2.118 L23.521,2.075 L23.479,2.035 L23.428,1.998 Z M11.175,14.474 L10.692,14.099 L10.251,13.767 L9.851,13.476 L9.488,13.224 L9.163,13.009 L8.872,12.829 L8.615,12.683 L8.390,12.568 L8.196,12.483 L8.030,12.426 L7.891,12.396 L7.778,12.390 L7.693,12.404 L7.625,12.433 L7.572,12.475 L7.533,12.528 L7.507,12.591 L7.492,12.661 L7.487,12.736 L7.490,12.815 L7.499,12.895 L7.514,12.975 L7.532,13.053 L7.552,13.126 L7.574,13.194 L7.598,13.258 L7.622,13.320 L7.648,13.380 L7.676,13.439 L7.704,13.496 L7.734,13.552 L7.766,13.608 L7.800,13.664 L7.835,13.721 L7.872,13.780 L7.910,13.840 L7.937,13.882 L7.961,13.926 L7.981,13.973 L7.996,14.022 L8.005,14.072 L8.007,14.123 L8.001,14.175 L7.984,14.226 L7.958,14.277 L7.919,14.327 L7.867,14.375 L7.801,14.422 L7.629,14.503 L7.444,14.551 L7.248,14.569 L7.050,14.564 L6.852,14.540 L6.662,14.501 L6.484,14.454 L6.324,14.403 L6.187,14.353 L6.079,14.309 L6.005,14.277 L5.970,14.260 L5.646,14.061 L5.332,13.852 L5.027,13.632 L4.733,13.399 L4.448,13.155 L4.175,12.898 L3.913,12.628 L3.663,12.345 L3.424,12.048 L3.198,11.737 L2.985,11.410 L2.785,11.069 L2.604,10.731 L2.437,10.389 L2.284,10.043 L2.143,9.692 L2.017,9.338 L1.905,8.980 L1.806,8.617 L1.722,8.251 L1.652,7.880 L1.597,7.505 L1.557,7.127 L1.532,6.744 L1.530,6.656 L1.533,6.577 L1.544,6.507 L1.560,6.446 L1.584,6.392 L1.616,6.345 L1.656,6.304 L1.704,6.269 L1.761,6.239 L1.828,6.213 L1.905,6.192 L1.992,6.173 L2.114,6.152 L2.237,6.134 L2.360,6.119 L2.483,6.108 L2.607,6.099 L2.730,6.094 L2.854,6.092 L2.977,6.094 L3.100,6.099 L3.223,6.108 L3.346,6.120 L3.468,6.136 L3.976,6.224 L4.471,6.337 L4.953,6.476 L5.424,6.640 L5.881,6.828 L6.327,7.041 L6.760,7.277 L7.181,7.538 L7.589,7.822 L7.986,8.130 L8.371,8.460 L8.744,8.813 L8.949,9.024 L9.147,9.240 L9.338,9.463 L9.522,9.690 L9.701,9.921 L9.876,10.156 L10.046,10.393 L10.214,10.633 L10.379,10.875 L10.543,11.117 L10.706,11.360 L10.869,11.602 L11.044,11.859 L11.221,12.112 L11.402,12.363 L11.587,12.610 L11.775,12.854 L11.969,13.093 L12.168,13.327 L12.373,13.557 L12.584,13.781 L12.803,13.999 L13.028,14.210 L13.262,14.415 L13.345,14.484 L13.425,14.550 L13.502,14.613 L13.577,14.674 L13.651,14.732 L13.722,14.788 L13.792,14.841 L13.860,14.891 L13.927,14.939 L13.993,14.984 L14.058,15.027 L14.123,15.068 L13.919,15.088 L13.697,15.103 L13.460,15.110 L13.211,15.108 L12.953,15.094 L12.690,15.066 L12.424,15.021 L12.160,14.958 L11.899,14.874 L11.646,14.767 L11.404,14.635 L11.175,14.475 L11.175,14.474 Z M12.141,8.260 L12.144,8.219 L12.152,8.181 L12.164,8.144 L12.181,8.110 L12.203,8.078 L12.228,8.050 L12.256,8.025 L12.288,8.004 L12.322,7.987 L12.359,7.974 L12.398,7.966 L12.439,7.963 L12.448,7.964 L12.457,7.964 L12.466,7.965 L12.475,7.966 L12.484,7.967 L12.493,7.969 L12.501,7.970 L12.509,7.972 L12.517,7.974 L12.525,7.977 L12.533,7.979 L12.541,7.982 L12.551,7.986 L12.561,7.990 L12.571,7.995 L12.581,8.000 L12.591,8.005 L12.600,8.011 L12.609,8.017 L12.618,8.023 L12.627,8.030 L12.635,8.037 L12.643,8.045 L12.650,8.053 L12.663,8.067 L12.675,8.081 L12.686,8.097 L12.696,8.113 L12.704,8.129 L12.712,8.147 L12.718,8.165 L12.724,8.183 L12.728,8.202 L12.731,8.221 L12.733,8.240 L12.733,8.260 L12.731,8.300 L12.723,8.339 L12.710,8.376 L12.693,8.410 L12.672,8.442 L12.647,8.470 L12.618,8.495 L12.587,8.516 L12.552,8.533 L12.515,8.546 L12.476,8.554 L12.435,8.556 L12.395,8.554 L12.356,8.546 L12.319,8.533 L12.285,8.516 L12.254,8.495 L12.226,8.470 L12.201,8.442 L12.180,8.410 L12.164,8.376 L12.151,8.339 L12.144,8.300 L12.141,8.260 Z M15.142,9.799 L15.093,9.818 L15.045,9.837 L14.997,9.855 L14.949,9.872 L14.901,9.888 L14.854,9.903 L14.806,9.916 L14.759,9.927 L14.712,9.937 L14.665,9.944 L14.618,9.950 L14.572,9.953 L14.499,9.954 L14.427,9.950 L14.354,9.941 L14.282,9.928 L14.211,9.911 L14.143,9.890 L14.076,9.866 L14.013,9.839 L13.953,9.809 L13.898,9.778 L13.847,9.744 L13.802,9.709 L13.737,9.655 L13.676,9.605 L13.618,9.555 L13.564,9.507 L13.513,9.457 L13.466,9.405 L13.423,9.349 L13.384,9.289 L13.349,9.223 L13.318,9.150 L13.292,9.068 L13.270,8.977 L13.262,8.934 L13.257,8.888 L13.253,8.839 L13.252,8.789 L13.252,8.738 L13.253,8.686 L13.256,8.635 L13.260,8.585 L13.265,8.537 L13.271,8.491 L13.277,8.449 L13.284,8.410 L13.299,8.333 L13.307,8.261 L13.309,8.193 L13.305,8.129 L13.295,8.068 L13.278,8.010 L13.256,7.954 L13.228,7.902 L13.194,7.851 L13.154,7.802 L13.107,7.754 L13.055,7.708 L13.008,7.673 L12.960,7.642 L12.910,7.615 L12.858,7.592 L12.804,7.572 L12.749,7.556 L12.693,7.543 L12.634,7.533 L12.575,7.525 L12.515,7.520 L12.453,7.517 L12.390,7.516 L12.367,7.516 L12.343,7.513 L12.321,7.509 L12.299,7.504 L12.277,7.498 L12.256,7.491 L12.236,7.484 L12.216,7.476 L12.197,7.467 L12.179,7.459 L12.161,7.450 L12.145,7.441 L12.119,7.427 L12.094,7.409 L12.071,7.388 L12.051,7.364 L12.033,7.338 L12.019,7.309 L12.009,7.279 L12.003,7.246 L12.002,7.211 L12.007,7.174 L12.018,7.136 L12.035,7.096 L12.044,7.081 L12.056,7.064 L12.071,7.045 L12.088,7.025 L12.107,7.004 L12.126,6.983 L12.146,6.963 L12.165,6.944 L12.182,6.927 L12.198,6.913 L12.211,6.901 L12.220,6.893 L12.307,6.850 L12.396,6.816 L12.486,6.793 L12.578,6.778 L12.671,6.771 L12.764,6.773 L12.858,6.781 L12.953,6.796 L13.047,6.817 L13.141,6.843 L13.234,6.874 L13.326,6.908 L13.409,6.946 L13.490,6.987 L13.568,7.034 L13.645,7.086 L13.722,7.142 L13.798,7.203 L13.875,7.268 L13.953,7.338 L14.033,7.412 L14.116,7.491 L14.202,7.575 L14.292,7.663 L14.380,7.765 L14.457,7.857 L14.524,7.939 L14.583,8.013 L14.636,8.081 L14.683,8.145 L14.727,8.207 L14.770,8.268 L14.812,8.331 L14.855,8.397 L14.902,8.468 L14.953,8.545 L14.995,8.609 L15.036,8.674 L15.077,8.739 L15.116,8.804 L15.155,8.871 L15.192,8.938 L15.228,9.006 L15.262,9.075 L15.295,9.145 L15.326,9.217 L15.356,9.290 L15.383,9.364 L15.396,9.410 L15.403,9.455 L15.404,9.498 L15.398,9.539 L15.387,9.579 L15.370,9.616 L15.347,9.652 L15.317,9.686 L15.282,9.718 L15.241,9.747 L15.194,9.774 L15.142,9.799 Z",
		"M22.917,1.430 L22.858,1.407 L22.805,1.397 L22.756,1.398 L22.711,1.409 L22.670,1.429 L22.631,1.454 L22.595,1.485 L22.560,1.519 L22.526,1.554 L22.492,1.590 L22.457,1.624 L22.422,1.655 L22.410,1.665 L22.398,1.675 L22.387,1.685 L22.376,1.696 L22.364,1.707 L22.353,1.718 L22.343,1.729 L22.332,1.741 L22.322,1.752 L22.311,1.764 L22.301,1.775 L22.290,1.787 L22.199,1.880 L22.106,1.967 L22.009,2.047 L21.909,2.120 L21.806,2.186 L21.699,2.244 L21.588,2.293 L21.473,2.333 L21.353,2.363 L21.229,2.383 L21.100,2.393 L20.966,2.391 L20.768,2.386 L20.575,2.394 L20.387,2.414 L20.203,2.447 L20.024,2.494 L19.849,2.554 L19.678,2.628 L19.510,2.716 L19.347,2.817 L19.187,2.933 L19.031,3.064 L18.879,3.210 L18.840,3.027 L18.790,2.857 L18.728,2.699 L18.654,2.551 L18.568,2.415 L18.472,2.288 L18.365,2.171 L18.247,2.064 L18.118,1.965 L17.980,1.874 L17.832,1.791 L17.675,1.716 L17.590,1.678 L17.505,1.640 L17.421,1.600 L17.338,1.559 L17.256,1.515 L17.176,1.468 L17.098,1.418 L17.023,1.363 L16.950,1.303 L16.881,1.238 L16.815,1.167 L16.754,1.089 L16.715,1.030 L16.680,0.970 L16.649,0.910 L16.622,0.848 L16.597,0.786 L16.575,0.724 L16.555,0.661 L16.535,0.597 L16.517,0.533 L16.498,0.470 L16.479,0.406 L16.459,0.342 L16.446,0.303 L16.432,0.265 L16.417,0.228 L16.402,0.191 L16.384,0.157 L16.364,0.125 L16.342,0.095 L16.317,0.069 L16.288,0.046 L16.255,0.027 L16.218,0.013 L16.176,0.004 L16.130,0.000 L16.089,0.004 L16.052,0.014 L16.018,0.029 L15.988,0.050 L15.960,0.075 L15.935,0.103 L15.912,0.134 L15.891,0.167 L15.871,0.201 L15.852,0.236 L15.833,0.270 L15.761,0.409 L15.697,0.551 L15.640,0.694 L15.590,0.839 L15.547,0.986 L15.511,1.134 L15.482,1.284 L15.459,1.435 L15.441,1.586 L15.430,1.739 L15.425,1.892 L15.425,2.046 L15.443,2.387 L15.485,2.715 L15.550,3.032 L15.638,3.336 L15.750,3.629 L15.886,3.908 L16.045,4.176 L16.228,4.430 L16.435,4.672 L16.666,4.901 L16.920,5.117 L17.199,5.320 L17.230,5.343 L17.257,5.365 L17.280,5.388 L17.299,5.412 L17.315,5.436 L17.326,5.460 L17.335,5.486 L17.339,5.513 L17.340,5.540 L17.338,5.569 L17.332,5.600 L17.324,5.632 L17.303,5.699 L17.283,5.766 L17.262,5.833 L17.240,5.900 L17.219,5.967 L17.197,6.034 L17.175,6.100 L17.153,6.167 L17.131,6.234 L17.109,6.301 L17.088,6.368 L17.067,6.435 L17.053,6.476 L17.038,6.510 L17.021,6.540 L17.002,6.564 L16.982,6.582 L16.958,6.596 L16.932,6.604 L16.903,6.607 L16.870,6.605 L16.834,6.599 L16.794,6.587 L16.750,6.570 L16.592,6.501 L16.438,6.427 L16.288,6.347 L16.140,6.263 L15.996,6.174 L15.855,6.080 L15.718,5.982 L15.583,5.880 L15.452,5.774 L15.323,5.664 L15.197,5.550 L15.074,5.433 L14.869,5.231 L14.666,5.027 L14.465,4.822 L14.264,4.616 L14.063,4.410 L13.861,4.206 L13.656,4.003 L13.448,3.804 L13.237,3.610 L13.020,3.420 L12.797,3.236 L12.568,3.060 L12.513,3.020 L12.458,2.980 L12.404,2.941 L12.349,2.902 L12.294,2.864 L12.239,2.826 L12.183,2.788 L12.128,2.751 L12.072,2.714 L12.016,2.677 L11.960,2.641 L11.903,2.605 L11.706,2.378 L11.584,2.160 L11.526,1.951 L11.522,1.755 L11.564,1.573 L11.640,1.407 L11.742,1.257 L11.858,1.127 L11.980,1.018 L12.097,0.932 L12.199,0.869 L12.277,0.833 L12.333,0.805 L12.370,0.770 L12.388,0.728 L12.385,0.683 L12.361,0.637 L12.315,0.590 L12.246,0.545 L12.153,0.505 L12.035,0.470 L11.892,0.443 L11.722,0.426 L11.526,0.420 L11.317,0.427 L11.110,0.444 L10.904,0.472 L10.698,0.510 L10.491,0.556 L10.282,0.611 L10.070,0.674 L9.854,0.744 L9.634,0.820 L9.407,0.902 L9.174,0.989 L8.933,1.081 L8.897,1.095 L8.860,1.108 L8.824,1.121 L8.787,1.133 L8.750,1.144 L8.712,1.155 L8.675,1.166 L8.637,1.176 L8.599,1.186 L8.561,1.195 L8.522,1.204 L8.484,1.213 L8.260,1.173 L8.036,1.139 L7.809,1.111 L7.582,1.088 L7.352,1.071 L7.121,1.060 L6.889,1.054 L6.655,1.054 L6.419,1.061 L6.182,1.073 L5.943,1.091 L5.702,1.115 L5.255,1.179 L4.823,1.271 L4.407,1.390 L4.006,1.535 L3.620,1.707 L3.251,1.906 L2.896,2.131 L2.558,2.382 L2.235,2.659 L1.928,2.963 L1.637,3.291 L1.362,3.646 L1.062,4.092 L0.801,4.547 L0.579,5.012 L0.395,5.485 L0.247,5.966 L0.135,6.454 L0.057,6.949 L0.012,7.450 L0.000,7.957 L0.019,8.469 L0.068,8.986 L0.147,9.506 L0.259,10.050 L0.402,10.577 L0.574,11.088 L0.776,11.583 L1.006,12.062 L1.265,12.526 L1.552,12.972 L1.866,13.403 L2.208,13.817 L2.575,14.215 L2.969,14.597 L3.389,14.962 L3.843,15.316 L4.308,15.638 L4.784,15.928 L5.273,16.185 L5.772,16.410 L6.284,16.601 L6.807,16.758 L7.342,16.882 L7.889,16.971 L8.448,17.025 L9.019,17.043 L9.601,17.027 L9.962,17.003 L10.330,16.971 L10.705,16.925 L11.087,16.863 L11.477,16.778 L11.874,16.669 L12.279,16.529 L12.691,16.355 L13.111,16.142 L13.540,15.887 L13.976,15.585 L14.421,15.232 L14.535,15.286 L14.651,15.334 L14.770,15.378 L14.892,15.417 L15.020,15.452 L15.154,15.483 L15.294,15.511 L15.443,15.536 L15.601,15.558 L15.769,15.579 L15.947,15.598 L16.138,15.615 L16.289,15.626 L16.439,15.632 L16.588,15.633 L16.734,15.629 L16.878,15.621 L17.019,15.610 L17.157,15.595 L17.291,15.578 L17.421,15.558 L17.547,15.537 L17.668,15.514 L17.784,15.491 L17.945,15.444 L18.078,15.379 L18.182,15.300 L18.261,15.211 L18.315,15.115 L18.348,15.016 L18.360,14.918 L18.355,14.824 L18.332,14.738 L18.296,14.664 L18.247,14.604 L18.188,14.564 L17.719,14.349 L17.343,14.183 L17.050,14.060 L16.827,13.972 L16.663,13.912 L16.544,13.873 L16.461,13.848 L16.400,13.828 L16.351,13.808 L16.300,13.780 L16.237,13.736 L16.150,13.670 L16.424,13.337 L16.717,12.965 L17.020,12.553 L17.330,12.102 L17.640,11.613 L17.943,11.087 L18.235,10.524 L18.510,9.924 L18.762,9.288 L18.984,8.617 L19.171,7.912 L19.318,7.172 L19.331,7.086 L19.343,6.996 L19.356,6.902 L19.369,6.805 L19.380,6.708 L19.391,6.611 L19.401,6.515 L19.409,6.422 L19.416,6.332 L19.421,6.248 L19.423,6.169 L19.422,6.097 L19.422,6.058 L19.424,6.023 L19.429,5.992 L19.436,5.964 L19.447,5.940 L19.461,5.919 L19.480,5.901 L19.502,5.885 L19.530,5.873 L19.562,5.863 L19.601,5.855 L19.645,5.849 L19.775,5.833 L19.904,5.812 L20.032,5.788 L20.160,5.761 L20.286,5.729 L20.411,5.694 L20.536,5.654 L20.658,5.610 L20.780,5.562 L20.900,5.510 L21.019,5.453 L21.136,5.391 L21.456,5.198 L21.744,4.985 L22.002,4.754 L22.230,4.506 L22.430,4.242 L22.603,3.962 L22.750,3.667 L22.874,3.358 L22.975,3.035 L23.054,2.701 L23.114,2.354 L23.155,1.997 L23.159,1.942 L23.160,1.886 L23.159,1.832 L23.154,1.778 L23.144,1.725 L23.131,1.674 L23.112,1.626 L23.087,1.580 L23.055,1.537 L23.017,1.497 L22.971,1.462 L22.917,1.430 Z M11.175,14.474 L10.692,14.099 L10.251,13.767 L9.851,13.476 L9.488,13.224 L9.163,13.009 L8.872,12.829 L8.615,12.683 L8.390,12.568 L8.196,12.483 L8.030,12.426 L7.891,12.396 L7.778,12.390 L7.693,12.404 L7.625,12.433 L7.572,12.475 L7.533,12.528 L7.507,12.591 L7.492,12.661 L7.487,12.736 L7.490,12.815 L7.499,12.895 L7.514,12.975 L7.532,13.053 L7.552,13.126 L7.574,13.194 L7.598,13.258 L7.622,13.320 L7.648,13.380 L7.676,13.439 L7.704,13.496 L7.734,13.552 L7.766,13.608 L7.800,13.664 L7.835,13.721 L7.872,13.780 L7.910,13.840 L7.937,13.882 L7.961,13.926 L7.981,13.973 L7.996,14.022 L8.005,14.072 L8.007,14.123 L8.001,14.175 L7.984,14.226 L7.958,14.277 L7.919,14.327 L7.867,14.375 L7.801,14.422 L7.629,14.503 L7.444,14.551 L7.248,14.569 L7.050,14.564 L6.852,14.540 L6.662,14.501 L6.484,14.454 L6.324,14.403 L6.187,14.353 L6.079,14.309 L6.005,14.277 L5.970,14.260 L5.646,14.061 L5.332,13.852 L5.027,13.632 L4.733,13.399 L4.448,13.155 L4.175,12.898 L3.913,12.628 L3.663,12.345 L3.424,12.048 L3.198,11.737 L2.985,11.410 L2.785,11.069 L2.604,10.731 L2.437,10.389 L2.284,10.043 L2.143,9.692 L2.017,9.338 L1.905,8.980 L1.806,8.617 L1.722,8.251 L1.652,7.880 L1.597,7.505 L1.557,7.127 L1.532,6.744 L1.530,6.656 L1.533,6.577 L1.544,6.507 L1.560,6.446 L1.584,6.392 L1.616,6.345 L1.656,6.304 L1.704,6.269 L1.761,6.239 L1.828,6.213 L1.905,6.192 L1.992,6.173 L2.114,6.152 L2.237,6.134 L2.360,6.119 L2.483,6.108 L2.607,6.099 L2.730,6.094 L2.854,6.092 L2.977,6.094 L3.100,6.099 L3.223,6.108 L3.346,6.120 L3.468,6.136 L3.976,6.224 L4.471,6.337 L4.953,6.476 L5.424,6.640 L5.881,6.828 L6.327,7.041 L6.760,7.277 L7.181,7.538 L7.589,7.822 L7.986,8.130 L8.371,8.460 L8.744,8.813 L8.949,9.024 L9.147,9.240 L9.338,9.463 L9.522,9.690 L9.701,9.921 L9.876,10.156 L10.046,10.393 L10.214,10.633 L10.379,10.875 L10.543,11.117 L10.706,11.360 L10.869,11.602 L11.044,11.859 L11.221,12.112 L11.402,12.363 L11.587,12.610 L11.775,12.854 L11.969,13.093 L12.168,13.327 L12.373,13.557 L12.584,13.781 L12.803,13.999 L13.028,14.210 L13.262,14.415 L13.345,14.484 L13.425,14.550 L13.502,14.613 L13.577,14.674 L13.651,14.732 L13.722,14.788 L13.792,14.841 L13.860,14.891 L13.927,14.939 L13.993,14.984 L14.058,15.027 L14.123,15.068 L13.919,15.088 L13.697,15.103 L13.460,15.110 L13.211,15.108 L12.953,15.094 L12.690,15.066 L12.424,15.021 L12.160,14.958 L11.899,14.874 L11.646,14.767 L11.404,14.635 L11.175,14.475 L11.175,14.474 Z M12.141,8.260 L12.144,8.219 L12.152,8.181 L12.164,8.144 L12.181,8.110 L12.203,8.078 L12.228,8.050 L12.256,8.025 L12.288,8.004 L12.322,7.987 L12.359,7.974 L12.398,7.966 L12.439,7.963 L12.448,7.964 L12.457,7.964 L12.466,7.965 L12.475,7.966 L12.484,7.967 L12.493,7.969 L12.501,7.970 L12.509,7.972 L12.517,7.974 L12.525,7.977 L12.533,7.979 L12.541,7.982 L12.551,7.986 L12.561,7.990 L12.571,7.995 L12.581,8.000 L12.591,8.005 L12.600,8.011 L12.609,8.017 L12.618,8.023 L12.627,8.030 L12.635,8.037 L12.643,8.045 L12.650,8.053 L12.663,8.067 L12.675,8.081 L12.686,8.097 L12.696,8.113 L12.704,8.129 L12.712,8.147 L12.718,8.165 L12.724,8.183 L12.728,8.202 L12.731,8.221 L12.733,8.240 L12.733,8.260 L12.731,8.300 L12.723,8.339 L12.710,8.376 L12.693,8.410 L12.672,8.442 L12.647,8.470 L12.618,8.495 L12.587,8.516 L12.552,8.533 L12.515,8.546 L12.476,8.554 L12.435,8.556 L12.395,8.554 L12.356,8.546 L12.319,8.533 L12.285,8.516 L12.254,8.495 L12.226,8.470 L12.201,8.442 L12.180,8.410 L12.164,8.376 L12.151,8.339 L12.144,8.300 L12.141,8.260 Z M15.142,9.799 L15.093,9.818 L15.045,9.837 L14.997,9.855 L14.949,9.872 L14.901,9.888 L14.854,9.903 L14.806,9.916 L14.759,9.927 L14.712,9.937 L14.665,9.944 L14.618,9.950 L14.572,9.953 L14.499,9.954 L14.427,9.950 L14.354,9.941 L14.282,9.928 L14.211,9.911 L14.143,9.890 L14.076,9.866 L14.013,9.839 L13.953,9.809 L13.898,9.778 L13.847,9.744 L13.802,9.709 L13.737,9.655 L13.676,9.605 L13.618,9.555 L13.564,9.507 L13.513,9.457 L13.466,9.405 L13.423,9.349 L13.384,9.289 L13.349,9.223 L13.318,9.150 L13.292,9.068 L13.270,8.977 L13.262,8.934 L13.257,8.888 L13.253,8.839 L13.252,8.789 L13.252,8.738 L13.253,8.686 L13.256,8.635 L13.260,8.585 L13.265,8.537 L13.271,8.491 L13.277,8.449 L13.284,8.410 L13.299,8.333 L13.307,8.261 L13.309,8.193 L13.305,8.129 L13.295,8.068 L13.278,8.010 L13.256,7.954 L13.228,7.902 L13.194,7.851 L13.154,7.802 L13.107,7.754 L13.055,7.708 L13.008,7.673 L12.960,7.642 L12.910,7.615 L12.858,7.592 L12.804,7.572 L12.749,7.556 L12.693,7.543 L12.634,7.533 L12.575,7.525 L12.515,7.520 L12.453,7.517 L12.390,7.516 L12.367,7.516 L12.343,7.513 L12.321,7.509 L12.299,7.504 L12.277,7.498 L12.256,7.491 L12.236,7.484 L12.216,7.476 L12.197,7.467 L12.179,7.459 L12.161,7.450 L12.145,7.441 L12.119,7.427 L12.094,7.409 L12.071,7.388 L12.051,7.364 L12.033,7.338 L12.019,7.309 L12.009,7.279 L12.003,7.246 L12.002,7.211 L12.007,7.174 L12.018,7.136 L12.035,7.096 L12.044,7.081 L12.056,7.064 L12.071,7.045 L12.088,7.025 L12.107,7.004 L12.126,6.983 L12.146,6.963 L12.165,6.944 L12.182,6.927 L12.198,6.913 L12.211,6.901 L12.220,6.893 L12.307,6.850 L12.396,6.816 L12.486,6.793 L12.578,6.778 L12.671,6.771 L12.764,6.773 L12.858,6.781 L12.953,6.796 L13.047,6.817 L13.141,6.843 L13.234,6.874 L13.326,6.908 L13.409,6.946 L13.490,6.987 L13.568,7.034 L13.645,7.086 L13.722,7.142 L13.798,7.203 L13.875,7.268 L13.953,7.338 L14.033,7.412 L14.116,7.491 L14.202,7.575 L14.292,7.663 L14.380,7.765 L14.457,7.857 L14.524,7.939 L14.583,8.013 L14.636,8.081 L14.683,8.145 L14.727,8.207 L14.770,8.268 L14.812,8.331 L14.855,8.397 L14.902,8.468 L14.953,8.545 L14.995,8.609 L15.036,8.674 L15.077,8.739 L15.116,8.804 L15.155,8.871 L15.192,8.938 L15.228,9.006 L15.262,9.075 L15.295,9.145 L15.326,9.217 L15.356,9.290 L15.383,9.364 L15.396,9.410 L15.403,9.455 L15.404,9.498 L15.398,9.539 L15.387,9.579 L15.370,9.616 L15.347,9.652 L15.317,9.686 L15.282,9.718 L15.241,9.747 L15.194,9.774 L15.142,9.799 Z",
		"M22.917,1.430 L22.858,1.407 L22.805,1.397 L22.756,1.398 L22.711,1.409 L22.670,1.429 L22.631,1.454 L22.595,1.485 L22.560,1.519 L22.526,1.554 L22.492,1.590 L22.457,1.624 L22.422,1.655 L22.410,1.665 L22.398,1.675 L22.387,1.685 L22.376,1.696 L22.364,1.707 L22.353,1.718 L22.343,1.729 L22.332,1.741 L22.322,1.752 L22.311,1.764 L22.301,1.775 L22.290,1.787 L22.199,1.880 L22.106,1.967 L22.009,2.047 L21.909,2.120 L21.806,2.186 L21.699,2.244 L21.588,2.293 L21.473,2.333 L21.353,2.363 L21.229,2.383 L21.100,2.393 L20.966,2.391 L20.768,2.386 L20.575,2.394 L20.387,2.414 L20.203,2.447 L20.024,2.494 L19.849,2.554 L19.678,2.628 L19.510,2.716 L19.347,2.817 L19.187,2.933 L19.031,3.064 L18.879,3.210 L18.840,3.027 L18.790,2.857 L18.728,2.699 L18.654,2.551 L18.568,2.415 L18.472,2.288 L18.365,2.171 L18.247,2.064 L18.118,1.965 L17.980,1.874 L17.832,1.791 L17.675,1.716 L17.590,1.678 L17.505,1.640 L17.421,1.600 L17.338,1.559 L17.256,1.515 L17.176,1.468 L17.098,1.418 L17.023,1.363 L16.950,1.303 L16.881,1.238 L16.815,1.167 L16.754,1.089 L16.715,1.030 L16.680,0.970 L16.649,0.910 L16.622,0.848 L16.597,0.786 L16.575,0.724 L16.555,0.661 L16.535,0.597 L16.517,0.533 L16.498,0.470 L16.479,0.406 L16.459,0.342 L16.446,0.303 L16.432,0.265 L16.417,0.228 L16.402,0.191 L16.384,0.157 L16.364,0.125 L16.342,0.095 L16.317,0.069 L16.288,0.046 L16.255,0.027 L16.218,0.013 L16.176,0.004 L16.130,0.000 L16.089,0.004 L16.052,0.014 L16.018,0.029 L15.988,0.050 L15.960,0.075 L15.935,0.103 L15.912,0.134 L15.891,0.167 L15.871,0.201 L15.852,0.236 L15.833,0.270 L15.761,0.409 L15.697,0.551 L15.640,0.694 L15.590,0.839 L15.547,0.986 L15.511,1.134 L15.482,1.284 L15.459,1.435 L15.441,1.586 L15.430,1.739 L15.425,1.892 L15.425,2.046 L15.443,2.387 L15.485,2.715 L15.550,3.032 L15.638,3.336 L15.750,3.629 L15.886,3.908 L16.045,4.176 L16.228,4.430 L16.435,4.672 L16.666,4.901 L16.920,5.117 L17.199,5.320 L17.230,5.343 L17.257,5.365 L17.280,5.388 L17.299,5.412 L17.315,5.436 L17.326,5.460 L17.335,5.486 L17.339,5.513 L17.340,5.540 L17.338,5.569 L17.332,5.600 L17.324,5.632 L17.303,5.699 L17.283,5.766 L17.262,5.833 L17.240,5.900 L17.219,5.967 L17.197,6.034 L17.175,6.100 L17.153,6.167 L17.131,6.234 L17.109,6.301 L17.088,6.368 L17.067,6.435 L17.053,6.476 L17.038,6.510 L17.021,6.540 L17.002,6.564 L16.982,6.582 L16.958,6.596 L16.932,6.604 L16.903,6.607 L16.870,6.605 L16.834,6.599 L16.794,6.587 L16.750,6.570 L16.592,6.501 L16.438,6.427 L16.288,6.347 L16.140,6.263 L15.996,6.174 L15.855,6.080 L15.718,5.982 L15.583,5.880 L15.452,5.774 L15.323,5.664 L15.197,5.550 L15.074,5.433 L14.869,5.231 L14.666,5.027 L14.465,4.822 L14.264,4.616 L14.063,4.410 L13.861,4.206 L13.656,4.003 L13.448,3.804 L13.237,3.610 L13.020,3.420 L12.797,3.236 L12.568,3.060 L12.513,3.020 L12.458,2.980 L12.404,2.941 L12.349,2.902 L12.294,2.864 L12.239,2.826 L12.183,2.788 L12.128,2.751 L12.072,2.714 L12.016,2.677 L11.960,2.641 L11.903,2.605 L11.706,2.378 L11.584,2.160 L11.526,1.951 L11.522,1.755 L11.564,1.573 L11.640,1.407 L11.742,1.257 L11.858,1.127 L11.980,1.018 L12.097,0.932 L12.199,0.869 L12.277,0.833 L12.333,0.805 L12.370,0.770 L12.388,0.728 L12.385,0.683 L12.361,0.637 L12.315,0.590 L12.246,0.545 L12.153,0.505 L12.035,0.470 L11.892,0.443 L11.722,0.426 L11.526,0.420 L11.317,0.427 L11.110,0.444 L10.904,0.472 L10.698,0.510 L10.491,0.556 L10.282,0.611 L10.070,0.674 L9.854,0.744 L9.634,0.820 L9.407,0.902 L9.174,0.989 L8.933,1.081 L8.897,1.095 L8.860,1.108 L8.824,1.121 L8.787,1.133 L8.750,1.144 L8.712,1.155 L8.675,1.166 L8.637,1.176 L8.599,1.186 L8.561,1.195 L8.522,1.204 L8.484,1.213 L8.260,1.173 L8.036,1.139 L7.809,1.111 L7.582,1.088 L7.352,1.071 L7.121,1.060 L6.889,1.054 L6.655,1.054 L6.419,1.061 L6.182,1.073 L5.943,1.091 L5.702,1.115 L5.255,1.179 L4.823,1.271 L4.407,1.390 L4.006,1.535 L3.620,1.707 L3.251,1.906 L2.896,2.131 L2.558,2.382 L2.235,2.659 L1.928,2.963 L1.637,3.291 L1.362,3.646 L1.062,4.092 L0.801,4.547 L0.579,5.012 L0.395,5.485 L0.247,5.966 L0.135,6.454 L0.057,6.949 L0.012,7.450 L0.000,7.957 L0.019,8.469 L0.068,8.986 L0.147,9.506 L0.259,10.050 L0.402,10.577 L0.574,11.088 L0.776,11.583 L1.006,12.062 L1.265,12.526 L1.552,12.972 L1.866,13.403 L2.208,13.817 L2.575,14.215 L2.969,14.597 L3.389,14.962 L3.843,15.316 L4.308,15.638 L4.784,15.928 L5.273,16.185 L5.772,16.410 L6.284,16.601 L6.807,16.758 L7.342,16.882 L7.889,16.971 L8.448,17.025 L9.019,17.043 L9.601,17.027 L9.962,17.003 L10.330,16.971 L10.705,16.925 L11.087,16.863 L11.477,16.778 L11.874,16.669 L12.279,16.529 L12.691,16.355 L13.111,16.142 L13.540,15.887 L13.976,15.585 L14.421,15.232 L14.535,15.286 L14.651,15.334 L14.770,15.378 L14.892,15.417 L15.020,15.452 L15.154,15.483 L15.294,15.511 L15.443,15.536 L15.601,15.558 L15.769,15.579 L15.947,15.598 L16.138,15.615 L16.289,15.626 L16.439,15.632 L16.588,15.633 L16.734,15.629 L16.878,15.621 L17.019,15.610 L17.157,15.595 L17.291,15.578 L17.421,15.558 L17.547,15.537 L17.668,15.514 L17.784,15.491 L17.945,15.444 L18.078,15.379 L18.182,15.300 L18.261,15.211 L18.315,15.115 L18.348,15.016 L18.360,14.918 L18.355,14.824 L18.332,14.738 L18.296,14.664 L18.247,14.604 L18.188,14.564 L17.719,14.349 L17.343,14.183 L17.050,14.060 L16.827,13.972 L16.663,13.912 L16.544,13.873 L16.461,13.848 L16.400,13.828 L16.351,13.808 L16.300,13.780 L16.237,13.736 L16.150,13.670 L16.424,13.337 L16.717,12.965 L17.020,12.553 L17.330,12.102 L17.640,11.613 L17.943,11.087 L18.235,10.524 L18.510,9.924 L18.762,9.288 L18.984,8.617 L19.171,7.912 L19.318,7.172 L19.331,7.086 L19.343,6.996 L19.356,6.902 L19.369,6.805 L19.380,6.708 L19.391,6.611 L19.401,6.515 L19.409,6.422 L19.416,6.332 L19.421,6.248 L19.423,6.169 L19.422,6.097 L19.422,6.058 L19.424,6.023 L19.429,5.992 L19.436,5.964 L19.447,5.940 L19.461,5.919 L19.480,5.901 L19.502,5.885 L19.530,5.873 L19.562,5.863 L19.601,5.855 L19.645,5.849 L19.775,5.833 L19.904,5.812 L20.032,5.788 L20.160,5.761 L20.286,5.729 L20.411,5.694 L20.536,5.654 L20.658,5.610 L20.780,5.562 L20.900,5.510 L21.019,5.453 L21.136,5.391 L21.456,5.198 L21.744,4.985 L22.002,4.754 L22.230,4.506 L22.430,4.242 L22.603,3.962 L22.750,3.667 L22.874,3.358 L22.975,3.035 L23.054,2.701 L23.114,2.354 L23.155,1.997 L23.159,1.942 L23.160,1.886 L23.159,1.832 L23.154,1.778 L23.144,1.725 L23.131,1.674 L23.112,1.626 L23.087,1.580 L23.055,1.537 L23.017,1.497 L22.971,1.462 L22.917,1.430 Z M11.175,14.474 L10.692,14.099 L10.251,13.767 L9.851,13.476 L9.488,13.224 L9.163,13.009 L8.872,12.829 L8.615,12.683 L8.390,12.568 L8.196,12.483 L8.030,12.426 L7.891,12.396 L7.778,12.390 L7.693,12.404 L7.625,12.433 L7.572,12.475 L7.533,12.528 L7.507,12.591 L7.492,12.661 L7.487,12.736 L7.490,12.815 L7.499,12.895 L7.514,12.975 L7.532,13.053 L7.552,13.126 L7.574,13.194 L7.598,13.258 L7.622,13.320 L7.648,13.380 L7.676,13.439 L7.704,13.496 L7.734,13.552 L7.766,13.608 L7.800,13.664 L7.835,13.721 L7.872,13.780 L7.910,13.840 L7.937,13.882 L7.961,13.926 L7.981,13.973 L7.996,14.022 L8.005,14.072 L8.007,14.123 L8.001,14.175 L7.984,14.226 L7.958,14.277 L7.919,14.327 L7.867,14.375 L7.801,14.422 L7.629,14.503 L7.444,14.551 L7.248,14.569 L7.050,14.564 L6.852,14.540 L6.662,14.501 L6.484,14.454 L6.324,14.403 L6.187,14.353 L6.079,14.309 L6.005,14.277 L5.970,14.260 L5.646,14.061 L5.332,13.852 L5.027,13.632 L4.733,13.399 L4.448,13.155 L4.175,12.898 L3.913,12.628 L3.663,12.345 L3.424,12.048 L3.198,11.737 L2.985,11.410 L2.785,11.069 L2.604,10.731 L2.437,10.389 L2.284,10.043 L2.143,9.692 L2.017,9.338 L1.905,8.980 L1.806,8.617 L1.722,8.251 L1.652,7.880 L1.597,7.505 L1.557,7.127 L1.532,6.744 L1.530,6.656 L1.533,6.577 L1.544,6.507 L1.560,6.446 L1.584,6.392 L1.616,6.345 L1.656,6.304 L1.704,6.269 L1.761,6.239 L1.828,6.213 L1.905,6.192 L1.992,6.173 L2.114,6.152 L2.237,6.134 L2.360,6.119 L2.483,6.108 L2.607,6.099 L2.730,6.094 L2.854,6.092 L2.977,6.094 L3.100,6.099 L3.223,6.108 L3.346,6.120 L3.468,6.136 L3.976,6.224 L4.471,6.337 L4.953,6.476 L5.424,6.640 L5.881,6.828 L6.327,7.041 L6.760,7.277 L7.181,7.538 L7.589,7.822 L7.986,8.130 L8.371,8.460 L8.744,8.813 L8.949,9.024 L9.147,9.240 L9.338,9.463 L9.522,9.690 L9.701,9.921 L9.876,10.156 L10.046,10.393 L10.214,10.633 L10.379,10.875 L10.543,11.117 L10.706,11.360 L10.869,11.602 L11.044,11.859 L11.221,12.112 L11.402,12.363 L11.587,12.610 L11.775,12.854 L11.969,13.093 L12.168,13.327 L12.373,13.557 L12.584,13.781 L12.803,13.999 L13.028,14.210 L13.262,14.415 L13.345,14.484 L13.425,14.550 L13.502,14.613 L13.577,14.674 L13.651,14.732 L13.722,14.788 L13.792,14.841 L13.860,14.891 L13.927,14.939 L13.993,14.984 L14.058,15.027 L14.123,15.068 L13.919,15.088 L13.697,15.103 L13.460,15.110 L13.211,15.108 L12.953,15.094 L12.690,15.066 L12.424,15.021 L12.160,14.958 L11.899,14.874 L11.646,14.767 L11.404,14.635 L11.175,14.475 L11.175,14.474 Z M12.141,8.260 L12.144,8.219 L12.152,8.181 L12.164,8.144 L12.181,8.110 L12.203,8.078 L12.228,8.050 L12.256,8.025 L12.288,8.004 L12.322,7.987 L12.359,7.974 L12.398,7.966 L12.439,7.963 L12.448,7.964 L12.457,7.964 L12.466,7.965 L12.475,7.966 L12.484,7.967 L12.493,7.969 L12.501,7.970 L12.509,7.972 L12.517,7.974 L12.525,7.977 L12.533,7.979 L12.541,7.982 L12.551,7.986 L12.561,7.990 L12.571,7.995 L12.581,8.000 L12.591,8.005 L12.600,8.011 L12.609,8.017 L12.618,8.023 L12.627,8.030 L12.635,8.037 L12.643,8.045 L12.650,8.053 L12.663,8.067 L12.675,8.081 L12.686,8.097 L12.696,8.113 L12.704,8.129 L12.712,8.147 L12.718,8.165 L12.724,8.183 L12.728,8.202 L12.731,8.221 L12.733,8.240 L12.733,8.260 L12.731,8.300 L12.723,8.339 L12.710,8.376 L12.693,8.410 L12.672,8.442 L12.647,8.470 L12.618,8.495 L12.587,8.516 L12.552,8.533 L12.515,8.546 L12.476,8.554 L12.435,8.556 L12.395,8.554 L12.356,8.546 L12.319,8.533 L12.285,8.516 L12.254,8.495 L12.226,8.470 L12.201,8.442 L12.180,8.410 L12.164,8.376 L12.151,8.339 L12.144,8.300 L12.141,8.260 Z M15.142,9.799 L15.093,9.818 L15.045,9.837 L14.997,9.855 L14.949,9.872 L14.901,9.888 L14.854,9.903 L14.806,9.916 L14.759,9.927 L14.712,9.937 L14.665,9.944 L14.618,9.950 L14.572,9.953 L14.499,9.954 L14.427,9.950 L14.354,9.941 L14.282,9.928 L14.211,9.911 L14.143,9.890 L14.076,9.866 L14.013,9.839 L13.953,9.809 L13.898,9.778 L13.847,9.744 L13.802,9.709 L13.737,9.655 L13.676,9.605 L13.618,9.555 L13.564,9.507 L13.513,9.457 L13.466,9.405 L13.423,9.349 L13.384,9.289 L13.349,9.223 L13.318,9.150 L13.292,9.068 L13.270,8.977 L13.262,8.934 L13.257,8.888 L13.253,8.839 L13.252,8.789 L13.252,8.738 L13.253,8.686 L13.256,8.635 L13.260,8.585 L13.265,8.537 L13.271,8.491 L13.277,8.449 L13.284,8.410 L13.299,8.333 L13.307,8.261 L13.309,8.193 L13.305,8.129 L13.295,8.068 L13.278,8.010 L13.256,7.954 L13.228,7.902 L13.194,7.851 L13.154,7.802 L13.107,7.754 L13.055,7.708 L13.008,7.673 L12.960,7.642 L12.910,7.615 L12.858,7.592 L12.804,7.572 L12.749,7.556 L12.693,7.543 L12.634,7.533 L12.575,7.525 L12.515,7.520 L12.453,7.517 L12.390,7.516 L12.367,7.516 L12.343,7.513 L12.321,7.509 L12.299,7.504 L12.277,7.498 L12.256,7.491 L12.236,7.484 L12.216,7.476 L12.197,7.467 L12.179,7.459 L12.161,7.450 L12.145,7.441 L12.119,7.427 L12.094,7.409 L12.071,7.388 L12.051,7.364 L12.033,7.338 L12.019,7.309 L12.009,7.279 L12.003,7.246 L12.002,7.211 L12.007,7.174 L12.018,7.136 L12.035,7.096 L12.044,7.081 L12.056,7.064 L12.071,7.045 L12.088,7.025 L12.107,7.004 L12.126,6.983 L12.146,6.963 L12.165,6.944 L12.182,6.927 L12.198,6.913 L12.211,6.901 L12.220,6.893 L12.307,6.850 L12.396,6.816 L12.486,6.793 L12.578,6.778 L12.671,6.771 L12.764,6.773 L12.858,6.781 L12.953,6.796 L13.047,6.817 L13.141,6.843 L13.234,6.874 L13.326,6.908 L13.409,6.946 L13.490,6.987 L13.568,7.034 L13.645,7.086 L13.722,7.142 L13.798,7.203 L13.875,7.268 L13.953,7.338 L14.033,7.412 L14.116,7.491 L14.202,7.575 L14.292,7.663 L14.380,7.765 L14.457,7.857 L14.524,7.939 L14.583,8.013 L14.636,8.081 L14.683,8.145 L14.727,8.207 L14.770,8.268 L14.812,8.331 L14.855,8.397 L14.902,8.468 L14.953,8.545 L14.995,8.609 L15.036,8.674 L15.077,8.739 L15.116,8.804 L15.155,8.871 L15.192,8.938 L15.228,9.006 L15.262,9.075 L15.295,9.145 L15.326,9.217 L15.356,9.290 L15.383,9.364 L15.396,9.410 L15.403,9.455 L15.404,9.498 L15.398,9.539 L15.387,9.579 L15.370,9.616 L15.347,9.652 L15.317,9.686 L15.282,9.718 L15.241,9.747 L15.194,9.774 L15.142,9.799 Z"
	];

// src/features/whale-motion/playback.ts
/** Pause the component's looping SVG without resetting its timeline. */
	function attachLoopPlayback(svg, doc, motion) {
		const sync = () => {
			if (doc.hidden || motion?.matches) svg.pauseAnimations();
			else svg.unpauseAnimations();
		};
		doc.addEventListener("visibilitychange", sync);
		motion?.addEventListener("change", sync);
		sync();
		return () => {
			doc.removeEventListener("visibilitychange", sync);
			motion?.removeEventListener("change", sync);
			svg.pauseAnimations();
		};
	}

// src/features/whale-motion/client.ts
	const SHAPES = TAIL_SHAPES.join(";");
	const TAIL_TIMES = "0;.076923;.144231;.215385;.288462;.365385;.442308;.548077;1";
	const TAIL_SPLINES = Array(8).fill(".333333 0 .666667 1").join(";");
	const STYLES = `
.power-dsh-whale-motion { display:inline-block; position:relative; flex-shrink:0; vertical-align:middle; pointer-events:none; }
.power-dsh-whale-motion .power-dsh-whale-clip { position:absolute; overflow:hidden; pointer-events:none; }
.power-dsh-whale-motion svg { display:block; position:absolute; overflow:visible; }
.power-dsh-whale-motion .power-dsh-whale-still { display:none; }
@media (prefers-reduced-motion:reduce) {
  .power-dsh-whale-motion .power-dsh-whale-animated { display:none; }
  .power-dsh-whale-motion .power-dsh-whale-still { display:inline; }
}
`;
	function createClientFeature(runtime, env) {
		const { React, h, observable, useSnapshot } = runtime;
		const { ctx, source, t } = env;
		let fault = null;
		const status = observable(() => fault);
		const setting = {
			field: "whaleMotionEnabled",
			description: "whaleMotionDescription"
		};
		function setFault(failed) {
			if (Boolean(fault) === failed) return;
			fault = failed ? { observedAt: (/* @__PURE__ */ new Date()).toISOString() } : null;
			status.notify();
		}
		function AnimatedWhale({ size = 24 }) {
			const box = React.useRef(null);
			React.useEffect(() => {
				const svg = box.current?.querySelector?.("svg");
				if (!svg || typeof svg.pauseAnimations !== "function") return;
				const motion = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
				return attachLoopPlayback(svg, document, motion);
			}, []);
			const height = size * 17.04 / 23.16;
			const pad = size / 6;
			return h("span", {
				className: "power-dsh-whale-motion",
				ref: box,
				"aria-hidden": true,
				style: {
					width: size,
					height
				}
			}, h("style", null, STYLES), h("span", {
				className: "power-dsh-whale-clip",
				style: { inset: -pad }
			}, h("svg", {
				width: size,
				height,
				viewBox: "0 0 23.16 17.04",
				fill: "none",
				focusable: false,
				style: {
					left: pad,
					top: pad
				}
			}, h("path", {
				className: "power-dsh-whale-still",
				fill: "currentColor",
				d: FISH_PATH
			}), h("path", {
				className: "power-dsh-whale-animated",
				fill: "currentColor",
				fillRule: "evenodd",
				d: TAIL_SHAPES[0]
			}, h("animate", {
				attributeName: "d",
				values: SHAPES,
				keyTimes: TAIL_TIMES,
				calcMode: "spline",
				keySplines: TAIL_SPLINES,
				dur: "5.2s",
				repeatCount: "indefinite"
			})))));
		}
		ctx.slots.inject("sidebar.brand.mark", () => {
			let release = null;
			let attempted = false;
			const sync = () => {
				const snapshot = source.getSnapshot();
				if (!(snapshot.status === "ready" && snapshot.value?.whaleMotionEnabled === true)) {
					release?.();
					release = null;
					attempted = false;
					setFault(false);
				} else if (!release && !attempted) {
					attempted = true;
					try {
						release = ctx.slots.register({
							name: "sidebar.brand.mark",
							priority: -1
						}, AnimatedWhale);
						setFault(false);
					} catch {
						setFault(true);
					}
				}
			};
			sync();
			const unsubscribe = source.subscribe(sync);
			return () => {
				unsubscribe();
				release?.();
				setFault(false);
			};
		});
		return {
			settings: [setting],
			useSettings() {
				const failure = useSnapshot(status);
				return [!failure ? setting : {
					...setting,
					failure: {
						message: t("whaleMotionUnavailable"),
						code: "PD-WHALE-SLOT",
						operation: "whale-motion.register",
						observedAt: failure.observedAt
					}
				}];
			}
		};
	}

// src/features/whale-motion/definition.ts
	const definition = Object.freeze({
		id: "whale-motion",
		category: "interface",
		order: 5.5,
		keys: Object.freeze(["whaleMotionEnabled"]),
		spec: "src/features/whale-motion/spec.md"
	});

// src/features/whale-motion/locales.ts
	const locales$1 = {
		en: {
			whaleMotionEnabled: "Whale animation",
			whaleMotionDescription: "Let the upper-left whale wave its tail in a loop",
			whaleMotionUnavailable: "Could not display the whale animation. Turn it off and on to retry."
		},
		zh: {
			whaleMotionEnabled: "鲸鱼动效",
			whaleMotionDescription: "让左上角的小鲸鱼轻轻循环摆尾",
			whaleMotionUnavailable: "鲸鱼动效未能显示，请关闭后重新开启。"
		}
	};

// src/app/client-features.ts
	const clientFeatures = [
		{
			definition,
			create: createClientFeature,
			locales: locales$1,
			rpc: []
		},
		{
			definition: definition$4,
			create: createClientFeature$4,
			locales: locales$5,
			rpc: []
		},
		{
			definition: definition$17,
			create: createClientFeature$17,
			locales: locales$18,
			rpc: []
		},
		{
			definition: definition$12,
			create: createClientFeature$12,
			locales: locales$13,
			rpc: []
		},
		{
			definition: definition$11,
			create: createClientFeature$11,
			locales: locales$12,
			rpc: rpc$8
		},
		{
			definition: definition$14,
			create: createClientFeature$14,
			locales: locales$15,
			rpc: rpc$10
		},
		{
			definition: definition$13,
			create: createClientFeature$13,
			locales: locales$14,
			rpc: rpc$9
		},
		{
			definition: definition$9,
			create: createClientFeature$9,
			locales: locales$10,
			rpc: rpc$6
		},
		{
			definition: definition$15,
			create: createClientFeature$15,
			locales: locales$16,
			rpc: rpc$11
		},
		{
			definition: definition$18,
			create: createClientFeature$18,
			locales: locales$19,
			rpc: rpc$12
		},
		{
			definition: definition$10,
			create: createClientFeature$10,
			locales: locales$11,
			rpc: rpc$7
		},
		{
			definition: definition$8,
			create: createClientFeature$8,
			locales: locales$9,
			rpc: rpc$5
		},
		{
			definition: definition$7,
			create: createClientFeature$7,
			locales: locales$8,
			rpc: rpc$4
		},
		{
			definition: definition$6,
			create: createClientFeature$6,
			locales: locales$7,
			rpc: rpc$3
		},
		{
			definition: definition$5,
			create: createClientFeature$5,
			locales: locales$6,
			rpc: rpc$2
		},
		{
			definition: definition$16,
			create: createClientFeature$16,
			locales: locales$17,
			rpc: []
		},
		{
			definition: definition$3,
			create: createClientFeature$3,
			locales: locales$4,
			rpc: []
		},
		{
			definition: definition$2,
			create: createClientFeature$2,
			locales: locales$3,
			rpc: rpc$1
		},
		{
			definition: definition$1,
			create: createClientFeature$1,
			locales: locales$2,
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
			"settingsOutdated": "The Host has not loaded personalization yet. Re-enable power-dsh in plugin management, then try again."
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
			"settingsOutdated": "个性化功能尚未在后端加载，请在插件管理中重新启用 power-dsh 后重试。"
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