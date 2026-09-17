const { expect } = require('chai');
const { anyValue } = require('@nomicfoundation/hardhat-chai-matchers/withArgs');

describe('QuestionPaperRegistry', function () {
  let registry, owner, anchor, stranger;
  const paper = '0x' + '11'.repeat(32);
  const digest = '0x' + '22'.repeat(32);

  beforeEach(async () => {
    [owner, anchor, stranger] = await ethers.getSigners();
    registry = await (await ethers.getContractFactory('QuestionPaperRegistry')).deploy();
    await registry.waitForDeployment();
  });

  it('anchors an immutable encrypted-artifact digest', async () => {
    await expect(registry.anchorPaper(paper, digest))
      .to.emit(registry, 'PaperAnchored')
      .withArgs(paper, digest, anyValue, owner.address);
    const record = await registry.getPaperRecord(paper);
    expect(record[0]).eq(paper);
    expect(record[1]).eq(digest);
    expect(record[3]).eq(owner.address);
    expect(record[4]).eq(true);
    expect(record[2]).gt(0);
  });

  it('rejects duplicates without overwriting history', async () => {
    await registry.anchorPaper(paper, digest);
    await expect(registry.anchorPaper(paper, '0x' + '33'.repeat(32))).to.be.revertedWithCustomError(registry, 'AlreadyAnchored');
    expect((await registry.getPaperRecord(paper))[1]).eq(digest);
  });

  it('enforces authorized anchors', async () => {
    await expect(registry.connect(stranger).anchorPaper(paper, digest)).to.be.revertedWithCustomError(registry, 'Unauthorized');
    await registry.setAuthorizedAnchor(anchor.address, true);
    await registry.connect(anchor).anchorPaper(paper, digest);
    expect((await registry.getPaperRecord(paper))[3]).eq(anchor.address);
  });

  it('verifies only the matching digest', async () => {
    await registry.anchorPaper(paper, digest);
    expect(await registry.verifyPaper(paper, digest)).eq(true);
    expect(await registry.verifyPaper(paper, '0x' + '44'.repeat(32))).eq(false);
  });
});
