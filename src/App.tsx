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

export default function App() {
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
