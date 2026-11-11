import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import z from "@deepseek-ai/schemastery";
import { spawn } from "node:child_process";
import { access, lstat, mkdir, readFile, readdir, realpath, rename, unlink, writeFile } from "node:fs/promises";
import path, { basename, dirname, isAbsolute, join, normalize, resolve, win32 } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { linkSync, lstatSync, mkdtempSync, readdirSync, renameSync, rmdirSync, unlinkSync } from "node:fs";
import { defineTool } from "@deepseek-ai/dsh-tools";

// \0rolldown/runtime.js
var __defProp = Object.defineProperty;
var __exportAll = (all, flags) => {
	let target = Object.setPrototypeOf({}, null);
	for (var name in all) {
		__defProp(target, name, {
			get: all[name],
			enumerable: true
		});
	}
	if (!(flags & 1)) {
		__defProp(target, Symbol.toStringTag, { value: "Module" });
	}
	return flags & 2 ? target : Object.preventExtensions(target);
};

// src/shared/host/native.ts
/** Cordis owns the actual context object; only its consumed structural surface crosses this adapter. */
const NativeRemoteService = TypertRemoteService;
function errorCode(error) {
	return typeof error === "object" && error !== null && "code" in error ? error.code : void 0;
}
function errorMessage(error) {
	return typeof error === "object" && error !== null && "message" in error && typeof error.message === "string" ? error.message : "";
}

// src/shared/host/operation-queue.ts
var OperationQueue = class {
	closed;
	tail;
	constructor() {
		this.closed = false;
		this.tail = Promise.resolve();
	}
	ensureActive() {
		if (this.closed) throw Object.assign(/* @__PURE__ */ new Error("Mod has been unloaded. Retry after enabling it again."), { code: "mod/unloaded" });
	}
	run(operation) {
		const task = this.tail.then(() => {
			this.ensureActive();
			return operation();
		});
		this.tail = task.catch(() => {});
		return task;
	}
	close() {
		this.closed = true;
	}
};

// src/features/version-display/definition.ts
const definition$20 = Object.freeze({
	id: "version-display",
	category: "interface",
	order: 6,
	keys: Object.freeze(["showVersion"]),
	spec: "src/features/version-display/spec.md"
});

// src/features/version-display/config.ts
var config_exports$20 = /* @__PURE__ */ __exportAll({
	configFields: () => configFields$20,
	settingsTool: () => settingsTool$10
});
const configFields$20 = { showVersion: z.boolean().default(false).volatile() };
const settingsTool$10 = {
	parameters: { showVersion: {
		type: "boolean",
		description: "Show the DSH version beside the upper-left brand when true. Omit to keep it unchanged."
	} },
	output: {
		showVersion: {
			type: "boolean",
			required: true
		},
		version: {
			oneOf: [{ type: "string" }, { type: "null" }],
			required: true
		}
	},
	mutations: [{
		field: "showVersion",
		order: 0
	}],
	reads: [{
		order: 2,
		read({ config }) {
			return { showVersion: config.showVersion.get() };
		}
	}, {
		order: 9,
		read({ ctx }) {
			return { version: ctx.clientModules.graph().release?.version ?? null };
		}
	}]
};

// src/features/appearance-shortcut/definition.ts
const definition$19 = Object.freeze({
	id: "appearance-shortcut",
	category: "interface",
	order: 4,
	keys: Object.freeze(["showThemeSwitcher"]),
	spec: "src/features/appearance-shortcut/spec.md"
});

// src/features/appearance-shortcut/config.ts
var config_exports$19 = /* @__PURE__ */ __exportAll({
	configFields: () => configFields$19,
	settingsTool: () => settingsTool$9
});
const configFields$19 = { showThemeSwitcher: z.boolean().default(false).volatile() };
const settingsTool$9 = {
	parameters: { showThemeSwitcher: {
		type: "boolean",
		description: "Show the appearance shortcut at the sidebar bottom when expanded. Omit to keep it unchanged."
	} },
	output: { showThemeSwitcher: {
		type: "boolean",
		required: true
	} },
	mutations: [{
		field: "showThemeSwitcher",
		order: 1
	}],
	reads: [{
		order: 3,
		read({ config }) {
			return { showThemeSwitcher: config.showThemeSwitcher.get() };
		}
	}]
};

// src/features/refresh-button/definition.ts
const definition$18 = Object.freeze({
	id: "refresh-button",
	category: "other",
	order: 1,
	keys: Object.freeze(["showRefreshButton"]),
	spec: "src/features/refresh-button/spec.md"
});

// src/features/refresh-button/config.ts
var config_exports$18 = /* @__PURE__ */ __exportAll({
	configFields: () => configFields$18,
	settingsTool: () => settingsTool$8
});
const configFields$18 = { showRefreshButton: z.boolean().default(false).volatile() };
const settingsTool$8 = {
	parameters: { showRefreshButton: {
		type: "boolean",
		description: "Show the interface refresh button while the sidebar is expanded. This preference does not trigger a refresh. Omit to keep it unchanged."
	} },
	output: { showRefreshButton: {
		type: "boolean",
		required: true
	} },
	mutations: [{
		field: "showRefreshButton",
		order: 2
	}],
	reads: [{
		order: 4,
		read({ config }) {
			return { showRefreshButton: config.showRefreshButton.get() };
		}
	}]
};

// src/features/restart-button/definition.ts
const definition$17 = Object.freeze({
	id: "restart-button",
	category: "other",
	order: 2,
	keys: Object.freeze(["showRestartButton"]),
	spec: "src/features/restart-button/spec.md"
});

// src/features/restart-button/config.ts
var config_exports$17 = /* @__PURE__ */ __exportAll({
	configFields: () => configFields$17,
	settingsTool: () => settingsTool$7
});
const configFields$17 = { showRestartButton: z.boolean().default(false).volatile() };
const settingsTool$7 = {
	parameters: { showRestartButton: {
		type: "boolean",
		description: "Show the desktop application restart button when supported. This preference does not restart the application. Omit to keep it unchanged."
	} },
	output: { showRestartButton: {
		type: "boolean",
		required: true
	} },
	mutations: [{
		field: "showRestartButton",
		order: 3
	}],
	reads: [{
		order: 5,
		read({ config }) {
			return { showRestartButton: config.showRestartButton.get() };
		}
	}]
};

// src/features/restart-button/restart.ts
const MAC_RESTART_SCRIPT = `on run argv
  set appPath to item 1 of argv
  delay 0.5
  with timeout of 120 seconds
    tell application appPath to quit
  end timeout
  repeat 120 times
    if not (application appPath is running) then
      do shell script "/usr/bin/open -a " & quoted form of appPath
      return
    end if
    delay 0.25
  end repeat
  error "Application did not exit" number 1001
end run`;
/** Only the packaged macOS desktop Host can hand off a graceful application restart. */
var DesktopRestart = class {
	config;
	platform;
	executable;
	env;
	readFile;
	realpath;
	spawn;
	closed;
	current;
	error;
	constructor(ctx, config, options = {}) {
		this.config = config;
		this.platform = options.platform ?? process.platform;
		this.executable = options.executable ?? process.execPath;
		this.env = options.env ?? process.env;
		this.readFile = options.readFile ?? readFile;
		this.realpath = options.realpath ?? realpath;
		this.spawn = options.spawn ?? spawn;
		this.closed = false;
		this.current = null;
		this.error = "";
		ctx.effect(() => () => this.close());
	}
	async target() {
		if (this.platform !== "darwin" || !this.env.DSH_CLIENT_VERSION) return null;
		try {
			const executable = await this.realpath(this.executable);
			const end = executable.indexOf(".app/Contents/MacOS/");
			if (end < 0) return null;
			const app = executable.slice(0, end + 4);
			const plist = await this.readFile(`${app}/Contents/Info.plist`, "utf8");
			if (!/<key>CFBundleIdentifier<\/key>\s*<string>com\.deepseek\.dsh<\/string>/.test(plist)) return null;
			return app;
		} catch (_error) {
			return null;
		}
	}
	async status() {
		if (this.closed) throw new Error("restartUnavailable");
		const supported = Boolean(await this.target());
		if (this.closed) throw new Error("restartUnavailable");
		return {
			supported,
			running: this.current !== null,
			error: this.error
		};
	}
	async restart() {
		if (this.closed || this.config.showRestartButton.get() !== true) throw new Error("restartUnavailable");
		if (this.current) throw new Error("restartBusy");
		const operation = {
			handle: null,
			handedOff: false
		};
		this.current = operation;
		this.error = "";
		try {
			const app = await this.target();
			if (this.closed || !app || this.config.showRestartButton.get() !== true) throw new Error("restartUnavailable");
			const env = { ...this.env };
			for (const key of [
				"ELECTRON_RUN_AS_NODE",
				"NODE_OPTIONS",
				"NODE_PATH"
			]) delete env[key];
			const child = this.spawn("/usr/bin/osascript", [
				"-e",
				MAC_RESTART_SCRIPT,
				app
			], {
				detached: true,
				stdio: "ignore",
				env
			});
			operation.handle = child;
			await new Promise((resolve, reject) => {
				child.once("error", reject);
				child.once("spawn", () => {
					if (this.closed) {
						child.kill();
						reject(/* @__PURE__ */ new Error("restartUnavailable"));
						return;
					}
					operation.handedOff = true;
					child.unref();
					resolve();
				});
				child.once("exit", (code) => {
					if (this.current === operation) {
						this.current = null;
						if (!this.closed && code !== 0) this.error = "restartFailed";
					}
				});
			});
			return { accepted: true };
		} catch (failure) {
			if (this.current === operation) this.current = null;
			if (errorMessage(failure) !== "restartUnavailable") this.error = "restartFailed";
			throw new Error(errorMessage(failure) === "restartUnavailable" ? "restartUnavailable" : "restartFailed");
		}
	}
	close() {
		this.closed = true;
		if (this.current && !this.current.handedOff) this.current.handle?.kill();
	}
};

// src/features/restart-button/host.ts
var host_exports$14 = /* @__PURE__ */ __exportAll({
	createHost: () => createHost$14,
	methods: () => methods$14
});
function createHost$14(ctx, config) {
	return { restart: new DesktopRestart(ctx, config) };
}
const methods$14 = {
	restartStatus() {
		return this.run(() => this.restart.status());
	},
	restartApp() {
		return this.run(() => this.restart.restart());
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
function isRecord$1(value) {
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
			if (!isRecord$1(value) || typeof value.supported !== "boolean" || typeof value.running !== "boolean" || !isOneOf(value.error, ["", "restartFailed"])) throw new TypeError("Invalid restart status");
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
			if (!isRecord$1(value) || value.accepted !== true) throw new TypeError("Invalid restart acceptance");
			return { accepted: true };
		} })
	}
};
const rpc$14 = [RESTART_STATUS_RPC, RESTART_APP_RPC];

// src/features/notifications/definition.ts
const definition$16 = Object.freeze({
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

// src/features/notifications/config.ts
var config_exports$16 = /* @__PURE__ */ __exportAll({ configFields: () => configFields$16 });
const configFields$16 = {
	notificationsEnabled: z.boolean().default(false).volatile(),
	notificationSoundEnabled: z.boolean().default(true).volatile(),
	notificationSound: z.string().default("default").volatile()
};

// src/features/notifications/notifications.ts
const summarySchema = { parse(value) {
	if (!isRecord$1(value) || typeof value.seq !== "number" || !Number.isSafeInteger(value.seq) || value.seq < -1 || typeof value.turn !== "number" || !Number.isSafeInteger(value.turn) || value.turn < 0 || typeof value.reason !== "string") throw new TypeError("Invalid power-dsh notification summary");
	return {
		seq: value.seq,
		turn: value.turn,
		reason: value.reason
	};
} };
/** Read-only summary; it adds no tools, prompts, or session events. */
function notificationProjection() {
	return {
		key: "powerDshNotifications",
		stateVersion: 1,
		stateSchema: summarySchema,
		init: () => ({
			seq: -1,
			turn: 0,
			reason: ""
		}),
		apply(state, event) {
			if (event.type !== "turn/end") return state;
			return {
				seq: event.seq,
				turn: event.data.turn,
				reason: event.data.reason.kind
			};
		},
		wire: {
			viewSchema: summarySchema,
			view: (state) => state
		}
	};
}

// src/features/notifications/system-sounds.ts
const DEFAULT_SOUND = {
	id: "default",
	name: "default"
};
const WINDOWS_ALIASES = /* @__PURE__ */ new Set([
	"SystemDefault",
	"SystemAsterisk",
	"SystemExclamation",
	"SystemHand",
	"SystemQuestion"
]);
const MAC_EXTENSIONS = /* @__PURE__ */ new Set([
	".aiff",
	".aif",
	".wav",
	".caf"
]);
function windowsCommand(alias) {
	return `$ErrorActionPreference = 'Stop'\nAdd-Type -TypeDefinition @'\nusing System;\nusing System.Runtime.InteropServices;\npublic static class DshModSystemSound {\n  [DllImport("winmm.dll", CharSet = CharSet.Unicode, SetLastError = true)]\n  [return: MarshalAs(UnmanagedType.Bool)]\n  public static extern bool PlaySound(string sound, IntPtr module, uint flags);\n}\n'@\nif (-not [DshModSystemSound]::PlaySound('${alias}', [IntPtr]::Zero, 0x00210002)) { throw 'System sound playback failed' }`;
}
/** Host-local built-in sounds; the Client must restrict native playback to local connections. */
var SystemSounds = class {
	ctx;
	config;
	platform;
	directory;
	readDirectory;
	fileInfo;
	realPath;
	timeoutMs;
	graceMs;
	closed;
	current;
	constructor(ctx, config, options = {}) {
		this.ctx = ctx;
		this.config = config;
		this.platform = options.platform ?? process.platform;
		this.directory = options.soundsDirectory ?? "/System/Library/Sounds";
		this.readDirectory = options.readDirectory ?? readdir;
		this.fileInfo = options.fileInfo ?? lstat;
		this.realPath = options.realPath ?? realpath;
		this.timeoutMs = options.timeoutMs ?? 1e4;
		this.graceMs = options.graceMs ?? 250;
		this.closed = false;
		this.current = null;
		ctx.effect(() => () => this.close());
	}
	async macFiles() {
		const entries = await this.readDirectory(this.directory, { withFileTypes: true });
		const files = /* @__PURE__ */ new Map();
		const root = await this.realPath(this.directory);
		for (const entry of entries) {
			if (!entry.isFile() || entry.name !== path.basename(entry.name) || entry.name.startsWith(".") || !MAC_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
			const filename = path.join(this.directory, entry.name);
			if (!(await this.fileInfo(filename)).isFile() || await this.realPath(filename) !== path.join(root, entry.name)) continue;
			files.set(`mac:${entry.name}`, {
				filename,
				name: path.basename(entry.name, path.extname(entry.name))
			});
		}
		return files;
	}
	async list() {
		if (this.closed) throw new Error("notificationSoundUnavailable");
		if (!this.ctx.get("subprocess") || !["darwin", "win32"].includes(this.platform)) return {
			platform: "other",
			sounds: [{ ...DEFAULT_SOUND }]
		};
		try {
			const sounds = this.platform === "darwin" ? [...await this.macFiles()].map(([id, value]) => ({
				id,
				name: value.name
			})) : [...WINDOWS_ALIASES].map((alias) => ({
				id: `win:${alias}`,
				name: alias
			}));
			if (this.closed) throw new Error("notificationSoundUnavailable");
			sounds.sort((left, right) => left.name.localeCompare(right.name));
			return {
				platform: this.platform,
				sounds: [{ ...DEFAULT_SOUND }, ...sounds]
			};
		} catch (_error) {
			throw new Error("notificationSoundUnavailable");
		}
	}
	automaticAllowed(id) {
		return this.config.notificationsEnabled.get() === true && this.config.notificationSoundEnabled.get() === true && this.config.notificationSound.get() === id;
	}
	async play(id, preview = false) {
		if (this.closed) throw new Error("notificationSoundUnavailable");
		if (typeof id !== "string" || typeof preview !== "boolean") throw new Error("notificationSoundInvalid");
		if (id === "default" || !preview && !this.automaticAllowed(id) || this.current) return { played: false };
		const subprocess = this.ctx.get("subprocess");
		if (!subprocess || !["darwin", "win32"].includes(this.platform)) throw new Error("notificationSoundUnavailable");
		const operation = {
			controller: new AbortController(),
			handle: null
		};
		this.current = operation;
		const timer = setTimeout(() => operation.controller.abort(), this.timeoutMs);
		try {
			let argv;
			if (this.platform === "darwin") {
				const sound = (await this.macFiles()).get(id);
				if (!sound) throw new Error("notificationSoundInvalid");
				argv = [await subprocess.resolveExecutable("/usr/bin/afplay", void 0, operation.controller.signal), sound.filename];
			} else {
				const alias = id.startsWith("win:") ? id.slice(4) : "";
				if (!WINDOWS_ALIASES.has(alias)) throw new Error("notificationSoundInvalid");
				argv = [
					await subprocess.resolveExecutable("powershell.exe", void 0, operation.controller.signal),
					"-NoLogo",
					"-NoProfile",
					"-NonInteractive",
					"-Command",
					windowsCommand(alias)
				];
			}
			if (this.closed || !preview && !this.automaticAllowed(id)) return { played: false };
			operation.controller.signal.throwIfAborted();
			const handle = subprocess.spawn({
				argv,
				cwd: process.cwd(),
				graceMs: this.graceMs,
				signal: operation.controller.signal,
				stdio: {
					stdin: "ignore",
					stdout: { maxBytes: 1024 },
					stderr: { maxBytes: 4096 }
				}
			});
			operation.handle = handle;
			const outcome = await handle.done;
			if (!await handle.waitForExit(operation.controller.signal)) throw new Error("notificationSoundFailed");
			operation.controller.signal.throwIfAborted();
			if (outcome.exitCode !== 0 || outcome.signal !== null) throw new Error("notificationSoundFailed");
			return { played: true };
		} catch (error) {
			operation.controller.abort();
			if (this.closed) return { played: false };
			throw new Error(errorMessage(error) === "notificationSoundInvalid" ? "notificationSoundInvalid" : "notificationSoundFailed");
		} finally {
			clearTimeout(timer);
			if (operation.controller.signal.aborted) operation.handle?.terminate();
			if (this.current === operation) this.current = null;
		}
	}
	async close() {
		this.closed = true;
		const operation = this.current;
		if (!operation) return;
		operation.controller.abort();
		const handle = operation.handle;
		if (!handle) return;
		handle.terminate();
		handle.done.catch(() => {});
		await Promise.allSettled([handle.waitForExit(AbortSignal.timeout(this.graceMs + 1e3))]);
	}
};

// src/features/notifications/host.ts
var host_exports$13 = /* @__PURE__ */ __exportAll({
	createHost: () => createHost$13,
	methods: () => methods$13
});
function createHost$13(ctx, config) {
	ctx.inject(["sessionProjections"], async (child) => {
		await child.sessionProjections.register(notificationProjection());
	});
	return { sounds: new SystemSounds(ctx, config) };
}
const methods$13 = {
	listSystemSounds() {
		return this.run(() => this.sounds.list());
	},
	playSystemSound(id, preview) {
		this.queue.ensureActive();
		if (this.ctx.invocation && this.ctx.invocation.peer.principal.kind !== "owner") throw new Error("Only the profile owner can play system sounds.");
		return this.sounds.play(id, preview);
	}
};

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
				if (!isRecord$1(value) || typeof value.blocked !== "boolean") throw new TypeError("Invalid policy result");
				return { blocked: value.blocked };
			} })
		}
	};
}

// src/features/notifications/rpc.ts
const soundCatalogCodec = {
	mode: "strict",
	typeSymbol: "power-dsh#SystemSounds",
	create: () => ({ parse(value) {
		if (!isRecord$1(value) || !isOneOf(value.platform, [
			"darwin",
			"win32",
			"other"
		]) || !isArray(value.sounds) || !value.sounds.every((row) => isRecord$1(row) && typeof row.id === "string" && typeof row.name === "string")) throw new TypeError("Invalid system sounds");
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
			if (!isRecord$1(value) || typeof value.played !== "boolean") throw new TypeError("Invalid sound playback");
			return { played: value.played };
		} })
	}
};
const rpc$13 = [LIST_SYSTEM_SOUNDS_RPC, PLAY_SYSTEM_SOUND_RPC];

// src/features/personalization/definition.ts
const definition$15 = Object.freeze({
	id: "personalization",
	category: "enhance",
	order: 9,
	keys: Object.freeze(["personalizationEnabled"]),
	spec: "src/features/personalization/spec.md"
});

// src/features/personalization/config.ts
var config_exports$15 = /* @__PURE__ */ __exportAll({ configFields: () => configFields$15 });
const configFields$15 = { personalizationEnabled: z.boolean().default(false).volatile() };

// src/features/personalization/personalization.ts
const MAX_PROMPT_LENGTH = 2e4;
const MAX_SOURCE_BYTES = 1048576;
function revision(text, exists) {
	return createHash("sha256").update(exists ? `file\0${text}` : "missing").digest("hex");
}
var PersonalizationFile = class {
	home;
	path;
	ensureActive;
	constructor(home, ensureActive = () => {}) {
		if (!isAbsolute(home)) throw new TypeError("DSH home must be absolute");
		this.home = resolve(home);
		this.path = join(this.home, "AGENTS.md");
		this.ensureActive = ensureActive;
	}
	async read() {
		this.ensureActive();
		let text = "";
		let exists = true;
		try {
			const info = await lstat(this.path);
			if (!info.isFile()) throw new Error("Global AGENTS.md must be a regular file.");
			if (info.size > MAX_SOURCE_BYTES) throw new Error("Global AGENTS.md exceeds the native 1 MiB source limit.");
			text = await readFile(this.path, "utf8");
		} catch (error) {
			if (errorCode(error) !== "ENOENT") throw error;
			exists = false;
		}
		this.ensureActive();
		return {
			path: this.path,
			text,
			revision: revision(text, exists)
		};
	}
	async save(text, expectedRevision) {
		if (typeof text !== "string" || text.length > 2e4) throw new TypeError("Instructions must be a string of at most 20000 characters.");
		if (typeof expectedRevision !== "string" || !/^[a-f\d]{64}$/.test(expectedRevision)) throw new TypeError("Expected an instruction file revision.");
		const check = async () => {
			const current = await this.read();
			if (current.revision !== expectedRevision) throw Object.assign(/* @__PURE__ */ new Error("Global AGENTS.md changed. Cancel to load the latest content before saving."), { code: "personalization/conflict" });
			return current;
		};
		const current = await check();
		if (current.text === text) return current;
		await mkdir(this.home, { recursive: true });
		const temporary = join(this.home, `.AGENTS.md.${randomUUID()}.tmp`);
		try {
			await writeFile(temporary, text, {
				encoding: "utf8",
				flag: "wx",
				mode: 384
			});
			await check();
			this.ensureActive();
			await rename(temporary, this.path);
		} finally {
			await unlink(temporary).catch((error) => {
				if (errorCode(error) !== "ENOENT") throw error;
			});
		}
		return this.read();
	}
};

