import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./contracts/layout/AppLayout";
import { ContractDetailsPage } from "./contracts/pages/ContractDetailsPage";
import ContractsPage from "./contracts/pages/ContractsPage";
import NotFoundPage from "./contracts/pages/NotFoundPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/contracts" replace />} />
        <Route path="contracts" element={<ContractsPage />} />
        <Route
          path="contracts/:mgaReference"
          element={<ContractDetailsPage />}
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
