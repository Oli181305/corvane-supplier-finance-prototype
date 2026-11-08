import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import Shell from './components/Shell';
import Login from './pages/Login';
import InvoiceDetail from './pages/shared/InvoiceDetail';
import DisputesList from './pages/shared/DisputesList';
import DisputeCase from './pages/shared/DisputeCase';
import PrintAdvice from './pages/shared/PrintAdvice';
import PrintReport from './pages/shared/PrintReport';
import Overview from './pages/kaltrex/Overview';
import ApprovalQueue from './pages/kaltrex/ApprovalQueue';
import Obligations from './pages/kaltrex/Obligations';
import KSuppliers from './pages/kaltrex/Suppliers';
import Reports from './pages/kaltrex/Reports';
import ProgramSettings from './pages/kaltrex/ProgramSettings';
import Offered from './pages/supplier/Offered';
import AllInvoices from './pages/supplier/AllInvoices';
import SupplierPayments from './pages/supplier/Payments';
import StandingInstructionPage from './pages/supplier/StandingInstruction';
import CompanyProfile from './pages/supplier/CompanyProfile';
import Onboarding from './pages/supplier/Onboarding';
import ProgramOverview from './pages/bank/ProgramOverview';
import OnboardingQueue from './pages/bank/OnboardingQueue';
import SupplierCase from './pages/bank/SupplierCase';
import ReviewQueue from './pages/bank/ReviewQueue';
import BankPayments from './pages/bank/Payments';
import Settlement from './pages/bank/Settlement';
import EarlyWarnings from './pages/bank/EarlyWarnings';
import AlertCase from './pages/bank/AlertCase';
import AuditLog from './pages/bank/AuditLog';
import ProgramConfig from './pages/bank/ProgramConfig';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/print/advice/:ref" element={<PrintAdvice />} />
        <Route path="/print/report/:name" element={<PrintReport />} />
        <Route element={<Shell />}>
          {/* Kaltrex workspace */}
          <Route path="/kaltrex/overview" element={<Overview />} />
          <Route path="/kaltrex/approvals" element={<ApprovalQueue />} />
          <Route path="/kaltrex/approvals/:id" element={<ApprovalQueue />} />
          <Route path="/kaltrex/obligations" element={<Obligations />} />
          <Route path="/kaltrex/suppliers" element={<KSuppliers />} />
          <Route path="/kaltrex/disputes" element={<DisputesList />} />
          <Route path="/kaltrex/disputes/:id" element={<DisputeCase />} />
          <Route path="/kaltrex/reports" element={<Reports />} />
          <Route path="/kaltrex/settings" element={<ProgramSettings />} />
          <Route path="/kaltrex/invoices/:id" element={<InvoiceDetail />} />

          {/* Supplier portal */}
          <Route path="/supplier/offered" element={<Offered />} />
          <Route path="/supplier/invoices" element={<AllInvoices />} />
          <Route path="/supplier/invoices/:id" element={<InvoiceDetail />} />
          <Route path="/supplier/payments" element={<SupplierPayments />} />
          <Route path="/supplier/standing" element={<StandingInstructionPage />} />
          <Route path="/supplier/disputes" element={<DisputesList />} />
          <Route path="/supplier/disputes/:id" element={<DisputeCase />} />
          <Route path="/supplier/profile" element={<CompanyProfile />} />
          <Route path="/supplier/onboarding" element={<Onboarding />} />

          {/* Bank staff screen */}
          <Route path="/bank/overview" element={<ProgramOverview />} />
          <Route path="/bank/onboarding" element={<OnboardingQueue />} />
          <Route path="/bank/onboarding/:id" element={<SupplierCase />} />
          <Route path="/bank/review" element={<ReviewQueue />} />
          <Route path="/bank/review/:id" element={<ReviewQueue />} />
          <Route path="/bank/payments" element={<BankPayments />} />
          <Route path="/bank/settlement" element={<Settlement />} />
          <Route path="/bank/alerts" element={<EarlyWarnings />} />
          <Route path="/bank/alerts/:id" element={<AlertCase />} />
          <Route path="/bank/disputes" element={<DisputesList />} />
          <Route path="/bank/disputes/:id" element={<DisputeCase />} />
          <Route path="/bank/audit" element={<AuditLog />} />
          <Route path="/bank/config" element={<ProgramConfig />} />
          <Route path="/bank/invoices/:id" element={<InvoiceDetail />} />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
