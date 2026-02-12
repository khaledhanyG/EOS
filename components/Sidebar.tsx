
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
    { id: 'services', icon: '🧰', label: t.services, visible: true },
    { id: 'settings', icon: '⚙️', label: t.settings, visible: user?.role === 'ADMIN' },
  ].filter(item => item.visible);

  return (
    <header className="w-full bg-white shadow-md flex items-center justify-between px-6 py-3 sticky top-0 z-50 no-print">
      {/* Logo and Title */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-green-100">
            S
          </div>
          <span className="text-lg font-black text-gray-800 tracking-tight hidden md:block">{t.title}</span>
        </div>
        
        {selectedOrg && (
          <div className="bg-green-50 px-4 py-2 rounded-xl border border-green-100 flex items-center gap-2">
            <span className="text-sm">🏢</span>
            <div>
              <p className="text-xs font-black text-green-800">{selectedOrg.name}</p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Menu */}
      <nav className="flex items-center gap-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl transition-all ${
              activeTab === item.id
                ? 'bg-green-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            <span className="hidden lg:inline">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Right Side: Language, Org Switch, Logout */}
      <div className="flex items-center gap-3">
        {/* Language Switcher */}
        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setLanguage('en')}
            className={`px-3 py-1 text-[10px] font-black uppercase rounded transition-all ${
              language === 'en' ? 'bg-white shadow-sm text-green-700' : 'text-gray-400'
            }`}
          >
            EN
          </button>
          <button
            onClick={() => setLanguage('ar')}
            className={`px-3 py-1 text-[10px] font-black uppercase rounded transition-all ${
              language === 'ar' ? 'bg-white shadow-sm text-green-700' : 'text-gray-400'
            }`}
          >
            AR
          </button>
        </div>

        {/* Switch Org Button */}
        {selectedOrg && (
          <button
            onClick={onSwitchOrg}
            className="hidden md:flex items-center gap-1 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs font-bold text-green-700 hover:bg-green-100 transition-all"
            title={t.switchOrg}
          >
            🔄
          </button>
        )}

        {/* Logout */}
        <button
          onClick={onLogout}
          className="flex items-center gap-1 px-3 py-2 text-xs font-black text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-all"
          title={t.logout}
        >
          <span>🚪</span>
        </button>
      </div>
    </header>
  );
};

export default Sidebar;
