
import React, { useState, useEffect } from 'react';
import { translations } from './translations';
import { Employee, Language, User, Organization } from './types';
import Dashboard from './components/Dashboard';
import EmployeeManagement from './components/EmployeeManagement';
import Reports from './components/Reports';
import Sidebar from './components/Sidebar';
import Login from './components/Login';
import OrgSelection from './components/OrgSelection';
import AdminSettings from './components/AdminSettings';
import { initDatabase, fetchEmployees, dbAddEmployee, dbUpdateEmployee, dbDeleteEmployee } from './services/db';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'employees' | 'archive' | 'reports' | 'settings'>('dashboard');
  const [language, setLanguage] = useState<Language>('ar');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const startApp = async () => {
      setIsLoading(true);
      try {
        await initDatabase();
        const savedUser = localStorage.getItem('esb_session');
        const savedOrg = localStorage.getItem('esb_org');
        if (savedUser) {
          const parsedUser = JSON.parse(savedUser);
          setUser(parsedUser);
          if (savedOrg) {
            setSelectedOrg(JSON.parse(savedOrg));
          }
        }
      } catch (err) {
        console.error("Initialization error:", err);
      } finally {
        setIsLoading(false);
      }
    };
    startApp();
  }, []);

  useEffect(() => {
    if (user && selectedOrg) {
      loadEmployees();
    }
  }, [user, selectedOrg]);

  const loadEmployees = async () => {
    if (!selectedOrg) return;
    const data = await fetchEmployees(selectedOrg.id);
    setEmployees(data);
  };

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    localStorage.setItem('esb_session', JSON.stringify(loggedInUser));
  };

  const handleOrgSelect = (org: Organization) => {
    setSelectedOrg(org);
    localStorage.setItem('esb_org', JSON.stringify(org));
  };

  const handleLogout = () => {
    setUser(null);
    setSelectedOrg(null);
    localStorage.removeItem('esb_session');
    localStorage.removeItem('esb_org');
  };

  const handleSwitchOrg = () => {
    setSelectedOrg(null);
    localStorage.removeItem('esb_org');
  };

  const t = translations[language];
  const isRtl = language === 'ar';

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 flex-col gap-4">
        <div className="w-12 h-12 border-4 border-green-100 border-t-green-600 rounded-full animate-spin"></div>
        <p className="text-gray-400 font-bold tracking-widest uppercase text-xs">Connecting Securely...</p>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} t={t} isRtl={isRtl} />;
  }

  if (!selectedOrg) {
    return <OrgSelection user={user} t={t} isRtl={isRtl} onSelect={handleOrgSelect} onLogout={handleLogout} />;
  }

  const addEmployee = async (empData: Omit<Employee, 'id' | 'organizationId'>) => {
    if (!user?.permissions.canEdit) {
      alert(isRtl ? 'عفواً، لا تملك صلاحية التعديل' : 'Sorry, you do not have edit permissions');
      return;
    }
    const newEmp: Employee = {
      ...empData,
      id: crypto.randomUUID(),
      organizationId: selectedOrg.id
    };
    const originalEmployees = [...employees];
    try {
      // Optimistic update
      setEmployees(prev => [...prev, newEmp]);
      await dbAddEmployee(newEmp);
      // Force sync with DB
      await loadEmployees();
    } catch (err) {
      console.error("Add employee error:", err);
      setEmployees(originalEmployees);
      alert(isRtl ? 'حدث خطأ أثناء حفظ البيانات' : 'Error saving data');
    }
  };

  const updateEmployee = async (id: string, updatedFields: Partial<Employee>) => {
    if (!user?.permissions.canEdit) return;
    const originalEmployees = [...employees];
    try {
      // Optimistic update
      setEmployees(prev => prev.map(e => e.id === id ? { ...e, ...updatedFields } : e));
      await dbUpdateEmployee(id, updatedFields);
      // Force sync with DB
      await loadEmployees();
    } catch (err) {
      console.error("Update employee error:", err);
      setEmployees(originalEmployees);
    }
  };

  const deleteEmployee = async (id: string) => {
    if (!user?.permissions.canEdit) return;
    if (confirm(isRtl ? 'هل أنت متأكد من حذف الموظف؟' : 'Are you sure?')) {
      const originalEmployees = [...employees];
      try {
        // Optimistic update
        setEmployees(prev => prev.filter(e => e.id !== id));
        await dbDeleteEmployee(id);
        // Force sync with DB
        await loadEmployees();
      } catch (err) {
        console.error("Delete employee error:", err);
        setEmployees(originalEmployees);
      }
    }
  };

  return (
    <div className={`flex min-h-screen bg-gray-50 ${isRtl ? 'rtl text-right' : 'ltr text-left'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        t={t}
        isRtl={isRtl}
        language={language}
        setLanguage={setLanguage}
        user={user}
        selectedOrg={selectedOrg}
        onSwitchOrg={handleSwitchOrg}
        onLogout={handleLogout}
      />

      <main className="flex-1 p-4 md:p-10 overflow-y-auto">
        <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
          <div>
            <h1 className="text-3xl font-black text-gray-800 tracking-tight uppercase">
              {t[activeTab]}
            </h1>
            <p className="text-xs text-gray-400 font-bold tracking-widest mt-1 uppercase">
              {selectedOrg.name} / {user?.displayName}
            </p>
          </div>
          <div className="flex gap-3">
            <div className="text-sm font-black text-gray-400 bg-white px-6 py-3 rounded-2xl shadow-sm border border-gray-100">
              {new Date().toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
                year: 'numeric', month: 'long', day: 'numeric'
              })}
            </div>
          </div>
        </header>

        <>
          {activeTab === 'dashboard' && user?.permissions.viewDashboard && (
            <Dashboard employees={employees} t={t} isRtl={isRtl} />
          )}
          {activeTab === 'employees' && user?.permissions.viewEmployees && (
            <EmployeeManagement
              employees={employees.filter(e => e.status === 'ACTIVE')}
              t={t}
              isRtl={isRtl}
              addEmployee={addEmployee}
              updateEmployee={updateEmployee}
              deleteEmployee={deleteEmployee}
              canEdit={user.permissions.canEdit}
            />
          )}
          {activeTab === 'archive' && user?.permissions.viewEmployees && (
            <EmployeeManagement
              employees={employees.filter(e => e.status !== 'ACTIVE')}
              t={t}
              isRtl={isRtl}
              addEmployee={addEmployee}
              updateEmployee={updateEmployee}
              deleteEmployee={deleteEmployee}
              canEdit={user.permissions.canEdit}
            />
          )}
          {activeTab === 'reports' && user?.permissions.viewReports && (
            <Reports employees={employees} t={t} isRtl={isRtl} language={language} />
          )}
          {activeTab === 'settings' && user?.role === 'ADMIN' && (
            <AdminSettings currentUser={user} t={t} isRtl={isRtl} />
          )}
        </>
      </main>
    </div>
  );
};

export default App;
