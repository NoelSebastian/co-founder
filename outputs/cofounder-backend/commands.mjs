// Only an explicit build command can dispatch an approved PRD.
export function isBuildCommand(content) {
  if (typeof content !== 'string') return false;
  const command=content.trim().replace(/^@Lovable\s*[, :]?\s*/i,'');
  return /^build(?:\s+(?:the\s+)?approved\s+PRD)?[.!]?$/i.test(command);
}
