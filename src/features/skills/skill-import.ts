import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import type { ExternalSkillEntry, SkillOccurrence, SkillVariant } from '../../shared/types/wire.ts';
import { readSkillPackage, skillIdentity, pathExists, prepareSkillPackage, installPreparedSkill, type SkillReadBudget } from './skill-content.ts';

const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Cap on one scan, so a runaway home directory cannot stall the settings page. */
const MAX_SCAN_ENTRIES = 400;

/** One agent whose skill directories this feature can read. */
export interface SkillSourceSpec {
  id: string;
  label: string;
  /** User-scope path segments below home, e.g. `['.claude', 'skills']`. */
  user?: readonly string[];
  /** Environment variable that relocates this tool's home directory. */
  env?: string;
  /** Project-scope path segments below the project root. */
  project?: readonly string[];
}

/**
 * Known agent skill directories.
 *
 * Each tool keeps Agent Skills bundles (`<name>/SKILL.md`) under a
 * tool-specific home directory; a few also keep a project-scope directory.
 * Only the entries listed here are read, and a missing directory is treated as
 * empty rather than as a failure.
 */
export const SKILL_SOURCES: readonly SkillSourceSpec[] = [
  { id: 'claude-code', label: 'Claude Code', user: ['.claude', 'skills'], env: 'CLAUDE_CONFIG_DIR', project: ['.claude', 'skills'] },
  { id: 'codex', label: 'Codex', user: ['.codex', 'skills'], env: 'CODEX_HOME', project: ['.codex', 'skills'] },
  { id: 'cursor', label: 'Cursor', user: ['.cursor', 'skills'], project: ['.cursor', 'skills'] },
  { id: 'gemini', label: 'Gemini', user: ['.gemini', 'antigravity', 'skills'], project: ['.gemini', 'skills'] },
  { id: 'gemini-cli', label: 'Gemini CLI', user: ['.gemini', 'skills'] },
  { id: 'opencode', label: 'OpenCode', user: ['.config', 'opencode', 'skills'], project: ['.opencode', 'skills'] },
  { id: 'copilot', label: 'Copilot', user: ['.copilot', 'skills'], project: ['.github', 'skills'] },
  { id: 'windsurf', label: 'Windsurf', user: ['.codeium', 'windsurf', 'skills'], project: ['.windsurf', 'skills'] },
  { id: 'windsurf-legacy', label: 'Windsurf (legacy)', user: ['.windsurf', 'skills'] },
  { id: 'trae', label: 'Trae', user: ['.trae', 'skills'], project: ['.trae', 'skills'] },
  { id: 'trae-cn', label: 'Trae CN', user: ['.trae-cn', 'skills'], project: ['.trae-cn', 'skills'] },
  { id: 'roo', label: 'Roo Code', user: ['.roo', 'skills'], project: ['.roo', 'skills'] },
  { id: 'codebuddy', label: 'CodeBuddy', user: ['.codebuddy', 'skills'], project: ['.codebuddy', 'skills'] },
  { id: 'workbuddy', label: 'WorkBuddy', user: ['.workbuddy', 'skills'], project: ['.workbuddy', 'skills'] },
  { id: 'qoder', label: 'Qoder', user: ['.qoder', 'skills'], project: ['.qoder', 'skills'] },
  { id: 'qoder-cn', label: 'Qoder CN', user: ['.qoder-cn', 'skills'] },
  { id: 'lingma', label: 'Lingma', user: ['.lingma', 'skills'] },
  { id: 'openclaw', label: 'OpenClaw', user: ['.openclaw', 'skills'] },
  { id: 'clawdbot', label: 'Clawdbot', user: ['.clawdbot', 'skills'] },
  { id: 'cc-switch', label: 'CC Switch', user: ['.cc-switch', 'skills'] },
  { id: 'agents', label: 'Shared directory', user: ['.agents', 'skills'], env: 'DSH_AGENTS_HOME', project: ['.agents', 'skills'] },
];

/** One directory to scan, already resolved against a home and a project. */
export interface SkillRoot {
  source: string;
  label: string;
  path: string;
  scope: 'user' | 'project';
}

export interface DiscoveredSkill {
  id: string;
  name: string;
  description: string;
  source: string;
  path: string;
  flat: boolean;
  realPath: string;
}

/** Read the environment without depending on a Node global type in the browser build. */
function environment(): Record<string, string | undefined> {
  return typeof process === 'undefined' ? {} : process.env;
}

/**
 * Resolve every configured root against the current home and project.
 *
 * `home` is the operating-system user home (`~`), never the DSH data home:
 * another tool's skills live in `~/.claude/skills`, not `$DSH_HOME/.claude`.
 */
