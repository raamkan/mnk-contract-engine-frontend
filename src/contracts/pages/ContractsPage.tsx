import { useState } from "react";
import { Link } from "react-router-dom";

import { useContracts } from "../../hooks/useContracts";
import { formatAmount, formatDate } from "../../utils/format";
import StatusBadge from "../components/StatusBadge";

export default function ContractsPage() {
  const [page, setPage] = useState(1);

  const { state, retry } = useContracts(page);

  return (
    <>
      <div className="panel-header">
        <h2 id="contracts-heading">Your contracts</h2>

        {state.status === "success" && (
          <span className="badge">
            {state.data.total}{" "}
            {state.data.total === 1 ? "contract" : "contracts"}
          </span>
        )}
      </div>

      <section
        className="panel"
        aria-labelledby="contracts-heading"
        aria-busy={state.status === "loading"}
      >
        <div className="page-header">
          <Link to="/contracts/new" className="button-primary">
            + New contract
          </Link>
        </div>

        {state.status === "loading" && (
          <div className="empty-state" role="status">
            <span className="loading-spinner" aria-hidden="true" />
            <p>Loading contracts…</p>
          </div>
        )}

        {state.status === "error" && (
          <div className="empty-state">
            <div role="alert">
              <h3>We couldn’t load your contracts</h3>
              <p>{state.message}</p>
            </div>

            <button className="button-primary" type="button" onClick={retry}>
              Try again
            </button>
          </div>
        )}

        {state.status === "success" && state.data.contracts.length === 0 && (
          <div className="empty-state" role="status">
            <h3>No contracts found</h3>

            <p>
              {page === 1
                ? "Imported or newly created contracts will appear here."
                : "There are no contracts on this page."}
            </p>

            {page > 1 && (
              <button
                className="button-primary"
                type="button"
                onClick={() => setPage(1)}
              >
                Return to first page
              </button>
            )}
          </div>
        )}

        {state.status === "success" && state.data.contracts.length > 0 && (
          <>
            <div className="table-container">
              <table className="data-table contracts-table">
                <caption className="sr-only">Original contract slips</caption>

                <thead>
                  <tr>
                    <th scope="col">Reference</th>
                    <th scope="col">Insured name</th>
                    <th scope="col">Status</th>
                    <th scope="col">Cover period</th>
                    <th scope="col">Currency</th>
                    <th scope="col" className="amount-cell">
                      Gross premium
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {state.data.contracts.map((contract) => (
                    <tr key={contract.mga_reference}>
                      <td className="reference-cell">
                        {contract.mga_reference}
                      </td>

                      <td>
                        <Link
                          className="text-link"
                          to={`/contracts/${encodeURIComponent(
                            contract.mga_reference,
                          )}`}
                        >
                          {contract.insured_name}
                        </Link>
                      </td>

                      <td>
                        <StatusBadge status={contract.status} />
                      </td>

                      <td className="date-cell">
                        <span>{formatDate(contract.inception_date)}</span>

                        <span className="secondary-text">
                          to {formatDate(contract.expiry_date)}
                        </span>
                      </td>

                      <td>{contract.currency}</td>

                      <td className="amount-cell">
                        {formatAmount(contract.gross_premium)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="table-footer">
              <p className="secondary-text">
                Showing {state.data.contracts.length} of {state.data.total}{" "}
                contracts
              </p>

              {(state.data.hasPrevious || state.data.hasNext) && (
                <nav className="pagination" aria-label="Contracts pagination">
                  <button
                    className="button-secondary"
                    type="button"
                    disabled={!state.data.hasPrevious}
                    onClick={() =>
                      setPage((current) => Math.max(1, current - 1))
                    }
                  >
                    Previous
                  </button>

                  <span className="page-indicator">Page {page}</span>

                  <button
                    className="button-secondary"
                    type="button"
                    disabled={!state.data.hasNext}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    Next
                  </button>
                </nav>
              )}
            </div>
          </>
        )}
      </section>
    </>
  );
}
