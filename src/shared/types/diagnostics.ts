/** Bound and redact the small text fields admitted to user-visible diagnostics. */
export function sanitizeDiagnosticText(text: string): string {
  return text.slice(0, 4096)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/\b(?:authorization|proxy-authorization|cookie|set-cookie)\s*[:=][^\r\n]*/gi, '[redacted]')
    .replace(/\b(?:bearer|basic)\s+[^\s,;]+/gi, '[redacted]')
    .replace(/\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|password|passwd|credential)\b\s*["']?\s*[:=][^\r\n]*/gi, '[redacted]')
    .replace(/\b(?:https?|file|wss?):\/\/[^\s<>"']+/gi, '[url]')
    .replace(/(?:[A-Za-z]:[\\/]|\\\\)[^\s<>"']+/g, '[path]')
    .replace(/\/(?:[^\s/<>"']+\/)+[^\s<>"']*/g, '[path]')
    .slice(0, 2048);
}

export interface ErrorDiagnostic {
  code: string;
  operation: string;
  message: string;
  observedAt: string;
  version?: string;
}

/** Build copyable diagnostic text only from selected fields, never arbitrary error data. */
export function diagnosticReport(info: ErrorDiagnostic): string {
  return [
    'PowerDSH', `Code: ${sanitizeDiagnosticText(info.code)}`,
    `Operation: ${sanitizeDiagnosticText(info.operation)}`,
    `Message: ${sanitizeDiagnosticText(info.message)}`,
    `Observed: ${sanitizeDiagnosticText(info.observedAt)}`,
    ...(info.version ? [`DSH: ${sanitizeDiagnosticText(info.version)}`] : []),
  ].join('\n');
}
