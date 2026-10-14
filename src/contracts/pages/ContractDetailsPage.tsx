import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, getErrorMessage } from "../../api/client";
import { getContract } from "../../api/contracts";
import type { ContractDetails } from "../../types/contract";
import { formatAmount, formatDate } from "../../utils/format";
import StatusBadge from "../components/StatusBadge";

type State =
  | { status: "loading" }
  | { status: "success"; data: ContractDetails }
  | { status: "error"; message: string };

export function ContractDetailsPage() {
  const { mgaReference = "" } = useParams<{ mgaReference: string }>();
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setState({ status: "loading" });
      try {
        const data = await getContract(mgaReference, controller.signal);
        if (!controller.signal.aborted) setState({ status: "success", data });
      } catch (error: unknown) {
        if (!controller.signal.aborted) {
          setState({ status: "error", message: error instanceof ApiError && error.status === 404
            ? "This contract could not be found." : getErrorMessage(error) });
        }
      }
    }
    void load();
    return () => controller.abort();
  }, [mgaReference, attempt]);

  const data = state.status === "success" ? state.data : null;
  const position = data?.current_position;
  return (
    <>
      <Link className="back-link" to="/contracts">← All contracts</Link>
      <div className="page-header">
        <div>
          <p className="eyebrow">{mgaReference}</p>
          <h1>Contract details</h1>
          <p className="page-description">Review the original slip and its endorsements.</p>
        </div>
      </div>
      <section className="panel" aria-labelledby="position-heading" aria-busy={state.status === "loading"}>
        <div className="panel-header">
          <h2 id="position-heading">Current position</h2>
          {position && <StatusBadge status={position.status} />}
        </div>
        {state.status === "loading" && <div className="empty-state" role="status"><span className="loading-spinner" aria-hidden="true" /><p>Loading contract…</p></div>}
        {state.status === "error" && <div className="empty-state"><div role="alert"><h3>We couldn’t load this contract</h3><p>{state.message}</p></div><button className="button-primary" onClick={() => setAttempt(current => current + 1)}>Try again</button></div>}
        {position && <dl className="details-grid">
          <div><dt>Insured name</dt><dd>{position.insured_name}</dd></div>
          <div><dt>As at</dt><dd>{formatDate(position.as_at)}</dd></div>
          <div><dt>Cover period</dt><dd>{formatDate(position.inception_date)} to {formatDate(position.expiry_date)}</dd></div>
          <div><dt>Sum insured ({position.currency})</dt><dd>{formatAmount(position.sum_insured)}</dd></div>
          <div><dt>Gross premium ({position.currency})</dt><dd>{formatAmount(position.gross_premium)}</dd></div>
          <div><dt>Net premium ({position.currency})</dt><dd>{formatAmount(position.net_premium)}</dd></div>
          <div><dt>Our net premium ({position.currency})</dt><dd>{formatAmount(position.our_net_premium)}</dd></div>
          {position.cancellation_effective_date && <div><dt>Cancellation effective date</dt><dd>{formatDate(position.cancellation_effective_date)}</dd></div>}
        </dl>}
      </section>
      {data && <>
        <section className="panel detail-panel" aria-labelledby="slip-heading">
          <div className="panel-header"><h2 id="slip-heading">Original slip</h2></div>
          <dl className="details-grid">
            <div><dt>Insured name</dt><dd>{data.slip.insured_name}</dd></div>
            <div><dt>Class of business</dt><dd>{data.slip.class_of_business}</dd></div>
            <div><dt>Cover period</dt><dd>{formatDate(data.slip.inception_date)} to {formatDate(data.slip.expiry_date)}</dd></div>
            <div><dt>Sum insured ({data.slip.currency})</dt><dd>{formatAmount(data.slip.sum_insured)}</dd></div>
            <div><dt>Gross premium ({data.slip.currency})</dt><dd>{formatAmount(data.slip.gross_premium)}</dd></div>
            <div><dt>Brokerage</dt><dd>{data.slip.brokerage_pct}%</dd></div>
            <div><dt>Signed line</dt><dd>{data.slip.signed_line_pct}%</dd></div>
          </dl>
        </section>
        <section className="panel detail-panel" aria-labelledby="endorsements-heading">
          <div className="panel-header"><h2 id="endorsements-heading">Endorsements</h2><span className="badge">{data.endorsements.length}</span></div>
          {data.endorsements.length === 0 ? <div className="empty-state"><p>No endorsements recorded.</p></div> :
            <div className="table-container"><table className="data-table">
              <caption className="sr-only">Contract endorsements</caption>
              <thead><tr>{["Number", "Type", "Status", "Effective", "Recorded", "Premium change", "Changes", "Reason"].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
              <tbody>{data.endorsements.map(item => <tr key={item.endorsement_number}>
                <td>{item.endorsement_number}</td><td>{item.type.replaceAll("_", " ")}</td><td>{item.status}</td><td>{formatDate(item.effective_date)}</td><td>{formatDate(item.recorded_date)}</td><td className="amount-cell">{formatAmount(item.premium_change)} {data.slip.currency}</td><td>{Object.entries(item.changes).map(([field, value]) => `${field.replaceAll("_", " ")}: ${value}`).join("; ") || "—"}</td><td>{item.reason}</td>
              </tr>)}</tbody>
            </table></div>}
        </section>
      </>}
    </>
  );
}
