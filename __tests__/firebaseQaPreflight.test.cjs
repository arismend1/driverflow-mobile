'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateFirebaseQaConfig } = require('../scripts/check_firebase_qa');

const valid = () => ({
  project_info: {
    project_id: 'driverflow-qa-example',
    project_number: '123456789012',
  },
  client: [{
    client_info: {
      android_client_info: { package_name: 'com.driverflow.official.qa' },
      mobilesdk_app_id: '1:123456789012:android:abc123abc123',
    },
    api_key: [{ current_key: 'EXAMPLE_NOT_A_REAL_KEY_123456789' }],
  }],
});

test('accepts structurally valid isolated QA configuration', () => {
  assert.equal(validateFirebaseQaConfig(valid()), true);
});

test('rejects dummy CI configuration', () => {
  const c = valid();
  c.project_info.project_id = 'driverflow-ci-debug-only';
  assert.throws(() => validateFirebaseQaConfig(c), /FIREBASE_QA_DUMMY/);
});

test('rejects production or mixed Android package entries', () => {
  const c = valid();
  c.client[0].client_info.android_client_info.package_name = 'com.driverflow.official';
  assert.throws(() => validateFirebaseQaConfig(c), /FIREBASE_QA_PACKAGE_MISMATCH/);
  const d = valid();
  d.client.push({ client_info: { android_client_info: { package_name: 'com.driverflow.official' } } });
  assert.throws(() => validateFirebaseQaConfig(d), /FIREBASE_QA_PACKAGE_MISMATCH/);
});

test('rejects malformed app IDs, missing keys and invalid project numbers', () => {
  const c = valid();
  c.client[0].client_info.mobilesdk_app_id = 'invalid';
  assert.throws(() => validateFirebaseQaConfig(c), /FIREBASE_QA_INVALID_MOBILE_APP_ID/);
  const d = valid();
  d.client[0].api_key = [];
  assert.throws(() => validateFirebaseQaConfig(d), /FIREBASE_QA_INVALID_API_KEY/);
  const e = valid();
  e.project_info.project_number = 'not-a-number';
  assert.throws(() => validateFirebaseQaConfig(e), /FIREBASE_QA_INVALID_PROJECT/);
});
