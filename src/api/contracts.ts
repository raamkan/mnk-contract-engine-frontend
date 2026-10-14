import { apiRequest } from "./client";

import type {
  ContractDetails,
  ContractPosition,
  ContractSlip,
  ContractsListResponse,
  CreateContractInput,
  CreateEndorsementInput,
  Endorsement,
  PositionQuery,
} from "../types/contract";

function contractPath(mgaReference: string): string {
  return `/contracts/${encodeURIComponent(mgaReference)}/`;
}

export function getContracts(signal?: AbortSignal, page = 1) {
  return apiRequest<ContractsListResponse>(`/contracts/?page=${page}`, {
    signal,
  });
}

export function getContract(mgaReference: string, signal?: AbortSignal) {
  return apiRequest<ContractDetails>(contractPath(mgaReference), { signal });
}

export function getContractPosition(
  mgaReference: string,
  query: PositionQuery = {},
  signal?: AbortSignal,
) {
  const params = new URLSearchParams();

  if (query.as_at) {
    params.set("as_at", query.as_at);
  }

  if (query.known_at) {
    params.set("known_at", query.known_at);
  }

  const queryString = params.toString();

  const path =
    `${contractPath(mgaReference)}position/` +
    (queryString ? `?${queryString}` : "");

  return apiRequest<ContractPosition>(path, {
    signal,
  });
}

export function createContract(input: CreateContractInput) {
  return apiRequest<ContractSlip>("/contracts/", {
    method: "POST",
    json: input,
  });
}

export function createEndorsement(
  mgaReference: string,
  input: CreateEndorsementInput,
) {
  return apiRequest<Endorsement>(`${contractPath(mgaReference)}endorsements/`, {
    method: "POST",
    json: input,
  });
}
