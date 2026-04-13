'use strict';

const Diff = require('diff');

function unifiedDiff({ filePath, beforeText, afterText }) {
  return Diff.createTwoFilesPatch(filePath, filePath, beforeText, afterText, 'before', 'after', {
    context: 3,
  });
}

module.exports = { unifiedDiff };

