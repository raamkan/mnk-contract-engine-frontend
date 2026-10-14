import type { FormEvent } from "react";
import { useState } from "react";

import { ApiError, getErrorMessage } from "../../api/client";

import type { FieldErrors } from "../../api/client";
import type {
  CreateEndorsementInput,
  EndorsementStatus,
} from "../../types/contract";

type EndorsementType = CreateEndorsementInput["type"];

interface EndorsementFormProps {
  suggestedNumber: number;
  currency: string;
  onSubmit: (input: CreateEndorsementInput) => Promise<void>;
  onCancel: () => void;
}

interface FormValues {
  type: EndorsementType;
  status: EndorsementStatus;
  endorsementNumber: string;
  effectiveDate: string;
  recordedDate: string;
  premiumChange: string;
  sumInsured: string;
  insuredName: string;
  expiryDate: string;
  reason: string;
}

function localToday(): string {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// Called after validation; no floating-point conversion.
function normalizeDecimal(value: string): string {
  const [whole, fraction = ""] = value.trim().split(".");
  return `${whole}.${fraction.padEnd(2, "0")}`;
}

function buildPayload(values: FormValues): CreateEndorsementInput {
  const base = {
    endorsement_number: Number(values.endorsementNumber),
    status: values.status,
    effective_date: values.effectiveDate,
    recorded_date: values.recordedDate,
    reason: values.reason.trim(),
  };

  switch (values.type) {
    case "CHANGE_SUM_INSURED":
      return {
        ...base,
        type: values.type,
        premium_change: normalizeDecimal(values.premiumChange),
        changes: {
          sum_insured: normalizeDecimal(values.sumInsured),
        },
      };

    case "CHANGE_DETAILS":
      return {
        ...base,
        type: values.type,
        premium_change: normalizeDecimal(values.premiumChange),
        changes: {
          insured_name: values.insuredName.trim(),
        },
      };

    case "PREMIUM_ADJUSTMENT":
      return {
        ...base,
        type: values.type,
        premium_change: normalizeDecimal(values.premiumChange),
        changes: {},
      };

    case "EXTENSION":
      return {
        ...base,
        type: values.type,
        premium_change: normalizeDecimal(values.premiumChange),
        changes: {
          expiry_date: values.expiryDate,
        },
      };

    case "CANCELLATION":
      return {
        ...base,
        type: values.type,
        premium_change: null,
        changes: {},
      };
  }
}

function validate(values: FormValues): FieldErrors {
  const errors: FieldErrors = {};

  const number = Number(values.endorsementNumber);

  if (
    !/^[1-9]\d*$/.test(values.endorsementNumber) ||
    !Number.isSafeInteger(number)
  ) {
    errors.endorsement_number = ["Enter a valid positive whole number."];
  }

  if (!values.effectiveDate) {
    errors.effective_date = ["Select an effective date."];
  }

  if (!values.recordedDate) {
    errors.recorded_date = ["Select a recorded date."];
  }

  if (
    values.type !== "CANCELLATION" &&
    !/^-?\d+(?:\.\d{1,2})?$/.test(values.premiumChange.trim())
  ) {
    errors.premium_change = ["Enter an amount with up to two decimal places."];
  }

  if (
    values.type === "CHANGE_SUM_INSURED" &&
    !/^\d+(?:\.\d{1,2})?$/.test(values.sumInsured.trim())
  ) {
    errors["changes.sum_insured"] = [
      "Enter a non-negative amount with up to two decimal places.",
    ];
  }

  if (values.type === "CHANGE_DETAILS" && !values.insuredName.trim()) {
    errors["changes.insured_name"] = ["Enter the new insured name."];
  }

  if (values.type === "EXTENSION" && !values.expiryDate) {
    errors["changes.expiry_date"] = ["Select the new expiry date."];
  }

  return errors;
}

export default function EndorsementForm({
  suggestedNumber,
  currency,
  onSubmit,
  onCancel,
}: EndorsementFormProps) {
  const [values, setValues] = useState<FormValues>(() => ({
    type: "PREMIUM_ADJUSTMENT",
    status: "DRAFT",
    endorsementNumber: String(suggestedNumber),
    effectiveDate: localToday(),
    recordedDate: localToday(),
    premiumChange: "0.00",
    sumInsured: "",
    insuredName: "",
    expiryDate: "",
    reason: "",
  }));

  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof FormValues>(name: K, value: FormValues[K]) {
    setValues((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function errorId(name: string) {
    return `endorsement-error-${name.replaceAll(".", "-")}`;
  }

  function fieldAttributes(name: string) {
    const hasError = Boolean(errors[name]?.length);

    return {
      "aria-invalid": hasError,
      "aria-describedby": hasError ? errorId(name) : undefined,
      "data-error-key": name,
    };
  }

  function renderError(name: string) {
    if (!errors[name]?.length) {
      return null;
    }

    return (
      <span className="field-error" id={errorId(name)}>
        {errors[name].join(" ")}
      </span>
    );
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

    setSubmitting(true);

    try {
      await onSubmit(buildPayload(values));
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

  function focusFirstError(form: HTMLFormElement, fieldErrors: FieldErrors) {
    // Wait until React has updated the errors and enabled fields.
    requestAnimationFrame(() => {
      const controls = form.querySelectorAll<HTMLElement>("[data-error-key]");

      const firstInvalid = Array.from(controls).find((control) =>
        Boolean(fieldErrors[control.dataset.errorKey ?? ""]),
      );

      firstInvalid?.focus();
    });
  }

  const displayedErrorKeys = new Set([
    "type",
    "status",
    "endorsement_number",
    "effective_date",
    "recorded_date",
    "reason",
    ...(values.type !== "CANCELLATION" ? ["premium_change"] : []),
    ...(values.type === "CHANGE_SUM_INSURED" ? ["changes.sum_insured"] : []),
    ...(values.type === "CHANGE_DETAILS" ? ["changes.insured_name"] : []),
    ...(values.type === "EXTENSION" ? ["changes.expiry_date"] : []),
  ]);

  const otherErrors = Object.entries(errors).filter(
    ([key]) => !displayedErrorKeys.has(key),
  );

  return (
    <section
      className="panel endorsement-form-panel"
      aria-labelledby="add-endorsement-heading"
    >
      <div className="panel-header">
        <div>
          <h2 id="add-endorsement-heading">Add endorsement</h2>
          <p className="secondary-text">
            Changes are recorded separately from the original slip.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {submitError && (
          <div className="form-error-summary" role="alert">
            <p>{submitError}</p>

            {otherErrors.length > 0 && (
              <ul>
                {otherErrors.map(([key, messages]) => (
                  <li key={key}>{messages.join(" ")}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <fieldset className="endorsement-fields" disabled={submitting}>
          <legend className="sr-only">Endorsement details</legend>

          <label className="form-field">
            <span>What is changing?</span>

            <select
              autoFocus
              value={values.type}
              {...fieldAttributes("type")}
              onChange={(event) => {
                update("type", event.target.value as EndorsementType);
                setErrors({});
                setSubmitError(null);
              }}
            >
              <option value="PREMIUM_ADJUSTMENT">Premium adjustment</option>
              <option value="CHANGE_SUM_INSURED">Sum insured</option>
              <option value="CHANGE_DETAILS">Insured name</option>
              <option value="EXTENSION">Cover extension</option>
              <option value="CANCELLATION">Cancellation</option>
            </select>

            {renderError("type")}
          </label>

          <label className="form-field">
            <span>Status</span>

            <select
              value={values.status}
              {...fieldAttributes("status")}
              onChange={(event) =>
                update("status", event.target.value as EndorsementStatus)
              }
            >
              <option value="DRAFT">Draft · Not applied</option>
              <option value="AGREED">
                Agreed · Applies from effective date
              </option>
            </select>

            {renderError("status")}
          </label>

          <label className="form-field">
            <span>Endorsement number</span>

            <input
              type="text"
              inputMode="numeric"
              value={values.endorsementNumber}
              {...fieldAttributes("endorsement_number")}
              onChange={(event) =>
                update("endorsementNumber", event.target.value)
              }
            />

            {renderError("endorsement_number")}
          </label>

          <label className="form-field">
            <span>Effective date</span>

            <input
              type="date"
              value={values.effectiveDate}
              {...fieldAttributes("effective_date")}
              onChange={(event) => update("effectiveDate", event.target.value)}
            />

            {renderError("effective_date")}
          </label>

          <label className="form-field">
            <span>Recorded date</span>

            <input
              type="date"
              value={values.recordedDate}
              {...fieldAttributes("recorded_date")}
              onChange={(event) => update("recordedDate", event.target.value)}
            />

            {renderError("recorded_date")}
          </label>

          {values.type !== "CANCELLATION" && (
            <label className="form-field">
              <span>Premium change ({currency})</span>

              <input
                type="text"
                inputMode="decimal"
                value={values.premiumChange}
                {...fieldAttributes("premium_change")}
                onChange={(event) =>
                  update("premiumChange", event.target.value)
                }
              />

              <span className="secondary-text">
                Positive for additional premium; negative for a return.
              </span>

              {renderError("premium_change")}
            </label>
          )}

          {values.type === "CHANGE_SUM_INSURED" && (
            <label className="form-field">
              <span>New sum insured ({currency})</span>

              <input
                type="text"
                inputMode="decimal"
                value={values.sumInsured}
                {...fieldAttributes("changes.sum_insured")}
                onChange={(event) => update("sumInsured", event.target.value)}
              />

              {renderError("changes.sum_insured")}
            </label>
          )}

          {values.type === "CHANGE_DETAILS" && (
            <label className="form-field">
              <span>New insured name</span>

              <input
                type="text"
                value={values.insuredName}
                {...fieldAttributes("changes.insured_name")}
                onChange={(event) => update("insuredName", event.target.value)}
              />

              {renderError("changes.insured_name")}
            </label>
          )}

          {values.type === "EXTENSION" && (
            <label className="form-field">
              <span>New expiry date</span>

              <input
                type="date"
                value={values.expiryDate}
                {...fieldAttributes("changes.expiry_date")}
                onChange={(event) => update("expiryDate", event.target.value)}
              />

              {renderError("changes.expiry_date")}
            </label>
          )}

          <label className="form-field form-field--full">
            <span>Reason</span>

            <textarea
              rows={3}
              value={values.reason}
              {...fieldAttributes("reason")}
              onChange={(event) => update("reason", event.target.value)}
              placeholder="Describe why this change is needed."
            />

            {renderError("reason")}
          </label>
        </fieldset>

        <div className="form-guidance">
          {values.type === "CANCELLATION" && (
            <p>
              Django calculates the return premium. For an agreed cancellation,
              cover ends the day before the effective date.
            </p>
          )}

          <p>
            {values.status === "DRAFT"
              ? "This draft will be saved in history without changing the contract position."
              : "This agreed endorsement will affect positions where its effective date applies."}
          </p>
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="button-secondary"
            disabled={submitting}
            onClick={onCancel}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="button-primary"
            disabled={submitting}
          >
            {submitting
              ? "Saving…"
              : values.status === "DRAFT"
                ? "Save draft"
                : "Add agreed endorsement"}
          </button>
        </div>
      </form>
    </section>
  );
}
