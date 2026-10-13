import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import Auth from "./pages/Auth";
import LegalPage from "./pages/LegalPage";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import Prospecting from "./pages/Prospecting";
import Clients from "./pages/Clients";
import ClientDetail from "./pages/ClientDetail";
import Financial from "./pages/Financial";
import Funnel from "./pages/Funnel";
import Approvals from "./pages/Approvals";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Onboarding from "./pages/Onboarding";
import AdsDashboard from "./pages/AdsDashboard";
import DailyActivities from "./pages/DailyActivities";
import GoogleBusiness from "./pages/GoogleBusiness";
import Quotes from "./pages/Quotes";
import QuotePrint from "./pages/QuotePrint";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/privacidade" element={<LegalPage kind="privacy" />} />
            <Route path="/termos" element={<LegalPage kind="terms" />} />
            <Route path="/orcamentos/:id/pdf" element={<QuotePrint />} />
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/atividades" element={<DailyActivities />} />
              <Route path="/google-meu-negocio" element={<GoogleBusiness />} />
              <Route path="/orcamentos" element={<Quotes />} />
              <Route path="/leads" element={<Leads />} />
              <Route path="/prospecting" element={<Prospecting />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/clients/:id" element={<ClientDetail />} />
              <Route path="/financial" element={<Financial />} />
              <Route path="/funnel" element={<Funnel />} />
              <Route path="/ads-dashboard" element={<AdsDashboard />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/approvals" element={<Approvals />} />
              <Route path="/users" element={<Users />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
