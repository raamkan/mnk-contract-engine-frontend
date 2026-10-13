export type HealthResponse = {
  status: string;
  application: string;
  version: string;
};

const HEALTH_URL = "http://127.0.0.1:8000/health/";

export async function getHealth(): Promise<HealthResponse> {
  try {
    const res = await fetch(HEALTH_URL);

    if (!res.ok) {
      throw new Error(`Health API returned HTTP ${res.status}`);
    }

    return (await res.json()) as HealthResponse;
  } catch {
    throw new Error(
      "Unable to reach backend. Check API is running on http://127.0.0.1:8000 and CORS allows http://localhost:5173.",
    );
  }
}
