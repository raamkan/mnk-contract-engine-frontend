import { useEffect, useState } from "react";

import { getErrorMessage } from "../api/client";
import { getContractPosition } from "../api/contracts";

import type { ContractPosition } from "../types/contract";

type PositionResult =
  | {
      key: string;
      source: ContractPosition;
      status: "success";
      position: ContractPosition;
    }
  | {
      key: string;
      source: ContractPosition;
      status: "error";
      message: string;
    };

export function useContractPosition(
  mgaReference: string,
  initialPosition: ContractPosition | null,
) {
  const [selectedDate, setSelectedDate] = useState("");
  const [knownAt, setKnownAt] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  const [result, setResult] = useState<PositionResult | null>(null);

  const asAt = selectedDate || initialPosition?.as_at || "";

  const usesInitialPosition =
    initialPosition !== null &&
    asAt === initialPosition.as_at &&
    knownAt === "";

  const requestKey = JSON.stringify([mgaReference, asAt, knownAt, retryCount]);

  useEffect(() => {
    if (!initialPosition || !asAt || usesInitialPosition) {
      return;
    }

    const source = initialPosition;

    const controller = new AbortController();

    async function loadPosition() {
      try {
        const position = await getContractPosition(
          mgaReference,
          {
            as_at: asAt,
            ...(knownAt ? { known_at: knownAt } : {}),
          },
          controller.signal,
        );

        if (controller.signal.aborted) {
          return;
        }

        setResult({
          key: requestKey,
          source,
          status: "success",
          position,
        });
      } catch (error: unknown) {
        if (controller.signal.aborted) {
          return;
        }

        setResult({
          key: requestKey,
          source,
          status: "error",
          message: getErrorMessage(error),
        });
      }
    }

    void loadPosition();

    return () => {
      controller.abort();
    };
  }, [
    mgaReference,
    initialPosition,
    asAt,
    knownAt,
    usesInitialPosition,
    requestKey,
  ]);

  const currentResult =
    result?.key === requestKey &&
    result.source === initialPosition
      ? result
      : null;

  const position = usesInitialPosition
    ? initialPosition
    : currentResult?.status === "success"
      ? currentResult.position
      : null;

  const error =
    !usesInitialPosition && currentResult?.status === "error"
      ? currentResult.message
      : null;

  return {
    asAt,
    knownAt,
    position,
    error,
    loading: initialPosition !== null && !position && !error,
    setAsAt: setSelectedDate,
    setKnownAt,
    retry: () => setRetryCount((current) => current + 1),
  };
}
