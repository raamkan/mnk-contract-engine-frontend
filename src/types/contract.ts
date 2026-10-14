// Django returns exact decimal values as strings.
export type DecimalString = string;

// API date format: YYYY-MM-DD.
export type DateString = string;
export type ContractStatus = "BOUND" | "CANCELLED";
export type EndorsementStatus = "DRAFT" | "AGREED";

export interface CreateContractInput {
  mga_reference: string;
  insured_name: string;
  class_of_business: string;
  inception_date: DateString;
  expiry_date: DateString;
  currency: string;
  sum_insured: DecimalString;
  gross_premium: DecimalString;
  brokerage_pct: DecimalString;
  signed_line_pct: DecimalString;
}

export interface ContractSlip extends CreateContractInput {
  status: "BOUND";
}

export interface ContractPosition {
  mga_reference: string;
  as_at: DateString;
  insured_name: string;
  status: ContractStatus;

  inception_date: DateString;
  expiry_date: DateString;
  cancellation_effective_date: DateString | null;

  currency: string;
  sum_insured: DecimalString;
  gross_premium: DecimalString;
  net_premium: DecimalString;
  our_net_premium: DecimalString;

  applied_endorsements: number[];
}

interface EndorsementBase {
  endorsement_number: number;
  status: EndorsementStatus;
  effective_date: DateString;
  recorded_date: DateString;
  reason: string;
}

export type CreateEndorsementInput = EndorsementBase &
  (
    | {
        type: "CHANGE_SUM_INSURED";
        premium_change: DecimalString;
        changes: {
          sum_insured: DecimalString;
        };
      }
    | {
        type: "CHANGE_DETAILS";
        premium_change: DecimalString;
        changes: {
          insured_name: string;
        };
      }
    | {
        type: "PREMIUM_ADJUSTMENT";
        premium_change: DecimalString;
        changes: Record<string, never>;
      }
    | {
        type: "EXTENSION";
        premium_change: DecimalString;
        changes: {
          expiry_date: DateString;
        };
      }
    | {
        type: "CANCELLATION";
        premium_change: null;
        changes: Record<string, never>;
      }
  );

type NonCancellationInput = Exclude<
  CreateEndorsementInput,
  { type: "CANCELLATION" }
>;

type CancellationInput = Extract<
  CreateEndorsementInput,
  { type: "CANCELLATION" }
>;

// The server calculates cancellation premium before returning it.
export type Endorsement =
  | NonCancellationInput
  | (Omit<CancellationInput, "premium_change"> & {
      premium_change: DecimalString;
    });


export interface ContractDetails {
  slip: ContractSlip;
  endorsements: Endorsement[];
  current_position: ContractPosition;
}

export interface PositionQuery {
  as_at?: DateString;
  known_at?: DateString;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export type ContractsListResponse =
  | ContractSlip[]
  | PaginatedResponse<ContractSlip>;
