const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const mongoose = require('mongoose');

const backendRoot = require('path').resolve(__dirname, '..');
const stripAnsi = value => value.replace(/\u001B\[[0-?]*[ -\/]*[@-~]/g, '');
function runConfig(script, env) {
  return stripAnsi(execFileSync(process.execPath, ['-e', script], { cwd: backendRoot, env: { ...process.env, ...env }, encoding: 'utf8' })).trim();
}

test('production never enables MFA demo OTP disclosure', () => {
  assert.equal(runConfig("console.log(require('./src/config/env').mfaDisplayOtpEnabled())", { NODE_ENV: 'production', MFA_DISPLAY_OTP: 'true' }), 'false');
});

test('production validation requires complete blockchain configuration only when enabled', () => {
  const output = runConfig("try { require('./src/config/env').validateProductionEnvironment(); } catch (error) { console.log(error.message); }", { NODE_ENV: 'production', MONGO_URI: 'mongodb://example.invalid/test', JWT_SECRET: 'test', STORAGE_PROVIDER: 'local', BLOCKCHAIN_ENABLED: 'true', BLOCKCHAIN_RPC_URL: '', BLOCKCHAIN_PRIVATE_KEY: '', BLOCKCHAIN_CONTRACT_ADDRESS: '' });
  assert.match(output, /BLOCKCHAIN_RPC_URL/);
});

test('readiness safely returns 503 while MongoDB is disconnected', () => {
  assert.notEqual(mongoose.connection.readyState, 1);
  const { getReady } = require('../src/controllers/healthController');
  let result;
  getReady({}, { status: code => ({ json: body => { result = { code, body }; } }) });
  assert.deepEqual(result, { code: 503, body: { status: 'not_ready' } });
});
