export function AppSidebar() {
  return (
    <aside className="sidebar">
      <p className="sidebar-label">Portfolio</p>
      <nav aria-label="Main navigation">
        <NavLink className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} to="/contracts">
          Contracts
        </NavLink>
      </nav>
    </aside>
  );
}
import { NavLink } from "react-router-dom";

