'use strict';

// Local-only structural preflight. Does NOT contact Firebase or prove delivery.
// Never print project keys or the contents of google-services.json.
const fs = require('node:fs');
const path = require('node:path');

const EXPECTED_PACKAGE = 'com.driverflow.official.qa';
const INVALID_MARKERS = ['driverflow-ci-debug-only', 'CI_DUMMY_DO_NOT_USE'];

function validateFirebaseQaConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('FIREBASE_QA_INVALID_JSON');
  }
  const projectId = config.project_info?.project_id;
  const projectNumber = String(config.project_info?.project_number || '');
  if (!projectId || !/^\\d{6,}$/.test(projectNumber)) {
    throw new Error('FIREBASE_QA_INVALID_PROJECT');
  }
  if (INVALID_MARKERS.some(marker =>
    String(projectId).includes(marker) || JSON.stringify(config).includes(marker)
  )) {
    throw new Error('FIREBASE_QA_DUMMY_CONFIG_NOT_FOR_DEVICE');
  }
  const clients = Array.isArray(config.client) ? config.client : [];
  const selected = clients.filter(client =>
    client?.client_info?.android_client_info?.package_name === EXPECTED_PACKAGE
  );
  if (selected.length !== 1 || clients.length !== 1) {
    throw new Error('FIREBASE_QA_PACKAGE_MISMATCH_OR_MIXED_CONFIG');
  }
  if (!/^1:\\d+:android:[a-fA-F0-9]+$/.test(
    selected[0]?.client_info?.mobilesdk_app_id || ''
  )) {
    throw new Error('FIREBASE_QA_INVALID_MOBILE_APP_ID');
  }
  const keys = selected[0]?.api_key;
  if (!Array.isArray(keys) || !keys.some(item =>
    typeof item?.current_key === 'string' && item.current_key.length >= 20
  )) {
    throw new Error('FIREBASE_QA_INVALID_API_KEY');
  }
  return true;
}

function checkLocalFirebaseQaConfig(filePath =
  path.join(__dirname, '..', 'android', 'app', 'google-services.json')) {
  if (!fs.existsSync(filePath)) throw new Error('FIREBASE_QA_FILE_MISSING');
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    throw new Error('FIREBASE_QA_INVALID_JSON');
  }
  validateFirebaseQaConfig(parsed);
  console.log('FIREBASE_QA_STRUCTURE_OK: package matches QA; Firebase connectivity NOT verified');
}

if (require.main === module) {
  try {
    checkLocalFirebaseQaConfig();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { validateFirebaseQaConfig, checkLocalFirebaseQaConfig };
