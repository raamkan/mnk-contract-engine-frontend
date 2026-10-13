export interface HealthResponse {
  status: string;
  application: string;
}

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch("/health/", {
    signal,
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Backend request failed: HTTP ${response.status}`);
  }

  return response.json();
}