// src/features/personalization/host.ts
var host_exports$12 = /* @__PURE__ */ __exportAll({
	createHost: () => createHost$12,
	methods: () => methods$12
});
function createHost$12(_ctx, _config, { owner, ensureActive }) {
	return { instructions: new PersonalizationFile(owner.profileContext.home, ensureActive) };
}
const methods$12 = {
	readPersonalization() {
		return this.run(() => this.instructions.read());
	},
	savePersonalization(text, revision) {
		return this.run(() => this.instructions.save(text, revision));
	}
};

// src/features/personalization/rpc.ts
const fileCodec = {
	mode: "strict",
	typeSymbol: "power-dsh#PersonalizationFile",
	create: () => ({ parse(value) {
		if (!isRecord$1(value) || typeof value.path !== "string" || typeof value.text !== "string" || typeof value.revision !== "string" || !/^[a-f\d]{64}$/.test(value.revision)) throw new TypeError("Invalid instruction file");
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
const rpc$12 = [READ_PERSONALIZATION_RPC, SAVE_PERSONALIZATION_RPC];

// src/features/skills/definition.ts
const definition$14 = Object.freeze({
	id: "skills",
	category: "enhance",
	order: 7,
	keys: Object.freeze(["skillManagerEnabled", "disabledSkills"]),
	spec: "src/features/skills/spec.md"
});

// src/features/skills/config.ts
var config_exports$14 = /* @__PURE__ */ __exportAll({ configFields: () => configFields$14 });
const configFields$14 = {
	skillManagerEnabled: z.boolean().default(false).volatile(),
	disabledSkills: z.array(z.object({
		name: z.string().required(),
		description: z.string().required(),
		source: z.string().required(),
		provider: z.string().required(),
		path: z.string().required(),
		scope: z.string().default(""),
		projectRoot: z.string().default(""),
		origin: z.string().default("")
	})).default([]).volatile()
};

// src/features/skills/skill-origin.ts
const PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
const DIRECTORY_NAME = /^\.[a-z0-9][a-z0-9._-]*$/i;
const BUNDLED_PROVIDERS = /* @__PURE__ */ new Map([["dsh-office", "@deepseek-ai/dsh-skill-office"], ["dsh-badge", "@deepseek-ai/dsh-skill-badge"]]);
const DIRECTORIES = /* @__PURE__ */ new Map([
	["user-dsh", ".dsh"],
	["project-dsh", ".dsh"],
	["user-agents", ".agents"],
	["project-agents", ".agents"]
]);
const absolutePath = (value) => typeof value === "string" && (isAbsolute(value) || win32.isAbsolute(value));
function directoryAt(path) {
	if (!absolutePath(path)) return "";
	return [...path.replaceAll("\\", "/").matchAll(/(?:^|\/)(\.[a-z0-9][a-z0-9._-]*)\/skills(?=\/|$)/gi)].at(-1)?.[1] ?? "";
}
async function packageAt(path, readPackage) {
	const filename = path.replaceAll("\\", "/");
	const candidates = [...filename.matchAll(/(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)/g)].filter((match) => match[1] !== ".pnpm").reverse();
	for (const match of candidates) {
		const expected = match[1];
		if (!PACKAGE_NAME.test(expected)) continue;
		const end = match.index + match[0].length;
		const manifest = join(filename.slice(0, end), "package.json");
		try {
			if (JSON.parse(await readPackage(manifest, "utf8")).name === expected) return expected;
		} catch (_error) {}
		return "";
	}
	return "";
}
/** Resolve a display-only origin from public skill paths or confirmed package metadata, without reading skill bodies. */
async function skillOrigin(skill, { readPackage = readFile } = {}) {
	if (DIRECTORIES.has(skill.source)) return DIRECTORIES.get(skill.source);
	const paths = [skill.path, skill.resourceBase?.kind === "directory" ? skill.resourceBase.path : void 0];
	if (!([
		"runtime",
		"plugin",
		"bundled"
	].includes(skill.source) || skill.source?.startsWith("bundled-"))) {
		for (const path of paths) {
			const directory = directoryAt(path);
			if (directory) return directory;
		}
		return typeof skill.origin === "string" && DIRECTORY_NAME.test(skill.origin) ? skill.origin : directoryAt(skill.origin);
	}
	if (typeof skill.origin === "string" && PACKAGE_NAME.test(skill.origin)) return skill.origin;
	if (skill.source === "bundled" && BUNDLED_PROVIDERS.has(skill.provider)) return BUNDLED_PROVIDERS.get(skill.provider);
	for (const path of paths) {
		if (!absolutePath(path)) continue;
		const owner = await packageAt(path, readPackage);
		if (owner) return owner;
	}
	return "";
}

// src/features/skills/skill-policy.ts
const PROVIDER = "power-dsh-disabled-skills";
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const USER_RANK = 225;
const PROJECT_RANK = Number.MIN_SAFE_INTEGER;
function isProject(source) {
	return source === "project" || source.startsWith("project-");
}
function keyOf(scope, projectRoot, name) {
	return JSON.stringify([
		scope,
		projectRoot,
		name
	]);
}
function skillPath(skill) {
	return skill.path || (skill.resourceBase?.kind === "directory" ? skill.resourceBase.path : "") || "";
}
function recordOf(skill, scope, projectRoot = "") {
	return {
		name: skill.name,
		description: skill.description,
		source: skill.source,
		provider: skill.provider,
		path: skillPath(skill),
		scope,
		projectRoot,
		origin: skill.origin ?? ""
	};
}
function legacyProjectRoot(path) {
	if (!isAbsolute(path)) return "";
	const normalized = resolve(path).replaceAll("\\", "/");
	const index = normalized.search(/\/\.(?:dsh|agents)\/skills\//);
	return index < 0 ? "" : resolve(normalized.slice(0, index) || "/");
}
function records(value) {
	if (!Array.isArray(value) || value.length > 2048) throw new Error("Invalid DSH skill preferences.");
	const result = /* @__PURE__ */ new Map();
	for (const row of value) {
		if (!isRecord$1(row) || typeof row.name !== "string" || !NAME.test(row.name) || !hasStrings(row, [
			"name",
			"description",
			"source",
			"provider",
			"path"
		]) || !row.description || row.scope !== void 0 && !isOneOf(row.scope, [
			"",
			"user",
			"project"
		]) || row.projectRoot !== void 0 && typeof row.projectRoot !== "string" || row.origin !== void 0 && typeof row.origin !== "string") throw new Error("Invalid DSH skill preferences.");
		const scope = row.scope || (isProject(row.source) ? "project" : "user");
		let projectRoot = "";
		if (scope === "project") {
			if (row.projectRoot && !isAbsolute(row.projectRoot)) throw new Error("Invalid DSH project skill preferences.");
			projectRoot = row.projectRoot ? resolve(row.projectRoot) : legacyProjectRoot(row.path);
		}
		const key = keyOf(scope, projectRoot, row.name);
		if (result.has(key)) throw new Error("Invalid DSH skill preferences.");
		result.set(key, recordOf(row, scope, projectRoot));
	}
	return result;
}
var SkillPolicy = class {
	owner;
	config;
	ensureActive;
	ctx;
	createScope;
	registry;
	controls;
	agents;
	scopes;
	scopeTasks;
	releases;
	closed;
	ready;
	constructor(ctx, config, { ensureActive = () => {} } = {}) {
		this.owner = ctx;
		this.config = config;
		this.ensureActive = ensureActive;
		this.controls = /* @__PURE__ */ new Set();
		this.agents = /* @__PURE__ */ new Map();
		this.scopes = /* @__PURE__ */ new Map();
		this.scopeTasks = /* @__PURE__ */ new Map();
		this.releases = [];
		this.closed = false;
		this.ready = null;
	}
	preferences() {
		return records(this.config.disabledSkills.get());
	}
	active() {
		this.ensureActive();
		if (this.closed) throw new Error("Skill management has been unloaded.");
	}
	bind(ctx, createScope) {
		this.ctx = ctx;
		this.createScope = createScope;
		this.registry = ctx.get("skills");
		if (!this.registry?.registerProvider || !this.registry.snapshot) throw new Error("DSH skill management is unavailable.");
		this.releases.push(this.register(ctx));
		this.releases.push(ctx.on("agent/created", ({ agent }) => this.attachAgent(agent), {
			global: true,
			prepend: true
		}));
		this.releases.push(ctx.on("agent-preset/selected", (sessionId) => {
			const agent = ctx.agents.get(sessionId);
			if (agent) this.attachAgent(agent);
		}, { global: true }));
		this.releases.push(ctx.on("settings/document-updated", (namespace) => {
			if (namespace === this.owner.fiber.entry.options.id) this.invalidate();
		}));
		this.releases.push(ctx.on("app-boot/config-reload", () => this.invalidate()));
		this.releases.push(ctx.on("agent/disposed", ({ agent }) => {
			this.agents.get(agent)?.stop();
			this.agents.delete(agent);
		}, { global: true }));
		this.releases.push(ctx.on("plugin-manager/changed", () => {
			this.warmScopes().catch(() => {});
			for (const agent of ctx.agents.list()) this.attachAgent(agent);
			this.invalidate();
		}));
		for (const agent of ctx.agents.list()) this.attachAgent(agent);
		if (ctx.loader?.await) ctx.loader.await().then(() => this.warmScopes()).catch(() => {});
	}
	async projectRoot(cwd) {
		const start = resolve(cwd);
		const fs = this.ctx.get("fs");
		for (let current = start;; current = dirname(current)) {
			let exists = false;
			try {
				const marker = join(current, ".git");
				if (fs) exists = await fs.stat(await fs.resolve(marker)) !== void 0;
				else {
					await access(marker);
					exists = true;
				}
			} catch (_error) {}
			if (exists) return current;
			if (dirname(current) === current) return start;
		}
	}
	register(context, projectOnly = false) {
		if (this.closed) throw new Error("Skill management has been unloaded.");
		let control;
		const stop = context.get("skills").registerProvider((lifecycle) => {
			control = lifecycle;
			this.controls.add(lifecycle);
			lifecycle.signal.addEventListener("abort", () => this.controls.delete(lifecycle), { once: true });
			return {
				name: PROVIDER,
				list: async (options = {}) => {
					const preferences = [...this.preferences().values()];
					const root = options.cwd !== void 0 && preferences.some((row) => row.scope === "project" && row.projectRoot) ? await this.projectRoot(options.cwd) : "";
					return preferences.filter((row) => row.scope === "user" ? !projectOnly : root && row.projectRoot === root).map((row) => ({
						...row,
						provider: PROVIDER,
						rank: row.scope === "user" ? USER_RANK : PROJECT_RANK,
						locator: row,
						invocation: {
							modelInvocable: false,
							userInvocable: false
						}
					}));
				},
				get: async (candidate) => ({
					...candidate.locator,
					provider: PROVIDER,
					content: "",
					invocation: {
						modelInvocable: false,
						userInvocable: false
					}
				})
			};
		});
		let disposed = false;
		return () => {
			if (disposed) return;
			disposed = true;
			if (control) this.controls.delete(control);
			stop();
		};
	}
	attachAgent(agent) {
		if (this.closed || this.agents.get(agent)?.ctx === agent.ctx) return;
		if (this.ctx.agentPresets.serviceFor(agent, "skills") !== void 0) return;
		this.agents.get(agent)?.stop();
		try {
			const stop = this.register(agent.ctx, true);
			this.agents.set(agent, {
				ctx: agent.ctx,
				stop
			});
		} catch (error) {
			if (errorCode(error) !== "INACTIVE_EFFECT") throw error;
		}
	}
	invalidate() {
		for (const control of this.controls) if (!control.signal.aborted) control.invalidate();
	}
	async warmScopes() {
		if (this.closed) return;
		const prepareAll = this.preferences().size > 0;
		const compositions = await this.ctx.agentPresets.compositionInventory();
		if (this.closed) return;
		const supported = compositions.filter((row) => !row.broken && !row.rows.some((entry) => entry.moduleName === "@deepseek-ai/dsh-skill" && entry.enabled !== false));
		for (const [preset, entry] of this.scopes) {
			if (supported.some((row) => row.id === preset)) continue;
			this.scopes.delete(preset);
			entry.stop();
			try {
				await entry.scope.dispose();
			} finally {
				await entry.lease[Symbol.asyncDispose]();
			}
		}
		for (const row of supported) {
			if (this.closed) return;
			if (!prepareAll && !this.scopes.has(row.id)) continue;
			await this.scope(row.id);
		}
	}
	scope(preset) {
		const pending = this.scopeTasks.get(preset);
		if (pending) return pending;
		const task = this.openScope(preset).finally(() => this.scopeTasks.delete(preset));
		this.scopeTasks.set(preset, task);
		return task;
	}
	async openScope(preset) {
		this.active();
		const lease = await this.ctx.agentPresets.acquireScope(preset);
		if (this.closed) {
			await lease[Symbol.asyncDispose]();
			this.active();
			throw new Error("Skill management has been unloaded.");
		}
		const previous = this.scopes.get(preset);
		if (previous && previous.lease.key === lease.key) {
			await lease[Symbol.asyncDispose]();
			return previous.lease.key;
		}
		let scope;
		let stop;
		try {
			scope = this.createScope(this.ctx, lease.key);
			stop = this.register(scope.ctx);
		} catch (error) {
			try {
				await scope?.dispose();
			} finally {
				await lease[Symbol.asyncDispose]();
			}
			throw error;
		}
		this.scopes.set(preset, {
			lease,
			scope,
			stop
		});
		if (previous) {
			previous.stop();
			try {
				await previous.scope.dispose();
			} finally {
				await previous.lease[Symbol.asyncDispose]();
			}
		}
		return lease.key;
	}
	async context(cwd, scope) {
		if (typeof cwd !== "string" || typeof scope !== "string" || ![
			"",
			"user",
			"project"
		].includes(scope)) throw new TypeError("Invalid skill context.");
		await this.ready;
		this.active();
		if (!this.ctx || this.closed) throw new Error("DSH skill management is unavailable.");
		const workspaces = this.ctx.workspaceRegistry.list().map((row) => ({
			path: resolve(row.path),
			title: row.title
		}));
		scope ||= "user";
		const defaultDirectory = resolve(this.ctx.workingDirectory.defaultDirectory);
		const firstProject = workspaces.find((row) => row.path === defaultDirectory) ?? workspaces[0];
		cwd = scope === "user" ? "" : cwd ? resolve(cwd) : firstProject?.path ?? "";
		if (scope === "project" && cwd && !workspaces.some((row) => row.path === cwd)) throw new Error("The selected skill workspace is no longer available.");
		const preset = this.ctx.agentPresets.defaultId;
		const composition = (await this.ctx.agentPresets.compositionInventory()).find((row) => row.id === preset && !row.broken);
		this.active();
		if (!composition) throw new Error("The current DSH skill composition is unavailable.");
		if (composition.rows.some((row) => row.moduleName === "@deepseek-ai/dsh-skill" && row.enabled !== false)) throw new Error("The current mode provides an isolated skill service and cannot currently be managed here.");
		const scopeKey = await this.scope(preset);
		const projectRoot = scope === "project" && cwd ? await this.projectRoot(cwd) : "";
		this.active();
		return {
			cwd,
			scope,
			workspaces,
			projectRoot,
			scopeKey
		};
	}
	lookup(view) {
		return view.scope === "project" ? {
			cwd: view.cwd,
			scope: view.scopeKey
		} : { scope: view.scopeKey };
	}
	async readView(view) {
		if (view.scope === "project" && !view.cwd) {
			this.active();
			return {
				cwd: "",
				scope: "project",
				workspaces: view.workspaces,
				complete: true,
				skills: []
			};
		}
		const snapshot = await this.registry.snapshot(this.lookup(view));
		this.active();
		const preferences = this.preferences();
		const skills = await Promise.all(snapshot.skills.filter((skill) => isProject(skill.source) === (view.scope === "project")).map(async (skill) => {
			const key = keyOf(view.scope, view.projectRoot, skill.name);
			const masked = skill.provider === PROVIDER;
			const original = masked ? preferences.get(key) ?? skill : skill;
			const modelInvocable = skill.invocation.modelInvocable;
			const userInvocable = skill.invocation.userInvocable;
			const enabled = modelInvocable || userInvocable;
			const legacy = view.scope === "project" && preferences.has(keyOf("project", "", skill.name));
			const reason = !snapshot.complete ? "incomplete" : legacy ? "legacy-scope" : !masked && !enabled ? "source-disabled" : preferences.has(key) && enabled ? "unsupported" : "";
			return {
				name: skill.name,
				description: original.description,
				source: original.source,
				path: skillPath(original),
				origin: await skillOrigin(original),
				enabled,
				modelInvocable,
				userInvocable,
				canToggle: snapshot.complete && reason === "",
				reason
			};
		}));
		this.active();
		return {
			cwd: view.cwd,
			scope: view.scope,
			workspaces: view.workspaces,
			complete: snapshot.complete,
			skills
		};
	}
	async list(cwd = "", scope = "") {
		return this.readView(await this.context(cwd, scope));
	}
	/**
	* Load one skill's body for the read-only detail dialog.
	*
	* The body is read through the same preset scope the catalog used, so a
	* project copy resolves exactly as the listed row did. Nothing is cached,
	* written, or kept after the response.
	* @param cwd - project directory for the project scope; ignored for user scope.
	* @param scope - `user` or `project`.
	* @param name - skill name as the catalog lists it.
	* @returns the skill with its Markdown body, or null when it is not listed.
	*/
	async read(cwd, scope, name) {
		if (typeof name !== "string" || !NAME.test(name)) throw new TypeError("Invalid skill operation.");
		const view = await this.context(cwd, scope);
		const row = (await this.readView(view)).skills.find((skill) => skill.name === name);
		if (!row) return null;
		let content = "";
		try {
			const definition = await this.registry.get(name, this.lookup(view));
			this.active();
			if (definition === void 0) return null;
			if (typeof definition?.content === "string") content = definition.content;
		} catch (error) {
			if (errorCode(error) === "INACTIVE_EFFECT") throw error;
			this.active();
			throw new Error("The skill body could not be read.");
		}
		this.active();
		return {
			name: row.name,
			description: row.description,
			content,
			source: row.source,
			path: row.path,
			origin: row.origin,
			enabled: row.enabled,
			modelInvocable: row.modelInvocable,
			userInvocable: row.userInvocable
		};
	}
	async setEnabled(cwd, scope, name, enabled) {
		if (typeof name !== "string" || !NAME.test(name) || typeof enabled !== "boolean") throw new TypeError("Invalid skill operation.");
		const view = await this.context(cwd, scope);
		const before = await this.readView(view);
		const row = before.skills.find((skill) => skill.name === name);
		if (!before.complete || !row?.canToggle) throw new Error("This skill cannot currently be changed in DSH.");
		if (row.enabled === enabled) return before;
		const native = await this.registry.snapshot(this.lookup(view));
		if (!native.complete) throw new Error("Skill discovery is incomplete. Refresh and try again.");
		const skill = native.skills.find((item) => item.name === name && isProject(item.source) === (view.scope === "project"));
		if (!skill) throw new Error("This skill is no longer available.");
		const origin = enabled ? "" : await skillOrigin(skill);
		this.active();
		await this.ctx.configEditor.edit(this.owner.fiber.entry, (raw) => {
			this.active();
			if (Object.hasOwn(raw, "disabledSkills") && !Array.isArray(raw.disabledSkills)) throw new Error("Skill preferences are controlled by an expression and cannot be changed here.");
			const next = records(raw.disabledSkills ?? this.config.disabledSkills.get());
			const key = keyOf(view.scope, view.projectRoot, name);
			if (enabled) next.delete(key);
			else next.set(key, recordOf({
				...skill,
				origin
			}, view.scope, view.projectRoot));
			if (next.size > 2048) throw new Error("Too many disabled skill preferences.");
			return {
				...raw,
				disabledSkills: [...next.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value)
			};
		});
		this.active();
		this.invalidate();
		for (const agent of this.ctx.agents.list()) this.attachAgent(agent);
		await this.warmScopes();
		const after = await this.list(before.cwd, before.scope);
		if (after.skills.find((item) => item.name === name)?.enabled !== enabled) throw new Error("DSH did not accept the requested skill state. Refresh the list to inspect its actual state.");
		return after;
	}
	async close() {
		if (this.closed) return;
		this.closed = true;
		for (const release of this.releases.splice(0).reverse()) release();
		for (const entry of this.agents.values()) entry.stop();
		this.agents.clear();
		for (const entry of this.scopes.values()) {
			entry.stop();
			try {
				await entry.scope.dispose();
			} finally {
				await entry.lease[Symbol.asyncDispose]();
			}
		}
		this.scopes.clear();
	}
};

// src/features/skills/host.ts
var host_exports$11 = /* @__PURE__ */ __exportAll({
	createHost: () => createHost$11,
	methods: () => methods$11
});
function createHost$11(ctx, config, { owner, ensureActive }) {
	const skills = { current: null };
	ctx.inject([
		"skills",
		"agents",
		"agentPresets",
		"workspaceRegistry",
		"workingDirectory",
		"loader"
	], (child) => {
		const manager = new SkillPolicy(owner, config, { ensureActive });
		skills.current = manager;
		manager.ready = child.loader.import("@deepseek-ai/dsh-scope").then(({ createScope }) => {
			ensureActive();
			if (!manager.closed) manager.bind(child, createScope);
		});
		manager.ready.catch(() => {});
		child.effect(() => () => {
			if (skills.current === manager) skills.current = null;
			return manager.close();
		});
	});
	return { skills };
}
const methods$11 = {
	listSkills(cwd, scope) {
		return this.run(() => {
			if (!this.skills.current) throw new Error("DSH skill management is unavailable.");
			return this.skills.current.list(cwd, scope);
		});
	},
	readSkill(cwd, scope, name) {
		return this.run(() => {
			if (!this.skills.current) throw new Error("DSH skill management is unavailable.");
			return this.skills.current.read(cwd, scope, name);
		});
	},
	setSkillEnabled(cwd, scope, name, enabled) {
		return this.run(() => {
			if (!this.skills.current) throw new Error("DSH skill management is unavailable.");
			return this.skills.current.setEnabled(cwd, scope, name, enabled);
		});
	}
};

// src/features/skills/rpc.ts
const skillCatalogCodec = {
	mode: "strict",
	typeSymbol: "power-dsh#SkillCatalog",
	create: () => ({ parse(value) {
		if (!isRecord$1(value) || typeof value.cwd !== "string" || !isOneOf(value.scope, ["user", "project"]) || typeof value.complete !== "boolean" || !isArray(value.workspaces) || !value.workspaces.every((item) => isRecord$1(item) && typeof item.path === "string" && typeof item.title === "string") || !isArray(value.skills)) throw new TypeError("Invalid skill catalog");
		const skills = value.skills.map((row) => {
			if (!isRecord$1(row) || !hasStrings(row, [
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
const skillDetailCodec = {
	mode: "strict",
	typeSymbol: "power-dsh#SkillDetail",
	create: () => ({ parse(value) {
		if (value === null) return null;
		if (!isRecord$1(value) || !hasStrings(value, [
			"name",
			"description",
			"content",
			"source",
			"path",
			"origin"
		]) || !hasBooleans(value, [
			"enabled",
			"modelInvocable",
			"userInvocable"
		])) throw new TypeError("Invalid skill detail");
		return {
			name: value.name,
			description: value.description,
			content: value.content,
			source: value.source,
			path: value.path,
			origin: value.origin,
			enabled: value.enabled,
			modelInvocable: value.modelInvocable,
			userInvocable: value.userInvocable
		};
	} })
};
function skillRpc(method, fields, result = skillCatalogCodec) {
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
		result
	};
}
const LIST_SKILLS_RPC = skillRpc("listSkills", ["cwd", "scope"]);
const READ_SKILL_RPC = skillRpc("readSkill", [
	"cwd",
	"scope",
	"name"
], skillDetailCodec);
const SET_SKILL_ENABLED_RPC = skillRpc("setSkillEnabled", [
	"cwd",
	"scope",
	"name",
	"enabled"
]);
const rpc$11 = [
	LIST_SKILLS_RPC,
	READ_SKILL_RPC,
	SET_SKILL_ENABLED_RPC
];

// src/features/mcp/definition.ts
const definition$13 = Object.freeze({
	id: "mcp",
	category: "enhance",
	order: 8,
	keys: Object.freeze(["mcpManagerEnabled"]),
	spec: "src/features/mcp/spec.md"
});

// src/features/mcp/config.ts
var config_exports$13 = /* @__PURE__ */ __exportAll({ configFields: () => configFields$13 });
const configFields$13 = { mcpManagerEnabled: z.boolean().default(false).volatile() };

// src/features/mcp/mcp-args.ts
/** Preserve argument order and ordinary values while masking recognized credential fields. */
function redactMcpArgs(args) {
	let hideNext = false;
	return args.map((argument) => {
		if (hideNext) {
			hideNext = false;
			return REDACTED;
		}
		const assignment = argument.match(/^([^=\s]+)=(.*)$/s);
		if (assignment && sensitive(assignment[1])) return `${assignment[1]}=${REDACTED}`;
		if (/^-/.test(argument) && sensitive(argument)) {
			hideNext = true;
			return argument;
		}
		const prefix = assignment ? `${assignment[1]}=` : "";
		const value = assignment ? assignment[2] : argument;
		const pair = value.match(/^(.*?\b([\w-]+)\s*[:=]\s*)(.+)$/s);
		if (pair && sensitive(pair[2])) return `${prefix}${pair[1]}${REDACTED}`;
		return prefix + value.replace(/https?:\/\/[^\s"']+/gi, (address) => {
			try {
				const url = new URL(address);
				let changed = false;
				if (url.username || url.password) {
					url.username = REDACTED;
					url.password = "";
					changed = true;
				}
				for (const key of new Set(url.searchParams.keys())) if (sensitive(key)) {
					url.searchParams.set(key, REDACTED);
					changed = true;
				}
				if (url.hash && sensitive(url.hash.slice(1).split("=")[0])) {
					url.hash = `${url.hash.slice(1).split("=")[0]}=${REDACTED}`;
					changed = true;
				}
				return changed ? url.href.replaceAll("%5BREDACTED%5D", REDACTED) : address;
			} catch {
				return REDACTED;
			}
		});
	});
}
const REDACTED = "[REDACTED]";
function sensitive(name) {
	const field = name.replace(/([a-z])([A-Z])/g, "$1_$2");
	return /(?:^|[-_])(?:key|api[-_]?key|access[-_]?key|token|password|passwd|secret|authorization|credential|cookie)$/i.test(field);
}

// src/features/mcp/rpc.ts
const serverCodec = {
	mode: "strict",
	typeSymbol: "power-dsh#McpServer",
	create: () => ({ parse(value) {
		if (!isRecord$1(value) || !hasStrings(value, [
			"id",
			"name",
			"source",
			"origin",
			"reason"
		]) || !isOneOf(value.group, ["user", "builtin"]) || !isOneOf(value.transport, [
			"stdio",
			"streamable-http",
			"unknown"
		]) || !isOneOf(value.runtimeState, [
			"pending",
			"loading",
			"active",
			"failed",
			"unloading",
			"inactive",
			"disabled",
			"unknown"
		]) || !isStringArray(value.tools) || !hasBooleans(value, [
			"enabled",
			"stateKnown",
			"canToggle"
		])) throw new TypeError("Invalid MCP entry");
		return {
			id: value.id,
			name: value.name,
			source: value.source,
			origin: value.origin,
			group: value.group,
			enabled: value.enabled,
			stateKnown: value.stateKnown,
			runtimeState: value.runtimeState,
			transport: value.transport,
			canToggle: value.canToggle,
			reason: value.reason,
			tools: value.tools.slice()
		};
	} })
};
const mcpCatalogCodec = {
	mode: "strict",
	typeSymbol: "power-dsh#McpCatalog",
	create: () => ({ parse(value) {
		if (!isRecord$1(value) || typeof value.complete !== "boolean" || !isArray(value.servers)) throw new TypeError("Invalid MCP catalog");
		const servers = value.servers.map((row) => serverCodec.create().parse(row));
		return {
			complete: value.complete,
			servers
		};
	} })
};
const optionalText = (value) => value === void 0 || typeof value === "string";
/** Only the HTTP(S) origin is displayable: any other URL component can carry credentials. */
function projectEndpoint(value) {
	if (typeof value !== "string" || value === "") return { hidden: false };
	try {
		const parsed = new URL(value);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return { hidden: true };
		return {
			url: parsed.origin,
			hidden: parsed.href !== `${parsed.origin}/` || /[?#]/.test(value)
		};
	} catch {
		return { hidden: true };
	}
}
const reconnectCodec = { parse(value) {
	if (!isRecord$1(value) || !(value.enabled === void 0 || typeof value.enabled === "boolean")) throw new TypeError("Invalid MCP reconnect policy");
	const config = {};
	if (typeof value.enabled === "boolean") config.enabled = value.enabled;
	for (const key of [
		"initialDelayMs",
		"maxDelayMs",
		"maxAttempts"
	]) {
		const number = value[key];
		if (number === void 0) continue;
		if (typeof number !== "number" || !Number.isFinite(number)) throw new TypeError("Invalid MCP reconnect policy");
		config[key] = number;
	}
	return config;
} };
const configCodec = {
	mode: "strict",
	typeSymbol: "power-dsh#McpServerConfig",
	create: () => ({ parse(value) {
		if (!isRecord$1(value) || !isOneOf(value.transport, [
			"stdio",
			"streamable-http",
			"unknown"
		]) || !isStringArray(value.envKeys) || !isStringArray(value.headerKeys) || !isStringArray(value.expressions) || typeof value.urlQueryHidden !== "boolean" || !optionalText(value.serverName) || !optionalText(value.command) || !optionalText(value.cwd) || !optionalText(value.url) || !(value.args === void 0 || isStringArray(value.args)) || !(value.reconnect === void 0 || isRecord$1(value.reconnect))) throw new TypeError("Invalid MCP configuration");
		if (value.argsHidden === true && value.args === void 0) throw new TypeError("mcpDetailOutdated");
		const endpoint = projectEndpoint(value.url);
		const config = {
			transport: value.transport,
			envKeys: value.envKeys.slice(),
			headerKeys: value.headerKeys.slice(),
			expressions: value.expressions.slice(),
			urlQueryHidden: value.urlQueryHidden || endpoint.hidden
		};
		if (typeof value.serverName === "string" && value.serverName) config.serverName = value.serverName;
		if (typeof value.command === "string" && value.command) config.command = value.command;
		if (isStringArray(value.args)) config.args = redactMcpArgs(value.args);
		if (typeof value.cwd === "string" && value.cwd) config.cwd = value.cwd;
		if (endpoint.url !== void 0) config.url = endpoint.url;
		if (value.reconnect !== void 0) config.reconnect = reconnectCodec.parse(value.reconnect);
		return config;
	} })
};
const detailCodec = {
	mode: "strict",
	typeSymbol: "power-dsh#McpServerDetail",
	create: () => ({ parse(value) {
		if (value === null) return null;
		if (!isRecord$1(value) || !Object.hasOwn(value, "server") || !Object.hasOwn(value, "config")) throw new TypeError("Invalid MCP detail");
		return {
			server: serverCodec.create().parse(value.server),
			config: value.config === null ? null : configCodec.create().parse(value.config)
		};
	} })
};
const parseMcpServerDetail = detailCodec.create().parse;
function mcpRpc(method, fields, result) {
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
		result
	};
}
const LIST_MCP_SERVERS_RPC = mcpRpc("listMcpServers", [], mcpCatalogCodec);
const READ_MCP_SERVER_RPC = mcpRpc("readMcpServer", ["id"], detailCodec);
const SET_MCP_SERVER_ENABLED_RPC = mcpRpc("setMcpServerEnabled", ["id", "enabled"], mcpCatalogCodec);
const rpc$10 = [
	LIST_MCP_SERVERS_RPC,
	READ_MCP_SERVER_RPC,
	SET_MCP_SERVER_ENABLED_RPC
];

// src/features/mcp/mcp-config.ts
/** Loader serializes `!!js` values as this marker object before evaluation. */
function isExpression(value) {
	return isRecord$1(value) && Object.keys(value).length === 1 && typeof value.__jsExpr === "string";
}
function text(value) {
	return typeof value === "string" && value !== "" ? value : void 0;
}
function reconnectOf(value) {
	if (!isRecord$1(value)) return void 0;
	const config = {};
	if (typeof value.enabled === "boolean") config.enabled = value.enabled;
	for (const key of [
		"initialDelayMs",
		"maxDelayMs",
		"maxAttempts"
	]) if (typeof value[key] === "number" && Number.isFinite(value[key])) config[key] = value[key];
	return Object.keys(config).length > 0 ? config : void 0;
}
/**
* Project one native MCP entry into the fields the detail dialog shows.
*
* Only fields the entry actually declares are reported, so the dialog never
* lists defaults the user did not choose. `env` and `headers` keep key names
* only, a `!!js` field reports its name instead of unresolved text, and the
* endpoint is reduced to its origin; argument credential fields are masked.
* @param raw - the entry's configuration as the profile or preset declares it.
* @param fallback - transport already confirmed by the catalog projection.
* @returns the readable configuration, or null when nothing is declared.
*/
function projectMcpConfig(raw, fallback) {
	if (!isRecord$1(raw) || isExpression(raw)) return null;
	const expressions = [];
	const read = (field) => {
		const value = raw[field];
		if (isExpression(value)) {
			expressions.push(field);
			return;
		}
		return value;
	};
	const keysOf = (field) => {
		const value = read(field);
		return isRecord$1(value) ? Object.keys(value).sort() : [];
	};
	const transport = read("transport");
	const endpointValue = projectEndpoint(read("url"));
	const args = read("args");
	const config = {
		transport: isOneOf(transport, ["stdio", "streamable-http"]) ? transport : fallback,
		envKeys: keysOf("env"),
		headerKeys: keysOf("headers"),
		expressions,
		urlQueryHidden: endpointValue.hidden
	};
	const serverName = text(read("serverName"));
	if (serverName !== void 0) config.serverName = serverName;
	const command = text(read("command"));
	if (command !== void 0) config.command = command;
	if (Array.isArray(args)) {
		if (!args.every((arg) => typeof arg === "string")) throw new TypeError("mcpMetadataLoadFailed");
		config.args = redactMcpArgs(args);
	} else if (args === void 0 && !expressions.includes("args")) config.args = [];
	const cwd = text(read("cwd"));
	if (cwd !== void 0) config.cwd = cwd;
	if (endpointValue.url !== void 0) config.url = endpointValue.url;
	const reconnect = reconnectOf(read("reconnect"));
	if (reconnect !== void 0) config.reconnect = reconnect;
	return config;
}

// src/features/mcp/mcp-policy.ts
const MCP_CLIENT$1 = "@deepseek-ai/dsh-mcp-client";
function failure$1(key) {
	return new Error(key);
}
function identifier$1(value) {
	return typeof value === "string" && value.length > 0;
}
const FIBER_STATES$1 = [
	"pending",
	"loading",
	"active",
	"failed",
	"inactive",
	"unloading"
];
/** Preserve the row's own observed lifecycle; disabled is only derived from a confirmed absent/disposed instance. */
function runtimeState(row, metadata, preset = false) {
	let state = "unknown";
	try {
		const phase = preset ? row.fiberState : row.fiberPhase;
		if (preset && typeof phase === "number" && Number.isInteger(phase) && phase >= 0 && phase < FIBER_STATES$1.length) state = FIBER_STATES$1[phase];
		else if (!preset && isOneOf(phase, [
			"pending",
			"loading",
			"active",
			"failed",
			"unloading"
		])) state = phase;
		else if (metadata && [...FIBER_STATES$1, "unknown"].includes(metadata.runtimeState)) state = metadata.runtimeState;
		else if (!preset && phase === null || preset && phase === void 0) state = "inactive";
	} catch {
		state = "unknown";
	}
	return state === "inactive" && row.enabled === false ? "disabled" : state;
}
function bundleOrigins(bundles) {
	if (!Array.isArray(bundles)) throw failure$1("mcpLoadFailed");
	const origins = /* @__PURE__ */ new Map();
	for (const bundle of bundles) {
		if (bundle?.enabled !== true) continue;
		if (!identifier$1(bundle.name) || !Array.isArray(bundle.rows)) throw failure$1("mcpLoadFailed");
		for (const row of bundle.rows) {
			if (![MCP_CLIENT$1, "@deepseek-ai/dsh-agent-preset"].includes(row?.moduleName) || !identifier$1(row.entryId)) continue;
			if (!origins.has(row.entryId)) origins.set(row.entryId, bundle.name);
			else if (origins.get(row.entryId) !== bundle.name) origins.set(row.entryId, "");
		}
	}
	return origins;
}
function profileServers(entries, complete, origins, configured) {
	if (!Array.isArray(entries)) throw failure$1("mcpLoadFailed");
	return entries.filter((row) => row?.moduleName === MCP_CLIENT$1).map((row) => {
		if (!identifier$1(row.entryId)) throw failure$1("mcpLoadFailed");
		const stateKnown = typeof row.enabled === "boolean";
		const addressable = stateKnown && identifier$1(row.patchId) && !row.readOnlyReason;
		const reason = isOneOf(row.readOnlyReason, ["unaddressable", "management-required"]) ? row.readOnlyReason : "read-only";
		const canToggle = complete && addressable;
		const origin = origins.get(row.entryId) ?? "";
		const metadata = configured.find((entry) => entry.entryId === row.entryId);
		return {
			id: row.entryId,
			name: metadata?.name || row.entryId.replace(/^include:/, ""),
			tools: row.enabled === true ? metadata?.tools ?? [] : [],
			transport: metadata && isOneOf(metadata.transport, ["stdio", "streamable-http"]) ? metadata.transport : "unknown",
			source: "profile",
			origin,
			group: origins.has(row.entryId) ? "builtin" : "user",
			enabled: row.enabled === true,
			runtimeState: runtimeState(row, metadata),
			stateKnown,
			canToggle,
			reason: canToggle ? "" : addressable ? "incomplete" : reason
		};
	});
}
function presetServers(compositions, entries, origins, configured) {
	if (!Array.isArray(compositions)) throw failure$1("mcpLoadFailed");
	return compositions.flatMap((preset) => {
		if (!identifier$1(preset?.id) || !Array.isArray(preset.rows)) throw failure$1("mcpLoadFailed");
		const entry = entries.find((row) => row.id === preset.id);
		const origin = entry ? origins.get(entry.entryId) : "";
		const group = entry && !origins.has(entry.entryId) ? "user" : "builtin";
		return preset.rows.flatMap((row, index) => {
			if (row?.moduleName !== MCP_CLIENT$1) return [];
			const metadata = entry ? configured.find((item) => item.entryId === `${entry.entryId}:${row.entryId}`) : void 0;
			const name = metadata?.name || (identifier$1(row.entryId) ? row.entryId : "mcp-client");
			return [{
				id: `preset:${preset.id}:${identifier$1(row.entryId) ? row.entryId : `@${index}`}`,
				name,
				tools: row.enabled === true ? metadata?.tools ?? [] : [],
				transport: metadata && isOneOf(metadata.transport, ["stdio", "streamable-http"]) ? metadata.transport : "unknown",
				source: `preset:${preset.id}`,
				origin: origin || `preset:${preset.id}`,
				group,
				enabled: row.enabled === true,
				runtimeState: runtimeState(row, metadata, true),
				stateKnown: typeof row.enabled === "boolean",
				canToggle: false,
				reason: row.enabled === "conditional" ? "conditional" : "preset-managed"
			}];
		});
	});
}
var McpPolicy = class {
	ctx;
	ensureActive;
	presets;
	providers;
	constructor(ctx, { ensureActive = () => {} } = {}) {
		this.ctx = ctx;
		this.ensureActive = ensureActive;
		this.presets = null;
		this.providers = null;
	}
	async providerContext() {
		this.ensureActive();
		const manager = this.providers;
		if (!manager) return null;
		try {
			await manager.ready;
		} catch {
			this.ensureActive();
			throw failure$1("mcpProviderInitFailed");
		}
		this.ensureActive();
		if (manager.closed || this.providers !== manager) throw failure$1("mcpUnavailable");
		return manager;
	}
	async list() {
		this.ensureActive();
		const manager = await this.providerContext();
		let entries, bundles;
		try {
			entries = await this.ctx.pluginManager.listPlugins();
		} catch {
			this.ensureActive();
			throw failure$1("mcpPluginsLoadFailed");
		}
		this.ensureActive();
		try {
			bundles = await this.ctx.pluginManager.listBundles();
		} catch {
			this.ensureActive();
			throw failure$1("mcpBundlesLoadFailed");
		}
		this.ensureActive();
		const presets = this.presets;
		let compositions = [];
		if (presets !== null) {
			try {
				compositions = await presets.compositionInventory();
			} catch {
				this.ensureActive();
				throw failure$1("mcpPresetsLoadFailed");
			}
			this.ensureActive();
		}
		let provided;
		try {
			provided = manager ? await manager.list() : { servers: [] };
		} catch {
			this.ensureActive();
			throw failure$1("mcpProvidersLoadFailed");
		}
		this.ensureActive();
		let servers;
		try {
			const origins = bundleOrigins(bundles);
			const presetEntries = manager ? manager.presetEntries() : [];
			const configured = manager ? manager.configured() : [];
			servers = [
				...profileServers(entries, presets !== null, origins, configured),
				...presetServers(compositions, presetEntries, origins, configured),
				...provided.servers
			];
		} catch {
			this.ensureActive();
			throw failure$1("mcpMetadataLoadFailed");
		}
		this.ensureActive();
		return {
			complete: presets !== null,
			servers
		};
	}
	/**
	* Read one server's declared configuration for the detail dialog.
	*
	* The catalog row and its configuration are read in the same pass, so a
	* stale id cannot pair a current row with another entry's configuration.
	* @param id - projected server id from the catalog.
	* @returns the row plus its display-only configuration, or null when absent.
	*/
	async read(id) {
		if (!identifier$1(id)) throw new TypeError("mcpUnavailable");
		this.ensureActive();
		const catalog = await this.list();
		this.ensureActive();
		const server = catalog.servers.find((row) => row.id === id);
		if (!server) return null;
		const manager = await this.providerContext();
		let raw;
		try {
			raw = server.source === "profile" || server.source.startsWith("preset:") ? manager?.declared(server.id) ?? null : manager?.configFor(server.id) ?? null;
		} catch {
			this.ensureActive();
			throw failure$1("mcpMetadataLoadFailed");
		}
		this.ensureActive();
		return {
			server,
			config: projectMcpConfig(raw, server.transport)
		};
	}
	async setEnabled(id, enabled) {
		if (!identifier$1(id) || typeof enabled !== "boolean") throw new TypeError("mcpChangeFailed");
		this.ensureActive();
		const before = await this.list();
		this.ensureActive();
		const row = before.servers.find((server) => server.id === id && ["profile", "manager"].includes(server.source));
		if (!before.complete || !row?.canToggle) throw failure$1("mcpUnavailable");
		if (row.enabled === enabled) return before;
		if (row.source === "manager") {
			const provider = this.providers;
			if (!provider) throw failure$1("mcpUnavailable");
			try {
				await provider.setEnabled(id, enabled);
			} catch (error) {
				this.ensureActive();
				throw failure$1([
					"mcpUnavailable",
					"mcpChangeFailed",
					"mcpChangeUncertain",
					"mcpChangeOverridden"
				].includes(errorMessage(error)) ? errorMessage(error) : "mcpChangeFailed");
			}
			this.ensureActive();
			return this.list();
		}
		let result;
		let rejected = false;
		this.ensureActive();
		try {
			result = await this.ctx.pluginManager.setPluginEnabled(row.id, enabled);
		} catch {
			rejected = true;
		}
		this.ensureActive();
		let after;
		try {
			after = await this.list();
		} catch {
			this.ensureActive();
			throw failure$1("mcpChangeUncertain");
		}
		this.ensureActive();
		if (rejected) throw failure$1("mcpChangeFailed");
		if (result?.application === "restart-required") throw failure$1("mcpRestartRequired");
		if (result?.application === "overridden") throw failure$1("mcpChangeOverridden");
		if (result?.application === "failed" || result?.application === "cancelled") throw failure$1("mcpChangeFailed");
		if (result?.application !== "applied" || result.warnings !== void 0 && (!Array.isArray(result.warnings) || result.warnings.length)) throw failure$1("mcpChangeUncertain");
		const actual = after.servers.find((server) => server.id === id && server.source === "profile");
		if (!actual?.stateKnown || !actual.canToggle) throw failure$1("mcpUnavailable");
		if (actual.enabled !== enabled) throw failure$1("mcpChangeOverridden");
		return after;
	}
};

// src/features/mcp/mcp-providers.ts
const MCP_CLIENT = "@deepseek-ai/dsh-mcp-client";
const identifier = (value) => typeof value === "string" && value.length > 0;
const failure = (key) => new Error(key);
const FIBER_STATES = [
	"pending",
	"loading",
	"active",
	"failed",
	"inactive",
	"unloading"
];
function fiberRuntimeState(fiber) {
	try {
		if (fiber == null) return "inactive";
		const state = fiber.state;
		return Number.isInteger(state) && state >= 0 && state < FIBER_STATES.length ? FIBER_STATES[state] : "unknown";
	} catch {
		return "unknown";
	}
}
function configuredRuntimeState(state, enabled) {
	return state === "inactive" && enabled === false ? "disabled" : state;
}
/** Project only the native transport discriminator, without inspecting connection credentials or targets. */
function transportOf(...configs) {
	try {
		for (const config of configs) {
			const value = config?.transport;
			if (value !== void 0) return isOneOf(value, ["stdio", "streamable-http"]) ? value : "unknown";
		}
	} catch {
		return "unknown";
	}
	return "unknown";
}
function belongsTo(fiber, owner) {
	for (let cursor = fiber; cursor; cursor = cursor.parent?.fiber) {
		if (cursor === owner || cursor.uid === owner.uid) return true;
		if (cursor.uid === 0 || cursor.parent?.fiber === cursor) break;
	}
	return false;
}
function providingPlugin(fiber) {
	for (let cursor = fiber; cursor; cursor = cursor.parent?.fiber) {
		const source = [cursor.entry?.options.name, cursor.runtime?.name].find((name) => identifier(name) && !name.startsWith("cordis:") && ![
			MCP_CLIENT,
			"mcp-client",
			"include",
			"loader",
			"scope",
			"root"
		].includes(name));
		if (source) return source;
		if (cursor.uid === 0 || cursor.parent?.fiber === cursor) break;
	}
	return "";
}
/** Read native MCP providers without discovering files, opening connections, or owning their lifetimes. */
var McpProviders = class {
	ctx;
	ensureActive;
	closed;
	ready = null;
	native;
	scopeOf;
	scopeChainOf;
	constructor(ctx, { ensureActive = () => {} } = {}) {
		this.ctx = ctx;
		this.ensureActive = ensureActive;
		this.closed = false;
	}
	active() {
		this.ensureActive();
		if (this.closed) throw failure("mcpUnavailable");
	}
	async initialize() {
		const [native, scopes] = await Promise.all([this.ctx.loader.import(MCP_CLIENT), this.ctx.loader.import("@deepseek-ai/dsh-scope")]);
		this.active();
		this.native = native;
		this.scopeOf = scopes.scopeOf;
		this.scopeChainOf = scopes.scopeChainOf;
	}
	/** Read registered names in this server's own scope, excluding inherited definitions. */
	toolNames(name, ctx = this.ctx) {
		this.active();
		const tools = ctx.get("tools");
		if (!tools) return [];
		const scope = this.scopeOf(ctx);
		const prefix = `mcp__${name}__`;
		if (typeof tools.definitions === "function") {
			const inherited = scope === void 0 ? /* @__PURE__ */ new Set() : new Set(tools.definitions(this.scopeChainOf(scope)[1]));
			return tools.definitions(scope).filter((tool) => !inherited.has(tool) && tool.name.startsWith(prefix)).map((tool) => tool.name.slice(prefix.length)).filter(Boolean);
		}
		const parent = scope === void 0 ? void 0 : this.scopeChainOf(scope)[1];
		return tools.schemas(scope).flatMap(({ name: fullName }) => {
			if (!fullName.startsWith(prefix) || fullName.length === prefix.length) return [];
			const definition = tools.get(fullName, scope);
			if (!definition || scope !== void 0 && definition === tools.get(fullName, parent)) return [];
			return [fullName.slice(prefix.length)];
		});
	}
	configured() {
		this.active();
		return [...this.ctx.loader.entries()].flatMap((entry) => {
			if (entry.options.name !== MCP_CLIENT) return [];
			let fiber;
			let runtimeState;
			try {
				fiber = entry.fiber;
				runtimeState = fiberRuntimeState(fiber);
			} catch {
				runtimeState = "unknown";
			}
			const name = fiber?.effectiveConfig?.serverName ?? fiber?.config?.serverName ?? fiber?.rawConfig?.serverName ?? entry.options.config?.serverName;
			const tools = identifier(name) && fiber?.ctx && [
				"pending",
				"loading",
				"active",
				"failed"
			].includes(runtimeState) ? this.toolNames(name, fiber.ctx) : [];
			return [{
				entryId: entry.id,
				uid: fiber?.uid,
				name: identifier(name) ? name : "",
				tools,
				runtimeState,
				transport: transportOf(fiber?.effectiveConfig, fiber?.config, entry.options.config)
			}];
		});
	}
	presetEntries() {
		this.active();
		return [...this.ctx.loader.entries()].flatMap((entry) => {
			if (entry.options.name !== "@deepseek-ai/dsh-agent-preset") return [];
			const id = entry.fiber?.effectiveConfig?.id ?? entry.fiber?.config?.id;
			return identifier(id) && identifier(entry.id) ? [{
				id,
				entryId: entry.id
			}] : [];
		});
	}
	/**
	* Declared configuration for a manager or runtime instance, without resolving secrets.
	* @param id - the projected server id (`manager:...` or `runtime:...`).
	* @returns the entry configuration, or undefined when it cannot be confirmed.
	*/
	configFor(id) {
		this.active();
		if (id.startsWith("manager:")) {
			const manager = this.ctx.get("mcpManager");
			const target = this.managed().targets.find((row) => row.id === id);
			if (!manager || !target) return void 0;
			try {
				const configs = manager.config.servers.get();
				return Object.hasOwn(configs, target.name) ? configs[target.name] : void 0;
			} catch {
				return;
			}
		}
		if (id.startsWith("runtime:")) {
			const uid = Number(id.slice(8));
			if (!Number.isSafeInteger(uid)) return void 0;
			try {
				const fiber = [...this.ctx.registry.get(this.native)?.fibers ?? []].find((row) => row.uid === uid);
				return fiber?.effectiveConfig ?? fiber?.config ?? fiber?.rawConfig;
			} catch {
				return;
			}
		}
	}
	/**
	* Declared configuration of one profile or preset MCP row.
	* @param id - the projected server id (`<entryId>` or `preset:<presetId>:<rowId>`).
	* @returns the declared config object, or undefined when no unique row matches.
	*/
	declared(id) {
		this.active();
		const preset = /^preset:([^:]+):(.+)$/.exec(id);
		if (!preset) {
			const matches = [...this.ctx.loader.entries()].filter((entry) => entry.id === id && entry.options.name === MCP_CLIENT);
			return matches.length === 1 ? matches[0].options.config : void 0;
		}
		const [, presetId, rowId] = preset;
		const owners = [...this.ctx.loader.entries()].filter((entry) => entry.options.name === "@deepseek-ai/dsh-agent-preset" && (entry.fiber?.effectiveConfig?.id ?? entry.fiber?.config?.id) === presetId);
		if (owners.length !== 1) return void 0;
		const found = [];
		const walk = (rows) => {
			if (!Array.isArray(rows)) return;
			for (const row of rows) {
				if (!isRecord$1(row)) continue;
				if (row.group === true) {
					walk(row.config);
					continue;
				}
				if (row.name === MCP_CLIENT && row.id === rowId) found.push(row.config);
			}
		};
		walk(owners[0].options.config?.plugins);
		return found.length === 1 ? found[0] : void 0;
	}
	/** Read only the manager's exact native child instance, never its connection-status payload. */
	managedMetadata(name, owner) {
		const unknown = {
			runtimeState: "unknown",
			transport: "unknown"
		};
		if (!owner) return unknown;
		try {
			const matches = [...this.ctx.registry.get(this.native)?.fibers ?? []].filter((fiber) => belongsTo(fiber, owner) && (fiber.effectiveConfig?.serverName ?? fiber.config?.serverName ?? fiber.rawConfig?.serverName) === name);
			if (matches.length !== 1) return unknown;
			const fiber = matches[0];
			return {
				runtimeState: fiberRuntimeState(fiber),
				transport: transportOf(fiber.effectiveConfig, fiber.config)
			};
		} catch {
			return unknown;
		}
	}
	managed() {
		this.active();
		const manager = this.ctx.get("mcpManager");
		if (!manager) return {
			servers: [],
			owner: null,
			targets: []
		};
		const candidates = [...this.ctx.loader.entries()].filter((entry) => entry.options.name === "@deepseek-ai/dsh-mcp-manager" && entry.fiber?.state === 2);
		if (!candidates.length) return {
			servers: [],
			owner: null,
			targets: []
		};
		const entries = candidates.filter((entry) => entry.ctx.get("mcpManager")?.config === manager.config);
		if (entries.length !== 1) return {
			servers: [],
			owner: null,
			targets: []
		};
		const entry = entries[0];
		const configs = manager.config.servers.get();
		const owner = entry.fiber;
		const namespace = entry.options.id;
		const settings = this.ctx.get("settings");
		const editable = identifier(namespace) && typeof settings?.describe === "function" && typeof settings?.mutate === "function";
		const targets = [];
		return {
			servers: manager.list().filter((row) => row.configured).map((row) => {
				if (!identifier(row.name)) throw failure("mcpLoadFailed");
				const configured = Object.hasOwn(configs, row.name);
				const enabled = configured ? configs[row.name]?.enabled : true;
				const stateKnown = typeof enabled === "boolean";
				const id = `manager:${JSON.stringify([namespace ?? "", row.name])}`;
				const canToggle = Boolean(configured && stateKnown && editable);
				if (canToggle) targets.push({
					id,
					name: row.name,
					namespace,
					owner,
					enabled
				});
				const metadata = this.managedMetadata(row.name, owner);
				return {
					id,
					name: row.name,
					source: "manager",
					origin: configured ? namespace ?? "" : "",
					group: configured ? "user" : "builtin",
					enabled: enabled === true,
					stateKnown,
					canToggle,
					runtimeState: configuredRuntimeState(metadata.runtimeState, enabled),
					transport: metadata.transport !== "unknown" ? metadata.transport : configured ? transportOf(configs[row.name]) : "unknown",
					tools: enabled === true ? this.toolNames(row.name, owner?.ctx ?? this.ctx) : [],
					reason: canToggle ? "" : configured ? "manager-managed" : "plugin-managed"
				};
			}),
			targets,
			owner: owner ?? null
		};
	}
	/** List Host-global native instances, excluding Agent and other scoped registrations. */
	list() {
		this.active();
		const managed = this.managed();
		const servers = [...managed.servers];
		const runtime = this.ctx.registry.get(this.native);
		const configured = new Set(this.configured().map((row) => row.uid).filter(Number.isSafeInteger));
		for (const fiber of runtime?.fibers ?? []) {
			const runtimeState = fiberRuntimeState(fiber);
			if (!Number.isSafeInteger(fiber.uid) || runtimeState === "inactive") continue;
			if (managed.owner && belongsTo(fiber, managed.owner)) continue;
			if (this.scopeOf(fiber.ctx) !== void 0 || configured.has(fiber.uid)) continue;
			const name = fiber.effectiveConfig?.serverName ?? fiber.config?.serverName ?? fiber.rawConfig?.serverName;
			if (!identifier(name)) continue;
			const origin = providingPlugin(fiber.parent.fiber);
			servers.push({
				id: `runtime:${fiber.uid}`,
				name,
				source: "plugin",
				origin,
				group: "builtin",
				enabled: true,
				stateKnown: true,
				canToggle: false,
				reason: "plugin-managed",
				runtimeState,
				transport: transportOf(fiber.effectiveConfig, fiber.config),
				tools: [
					"pending",
					"loading",
					"active",
					"failed"
				].includes(runtimeState) ? this.toolNames(name, fiber.ctx) : []
			});
		}
		this.active();
		return {
			complete: true,
			servers
		};
	}
	/** Change only a Settings-configured native manager entry, preserving its other fields and revision. */
	async setEnabled(id, enabled) {
		this.active();
		const target = this.managed().targets.find((row) => row.id === id);
		if (!target || typeof enabled !== "boolean") throw failure("mcpUnavailable");
		if (target.enabled === enabled) return;
		const settings = this.ctx.get("settings");
		const descriptor = settings.describe({ redactSecrets: true }).find((row) => row.ns === target.namespace);
		if (!descriptor || !Number.isSafeInteger(descriptor.revision)) throw failure("mcpUnavailable");
		this.active();
		let rejected = false;
		try {
			await settings.mutate(descriptor.ns, [{
				op: "set",
				path: [
					"servers",
					target.name,
					"enabled"
				],
				value: enabled
			}], descriptor.revision);
		} catch {
			rejected = true;
		}
		this.active();
		let after;
		try {
			after = this.managed().targets.find((row) => row.id === id);
		} catch {
			this.active();
			throw failure("mcpChangeUncertain");
		}
		this.active();
		if (rejected) throw failure("mcpChangeFailed");
		if (!after || after.owner !== target.owner) throw failure("mcpChangeUncertain");
		if (after.enabled !== enabled) throw failure("mcpChangeOverridden");
	}
	close() {
		this.closed = true;
	}
};

// src/features/mcp/host.ts
var host_exports$10 = /* @__PURE__ */ __exportAll({
	createHost: () => createHost$10,
	methods: () => methods$10
});
function createHost$10(ctx, _config, { owner, ensureActive }) {
	const options = { ensureActive };
	const mcp = new McpPolicy(owner, options);
	ctx.inject(["agentPresets"], (child) => {
		const registry = child.agentPresets;
		child.effect(() => {
			mcp.presets = registry;
			return () => {
				if (mcp.presets === registry) mcp.presets = null;
			};
		});
	});
	ctx.inject(["loader"], (child) => {
		const providers = new McpProviders(child, options);
		mcp.providers = providers;
		providers.ready = providers.initialize();
		providers.ready.catch(() => {});
		child.effect(() => () => {
			if (mcp.providers === providers) mcp.providers = null;
			providers.close();
		});
	});
	return { mcp };
}
const methods$10 = {
	listMcpServers() {
		return this.run(() => this.mcp.list());
	},
	readMcpServer(id) {
		return this.run(() => this.mcp.read(id));
	},
	setMcpServerEnabled(id, enabled) {
		return this.run(() => this.mcp.setEnabled(id, enabled));
	}
};

// src/features/account-blocking/definition.ts
const definition$12 = Object.freeze({
	id: "account-blocking",
	category: "simplify",
	order: 8,
	keys: Object.freeze(["blockOfficialAccount"]),
	spec: "src/features/account-blocking/spec.md"
});

// src/features/account-blocking/config.ts
var config_exports$12 = /* @__PURE__ */ __exportAll({
	configFields: () => configFields$12,
	settingsTool: () => settingsTool$6
});
const configFields$12 = { blockOfficialAccount: z.boolean().default(false).volatile() };
const settingsTool$6 = {
	parameters: { blockOfficialAccount: {
		type: "boolean",
		description: "Disable official-account UI, account models, and the built-in DeepSeek API-key integration when true; false enables those plugins. Separately added and third-party providers and stored credentials are preserved. Omit to keep it unchanged."
	} },
	output: { blockOfficialAccount: {
		type: "boolean",
		required: true
	} },
	mutations: [{
		field: "blockOfficialAccount",
		order: 5,
		method: "setAccountBlocked"
	}],
	reads: [{
		order: 7,
		read({ config }) {
			return { blockOfficialAccount: config.blockOfficialAccount.get() };
		}
	}]
};

// src/shared/host/plugin-policy.ts
const RETIRED_PREFERENCES = [
	"accountRestore",
	"telemetryRestore",
	"telemetryPluginRestore",
	"settingsFullscreen"
];
var PluginPolicy = class {
	ctx;
	matches;
	flag;
	label;
	ensureActive;
	constructor(ctx, { matches, flag, label }, { ensureActive = () => {} } = {}) {
		this.ctx = ctx;
		this.matches = matches;
		this.flag = flag;
		this.label = label;
		this.ensureActive = ensureActive;
	}
	targets(entries) {
		return entries.filter(this.matches);
	}
	async setBlocked(blocked) {
		if (typeof blocked !== "boolean") throw new TypeError("blocked must be boolean");
		this.ensureActive();
		const entries = await this.ctx.pluginManager.listPlugins();
		this.ensureActive();
		const targets = this.targets(entries);
		if (!targets.length) throw new Error(`No supported ${this.label} features were found in this profile.`);
		const enabled = !blocked;
		const plan = (blocked ? targets : [...targets].reverse()).filter((entry) => entry.enabled !== enabled || !enabled && entry.fiberPhase === "active");
		for (const entry of plan) if (entry.readOnlyReason) throw new Error(`${this.label} feature cannot be changed: ${entry.moduleName}`);
		for (const entry of plan) {
			this.ensureActive();
			const result = await this.ctx.pluginManager.setPluginEnabled(entry.entryId, enabled);
			this.ensureActive();
			if (result.application !== "applied" || result.warnings?.length) {
				const detail = result.warnings?.join("; ") || result.error?.diagnostic || result.error?.code || result.restartReason || "";
				throw new Error(`${this.label} change was not applied: ${entry.entryId} (${result.application}). ${detail}`);
			}
		}
		const after = await this.ctx.pluginManager.listPlugins();
		this.ensureActive();
		for (const target of targets) {
			const entry = after.find((item) => item.entryId === target.entryId);
			if (!entry || !this.matches(entry) || entry.enabled !== enabled || !enabled && entry.fiberPhase === "active") throw new Error(`${this.label} feature state did not match the requested value: ${target.entryId}`);
		}
		await this.ctx.configEditor.edit(this.ctx.fiber.entry, (raw) => {
			this.ensureActive();
			const next = {
				...raw,
				[this.flag]: blocked
			};
			for (const key of RETIRED_PREFERENCES) delete next[key];
			return next;
		});
		this.ensureActive();
		return { blocked };
	}
};

// src/features/account-blocking/account-policy.ts
const TARGETS$1 = ["@deepseek-ai/dsh-client-ui-settings-account", "@deepseek-ai/dsh-llm-deepseek-account"];
function isTarget(entry) {
	if (TARGETS$1.includes(entry.moduleName)) return true;
	return entry.moduleName === "@deepseek-ai/dsh-llm-deepseek-api-key" && entry.entryId === "include:llm-deepseek" && entry.patchId === "llm-deepseek";
}
var AccountPolicy = class extends PluginPolicy {
	constructor(ctx, options = {}) {
		super(ctx, {
			matches: isTarget,
			flag: "blockOfficialAccount",
			label: "official-account"
		}, options);
	}
};

// src/features/account-blocking/host.ts
var host_exports$9 = /* @__PURE__ */ __exportAll({
	createHost: () => createHost$9,
	methods: () => methods$9
});
function createHost$9(_ctx, _config, { owner, ensureActive }) {
	return { policy: new AccountPolicy(owner, { ensureActive }) };
}
const methods$9 = { async setAccountBlocked(blocked) {
	return this.run(() => this.policy.setBlocked(blocked));
} };

// src/features/account-blocking/rpc.ts
const ACCOUNT_RPC = policyRpc("setAccountBlocked", "AccountPolicyResult");
const rpc$9 = [ACCOUNT_RPC];

// src/features/search-blocking/definition.ts
const definition$11 = Object.freeze({
	id: "search-blocking",
	category: "simplify",
	order: 9,
	keys: Object.freeze(["blockOfficialSearch"]),
	spec: "src/features/search-blocking/spec.md"
});

// src/features/search-blocking/config.ts
var config_exports$11 = /* @__PURE__ */ __exportAll({
	configFields: () => configFields$11,
	settingsTool: () => settingsTool$5
});
const configFields$11 = { blockOfficialSearch: z.boolean().default(false).volatile() };
const settingsTool$5 = {
	parameters: { blockOfficialSearch: {
		type: "boolean",
		description: "Disable built-in web_search globally and in modes when true; false enables search in active matching tool declarations. Web fetch, third-party MCP search, and other preferences are preserved. Existing sessions may need reopening after re-enabling. Omit to keep it unchanged."
	} },
	output: { blockOfficialSearch: {
		type: "boolean",
		required: true
	} },
	mutations: [{
		field: "blockOfficialSearch",
		order: 8,
		method: "setSearchBlocked"
	}],
	reads: [{
		order: 8,
		read({ config }) {
			return { blockOfficialSearch: config.blockOfficialSearch.get() };
		}
	}]
};

// src/features/search-blocking/search-policy.ts
const MODULE$2 = "@deepseek-ai/dsh-tool-web";
const PRESET$3 = "@deepseek-ai/dsh-agent-preset";
const TOOL = "web_search";
const DENIED = "Built-in web search is disabled in power-dsh settings.";
function searchRows(rows) {
	return Array.isArray(rows) ? rows.flatMap((row) => row?.name === MODULE$2 ? [row] : row?.group === true ? searchRows(row.config) : []) : [];
}
function configureSearch(rows, enabled) {
	return rows.map((row) => row.name === MODULE$2 ? {
		...row,
		config: {
			...row.config,
			search: enabled
		}
	} : row.group === true && Array.isArray(row.config) ? {
		...row,
		config: configureSearch(row.config, enabled)
	} : row);
}
function targetRows(entry) {
	return entry.options.name === MODULE$2 ? [{ config: entry.options.config }] : entry.options.name === PRESET$3 ? searchRows(entry.options.config?.plugins) : [];
}
var SearchPolicy = class {
	owner;
	config;
	ensureActive;
	context;
	restrictions;
	constructor(owner, config, { ensureActive = () => {} } = {}) {
		this.owner = owner;
		this.config = config;
		this.ensureActive = ensureActive;
		this.context = null;
		this.restrictions = /* @__PURE__ */ new Map();
	}
	blocked() {
		return this.config.blockOfficialSearch.get();
	}
	bind(ctx) {
		this.context = ctx;
		ctx.effect(() => () => {
			this.context = null;
			for (const { release } of this.restrictions.values()) release();
			this.restrictions.clear();
		});
		ctx.tools.guard((exec) => this.blocked() && exec.name === TOOL ? DENIED : void 0);
		ctx.on("agent/created", ({ agent }) => this.syncAgent(agent), { global: true });
		ctx.on("agent/disposed", ({ agent }) => {
			this.restrictions.get(agent)?.release();
			this.restrictions.delete(agent);
		}, { global: true });
		ctx.on("agent-preset/selected", (id) => {
			const agent = ctx.agents.get(id);
			if (agent) this.syncAgent(agent);
		}, { global: true });
		ctx.on("agent/pre-step", ({ agent }, next) => {
			this.syncAgent(agent);
			return next();
		}, {
			global: true,
			prepend: true
		});
		ctx.on("settings/document-updated", (namespace) => {
			if (namespace === this.owner.fiber.entry.options.id) this.sync();
		});
		this.sync();
	}
	syncAgent(agent) {
		const previous = this.restrictions.get(agent);
		if (previous && (previous.context !== agent.ctx || !this.blocked())) {
			previous.release();
			this.restrictions.delete(agent);
		}
		if (!this.blocked() || this.restrictions.has(agent)) return;
		const tools = agent.ctx.get("tools");
		if (!tools.get(TOOL, agent)) return;
		const release = tools.restrict({ deny: [TOOL] });
		this.restrictions.set(agent, {
			context: agent.ctx,
			release
		});
	}
	sync() {
		for (const agent of this.context?.agents.list() ?? []) this.syncAgent(agent);
	}
	async setBlocked(blocked) {
		if (typeof blocked !== "boolean") throw new TypeError("blocked must be boolean");
		this.ensureActive();
		if (!this.context) throw new Error("Search blocking is unavailable. Re-enable power-dsh and try again.");
		const enabled = !blocked;
		const entries = this.owner.configEditor.entries().filter((entry) => !entry.disabled && targetRows(entry).length);
		if (!entries.length) throw new Error("No supported built-in search tools were found in this profile.");
		const expected = entries.map((entry) => ({
			id: entry.options.id,
			count: targetRows(entry).length,
			preset: entry.options.name === PRESET$3 ? entry.options.config.id : void 0
		}));
		for (const entry of entries) {
			this.ensureActive();
			if (targetRows(entry).every((row) => (row.config?.search ?? true) === enabled)) continue;
			await this.owner.configEditor.edit(entry, (raw) => {
				this.ensureActive();
				if (entry.options.name === MODULE$2) return {
					...raw,
					search: enabled
				};
				if (searchRows(raw.plugins).length !== expected.find((target) => target.id === entry.options.id)?.count) throw new Error("The search mode configuration changed. Please try again.");
				return {
					...raw,
					plugins: configureSearch(raw.plugins, enabled)
				};
			});
		}
		const after = this.owner.configEditor.entries();
		this.ensureActive();
		for (const target of expected) {
			const entry = after.find((item) => item.options.id === target.id);
			const rows = entry ? targetRows(entry) : [];
			if (rows.length !== target.count || rows.some((row) => (row.config?.search ?? true) !== enabled)) throw new Error(`The search configuration did not match the requested value: ${target.id}`);
		}
		const compositions = await this.context.agentPresets.compositionInventory();
		this.ensureActive();
		for (const target of expected.filter((row) => row.preset !== void 0)) {
			const preset = compositions.find((row) => row.id === target.preset);
			if (!preset || preset.broken || preset.rows.filter((row) => row.moduleName === MODULE$2).length !== target.count) throw new Error(`The search mode configuration could not be applied: ${target.preset}`);
		}
		await this.owner.configEditor.edit(this.owner.fiber.entry, (raw) => {
			this.ensureActive();
			return {
				...raw,
				blockOfficialSearch: blocked
			};
		});
		this.ensureActive();
		if (!this.context) throw new Error("Search blocking has been unloaded.");
		this.sync();
		if (this.blocked() !== blocked) throw new Error("The search setting did not match the requested value.");
		for (const agent of this.context?.agents.list() ?? []) if (blocked && agent.ctx.get("tools").get(TOOL, agent)) throw new Error("Built-in search is still available. Re-enable power-dsh and try again.");
		return { blocked };
	}
};

// src/features/search-blocking/host.ts
var host_exports$8 = /* @__PURE__ */ __exportAll({
	createHost: () => createHost$8,
	methods: () => methods$8
});
function createHost$8(ctx, config, { owner, ensureActive }) {
	const search = new SearchPolicy(owner, config, { ensureActive });
	ctx.inject(["agents", "agentPresets"], (child) => search.bind(child));
	return { search };
}
const methods$8 = { async setSearchBlocked(blocked) {
	return this.run(() => this.search.setBlocked(blocked));
} };

// src/features/search-blocking/rpc.ts
const SEARCH_RPC = policyRpc("setSearchBlocked", "SearchPolicyResult");
const rpc$8 = [SEARCH_RPC];

// src/features/telemetry-blocking/definition.ts
const definition$10 = Object.freeze({
	id: "telemetry-blocking",
	category: "simplify",
	order: 10,
	keys: Object.freeze(["blockOfficialTelemetry"]),
	spec: "src/features/telemetry-blocking/spec.md"
});

// src/features/telemetry-blocking/config.ts
var config_exports$10 = /* @__PURE__ */ __exportAll({
	configFields: () => configFields$10,
	settingsTool: () => settingsTool$4
});
const configFields$10 = { blockOfficialTelemetry: z.boolean().default(false).volatile() };
const settingsTool$4 = {
	parameters: { blockOfficialTelemetry: {
		type: "boolean",
		description: "Disable built-in analytics, its exporter, feedback UI and command, Session-log uploads and plugin inventory reporting when true; false enables those plugins. Local logs and update checks are unaffected; in-flight and queued uploads may finish. Omit to keep it unchanged."
	} },
	output: {
		blockOfficialTelemetry: {
			type: "boolean",
			required: true
		},
		telemetry: {
			type: "object",
			required: true,
			additionalProperties: false,
			properties: {
				protected: {
					type: "boolean",
					required: true
				},
				senders: {
					type: "array",
					required: true,
					items: {
						type: "object",
						additionalProperties: false,
						properties: {
							id: {
								type: "string",
								required: true
							},
							enabled: {
								type: "boolean",
								required: true
							},
							active: {
								type: "boolean",
								required: true
							},
							available: {
								type: "boolean",
								required: true
							}
						}
					}
				}
			}
		}
	},
	mutations: [{
		field: "blockOfficialTelemetry",
		order: 6,
		method: "setTelemetryBlocked"
	}],
	reads: [{
		order: 1,
		async read({ config, service }) {
			return {
				blockOfficialTelemetry: config.blockOfficialTelemetry.get(),
				telemetry: await service.telemetry.status()
			};
		}
	}]
};

// src/features/telemetry-blocking/telemetry-policy.ts
const TARGETS = [
	["product-analytics", "@deepseek-ai/dsh-client-product-analytics"],
	["ui-message-feedback", "@deepseek-ai/dsh-client-ui-message-feedback"],
	["command-feedback", "@deepseek-ai/dsh-command-feedback"],
	["session-log-deepseek", "@deepseek-ai/dsh-session-log-deepseek"],
	["plugin-package-inventory-deepseek", "@deepseek-ai/dsh-plugin-package-inventory-deepseek"],
	["session-telemetry-otel", "@deepseek-ai/dsh-session-telemetry-otel"],
	["desktop-product-telemetry", "@deepseek-ai/dsh-host-product-telemetry-otel"]
];
function matches(entry) {
	return TARGETS.some(([id, name]) => entry.entryId === `include:${id}` && entry.patchId === id && entry.moduleName === name);
}
var TelemetryPolicy = class extends PluginPolicy {
	constructor(ctx, options = {}) {
		super(ctx, {
			matches,
			flag: "blockOfficialTelemetry",
			label: "official-telemetry"
		}, options);
	}
	targets(entries) {
		return TARGETS.flatMap(([id]) => entries.filter((entry) => entry.patchId === id && matches(entry)));
	}
	async protected() {
		return (await this.status()).protected;
	}
	async status() {
		const entries = await this.ctx.pluginManager.listPlugins();
		const senders = TARGETS.map(([id, name]) => {
			const entry = entries.find((item) => item.entryId === `include:${id}` && item.moduleName === name && item.patchId === id);
			return {
				id,
				available: Boolean(entry),
				enabled: entry?.enabled ?? false,
				active: entry?.fiberPhase === "active"
			};
		});
		return {
			protected: senders.some((item) => item.available) && senders.every((item) => !item.enabled && !item.active),
			senders
		};
	}
};

// src/features/telemetry-blocking/host.ts
var host_exports$7 = /* @__PURE__ */ __exportAll({
	createHost: () => createHost$7,
	methods: () => methods$7
});
function createHost$7(_ctx, _config, { owner, ensureActive }) {
	return { telemetry: new TelemetryPolicy(owner, { ensureActive }) };
}
const methods$7 = { async setTelemetryBlocked(blocked) {
	return this.run(() => this.telemetry.setBlocked(blocked));
} };

// src/features/telemetry-blocking/rpc.ts
const TELEMETRY_RPC = policyRpc("setTelemetryBlocked", "TelemetryPolicyResult");
const rpc$7 = [TELEMETRY_RPC];

// src/features/todo-blocking/definition.ts
const definition$9 = Object.freeze({
	id: "todo-blocking",
	category: "simplify",
	order: 11,
	keys: Object.freeze(["blockTodo"]),
	spec: "src/features/todo-blocking/spec.md"
});

// src/features/todo-blocking/config.ts
var config_exports$9 = /* @__PURE__ */ __exportAll({
	configFields: () => configFields$9,
	settingsTool: () => settingsTool$3
});
const configFields$9 = { blockTodo: z.boolean().default(false).volatile() };
const settingsTool$3 = {
	parameters: { blockTodo: {
		type: "boolean",
		description: "Disable the Todo tool plugin globally and in mode declarations for new conversations when true; false enables matching plugins. Already-open conversations keep their current mode revision. Session history and the conversation UI are preserved. Omit to keep it unchanged."
	} },
	output: { blockTodo: {
		type: "boolean",
		required: true
	} },
	mutations: [{
		field: "blockTodo",
		order: 7,
		method: "setTodoBlocked"
	}],
	reads: [{
		order: 0,
		read({ config }) {
			return { blockTodo: config.blockTodo.get() };
		}
	}]
};

// src/features/todo-blocking/todo-policy.ts
const MODULE$1 = "@deepseek-ai/dsh-tool-todo";
const PRESET$2 = "@deepseek-ai/dsh-agent-preset";
function todoRows(rows) {
	return Array.isArray(rows) ? rows.flatMap((row) => row?.name === MODULE$1 ? [row] : row?.group === true ? todoRows(row.config) : []) : [];
}
function hasTodo(rows) {
	return todoRows(rows).length > 0;
}
function needsChange$2(rows, blocked) {
	return rows.some((row) => row.name === MODULE$1 ? (row.disabled ?? false) !== blocked : row.group === true && Array.isArray(row.config) && needsChange$2(row.config, blocked));
}
function disableTodo(rows, blocked) {
	return rows.map((row) => row.name === MODULE$1 ? {
		...row,
		disabled: blocked
	} : row.group === true && Array.isArray(row.config) ? {
		...row,
		config: disableTodo(row.config, blocked)
	} : row);
}
var TodoPolicy = class {
	owner;
	config;
	ensureActive;
	context;
	plugins;
	constructor(owner, config, { ensureActive = () => {} } = {}) {
		this.owner = owner;
		this.config = config;
		this.ensureActive = ensureActive;
		this.context = null;
		this.plugins = new PluginPolicy(owner, {
			matches: (entry) => entry.moduleName === MODULE$1,
			flag: "blockTodo",
			label: "Todo"
		}, { ensureActive });
	}
	bind(ctx) {
		this.context = ctx;
		ctx.effect(() => () => {
			this.context = null;
		});
	}
	async setBlocked(blocked) {
		if (typeof blocked !== "boolean") throw new TypeError("blocked must be boolean");
		this.ensureActive();
		const context = this.context;
		if (!context) throw new Error("Todo blocking is unavailable. Re-enable power-dsh and try again.");
		const presets = this.owner.configEditor.entries().filter((entry) => entry.options.name === PRESET$2 && hasTodo(entry.options.config?.plugins));
		const expected = presets.map((entry) => ({
			id: entry.options.config.id,
			count: todoRows(entry.options.config.plugins).length
		}));
		for (const entry of presets) {
			this.ensureActive();
			if (!needsChange$2(entry.options.config.plugins, blocked)) continue;
			await this.owner.configEditor.edit(entry, (raw) => {
				this.ensureActive();
				if (!hasTodo(raw.plugins)) throw new Error("The Todo mode configuration changed. Please try again.");
				return {
					...raw,
					plugins: disableTodo(raw.plugins, blocked)
				};
			});
		}
		this.ensureActive();
		const compositions = await context.agentPresets.compositionInventory();
		this.ensureActive();
		for (const target of expected) {
			const preset = compositions.find((row) => row.id === target.id);
			if (!preset || preset.rows.filter((row) => row.moduleName === MODULE$1).length !== target.count) throw new Error(`The Todo mode configuration could not be read back: ${target.id}`);
		}
		for (const preset of compositions) {
			const targets = preset.rows.filter((row) => row.moduleName === MODULE$1);
			if (targets.length && (preset.broken || targets.some((row) => row.enabled !== !blocked))) throw new Error(`The Todo plugin change was not applied in mode: ${preset.id}`);
		}
		await this.plugins.setBlocked(blocked);
		this.ensureActive();
		if (!this.context) throw new Error("Todo blocking has been unloaded.");
		if (this.config.blockTodo.get() !== blocked) throw new Error("The Todo setting did not match the requested value.");
		return { blocked };
	}
};

// src/features/todo-blocking/host.ts
var host_exports$6 = /* @__PURE__ */ __exportAll({
	createHost: () => createHost$6,
	methods: () => methods$6
});
function createHost$6(ctx, config, { owner, ensureActive }) {
	const todo = new TodoPolicy(owner, config, { ensureActive });
	ctx.inject(["agentPresets"], (child) => todo.bind(child));
	return { todo };
}
const methods$6 = { async setTodoBlocked(blocked) {
	return this.run(() => this.todo.setBlocked(blocked));
} };

// src/features/todo-blocking/rpc.ts
const TODO_RPC = policyRpc("setTodoBlocked", "TodoPolicyResult");
const rpc$6 = [TODO_RPC];

// src/features/plan-blocking/definition.ts
const definition$8 = Object.freeze({
	id: "plan-blocking",
	category: "simplify",
	order: 11.5,
	keys: Object.freeze(["blockPlan"]),
	spec: "src/features/plan-blocking/spec.md"
});

// src/features/plan-blocking/config.ts
var config_exports$8 = /* @__PURE__ */ __exportAll({
	configFields: () => configFields$8,
	settingsTool: () => settingsTool$2
});
const configFields$8 = { blockPlan: z.boolean().default(false).volatile() };
const settingsTool$2 = {
	parameters: { blockPlan: {
		type: "boolean",
		description: "Disable native Plan mode globally and in mode declarations for new conversations when true; false enables matching plugins. Already-open conversations keep their current mode revision. Plan history is preserved. Omit to keep it unchanged."
	} },
	output: { blockPlan: {
		type: "boolean",
		required: true
	} },
	mutations: [{
		field: "blockPlan",
		order: 9,
		method: "setPlanBlocked"
	}],
	reads: [{
		order: 0,
		read({ config }) {
			return { blockPlan: config.blockPlan.get() };
		}
	}]
};

// src/features/plan-blocking/plan-policy.ts
const MODULE = "@deepseek-ai/dsh-plan-mode";
const PRESET$1 = "@deepseek-ai/dsh-agent-preset";
function planRows(rows) {
	return Array.isArray(rows) ? rows.flatMap((row) => row?.name === MODULE ? [row] : row?.group === true ? planRows(row.config) : []) : [];
}
function needsChange$1(rows, blocked) {
	return planRows(rows).some((row) => (row.disabled ?? false) !== blocked);
}
function setDisabled$1(rows, blocked) {
	return rows.map((row) => row.name === MODULE ? {
		...row,
		disabled: blocked
	} : row.group === true && Array.isArray(row.config) ? {
		...row,
		config: setDisabled$1(row.config, blocked)
	} : row);
}
var PlanPolicy = class {
	owner;
	config;
	ensureActive;
	context = null;
	plugins;
	constructor(owner, config, { ensureActive = () => {} } = {}) {
		this.owner = owner;
		this.config = config;
		this.ensureActive = ensureActive;
		this.plugins = new PluginPolicy(owner, {
			matches: (entry) => entry.moduleName === MODULE,
			flag: "blockPlan",
			label: "Plan mode"
		}, { ensureActive });
	}
	bind(ctx) {
		this.context = ctx;
		ctx.effect(() => () => {
			this.context = null;
		});
	}
	async setBlocked(blocked) {
		if (typeof blocked !== "boolean") throw new TypeError("blocked must be boolean");
		this.ensureActive();
		const context = this.context;
		if (!context) throw new Error("Plan blocking is unavailable. Re-enable power-dsh and try again.");
		const presets = this.owner.configEditor.entries().filter((entry) => entry.options.name === PRESET$1 && planRows(entry.options.config?.plugins).length > 0);
		const expected = presets.map((entry) => ({
			id: entry.options.config.id,
			count: planRows(entry.options.config.plugins).length
		}));
		for (const entry of presets) {
			this.ensureActive();
			if (!needsChange$1(entry.options.config.plugins, blocked)) continue;
			await this.owner.configEditor.edit(entry, (raw) => {
				this.ensureActive();
				if (!planRows(raw.plugins).length) throw new Error("The Plan mode configuration changed. Please try again.");
				return {
					...raw,
					plugins: setDisabled$1(raw.plugins, blocked)
				};
			});
		}
		this.ensureActive();
		const compositions = await context.agentPresets.compositionInventory();
		this.ensureActive();
		for (const target of expected) {
			const preset = compositions.find((row) => row.id === target.id);
			if (!preset || preset.rows.filter((row) => row.moduleName === MODULE).length !== target.count) throw new Error(`The Plan mode configuration could not be read back: ${target.id}`);
		}
		for (const preset of compositions) {
			const targets = preset.rows.filter((row) => row.moduleName === MODULE);
			if (targets.length && (preset.broken || targets.some((row) => row.enabled !== !blocked))) throw new Error(`The Plan plugin change was not applied in mode: ${preset.id}`);
		}
		await this.plugins.setBlocked(blocked);
		this.ensureActive();
		if (!this.context) throw new Error("Plan blocking has been unloaded.");
		if (this.config.blockPlan.get() !== blocked) throw new Error("The Plan setting did not match the requested value.");
		return { blocked };
	}
};

// src/features/plan-blocking/host.ts
var host_exports$5 = /* @__PURE__ */ __exportAll({
	createHost: () => createHost$5,
	methods: () => methods$5
});
function createHost$5(ctx, config, { owner, ensureActive }) {
	const plan = new PlanPolicy(owner, config, { ensureActive });
	ctx.inject(["agentPresets"], (child) => plan.bind(child));
	return { plan };
}
const methods$5 = { async setPlanBlocked(blocked) {
	return this.run(() => this.plan.setBlocked(blocked));
} };

// src/features/plan-blocking/rpc.ts
const PLAN_RPC = policyRpc("setPlanBlocked", "PlanPolicyResult");
const rpc$5 = [PLAN_RPC];

// src/features/goal-blocking/definition.ts
const definition$7 = Object.freeze({
	id: "goal-blocking",
	category: "simplify",
	order: 11.75,
	keys: Object.freeze(["blockGoal"]),
	spec: "src/features/goal-blocking/spec.md"
});

// src/features/goal-blocking/config.ts
var config_exports$7 = /* @__PURE__ */ __exportAll({
	configFields: () => configFields$7,
	settingsTool: () => settingsTool$1
});
const configFields$7 = { blockGoal: z.boolean().default(false).volatile() };
const settingsTool$1 = {
	parameters: { blockGoal: {
		type: "boolean",
		description: "Disable the built-in Goal command and tools globally and in mode declarations for new conversations when true; false enables matching plugins. Already-open conversations keep their mode revision. Existing goals, automatic continuation and history are preserved. Omit to keep it unchanged."
	} },
	output: { blockGoal: {
		type: "boolean",
		required: true
	} },
	mutations: [{
		field: "blockGoal",
		order: 10,
		method: "setGoalBlocked"
	}],
	reads: [{
		order: 0,
		read({ config }) {
			return { blockGoal: config.blockGoal.get() };
		}
	}]
};

// src/features/goal-blocking/goal-policy.ts
const MODULES = ["@deepseek-ai/dsh-command-goal", "@deepseek-ai/dsh-tool-goal"];
const PRESET = "@deepseek-ai/dsh-agent-preset";
function isGoalEntry(name) {
	return MODULES.some((moduleName) => moduleName === name);
}
function goalRows(rows) {
	return Array.isArray(rows) ? rows.flatMap((row) => isGoalEntry(row?.name) ? [row] : row?.group === true ? goalRows(row.config) : []) : [];
}
function needsChange(rows, blocked) {
	return goalRows(rows).some((row) => (row.disabled ?? false) !== blocked);
}
function setDisabled(rows, blocked) {
	return rows.map((row) => isGoalEntry(row.name) ? {
		...row,
		disabled: blocked
	} : row.group === true && Array.isArray(row.config) ? {
		...row,
		config: setDisabled(row.config, blocked)
	} : row);
}
var GoalPolicy = class {
	owner;
	config;
	ensureActive;
	context = null;
	plugins;
	constructor(owner, config, { ensureActive = () => {} } = {}) {
		this.owner = owner;
		this.config = config;
		this.ensureActive = ensureActive;
		this.plugins = new PluginPolicy(owner, {
			matches: (entry) => isGoalEntry(entry.moduleName),
			flag: "blockGoal",
			label: "Goal mode"
		}, { ensureActive });
	}
	bind(ctx) {
		this.context = ctx;
		ctx.effect(() => () => {
			this.context = null;
		});
	}
	async setBlocked(blocked) {
		if (typeof blocked !== "boolean") throw new TypeError("blocked must be boolean");
		this.ensureActive();
		const context = this.context;
		if (!context) throw new Error("Goal blocking is unavailable. Re-enable power-dsh and try again.");
		const presets = this.owner.configEditor.entries().filter((entry) => entry.options.name === PRESET && goalRows(entry.options.config?.plugins).length > 0);
		const expected = presets.map((entry) => ({
			id: entry.options.config.id,
			modules: MODULES.map((moduleName) => ({
				moduleName,
				count: goalRows(entry.options.config.plugins).filter((row) => row.name === moduleName).length
			}))
		}));
		for (const entry of presets) {
			this.ensureActive();
			if (!needsChange(entry.options.config.plugins, blocked)) continue;
			await this.owner.configEditor.edit(entry, (raw) => {
				this.ensureActive();
				if (!goalRows(raw.plugins).length) throw new Error("The Goal mode configuration changed. Please try again.");
				return {
					...raw,
					plugins: setDisabled(raw.plugins, blocked)
				};
			});
		}
		this.ensureActive();
		const compositions = await context.agentPresets.compositionInventory();
		this.ensureActive();
		for (const target of expected) {
			const preset = compositions.find((row) => row.id === target.id);
			if (!preset || target.modules.some(({ moduleName, count }) => preset.rows.filter((row) => row.moduleName === moduleName).length !== count)) throw new Error(`The Goal mode configuration could not be read back: ${target.id}`);
		}
		for (const preset of compositions) {
			const targets = preset.rows.filter((row) => isGoalEntry(row.moduleName));
			if (targets.length && (preset.broken || targets.some((row) => row.enabled !== !blocked))) throw new Error(`The Goal plugin change was not applied in mode: ${preset.id}`);
		}
		await this.plugins.setBlocked(blocked);
		this.ensureActive();
		if (!this.context) throw new Error("Goal blocking has been unloaded.");
		if (this.config.blockGoal.get() !== blocked) throw new Error("The Goal setting did not match the requested value.");
		return { blocked };
	}
};

// src/features/goal-blocking/host.ts
var host_exports$4 = /* @__PURE__ */ __exportAll({
	createHost: () => createHost$4,
	methods: () => methods$4
});
function createHost$4(ctx, config, { owner, ensureActive }) {
	const goal = new GoalPolicy(owner, config, { ensureActive });
	ctx.inject(["agentPresets"], (child) => goal.bind(child));
	return { goal };
}
const methods$4 = { async setGoalBlocked(blocked) {
	return this.run(() => this.goal.setBlocked(blocked));
} };

// src/features/goal-blocking/rpc.ts
const GOAL_RPC = policyRpc("setGoalBlocked", "GoalPolicyResult");
const rpc$4 = [GOAL_RPC];

// src/features/double-click-rename/definition.ts
const definition$6 = Object.freeze({
	id: "double-click-rename",
	category: "other",
	order: 3,
	keys: Object.freeze(["blockDoubleClickRename"]),
	spec: "src/features/double-click-rename/spec.md"
});

// src/features/double-click-rename/config.ts
var config_exports$6 = /* @__PURE__ */ __exportAll({
	configFields: () => configFields$6,
	settingsTool: () => settingsTool
});
const configFields$6 = { blockDoubleClickRename: z.boolean().default(false).volatile() };
const settingsTool = {
	parameters: { blockDoubleClickRename: {
		type: "boolean",
		description: "Block double-click renaming in the sidebar session list when true. Menu and keyboard renaming remain available. Omit to keep it unchanged."
	} },
	output: { blockDoubleClickRename: {
		type: "boolean",
		required: true
	} },
	mutations: [{
		field: "blockDoubleClickRename",
		order: 4
	}],
	reads: [{
		order: 6,
		read({ config }) {
			return { blockDoubleClickRename: config.blockDoubleClickRename.get() };
		}
	}]
};

// src/features/thinking-effort/definition.ts
const definition$5 = Object.freeze({
	id: "thinking-effort",
	category: "interface",
	order: 3,
	keys: Object.freeze(["showThinkingEffortSwitcher", "thinkingEffortGlyph"]),
	spec: "src/features/thinking-effort/spec.md"
});

// src/features/thinking-effort/config.ts
var config_exports$5 = /* @__PURE__ */ __exportAll({ configFields: () => configFields$5 });
const configFields$5 = {
	showThinkingEffortSwitcher: z.boolean().default(false).volatile(),
	thinkingEffortGlyph: z.string().default("arc").volatile()
};

// src/features/flowing-background/definition.ts
const definition$4 = Object.freeze({
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

// src/features/flowing-background/config.ts
var config_exports$4 = /* @__PURE__ */ __exportAll({ configFields: () => configFields$4 });
const configFields$4 = {
	flowingBackgroundEnabled: z.boolean().default(false).volatile(),
	flowingBackgroundKind: z.string().default("pattern").volatile(),
	flowingBackgroundOpacity: z.number().default(100).volatile(),
	flowingBackgroundBlur: z.number().default(0).volatile(),
	showBackgroundShortcut: z.boolean().default(false).volatile()
};

// src/features/wallpaper/definition.ts
const definition$3 = Object.freeze({
	id: "wallpaper",
	category: "interface",
	order: -1,
	keys: Object.freeze([
		"wallpaperEnabled",
		"wallpaperSelection",
		"wallpaperVisibility",
		"wallpaperBlur"
	]),
	spec: "src/features/wallpaper/spec.md"
});

// src/features/wallpaper/config.ts
var config_exports$3 = /* @__PURE__ */ __exportAll({ configFields: () => configFields$3 });
const configFields$3 = {
	wallpaperEnabled: z.boolean().volatile(),
	wallpaperSelection: z.string().volatile(),
	wallpaperVisibility: z.number().volatile(),
	wallpaperBlur: z.number().volatile()
};

// src/features/wallpaper/wallpaper.ts
/** Bounded so a single profile never carries an unbounded binary asset. */
const MAX_WALLPAPER_BYTES = 26214400;
const MIME_EXTENSIONS = {
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/webp": "webp"
};
const DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/;
function cleanName(value) {
	if (typeof value !== "string") throw new TypeError("Wallpaper name must be a string.");
	const name = value.split(/[\\/]/).pop()?.trim() ?? "";
	if (!name || name.length > 200) throw new TypeError("Wallpaper name must be 1-200 characters.");
	return name;
}
/** One user wallpaper stored inside the plugin's own profile directory. */
var WallpaperStore = class {
	home;
	directory;
	binary;
	metadata;
	ensureActive;
	constructor(home, ensureActive = () => {}) {
		if (!isAbsolute(home)) throw new TypeError("DSH home must be absolute");
		this.home = resolve(home);
		this.directory = join(this.home, "power-dsh");
		this.binary = join(this.directory, "wallpaper.bin");
		this.metadata = join(this.directory, "wallpaper.json");
		this.ensureActive = ensureActive;
	}
	async read() {
		this.ensureActive();
		let bytes;
		try {
			const info = await lstat(this.binary);
			if (!info.isFile()) throw new Error("Wallpaper must be a regular file.");
			if (info.size > 26214400) throw new Error("Wallpaper exceeds the 25 MiB limit.");
			bytes = await readFile(this.binary);
		} catch (error) {
			if (errorCode(error) === "ENOENT") return null;
			throw error;
		}
		let meta;
		try {
			const raw = JSON.parse(await readFile(this.metadata, "utf8"));
			if (typeof raw !== "object" || raw === null) throw new Error("Invalid wallpaper metadata.");
			const record = raw;
			if (typeof record.name !== "string" || typeof record.mime !== "string" || !Object.hasOwn(MIME_EXTENSIONS, record.mime)) throw new Error("Invalid wallpaper metadata.");
			meta = {
				name: record.name,
				mime: record.mime
			};
		} catch (error) {
			if (errorCode(error) === "ENOENT") return null;
			throw error;
		}
		this.ensureActive();
		return {
			name: meta.name,
			mime: meta.mime,
			bytes: bytes.byteLength,
			dataUrl: `data:${meta.mime};base64,${bytes.toString("base64")}`
		};
	}
	async save(dataUrl, rawName) {
		if (typeof dataUrl !== "string") throw new TypeError("Wallpaper must be a data URL.");
		const match = DATA_URL.exec(dataUrl);
		if (!match) throw new TypeError("Wallpaper must be a PNG, JPEG or WebP data URL.");
		const [, mime] = match;
		const name = cleanName(rawName);
		const bytes = Buffer.from(match[2], "base64");
		if (bytes.byteLength === 0) throw new TypeError("Wallpaper image is empty.");
		if (bytes.byteLength > 26214400) throw new TypeError("Wallpaper exceeds the 25 MiB limit.");
		await mkdir(this.directory, { recursive: true });
		const binTmp = join(this.directory, `.wallpaper.${randomUUID()}.bin.tmp`);
		const metaTmp = join(this.directory, `.wallpaper.${randomUUID()}.json.tmp`);
		try {
			await writeFile(binTmp, bytes, {
				flag: "wx",
				mode: 384
			});
			await writeFile(metaTmp, JSON.stringify({
				name,
				mime
			}), {
				encoding: "utf8",
				flag: "wx",
				mode: 384
			});
			this.ensureActive();
			await rename(binTmp, this.binary);
			await rename(metaTmp, this.metadata);
		} finally {
			await unlink(binTmp).catch((error) => {
				if (errorCode(error) !== "ENOENT") throw error;
			});
			await unlink(metaTmp).catch((error) => {
				if (errorCode(error) !== "ENOENT") throw error;
			});
		}
		const saved = await this.read();
		if (!saved) throw new Error("Wallpaper was not stored.");
		return saved;
	}
	async clear() {
		this.ensureActive();
		await unlink(this.binary).catch((error) => {
			if (errorCode(error) !== "ENOENT") throw error;
		});
		await unlink(this.metadata).catch((error) => {
			if (errorCode(error) !== "ENOENT") throw error;
		});
		this.ensureActive();
		return { cleared: true };
	}
};

// src/features/wallpaper/host.ts
var host_exports$3 = /* @__PURE__ */ __exportAll({
	createHost: () => createHost$3,
	methods: () => methods$3
});
function createHost$3(_ctx, _config, { owner, ensureActive }) {
	return { wallpaper: new WallpaperStore(owner.profileContext.home, ensureActive) };
}
const methods$3 = {
	readWallpaper() {
		return this.run(() => this.wallpaper.read());
	},
	saveWallpaper(dataUrl, name) {
		return this.run(() => this.wallpaper.save(dataUrl, name));
	},
	clearWallpaper() {
		return this.run(() => this.wallpaper.clear());
	}
};

// src/features/wallpaper/rpc.ts
const wallpaperCodec = {
	mode: "strict",
	typeSymbol: "power-dsh#WallpaperAsset",
	create: () => ({ parse(value) {
		if (!isRecord$1(value) || typeof value.name !== "string" || typeof value.mime !== "string" || typeof value.bytes !== "number" || typeof value.dataUrl !== "string" || !value.dataUrl.startsWith("data:image/")) throw new TypeError("Invalid wallpaper asset");
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
		if (!isRecord$1(value) || value.cleared !== true) throw new TypeError("Invalid wallpaper clear result");
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
const rpc$3 = [
	READ_WALLPAPER_RPC,
	SAVE_WALLPAPER_RPC,
	CLEAR_WALLPAPER_RPC
];

// src/features/archive/definition.ts
const definition$2 = Object.freeze({
	id: "archive",
	category: "enhance",
	order: 10.5,
	keys: Object.freeze([
		"archiveManagerEnabled",
		"autoArchiveDays",
		"autoArchivedSessions"
	]),
	spec: "src/features/archive/spec.md"
});

// src/features/archive/config.ts
var config_exports$2 = /* @__PURE__ */ __exportAll({ configFields: () => configFields$2 });
const configFields$2 = {
	archiveManagerEnabled: z.boolean().default(false).volatile(),
	autoArchiveDays: z.number().default(0).volatile(),
	autoArchivedSessions: z.array(z.string()).default([]).volatile()
};

// src/features/archive/auto-archive-policy.ts
/** The saved threshold uses 0 for “never”; unsupported Hosts preserve the preference. */
const DAY_MS$1 = 864e5;
/** A display timestamp is only a shortlist. Eligibility requires an exact native projection. */
function idleSince(createdAt, metadata) {
	if (!isTimestamp(createdAt) || metadata === null || typeof metadata !== "object" || !("blank" in metadata) || metadata.blank !== false || !("lastPromptAt" in metadata) || !isTimestamp(metadata.lastPromptAt)) return void 0;
	return Math.max(createdAt, metadata.lastPromptAt);
}
function isTimestamp(value) {
	return typeof value === "number" && Number.isFinite(value) && value > 0;
}
const AUTO_ARCHIVE_DAYS = Object.freeze([
	0,
	7,
	14,
	30,
	60,
	90
]);
const AUTO_ARCHIVE_NEVER = 0;
function normalizeDays(value) {
	return typeof value === "number" && Number.isFinite(value) && AUTO_ARCHIVE_DAYS.includes(value) ? value : 0;
}

// \0@oxc-project+runtime@0.157.0/helpers/esm/usingCtx.js
function _usingCtx() {
	var r = "function" == typeof SuppressedError ? SuppressedError : function(r, e) {
		var n = Error();
		return n.name = "SuppressedError", n.error = r, n.suppressed = e, n;
	}, e = {}, n = [];
	function using(r, e) {
		if (null != e) {
			if (Object(e) !== e) throw new TypeError("using declarations can only be used with objects, functions, null, or undefined.");
			if (r) var o = e[Symbol.asyncDispose || Symbol["for"]("Symbol.asyncDispose")];
			if (void 0 === o && (o = e[Symbol.dispose || Symbol["for"]("Symbol.dispose")], r)) var t = o;
			if ("function" != typeof o) throw new TypeError("Object is not disposable.");
			t && (o = function o() {
				try {
					t.call(e);
				} catch (r) {
					return Promise.reject(r);
				}
			}), n.push({
				v: e,
				d: o,
				a: r
			});
		} else r && n.push({
			d: e,
			a: r
		});
		return e;
	}
	return {
		e,
		u: using.bind(null, !1),
		a: using.bind(null, !0),
		d: function d() {
			var o, t = this.e, s = 0;
			function next() {
				for (; o = n.pop();) try {
					if (!o.a && 1 === s) return s = 0, n.push(o), Promise.resolve().then(next);
					if (o.d) {
						var r = o.d.call(o.v);
						if (o.a) return s |= 2, Promise.resolve(r).then(next, err);
					} else s |= 1;
				} catch (r) {
					return err(r);
				}
				if (1 === s) return t !== e ? Promise.reject(t) : Promise.resolve();
				if (t !== e) throw t;
			}
			function err(n) {
				return t = t !== e ? new r(n, t) : n, next();
			}
			return next();
		}
	};
}

// src/features/archive/auto-archive-host.ts
const VERIFIED_RELEASE = "0.2.2-rc.1";
const ACTIVITY = "workspace/session-activity";
const skip = /* @__PURE__ */ new Error("autoArchiveCandidateChanged");
function installAutoArchive(ctx, prefs, { owner = ctx, ensureActive } = {}) {
	ctx.inject([
		"workspaceRegistry",
		"sessionController",
		"sessionQuery",
		"sessions",
		"agents",
		"configEditor",
		"clientModules"
	], (injected) => {
		const child = injected;
		const { workspaceRegistry: registry, sessionQuery: query, sessionController: controller, sessions, agents, configEditor } = child;
		if (child.clientModules?.graph().release?.version !== VERIFIED_RELEASE || typeof child.waterfall !== "function" || typeof query?.observeSession !== "function" || typeof controller?.list !== "function" || typeof sessions?.get !== "function" || typeof agents?.get !== "function" || typeof registry?.archiveSession !== "function" || typeof registry.unarchiveSession !== "function" || typeof configEditor?.edit !== "function") return;
		const lifetime = new AbortController();
		const { signal } = lifetime;
		const days = () => normalizeDays(prefs.autoArchiveDays.get());
		const checkRunning = (expected) => {
			if (signal.aborted || days() !== expected) throw skip;
			ensureActive?.();
		};
		const free = (id) => !registry.archivedSessionIds.includes(id) && !registry.pinnedSessionIds.includes(id);
		const running = (id) => {
			const agent = agents.get(id);
			return agent !== void 0 && "status" in agent && agent.status === "running";
		};
		let lastWarning;
		const warn = (reason) => {
			if (lastWarning === reason) return;
			lastWarning = reason;
			try {
				child.logger?.warn(`PowerDSH auto archive: ${reason}`);
			} catch {}
		};
		async function observe(id) {
			try {
				try {
					var _usingCtx$1 = _usingCtx();
					const observation = _usingCtx$1.u(await query.observeSession(id, { signal }));
					const { header, source, cursor } = observation;
					const activityAt = idleSince(header.createdAt, observation.projections?.values.sessionListMetadata);
					const live = sessions.get(id);
					if (activityAt === void 0 || header.id !== id || typeof header.cwd !== "string" || header.origin === "subagent" || (source === "live" ? live?.seq !== cursor + 1 : source !== "prepared" || live !== void 0)) return;
					return {
						activityAt,
						cursor,
						source,
						live
					};
				} catch (_) {
					_usingCtx$1.e = _;
				} finally {
					_usingCtx$1.d();
				}
			} catch {}
		}
		const ownArchive = new AsyncLocalStorage();
		child.on(ACTIVITY, async ({ sessionId: id }, next) => {
			const attempt = ownArchive.getStore();
			if (attempt?.id !== id) return next();
			checkRunning(attempt.days);
			if (!free(id) || running(id)) throw skip;
			const point = await observe(id);
			if (!point || point.activityAt !== attempt.activityAt || point.activityAt > Date.now() - attempt.days * 864e5) throw skip;
			const activity = await next();
			checkRunning(attempt.days);
			const live = sessions.get(id);
			if (activity.length || !free(id) || running(id) || live !== point.live || live !== void 0 && live.seq !== point.cursor + 1) throw skip;
			attempt.cursor = point.cursor;
			return activity;
		}, {
			global: true,
			prepend: true
		});
		async function archive(id, threshold, activityAt) {
			const attempt = {
				id,
				days: threshold,
				queued: false,
				activityAt
			};
			let failed = false;
			try {
				await ownArchive.run(attempt, () => registry.archiveSession(id, { get stopActivity() {
					if (!attempt.queued) {
						checkRunning(threshold);
						if (!free(id) || running(id)) throw skip;
						attempt.queued = true;
					}
					return false;
				} }));
			} catch (error) {
				if (error === skip) return;
				failed = true;
				if (!signal.aborted) warn("native archive failed");
			}
			if (!attempt.queued || !registry.archivedSessionIds.includes(id)) return;
			const observed = await observe(id);
			let conflict = failed || !observed || observed.cursor !== attempt.cursor || observed.activityAt !== activityAt || signal.aborted || days() !== threshold;
			if (!conflict) try {
				conflict = (await child.waterfall(ACTIVITY, { sessionId: id }, async () => [])).length > 0 || running(id);
			} catch {
				conflict = true;
			}
			if (!conflict) return;
			try {
				await registry.unarchiveSession(id);
				if (registry.archivedSessionIds.includes(id)) warn("archive rollback could not be verified");
			} catch {
				warn("archive rollback failed");
			}
		}
		async function scan(threshold) {
			const cutoff = Date.now() - threshold * DAY_MS$1;
			const { items } = await controller.list({}, signal);
			for (const row of items) {
				checkRunning(threshold);
				const id = row.sessionId;
				if (!id || !isTimestamp(row.updatedAt) || row.updatedAt > cutoff || !free(id) || running(id) || prefs.autoArchivedSessions.get().includes(id)) continue;
				const point = await observe(id);
				if (!point || point.activityAt > cutoff || !free(id) || running(id)) continue;
				try {
					await configEditor.edit(owner.fiber.entry, (raw) => {
						checkRunning(threshold);
						if (!free(id) || running(id)) throw skip;
						const saved = raw.autoArchivedSessions ?? [];
						const effective = prefs.autoArchivedSessions.get();
						if (!Array.isArray(saved) || saved.some((value) => typeof value !== "string")) throw new Error("Invalid auto archive exclusions");
						if (saved.includes(id) || effective.includes(id)) throw skip;
						return {
							...raw,
							autoArchivedSessions: [.../* @__PURE__ */ new Set([
								...saved,
								...effective,
								id
							])]
						};
					});
					checkRunning(threshold);
					if (!prefs.autoArchivedSessions.get().includes(id)) {
						warn("durable exclusion was not read back");
						return;
					}
				} catch (error) {
					if (error === skip) continue;
					if (!signal.aborted) warn("durable exclusion could not be written");
					return;
				}
				await archive(id, threshold, point.activityAt);
			}
		}
		let lastDays = 0;
		let task;
		let rerun = false;
		function tick() {
			if (signal.aborted) return;
			const threshold = lastDays = days();
			if (!threshold) return;
			if (task) {
				rerun = true;
				return;
			}
			task = scan(threshold).catch((error) => {
				if (error !== skip && !signal.aborted) warn("candidate scan failed");
			}).finally(() => {
				task = void 0;
				if (rerun) {
					rerun = false;
					tick();
				}
			});
		}
		const changed = () => {
			if (days() !== lastDays) tick();
		};
		child.on("settings/document-updated", (namespace) => {
			if (namespace === owner.fiber.entry.options.id) changed();
		});
		child.on("app-boot/config-reload", changed);
		child.effect(() => {
			const start = setTimeout(tick, 0);
			const interval = setInterval(tick, DAY_MS$1);
			start.unref?.();
			interval.unref?.();
			return () => {
				lifetime.abort();
				clearTimeout(start);
				clearInterval(interval);
			};
		});
	});
}

// src/features/archive/archive-catalog.ts
/**
* Fold the native Workspace baseline and the archived-session titles into a
* plain projection. Ordering is deterministic so identical inputs render alike.
*/
function buildArchiveCatalog(baseline, titles) {
	const pathOf = (item) => typeof item.path === "string" ? item.path : "";
	const workspaces = baseline.items.map((item) => ({
		workspaceId: item.workspaceId,
		title: item.title,
		path: pathOf(item)
	}));
	const owner = /* @__PURE__ */ new Map();
	for (const item of baseline.items) for (const sessionId of item.sessionIds) if (!owner.has(sessionId)) owner.set(sessionId, {
		workspaceId: item.workspaceId,
		title: item.title,
		path: pathOf(item)
	});
	const seen = /* @__PURE__ */ new Set();
	const sessions = [];
	for (const sessionId of baseline.archivedSessionIds) {
		if (seen.has(sessionId)) continue;
		seen.add(sessionId);
		const workspace = owner.get(sessionId);
		const meta = titles.get(sessionId);
		sessions.push({
			sessionId,
			title: meta?.title ?? "",
			workspaceId: workspace?.workspaceId ?? "",
			workspaceTitle: workspace?.title ?? "",
			workspacePath: workspace?.path ?? "",
			updatedAt: meta?.updatedAt ?? 0,
			createdAt: meta?.createdAt ?? 0
		});
	}
	return {
		complete: true,
		workspaces,
		sessions
	};
}

// src/features/archive/archive-service.ts
const ACTIVITY_TTL_MS = 5e3;
const JSONL_GENERATION = /^session(?:\.v[1-9][0-9]*)?\.jsonl(?:\.zstd)?$/u;
const STAGE_PREFIX = ".power-dsh-delete-";
var ArchiveService = class {
	workspaceController = null;
	sessionQuery = null;
	sessionController = null;
	deleteAccess = null;
	activityCache;
	async list() {
		const controller = this.workspaceController;
		if (!controller || !this.sessionQuery) throw new Error("archiveUnavailable");
		const abort = new AbortController();
		try {
			const baseline = await readBaseline$1(controller, abort.signal);
			const titles = await this.titlesFor(baseline.archivedSessionIds, abort.signal);
			return buildArchiveCatalog(baseline, titles);
		} finally {
			abort.abort();
		}
	}
	async restore(sessionId) {
		const controller = this.workspaceController;
		if (!controller) throw new Error("archiveUnavailable");
		if (!validSessionId(sessionId)) throw new Error("archiveInvalidSession");
		await controller.unarchiveSession({ sessionId });
		return this.list();
	}
	async delete(sessionId) {
		if (!validSessionId(sessionId)) throw new Error("archiveInvalidSession");
		const access = this.deleteAccess;
		const controller = this.workspaceController;
		if (access?.persistence.name !== "session-persistence-jsonl" || !controller || !this.sessionQuery) throw new Error("archiveDeleteUnavailable");
		const abort = new AbortController();
		let baseline;
		try {
			baseline = await readBaseline$1(controller, abort.signal);
		} catch {
			throw new Error("archiveDeleteCheckFailed");
		} finally {
			abort.abort();
		}
		if (!baseline.archivedSessionIds.includes(sessionId)) throw new Error("archiveNotArchived");
		const { persistence, registry, isLive } = access;
		const check = () => {
			if (this.deleteAccess !== access || this.workspaceController !== controller) throw new Error("archiveDeleteUnavailable");
			if (!registry.archivedSessionIds.includes(sessionId)) throw new Error("archiveNotArchived");
			if (isLive(sessionId)) throw new Error("archiveDeleteBusy");
		};
		check();
		const before = await persistence.stat(sessionId).catch(() => {
			throw new Error("archiveDeleteStatFailed");
		});
		const path = artifactPath(before, sessionId);
		const identity = checkArtifact(path);
		check();
		const handle = await persistence.open(sessionId, "write").catch((error) => {
			throw new Error(error instanceof Error && error.name === "SessionAlreadyOwnedError" ? "archiveDeleteBusy" : "archiveDeleteCheckFailed");
		});
		let deleted = false;
		try {
			const after = await persistence.stat(sessionId).catch(() => {
				throw new Error("archiveDeleteStatFailed");
			});
			if (handle.header.id !== sessionId || artifactPath(after, sessionId) !== path || after?.revision !== before?.revision) throw new Error("archiveDeleteUnsafe");
			const current = checkArtifact(path);
			if (current.dev !== identity.dev || current.ino !== identity.ino || current.ctimeNs !== identity.ctimeNs) throw new Error("archiveDeleteUnsafe");
			check();
			const stage = stageArtifact(path);
			try {
				await controller.unarchiveSession({ sessionId });
				if (this.deleteAccess !== access || this.workspaceController !== controller || registry.archivedSessionIds.includes(sessionId)) throw new Error("archiveDeleteUnarchiveFailed");
				if (isLive(sessionId)) throw new Error("archiveDeleteBusy");
			} catch {
				restoreArtifact(path, stage);
				throw new Error("archiveDeleteUnarchiveFailed");
			}
			try {
				unlinkSync(stage.file);
				deleted = true;
			} catch {
				restoreArtifact(path, stage);
				throw new Error("archiveDeleteRemoveFailed");
			} finally {
				removeEmptyStage(stage.dir);
			}
		} finally {
			try {
				await handle.close();
			} catch {
				if (deleted) throw new Error("archiveDeleteReleaseFailed");
			}
		}
		this.activityCache = void 0;
		return this.list().catch(() => ({
			...buildArchiveCatalog({
				...baseline,
				archivedSessionIds: baseline.archivedSessionIds.filter((id) => id !== sessionId)
			}, /* @__PURE__ */ new Map()),
			complete: false
		}));
	}
	async titlesFor(ids, signal) {
		const titles = /* @__PURE__ */ new Map();
		const query = this.sessionQuery;
		const unique = [...new Set(ids)];
		if (!query || unique.length === 0) return titles;
		const results = await query.readTitleSnapshots(unique, signal);
		for (const result of results) if (result.status === "fulfilled") titles.set(result.sessionId, {
			title: result.value.title?.title ?? "",
			updatedAt: result.value.title?.updatedAt ?? 0,
			createdAt: result.value.session.createdAt
		});
		const activity = await this.activity(signal);
		for (const [sessionId, entry] of titles) {
			const lastActive = activity.get(sessionId);
			if (lastActive !== void 0) titles.set(sessionId, {
				...entry,
				updatedAt: lastActive
			});
		}
		return titles;
	}
	/** Short-lived display cache; never used to admit a mutation. */
	async activity(signal) {
		const cached = this.activityCache;
		if (cached !== void 0 && Date.now() - cached.at < ACTIVITY_TTL_MS) return cached.value;
		const activity = /* @__PURE__ */ new Map();
		const controller = this.sessionController;
		if (!controller || typeof controller.list !== "function") return activity;
		const { items } = await controller.list({}, signal).catch(() => ({ items: [] }));
		for (const item of items) {
			if (typeof item?.sessionId !== "string" || typeof item.updatedAt !== "number" || !Number.isFinite(item.updatedAt)) continue;
			activity.set(item.sessionId, item.updatedAt);
		}
		this.activityCache = {
			at: Date.now(),
			value: activity
		};
		return activity;
	}
};
function artifactPath(snapshot, sessionId) {
	if (!snapshot || snapshot.formatStatus !== "current" || snapshot.location?.kind !== "jsonl" || typeof snapshot.revision !== "string") throw new Error("archiveDeleteUnsupported");
	const { path } = snapshot.location;
	if (snapshot.header.id !== sessionId || !isAbsolute(path) || normalize(path) !== path || basename(dirname(path)) !== sessionId || !JSONL_GENERATION.test(basename(path))) throw new Error("archiveDeleteUnsafe");
	return path;
}
function checkArtifact(path) {
	try {
		const dir = dirname(path);
		if (!lstatSync(dir).isDirectory() || !lstatSync(dirname(dir)).isDirectory()) throw new Error("unexpected directory");
		const file = lstatSync(path, { bigint: true });
		if (!file.isFile() || file.nlink !== 1n) throw new Error("unexpected transcript");
		const lock = lstatSync(join(dir, "session.lock"), { throwIfNoEntry: false });
		if (lock && (!lock.isFile() || lock.nlink !== 1 || lock.size !== 0)) throw new Error("unexpected writer lock");
		const entries = readdirSync(dir);
		if (entries.some((name) => name.startsWith(STAGE_PREFIX))) throw new Error("archiveDeleteRecoveryRequired");
		if (entries.some((name) => name !== basename(path) && JSONL_GENERATION.test(name))) throw new Error("archiveDeleteUnsupported");
		return file;
	} catch (error) {
		if (error instanceof Error && (error.message === "archiveDeleteUnsupported" || error.message === "archiveDeleteRecoveryRequired")) throw error;
		throw new Error("archiveDeleteUnsafe");
	}
}
function stageArtifact(path) {
	let dir;
	try {
		dir = mkdtempSync(join(dirname(path), STAGE_PREFIX));
		const file = join(dir, basename(path));
		renameSync(path, file);
		return {
			dir,
			file
		};
	} catch {
		if (dir) removeEmptyStage(dir);
		throw new Error("archiveDeleteRemoveFailed");
	}
}
function restoreArtifact(path, stage) {
	try {
		linkSync(stage.file, path);
		unlinkSync(stage.file);
	} catch {
		throw new Error("archiveDeleteRecoveryRequired");
	} finally {
		removeEmptyStage(stage.dir);
	}
}
function removeEmptyStage(dir) {
	try {
		rmdirSync(dir);
	} catch {}
}
function validSessionId(sessionId) {
	return typeof sessionId === "string" && sessionId.length > 0 && sessionId.length <= 1024;
}
/** Resolve the first complete Workspace baseline and stop the stream. */
async function readBaseline$1(controller, signal) {
	for await (const frame of controller.follow(signal)) if ((frame.type === "baseline" || frame.type === "replace") && frame.value) return frame.value;
	throw new Error("archiveUnavailable");
}

// src/features/archive/host.ts
var host_exports$2 = /* @__PURE__ */ __exportAll({
	createHost: () => createHost$2,
	methods: () => methods$2
});
function createHost$2(ctx, config, options) {
	const archive = new ArchiveService();
	ctx.inject(["workspaceController", "sessionQuery"], (child) => {
		archive.workspaceController = child.workspaceController ?? null;
		archive.sessionQuery = child.sessionQuery ?? null;
		child.effect(() => () => {
			archive.workspaceController = null;
			archive.sessionQuery = null;
		});
	});
	ctx.inject(["sessionController"], (child) => {
		archive.sessionController = child.sessionController ?? null;
		child.effect(() => () => {
			archive.sessionController = null;
		});
	});
	ctx.inject([
		"workspaceRegistry",
		"sessionPersistence",
		"sessions",
		"agents"
	], (child) => {
		const registry = child.workspaceRegistry;
		const persistence = child.sessionPersistence;
		const sessions = child.sessions;
		if (!registry || !("archivedSessionIds" in registry) || typeof persistence?.open !== "function" || typeof sessions?.get !== "function") return;
		const access = {
			registry,
			persistence,
			isLive: (id) => sessions.get(id) !== void 0 || child.agents.get(id) !== void 0
		};
		archive.deleteAccess = access;
		child.effect(() => () => {
			if (archive.deleteAccess === access) archive.deleteAccess = null;
		});
	});
	installAutoArchive(ctx, config, options);
	return { archive };
}
const methods$2 = {
	listArchivedSessions() {
		return this.run(() => this.archive.list());
	},
	restoreArchivedSession(sessionId) {
		return this.run(() => this.archive.restore(sessionId));
	},
	deleteArchivedSession(sessionId) {
		return this.run(() => this.archive.delete(sessionId));
	}
};

// src/features/archive/rpc.ts
const archiveCatalogCodec = {
	mode: "strict",
	typeSymbol: "power-dsh#ArchiveCatalog",
	create: () => ({ parse(value) {
		if (!isRecord$1(value) || typeof value.complete !== "boolean" || !isArray(value.workspaces) || !isArray(value.sessions)) throw new TypeError("Invalid archive catalog");
		const pathOf = (row) => typeof row.path === "string" ? row.path : "";
		const workspaces = value.workspaces.map((row) => {
			if (!isRecord$1(row) || !hasStrings(row, ["workspaceId", "title"])) throw new TypeError("Invalid archive workspace");
			return {
				workspaceId: row.workspaceId,
				title: row.title,
				path: pathOf(row)
			};
		});
		const sessions = value.sessions.map((row) => {
			if (!isRecord$1(row) || !hasStrings(row, [
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
				workspacePath: pathOf(row),
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
const rpc$2 = [
	LIST_ARCHIVED_SESSIONS_RPC,
	RESTORE_ARCHIVED_SESSION_RPC,
	DELETE_ARCHIVED_SESSION_RPC
];

// src/features/usage-stats/definition.ts
const definition$1 = Object.freeze({
	id: "usage-stats",
	category: "enhance",
	order: 12,
	keys: Object.freeze(["usageStatsEnabled"]),
	spec: "src/features/usage-stats/spec.md"
});

// src/features/usage-stats/config.ts
var config_exports$1 = /* @__PURE__ */ __exportAll({ configFields: () => configFields$1 });
const configFields$1 = { usageStatsEnabled: z.boolean().default(false).volatile() };

// src/features/usage-stats/usage-fold.ts
const DAY_MS = 864e5;
function emptyDay(date) {
	return {
		date,
		totalTokens: 0,
		turnCount: 0,
		toolCallCount: 0,
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		requestCount: 0,
		activeMs: 0
	};
}
/** Split a recorded interval at reporting-zone midnights, including DST transitions. */
function addRuntime(rows, start, end, toDay) {
	let cursor = start;
	while (cursor < end) {
		const date = toDay(cursor);
		let boundary = end;
		if (toDay(end - 1) !== date) {
			let low = cursor;
			let high = end;
			while (high - low > 1) {
				const middle = Math.floor((low + high) / 2);
				if (toDay(middle) === date) low = middle;
				else high = middle;
			}
			boundary = high;
		}
		const row = rows.get(date) ?? emptyDay(date);
		row.activeMs += boundary - cursor;
		rows.set(date, row);
		cursor = boundary;
	}
}
/**
* Bucket one instant into a `YYYY-MM-DD` day key in the requested zone.
* Falls back to UTC when the runtime rejects the zone.
*/
function dayKeyFormatter(timeZone) {
	const options = {
		year: "numeric",
		month: "2-digit",
		day: "2-digit"
	};
	let format;
	try {
		format = new Intl.DateTimeFormat("en-CA", {
			...options,
			timeZone
		});
	} catch {
		format = new Intl.DateTimeFormat("en-CA", {
			...options,
			timeZone: "UTC"
		});
	}
	return (time) => {
		const parts = format.formatToParts(new Date(time));
		const pick = (type) => parts.find((part) => part.type === type)?.value ?? "";
		return `${pick("year")}-${pick("month")}-${pick("day")}`;
	};
}
function isRecord(value) {
	return typeof value === "object" && value !== null;
}
function finite(value) {
	return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}
function bucketsOf(raw) {
	const inputTokens = finite(raw.inputTokens);
	const outputTokens = finite(raw.outputTokens);
	const cacheReadTokens = finite(raw.cacheReadTokens);
	const cacheWriteTokens = finite(raw.cacheWriteTokens);
	return {
		inputTokens,
		outputTokens,
		cacheReadTokens,
		cacheWriteTokens,
		totalTokens: inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens
	};
}
/** The last usage sample embedded in a settlement stream; usage chunks are never packed. */
function streamUsage(stream) {
	if (!Array.isArray(stream)) return null;
	for (let index = stream.length - 1; index >= 0; index--) {
		const record = stream[index];
		if (!isRecord(record) || record.type !== "chunk" || !isRecord(record.chunk)) continue;
		if (record.chunk.type !== "usage" || !isRecord(record.chunk.usage)) continue;
		return record.chunk.usage;
	}
	return null;
}
/**
* Provider-reported usage of one durable Assistant settlement.
*
* A failed or cancelled attempt still billed tokens, so its embedded stream
* sample counts too; the Host token meter folds both event types.
*/
function usageOf(event) {
	if (event.type !== "assistant/message" && event.type !== "assistant/attempt") return null;
	if (!isRecord(event.data)) return null;
	if (isRecord(event.data.usage)) return bucketsOf(event.data.usage);
	const sample = streamUsage(event.data.stream);
	return sample === null ? null : bucketsOf(sample);
}
/** Turn and step that own one settlement; the Host replaces samples within the same slot. */
function settlementOf(event) {
	if (!isRecord(event.data)) return null;
	const { turn, step } = event.data;
	return typeof turn === "number" && Number.isFinite(turn) && typeof step === "number" && Number.isFinite(step) ? {
		turn,
		step
	} : null;
}
function modelRoute(source) {
	if (!isRecord(source) || typeof source.model !== "string" || !source.model) return null;
	return {
		provider: typeof source.provider === "string" ? source.provider : "",
		modelId: source.model
	};
}
/** Provider and model that produced one assistant message, when declared. */
function modelOf(event) {
	if (event.type !== "assistant/message" || !isRecord(event.data) || !isRecord(event.data.message)) return null;
	return modelRoute(event.data.message.source);
}
/** Recovery closes an open step immediately before closing its turn at the same timestamp. */
function isSyntheticStepEnd(stepEnd, next) {
	if (next?.type !== "turn/end" || stepEnd.time !== next.time || !isRecord(next.data) || !isRecord(next.data.reason)) return false;
	if (next.data.reason.kind !== "interrupted" && next.data.reason.kind !== "forked") return false;
	return !isRecord(stepEnd.data) || stepEnd.data.turn === void 0 || stepEnd.data.turn === next.data.turn;
}
function timeOf(event) {
	return typeof event.time === "number" && Number.isFinite(event.time) && event.time > 0 ? event.time : null;
}
function dayDifference(left, right) {
	const a = Date.parse(`${left}T00:00:00.000Z`);
	const b = Date.parse(`${right}T00:00:00.000Z`);
	if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN;
	return Math.round((a - b) / DAY_MS);
}
function addDays(dateKey, days) {
	const base = Date.parse(`${dateKey}T00:00:00.000Z`);
	if (!Number.isFinite(base)) return dateKey;
	return new Date(base + days * DAY_MS).toISOString().slice(0, 10);
}
/**
* Longest run of consecutive active days, and the run that reaches today or
* yesterday. A single quiet day keeps the current streak alive.
*/
function streakDays(days, today) {
	const unique = [...new Set(days)].sort();
	let longest = 0;
	let run = 0;
	let previous = "";
	for (const day of unique) {
		run = previous && dayDifference(day, previous) === 1 ? run + 1 : 1;
		previous = day;
		if (run > longest) longest = run;
	}
	let current = 0;
	if (unique.length > 0) {
		const gap = dayDifference(today, unique[unique.length - 1]);
		if (gap === 0 || gap === 1) current = run;
	}
	return {
		current,
		longest
	};
}
/** Fill every quiet day between the first and last activity with a zero row. */
function fillDays(rows, firstDate, lastDate) {
	if (!firstDate || !lastDate) return [];
	const known = new Map(rows.map((row) => [row.date, row]));
	const total = dayDifference(lastDate, firstDate);
	if (!Number.isFinite(total) || total < 0) return [];
	const days = [];
	for (let offset = 0; offset <= total; offset++) {
		const date = addDays(firstDate, offset);
		days.push(known.get(date) ?? emptyDay(date));
	}
	return days;
}
/**
* Fold child-owned session events into cacheable day and model aggregates.
*
* Only provider-reported usage from durable Assistant settlements counts.
* Turns and tool calls are counted independently of usage.
*/
function foldSession(session, toDay) {
	const dayRows = /* @__PURE__ */ new Map();
	const modelRows = /* @__PURE__ */ new Map();
	const dailyModelRows = /* @__PURE__ */ new Map();
	const fold = {
		days: [],
		models: [],
		dailyModels: [],
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		totalTokens: 0,
		turnCount: 0,
		hasUsage: false,
		firstTime: null,
		lastTime: null,
		longestSpanMs: 0
	};
	const bump = (time, field) => {
		const date = toDay(time);
		const row = dayRows.get(date) ?? emptyDay(date);
		row[field] += 1;
		dayRows.set(date, row);
	};
	let activeStart = null;
	let requestRoute = null;
	let slot = null;
	const flushSlot = () => {
		const settlement = slot;
		slot = null;
		if (!settlement || settlement.usage.totalTokens === 0) return;
		const { time, usage, model: { provider, modelId } } = settlement;
		const date = toDay(time);
		const row = dayRows.get(date) ?? emptyDay(date);
		for (const field of [
			"totalTokens",
			"inputTokens",
			"outputTokens",
			"cacheReadTokens",
			"cacheWriteTokens"
		]) {
			row[field] += usage[field];
			fold[field] += usage[field];
		}
		row.requestCount += 1;
		dayRows.set(date, row);
		fold.hasUsage = true;
		const key = `${provider}\u0000${modelId}`;
		const entry = modelRows.get(key) ?? {
			modelId,
			provider,
			totalTokens: 0,
			requestCount: 0
		};
		entry.totalTokens += usage.totalTokens;
		entry.requestCount += 1;
		modelRows.set(key, entry);
		const dayKey = `${date}\u0000${key}`;
		const daily = dailyModelRows.get(dayKey) ?? {
			date,
			modelId,
			provider,
			totalTokens: 0,
			requestCount: 0
		};
		daily.totalTokens += usage.totalTokens;
		daily.requestCount += 1;
		dailyModelRows.set(dayKey, daily);
	};
	const observe = (time) => {
		if (fold.firstTime === null || time < fold.firstTime) fold.firstTime = time;
		if (fold.lastTime === null || time > fold.lastTime) fold.lastTime = time;
	};
	for (const [index, event] of session.events.entries()) {
		const time = timeOf(event);
		if (time !== null) observe(time);
		if (event.type === "step/start") activeStart = time;
		else if (event.type === "step/end") {
			if (activeStart !== null && time !== null && time > activeStart && !isSyntheticStepEnd(event, session.events[index + 1])) addRuntime(dayRows, activeStart, time, toDay);
			activeStart = null;
		} else if (event.type === "turn/end" || event.type === "turn/start") {
			activeStart = null;
			if (event.type === "turn/start") {
				fold.turnCount += 1;
				if (time !== null) bump(time, "turnCount");
			}
		} else if (event.type === "request/context") {
			const route = modelRoute(event.data);
			requestRoute = route?.provider ? route : null;
		} else if (event.type === "llm/retry-started") {
			const retried = settlementOf(event);
			if (retried && slot?.coords?.turn === retried.turn && slot.coords.step === retried.step) flushSlot();
		} else if (event.type === "assistant/message" || event.type === "assistant/attempt") {
			const usage = usageOf(event);
			if (!usage || time === null) continue;
			const coords = settlementOf(event);
			if (!coords || slot?.coords?.turn !== coords.turn || slot.coords.step !== coords.step) flushSlot();
			slot = {
				coords,
				time,
				usage,
				model: modelOf(event) ?? requestRoute ?? {
					provider: "",
					modelId: ""
				}
			};
			if (!coords) flushSlot();
		} else if (event.type === "tool/call" && time !== null) bump(time, "toolCallCount");
	}
	flushSlot();
	if (fold.firstTime !== null && fold.lastTime !== null) {
		const start = typeof session.createdAt === "number" && session.createdAt > 0 ? Math.min(session.createdAt, fold.firstTime) : fold.firstTime;
		fold.longestSpanMs = Math.max(0, fold.lastTime - start);
	}
	fold.days = [...dayRows.values()].sort((left, right) => left.date.localeCompare(right.date));
	fold.models = [...modelRows.values()];
	fold.dailyModels = [...dailyModelRows.values()].sort((left, right) => left.date.localeCompare(right.date) || left.modelId.localeCompare(right.modelId));
	return fold;
}
/**
* Merge per-session folds into the lifetime projection shown by the page.
* Days are bucketed in the caller's zone, so the same logs can report
* different day boundaries for different clients.
*/
function mergeUsage(input) {
	const dayRows = /* @__PURE__ */ new Map();
	const modelRows = /* @__PURE__ */ new Map();
	const dailyModelRows = /* @__PURE__ */ new Map();
	const summary = {
		totalTokens: 0,
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		peakDayTokens: 0,
		longestSessionMs: 0,
		currentStreakDays: 0,
		longestStreakDays: 0,
		activeDays: 0,
		sessionCount: 0,
		turnCount: 0
	};
	const toDay = dayKeyFormatter(input.timeZone);
	let firstDate = "";
	let lastDate = "";
	for (const session of input.sessions) {
		for (const row of session.days) {
			const target = dayRows.get(row.date) ?? emptyDay(row.date);
			target.totalTokens += row.totalTokens;
			target.turnCount += row.turnCount;
			target.toolCallCount += row.toolCallCount;
			target.inputTokens += row.inputTokens;
			target.outputTokens += row.outputTokens;
			target.cacheReadTokens += row.cacheReadTokens;
			target.cacheWriteTokens += row.cacheWriteTokens;
			target.requestCount += row.requestCount;
			target.activeMs += row.activeMs;
			dayRows.set(row.date, target);
		}
		for (const model of session.models) {
			const key = `${model.provider}\u0000${model.modelId}`;
			const target = modelRows.get(key) ?? {
				modelId: model.modelId,
				provider: model.provider,
				totalTokens: 0,
				requestCount: 0
			};
			target.totalTokens += model.totalTokens;
			target.requestCount += model.requestCount;
			modelRows.set(key, target);
		}
		for (const daily of session.dailyModels) {
			const key = `${daily.date}\u0000${daily.provider}\u0000${daily.modelId}`;
			const target = dailyModelRows.get(key) ?? {
				date: daily.date,
				modelId: daily.modelId,
				provider: daily.provider,
				totalTokens: 0,
				requestCount: 0
			};
			target.totalTokens += daily.totalTokens;
			target.requestCount += daily.requestCount;
			dailyModelRows.set(key, target);
		}
		summary.totalTokens += session.totalTokens;
		summary.inputTokens += session.inputTokens;
		summary.outputTokens += session.outputTokens;
		summary.cacheReadTokens += session.cacheReadTokens;
		summary.cacheWriteTokens += session.cacheWriteTokens;
		summary.turnCount += session.turnCount;
		if (session.days.length > 0) summary.sessionCount += 1;
		if (session.longestSpanMs > summary.longestSessionMs) summary.longestSessionMs = session.longestSpanMs;
		if (session.firstTime !== null) {
			const first = toDay(session.firstTime);
			if (!firstDate || first < firstDate) firstDate = first;
		}
		if (session.lastTime !== null) {
			const last = toDay(session.lastTime);
			if (!lastDate || last > lastDate) lastDate = last;
		}
	}
	const rows = [...dayRows.values()].sort((left, right) => left.date.localeCompare(right.date));
	for (const row of rows) if (row.totalTokens > summary.peakDayTokens) summary.peakDayTokens = row.totalTokens;
	summary.activeDays = rows.filter((row) => row.totalTokens > 0).length;
	const streak = streakDays(rows.filter((row) => row.totalTokens > 0).map((row) => row.date), toDay(input.generatedAt));
	summary.currentStreakDays = streak.current;
	summary.longestStreakDays = streak.longest;
	return {
		complete: input.complete,
		generatedAt: input.generatedAt,
		timeZone: input.timeZone,
		firstDate,
		lastDate,
		summary,
		sessionDays: input.sessions.map((session) => session.days.map((row) => row.date)).filter((dates) => dates.length > 0),
		days: fillDays(rows, firstDate, lastDate),
		dailyModels: [...dailyModelRows.values()].sort((left, right) => left.date.localeCompare(right.date) || left.modelId.localeCompare(right.modelId)),
		models: [...modelRows.values()].sort((left, right) => right.totalTokens - left.totalTokens || left.modelId.localeCompare(right.modelId))
	};
}

// src/features/usage-stats/usage-service.ts
/** Bound the per-session fold cache so a long-lived Host never grows without limit. */
const MAX_CACHED_SESSIONS = 512;
/** Bound concurrent log reads: each cold read decodes and parses a whole log. */
const READ_CONCURRENCY = 4;
/**
* Folds every readable stored session log into one lifetime usage projection.
*
* Only provider-reported assistant usage counts; the fold never estimates.
* Per-session results are cached by the persistence revision and reporting
* zone, so a refresh only re-reads logs that actually changed.
*/
var UsageService = class {
	persistence = null;
	cache = /* @__PURE__ */ new Map();
	async snapshot(timeZone, signal) {
		const persistence = this.persistence;
		if (!persistence) throw new Error("usageUnavailable");
		const zone = normalizeZone(timeZone);
		const stored = await persistence.list({ signal });
		signal?.throwIfAborted();
		const folds = /* @__PURE__ */ new Map();
		let complete = true;
		const queue = [...stored].sort((left, right) => left.header.createdAt - right.header.createdAt);
		let cursor = 0;
		const worker = async () => {
			while (cursor < queue.length) {
				const entry = queue[cursor++];
				if (!entry) return;
				signal?.throwIfAborted();
				try {
					folds.set(entry.header.id, await this.fold(entry, zone, signal));
				} catch (error) {
					if (signal?.aborted) throw error;
					complete = false;
				}
			}
		};
		await Promise.all(Array.from({ length: Math.min(READ_CONCURRENCY, queue.length) }, worker));
		signal?.throwIfAborted();
		this.prune(new Set(stored.map((entry) => entry.header.id)));
		const snapshot = mergeUsage({
			timeZone: zone,
			complete,
			generatedAt: Date.now(),
			sessions: [...folds.values()]
		});
		const entries = new Map(stored.map((entry) => [entry.header.id, entry]));
		const families = /* @__PURE__ */ new Map();
		for (const [id, fold] of folds) {
			let root = entries.get(id);
			const seen = /* @__PURE__ */ new Set([id]);
			while (root.header.origin === "subagent" && root.header.parentSession) {
				const parent = entries.get(root.header.parentSession);
				if (!parent || seen.has(parent.header.id)) break;
				seen.add(parent.header.id);
				root = parent;
			}
			const dates = families.get(root.header.id) ?? /* @__PURE__ */ new Set();
			for (const day of fold.days) dates.add(day.date);
			families.set(root.header.id, dates);
		}
		snapshot.sessionDays = [...families.values()].filter((dates) => dates.size > 0).map((dates) => [...dates].sort());
		snapshot.summary.sessionCount = snapshot.sessionDays.length;
		return snapshot;
	}
	async fold(entry, zone, signal) {
		const persistence = this.persistence;
		if (!persistence) throw new Error("usageUnavailable");
		const cached = this.cache.get(entry.header.id);
		if (cached && cached.revision === entry.revision && cached.zone === zone) return cached.fold;
		const handle = await persistence.open(entry.header.id, "read", { signal });
		let events;
		try {
			events = (await handle.read(handle.inheritedEventCount, Number.MAX_SAFE_INTEGER, { signal })).events;
		} finally {
			await handle.close().catch(() => void 0);
		}
		const fold = foldSession({
			createdAt: entry.header.createdAt,
			events
		}, dayKeyFormatter(zone));
		this.cache.delete(entry.header.id);
		this.cache.set(entry.header.id, {
			revision: entry.revision,
			zone,
			fold
		});
		return fold;
	}
	/** Drop cache rows for sessions that no longer exist, then enforce the bound. */
	prune(live) {
		for (const id of this.cache.keys()) if (!live.has(id)) this.cache.delete(id);
		while (this.cache.size > MAX_CACHED_SESSIONS) {
			const oldest = this.cache.keys().next().value;
			if (oldest === void 0) return;
			this.cache.delete(oldest);
		}
	}
};
/** Fall back to UTC for a missing or unknown zone rather than failing the page. */
function normalizeZone(timeZone) {
	if (typeof timeZone === "string" && timeZone.trim()) try {
		new Intl.DateTimeFormat("en-CA", { timeZone });
		return timeZone;
	} catch {}
	return "UTC";
}

// src/features/usage-stats/host.ts
var host_exports$1 = /* @__PURE__ */ __exportAll({
	createHost: () => createHost$1,
	methods: () => methods$1
});
function createHost$1(ctx, _config, _options) {
	const usage = new UsageService();
	ctx.inject(["sessionPersistence"], (child) => {
		usage.persistence = child.sessionPersistence ?? null;
		child.effect(() => () => {
			usage.persistence = null;
		});
	});
	return { usage };
}
const methods$1 = { readUsageStats(timeZone) {
	return this.run(() => this.usage.snapshot(timeZone));
} };

// src/features/usage-stats/rpc.ts
const usageSnapshotCodec = {
	mode: "strict",
	typeSymbol: "power-dsh#UsageSnapshot",
	create: () => ({ parse(value) {
		if (!isRecord$1(value) || typeof value.complete !== "boolean" || typeof value.generatedAt !== "number" || !Number.isFinite(value.generatedAt) || !hasStrings(value, [
			"timeZone",
			"firstDate",
			"lastDate"
		]) || !isRecord$1(value.summary) || !isArray(value.days) || !isArray(value.dailyModels) || !isArray(value.models)) throw new TypeError("Invalid usage snapshot");
		if (!isArray(value.sessionDays)) throw new TypeError("Invalid usage sessions");
		const sessionDays = value.sessionDays.map((dates) => {
			if (!isArray(dates) || !dates.every((date) => typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date))) throw new TypeError("Invalid usage sessions");
			return dates;
		});
		const summary = value.summary;
		const fields = [
			"totalTokens",
			"inputTokens",
			"outputTokens",
			"cacheReadTokens",
			"cacheWriteTokens",
			"peakDayTokens",
			"longestSessionMs",
			"currentStreakDays",
			"longestStreakDays",
			"activeDays",
			"sessionCount",
			"turnCount"
		];
		const counts = {};
		for (const field of fields) {
			const count = summary[field];
			if (typeof count !== "number" || !Number.isFinite(count) || count < 0) throw new TypeError("Invalid usage summary");
			counts[field] = count;
		}
		const dayFields = [
			"totalTokens",
			"turnCount",
			"toolCallCount",
			"inputTokens",
			"outputTokens",
			"cacheReadTokens",
			"cacheWriteTokens",
			"requestCount",
			"activeMs"
		];
		const days = value.days.map((row) => {
			if (!isRecord$1(row) || typeof row.date !== "string") throw new TypeError("Invalid usage day");
			const counts = {};
			for (const field of dayFields) {
				const count = row[field];
				if (typeof count !== "number" || !Number.isFinite(count) || count < 0) throw new TypeError("Invalid usage day");
				counts[field] = count;
			}
			return {
				date: row.date,
				totalTokens: counts.totalTokens,
				turnCount: counts.turnCount,
				toolCallCount: counts.toolCallCount,
				inputTokens: counts.inputTokens,
				outputTokens: counts.outputTokens,
				cacheReadTokens: counts.cacheReadTokens,
				cacheWriteTokens: counts.cacheWriteTokens,
				requestCount: counts.requestCount,
				activeMs: counts.activeMs
			};
		});
		const dailyModels = value.dailyModels.map((row) => {
			if (!isRecord$1(row) || !hasStrings(row, [
				"date",
				"modelId",
				"provider"
			]) || typeof row.totalTokens !== "number" || !Number.isFinite(row.totalTokens) || typeof row.requestCount !== "number" || !Number.isFinite(row.requestCount)) throw new TypeError("Invalid usage daily model");
			return {
				date: row.date,
				modelId: row.modelId,
				provider: row.provider,
				totalTokens: row.totalTokens,
				requestCount: row.requestCount
			};
		});
		const models = value.models.map((row) => {
			if (!isRecord$1(row) || !hasStrings(row, ["modelId", "provider"]) || typeof row.totalTokens !== "number" || !Number.isFinite(row.totalTokens) || typeof row.requestCount !== "number" || !Number.isFinite(row.requestCount)) throw new TypeError("Invalid usage model");
			return {
				modelId: row.modelId,
				provider: row.provider,
				totalTokens: row.totalTokens,
				requestCount: row.requestCount
			};
		});
		return {
			complete: value.complete,
			generatedAt: value.generatedAt,
			timeZone: value.timeZone,
			firstDate: value.firstDate,
			lastDate: value.lastDate,
			summary: counts,
			days,
			dailyModels,
			models,
			sessionDays
		};
	} })
};
const READ_USAGE_STATS_RPC = {
	id: "power-dsh#powerDsh/readUsageStats",
	service: "powerDsh",
	namespace: "powerDsh",
	method: "readUsageStats",
	invocation: { kind: "direct" },
	parameters: [{
		name: "timeZone",
		wire: "timeZone",
		source: "json",
		codec: stringCodec
	}],
	result: usageSnapshotCodec
};
const rpc$1 = [READ_USAGE_STATS_RPC];

// src/features/projects/definition.ts
const definition = Object.freeze({
	id: "projects",
	category: "enhance",
	order: 10,
	keys: Object.freeze(["projectManagerEnabled"]),
	spec: "src/features/projects/spec.md"
});

// src/features/projects/config.ts
var config_exports = /* @__PURE__ */ __exportAll({ configFields: () => configFields });
const configFields = { projectManagerEnabled: z.boolean().default(false).volatile() };

// src/features/projects/projects-catalog.ts
/**
* Fold the native Workspace baseline and the per-session activity into a plain
* projection. Registry order is preserved so `manual` sorting mirrors DSH.
*/
function buildProjectCatalog(baseline, activity) {
	return {
		complete: true,
		projects: baseline.items.map((item) => {
			let lastActiveAt = 0;
			for (const sessionId of item.sessionIds) {
				const entry = activity.get(sessionId);
				if (entry && entry.lastActiveAt > lastActiveAt) lastActiveAt = entry.lastActiveAt;
			}
			return {
				workspaceId: item.workspaceId,
				title: item.title,
				path: typeof item.path === "string" ? item.path : "",
				sessionCount: item.sessionIds.length,
				lastActiveAt
			};
		})
	};
}

// src/features/projects/projects-service.ts
/**
* Lists the native Workspace registrations with their session counts and latest
* activity, and removes one registration while keeping files and sessions.
* Holds no preferences and writes nothing else.
*/
var ProjectsService = class {
	workspaceController = null;
	sessionController = null;
	async list() {
		const controller = this.workspaceController;
		if (!controller) throw new Error("projectsUnavailable");
		const abort = new AbortController();
		try {
			const baseline = await readBaseline(controller, abort.signal);
			const activity = await this.activity(abort.signal);
			return buildProjectCatalog(baseline, activity);
		} finally {
			abort.abort();
		}
	}
	/**
	* Remove one Workspace registration. DSH keeps the directory and every
	* session log; sessions fall back to the ungrouped area and stay searchable.
	*/
	async remove(workspaceId) {
		const controller = this.workspaceController;
		if (!controller || typeof controller.delete !== "function") throw new Error("projectsUnavailable");
		if (!validWorkspaceId(workspaceId)) throw new Error("projectsInvalidWorkspace");
		if (!(await this.list()).projects.some((row) => row.workspaceId === workspaceId)) throw new Error("projectsNotFound");
		await controller.delete({ workspaceId });
		return this.list();
	}
	/** Latest activity per session, taken from the same list the sidebar dates rows with. */
	async activity(signal) {
		const activity = /* @__PURE__ */ new Map();
		const controller = this.sessionController;
		if (!controller || typeof controller.list !== "function") return activity;
		const { items } = await controller.list({}, signal).catch(() => ({ items: [] }));
		for (const item of items) {
			if (typeof item?.sessionId !== "string" || typeof item.updatedAt !== "number" || !Number.isFinite(item.updatedAt)) continue;
			activity.set(item.sessionId, { lastActiveAt: item.updatedAt });
		}
		return activity;
	}
};
function validWorkspaceId(workspaceId) {
	return typeof workspaceId === "string" && workspaceId.length > 0 && workspaceId.length <= 1024;
}
/** Resolve the first complete Workspace baseline and stop the stream. */
async function readBaseline(controller, signal) {
	for await (const frame of controller.follow(signal)) if ((frame.type === "baseline" || frame.type === "replace") && frame.value) return frame.value;
	throw new Error("projectsUnavailable");
}

// src/features/projects/host.ts
var host_exports = /* @__PURE__ */ __exportAll({
	createHost: () => createHost,
	methods: () => methods
});
function createHost(ctx, _config, _options) {
	const projects = new ProjectsService();
	ctx.inject(["workspaceController", "sessionController"], (child) => {
		projects.workspaceController = child.workspaceController ?? null;
		projects.sessionController = child.sessionController ?? null;
		child.effect(() => () => {
			projects.workspaceController = null;
			projects.sessionController = null;
		});
	});
	return { projects };
}
const methods = {
	listProjects() {
		return this.run(() => this.projects.list());
	},
	removeProject(workspaceId) {
		return this.run(() => this.projects.remove(workspaceId));
	}
};

// src/features/projects/rpc.ts
const projectCatalogCodec = {
	mode: "strict",
	typeSymbol: "power-dsh#ProjectCatalog",
	create: () => ({ parse(value) {
		if (!isRecord$1(value) || typeof value.complete !== "boolean" || !isArray(value.projects)) throw new TypeError("Invalid project catalog");
		const projects = value.projects.map((row) => {
			if (!isRecord$1(row) || !hasStrings(row, [
				"workspaceId",
				"title",
				"path"
			]) || typeof row.sessionCount !== "number" || !Number.isFinite(row.sessionCount) || typeof row.lastActiveAt !== "number" || !Number.isFinite(row.lastActiveAt)) throw new TypeError("Invalid project row");
			return {
				workspaceId: row.workspaceId,
				title: row.title,
				path: row.path,
				sessionCount: row.sessionCount,
				lastActiveAt: row.lastActiveAt
			};
		});
		return {
			complete: value.complete,
			projects
		};
	} })
};
function projectRpc(method, fields) {
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
		result: projectCatalogCodec
	};
}
const LIST_PROJECTS_RPC = projectRpc("listProjects", []);
const REMOVE_PROJECT_RPC = projectRpc("removeProject", ["workspaceId"]);
const rpc = [LIST_PROJECTS_RPC, REMOVE_PROJECT_RPC];

// src/app/host-features.ts
const HOST_FEATURES = Object.freeze([
	{
		definition: definition$20,
		...config_exports$20
	},
	{
		definition: definition$19,
		...config_exports$19
	},
	{
		definition: definition$18,
		...config_exports$18
	},
	{
		definition: definition$17,
		...config_exports$17,
		...host_exports$14,
		rpc: rpc$14
	},
	{
		definition: definition$16,
		...config_exports$16,
		...host_exports$13,
		rpc: rpc$13
	},
	{
		definition: definition$15,
		...config_exports$15,
		...host_exports$12,
		rpc: rpc$12
	},
	{
		definition: definition$14,
		...config_exports$14,
		...host_exports$11,
		rpc: rpc$11
	},
	{
		definition: definition$13,
		...config_exports$13,
		...host_exports$10,
		rpc: rpc$10
	},
	{
		definition: definition$12,
		...config_exports$12,
		...host_exports$9,
		rpc: rpc$9
	},
	{
		definition: definition$11,
		...config_exports$11,
		...host_exports$8,
		rpc: rpc$8
	},
	{
		definition: definition$10,
		...config_exports$10,
		...host_exports$7,
		rpc: rpc$7
	},
	{
		definition: definition$9,
		...config_exports$9,
		...host_exports$6,
		rpc: rpc$6
	},
	{
		definition: definition$8,
		...config_exports$8,
		...host_exports$5,
		rpc: rpc$5
	},
	{
		definition: definition$7,
		...config_exports$7,
		...host_exports$4,
		rpc: rpc$4
	},
	{
		definition: definition$6,
		...config_exports$6
	},
	{
		definition: definition$5,
		...config_exports$5
	},
	{
		definition: definition$4,
		...config_exports$4
	},
	{
		definition: definition$3,
		...config_exports$3,
		...host_exports$3,
		rpc: rpc$3
	},
	{
		definition: definition$2,
		...config_exports$2,
		...host_exports$2,
		rpc: rpc$2
	},
	{
		definition: definition$1,
		...config_exports$1,
		...host_exports$1,
		rpc: rpc$1
	},
	{
		definition,
		...config_exports,
		...host_exports,
		rpc
	}
]);

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
	READ_SKILL_RPC,
	SET_SKILL_ENABLED_RPC,
	LIST_MCP_SERVERS_RPC,
	READ_MCP_SERVER_RPC,
	SET_MCP_SERVER_ENABLED_RPC,
	LIST_ARCHIVED_SESSIONS_RPC,
	RESTORE_ARCHIVED_SESSION_RPC,
	DELETE_ARCHIVED_SESSION_RPC,
	READ_WALLPAPER_RPC,
	SAVE_WALLPAPER_RPC,
	CLEAR_WALLPAPER_RPC,
	READ_USAGE_STATS_RPC,
	LIST_PROJECTS_RPC,
	REMOVE_PROJECT_RPC
]);

// src/app/settings-tool.ts
function mergeFields(target, fields, label) {
	for (const [key, value] of Object.entries(fields ?? {})) {
		if (Object.hasOwn(target, key)) throw new Error(`Duplicate settings tool ${label}: ${key}`);
		target[key] = value;
	}
}
function createSettingsTool(ctx, config, namespace, service, features) {
	const contributions = features.flatMap((feature) => feature.settingsTool ? [feature.settingsTool] : []);
	const parameters = {};
	const properties = {};
	for (const contribution of contributions) {
		mergeFields(parameters, contribution.parameters, "parameter");
		mergeFields(properties, contribution.output, "output");
	}
	const mutations = contributions.flatMap((contribution) => contribution.mutations ?? []).sort((a, b) => a.order - b.order);
	const reads = contributions.flatMap((contribution) => contribution.reads ?? []).sort((a, b) => a.order - b.order);
	for (const { field, method } of mutations) if (!Object.hasOwn(parameters, field) || method && typeof service[method] !== "function") throw new Error(`Invalid settings tool mutation: ${field}`);
	return defineTool({
		name: "power_dsh_settings",
		description: "Read or change Mod preferences and report the DSH version.",
		parameters,
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties
			},
			render: (_args, value) => [{
				type: "text",
				text: JSON.stringify(value)
			}]
		},
		async execute(args, exec) {
			exec.signal.throwIfAborted();
			for (const { field, method } of mutations) {
				if (args[field] === void 0) continue;
				if (method) await service[method](args[field]);
				else await ctx.settings.mutate(namespace, [{
					op: "set",
					path: [field],
					value: args[field]
				}]);
			}
			const result = {};
			for (const { read } of reads) {
				const value = read({
					ctx,
					config,
					service
				});
				Object.assign(result, value instanceof Promise ? await value : value);
			}
			return result;
		}
	});
}

// src/app/config.ts
function composeConfig(features) {
	const ids = /* @__PURE__ */ new Set();
	const fields = {};
	for (const { definition, configFields } of features) {
		if (ids.has(definition.id)) throw new Error(`Duplicate Host feature: ${definition.id}`);
		ids.add(definition.id);
		const keys = Object.keys(configFields);
		if (keys.length !== definition.keys.length || keys.some((key) => !definition.keys.includes(key))) throw new Error(`Configuration keys do not match feature: ${definition.id}`);
		for (const [key, schema] of Object.entries(configFields)) {
			if (Object.hasOwn(fields, key)) throw new Error(`Duplicate configuration key: ${key}`);
			fields[key] = schema;
		}
	}
	return z.object(fields);
}
const Config = composeConfig(HOST_FEATURES);

// src/app/host.ts
const inject = [
	"settings",
	"tools",
	"clientModules",
	"pluginManager",
	"typert",
	"configEditor",
	"profileContext"
];
var ModService = class extends NativeRemoteService {
	queue;
	constructor(ctx, queue, features) {
		super(ctx, "powerDsh");
		this.queue = queue;
		for (const feature of features) for (const [method, handler] of Object.entries(feature.methods ?? {})) {
			if (method in this) throw new Error(`Duplicate Host method: ${method}`);
			Reflect.set(this, method, handler);
		}
	}
	run(operation) {
		if (this.ctx.invocation && this.ctx.invocation.peer.principal.kind !== "owner") throw new Error("Only the profile owner can change Mod policies.");
		return this.queue.run(operation);
	}
};
function apply$1(ctx, config, features = HOST_FEATURES) {
	const featureIds = /* @__PURE__ */ new Set();
	const selectedRpc = /* @__PURE__ */ new Set();
	for (const feature of features) {
		const { id } = feature.definition;
		if (featureIds.has(id)) throw new Error(`Duplicate Host feature: ${id}`);
		featureIds.add(id);
		for (const descriptor of feature.rpc ?? []) {
			if (selectedRpc.has(descriptor.id)) throw new Error(`Duplicate Host RPC: ${descriptor.id}`);
			selectedRpc.add(descriptor.id);
		}
	}
	for (const feature of features) for (const descriptor of feature.rpc ?? []) {
		if (!MOD_RPC.some((registered) => registered === descriptor)) throw new Error(`Unregistered Host RPC: ${descriptor.id}`);
		if (typeof (feature.methods && Reflect.get(feature.methods, descriptor.method)) !== "function") throw new Error(`Missing Host RPC method: ${descriptor.method}`);
	}
	const namespace = ctx.fiber.entry?.options.id;
	if (!namespace) throw new Error("Mod preferences require a managed plugin entry.");
	const queue = new OperationQueue();
	ctx.effect(() => () => queue.close());
	const service = new ModService(ctx, queue, features);
	const options = {
		owner: ctx,
		ensureActive: () => queue.ensureActive()
	};
	for (const feature of features) if (feature.createHost) ctx.inject([], (child) => {
		const state = feature.createHost(child, config, options);
		for (const [key, value] of Object.entries(state)) {
			if (key in service) throw new Error(`Duplicate Host state: ${key}`);
			Reflect.set(service, key, value);
		}
	});
	ctx.effect(() => ctx.typert.register({
		package: "power-dsh",
		face: "host",
		schemas: [],
		model: {
			services: [],
			events: [],
			objects: []
		},
		invocations: MOD_RPC.filter((rpc) => selectedRpc.has(rpc.id))
	}));
	ctx.effect(() => ctx.settings.configure({ auto: false }));
	ctx.effect(() => ctx.tools.register(createSettingsTool(ctx, config, namespace, service, features)));
}

// src/index.ts
function apply(ctx, config, features = void 0) {
	apply$1(ctx, config, features);
}

export { Config, apply, inject };