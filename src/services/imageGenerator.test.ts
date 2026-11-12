import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPerchanceImageApiUrl } from './imageGenerator';

test('Perchance official image API URL uses the documented iframe parameters', () => {
  const url = new URL(
    buildPerchanceImageApiUrl({
      prompt: 'a dragon & a moon',
      negativePrompt: 'blurry, text',
      width: 1280,
      height: 720,
      seed: 7,
      cfgScale: 9,
      requestId: 'noman_test_1',
    })
  );

  assert.equal(url.origin, 'https://perchance.org');
  assert.equal(url.pathname, '/perchance-ai-api');
  assert.equal(url.searchParams.get('prompt'), 'a dragon & a moon');
  assert.equal(url.searchParams.get('negativePrompt'), 'blurry, text');
  assert.equal(url.searchParams.get('resolution'), '768x512');
  assert.equal(url.searchParams.get('guidanceScale'), '9');
  assert.equal(url.searchParams.get('seed'), '7');
  assert.equal(url.searchParams.get('format'), 'json');
  assert.equal(url.searchParams.get('id'), 'noman_test_1');
});
