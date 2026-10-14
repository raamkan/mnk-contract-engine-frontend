import { Outlet } from "react-router-dom";
import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";

export function AppLayout() {
  return (
    <div className="app-layout">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <AppHeader />
      <div className="app-body">
        <AppSidebar />
        <main id="main-content" className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
