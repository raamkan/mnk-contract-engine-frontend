import { useEffect, useState } from "react";

import { getErrorMessage } from "../api/client";
import { getContracts } from "../api/contracts";

import type { ContractSlip } from "../types/contract";

interface ContractsData {
  contracts: ContractSlip[];
  total: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

type RequestState =
  | {
      status: "loading";
    }
  | {
      status: "success";
      data: ContractsData;
    }
  | {
      status: "error";
      message: string;
    };

export function useContracts(page: number) {
  const [state, setState] = useState<RequestState>({
    status: "loading",
  });

  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadContracts() {
      setState({ status: "loading" });

      try {
        const response = await getContracts(controller.signal, page);

        if (controller.signal.aborted) {
          return;
        }

        const data: ContractsData = Array.isArray(response)
          ? {
              contracts: response,
              total: response.length,
              hasNext: false,
              hasPrevious: false,
            }
          : {
              contracts: response.results,
              total: response.count,
              hasNext: response.next !== null,
              hasPrevious: response.previous !== null,
            };

        setState({
          status: "success",
          data,
        });
      } catch (error: unknown) {
        // Navigation or a new request can cancel the old one.
        // Cancellation should not appear as an error.
        if (controller.signal.aborted) {
          return;
        }

        setState({
          status: "error",
          message: getErrorMessage(error),
        });
      }
    }

    void loadContracts();

    return () => {
      controller.abort();
    };
  }, [page, retryCount]);

  function retry() {
    setRetryCount((current) => current + 1);
  }

  return {
    state,
    retry,
  };
}
