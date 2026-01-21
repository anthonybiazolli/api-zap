import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

const API_URL = '/api/interno';

export default function Login() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(form)
        });
        const data = await res.json();
        
        if (res.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            // Se for Super Admin, vai pro painel SaaS, senão Dashboard normal
            if (data.user.role === 'SUPER_ADMIN') router.push('/saas-admin');
            else router.push('/');
        } else {
            setError(data.error || 'Acesso negado.');
        }
    } catch (err) { setError('Servidor indisponível.'); } 
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center font-sans bg-[#0f172a] relative overflow-hidden">
      <Head><title>Acesso Restrito - DispIA</title></Head>
      
      {/* Background Effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px]"></div>

      <div className="w-full max-w-md p-1 relative z-10">
        <div className="bg-[#1e293b]/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-8">
            
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-tr from-blue-500 to-purple-600 rounded-xl shadow-lg mb-4 text-3xl">
                    🚀
                </div>
                <h1 className="text-2xl font-bold text-white tracking-tight">DispIA Enterprise</h1>
                <p className="text-gray-400 text-sm mt-1">Plataforma de Automação B2B</p>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-200 text-sm p-3 rounded-lg mb-6 text-center">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label className="text-xs font-bold text-gray-400 uppercase ml-1">Email Corporativo</label>
                    <input 
                        type="email" 
                        autoComplete="email"
                        className="w-full mt-1 bg-[#0f172a]/50 border border-gray-600 text-white p-3 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition placeholder-gray-600"
                        placeholder="nome@empresa.com"
                        value={form.email}
                        onChange={e => setForm({...form, email: e.target.value})}
                        required
                    />
                </div>
                
                <div>
                    <label className="text-xs font-bold text-gray-400 uppercase ml-1">Senha de Acesso</label>
                    <input 
                        type="password" 
                        autoComplete="current-password"
                        className="w-full mt-1 bg-[#0f172a]/50 border border-gray-600 text-white p-3 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition placeholder-gray-600"
                        placeholder="••••••••"
                        value={form.password}
                        onChange={e => setForm({...form, password: e.target.value})}
                        required
                    />
                </div>

                <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-bold py-3.5 rounded-lg shadow-lg shadow-blue-900/50 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {loading ? 'Validando Credenciais...' : 'Acessar Painel'}
                </button>
            </form>

            <div className="mt-8 text-center">
                <p className="text-xs text-gray-500">
                    Não tem acesso? <span className="text-gray-400">Contate o administrador da sua organização.</span>
                </p>
            </div>
        </div>
        
        <p className="text-center text-gray-600 text-xs mt-6">
            &copy; 2026 DispIA Technology. All rights reserved.
        </p>
      </div>
    </div>
  );
}