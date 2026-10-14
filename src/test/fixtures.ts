import type { ContractSlip, ContractPosition, Endorsement } from '../types/contract';

export const slip: ContractSlip = {
  mga_reference: 'MNK-REVIEW-001', insured_name: 'Raman Logistics Ltd',
  class_of_business: 'Property', currency: 'INR', status: 'BOUND',
  inception_date: '2026-10-10', expiry_date: '2026-12-31',
  sum_insured: '5000000.00', gross_premium: '120000.00',
  brokerage_pct: '20.00', signed_line_pct: '25.00',
};
export const position: ContractPosition = {
  ...slip, as_at: '2026-10-10', cancellation_effective_date: null,
  net_premium: '96000.00', our_net_premium: '24000.00', applied_endorsements: [],
};
export const endorsement: Endorsement = {
  endorsement_number: 1, type: 'PREMIUM_ADJUSTMENT', status: 'AGREED',
  effective_date: '2026-11-10', recorded_date: '2027-02-14',
  premium_change: '20000.00', changes: {}, reason: 'New warehouse',
};
export const details = { slip, current_position: position, endorsements: [] };
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
