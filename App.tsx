import React, { useState, useEffect, useCallback } from 'react';
import { OzonCredentials, OzonPosting } from './types';
import { fetchAggregatedOrders } from './services/ozonService';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import { Menu } from 'lucide-react';

const App: React.FC = () => {
  // Credentials is now an array
  const [credentialsList, setCredentialsList] = useState<OzonCredentials[]>([]);
  const [currentView, setCurrentView] = useState<'dashboard' | 'settings'>('dashboard');
  const [orders, setOrders] = useState<OzonPosting[]>([]);
  const [loading, setLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Initial load checks localStorage
  useEffect(() => {
    const savedCreds = localStorage.getItem('ozon_creds_multi');
    if (savedCreds) {
      try {
        const parsed = JSON.parse(savedCreds);
        // Handle migration from old single object format if necessary
        if (!Array.isArray(parsed) && parsed.clientId) {
            setCredentialsList([parsed]);
        } else {
            setCredentialsList(parsed);
        }
      } catch (e) {
        console.error("Error parsing credentials", e);
        setCurrentView('settings');
      }
    } else {
      // Fallback to check old key for backward compatibility
      const oldCreds = localStorage.getItem('ozon_creds');
      if (oldCreds) {
          setCredentialsList([JSON.parse(oldCreds)]);
      } else {
          setCurrentView('settings');
      }
    }
  }, []);

  const loadData = useCallback(async (creds: OzonCredentials[]) => {
    if (creds.length === 0) return;
    setLoading(true);
    try {
      // Fetch from all stores and aggregate
      const data = await fetchAggregatedOrders(creds);
      setOrders(data);
    } catch (error) {
      console.error("Failed to load orders", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch data when credentials change or are loaded
  useEffect(() => {
    if (credentialsList.length > 0 && currentView === 'dashboard') {
      loadData(credentialsList);
    }
  }, [credentialsList, currentView, loadData]);

  const handleSaveSettings = (creds: OzonCredentials[]) => {
    setCredentialsList(creds);
    localStorage.setItem('ozon_creds_multi', JSON.stringify(creds));
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('ozon_creds');
    localStorage.removeItem('ozon_creds_multi');
    setCredentialsList([]);
    setOrders([]);
    setCurrentView('settings');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 w-full bg-white border-b border-slate-200 z-30 px-4 py-3 flex items-center justify-between shadow-sm">
        <span className="font-bold text-slate-800">Ozon助手 (多店铺版)</span>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 bg-slate-100 rounded-md">
           <Menu size={20} className="text-slate-600"/>
        </button>
      </div>

      {/* Sidebar (Desktop + Mobile) */}
      <div className={`md:block ${mobileMenuOpen ? 'block' : 'hidden'} fixed inset-0 z-40 md:static md:z-0 bg-slate-900/50 md:bg-transparent`}>
         <div className="md:hidden absolute right-4 top-4 text-white" onClick={() => setMobileMenuOpen(false)}>X</div>
         <Sidebar 
            currentView={currentView} 
            onChangeView={(view) => {
                setCurrentView(view);
                setMobileMenuOpen(false);
            }} 
            onLogout={handleLogout} 
         />
      </div>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 mt-14 md:mt-0 transition-all">
        {/* Dynamic Header based on View */}
        <header className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
                {currentView === 'dashboard' ? '销售概览' : '配置中心'}
            </h1>
            <p className="text-slate-500 mt-1">
                {currentView === 'dashboard' 
                    ? `已聚合 ${credentialsList.length} 个店铺数据` 
                    : '批量管理您的 Ozon 店铺凭证'}
            </p>
        </header>

        {credentialsList.length === 0 && currentView === 'dashboard' ? (
           <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl shadow-sm border border-slate-200">
             <h2 className="text-xl font-semibold text-slate-800 mb-2">尚未配置店铺</h2>
             <p className="text-slate-500 mb-6">请导入 Client ID 和 API Key 以查看数据。</p>
             <button 
               onClick={() => setCurrentView('settings')}
               className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
             >
               去配置
             </button>
           </div>
        ) : (
            currentView === 'dashboard' ? (
                <Dashboard orders={orders} loading={loading} />
            ) : (
                <Settings 
                    onSave={handleSaveSettings} 
                    initialCreds={credentialsList} 
                />
            )
        )}
      </main>
    </div>
  );
};

export default App;