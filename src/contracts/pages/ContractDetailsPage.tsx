import type { KeyboardEvent } from "react";
import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { createEndorsement } from "../../api/contracts";
import { useContract } from "../../hooks/useContract";
import { useContractPosition } from "../../hooks/useContractPosition";
import { formatDate } from "../../utils/format";
import ContractPositionPanel from "../components/ContractPositionPanel";
import EndorsementForm from "../components/EndorsementForm";
import EndorsementsTable from "../components/EndorsementsTable";

type ContractTab = "position" | "endorsements";

// Enable only when Django supports the known_at query parameter.
const SUPPORTS_KNOWN_AT = false;

const TAB_ORDER: ContractTab[] = ["position", "endorsements"];

interface ContractDetailsContentProps {
  mgaReference: string;
}

function ContractDetailsContent({ mgaReference }: ContractDetailsContentProps) {
  const { state, reload } = useContract(mgaReference);
  const positionView = useContractPosition(
    mgaReference,
    state.status === "success" ? state.data.current_position : null,
  );

  const [showForm, setShowForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ContractTab>("position");

  const tabRefs = useRef<
    Partial<Record<ContractTab, HTMLButtonElement | null>>
  >({});

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    currentTab: ContractTab,
  ) {
    const currentIndex = TAB_ORDER.indexOf(currentTab);

    let nextTab: ContractTab;

    switch (event.key) {
      case "ArrowRight":
        nextTab = TAB_ORDER[(currentIndex + 1) % TAB_ORDER.length];
        break;

      case "ArrowLeft":
        nextTab =
          TAB_ORDER[(currentIndex - 1 + TAB_ORDER.length) % TAB_ORDER.length];
        break;

      case "Home":
        nextTab = "position";
        break;

      case "End":
        nextTab = "endorsements";
        break;

      default:
        return;
    }

    event.preventDefault();

    setActiveTab(nextTab);
    tabRefs.current[nextTab]?.focus();
  }

  if (state.status === "loading") {
    return (
      <div className="panel">
        <div className="empty-state" role="status">
          <span className="loading-spinner" aria-hidden="true" />
          <p>Loading contract…</p>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <section className="panel">
        <div className="empty-state">
          <div role="alert">
            <h3>
              {state.notFound
                ? "Contract not found"
                : "We couldn’t load this contract"}
            </h3>

            <p>{state.message}</p>
          </div>

          {!state.notFound && (
            <button className="button-primary" type="button" onClick={reload}>
              Try again
            </button>
          )}
        </div>
      </section>
    );
  }

  const { slip, endorsements, current_position: currentPosition } = state.data;

  const suggestedNumber =
    endorsements.reduce(
      (highest, endorsement) =>
        Math.max(highest, endorsement.endorsement_number),
      0,
    ) + 1;

  const tabLabels: Record<ContractTab, string> = {
    position: "Position",
    endorsements: `Endorsements (${endorsements.length})`,
  };

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">{slip.mga_reference}</p>

          <h1>{currentPosition.insured_name}</h1>

          <p className="page-description">
            {slip.class_of_business} · {currentPosition.currency}
          </p>
        </div>
        {!showForm && (
          <button
            id="add-endorsement-button"
            type="button"
            className="button-primary"
            onClick={() => {
              setSuccessMessage(null);
              setShowForm(true);
            }}
          >
            + Add endorsement
          </button>
        )}
      </div>

      {successMessage && (
        <div className="success-notice" role="status">
          {successMessage}
        </div>
      )}

      {showForm && (
        <EndorsementForm
          suggestedNumber={suggestedNumber}
          currency={currentPosition.currency}
          onCancel={() => {
            setShowForm(false);

            requestAnimationFrame(() => {
              document.getElementById("add-endorsement-button")?.focus();
            });
          }}
          onSubmit={async (input) => {
            await createEndorsement(mgaReference, input);

            setShowForm(false);

            setSuccessMessage(
              input.status === "DRAFT"
                ? `Draft endorsement #${input.endorsement_number} saved. It does not affect the contract position.`
                : `Agreed endorsement #${input.endorsement_number} added.`,
            );

            reload();
          }}
        />
      )}

      <div
        className="contract-tabs"
        role="tablist"
        aria-label="Contract information"
      >
        {TAB_ORDER.map((tab) => (
          <button
            key={tab}
            ref={(element) => {
              tabRefs.current[tab] = element;
            }}
            id={`contract-tab-${tab}`}
            className="contract-tab"
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`contract-panel-${tab}`}
            tabIndex={activeTab === tab ? 0 : -1}
            onClick={() => setActiveTab(tab)}
            onKeyDown={(event) => handleTabKeyDown(event, tab)}
          >
            {tabLabels[tab]}
          </button>
        ))}
      </div>

      <div className="position-filters">
        <label className="date-filter">
          <span>Effective as at</span>

          <input
            type="date"
            required
            value={positionView.asAt}
            onChange={(event) => {
              const value = event.target.value;

              if (value && event.target.validity.valid) {
                positionView.setAsAt(value);
              }
            }}
          />

          <span className="secondary-text">When changes take effect</span>
        </label>

        {SUPPORTS_KNOWN_AT && (
          <label className="date-filter">
            <span>As known at · Optional</span>

            <input
              type="date"
              value={positionView.knownAt}
              onChange={(event) => {
                if (event.target.validity.valid) {
                  positionView.setKnownAt(event.target.value);
                }
              }}
            />

            <span className="secondary-text">
              Only changes recorded by this date
            </span>
          </label>
        )}

        <p className="filter-explanation">
          Position on {formatDate(positionView.asAt)}
          {positionView.knownAt
            ? `, using records entered by ${formatDate(positionView.knownAt)}.`
            : ", using all currently recorded changes."}
        </p>
      </div>

      <div
        id="contract-panel-position"
        role="tabpanel"
        aria-labelledby="contract-tab-position"
        hidden={activeTab !== "position"}
        tabIndex={0}
        aria-busy={positionView.loading}
      >
        {positionView.position && (
          <ContractPositionPanel slip={slip} position={positionView.position} />
        )}
      </div>

      <div
        id="contract-panel-endorsements"
        role="tabpanel"
        aria-labelledby="contract-tab-endorsements"
        hidden={activeTab !== "endorsements"}
        tabIndex={0}
        aria-busy={positionView.loading}
      >
        {positionView.position && (
          <EndorsementsTable
            endorsements={endorsements}
            position={positionView.position}
          />
        )}
      </div>

      {positionView.loading && (
        <div className="panel">
          <div className="empty-state" role="status">
            <span className="loading-spinner" aria-hidden="true" />
            <p>Loading the selected position…</p>
          </div>
        </div>
      )}

      {positionView.error && (
        <div className="panel">
          <div className="empty-state">
            <div role="alert">
              <h3>We couldn’t load this position</h3>
              <p>{positionView.error}</p>
            </div>

            <button
              type="button"
              className="button-primary"
              onClick={positionView.retry}
            >
              Try again
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function ContractDetailsPage() {
  const { mgaReference } = useParams<{
    mgaReference: string;
  }>();

  return (
    <>
      <Link className="back-link" to="/contracts">
        ← All contracts
      </Link>

      {mgaReference ? (
        <ContractDetailsContent
          key={mgaReference}
          mgaReference={mgaReference}
        />
      ) : (
        <p role="alert">A contract reference is required.</p>
      )}
    </>
  );
}
