export function AppHeader() {
  return (
    <header className="app-header">
      <Link className="brand" to="/contracts" aria-label="MNK Contracts home">
        <span className="brand-icon" aria-hidden="true">
          S
        </span>
        <span>MNK Contracts</span>
      </Link>
      <span className="workspace-title">Contract workspace</span>
    </header>
  );
}
import { Link } from "react-router-dom";

