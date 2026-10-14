import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ContractPositionPanel from '../contracts/components/ContractPositionPanel';
import EndorsementsTable from '../contracts/components/EndorsementsTable';
import { formatAmount, formatDate } from '../utils/format';
import { endorsement, position, slip } from './fixtures';
import type { ContractPosition } from '../types/contract';

// These are API response fixtures. Django's suites verify eligibility and arithmetic;
// these checks verify that the frontend renders the returned position faithfully.
const scenarios: [string, Partial<ContractPosition>, string, string, string][] = [
  ['original at inception', {}, '120,000.00', '96,000.00', '24,000.00'],
  ['before endorsement', { as_at: '2026-11-09' }, '120,000.00', '96,000.00', '24,000.00'],
  ['sum insured on effective date', { as_at: '2026-11-10', sum_insured: '6000000.00', gross_premium: '140000.00', net_premium: '112000.00', our_net_premium: '28000.00', applied_endorsements: [1] }, '140,000.00', '112,000.00', '28,000.00'],
  ['draft excluded', { as_at: '2026-11-15', gross_premium: '140000.00', net_premium: '112000.00', our_net_premium: '28000.00', applied_endorsements: [1] }, '140,000.00', '112,000.00', '28,000.00'],
  ['insured name changed', { as_at: '2026-11-20', insured_name: 'Raman Logistics Group Ltd', gross_premium: '140000.00', net_premium: '112000.00', our_net_premium: '28000.00', applied_endorsements: [1, 3] }, '140,000.00', '112,000.00', '28,000.00'],
  ['before extension', { as_at: '2026-11-30', gross_premium: '140000.00', net_premium: '112000.00', our_net_premium: '28000.00' }, '140,000.00', '112,000.00', '28,000.00'],
  ['extension effective', { as_at: '2026-12-01', expiry_date: '2027-06-30', gross_premium: '150000.00', net_premium: '120000.00', our_net_premium: '30000.00', applied_endorsements: [1, 3, 4] }, '150,000.00', '120,000.00', '30,000.00'],
  ['before extended-period return', { as_at: '2027-01-09', expiry_date: '2027-06-30', gross_premium: '150000.00', net_premium: '120000.00', our_net_premium: '30000.00' }, '150,000.00', '120,000.00', '30,000.00'],
  ['extended-period return', { as_at: '2027-01-10', expiry_date: '2027-06-30', gross_premium: '140000.00', net_premium: '112000.00', our_net_premium: '28000.00', applied_endorsements: [1, 3, 4, 5] }, '140,000.00', '112,000.00', '28,000.00'],
  ['before cancellation', { as_at: '2027-01-31', expiry_date: '2027-06-30', gross_premium: '140000.00', net_premium: '112000.00', our_net_premium: '28000.00' }, '140,000.00', '112,000.00', '28,000.00'],
  ['cancellation effective', { as_at: '2027-02-01', status: 'CANCELLED', expiry_date: '2027-01-31', cancellation_effective_date: '2027-02-01', gross_premium: '60454.55', net_premium: '48363.64', our_net_premium: '12090.91', applied_endorsements: [1, 3, 4, 5, 6] }, '60,454.55', '48,363.64', '12,090.91'],
  ['exact zero balance', { gross_premium: '0.00', net_premium: '0.00', our_net_premium: '0.00' }, '0.00', '0.00', '0.00'],
  ['before inception', { as_at: '2026-10-09' }, '120,000.00', '96,000.00', '24,000.00'],
  ['after normal expiry', { as_at: '2027-01-01' }, '120,000.00', '96,000.00', '24,000.00'],
];
describe('Documented position scenarios', () => {
  it.each(scenarios)('renders %s while preserving original terms', (_name, overrides, gross, net, ourNet) => {
    const selected = { ...position, ...overrides };
    render(<ContractPositionPanel slip={slip} position={selected} />);
    const comparison = screen.getByRole('table');
    const originalGrossRow = within(comparison).getByRole('row', { name: /Gross premium/ });
    expect(within(originalGrossRow).getAllByRole('cell')[0]).toHaveTextContent('INR 120,000.00');
    const financial = screen.getByRole('region', { name: /Premium breakdown/ });
    expect(financial).toHaveTextContent(`INR ${gross}`);
    expect(financial).toHaveTextContent(`INR ${net}`);
    expect(financial).toHaveTextContent(`INR ${ourNet}`);
    expect(screen.getByText(/Applied endorsements:/)).toHaveTextContent(selected.applied_endorsements.length ? selected.applied_endorsements.map(n => `#${n}`).join(', ') : 'None');
    if (selected.status === 'CANCELLED') {
      expect(screen.getByText('Cover is cancelled at this position.')).toBeInTheDocument();
      expect(screen.getByText(/Last covered day/)).toHaveTextContent('31 Jan 2027');
      expect(within(comparison).getByRole('row', { name: /Status/ })).toHaveTextContent('Bound');
    }
    if (selected.as_at < slip.inception_date) expect(screen.getByText(/This date is before inception/)).toBeInTheDocument();
  });
  it('filters changed fields and displays an empty comparison when unchanged', () => {
    const { rerender } = render(<ContractPositionPanel slip={slip} position={position} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Changes only' }));
    expect(screen.getByText('No differences from the original slip.')).toBeInTheDocument();
    rerender(<ContractPositionPanel slip={slip} position={{ ...position, insured_name: 'Group Ltd' }} />);
    expect(screen.getByRole('row', { name: /Insured name/ })).toHaveTextContent('Group Ltd');
    expect(screen.queryByRole('row', { name: /Cover start/ })).not.toBeInTheDocument();
  });
});
describe('Endorsement history', () => {
  it('shows empty history', () => {
    render(<EndorsementsTable endorsements={[]} position={position} />);
    expect(screen.getByText('No endorsements yet')).toBeInTheDocument();
  });
  it('sorts without mutating, distinguishes all application states and formats signed premiums', () => {
    const records = [
      { ...endorsement, endorsement_number: 4, effective_date: '2026-10-10', premium_change: '-10.00', reason: '' },
      { ...endorsement, endorsement_number: 2, status: 'DRAFT' as const, premium_change: '-0.00' },
      { ...endorsement, endorsement_number: 3, effective_date: '2027-01-10' },
      endorsement,
    ];
    render(<EndorsementsTable endorsements={records} position={{ ...position, as_at: '2026-11-10', applied_endorsements: [1] }} />);
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.map(row => within(row).getAllByRole('cell')[0].textContent)).toEqual(['#1', '#2', '#3', '#4']);
    expect(rows[0]).toHaveTextContent('Applied'); expect(rows[0]).toHaveTextContent('Backdated');
    expect(rows[0]).toHaveTextContent('+20,000.00'); expect(rows[1]).toHaveTextContent('Not applied · Draft');
    expect(rows[1]).toHaveTextContent('0.00'); expect(rows[2]).toHaveTextContent('Not yet effective');
    expect(rows[3]).toHaveTextContent('Not applied at this position'); expect(rows[3]).toHaveTextContent('-10.00');
    expect(rows[3]).toHaveTextContent('No reason provided'); expect(records[0].endorsement_number).toBe(4);
  });
});
describe('Exact display formatting', () => {
  it.each([['120000', '120,000.00'], ['-79545.45', '-79,545.45'], ['0.5', '0.50'], ['9007199254740993.01', '9,007,199,254,740,993.01'], ['1.234', '1.234'], ['NaN', 'NaN']])('formats %s without floating point rounding', (input, expected) => expect(formatAmount(input)).toBe(expected));
  it.each([['2026-10-10', '10 Oct 2026'], ['2027-02-01', '01 Feb 2027'], ['', ''], ['invalid', 'invalid'], ['2026-13-01', '2026-13-01']])('formats date %s', (input, expected) => expect(formatDate(input)).toBe(expected));
});
