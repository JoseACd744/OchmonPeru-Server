const fs = require('fs');
const path = require('path');

const systemPrompt = fs.readFileSync(
  path.join(__dirname, 'prompt_ochmon_v2.txt'),
  'utf-8'
);

module.exports = systemPrompt;
