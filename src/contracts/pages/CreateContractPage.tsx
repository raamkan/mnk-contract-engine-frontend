import type { FormEvent } from "react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import type { FieldErrors } from "../../api/client";
import { ApiError, getErrorMessage } from "../../api/client";

import { createContract } from "../../api/contracts";
import type { CreateContractInput } from "../../types/contract";

const INITIAL_VALUES: CreateContractInput = {
  mga_reference: "",
  insured_name: "",
  class_of_business: "",
  inception_date: "",
  expiry_date: "",
  currency: "GBP",
  sum_insured: "",
  gross_premium: "",
  brokerage_pct: "0.00",
  signed_line_pct: "100.00",
};

type ContractField = keyof CreateContractInput;

const MONEY_PATTERN = /^\d+(?:\.\d{1,2})?$/;

function normalizeDecimal(value: string): string {
  const [whole, fraction = ""] = value.trim().split(".");
  return `${whole}.${fraction.padEnd(2, "0")}`;
}

// Used only for validating percentage bounds.
// All arithmetic stays in integers.
function percentageInHundredths(value: string): bigint {
  const [whole, fraction = ""] = value.trim().split(".");

  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}

function validate(values: CreateContractInput): FieldErrors {
  const errors: FieldErrors = {};

  const requiredTextFields = [
    ["mga_reference", "Enter an MGA reference."],
    ["insured_name", "Enter the insured name."],
    ["class_of_business", "Enter the class of business."],
  ] as const;

  for (const [field, message] of requiredTextFields) {
    if (!values[field].trim()) {
      errors[field] = [message];
    }
  }

  if (!values.inception_date) {
    errors.inception_date = ["Select an inception date."];
  }

  if (!values.expiry_date) {
    errors.expiry_date = ["Select an expiry date."];
  }

  if (
    values.inception_date &&
    values.expiry_date &&
    values.expiry_date < values.inception_date
  ) {
    errors.expiry_date = ["Expiry must be on or after inception."];
  }

  if (!/^[A-Z]{3}$/.test(values.currency.trim().toUpperCase())) {
    errors.currency = [
      "Enter a three-letter currency code, such as GBP or USD.",
    ];
  }

  for (const field of ["sum_insured", "gross_premium"] as const) {
    if (!MONEY_PATTERN.test(values[field].trim())) {
      errors[field] = [
        "Enter a non-negative amount with up to two decimal places.",
      ];
    }
  }

  for (const field of ["brokerage_pct", "signed_line_pct"] as const) {
    const value = values[field].trim();

    if (!MONEY_PATTERN.test(value)) {
      errors[field] = ["Enter a percentage with up to two decimal places."];
      continue;
    }

    if (percentageInHundredths(value) > 10000n) {
      errors[field] = ["Enter a percentage between 0 and 100."];
    }
  }

  return errors;
}

