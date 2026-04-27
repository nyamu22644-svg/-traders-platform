/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SiteProvider } from './contexts/SiteContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Sites from './pages/Sites';
import CreateSite from './pages/CreateSite';
import SiteDetail from './pages/SiteDetail';
import Settings from './pages/Settings';
import SitePreview from './pages/SitePreview';
import Commissions from './pages/Commissions';
import AdminPanel from './pages/AdminPanel';
import DerivCallback from './pages/DerivCallback';
import Domains from './pages/Domains';
import Deployments from './pages/Deployments';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/preview/:id" element={<SitePreview />} />
          <Route path="/deploy/:slug" element={<SitePreview />} />
          <Route path="/auth/deriv/callback" element={<DerivCallback />} />
          <Route path="/auth/deriv/call" element={<DerivCallback />} />
          
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/sites" element={<Sites />} />
            <Route path="/domains" element={<Domains />} />
            <Route path="/deployments" element={<Deployments />} />
            <Route path="/commissions" element={<Commissions />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/sites/new" element={<CreateSite />} />
            <Route path="/sites/:id" element={
              <SiteProvider>
                <SiteDetail />
              </SiteProvider>
            } />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}


