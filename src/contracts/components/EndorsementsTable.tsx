import type { ContractPosition, Endorsement } from "../../types/contract";

import { formatAmount, formatDate } from "../../utils/format";

interface EndorsementsTableProps {
  endorsements: Endorsement[];
  position: ContractPosition;
}

const TYPE_LABELS: Record<Endorsement["type"], string> = {
  CHANGE_SUM_INSURED: "Change sum insured",
  CHANGE_DETAILS: "Change insured details",
  PREMIUM_ADJUSTMENT: "Premium adjustment",
  EXTENSION: "Cover extension",
  CANCELLATION: "Cancellation",
};

function getApplicationLabel(
  endorsement: Endorsement,
  position: ContractPosition,
  appliedNumbers: Set<number>,
): string {
  if (endorsement.status === "DRAFT") {
    return "Not applied · Draft";
  }

  if (appliedNumbers.has(endorsement.endorsement_number)) {
    return "Applied";
  }

  // ISO calendar dates can be compared lexicographically.
  if (endorsement.effective_date > position.as_at) {
    return "Not yet effective";
  }

  return "Not applied at this position";
}

function formatPremiumChange(value: string): string {
  const formatted = formatAmount(value);

  if (/^-?0+(?:\.0+)?$/.test(value)) {
    return "0.00";
  }

  return value.startsWith("-") ? formatted : `+${formatted}`;
}

export default function EndorsementsTable({
  endorsements,
  position,
}: EndorsementsTableProps) {
  // Copy before sorting: never mutate a prop.
  const sortedEndorsements = [...endorsements].sort(
    (first, second) => first.endorsement_number - second.endorsement_number,
  );

  const appliedNumbers = new Set(position.applied_endorsements);

  return (
    <section className="panel" aria-labelledby="endorsements-heading">
      <div className="panel-header">
        <div>
          <h2 id="endorsements-heading">Endorsement history</h2>

          <p className="secondary-text">
            In number order · Application as at {formatDate(position.as_at)}
          </p>
        </div>
      </div>

      {sortedEndorsements.length === 0 ? (
        <div className="empty-state">
          <h3>No endorsements yet</h3>
          <p>The original slip is the only contract record.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table endorsements-table">
            <caption className="sr-only">Endorsements in number order</caption>

            <thead>
              <tr>
                <th scope="col">No.</th>
                <th scope="col">Type and reason</th>
                <th scope="col">Status</th>
                <th scope="col">Effective date</th>
                <th scope="col">Recorded date</th>
                <th scope="col" className="amount-cell">
                  Premium change ({position.currency})
                </th>
                <th scope="col">Application</th>
              </tr>
            </thead>

            <tbody>
              {sortedEndorsements.map((endorsement) => (
                <tr key={endorsement.endorsement_number}>
                  <td>#{endorsement.endorsement_number}</td>

                  <td>
                    <span className="endorsement-type">
                      {TYPE_LABELS[endorsement.type]}
                    </span>

                    <p className="endorsement-reason">
                      {endorsement.reason || "No reason provided"}
                    </p>
                  </td>

                  <td>
                    <span
                      className={`status-badge ${
                        endorsement.status === "DRAFT"
                          ? "status-badge--draft"
                          : "status-badge--bound"
                      }`}
                    >
                      {endorsement.status === "DRAFT" ? "Draft" : "Agreed"}
                    </span>
                  </td>

                  <td className="date-cell">
                    {formatDate(endorsement.effective_date)}
                  </td>

                  <td className="date-cell">
                    {formatDate(endorsement.recorded_date)}

                    {endorsement.recorded_date > endorsement.effective_date && (
                      <span className="secondary-text">Backdated</span>
                    )}
                  </td>

                  <td className="amount-cell">
                    {formatPremiumChange(endorsement.premium_change)}
                  </td>

                  <td className="application-cell">
                    {getApplicationLabel(endorsement, position, appliedNumbers)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
