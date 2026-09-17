const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');
const realEthers = require('ethers');

const servicePath = require.resolve('../src/services/blockchainService');
const digest = 'ab'.repeat(32);
const otherDigest = 'cd'.repeat(32);
const paper = {
  id: 'paper-2026-001',
  encryptedFileHash: digest,
  blockchainTransactionHash: '0xprevious',
  blockchainAnchoredAt: new Date('2026-01-01T00:00:00.000Z'),
};

function loadService({ calculatedHash = digest, record, receipt = { blockNumber: 42 } } = {}) {
  const calls = { anchor: [], wait: 0, contract: 0 };
  const contract = {
    getPaperRecord: async () => record || ['0x' + '00'.repeat(32), '0x' + '00'.repeat(32), 0n, '0x0', false],
    anchorPaper: async (...args) => {
      calls.anchor.push(args);
      return { hash: '0xtxhash', wait: async () => { calls.wait += 1; return receipt; } };
    },
    runner: { provider: { getNetwork: async () => ({ chainId: 31337n }) } },
  };
  const fakeEnv = {
    blockchainEnabled: true,
    blockchainRpcUrl: 'http://mock-rpc',
    blockchainPrivateKey: '0x' + '11'.repeat(32),
    blockchainContractAddress: '0x' + '22'.repeat(20),
  };
  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === 'ethers') return { ethers: { ...realEthers.ethers, Contract: function () { calls.contract += 1; return contract; }, Wallet: function () {}, JsonRpcProvider: function () {} } };
    if (request === '../config/env') return fakeEnv;
    if (request === './encryptionService') return { calculateSha256: () => calculatedHash };
    return originalLoad.call(this, request, parent, isMain);
  };
  delete require.cache[servicePath];
  const service = require(servicePath);
  return { service, calls, restore: () => { Module._load = originalLoad; delete require.cache[servicePath]; } };
}

test('accepts a valid SHA-256 digest and passes its exact bytes32 value to Solidity', async () => {
  const fixture = loadService();
  try {
    const result = await fixture.service.anchor(paper, Buffer.from('encrypted-ciphertext'));
    assert.deepEqual(fixture.calls.anchor[0][1], `0x${digest}`);
    assert.equal(result.contentHash, digest);
  } finally { fixture.restore(); }
});

test('rejects invalid-length and invalid-format SHA-256 digests safely', async () => {
  for (const invalidHash of ['ab'.repeat(31), 'z'.repeat(64)]) {
    const fixture = loadService({ calculatedHash: invalidHash });
    try {
      await assert.rejects(() => fixture.service.anchor({ ...paper, encryptedFileHash: invalidHash }, Buffer.from('ciphertext')), { code: 'BLOCKCHAIN_HASH_INVALID' });
      assert.equal(fixture.calls.contract, 0);
    } finally { fixture.restore(); }
  }
});

test('produces a deterministic canonical blockchain paper ID hash', () => {
  const fixture = loadService();
  try {
    assert.equal(fixture.service.paperHash(paper.id), fixture.service.paperHash(paper.id));
    assert.equal(fixture.service.paperHash(paper.id), realEthers.keccak256(realEthers.toUtf8Bytes(`question-paper:${paper.id}`)));
  } finally { fixture.restore(); }
});

test('does not create a duplicate anchor when the historical record matches', async () => {
  const fixture = loadService({ record: ['0x00', `0x${digest}`, 1n, '0xanchor', true] });
  try {
    const result = await fixture.service.anchor(paper, Buffer.from('ciphertext'));
    assert.equal(result.duplicate, true);
    assert.equal(fixture.calls.anchor.length, 0);
  } finally { fixture.restore(); }
});

test('rejects a conflicting historical artifact hash without overwriting it', async () => {
  const fixture = loadService({ record: ['0x00', `0x${otherDigest}`, 1n, '0xanchor', true] });
  try {
    await assert.rejects(() => fixture.service.anchor(paper, Buffer.from('ciphertext')), { code: 'BLOCKCHAIN_HASH_MISMATCH' });
    assert.equal(fixture.calls.anchor.length, 0);
  } finally { fixture.restore(); }
});

test('rejects a MongoDB/artifact SHA-256 mismatch before any blockchain transaction', async () => {
  const fixture = loadService({ calculatedHash: otherDigest });
  try {
    await assert.rejects(() => fixture.service.anchor(paper, Buffer.from('different-ciphertext')), { code: 'BLOCKCHAIN_HASH_MISMATCH' });
    assert.equal(fixture.calls.contract, 0);
  } finally { fixture.restore(); }
});

test('waits for transaction confirmation before returning success', async () => {
  const fixture = loadService({ receipt: { blockNumber: 99 } });
  try {
    const result = await fixture.service.anchor(paper, Buffer.from('ciphertext'));
    assert.equal(fixture.calls.wait, 1);
    assert.equal(result.blockNumber, 99);
  } finally { fixture.restore(); }
});

test('returns only safe anchor metadata and sends no artifact or key material to Solidity', async () => {
  const fixture = loadService();
  try {
    const result = await fixture.service.anchor(paper, Buffer.from('ciphertext'));
    assert.deepEqual(Object.keys(result).sort(), ['anchoredAt', 'blockNumber', 'chainId', 'contentHash', 'contractAddress', 'paperIdHash', 'transactionHash'].sort());
    assert.equal(fixture.calls.anchor[0].length, 2);
    assert.match(fixture.calls.anchor[0][0], /^0x[a-f0-9]{64}$/i);
    assert.equal(fixture.calls.anchor[0][1], `0x${digest}`);
  } finally { fixture.restore(); }
});
