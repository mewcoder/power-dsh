/** Preserve argument order and ordinary values while masking recognized credential fields. */
export function redactMcpArgs(args: readonly string[]): string[] {
  let hideNext = false;
  return args.map(argument => {
    if (hideNext) { hideNext = false; return REDACTED; }
    // --api-key VALUE and --api-key=VALUE, including camelCase and environment names.
    const assignment = argument.match(/^([^=\s]+)=(.*)$/s);
    if (assignment && sensitive(assignment[1]!)) return `${assignment[1]}=${REDACTED}`;
    if (/^-/.test(argument) && sensitive(argument)) { hideNext = true; return argument; }
    // Header and environment arguments can carry their own name/value pair.
    const prefix = assignment ? `${assignment[1]}=` : '';
    const value = assignment ? assignment[2]! : argument;
    const pair = value.match(/^(.*?\b([\w-]+)\s*[:=]\s*)(.+)$/s);
    if (pair && sensitive(pair[2]!)) return `${prefix}${pair[1]}${REDACTED}`;
    return prefix + value.replace(/https?:\/\/[^\s"']+/gi, address => {
      try {
        const url = new URL(address);
        let changed = false;
        if (url.username || url.password) {
          url.username = REDACTED;
          url.password = '';
          changed = true;
        }
        for (const key of new Set(url.searchParams.keys())) {
          if (sensitive(key)) { url.searchParams.set(key, REDACTED); changed = true; }
        }
        if (url.hash && sensitive(url.hash.slice(1).split('=')[0]!)) {
          url.hash = `${url.hash.slice(1).split('=')[0]}=${REDACTED}`;
          changed = true;
        }
        return changed ? url.href.replaceAll('%5BREDACTED%5D', REDACTED) : address;
      } catch {
        // Malformed credential URLs have no reliable field boundary.
        return REDACTED;
      }
    });
  });
}

const REDACTED = '[REDACTED]';
function sensitive(name: string): boolean {
  const field = name.replace(/([a-z])([A-Z])/g, '$1_$2');
  return /(?:^|[-_])(?:key|api[-_]?key|access[-_]?key|token|password|passwd|secret|authorization|credential|cookie)$/i.test(field);
}