export function resolveSkillRoots(
  home = homedir(),
  projectRoot = '',
  env: Record<string, string | undefined> = environment(),
): SkillRoot[] {
  const roots: SkillRoot[] = [];
  for (const spec of SKILL_SOURCES) {
    if (spec.user) {
      // An environment override names the tool's own home, which replaces the
      // `~/.<tool>` segment; the rest of the configured path still applies.
      const override = spec.env ? env[spec.env]?.trim() : '';
      const segments = override ? spec.user.slice(1) : spec.user;
      const base = override || home;
      roots.push({ source: spec.id, label: spec.label, scope: 'user', path: join(base, ...segments) });
    }
    if (spec.project && projectRoot) {
      roots.push({
        source: spec.id, label: spec.label, scope: 'project',
        path: join(projectRoot, ...spec.project),
      });
    }
  }
  return roots;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && ((trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'")))) return trimmed.slice(1, -1);
  return trimmed;
}

/** Read the small frontmatter subset needed to list a skill. */
export function parseSkillFrontmatter(text: string): { name: string; description: string } | null {
  if (!text.startsWith('---')) return null;
  const end = text.indexOf('\n---', 3);
  if (end < 0) return null;
  const lines = text.slice(3, end).replaceAll('\r\n', '\n').split('\n');
  const values = new Map<string, string>();
  let key = '';
  let block: string[] | null = null;
  const flush = () => {
    if (key && block) values.set(key, block.join(' ').trim());
    key = '';
    block = null;
  };
  for (const line of lines) {
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (match) {
      flush();
      const [, name, raw] = match;
      if (raw === '>' || raw === '|') { key = name; block = []; }
      else values.set(name, raw.trim());
      continue;
    }
    if (key && /^\s+/.test(line)) block?.push(line.trim());
  }
  flush();
  const name = unquote(values.get('name') ?? '');
  const description = unquote(values.get('description') ?? '');
  if (!SKILL_NAME.test(name) || !description) return null;
  return { name, description };
}

async function readSkill(file: string): Promise<{ name: string; description: string } | null> {
  try {
    if ((await stat(file)).size > 1024 * 1024) return null;
    return parseSkillFrontmatter(await readFile(file, 'utf8'));
  }
  catch { return null; }
}

async function realPathOf(path: string): Promise<string> {
  try { return await realpath(path); }
  catch { return path; }
}

/**
 * Resolve one root entry through any link it may be.
 *
 * Another tool may serve a skill through a link (that is how most Codex skills
 * are stored); the entry is still one skill, so the scan follows it and records
 * the real path, which is also the identity used to collapse duplicates.
 */
async function entryKind(path: string): Promise<'directory' | 'file' | undefined> {
  try {
    const info = await stat(path);
    if (info.isDirectory()) return 'directory';
    if (info.isFile()) return 'file';
    return undefined;
  } catch { return undefined; }
}

export async function discoverSkillRoot(root: SkillRoot): Promise<DiscoveredSkill[]> {
  let entries;
  try { entries = await readdir(root.path, { withFileTypes: true }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw new Error('skill-scan-failed');
  }
  if (entries.length > 4096) throw new Error('skill-scan-limit');
  const result: DiscoveredSkill[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const path = join(root.path, entry.name);
    const kind = await entryKind(path);
    if (kind === 'directory') {
      const parsed = await readSkill(join(path, 'SKILL.md'));
      if (!parsed) continue;
      const realPath = await realPathOf(path);
      result.push({ id: skillIdentity('candidate', realPath), ...parsed, source: root.source,
        path, flat: false, realPath });
    } else if (kind === 'file' && entry.name.endsWith('.md') && entry.name.toLowerCase() !== 'skill.md') {
      const parsed = await readSkill(path);
      if (!parsed || parsed.name !== entry.name.slice(0, -3)) continue;
      const realPath = await realPathOf(path);
      result.push({ id: skillIdentity('candidate', realPath), ...parsed, source: root.source,
        path, flat: true, realPath });
    }
  }
  return result;
}

export async function discoverExternal(
  roots: readonly SkillRoot[],
  targetRoot: string,
  existingNames: ReadonlySet<string>,
  existingPaths: ReadonlyMap<string, string> = new Map(),
  inheritedNames: ReadonlySet<string> = new Set(),
): Promise<ExternalSkillEntry[]> {
  const found: DiscoveredSkill[] = [];
  for (const root of roots) found.push(...await discoverSkillRoot(root));
  if (found.length > MAX_SCAN_ENTRIES) throw new Error('skill-scan-limit');
  const labels = new Map(SKILL_SOURCES.map(spec => [spec.id, spec.label]));
  const candidates = new Map<string, { skill: DiscoveredSkill; sources: SkillOccurrence[] }>();
  for (const skill of found) {
    const occurrence = { agent: labels.get(skill.source) ?? roots.find(root => root.source === skill.source)?.label ?? skill.source,
      path: skill.path, realPath: skill.realPath, linked: resolve(skill.path) !== resolve(skill.realPath) };
    const previous = candidates.get(skill.realPath);
    if (previous) {
      if (!previous.sources.some(source => source.agent === occurrence.agent && source.path === occurrence.path)) previous.sources.push(occurrence);
    } else candidates.set(skill.realPath, { skill, sources: [occurrence] });
  }
  const groups = new Map<string, SkillVariant[]>();
  const budget: SkillReadBudget = { files: 0, bytes: 0 };
  for (const { skill, sources } of candidates.values()) {
    let revision = '';
    try { revision = (await readSkillPackage(skill.realPath, skill.flat, budget)).revision; } catch {}
    const variants = groups.get(skill.name) ?? [];
    variants.push({ id: skill.id, description: skill.description, path: skill.path, flat: skill.flat, revision, sources });
    groups.set(skill.name, variants);
  }
  const result: ExternalSkillEntry[] = [];
  for (const [name, variants] of groups) {
    const first = variants[0]!;
    const occupied = await pathExists(join(targetRoot, name)) || await pathExists(join(targetRoot, `${name}.md`));
    const available = existingNames.has(name);
    let conflict = available || occupied;
    if (available) {
      const installedPath = existingPaths.get(name);
      if (installedPath) {
        try {
          const installed = await packageLocation(installedPath);
          const revision = (await readSkillPackage(installed.path, installed.flat, budget)).revision;
          if (variants.every(variant => variant.revision === revision)) conflict = false;
        } catch {}
      }
    }
    const known = variants.every(variant => variant.revision !== '');
    const comparison = !known ? 'unknown' : new Set(variants.map(variant => variant.revision)).size > 1 ? 'different' : 'same';
    result.push({
      id: skillIdentity('group', name), name, description: first.description,
      source: first.sources[0]!.agent, path: first.path, flat: first.flat,
      variants, sources: variants.flatMap(variant => variant.sources), comparison, available, conflict, inherited: inheritedNames.has(name),
    });
  }
  return result.sort((first, second) => first.name.localeCompare(second.name));
}

export async function packageLocation(path: string) {
  const location = basename(path).toLowerCase() === 'skill.md' ? dirname(path) : path;
  const info = await stat(location);
  return { path: location, flat: info.isFile() };
}

/** Copy one discovered skill into the DSH skills root without overwriting an existing name. */
export async function importDiscoveredSkill(skill: DiscoveredSkill, targetRoot: string): Promise<void> {
  const target = join(targetRoot, skill.flat ? `${skill.name}.md` : skill.name);
  if (await pathExists(join(targetRoot, skill.name)) || await pathExists(join(targetRoot, `${skill.name}.md`))) throw new Error('A skill with this name already exists.');
  const snapshot = await readSkillPackage(skill.realPath, skill.flat);
  const staged = await prepareSkillPackage(snapshot, targetRoot, () => {});
  try { await installPreparedSkill(staged.path, target, skill.flat, () => {}); }
  finally { await staged.close(); }
}

/** Read one discovered skill's frontmatter and Markdown body for the detail dialog. */
export async function readDiscoveredSkill(skill: DiscoveredSkill): Promise<{ name: string; description: string; content: string; path: string }> {
  const file = skill.flat ? skill.path : join(skill.path, 'SKILL.md');
  if ((await stat(file)).size > 1024 * 1024) throw new Error('skill-content-limit');
  const text = await readFile(file, 'utf8');
  const parsed = parseSkillFrontmatter(text);
  if (!parsed) throw new Error('This skill has no readable frontmatter.');
  return { name: parsed.name, description: parsed.description, content: skillBody(text), path: skill.path };
}

/** Strip the frontmatter block, leaving the instruction body a reader expects. */
function skillBody(text: string): string {
  if (!text.startsWith('---')) return text.trim();
  const end = text.indexOf('\n---', 3);
  if (end < 0) return text.trim();
  const after = text.indexOf('\n', end + 1);
  return (after < 0 ? '' : text.slice(after + 1)).trim();
}

/** Find a discovered skill by the id a client selected. */
export async function resolveSelection(
  roots: readonly SkillRoot[],
  ids: readonly string[],
): Promise<DiscoveredSkill[]> {
  const wanted = new Set(ids);
  const found = new Map<string, DiscoveredSkill>();
  for (const root of roots) {
    for (const skill of await discoverSkillRoot(root)) {
      if (wanted.has(skill.id) || wanted.has(`${skill.source}:${skill.name}:${skill.flat ? 'file' : 'dir'}`)) found.set(skill.realPath, skill);
    }
  }
  return [...found.values()];
}

export function isSkillImportPathInside(root: string, candidate: string): boolean {
  const base = resolve(root);
  const target = resolve(candidate);
  return target === base || target.startsWith(`${base}/`);
}
