import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import App from '../App';
import * as api from '../api/contracts';
import { ApiError } from '../api/client';
import { deferred, details, endorsement, position, slip } from './fixtures';

function app(route = '/') { return render(<MemoryRouter initialEntries={[route]}><App /></MemoryRouter>); }
describe('Application workflows', () => {
  it('redirects root, shows loading then empty state, and navigates to creation', async () => {
    const pending = deferred<typeof slip[]>();
    vi.spyOn(api, 'getContracts').mockReturnValue(pending.promise);
    app(); expect(screen.getByText('Loading contracts…')).toBeInTheDocument();
    await act(async () => pending.resolve([]));
    expect(screen.getByText('No contracts found')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: '+ New contract' }));
    expect(screen.getByRole('heading', { name: 'Create original slip' })).toBeInTheDocument();
  });
  it('recovers the list after API downtime and opens the contract', async () => {
    vi.spyOn(api, 'getContracts').mockRejectedValueOnce(new TypeError()).mockResolvedValue([slip]);
    vi.spyOn(api, 'getContract').mockResolvedValue(details);
    app('/contracts');
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to reach');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    fireEvent.click(await screen.findByRole('link', { name: slip.insured_name }));
    expect(await screen.findByRole('heading', { name: slip.insured_name })).toBeInTheDocument();
  });
  it('supports next/previous pages and returning from an empty later page', async () => {
    const get = vi.spyOn(api, 'getContracts').mockResolvedValueOnce({ count: 2, results: [slip], next: 'next', previous: null })
      .mockResolvedValueOnce({ count: 2, results: [slip], next: null, previous: 'previous' })
      .mockResolvedValueOnce({ count: 2, results: [slip], next: 'next', previous: null })
      .mockResolvedValueOnce([]).mockResolvedValueOnce([slip]);
    app('/contracts');
    expect(await screen.findByRole('button', { name: 'Previous' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(screen.getByText('Page 2')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    await waitFor(() => expect(screen.getByText('Page 1')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Return to first page' }));
    expect(await screen.findByRole('link', { name: slip.insured_name })).toBeInTheDocument();
    expect(get.mock.calls.map(call => call[1])).toEqual([1, 2, 1, 2, 1]);
  });
  it('shows unknown routes and missing contracts', async () => {
    const view = app('/unknown-page');
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument(); view.unmount();
    vi.spyOn(api, 'getContract').mockRejectedValue(new ApiError('Missing', 404));
    app('/contracts/DOES-NOT-EXIST');
    expect(await screen.findByRole('alert')).toHaveTextContent('Contract not found');
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });
  it('retries detail and position errors and queries selected dates', async () => {
    vi.spyOn(api, 'getContract').mockRejectedValueOnce(new TypeError()).mockResolvedValue(details);
    const get = vi.spyOn(api, 'getContractPosition').mockRejectedValueOnce(new TypeError()).mockResolvedValue({ ...position, as_at: '2026-11-10', gross_premium: '140000.00' });
    app(`/contracts/${slip.mga_reference}`);
    await screen.findByRole('alert'); fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    fireEvent.change(await screen.findByLabelText(/Effective as at/), { target: { value: '2026-11-10' } });
    expect(screen.getByText('Loading the selected position…')).toBeInTheDocument();
    await screen.findByRole('alert'); fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getAllByText('INR 140,000.00').length).toBeGreaterThan(0));
    expect(get).toHaveBeenLastCalledWith(slip.mga_reference, { as_at: '2026-11-10' }, expect.any(AbortSignal));
    expect(screen.queryByLabelText(/As known at/)).not.toBeInTheDocument();
  });
  it.each(['DRAFT', 'AGREED'] as const)('saves %s endorsements, refreshes history and retains data on remount', async status => {
    const saved = { ...endorsement, status };
    const get = vi.spyOn(api, 'getContract').mockResolvedValueOnce(details).mockResolvedValue({ ...details, endorsements: [saved] });
    const post = vi.spyOn(api, 'createEndorsement').mockResolvedValue(saved);
    const view = app(`/contracts/${slip.mga_reference}`);
    fireEvent.click(await screen.findByRole('button', { name: '+ Add endorsement' }));
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: status } });
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'New warehouse' } });
    fireEvent.click(screen.getByRole('button', { name: status === 'DRAFT' ? 'Save draft' : 'Add agreed endorsement' }));
    const tab = await screen.findByRole('tab', { name: 'Endorsements (1)' }); fireEvent.click(tab);
    expect(screen.getByText('New warehouse')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(status === 'DRAFT' ? 'does not affect' : 'Agreed endorsement #1 added');
    expect(post).toHaveBeenCalledOnce(); expect(get).toHaveBeenCalledTimes(2);
    view.unmount(); app(`/contracts/${slip.mga_reference}`);
    fireEvent.click(await screen.findByRole('tab', { name: 'Endorsements (1)' }));
    expect(screen.getByText('New warehouse')).toBeInTheDocument();
  });
  it('supports keyboard tab navigation and restores focus after cancelling endorsement entry', async () => {
    vi.spyOn(api, 'getContract').mockResolvedValue(details);
    app(`/contracts/${slip.mga_reference}`);
    const positionTab = await screen.findByRole('tab', { name: 'Position' });
    fireEvent.keyDown(positionTab, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Endorsements (0)' })).toHaveFocus();
    expect(screen.getByText('No endorsements yet')).toBeVisible();
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Endorsements (0)' }), { key: 'Home' });
    expect(positionTab).toHaveFocus();
    fireEvent.keyDown(positionTab, { key: 'End' });
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Endorsements (0)' }), { key: 'ArrowLeft' });
    expect(positionTab).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: '+ Add endorsement' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '+ Add endorsement' })).toHaveFocus());
  });
});
