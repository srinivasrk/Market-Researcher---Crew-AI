import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { AppShell } from "./components/AppShell"
import { DashboardPage } from "./pages/DashboardPage"
import { HistoryDetailPage } from "./pages/HistoryDetailPage"
import { HistoryPage } from "./pages/HistoryPage"
import { LoginPage } from "./pages/LoginPage"
import { SectorsPage } from "./pages/SectorsPage"
import { IndexRedirect } from "./routes/IndexRedirect"
import { ProtectedRoute } from "./routes/ProtectedRoute"
import { UnauthorizedBridge } from "./routes/UnauthorizedBridge"

export default function App() {
  return (
    <BrowserRouter>
      <UnauthorizedBridge />
      <Routes>
        <Route path="/" element={<IndexRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="sectors" element={<SectorsPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="history/:runId" element={<HistoryDetailPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
