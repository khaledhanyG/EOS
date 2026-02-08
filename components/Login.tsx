
import React, { useState } from 'react';
import { loginUser } from '../services/db';
import { User, Language } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
  t: any;
  isRtl: boolean;
}

const Login: React.FC<LoginProps> = ({ onLogin, t, isRtl }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoggingIn(true);
    const user = await loginUser(username, password);
    setIsLoggingIn(false);
    if (user) {
      onLogin(user);
    } else {
      setError(t.loginError);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
        <div className="p-10">
          <div className="flex flex-col items-center mb-10">
            <div className="w-16 h-16 bg-green-600 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-lg mb-4">
              S
            </div>
            <h1 className="text-2xl font-black text-gray-800 tracking-tight">{t.title}</h1>
            <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mt-2">{t.login}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 px-1">{t.username}</label>
              <input
                type="text"
                required
                className="w-full px-5 py-3 bg-gray-50 border-2 border-gray-50 rounded-xl focus:border-green-500 focus:bg-white focus:outline-none transition-all font-bold"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. Admin"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 px-1">{t.password}</label>
              <input
                type="password"
                required
                className="w-full px-5 py-3 bg-gray-50 border-2 border-gray-50 rounded-xl focus:border-green-500 focus:bg-white focus:outline-none transition-all font-bold"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-xl text-center border border-red-100">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className={`w-full py-4 bg-green-600 text-white font-black rounded-xl shadow-lg shadow-green-200 hover:bg-green-700 hover:scale-[1.02] transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2`}
            >
              {isLoggingIn ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <span>{t.login}</span>
              )}
            </button>
          </form>
        </div>
        <div className="p-4 bg-gray-50 border-t text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest">
          &copy; 2025 Saudi EOS Pro - Secure Access
        </div>
      </div>
    </div>
  );
};

export default Login;
