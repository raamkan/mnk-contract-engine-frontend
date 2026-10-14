import { useEffect, useState } from "react";

import { ApiError, getErrorMessage } from "../api/client";
import { getContract } from "../api/contracts";

import type { ContractDetails } from "../types/contract";

type ContractState =
  | {
      status: "loading";
    }
  | {
      status: "success";
      data: ContractDetails;
    }
  | {
      status: "error";
      message: string;
      notFound: boolean;
    };

export function useContract(mgaReference: string) {
  const [state, setState] = useState<ContractState>({
    status: "loading",
  });

  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadContract() {
      setState({ status: "loading" });

      try {
        const data = await getContract(mgaReference, controller.signal);

        if (controller.signal.aborted) {
          return;
        }

        setState({
          status: "success",
          data,
        });
      } catch (error: unknown) {
        if (controller.signal.aborted) {
          return;
        }

        const notFound = error instanceof ApiError && error.status === 404;

        setState({
          status: "error",
          notFound,
          message: notFound
            ? "This contract could not be found."
            : getErrorMessage(error),
        });
      }
    }

    void loadContract();

    return () => {
      controller.abort();
    };
  }, [mgaReference, reloadCount]);

  function reload() {
    setReloadCount((current) => current + 1);
  }

  return {
    state,
    reload,
  };
}
