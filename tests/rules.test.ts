import { test } from 'node:test';
import assert from 'node:assert/strict';
import { money, distribution, contentType, MAX_FILE_BYTES } from '../lib/rules.ts';

test('USD conversion preserves integer cents including leading zeros and small amounts', () => {
  for (const [value, cents] of [['0',0], ['0.01',1], ['1.2',120], ['0002.05',205], ['20000.01',2000001], ['90000000000.00',9000000000000]] as const) assert.equal(money(value),cents);
});
test('invalid, negative, scientific and over-precision amounts cannot be silently rounded', () => {
  for (const bad of ['-1','1.001','NaN','1e4','',' 1','1 ','1,000','+1','.01','1.','Infinity','9007199254740992']) assert.throws(() => money(bad));
});
test('quarter awards round half up including sub-cent distributions', () => {
  assert.deepEqual([1,2,3,4,5,6,7,2000000,2000001,2000002].map(distribution),[0,1,1,1,1,2,2,500000,500000,500001]);
});
test('file verification recognizes PDF, JPEG and full PNG signatures', () => {
  assert.equal(contentType(new TextEncoder().encode('%PDF-1.7')), 'application/pdf');
  assert.equal(contentType(new Uint8Array([255,216,255,224])), 'image/jpeg');
  assert.equal(contentType(new Uint8Array([137,80,78,71,13,10,26,10])), 'image/png');
});
test('empty, renamed and truncated uploads cannot pass supported signatures', () => {
  for(const bytes of [new Uint8Array(),new TextEncoder().encode('fake.pdf'),new Uint8Array([137,80,78,71]),new Uint8Array([255,216])]) assert.equal(contentType(bytes),null);
  assert.equal(MAX_FILE_BYTES,10_000_000);
});
