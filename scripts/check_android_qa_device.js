'use strict';

// Read-only checks before connecting a QA Android device. No login or writes.
// A successful check is NOT proof that the backend database is isolated.
const { execFileSync } = require('node:child_process');
const { checkLocalFirebaseQaConfig } = require('./check_firebase_qa');

function assertExactlyOneDevice(output) {
  const devices = String(output).split(/\r?\n/)
    .filter(line => /^\S+\s+device(?:\s|$)/.test(line))
    .map(line => line.trim().split(/\s+/)[0]);
  if (devices.length !== 1) throw new Error('QA_ADB_REQUIRES_EXACTLY_ONE_AUTHORIZED_DEVICE');
  return devices[0];
}

function assertReverseForwarding(output) {
  const lines = String(output).split(/\r?\n/).filter(Boolean);
  if (!lines.some(line => /(?:^|\s)tcp:3000\s+tcp:3000(?:\s|$)/.test(line))) {
    throw new Error('QA_ADB_REVERSE_3000_MISSING');
  }
  return true;
}

function assertDisposableIdentity(status, identity) {
  if (status !== 200 ||
      identity?.mode !== 'disposable-http-integration-only' ||
      identity?.database !== 'driverflow_security_test' ||
      identity?.user !== 'driverflow_test') {
    throw new Error('QA_LOCAL_API_NOT_DISPOSABLE');
  }
  return true;
}

function assertLocalHealth(status, body) {
  if (status !== 200 || body?.status !== 'ok') throw new Error('QA_LOCAL_API_HEALTH_UNAVAILABLE');
  return true;
}

async function runReadiness({
  adb = (args) => execFileSync('adb', args, { encoding: 'utf8', timeout: 10000 }),
  httpGet = async () => {
    const response = await fetch('http://127.0.0.1:3000/health',
      { signal: AbortSignal.timeout(5000) });
    return { status: response.status, body: await response.json() };
  },
  identityGet = async () => {
    const response = await fetch('http://127.0.0.1:3000/__qa/identity',
      { signal: AbortSignal.timeout(5000) });
    return { status: response.status, body: await response.json() };
  },
  firebaseCheck = checkLocalFirebaseQaConfig,
} = {}) {
  // The isolated API is not provided by GitHub Actions: a persistent locally
  // created testing backend with fictional accounts is required.
  firebaseCheck();
  const serial = assertExactlyOneDevice(adb(['devices']));
  assertReverseForwarding(adb(['-s', serial, 'reverse', '--list']));
  const packages = adb(['-s', serial, 'shell', 'pm', 'list', 'packages', 'com.driverflow.official.qa']);
  if (!String(packages).split(/\r?\n/).some(line =>
    line.trim() === 'package:com.driverflow.official.qa')) {
    throw new Error('QA_ANDROID_APP_NOT_INSTALLED');
  }
  const health = await httpGet();
  assertLocalHealth(health.status, health.body);
  const identity = await identityGet();
  assertDisposableIdentity(identity.status, identity.body);
  return { serial, ready: true };
}

if (require.main === module) {
  runReadiness().then(() => {
    console.log('QA_DEVICE_PREFLIGHT_OK: device, reverse, local app, health and disposable identity');
    console.log('WARNING: Firebase connectivity, notifications and backend feature readiness NOT verified');
  }).catch(error => {
    // Do not print raw child-process error objects, response bodies or secrets.
    console.error(/^QA_|^FIREBASE_/.test(error.message)
      ? error.message : 'QA_DEVICE_PREFLIGHT_FAILED');
    process.exitCode = 1;
  });
}

module.exports = { assertExactlyOneDevice, assertReverseForwarding, assertLocalHealth, assertDisposableIdentity, runReadiness };
