import type { ContractStatus } from "../../../types/contract";

interface StatusBadgeProps {
  status: ContractStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const isCancelled = status === "CANCELLED";

  return (
    <span
      className={`status-badge ${
        isCancelled ? "status-badge--cancelled" : "status-badge--bound"
      }`}
    >
      {isCancelled ? "Cancelled" : "Bound"}
    </span>
  );
}
