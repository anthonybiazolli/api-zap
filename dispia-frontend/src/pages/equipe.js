import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

const API_URL = '/api/interno';

export default function Equipe() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [team, setTeam] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form do Novo Usuário
  const [newUser, setNewUser] = useState({ 
      name: '', 
      email: '', 
      password: '', 
      role: 'AGENT' // Padrão: Vendedor
  });

  useEffect(() => {
      // 1. Verifica Login
      const storedUser = localStorage.getItem('user');
      const token = localStorage.getItem('token');

      if (!storedUser || !token) {
          router.push('/login');
      } else {
          const u = JSON.parse(storedUser);
          setUser(u);
          fetchTeam(token); // Passa o token para decodificar o ID da empresa
      }
  }, []);

  const fetchTeam = async (token) => {
      // Tenta extrair o clientId do token JWT para buscar a equipe certa
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(c => 
            '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        ).join(''));
        
        const decoded = JSON.parse(jsonPayload);
        
        if(decoded.clientId) {
            const res = await fetch(`${API_URL}/team/${decoded.clientId}`);
            if(res.ok) setTeam(await res.json());
        }
      } catch(e) { console.error("Erro ao buscar equipe:", e); }
  };

  const handleCreate = async () => {
      if(!newUser.name || !newUser.email || !newUser.password) return alert("Preencha todos os campos obrigatórios.");
      
      setLoading(true);
      try {
          const res = await fetch(`${API_URL}/team`, {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ ...newUser, creatorId: user.id })
          });

          if(res.ok) {
              alert("Usuário adicionado com sucesso!");
              setShowModal(false);
              setNewUser({ name: '', email: '', password: '', role: 'AGENT' });
              // Recarrega a lista
              const token = localStorage.getItem('token');
              fetchTeam(token);
          } else {
              const err = await res.json();
              alert("Erro: " + (err.error || "Falha ao criar"));
          }
      } catch (e) { alert("Erro de conexão."); }
      finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
      if(!confirm("Tem certeza que deseja remover este usuário? Ele perderá o acesso imediatamente.")) return;
      
      try {
          await fetch(`${API_URL}/team/${id}`, { method: 'DELETE' });
          const token = localStorage.getItem('token');
          fetchTeam(token);
      } catch (e) { alert("Erro ao deletar."); }
  };

  const handleLogout = () => { localStorage.clear(); router.push('/login'); };

  return (
    <div className="min-h-screen bg-[#0f172a] text-gray-100 font-sans pb-20">
        <Head><title>Minha Equipe - DispIA</title></Head>
        
        {/* NAVBAR */}
        <nav className="bg-[#1e293b] border-b border-gray-700 px-6 py-4 flex justify-between items-center shadow-md sticky top-0 z-40 mb-8">
            <div className="flex items-center gap-3">
                <Link href="/" className="text-2xl cursor-pointer">🤖</Link>
                <Link href="/" className="text-xl font-bold tracking-wide cursor-pointer">DispIA <span className="text-blue-400">Hub</span></Link>
            </div>
            <div className="flex items-center gap-4 text-sm">
                <div className="text-right hidden md:block">
                    <p className="text-white font-bold">{user?.name}</p>
                    <p className="text-xs text-gray-400 uppercase">{user?.role === 'ADMIN' ? 'Gestor' : 'Vendedor'}</p>
                </div>
                <button onClick={handleLogout} className="bg-red-900/30 text-red-400 border border-red-800 px-4 py-2 rounded hover:bg-red-900/50 transition">Sair</button>
            </div>
        </nav>

        <div className="max-w-6xl mx-auto px-6">
            
            {/* CABEÇALHO DA PÁGINA */}
            <div className="flex flex-col md:flex-row justify-between items-end mb-8 border-b border-gray-700 pb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Gestão de Equipe</h1>
                    <p className="text-gray-400">Gerencie quem tem acesso ao painel da sua empresa.</p>
                </div>
                
                {/* BOTÃO SÓ APARECE SE FOR ADMIN */}
                {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
                    <button onClick={() => setShowModal(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-bold shadow-lg flex items-center gap-2 transition hover:scale-105">
                        <span className="text-xl">+</span> Novo Usuário
                    </button>
                )}
            </div>

            {/* TABELA DE USUÁRIOS */}
            <div className="bg-[#1e293b] rounded-xl shadow-xl overflow-hidden border border-gray-700">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-black/20 text-gray-400 text-xs uppercase tracking-wider">
                            <th className="p-5 font-bold">Nome do Usuário</th>
                            <th className="p-5 font-bold">Email de Acesso</th>
                            <th className="p-5 font-bold">Perfil</th>
                            <th className="p-5 font-bold text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {team.map(member => (
                            <tr key={member.id} className="hover:bg-white/5 transition">
                                <td className="p-5">
                                    <div className="font-bold text-white">{member.name}</div>
                                    <div className="text-xs text-gray-500">ID: ...{member.id.slice(-4)}</div>
                                </td>
                                <td className="p-5 text-gray-300">{member.email}</td>
                                <td className="p-5">
                                    <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase ${member.role === 'ADMIN' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'}`}>
                                        {member.role === 'ADMIN' ? 'Administrador' : 'Vendedor'}
                                    </span>
                                </td>
                                <td className="p-5 text-right">
                                    {/* Não pode deletar a si mesmo */}
                                    {member.id !== user.id && (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
                                        <button onClick={() => handleDelete(member.id)} className="text-red-400 hover:text-red-300 hover:bg-red-900/30 px-3 py-1 rounded text-xs font-bold transition border border-transparent hover:border-red-800">
                                            Remover
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        
                        {team.length === 0 && (
                            <tr>
                                <td colSpan="4" className="p-12 text-center text-gray-500">
                                    Nenhum membro encontrado na equipe.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* MODAL DE CRIAÇÃO */}
        {showModal && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-fade-in backdrop-blur-sm">
                <div className="bg-[#1e293b] border border-gray-600 p-8 rounded-2xl w-full max-w-md shadow-2xl relative">
                    <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white">✕</button>
                    
                    <h2 className="text-2xl font-bold mb-1 text-white">Adicionar Membro</h2>
                    <p className="text-sm text-gray-400 mb-6">Crie uma conta para um colaborador.</p>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">Nome Completo</label>
                            <input className="w-full bg-[#0f172a] border border-gray-600 p-3 rounded-lg text-white focus:border-blue-500 outline-none transition" 
                                placeholder="Ex: Maria Silva" 
                                value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
                        </div>
                        
                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">Email de Login</label>
                            <input className="w-full bg-[#0f172a] border border-gray-600 p-3 rounded-lg text-white focus:border-blue-500 outline-none transition" 
                                placeholder="usuario@empresa.com" type="email"
                                value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">Senha Provisória</label>
                            <input className="w-full bg-[#0f172a] border border-gray-600 p-3 rounded-lg text-white focus:border-blue-500 outline-none transition" 
                                placeholder="******" type="password"
                                value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">Perfil de Acesso</label>
                            <select className="w-full bg-[#0f172a] border border-gray-600 p-3 rounded-lg text-white focus:border-blue-500 outline-none transition" 
                                value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                                <option value="AGENT">Vendedor (Acesso Padrão)</option>
                                <option value="ADMIN">Administrador (Gestão Total)</option>
                            </select>
                            <p className="text-[10px] text-gray-500 mt-1">
                                {newUser.role === 'ADMIN' ? '⚠️ Pode criar outros usuários e gerenciar pagamentos.' : 'ℹ️ Pode gerenciar contatos e campanhas.'}
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-3 mt-8">
                        <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-3 text-gray-400 hover:bg-gray-800 rounded-lg font-bold transition">Cancelar</button>
                        <button onClick={handleCreate} disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-lg font-bold shadow-lg transition disabled:opacity-50">
                            {loading ? 'Criando...' : 'Confirmar'}
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}