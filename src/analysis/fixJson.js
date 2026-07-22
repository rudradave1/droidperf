'use strict';

function extractFixJson(text) {
  if (!text) return null;
  const marker = 'FIX_JSON';
  const lastMarkerIndex = text.lastIndexOf(marker);
  if (lastMarkerIndex === -1) return null;

  const afterMarker = text.slice(lastMarkerIndex + marker.length);

  const codeFenceMatch = afterMarker.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const rawJson = codeFenceMatch ? codeFenceMatch[1] : afterMarker;

  const firstBraceIndex = rawJson.indexOf('{');
  if (firstBraceIndex === -1) return null;

  let candidate = rawJson.slice(firstBraceIndex);
  let open = 0;
  let inString = false;
  let escape = false;
  let endIndex = -1;

  for (let i = 0; i < candidate.length; i += 1) {
    const char = candidate[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === '{') open += 1;
    if (char === '}') {
      open -= 1;
      if (open === 0) {
        endIndex = i + 1;
        break;
      }
    }
  }

  if (endIndex === -1) return null;

  candidate = candidate.slice(0, endIndex);
  try {
    return JSON.parse(candidate);
  } catch (error) {
    return null;
  }
}

module.exports = { extractFixJson };
