import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { QRCodeSVG } from 'qrcode.react';
import { Chart } from "react-google-charts";

const API_URL = '/api/interno';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [connectingInstance, setConnectingInstance] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
      const storedUser = localStorage.getItem('user');
      const token = localStorage.getItem('token');
      
      if (!storedUser || !token) {
          router.push('/login');
          return;
      }
      
      const u = JSON.parse(storedUser);
      setUser(u);
      fetchData(u.id);
      
      const interval = setInterval(() => fetchData(u.id), 5000);
      return () => clearInterval(interval);
  }, []);

  const fetchData = async (userId) => {
      try {
          const resInst = await fetch(`${API_URL}/instances/user/${userId}`);
          if (resInst.ok) setInstances(await resInst.json());

          const resStats = await fetch(`${API_URL}/dashboard/summary`);
          if (resStats.ok) setStats(await resStats.json());
      } catch (e) { console.error("Erro fetch", e); } finally { setLoading(false); }
  };

  const handleLogout = () => { localStorage.clear(); router.push('/login'); };

  const handleCreateInstance = async () => {
      if(!confirm("Gerar nova instância ID?")) return;
      try {
          const res = await fetch(`${API_URL}/instances`, {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ userId: user.id })
          });
          const data = await res.json();
          if(res.ok) {
              alert("Instância criada com sucesso!");
              fetchData(user.id);
          } else {
              alert(`Erro: ${data.error || 'Erro desconhecido'}`);
          }
      } catch(e) { alert('Erro de conexão com o servidor.'); }
  };

  const handleConnect = async (instanceId) => {
      setConnectingInstance(instanceId);
      try { await fetch(`${API_URL}/instances/${instanceId}/connect`, { method: 'POST' }); } 
      catch(e) { alert('Erro ao solicitar conexão'); }
      setTimeout(() => setConnectingInstance(null), 5000);
  };

  const handleDisconnect = async (instanceId) => {
      if(!confirm('Desconectar este WhatsApp?')) return;
      await fetch(`${API_URL}/instances/${instanceId}/logout`, { method: 'POST' });
      fetchData(user.id);
  };

  const handleDeleteInstance = async (instanceId) => {
      if(!confirm('⚠️ ATENÇÃO: Isso excluirá permanentemente esta instância.\nDeseja continuar?')) return;
      try {
          const res = await fetch(`${API_URL}/instances/${instanceId}`, { method: 'DELETE' });
          if(res.ok) {
              fetchData(user.id);
          } else {
              alert('Erro ao excluir.');
          }
      } catch(e) { alert('Erro de conexão.'); }
  };

  if (loading) return <div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-white">Carregando...</div>;

  return (
    <div className="min-h-screen bg-[#0f172a] text-gray-100 font-sans pb-20">
      <Head><title>Dashboard - DispIA</title></Head>

      <nav className="bg-[#1e293b] border-b border-gray-700 px-6 py-4 flex justify-between items-center shadow-md sticky top-0 z-40">
          <div className="flex items-center gap-3"><span className="text-2xl">🤖</span><h1 className="text-xl font-bold tracking-wide">DispIA <span className="text-blue-400">Hub</span></h1></div>
          <div className="flex items-center gap-4 text-sm">
              <div className="text-right hidden md:block">
                  <p className="text-white font-bold">{user?.name}</p>
                  <p className="text-xs text-gray-400 uppercase">{user?.role === 'ADMIN' ? 'Gestor' : 'Vendedor'}</p>
              </div>
              <button onClick={handleLogout} className="bg-red-900/30 text-red-400 border border-red-800 px-4 py-2 rounded hover:bg-red-900/50 transition">Sair</button>
          </div>
      </nav>

      <main className="p-6 max-w-7xl mx-auto">
        
        {/* ATALHOS - AGORA 4 COLUNAS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Link href="/cadastros" className="bg-gradient-to-r from-blue-700 to-blue-900 p-6 rounded-xl hover:scale-[1.01] transition shadow-lg border border-blue-500/30 flex justify-between items-center cursor-pointer">
                <div><h3 className="font-bold text-xl text-white">Cadastros</h3><p className="text-blue-200 text-sm">Gerenciar Base</p></div><span className="text-3xl">🏢</span>
            </Link>
            
            <Link href="/campanhas" className="bg-gradient-to-r from-purple-700 to-purple-900 p-6 rounded-xl hover:scale-[1.01] transition shadow-lg border border-purple-500/30 flex justify-between items-center cursor-pointer">
                <div><h3 className="font-bold text-xl text-white">Campanhas</h3><p className="text-purple-200 text-sm">Disparos em Massa</p></div><span className="text-3xl">🚀</span>
            </Link>

            {/* NOVO: CHAT AO VIVO */}
            <Link href="/chat" className="bg-gradient-to-r from-rose-700 to-pink-900 p-6 rounded-xl hover:scale-[1.01] transition shadow-lg border border-pink-500/30 flex justify-between items-center cursor-pointer">
                <div><h3 className="font-bold text-xl text-white">Chat Ao Vivo</h3><p className="text-pink-200 text-sm">Atendimento Real</p></div><span className="text-3xl">💬</span>
            </Link>

            {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') ? (
                <Link href="/equipe" className="bg-gradient-to-r from-emerald-700 to-emerald-900 p-6 rounded-xl hover:scale-[1.01] transition shadow-lg border border-emerald-500/30 flex justify-between items-center cursor-pointer">
                    <div><h3 className="font-bold text-xl text-white">Minha Equipe</h3><p className="text-emerald-200 text-sm">Criar Usuários</p></div><span className="text-3xl">👥</span>
                </Link>
            ) : (
                <div className="bg-[#1e293b] p-6 rounded-xl border border-gray-700 opacity-50 flex justify-between items-center cursor-not-allowed">
                    <div><h3 className="font-bold text-xl text-gray-400">Minha Equipe</h3><p className="text-gray-500 text-sm">Acesso Restrito</p></div><span className="text-3xl">🔒</span>
                </div>
            )}
        </div>

        {/* ÁREA DE DISPOSITIVOS */}
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                📱 {user?.role === 'ADMIN' ? 'Todos Dispositivos' : 'Meu Dispositivo'}
            </h2>
            {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
                <button onClick={handleCreateInstance} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-bold shadow-lg flex items-center gap-2 transition">
                    + Novo ID
                </button>
            )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {instances.map(inst => (
                <div key={inst.id} className={`relative p-6 rounded-xl border-2 transition shadow-xl bg-[#1e293b] ${inst.statusReal === 'connected' ? 'border-green-500/50' : 'border-gray-700'}`}>
                    
                    {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
                        <button onClick={() => handleDeleteInstance(inst.id)} className="absolute top-4 right-4 text-red-500 hover:text-red-400 bg-red-900/20 p-2 rounded hover:bg-red-900/40 transition z-10" title="Excluir Instância">
                            🗑️
                        </button>
                    )}

                    <div className="flex justify-between items-start mb-4 pr-10">
                        <div>
                            <h3 className="font-bold text-lg text-white font-mono">{inst.name}</h3>
                            {user?.role === 'ADMIN' && inst.owner && (
                                <p className="text-xs text-blue-300 font-bold mt-1">👤 {inst.owner.name}</p>
                            )}
                        </div>
                        <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${inst.statusReal === 'connected' ? 'bg-green-500 text-white shadow-green-500/50 shadow-sm' : 'bg-gray-700 text-gray-400'}`}>
                            {inst.statusReal}
                        </div>
                    </div>

                    <div className="bg-black/30 rounded-lg p-4 min-h-[180px] flex flex-col items-center justify-center mb-4 border border-gray-800">
                        {inst.statusReal === 'connected' ? (
                            <div className="text-center animate-fade-in">
                                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-3xl shadow-lg shadow-green-500/40 mb-3 mx-auto">✓</div>
                                <p className="text-green-400 font-bold text-sm">Sessão Ativa</p>
                            </div>
                        ) : (
                            <div className="w-full flex flex-col items-center">
                                {inst.qrCode ? (
                                    <div className="bg-white p-2 rounded animate-fade-in shadow-lg"><QRCodeSVG value={inst.qrCode} size={140} /></div>
                                ) : (
                                    <div className="text-center text-gray-500 text-sm">
                                        {connectingInstance === inst.id ? <span className="animate-pulse text-yellow-400">Iniciando...</span> : 'Pronto para Conectar'}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2">
                        {inst.statusReal !== 'connected' ? (
                            <button onClick={() => handleConnect(inst.id)} disabled={connectingInstance === inst.id} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg font-bold text-sm transition disabled:opacity-50">
                                {inst.qrCode ? 'Atualizar QR' : 'Gerar QR Code'}
                            </button>
                        ) : (
                            <button onClick={() => handleDisconnect(inst.id)} className="flex-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-600/50 py-2 rounded-lg font-bold text-sm transition">Desconectar</button>
                        )}
                    </div>
                </div>
            ))}
            
            {instances.length === 0 && (
                <div className="col-span-3 border-2 border-dashed border-gray-700 rounded-xl p-8 flex flex-col items-center justify-center text-gray-500">
                    <p className="font-bold">Nenhuma sessão encontrada.</p>
                    <p className="text-sm">Contate o administrador para liberar seu acesso.</p>
                </div>
            )}
        </div>

        <div className="bg-white rounded-xl shadow-xl overflow-hidden p-6">
            <h3 className="text-gray-800 font-bold mb-4">Performance Global</h3>
            <div className="h-64"><Chart chartType="AreaChart" width="100%" height="100%" data={[["Métrica","Qtd"],["Envios",stats?.grafico?.enviadas || 0],["Lidas",stats?.grafico?.lidas || 0],["Respostas",stats?.grafico?.respostas || 0]]} options={{ colors: ['#3b82f6','#22c55e','#eab308'], legend: {position:'top'}, vAxis: {minValue:0} }} /></div>
        </div>

      </main>
    </div>
  );
}