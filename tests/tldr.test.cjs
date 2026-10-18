const {test} = require('node:test');
const assert = require('node:assert/strict');
test('tldr retains all examples in source order beyond the former six-example limit', async () => {
  const {parseTldr} = await import('../src/integrations/tldr.js');
  const text = Array.from({length: 9}, (_, i) => '- Example ' + i + '\n`command --option-' + i + '`').join('\n\n');
  const examples = parseTldr(text);
  assert.equal(examples.length, 9);
  assert.deepEqual(examples[8], {description: 'Example 8', command: 'command --option-8'});
});
