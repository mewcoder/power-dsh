import { realpath, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { SkillImportMode } from '../../shared/types/wire.ts';
import type { DiscoveredSkill } from './skill-import.ts';
import { installPreparedSkill, installSkillLink, pathExists, pathIdentity, prepareSkillPackage, readSkillPackage, skillRevision } from './skill-content.ts';

export async function addDiscoveredSkill(targetRoot: string, skill: DiscoveredSkill, mode: SkillImportMode, revision: string, active: () => void) {
  active();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skill.name) || (mode !== 'copy' && mode !== 'link')) throw new Error('skill-operation-invalid');
  if (await pathExists(join(targetRoot, skill.name)) || await pathExists(join(targetRoot, `${skill.name}.md`))) throw new Error('skill-name-conflict');
  if (await realpath(skill.path) !== skill.realPath) throw new Error('skill-source-changed');
  const snapshot = await readSkillPackage(skill.realPath, skill.flat);
  if (!revision || snapshot.revision !== revision) throw new Error('skill-source-changed');
  const target = join(targetRoot, skill.flat ? `${skill.name}.md` : skill.name);
  const staged = mode === 'copy' ? await prepareSkillPackage(snapshot, targetRoot, active) : null;
  let identity = '';
  try {
    active();
    if (await skillRevision(skill.realPath, skill.flat) !== revision || await realpath(skill.path) !== skill.realPath) throw new Error('skill-source-changed');
    if (mode === 'copy') await installPreparedSkill(staged!.path, target, skill.flat, active);
    else await installSkillLink(skill.realPath, target, skill.flat, active);
    identity = await pathIdentity(target);
    active();
    if (await skillRevision(target, skill.flat) !== snapshot.revision) throw new Error('skill-copy-verification-failed');
    active();
  } catch (error) {
    if (identity && await pathIdentity(target).catch(() => '') === identity
      && await skillRevision(target, skill.flat).catch(() => '') === snapshot.revision) await rm(target, { recursive: true, force: true });
    throw error;
  } finally { await staged?.close(); }
}
