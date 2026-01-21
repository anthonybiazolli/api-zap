import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { QRCodeSVG } from 'qrcode.react';

const API_URL = '/api/interno';

export default function Admin() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [instances, setInstances] = useState([]);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [loadingAuth, setLoadingAuth] = useState(true);

  // === PROTEÇÃO DE ROTA ===
  useEffect(() => {
      const storedUser = localStorage.getItem('user');
      const token = localStorage.getItem('token');

      if (!storedUser || !token) {
          router.push('/login');
      } else {
          const u = JSON.parse(storedUser);
          setUser(u);
          setLoadingAuth(false);
          loadInstances(u.id);
      }
  }, []);

  const handleLogout = () => {
      localStorage.clear();
      router.push('/login');
  };

  const loadInstances = async (userId) => {
      try {
        const res = await fetch(`${API_URL}/instances/user/${userId}`);
        if(res.ok) setInstances(await res.json());
      } catch(e) {}
  };

  const handleCreate = async () => {
      if(!newInstanceName) return;
      await fetch(`${API_URL}/instances`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ name: newInstanceName, userId: user.id, pacote: 'PRO' })
      });
      setNewInstanceName('');
      loadInstances(user.id);
  };

  const handleConnect = async (id) => {
      await fetch(`${API_URL}/instances/${id}/connect`, { method: 'POST' });
      setTimeout(() => loadInstances(user.id), 2000);
  };

  if (loadingAuth) return <div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-white">Verificando acesso...</div>;

  return (
    <div className="min-h-screen bg-[#0f172a] text-gray-100 font-sans pb-20">
        <Head><title>Admin - DispIA</title></Head>
        
        {/* NAVBAR PADRÃO */}
        <nav className="bg-[#1e293b] border-b border-gray-700 px-6 py-4 flex justify-between items-center shadow-md sticky top-0 z-40 mb-8">
            <div className="flex items-center gap-3">
                <Link href="/" className="text-2xl cursor-pointer">🤖</Link>
                <Link href="/" className="text-xl font-bold tracking-wide cursor-pointer">DispIA <span className="text-blue-400">Hub</span></Link>
            </div>
            <div className="flex items-center gap-4 text-sm">
                <div className="text-right hidden md:block">
                    <p className="text-white font-bold">{user?.nome}</p>
                    <p className="text-xs text-gray-400 uppercase">{user?.role}</p>
                </div>
                <button onClick={handleLogout} className="bg-red-900/30 text-red-400 border border-red-800 px-4 py-2 rounded hover:bg-red-900/50 transition">Sair</button>
            </div>
        </nav>

        <div className="max-w-4xl mx-auto px-6">
            <h1 className="text-3xl font-bold mb-8">Gerenciar Instâncias</h1>

            {/* Criar Nova */}
            <div className="bg-white p-6 rounded-xl shadow mb-8 text-gray-800 flex gap-4 items-end">
                <div className="flex-1">
                    <label className="block text-xs font-bold mb-1">Nome da Nova Instância</label>
                    <input value={newInstanceName} onChange={e => setNewInstanceName(e.target.value)} className="w-full border p-2 rounded" placeholder="Ex: Vendas Filial 2" />
                </div>
                <button onClick={handleCreate} className="bg-green-600 text-white px-6 py-2 rounded font-bold hover:bg-green-700 h-10">+ Adicionar</button>
            </div>

            {/* Lista */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {instances.map(inst => (
                    <div key={inst.id} className="bg-[#1e293b] border border-gray-700 p-6 rounded-xl relative">
                        <div className="flex justify-between items-start mb-4">
                            <div><h3 className="font-bold text-xl">{inst.name}</h3><p className="text-xs text-gray-400 font-mono">{inst.id}</p></div>
                            <span className={`px-2 py-1 rounded text-xs font-bold ${inst.statusReal === 'connected' ? 'bg-green-500 text-white' : 'bg-yellow-500 text-black'}`}>{inst.statusReal}</span>
                        </div>
                        {inst.statusReal !== 'connected' && (
                            <div className="flex flex-col items-center bg-black/20 p-4 rounded mb-4">
                                {inst.qrCode ? <QRCodeSVG value={inst.qrCode} size={150} className="bg-white p-2 rounded" /> : <p className="text-xs text-gray-400">Clique para conectar</p>}
                                <button onClick={() => handleConnect(inst.id)} className="mt-2 text-blue-400 underline text-sm">{inst.qrCode ? 'Atualizar QR' : 'Gerar QR Code'}</button>
                            </div>
                        )}
                        <div className="flex gap-2 mt-4">
                            <button className="flex-1 bg-blue-600 py-2 rounded text-sm font-bold hover:bg-blue-500">Painel</button>
                            <button className="px-3 bg-red-900/50 text-red-400 rounded border border-red-900 hover:bg-red-900">🗑️</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
}