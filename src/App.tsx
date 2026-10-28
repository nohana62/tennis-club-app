import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import SchedulePage from "./pages/Schedule/SchedulePage";
import MembersPage from "./pages/Members/MembersPage";
import ExpensePage from "./pages/Expense/ExpensePage";
import ReportPage from "./pages/Report/ReportPage";
import SettingsPage from "./pages/Settings/SettingsPage";
import BoardPage from "./pages/Board/BoardPage";
import DoublesPage from "./pages/Doubles/DoublesPage";
import MorePage from "./pages/More/MorePage";
import RainRankingPage from "./pages/More/RainRankingPage";
import LoginPage from "./pages/Auth/LoginPage";
import PasswordChangePage from "./pages/Auth/PasswordChangePage";
import { AuthProvider } from "./contexts/AuthContext";
import { IS_DEMO, useAuth } from "./contexts/auth";
import { OrganizationProvider } from "./contexts/OrganizationContext";
import { useOrganization } from "./contexts/organization";

function AuthenticatedApp() {
  const { user, loading } = useAuth();
  const organizationState = useOrganization();

  if (loading) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center text-green-800">
        ログイン状態を確認しています...
      </div>
    );
  }

  if (!IS_DEMO && !user) {
    return <LoginPage />;
  }

  if (!IS_DEMO && organizationState.error) {
    return <div className="min-h-screen flex items-center justify-center p-4 text-red-700">{organizationState.error}</div>;
  }

  if (!IS_DEMO && (organizationState.loading || !organizationState.userProfile)) {
    return <div className="min-h-screen flex items-center justify-center">所属団体を確認しています...</div>;
  }

  if (!IS_DEMO && organizationState.userProfile?.passwordChangeRequired) {
    return <PasswordChangePage />;
  }

  return (
    <BrowserRouter basename="/tennis-club-app">
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<SchedulePage />} />
          <Route path="members" element={<MembersPage />} />
          <Route path="board" element={<BoardPage />} />
          <Route path="doubles" element={<DoublesPage />} />
          <Route path="expense" element={<ExpensePage />} />
          <Route path="report" element={<ReportPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="more" element={<MorePage />} />
          <Route path="more/rain-ranking" element={<RainRankingPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <OrganizationProvider>
        <AuthenticatedApp />
      </OrganizationProvider>
    </AuthProvider>
  );
}
