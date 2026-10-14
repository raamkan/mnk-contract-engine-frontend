import { beforeAll, describe, expect, it } from 'vitest';

// Real HTTP requests exercise Django validation, calculations and persistence.
// Each run writes uniquely named records; use a disposable review database.
const base = (process.env.TEST_API_BASE_URL || 'http://127.0.0.1:8000/api').replace(/\/+$/, '');
const run = `AUTO-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let counter = 0;
const original = {
  insured_name: 'Raman Logistics Ltd', class_of_business: 'Property', currency: 'INR',
  inception_date: '2026-10-10', expiry_date: '2026-12-31',
  sum_insured: '5000000.00', gross_premium: '120000.00', brokerage_pct: '20.00', signed_line_pct: '25.00',
};
type Payload = Record<string, unknown>;
async function request(path: string, json?: Payload) {
  const response = await fetch(`${base}${path}`, {
    method: json ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: json ? JSON.stringify(json) : undefined,
  });
  return { status: response.status, data: await response.json() as { slip: Payload; endorsements: Payload[]; premium_change: string } };
}
async function fresh() {
  const reference = `${run}-${++counter}`;
  const result = await request('/contracts/', { ...original, mga_reference: reference });
  expect(result.status).toBe(201);
  return reference;
}
const path = (reference: string) => `/contracts/${encodeURIComponent(reference)}/`;
function add(reference: string, overrides: Payload = {}) {
  return request(`${path(reference)}endorsements/`, {
    endorsement_number: 1, type: 'PREMIUM_ADJUSTMENT', status: 'AGREED',
    effective_date: '2026-11-01', recorded_date: '2026-11-02', premium_change: '0.00',
    changes: {}, reason: 'Automated scenario', ...overrides,
  });
}
async function assertPosition(reference: string, date: string, expected: Payload) {
  const result = await request(`${path(reference)}position/?as_at=${date}`);
  expect(result.status).toBe(200);
  expect(result.data).toMatchObject(expected);
}
async function rejection(reference: string, overrides: Payload, field: string) {
  const before = await request(path(reference));
  const result = await add(reference, overrides);
  expect(result.status).toBe(400);
  expect(result.data).toHaveProperty(field);
  const after = await request(path(reference));
  expect(after.data.endorsements).toEqual(before.data.endorsements);
  expect(after.data.slip).toEqual(before.data.slip);
}
beforeAll(async () => {
  try {
    const result = await request('/contracts/');
    expect(result.status).toBe(200);
  } catch (error) {
    throw new Error(`Start Django and PostgreSQL before running integration tests (API: ${base}).`, { cause: error });
  }
});

describe('Real API: documented review sequence', () => {
  it('creates, endorses, selects all date boundaries, cancels and reloads persisted records', async () => {
    const reference = await fresh();
    await assertPosition(reference, '2026-10-10', { insured_name: original.insured_name, currency: 'INR', sum_insured: '5000000.00', gross_premium: '120000.00', expiry_date: '2026-12-31', status: 'BOUND', net_premium: '96000.00', our_net_premium: '24000.00', applied_endorsements: [] });
    expect((await add(reference, {
      type: 'CHANGE_SUM_INSURED', effective_date: '2026-11-10', recorded_date: '2027-02-14',
      premium_change: '20000.00', changes: { sum_insured: '6000000.00' },
    })).status).toBe(201);
    await assertPosition(reference, '2026-11-09', { sum_insured: '5000000.00', gross_premium: '120000.00', net_premium: '96000.00', our_net_premium: '24000.00', applied_endorsements: [] });
    const increased = { sum_insured: '6000000.00', gross_premium: '140000.00', net_premium: '112000.00', our_net_premium: '28000.00', applied_endorsements: [1] };
    await assertPosition(reference, '2026-11-10', increased);
    expect((await add(reference, { endorsement_number: 2, status: 'DRAFT', effective_date: '2026-11-15', premium_change: '5000.00' })).status).toBe(201);
    await assertPosition(reference, '2026-11-15', increased);
    expect((await add(reference, { endorsement_number: 3, type: 'CHANGE_DETAILS', effective_date: '2026-11-20', changes: { insured_name: 'Raman Logistics Group Ltd' } })).status).toBe(201);
    await assertPosition(reference, '2026-11-20', { ...increased, insured_name: 'Raman Logistics Group Ltd', applied_endorsements: [1, 3] });
    expect((await add(reference, { endorsement_number: 4, type: 'EXTENSION', effective_date: '2026-12-01', premium_change: '10000.00', changes: { expiry_date: '2027-06-30' } })).status).toBe(201);
    await assertPosition(reference, '2026-11-30', { ...increased, expiry_date: '2026-12-31', applied_endorsements: [1, 3] });
    const extended = { expiry_date: '2027-06-30', gross_premium: '150000.00', net_premium: '120000.00', our_net_premium: '30000.00', applied_endorsements: [1, 3, 4] };
    await assertPosition(reference, '2026-12-01', extended);
    expect((await add(reference, { endorsement_number: 5, effective_date: '2027-01-10', premium_change: '-10000.00' })).status).toBe(201);
    await assertPosition(reference, '2027-01-09', extended);
    const returned = { ...increased, expiry_date: '2027-06-30', applied_endorsements: [1, 3, 4, 5] };
    await assertPosition(reference, '2027-01-10', returned);
    const cancel = await add(reference, { endorsement_number: 6, type: 'CANCELLATION', effective_date: '2027-02-01', premium_change: null });
    expect(cancel.status).toBe(201); expect(cancel.data.premium_change).toBe('-79545.45');
    await assertPosition(reference, '2027-01-31', { ...returned, status: 'BOUND' });
    await assertPosition(reference, '2027-02-01', { status: 'CANCELLED', expiry_date: '2027-01-31', gross_premium: '60454.55', net_premium: '48363.64', our_net_premium: '12090.91', applied_endorsements: [1, 3, 4, 5, 6] });
    const reload = await request(path(reference));
    expect(reload.data.slip).toMatchObject({ ...original, status: 'BOUND' });
    expect(reload.data.endorsements).toHaveLength(6);
    expect(reload.data.endorsements.find((e: Payload) => e.endorsement_number === 1)?.recorded_date).toBe('2027-02-14');
    await rejection(reference, { endorsement_number: 7, effective_date: '2027-02-01' }, 'effective_date');
    await rejection(reference, { endorsement_number: 7, effective_date: '2027-02-02', status: 'DRAFT' }, 'effective_date');
    await rejection(reference, { endorsement_number: 7, effective_date: '2027-01-15', premium_change: '1000.00' }, 'effective_date');
  });
});
describe('Real API: validation and additional scenarios', () => {
  it('rejects missing original fields and duplicate references', async () => {
    const empty = await request('/contracts/', {}); expect(empty.status).toBe(400);
    expect(empty.data).toHaveProperty('mga_reference');
    const reference = await fresh();
    const duplicate = await request('/contracts/', { ...original, mga_reference: reference });
    expect(duplicate.status).toBe(400); expect(duplicate.data).toHaveProperty('mga_reference');
  });
  it.each([
    ['before inception', { effective_date: '2026-10-09' }, 'effective_date'],
    ['after expiry', { effective_date: '2027-01-01' }, 'effective_date'],
    ['blank reason', { reason: '' }, 'reason'],
    ['missing sum insured', { type: 'CHANGE_SUM_INSURED' }, 'changes'],
    ['missing insured name', { type: 'CHANGE_DETAILS' }, 'changes'],
    ['missing extension date', { type: 'EXTENSION' }, 'changes'],
    ['same expiry extension', { type: 'EXTENSION', changes: { expiry_date: '2026-12-31' } }, 'changes'],
    ['earlier expiry extension', { type: 'EXTENSION', changes: { expiry_date: '2026-12-30' } }, 'changes'],
    ['excessive return', { premium_change: '-120000.01' }, 'premium_change'],
  ])('rejects %s without saving an endorsement', async (_name, overrides, field) => {
    await rejection(await fresh(), overrides, field);
  });
  it('rejects duplicate numbers even when the saved record is a draft', async () => {
    const reference = await fresh(); expect((await add(reference, { status: 'DRAFT' })).status).toBe(201);
    await rejection(reference, {}, 'endorsement_number');
  });
  it('accepts an exact zero balance', async () => {
    const reference = await fresh(); expect((await add(reference, { premium_change: '-120000.00' })).status).toBe(201);
    await assertPosition(reference, '2026-11-01', { gross_premium: '0.00', net_premium: '0.00', our_net_premium: '0.00' });
  });
  it('rejects cancellation conflicting with an existing agreed change', async () => {
    const reference = await fresh(); expect((await add(reference, { effective_date: '2026-12-10' })).status).toBe(201);
    await rejection(reference, { endorsement_number: 2, type: 'CANCELLATION', effective_date: '2026-12-01', premium_change: null }, 'effective_date');
  });
  it('returns original terms before inception and remains Bound after normal expiry', async () => {
    const reference = await fresh();
    await assertPosition(reference, '2026-10-09', { gross_premium: '120000.00', status: 'BOUND', applied_endorsements: [] });
    await assertPosition(reference, '2027-01-01', { gross_premium: '120000.00', status: 'BOUND', applied_endorsements: [] });
  });
  it('returns 404 for an unknown contract and rejects invalid position dates', async () => {
    expect((await request(path(`${run}-MISSING`))).status).toBe(404);
    const reference = await fresh();
    expect((await request(`${path(reference)}position/?as_at=bad-date`)).status).toBe(400);
  });
});
