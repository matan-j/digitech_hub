// Run with: npm test
// Covers the server-trusted pricing + the SUMIT mapping. These are the guarantees
// that the charged amount comes from the DB course row, never the frontend.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveFinalPrice } from '../pricing.ts';
import { buildCustomer, buildRedirectItem } from '../sumit-mapping.ts';

test('resolveFinalPrice charges the sale price when a discount is active', () => {
  const p = resolveFinalPrice({ price_amount: 199, sale_amount: 149, price_currency: 'ILS' });
  assert.equal(p.original, 199);
  assert.equal(p.final, 149);
  assert.equal(p.hasDiscount, true);
  assert.equal(p.isFree, false);
});

test('resolveFinalPrice charges the regular price when no sale is set', () => {
  const p = resolveFinalPrice({ price_amount: 199, sale_amount: null, price_currency: 'ILS' });
  assert.equal(p.final, 199);
  assert.equal(p.hasDiscount, false);
});

test('resolveFinalPrice ignores a sale that is not below the regular price', () => {
  // sale >= regular is not a real discount → charge the regular price.
  const p = resolveFinalPrice({ price_amount: 100, sale_amount: 120 });
  assert.equal(p.final, 100);
  assert.equal(p.hasDiscount, false);
});

test('resolveFinalPrice treats a 0 / missing price as free', () => {
  assert.equal(resolveFinalPrice({ price_amount: 0 }).isFree, true);
  assert.equal(resolveFinalPrice({ price_amount: null, sale_amount: null }).isFree, true);
});

test('buildRedirectItem uses the server final price and ILS, quantity 1', () => {
  const item = buildRedirectItem({ title: 'קורס ביג דאטה', price_amount: 199, sale_amount: 149, price_currency: 'ILS' });
  assert.equal(item.UnitPrice, 149); // sale, not regular — and never a client value
  assert.equal(item.Quantity, 1);
  assert.equal(item.Currency, 'ILS');
  assert.equal(item.Item.Name, 'קורס ביג דאטה');
});

test('buildRedirectItem falls back to ILS when currency missing', () => {
  const item = buildRedirectItem({ title: 'X', price_amount: 50 });
  assert.equal(item.Currency, 'ILS');
  assert.equal(item.UnitPrice, 50);
});

test('buildCustomer maps profile + auth email; falls back name→email', () => {
  const c = buildCustomer({ name: 'מתן ישראלי', email: 'a@b.com', phone: '0501234567' });
  assert.equal(c.Name, 'מתן ישראלי');
  assert.equal(c.EmailAddress, 'a@b.com');
  assert.equal(c.Phone, '0501234567');

  const noName = buildCustomer({ name: '', email: 'a@b.com', phone: null });
  assert.equal(noName.Name, 'a@b.com');
});
