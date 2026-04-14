'use strict';

const Diff = require('diff');

function unifiedDiff({ filePath, beforeText, afterText, context = 3 }) {
  return Diff.createTwoFilesPatch(filePath, filePath, beforeText, afterText, 'before', 'after', {
    context,
  });
}

module.exports = { unifiedDiff };
