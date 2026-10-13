import { useEffect, useState } from "react";
import { getHealth, type HealthResponse } from "./health";

export default function App() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    getHealth()
      .then((json) => setData(json))
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>MNK Contract Engine Frontend</h1>

      {error && <p style={{ color: "red" }}>Error: {error}</p>}
      {!error && !data && <p>Loading...</p>}

      {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
    </main>
  );
}
