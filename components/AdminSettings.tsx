
import React, { useState, useEffect } from 'react';
import { User, UserRole, Organization } from '../types';
import { fetchUsers, dbUpsertUser, dbDeleteUser, fetchOrganizations, dbAddOrganization, dbUpdateOrganization, dbDeleteOrganization } from '../services/db';

interface AdminSettingsProps {
  currentUser: User;
  t: any;
  isRtl: boolean;
}

const AdminSettings: React.FC<AdminSettingsProps> = ({ currentUser, t, isRtl }) => {
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'orgs'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
  
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const [userData, orgData] = await Promise.all([fetchUsers(), fetchOrganizations()]);
    setUsers(userData);
    setOrgs(orgData);
    setIsLoading(false);
  };

  const handleUpsertUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    // Get selected organizations from checkboxes
    const selectedOrgs = orgs
      .filter(o => formData.get(`org_${o.id}`) === 'on')
      .map(o => o.id);

    const newUser: User = {
      id: editingUser?.id || crypto.randomUUID(),
      username: formData.get('username') as string,
      password: (formData.get('password') as string) || undefined,
      displayName: formData.get('displayName') as string,
      role: formData.get('role') as UserRole,
      permissions: {
        viewDashboard: formData.get('viewDashboard') === 'on',
        viewEmployees: formData.get('viewEmployees') === 'on',
        viewReports: formData.get('viewReports') === 'on',
        canEdit: formData.get('canEdit') === 'on',
        accessibleOrganizations: selectedOrgs
      }
    };

    try {
      await dbUpsertUser(newUser);
      loadData();
      setIsUserModalOpen(false);
      setEditingUser(null);
    } catch (err) {
      alert("Failed to save user.");
    }
  };

  const handleUpsertOrg = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const orgName = formData.get('orgName') as string;
    const taxId = formData.get('taxId') as string;

    try {
      if (editingOrg) {
        await dbUpdateOrganization(editingOrg.id, { name: orgName, taxId });
      } else {
        const newOrg: Organization = {
          id: crypto.randomUUID(),
          name: orgName,
          taxId: taxId
        };
        await dbAddOrganization(newOrg);
      }
      loadData();
      setIsOrgModalOpen(false);
      setEditingOrg(null);
    } catch (err) {
      alert("Failed to save organization.");
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (id === currentUser.id) return alert("Cannot delete current user.");
    if (confirm(t.deleteUserConfirm)) {
      await dbDeleteUser(id);
      loadData();
    }
  };

  const handleDeleteOrg = async (id: string) => {
    if (confirm(isRtl ? 'حذف المنشأة سيؤدي لحذف كافة موظفيها، هل أنت متأكد؟' : 'Deleting entity will remove all its employees. Proceed?')) {
      await dbDeleteOrganization(id);
      loadData();
    }
  };

  return (
    <div className="space-y-8">
      {/* Sub Tabs */}
      <div className="flex bg-white p-1 rounded-2xl shadow-sm border w-full md:w-auto self-start no-print">
        <button 
          onClick={() => setActiveSubTab('users')}
          className={`px-8 py-3 rounded-xl text-sm font-black transition-all ${activeSubTab === 'users' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}
        >
          👥 {t.userManagement}
        </button>
        <button 
          onClick={() => setActiveSubTab('orgs')}
          className={`px-8 py-3 rounded-xl text-sm font-black transition-all ${activeSubTab === 'orgs' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}
        >
          🏢 {t.orgSettings}
        </button>
      </div>

      {activeSubTab === 'users' ? (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border flex justify-between items-center">
            <div>
              <h2 className="text-xl font-black text-gray-800 tracking-tight">{t.userManagement}</h2>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Configure users and access levels</p>
            </div>
            <button 
              onClick={() => { setEditingUser(null); setIsUserModalOpen(true); }}
              className="px-6 py-2 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
            >
              + {t.addUser}
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left rtl:text-right">
                <thead className="bg-gray-50 border-b text-gray-500 font-black uppercase text-[10px] tracking-widest">
                  <tr>
                    <th className="px-6 py-4">{t.displayName}</th>
                    <th className="px-6 py-4">{t.username}</th>
                    <th className="px-6 py-4">{t.role}</th>
                    <th className="px-6 py-4">{t.selectOrganization}</th>
                    <th className="px-6 py-4 text-center">{t.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map(user => (
                    <tr key={user.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-6 py-4 font-black text-gray-800">{user.displayName}</td>
                      <td className="px-6 py-4 font-mono text-gray-500">{user.username}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
                          user.role === 'ADMIN' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {user.role === 'ADMIN' ? t.admin : t.user}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                         <div className="flex gap-1 flex-wrap">
                           {user.permissions.accessibleOrganizations?.map(orgId => {
                             const org = orgs.find(o => o.id === orgId);
                             return org ? (
                               <span key={orgId} className="text-[9px] bg-green-50 text-green-700 border border-green-100 px-1.5 py-0.5 rounded-full font-bold">
                                 {org.name}
                               </span>
                             ) : null;
                           })}
                         </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => { setEditingUser(user); setIsUserModalOpen(true); }} className="p-2 hover:bg-white rounded-lg transition shadow-sm border border-transparent hover:border-gray-100">✏️</button>
                          {user.username !== 'Admin' && <button onClick={() => handleDeleteUser(user.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-500">🗑️</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border flex justify-between items-center">
            <div>
              <h2 className="text-xl font-black text-gray-800 tracking-tight">{t.orgSettings}</h2>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Manage Entities and Establishment Data</p>
            </div>
            <button 
              onClick={() => { setEditingOrg(null); setIsOrgModalOpen(true); }}
              className="px-6 py-2 bg-green-600 text-white font-black rounded-xl hover:bg-green-700 shadow-lg shadow-green-100 transition-all"
            >
              + {t.addOrganization}
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
             <div className="overflow-x-auto">
               <table className="w-full text-sm text-left rtl:text-right">
                 <thead className="bg-gray-50 border-b text-gray-500 font-black uppercase text-[10px] tracking-widest">
                   <tr>
                     <th className="px-6 py-4">{t.orgName}</th>
                     <th className="px-6 py-4">{t.taxId}</th>
                     <th className="px-6 py-4 text-center">{t.actions}</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100">
                    {orgs.map(org => (
                      <tr key={org.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-black text-gray-800">{org.name}</td>
                        <td className="px-6 py-4 font-mono text-gray-400 uppercase">{org.taxId || '-'}</td>
                        <td className="px-6 py-4 text-center">
                           <div className="flex justify-center gap-2">
                             <button onClick={() => { setEditingOrg(org); setIsOrgModalOpen(true); }} className="p-2 hover:bg-white rounded-lg transition shadow-sm border border-transparent hover:border-gray-100">✏️</button>
                             <button onClick={() => handleDeleteOrg(org.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-500">🗑️</button>
                           </div>
                        </td>
                      </tr>
                    ))}
                 </tbody>
               </table>
             </div>
          </div>
        </div>
      )}

      {/* User Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 bg-indigo-600 text-white flex justify-between items-center">
              <h3 className="text-xl font-black tracking-tight">{editingUser ? t.editEmployee : t.addUser}</h3>
              <button onClick={() => setIsUserModalOpen(false)} className="hover:scale-110 transition">✕</button>
            </div>
            <form onSubmit={handleUpsertUser} className="p-8 space-y-6 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-xs font-black text-gray-400 uppercase mb-1">{t.displayName}</label>
                  <input name="displayName" required defaultValue={editingUser?.displayName} className="w-full px-4 py-2 bg-gray-50 border rounded-xl font-bold focus:border-indigo-500 outline-none" />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-xs font-black text-gray-400 uppercase mb-1">{t.username}</label>
                  <input name="username" required defaultValue={editingUser?.username} className="w-full px-4 py-2 bg-gray-50 border rounded-xl font-bold focus:border-indigo-500 outline-none" />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-xs font-black text-gray-400 uppercase mb-1">{t.password}</label>
                  <input type="password" name="password" placeholder={editingUser ? "••••••" : "Default: 123456"} className="w-full px-4 py-2 bg-gray-50 border rounded-xl font-bold focus:border-indigo-500 outline-none" />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-xs font-black text-gray-400 uppercase mb-1">{t.role}</label>
                  <select name="role" defaultValue={editingUser?.role || 'USER'} className="w-full px-4 py-2 bg-gray-50 border rounded-xl font-bold focus:border-indigo-500 outline-none">
                    <option value="ADMIN">{t.admin}</option>
                    <option value="USER">{t.user}</option>
                  </select>
                </div>
              </div>

              <div className="p-5 bg-gray-50 rounded-2xl space-y-4">
                 <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t.selectOrganization}</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                   {orgs.map(org => (
                     <label key={org.id} className="flex items-center gap-3 p-3 bg-white border rounded-xl cursor-pointer hover:border-indigo-300">
                        <input 
                          type="checkbox" 
                          name={`org_${org.id}`} 
                          defaultChecked={editingUser?.permissions.accessibleOrganizations?.includes(org.id)}
                          className="w-5 h-5 rounded accent-indigo-600" 
                        />
                        <span className="text-sm font-bold text-gray-700">{org.name}</span>
                     </label>
                   ))}
                 </div>
              </div>

              <div className="p-5 bg-gray-50 rounded-2xl space-y-3">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{t.permissions}</h4>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input type="checkbox" name="viewDashboard" defaultChecked={editingUser?.permissions.viewDashboard ?? true} className="w-5 h-5 rounded accent-indigo-600" />
                    <span className="text-sm font-bold text-gray-700 group-hover:text-indigo-600">{t.viewDashboard}</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input type="checkbox" name="viewEmployees" defaultChecked={editingUser?.permissions.viewEmployees ?? true} className="w-5 h-5 rounded accent-indigo-600" />
                    <span className="text-sm font-bold text-gray-700 group-hover:text-indigo-600">{t.viewEmployees}</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input type="checkbox" name="viewReports" defaultChecked={editingUser?.permissions.viewReports ?? true} className="w-5 h-5 rounded accent-indigo-600" />
                    <span className="text-sm font-bold text-gray-700 group-hover:text-indigo-600">{t.viewReports}</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input type="checkbox" name="canEdit" defaultChecked={editingUser?.permissions.canEdit ?? true} className="w-5 h-5 rounded accent-indigo-600" />
                    <span className="text-sm font-bold text-gray-700 group-hover:text-indigo-600">{t.canEdit}</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsUserModalOpen(false)} className="px-6 py-2 font-bold text-gray-500 hover:text-gray-700">{t.cancel}</button>
                <button type="submit" className="px-8 py-2 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 transition-all">{t.save}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Organization Modal */}
      {isOrgModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
             <div className="p-6 bg-green-600 text-white flex justify-between items-center">
               <h3 className="text-xl font-black tracking-tight">{editingOrg ? t.editOrganization : t.addOrganization}</h3>
               <button onClick={() => { setIsOrgModalOpen(false); setEditingOrg(null); }} className="hover:scale-110">✕</button>
             </div>
             <form onSubmit={handleUpsertOrg} className="p-8 space-y-6">
                <div>
                   <label className="block text-xs font-black text-gray-400 uppercase mb-1">{t.orgName}</label>
                   <input name="orgName" required defaultValue={editingOrg?.name} className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent rounded-xl font-bold focus:border-green-500 focus:bg-white outline-none transition-all" />
                </div>
                <div>
                   <label className="block text-xs font-black text-gray-400 uppercase mb-1">{t.taxId}</label>
                   <input name="taxId" defaultValue={editingOrg?.taxId} className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent rounded-xl font-bold focus:border-green-500 focus:bg-white outline-none transition-all" />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => { setIsOrgModalOpen(false); setEditingOrg(null); }} className="px-6 py-2 font-bold text-gray-500">{t.cancel}</button>
                  <button type="submit" className="px-8 py-2 bg-green-600 text-white font-black rounded-xl hover:bg-green-700 transition-all">{t.save}</button>
                </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSettings;
