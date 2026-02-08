
import React from 'react';
import { Language, User, Organization } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  t: any;
  isRtl: boolean;
  language: Language;
  setLanguage: (lang: Language) => void;
  user: User | null;
  selectedOrg: Organization | null;
  onSwitchOrg: () => void;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, t, isRtl, language, setLanguage, user, selectedOrg, onSwitchOrg, onLogout }) => {
  const menuItems = [
    { id: 'dashboard', icon: '📊', label: t.dashboard, visible: user?.permissions.viewDashboard },
    { id: 'employees', icon: '👥', label: t.employees, visible: user?.permissions.viewEmployees },
    { id: 'archive', icon: '🗄️', label: t.archive, visible: user?.permissions.viewEmployees },
    { id: 'reports', icon: '📝', label: t.reports, visible: user?.permissions.viewReports },
    { id: 'settings', icon: '⚙️', label: t.settings, visible: user?.role === 'ADMIN' },
  ].filter(item => item.visible);

  return (
    <aside className="w-64 bg-white shadow-xl flex flex-col h-screen sticky top-0 z-40 no-print">
      <div className="p-6 border-b">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-green-100">
            S
          </div>
          <span className="text-xl font-black text-gray-800 tracking-tight">{t.title}</span>
        </div>
      </div>

      {selectedOrg && (
        <div className="p-4 mt-2">
          <div className="bg-green-50 p-3 rounded-2xl border border-green-100 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">🏢</span>
              <div className="overflow-hidden">
                <p className="text-xs font-black text-green-800 truncate">{selectedOrg.name}</p>
                <p className="text-[8px] font-bold text-green-600 uppercase tracking-widest">{t.active}</p>
              </div>
            </div>
            <button
              onClick={onSwitchOrg}
              className="w-full py-1.5 bg-white border border-green-200 rounded-lg text-[9px] font-black text-green-700 hover:bg-green-100 transition-all uppercase tracking-tighter"
            >
              🔄 {t.switchOrg}
            </button>
          </div>
        </div>
      )}

      <nav className="flex-1 py-4 space-y-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center px-6 py-4 text-sm font-bold transition-all ${activeTab === item.id
                ? 'bg-green-50 text-green-700 border-r-4 border-green-600 rtl:border-r-0 rtl:border-l-4'
                : 'text-gray-500 hover:bg-gray-50'
              }`}
          >
            <span className="text-xl mr-3 rtl:ml-3">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-6 border-t space-y-6">
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setLanguage('en')}
            className={`flex-1 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${language === 'en' ? 'bg-white shadow-sm text-green-700' : 'text-gray-400'
              }`}
          >
            EN
          </button>
          <button
            onClick={() => setLanguage('ar')}
            className={`flex-1 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${language === 'ar' ? 'bg-white shadow-sm text-green-700' : 'text-gray-400'
              }`}
          >
            AR
          </button>
        </div>

        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-black text-red-500 bg-red-50 hover:bg-red-100 rounded-xl transition-all"
        >
          <span>🚪</span>
          {t.logout}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
