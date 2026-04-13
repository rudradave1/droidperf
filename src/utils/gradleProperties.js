'use strict';

function parseGradleProperties(text) {
  const lines = text.split(/\r?\n/);
  const entries = [];
  const indexByKey = new Map();

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) {
      entries.push({ type: 'other', raw });
      continue;
    }

    const m = raw.match(/^(\s*)([^=:#\s]+)(\s*)([=:])(\s*)(.*)$/);
    if (!m) {
      entries.push({ type: 'other', raw });
      continue;
    }

    const leading = m[1];
    const key = m[2];
    const preSepWs = m[3];
    const sepChar = m[4];
    const postSepWs = m[5];
    const valueAndMaybeComment = m[6];

    // Best-effort inline comment preservation: split on first " #" (common style)
    // If a project relies on '#' inside the value, this may be imperfect; we prefer safety (minimal change).
    let value = valueAndMaybeComment;
    let trailing = '';
    const commentIdx = valueAndMaybeComment.search(/\s+#/);
    if (commentIdx >= 0) {
      value = valueAndMaybeComment.slice(0, commentIdx);
      trailing = valueAndMaybeComment.slice(commentIdx);
    }
    value = value.trim();

    const entry = {
      type: 'prop',
      key,
      value,
      leading,
      preSepWs,
      sepChar,
      postSepWs,
      trailing,
    };
    entries.push(entry);
    indexByKey.set(key, entries.length - 1);
  }

  return { entries, indexByKey, originalText: text };
}

function getProp(parsed, key) {
  const idx = parsed.indexByKey.get(key);
  if (idx == null) return null;
  const ent = parsed.entries[idx];
  if (!ent || ent.type !== 'prop') return null;
  return ent.value;
}

function setProp(parsed, key, value) {
  const idx = parsed.indexByKey.get(key);
  if (idx == null) {
    parsed.entries.push({
      type: 'prop',
      key,
      value,
      leading: '',
      preSepWs: '',
      sepChar: '=',
      postSepWs: '',
      trailing: '',
    });
    parsed.indexByKey.set(key, parsed.entries.length - 1);
    return;
  }
  const ent = parsed.entries[idx];
  if (ent.type !== 'prop') return;
  ent.value = value;
}

function stringifyGradleProperties(parsed) {
  return (
    parsed.entries
      .map((e) => {
        if (e.type === 'prop')
          return `${e.leading || ''}${e.key}${e.preSepWs || ''}${e.sepChar || '='}${e.postSepWs || ''}${e.value}${e.trailing || ''}`;
        return e.raw ?? '';
      })
      .join('\n') + '\n'
  );
}

module.exports = {
  parseGradleProperties,
  getProp,
  setProp,
  stringifyGradleProperties,
};

