import { useState } from "react";

import type { ContractPosition, ContractSlip } from "../../types/contract";

import { formatAmount, formatDate } from "../../utils/format";

interface ContractPositionPanelProps {
  slip: ContractSlip;
  position: ContractPosition;
}

interface ComparisonRow {
  label: string;
  original: string;
  amended: string;
  changed: boolean;
  numeric?: boolean;
}

export default function ContractPositionPanel({
  slip,
  position,
}: ContractPositionPanelProps) {
  const [changesOnly, setChangesOnly] = useState(false);

  const money = (value: string) =>
    `${position.currency} ${formatAmount(value)}`;

  const rows: ComparisonRow[] = [
    {
      label: "Insured name",
      original: slip.insured_name,
      amended: position.insured_name,
      changed: slip.insured_name !== position.insured_name,
    },
    {
      label: "Status",
      original: "Bound",
      amended: position.status === "CANCELLED" ? "Cancelled" : "Bound",
      changed: slip.status !== position.status,
    },
    {
      label: "Cover start",
      original: formatDate(slip.inception_date),
      amended: formatDate(position.inception_date),
      changed: slip.inception_date !== position.inception_date,
    },
    {
      label: "Cover end",
      original: formatDate(slip.expiry_date),
      amended: formatDate(position.expiry_date),
      changed: slip.expiry_date !== position.expiry_date,
    },
    {
      label: "Sum insured",
      original: money(slip.sum_insured),
      amended: money(position.sum_insured),
      changed:
        formatAmount(slip.sum_insured) !== formatAmount(position.sum_insured),
      numeric: true,
    },
    {
      label: "Gross premium",
      original: money(slip.gross_premium),
      amended: money(position.gross_premium),
      changed:
        formatAmount(slip.gross_premium) !==
        formatAmount(position.gross_premium),
      numeric: true,
    },
  ];

  const visibleRows = changesOnly ? rows.filter((row) => row.changed) : rows;

  const applied =
    position.applied_endorsements.map((number) => `#${number}`).join(", ") ||
    "None";

  return (
    <>
      {position.status === "CANCELLED" && (
        <div className="position-notice position-notice--warning">
          <strong>Cover is cancelled at this position.</strong>

          <p>
            {position.cancellation_effective_date
              ? `Effective ${formatDate(
                  position.cancellation_effective_date,
                )}. `
              : ""}
            Last covered day: {formatDate(position.expiry_date)}.
          </p>
        </div>
      )}

      {position.as_at < slip.inception_date && (
        <div className="position-notice">
          This date is before inception. The original slip is shown with no
          endorsements applied.
        </div>
      )}

      <section className="panel" aria-labelledby="comparison-heading">
        <div className="panel-header">
          <div>
            <h2 id="comparison-heading">Contract comparison</h2>

            <p className="secondary-text">
              Position as at {formatDate(position.as_at)}
            </p>
          </div>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={changesOnly}
              onChange={(event) => setChangesOnly(event.target.checked)}
            />
            Changes only
          </label>
        </div>

        <div className="table-container">
          <table className="data-table comparison-table">
            <caption className="sr-only">
              Original slip compared with the selected position
            </caption>

            <thead>
              <tr>
                <th scope="col">Field</th>

                <th scope="col">
                  Original slip
                  <span className="column-description">
                    Read-only · Bound at inception
                  </span>
                </th>

                <th scope="col">
                  As-amended position
                  <span className="column-description">
                    {formatDate(position.as_at)}
                  </span>
                </th>
              </tr>
            </thead>

            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>

                  <td className={row.numeric ? "numeric-value" : ""}>
                    {row.original}
                  </td>

                  <td className={row.numeric ? "numeric-value" : ""}>
                    <div className={row.changed ? "changed-value" : undefined}>
                      <span>{row.amended}</span>

                      {row.changed && (
                        <span className="change-label">Changed</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={3}>
                    <p className="comparison-empty" role="status">
                      No differences from the original slip.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          <p className="secondary-text">Applied endorsements: {applied}</p>
        </div>
      </section>

      <section
        className="panel financial-panel"
        aria-labelledby="financial-heading"
      >
        <div className="panel-header">
          <h2 id="financial-heading">Premium breakdown at this position</h2>
        </div>

        <dl className="premium-breakdown">
          <div>
            <dt>Gross premium</dt>
            <dd>{money(position.gross_premium)}</dd>
          </div>

          <div>
            <dt>
              Net premium
              <span className="secondary-text">
                After {formatAmount(slip.brokerage_pct)}% brokerage
              </span>
            </dt>
            <dd>{money(position.net_premium)}</dd>
          </div>

          <div>
            <dt>
              Our net premium
              <span className="secondary-text">
                {formatAmount(slip.signed_line_pct)}% signed line
              </span>
            </dt>
            <dd>{money(position.our_net_premium)}</dd>
          </div>
        </dl>
      </section>
    </>
  );
}
