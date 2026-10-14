import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <section className="panel">
      <div className="empty-state">
        <p className="eyebrow">404</p>
        <h1>Page not found</h1>
        <p>Check the address or return to your contracts.</p>
        <Link className="button-primary" to="/contracts">
          Back to contracts
        </Link>
      </div>
    </section>
  );
}
