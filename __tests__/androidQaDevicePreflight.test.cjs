'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { assertExactlyOneDevice, assertReverseForwarding, assertLocalHealth, runReadiness } =
  require('../scripts/check_android_qa_device');

test('ADB refuses zero, unauthorized or multiple devices', () => {
  assert.throws(() => assertExactlyOneDevice('List of devices attached\n'), /EXACTLY_ONE/);
  assert.throws(() => assertExactlyOneDevice('List of devices attached\nA unauthorized\n'), /EXACTLY_ONE/);
  assert.throws(() => assertExactlyOneDevice('List of devices attached\nA device\nB device\n'), /EXACTLY_ONE/);
  assert.equal(assertExactlyOneDevice('List of devices attached\nQA123 device product:mock\n'), 'QA123');
});

test('ADB reverse must forward API port to the same local port', () => {
  assert.throws(() => assertReverseForwarding('QA123 tcp:8081 tcp:8081'), /REVERSE_3000/);
  assert.throws(() => assertReverseForwarding('QA123 tcp:3000 tcp:4000'), /REVERSE_3000/);
  assert.equal(assertReverseForwarding('QA123 tcp:8081 tcp:8081\nQA123 tcp:3000 tcp:3000'), true);
});

test('local API health refuses malformed and failed replies', () => {
  assert.throws(() => assertLocalHealth(404, { status: 'ok' }), /HEALTH/);
  assert.throws(() => assertLocalHealth(200, { status: 'ready' }), /HEALTH/);
  assert.equal(assertLocalHealth(200, { status: 'ok' }), true);
});

test('full device readiness uses only mock read-only checks', async () => {
  const calls = [];
  const result = await runReadiness({
    firebaseCheck: () => calls.push('firebase'),
    adb: args => {
      calls.push(args.join(' '));
      if (args[0] === 'devices') return 'List of devices attached\nQA123 device\n';
      if (args.includes('reverse')) return 'QA123 tcp:3000 tcp:3000\n';
      return 'package:com.driverflow.official.qa\n';
    },
    httpGet: async () => ({ status: 200, body: { status: 'ok' } }),
  });
  assert.equal(result.serial, 'QA123');
  assert.deepEqual(calls, [
    'firebase',
    'devices',
    '-s QA123 reverse --list',
    '-s QA123 shell pm list packages com.driverflow.official.qa',
  ]);
});

test('does not reach ADB if Firebase QA validation fails', async () => {
  let adbCalled = false;
  await assert.rejects(() => runReadiness({
    firebaseCheck: () => { throw new Error('FIREBASE_QA_DUMMY_CONFIG_NOT_FOR_DEVICE'); },
    adb: () => { adbCalled = true; return ''; },
  }), /FIREBASE_QA_DUMMY/);
  assert.equal(adbCalled, false);
});