export default function CreateContractPage() {
  const navigate = useNavigate();

  const [values, setValues] = useState<CreateContractInput>(INITIAL_VALUES);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update(field: ContractField, value: string) {
    setValues((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function errorId(field: string) {
    return `contract-error-${field}`;
  }

  function fieldAttributes(field: ContractField) {
    const hasError = Boolean(errors[field]?.length);

    return {
      "aria-invalid": hasError,
      "aria-describedby": hasError ? errorId(field) : undefined,
      "data-error-key": field,
    };
  }

  function renderError(field: ContractField) {
    if (!errors[field]?.length) {
      return null;
    }

    return (
      <span className="field-error" id={errorId(field)}>
        {errors[field].join(" ")}
      </span>
    );
  }

  function focusFirstError(form: HTMLFormElement, fieldErrors: FieldErrors) {
    requestAnimationFrame(() => {
      const controls = form.querySelectorAll<HTMLElement>("[data-error-key]");

      const firstInvalid = Array.from(controls).find((control) =>
        Boolean(fieldErrors[control.dataset.errorKey ?? ""]),
      );

      firstInvalid?.focus();
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    const form = event.currentTarget;
    const validationErrors = validate(values);

    setErrors(validationErrors);
    setSubmitError(null);

    if (Object.keys(validationErrors).length > 0) {
      setSubmitError("Please check the highlighted fields.");
      focusFirstError(form, validationErrors);
      return;
    }

    const input: CreateContractInput = {
      ...values,
      mga_reference: values.mga_reference.trim(),
      insured_name: values.insured_name.trim(),
      class_of_business: values.class_of_business.trim(),
      currency: values.currency.trim().toUpperCase(),
      sum_insured: normalizeDecimal(values.sum_insured),
      gross_premium: normalizeDecimal(values.gross_premium),
      brokerage_pct: normalizeDecimal(values.brokerage_pct),
      signed_line_pct: normalizeDecimal(values.signed_line_pct),
    };

    setSubmitting(true);

    try {
      const created = await createContract(input);

      navigate(`/contracts/${encodeURIComponent(created.mga_reference)}`, {
        replace: true,
      });
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors);
        focusFirstError(form, error.fieldErrors);
      }

      setSubmitError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  const displayedFields = new Set(Object.keys(INITIAL_VALUES));

  const otherErrors = Object.entries(errors).filter(
    ([field]) => !displayedFields.has(field),
  );

  return (
    <>
      <Link className="back-link" to="/contracts">
        ← All contracts
      </Link>

      <div className="page-header">
        <div>
          <p className="eyebrow">New contract</p>
          <h1>Create original slip</h1>

          <p className="page-description">
            Enter the agreed contract terms. Later changes will be recorded as
            endorsements.
          </p>
        </div>
      </div>

      <section className="panel" aria-labelledby="create-contract-heading">
        <div className="panel-header">
          <h2 id="create-contract-heading">Contract details</h2>
          <span className="badge">Initial status: Bound</span>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {submitError && (
            <div className="form-error-summary" role="alert">
              <p>{submitError}</p>

              {otherErrors.length > 0 && (
                <ul>
                  {otherErrors.map(([field, messages]) => (
                    <li key={field}>{messages.join(" ")}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <fieldset className="endorsement-fields" disabled={submitting}>
            <legend className="sr-only">Original slip details</legend>

            <label className="form-field">
              <span>MGA reference</span>

              <input
                autoFocus
                type="text"
                value={values.mga_reference}
                placeholder="MNK-PR-2026-005"
                {...fieldAttributes("mga_reference")}
                onChange={(event) =>
                  update("mga_reference", event.target.value)
                }
              />

              {renderError("mga_reference")}
            </label>

            <label className="form-field">
              <span>Insured name</span>

              <input
                type="text"
                value={values.insured_name}
                placeholder="Westbridge Logistics Ltd"
                {...fieldAttributes("insured_name")}
                onChange={(event) => update("insured_name", event.target.value)}
              />

              {renderError("insured_name")}
            </label>

            <label className="form-field">
              <span>Class of business</span>

              <input
                type="text"
                value={values.class_of_business}
                placeholder="Property"
                {...fieldAttributes("class_of_business")}
                onChange={(event) =>
                  update("class_of_business", event.target.value)
                }
              />

              {renderError("class_of_business")}
            </label>

            <label className="form-field">
              <span>Currency</span>

              <input
                type="text"
                maxLength={3}
                value={values.currency}
                placeholder="GBP"
                {...fieldAttributes("currency")}
                onChange={(event) =>
                  update("currency", event.target.value.toUpperCase())
                }
              />

              {renderError("currency")}
            </label>

            <label className="form-field">
              <span>Inception date</span>

              <input
                type="date"
                value={values.inception_date}
                {...fieldAttributes("inception_date")}
                onChange={(event) =>
                  update("inception_date", event.target.value)
                }
              />

              {renderError("inception_date")}
            </label>

            <label className="form-field">
              <span>Expiry date</span>

              <input
                type="date"
                value={values.expiry_date}
                {...fieldAttributes("expiry_date")}
                onChange={(event) => update("expiry_date", event.target.value)}
              />

              {renderError("expiry_date")}
            </label>

            <label className="form-field">
              <span>Sum insured</span>

              <input
                type="text"
                inputMode="decimal"
                value={values.sum_insured}
                placeholder="5000000.00"
                {...fieldAttributes("sum_insured")}
                onChange={(event) => update("sum_insured", event.target.value)}
              />

              {renderError("sum_insured")}
            </label>

            <label className="form-field">
              <span>Gross premium</span>

              <input
                type="text"
                inputMode="decimal"
                value={values.gross_premium}
                placeholder="120000.00"
                {...fieldAttributes("gross_premium")}
                onChange={(event) =>
                  update("gross_premium", event.target.value)
                }
              />

              {renderError("gross_premium")}
            </label>

            <label className="form-field">
              <span>Brokerage (%)</span>

              <input
                type="text"
                inputMode="decimal"
                value={values.brokerage_pct}
                {...fieldAttributes("brokerage_pct")}
                onChange={(event) =>
                  update("brokerage_pct", event.target.value)
                }
              />

              {renderError("brokerage_pct")}
            </label>

            <label className="form-field">
              <span>Signed line (%)</span>

              <input
                type="text"
                inputMode="decimal"
                value={values.signed_line_pct}
                {...fieldAttributes("signed_line_pct")}
                onChange={(event) =>
                  update("signed_line_pct", event.target.value)
                }
              />

              <span className="secondary-text">
                Our percentage share of the contract.
              </span>

              {renderError("signed_line_pct")}
            </label>
          </fieldset>

          <div className="form-guidance">
            Review the terms before creating the slip. Once created, the
            original slip cannot be edited.
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="button-secondary"
              disabled={submitting}
              onClick={() => navigate("/contracts")}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="button-primary"
              disabled={submitting}
            >
              {submitting ? "Creating…" : "Create contract"}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
