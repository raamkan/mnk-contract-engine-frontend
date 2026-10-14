import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import CreateContractPage from '../contracts/pages/CreateContractPage';
import EndorsementForm from '../contracts/components/EndorsementForm';
import { ApiError } from '../api/client';
import * as api from '../api/contracts';
import { deferred, slip } from './fixtures';

function change(label: string | RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
function createForm() {
  render(<MemoryRouter initialEntries={['/contracts/new']}><Routes>
    <Route path="/contracts/new" element={<CreateContractPage />} />
    <Route path="/contracts/:reference" element={<p>Created detail</p>} />
    <Route path="/contracts" element={<p>Contract list</p>} />
  </Routes></MemoryRouter>);
}
function fillContract() {
  for (const [label, value] of Object.entries({
    'MGA reference': ' MNK-REVIEW-001 ', 'Insured name': ' Raman Logistics Ltd ',
    'Class of business': ' Property ', Currency: 'inr', 'Inception date': '2026-10-10',
    'Expiry date': '2026-12-31', 'Sum insured': '5000000', 'Gross premium': '120000',
    'Brokerage (%)': '20', 'Signed line (%)': '25',
  })) change(new RegExp(`^${label.replace(/[()]/g, '\\$&')}`), value);
}
describe('Original slip form', () => {
  it('shows required errors and focuses the first invalid field without posting', async () => {
    const post = vi.spyOn(api, 'createContract');
    createForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create contract' }));
    expect(screen.getByRole('alert')).toHaveTextContent('highlighted');
    expect(screen.getByText('Enter the insured name.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText(/MGA reference/)).toHaveFocus());
    expect(post).not.toHaveBeenCalled();
  });
  it.each([
    ['Gross premium', '-1', 'non-negative'], ['Sum insured', '1.234', 'non-negative'],
    ['Brokerage (%)', '101', 'between 0 and 100'], ['Signed line (%)', '100.01', 'between 0 and 100'],
    ['Brokerage (%)', '-1', 'up to two decimal places'], ['Signed line (%)', 'abc', 'up to two decimal places'],
    ['Currency', 'AB', 'three-letter'], ['Expiry date', '2026-10-09', 'on or after inception'],
  ])('blocks invalid %s = %s', (label, value, message) => {
    const post = vi.spyOn(api, 'createContract');
    createForm(); fillContract(); change(label === 'Signed line (%)' ? /^Signed line/ : label, value);
    fireEvent.click(screen.getByRole('button', { name: 'Create contract' }));
    expect(screen.getByText(new RegExp(message))).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });
  it('trims text, normalizes exact decimal strings, prevents duplicate submissions and navigates', async () => {
    const pending = deferred<typeof slip>();
    const post = vi.spyOn(api, 'createContract').mockReturnValue(pending.promise);
    createForm(); fillContract();
    fireEvent.click(screen.getByRole('button', { name: 'Create contract' }));
    expect(post).toHaveBeenCalledWith(expect.objectContaining({ mga_reference: slip.mga_reference, currency: 'INR', sum_insured: '5000000.00', gross_premium: '120000.00', brokerage_pct: '20.00', signed_line_pct: '25.00' }));
    expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled();
    pending.resolve(slip);
    expect(await screen.findByText('Created detail')).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
  });
  it('surfaces duplicate reference and other backend errors, then allows retry', async () => {
    const post = vi.spyOn(api, 'createContract').mockRejectedValueOnce(new ApiError('Invalid', 400, {
      mga_reference: ['Reference already exists'], non_field_errors: ['Invalid terms'],
    })).mockResolvedValue(slip);
    createForm(); fillContract(); fireEvent.click(screen.getByRole('button', { name: 'Create contract' }));
    expect(await screen.findByText('Reference already exists')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid terms');
    await waitFor(() => expect(screen.getByLabelText(/MGA reference/)).toHaveFocus());
    fireEvent.click(screen.getByRole('button', { name: 'Create contract' }));
    expect(await screen.findByText('Created detail')).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(2);
  });
  it('allows cancelling without a request', async () => {
    const user = userEvent.setup();
    createForm(); await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Contract list')).toBeInTheDocument();
  });
});

function endorsementForm(onSubmit = vi.fn().mockResolvedValue(undefined), onCancel = vi.fn()) {
  render(<EndorsementForm suggestedNumber={7} currency="INR" onSubmit={onSubmit} onCancel={onCancel} />);
  return { onSubmit, onCancel };
}
describe('Endorsement form', () => {
  it.each([
    ['PREMIUM_ADJUSTMENT', null, null, {}],
    ['CHANGE_SUM_INSURED', /New sum insured/, '6000000', { sum_insured: '6000000.00' }],
    ['CHANGE_DETAILS', /New insured name/, ' Group Ltd ', { insured_name: 'Group Ltd' }],
    ['EXTENSION', /New expiry date/, '2027-06-30', { expiry_date: '2027-06-30' }],
    ['CANCELLATION', null, null, {}],
  ])('submits the correct %s payload for both statuses', async (type, label, value, changes) => {
    const { onSubmit } = endorsementForm();
    change(/What is changing/, type);
    if (label && value) change(label, value);
    change('Effective date', '2026-11-10'); change('Recorded date', '2027-02-14');
    change('Reason', ' Review change ');
    if (type !== 'CANCELLATION') change(/Premium change/, '-10.5');
    else expect(screen.queryByLabelText(/Premium change/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
      endorsement_number: 7, status: 'DRAFT', type, effective_date: '2026-11-10',
      recorded_date: '2027-02-14', reason: 'Review change', changes,
      premium_change: type === 'CANCELLATION' ? null : '-10.50',
    }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled());
    change('Status', 'AGREED');
    fireEvent.click(screen.getByRole('button', { name: 'Add agreed endorsement' }));
    await waitFor(() => expect(onSubmit).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'AGREED' })));
  });
  it.each([
    ['CHANGE_SUM_INSURED', /New sum insured/], ['CHANGE_DETAILS', /New insured name/], ['EXTENSION', /New expiry date/],
  ])('requires the extra field for %s and clears errors when switching type', (type, label) => {
    const { onSubmit } = endorsementForm(); change(/What is changing/, type);
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true');
    expect(onSubmit).not.toHaveBeenCalled();
    change(/What is changing/, 'CANCELLATION');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it.each(['0', '-1', '1.5', '01', '9007199254740992', 'abc'])('rejects invalid endorsement number %s', (value) => {
    const { onSubmit } = endorsementForm(); change('Endorsement number', value);
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(screen.getByText('Enter a valid positive whole number.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
  it.each(['', '1.234', 'NaN', 'Infinity'])('rejects invalid premium %s', (value) => {
    const { onSubmit } = endorsementForm(); change(/Premium change/, value);
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(screen.getByText('Enter an amount with up to two decimal places.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
  it('requires both dates and focuses the first missing date', async () => {
    endorsementForm(); change('Effective date', ''); change('Recorded date', '');
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(screen.getByText('Select a recorded date.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText(/Effective date/)).toHaveFocus());
  });
  it.each([
    ['duplicate number', 'endorsement_number', 'Duplicate number'],
    ['blank reason', 'reason', 'Reason is required'],
    ['outside cover', 'effective_date', 'Outside cover'],
    ['post cancellation', 'effective_date', 'Contract is cancelled'],
    ['conflicting cancellation', 'effective_date', 'Existing agreed changes conflict'],
    ['backdated refund change', 'effective_date', 'Would alter stored refund'],
    ['excessive return', 'premium_change', 'Gross cannot become negative'],
    ['invalid extension', 'changes.expiry_date', 'Must be later than current expiry'],
  ])('displays backend rejection for %s without reporting success', async (_scenario, field, message) => {
    const onSubmit = vi.fn().mockRejectedValue(new ApiError('Invalid endorsement', 400, { [field]: [message] }));
    endorsementForm(onSubmit);
    if (field === 'changes.expiry_date') {
      change(/What is changing/, 'EXTENSION'); change('New expiry date', '2026-12-31');
    }
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled());
  });
  it('blocks duplicate saves while pending and supports cancel', async () => {
    const pending = deferred<void>();
    const { onSubmit, onCancel } = endorsementForm(vi.fn().mockReturnValue(pending.promise));
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    pending.resolve();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce(); expect(onSubmit).toHaveBeenCalledOnce();
  });
});
