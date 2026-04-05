import { Navigate, Route, Routes } from "react-router-dom"
import { AppShell } from "./components/AppShell"
import { DashboardPage } from "./pages/DashboardPage"
import { HistoryDetailPage } from "./pages/HistoryDetailPage"
import { HistoryPage } from "./pages/HistoryPage"
import { LoginPage } from "./pages/LoginPage"
import { SectorsPage } from "./pages/SectorsPage"
import { TrackRecordPage } from "./pages/TrackRecordPage"
import { UpgradePage } from "./pages/UpgradePage"
import { IndexRedirect } from "./routes/IndexRedirect"
import { ProtectedRoute } from "./routes/ProtectedRoute"
import { UnauthorizedBridge } from "./routes/UnauthorizedBridge"

export default function App() {
  return (
    <>
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
          <Route path="track-record" element={<TrackRecordPage />} />
          <Route path="upgrade" element={<UpgradePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
