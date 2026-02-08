
import React, { useState, useEffect } from 'react';
import { Organization, User } from '../types';
import { fetchUserOrganizations } from '../services/db';

interface OrgSelectionProps {
  user: User;
  t: any;
  isRtl: boolean;
  onSelect: (org: Organization) => void;
  onLogout: () => void;
}

const OrgSelection: React.FC<OrgSelectionProps> = ({ user, t, isRtl, onSelect, onLogout }) => {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const data = await fetchUserOrganizations(user.id);
      setOrgs(data);
      setIsLoading(false);
      // If only one org, select automatically
      if (data.length === 1) {
        onSelect(data[0]);
      }
    };
    load();
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-green-100 border-t-green-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="max-w-2xl w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
        <div className="p-10">
          <div className="text-center mb-10">
            <h1 className="text-2xl font-black text-gray-800 tracking-tight">{t.selectOrganization}</h1>
            <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mt-2">{user.displayName}</p>
          </div>

          {orgs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {orgs.map((org) => (
                <button
                  key={org.id}
                  onClick={() => onSelect(org)}
                  className="p-6 bg-gray-50 border-2 border-transparent hover:border-green-500 hover:bg-white rounded-2xl transition-all group flex flex-col items-center text-center"
                >
                  <div className="w-12 h-12 bg-green-100 text-green-600 rounded-xl flex items-center justify-center text-xl mb-4 group-hover:bg-green-600 group-hover:text-white transition-all">
                    🏢
                  </div>
                  <span className="font-black text-gray-800">{org.name}</span>
                  {org.taxId && <span className="text-[10px] text-gray-400 mt-1 uppercase font-bold">{t.taxId}: {org.taxId}</span>}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="text-gray-400 font-bold">{t.noOrgs}</p>
            </div>
          )}

          <div className="mt-10 flex justify-center">
            <button onClick={onLogout} className="text-xs font-black text-red-500 hover:underline uppercase tracking-widest">
              {t.logout}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrgSelection;
