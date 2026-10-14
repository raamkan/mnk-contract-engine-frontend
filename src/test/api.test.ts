import { describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest, getErrorMessage } from '../api/client';
import { createContract, createEndorsement, getContract, getContractPosition, getContracts } from '../api/contracts';
import { getHealth } from '../api/health';
import { slip, endorsement } from './fixtures';

function response(body: string, status = 200) {
  const fetchMock = vi.fn().mockImplementation(async () => new Response(status === 204 ? null : body, { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
describe('API transport and routes', () => {
  it('normalizes paths, preserves headers and signals, and serializes decimal strings', async () => {
    const fetchMock = response('{}');
    const signal = new AbortController().signal;
    await apiRequest('contracts/', { method: 'POST', json: slip, signal, headers: { 'X-Test': 'yes' } });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/contracts/');
    expect(options.signal).toBe(signal);
    expect(options.headers.get('Accept')).toBe('application/json');
    expect(options.headers.get('Content-Type')).toBe('application/json');
    expect(options.headers.get('X-Test')).toBe('yes');
    expect(JSON.parse(options.body).gross_premium).toBe('120000.00');
  });
  it('uses encoded references, pagination, date queries and POST endpoints', async () => {
    const fetchMock = response('{}');
    await getContracts(undefined, 2);
    await getContract('A/B &');
    await getContractPosition('A/B &', { as_at: '2026-11-10', known_at: '2027-02-14' });
    await getContractPosition('A');
    await createContract(slip);
    await createEndorsement('A/B &', { ...endorsement, type: 'PREMIUM_ADJUSTMENT', premium_change: '20000.00', changes: {} });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/contracts/?page=2', '/api/contracts/A%2FB%20%26/',
      '/api/contracts/A%2FB%20%26/position/?as_at=2026-11-10&known_at=2027-02-14',
      '/api/contracts/A/position/', '/api/contracts/', '/api/contracts/A%2FB%20%26/endorsements/',
    ]);
    expect(fetchMock.mock.calls[5][1].method).toBe('POST');
  });
  it('flattens nested field errors and indexed errors', async () => {
    response(JSON.stringify({ changes: { expiry_date: ['Must extend cover.'] }, items: [{ reason: ['Required'] }], endorsement_number: ['Duplicate'] }), 400);
    await expect(apiRequest('/bad')).rejects.toMatchObject({ status: 400, fieldErrors: {
      'changes.expiry_date': ['Must extend cover.'], 'items.0.reason': ['Required'], endorsement_number: ['Duplicate'],
    } });
  });
  it.each([
    [400, '{"non_field_errors":["Invalid terms"]}', 'Invalid terms'],
    [404, '{"detail":"Not found"}', 'Not found'],
    [400, '{}', 'Please check the highlighted fields.'],
    [500, '<html>Error</html>', 'Request failed (500).'],
    [503, '', 'Request failed (503).'],
  ])('reports HTTP %s errors', async (status, body, message) => {
    response(body, status);
    await expect(apiRequest('/bad')).rejects.toMatchObject({ message, status });
  });
  it('rejects successful non-JSON responses and accepts empty responses', async () => {
    response('html');
    await expect(apiRequest('/bad')).rejects.toThrow('unexpected response format');
    response('', 204);
    await expect(apiRequest('/empty')).resolves.toBeNull();
  });
  it('maps network, API and unexpected failures', () => {
    expect(getErrorMessage(new TypeError())).toContain('Unable to reach the API');
    expect(getErrorMessage(new ApiError('Duplicate', 400))).toBe('Duplicate');
    expect(getErrorMessage(new Error())).toBe('Something went wrong. Please try again.');
  });
  it('requests health outside the API prefix and reports downtime', async () => {
    const fetchMock = response('{"status":"ok"}');
    await expect(getHealth()).resolves.toEqual({ status: 'ok' });
    expect(fetchMock.mock.calls[0][0]).toBe('/health/');
    response('{}', 503);
    await expect(getHealth()).rejects.toThrow('HTTP 503');
  });
});
