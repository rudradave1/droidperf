'use strict';

function parseTokens(jvmargs) {
  return String(jvmargs || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function patchGradleJvmargs(current, { xmxMb, ensureFileEncodingUtf8 }) {
  const tokens = parseTokens(current);

  const wantedXmx = `-Xmx${xmxMb}m`;
  let hasXmx = false;
  let hasEncoding = false;

  const out = [];
  for (const t of tokens) {
    if (/^-Xmx\d+[kKmMgG]$/.test(t)) {
      out.push(wantedXmx);
      hasXmx = true;
      continue;
    }
    if (t === '-Dfile.encoding=UTF-8') {
      out.push(t);
      hasEncoding = true;
      continue;
    }
    out.push(t);
  }

  if (!hasXmx) out.unshift(wantedXmx);
  if (ensureFileEncodingUtf8 && !hasEncoding) out.push('-Dfile.encoding=UTF-8');

  return out.join(' ').trim();
}

module.exports = { patchGradleJvmargs };

