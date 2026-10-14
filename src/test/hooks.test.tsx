import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as api from '../api/contracts';
import { ApiError } from '../api/client';
import { useContracts } from '../hooks/useContracts';
import { useContract } from '../hooks/useContract';
import { useContractPosition } from '../hooks/useContractPosition';
import { deferred, details, position, slip } from './fixtures';

describe('Contract loading', () => {
  it.each([
    [[], 0, false, false], [[slip], 1, false, false],
    [{ results: [slip], count: 21, next: '/next', previous: '/previous' }, 21, true, true],
  ])('normalizes array and paginated lists', async (response, total, hasNext, hasPrevious) => {
    vi.spyOn(api, 'getContracts').mockResolvedValue(response);
    const { result } = renderHook(() => useContracts(1));
    expect(result.current.state.status).toBe('loading');
    await waitFor(() => expect(result.current.state).toMatchObject({ status: 'success', data: { total, hasNext, hasPrevious } }));
  });
  it('retries a failed list and cancels stale page requests', async () => {
    const old = deferred<typeof slip[]>();
    const get = vi.spyOn(api, 'getContracts').mockReturnValueOnce(old.promise)
      .mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce([slip]);
    const { result, rerender, unmount } = renderHook(({ page }) => useContracts(page), { initialProps: { page: 1 } });
    const oldSignal = get.mock.calls[0][0];
    rerender({ page: 2 });
    expect(oldSignal?.aborted).toBe(true);
    await waitFor(() => expect(result.current.state.status).toBe('error'));
    await act(async () => { old.resolve([]); });
    expect(result.current.state.status).toBe('error');
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.state).toMatchObject({ status: 'success', data: { contracts: [slip] } }));
    const signal = get.mock.calls[2][0]; unmount(); expect(signal?.aborted).toBe(true);
  });
  it('distinguishes missing details from downtime, retries and ignores stale failures', async () => {
    const old = deferred<typeof details>();
    const get = vi.spyOn(api, 'getContract').mockReturnValueOnce(old.promise)
      .mockRejectedValueOnce(new ApiError('Missing', 404)).mockResolvedValueOnce(details);
    const { result, rerender } = renderHook(({ ref }) => useContract(ref), { initialProps: { ref: 'old' } });
    rerender({ ref: slip.mga_reference });
    await waitFor(() => expect(result.current.state).toMatchObject({ status: 'error', notFound: true }));
    await act(async () => old.reject(new TypeError('offline')));
    expect(result.current.state).toMatchObject({ notFound: true });
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.state).toMatchObject({ status: 'success', data: details }));
    expect(get.mock.calls[0][1]?.aborted).toBe(true);
  });
  it('reports details network errors as recoverable', async () => {
    vi.spyOn(api, 'getContract').mockRejectedValue(new TypeError());
    const { result } = renderHook(() => useContract('A'));
    await waitFor(() => expect(result.current.state).toMatchObject({ status: 'error', notFound: false, message: expect.stringContaining('Unable to reach') }));
  });
});
describe('Position selection', () => {
  it('uses the initial position without fetching and waits for contract data', () => {
    const get = vi.spyOn(api, 'getContractPosition');
    const { result, rerender } = renderHook(({ initial }) => useContractPosition('A', initial), {
      initialProps: { initial: null as typeof position | null },
    });
    expect(result.current.loading).toBe(false);
    rerender({ initial: position });
    expect(result.current.position).toBe(position); expect(get).not.toHaveBeenCalled();
  });
  it('hides stale values, ignores out-of-order results and returns to original date', async () => {
    const old = deferred<typeof position>(); const latest = deferred<typeof position>();
    const get = vi.spyOn(api, 'getContractPosition').mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
    const { result } = renderHook(() => useContractPosition('A', position));
    act(() => result.current.setAsAt('2026-11-09'));
    expect(result.current.loading).toBe(true); expect(result.current.position).toBeNull();
    act(() => result.current.setAsAt('2026-11-10'));
    expect(get.mock.calls[0][2]?.aborted).toBe(true);
    await act(async () => latest.resolve({ ...position, as_at: '2026-11-10', gross_premium: '140000.00' }));
    await act(async () => old.resolve({ ...position, as_at: '2026-11-09' }));
    expect(result.current.position?.gross_premium).toBe('140000.00');
    act(() => result.current.setAsAt(position.as_at));
    expect(result.current.position).toBe(position);
  });
  it('retries position failures, supports known_at and refreshes selected dates after saving', async () => {
    const get = vi.spyOn(api, 'getContractPosition').mockRejectedValueOnce(new TypeError()).mockResolvedValue({ ...position, as_at: '2026-11-10' });
    const { result, rerender } = renderHook(({ initial }) => useContractPosition('A', initial), { initialProps: { initial: position } });
    act(() => result.current.setAsAt('2026-11-10'));
    await waitFor(() => expect(result.current.error).toContain('Unable to reach'));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.position?.as_at).toBe('2026-11-10'));
    act(() => result.current.setKnownAt('2027-02-14'));
    await waitFor(() => expect(get).toHaveBeenLastCalledWith('A', { as_at: '2026-11-10', known_at: '2027-02-14' }, expect.any(AbortSignal)));
    rerender({ initial: { ...position } });
    await waitFor(() => expect(get).toHaveBeenCalledTimes(4));
  });
});
