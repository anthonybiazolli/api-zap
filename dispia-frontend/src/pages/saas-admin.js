import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

const API_URL = '/api/interno';

export default function SaasAdmin() {
  const router = useRouter();
  const [clients, setClients] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const [form, setForm] = useState({
      id: null, companyName: '', planName: 'Pro', maxUsers: 2, maxInstances: 1, 
      adminName: '', adminEmail: '', adminPassword: ''
  });

  useEffect(() => {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      if (u.role !== 'SUPER_ADMIN') router.push('/');
      else loadClients();
  }, []);

  const loadClients = async () => {
      const res = await fetch(`${API_URL}/saas/clients`);
      if (res.ok) setClients(await res.json());
  };

  const handleOpenCreate = () => {
      setIsEditing(false);
      setForm({ id: null, companyName: '', planName: 'Pro', maxUsers: 2, maxInstances: 1, adminName: '', adminEmail: '', adminPassword: '' });
      setShowModal(true);
  };

  const handleOpenEdit = (cli) => {
      setIsEditing(true);
      setForm({ 
          id: cli.id, 
          companyName: cli.name, 
          planName: cli.planName, 
          maxUsers: cli.maxUsers, 
          maxInstances: cli.maxInstances,
          adminName: '', adminEmail: '', adminPassword: ''
      });
      setShowModal(true);
  };

  const handleSubmit = async () => {
      if(isEditing) {
          await fetch(`${API_URL}/saas/clients/${form.id}`, {
              method: 'PUT',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ name: form.companyName, planName: form.planName, maxUsers: form.maxUsers, maxInstances: form.maxInstances })
          });
      } else {
          if(!form.companyName || !form.adminEmail) return alert("Preencha os dados");
          await fetch(`${API_URL}/saas/clients`, {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify(form)
          });
      }
      setShowModal(false);
      loadClients();
  };

  const handleToggleBlock = async (id) => {
      if(!confirm("Alterar status de bloqueio?")) return;
      await fetch(`${API_URL}/saas/clients/${id}/toggle`, { method: 'POST' });
      loadClients();
  };

  // === NOVA FUNÇÃO DELETAR ===
  const handleDeleteClient = async (id, name) => {
      if(!confirm(`⚠️ PERIGO EXTREMO ⚠️\n\nVocê está prestes a excluir a empresa "${name}".\n\nIsso apagará PERMANENTEMENTE:\n- Todos os usuários vinculados\n- Todas as sessões de WhatsApp\n- Todas as campanhas e contatos\n\nDeseja realmente continuar?`)) return;
      
      try {
          const res = await fetch(`${API_URL}/saas/clients/${id}`, { method: 'DELETE' });
          if(res.ok) {
              alert('Empresa removida com sucesso.');
              loadClients();
          } else {
              alert('Erro ao remover empresa.');
          }
      } catch(e) { alert('Erro de conexão.'); }
  };

  const handleLogout = () => { localStorage.clear(); router.push('/login'); };

  return (
    <div className="min-h-screen bg-[#0f172a] text-gray-100 font-sans p-6">
        <Head><title>Super Admin - DispIA</title></Head>
        <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div><h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Gestão SaaS</h1><button onClick={handleLogout} className="text-xs text-gray-500 hover:text-white underline mt-1">Sair</button></div>
                <button onClick={handleOpenCreate} className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded-lg font-bold shadow-lg transition">+ Novo Cliente</button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {clients.map(cli => (
                    <div key={cli.id} className={`bg-[#1e293b] border p-6 rounded-xl relative overflow-hidden group transition ${cli.status === 'BLOCKED' ? 'border-red-900 opacity-75' : 'border-gray-700 hover:border-blue-500/50'}`}>
                        
                        {/* BOTÃO DE EXCLUIR (LIXEIRA) */}
                        <button 
                            onClick={() => handleDeleteClient(cli.id, cli.name)} 
                            className="absolute top-4 right-4 text-gray-600 hover:text-red-500 bg-black/20 p-2 rounded hover:bg-black/40 transition z-10"
                            title="Excluir Empresa Definitivamente"
                        >
                            🗑️
                        </button>

                        <div className="flex justify-between items-start mb-4 pr-10">
                            <div><h3 className="font-bold text-xl text-white">{cli.name}</h3><span className="text-xs text-blue-300 bg-blue-900/30 px-2 py-1 rounded border border-blue-500/30 uppercase tracking-wide">{cli.planName}</span></div>
                            <div className={`w-3 h-3 rounded-full mt-1 ${cli.status === 'ACTIVE' ? 'bg-green-500 shadow-green-500/50 shadow-sm' : 'bg-red-500'}`}></div>
                        </div>
                        
                        <div className="space-y-2 text-sm text-gray-400 mb-6">
                            <div className="flex justify-between border-b border-gray-700 pb-1"><span>Usuários:</span><span className="text-white font-mono">{cli._count?.users} / {cli.maxUsers}</span></div>
                            <div className="flex justify-between border-b border-gray-700 pb-1"><span>WhatsApp:</span><span className="text-white font-mono">{cli._count?.instances} / {cli.maxInstances}</span></div>
                        </div>

                        <div className="flex gap-2">
                            <button onClick={() => handleOpenEdit(cli)} className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded text-xs font-bold">Editar</button>
                            <button onClick={() => handleToggleBlock(cli.id)} className={`flex-1 py-2 rounded text-xs font-bold border ${cli.status === 'ACTIVE' ? 'bg-red-900/30 text-red-400 border-red-900/50 hover:bg-red-900/50' : 'bg-green-900/30 text-green-400 border-green-900/50 hover:bg-green-900/50'}`}>{cli.status === 'ACTIVE' ? 'Bloquear' : 'Ativar'}</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
        
        {/* MODAL (Mantido igual) */}
        {showModal && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-fade-in">
                <div className="bg-[#1e293b] border border-gray-600 p-8 rounded-2xl w-full max-w-2xl shadow-2xl relative">
                    <h2 className="text-2xl font-bold mb-6 text-white border-b border-gray-700 pb-2">{isEditing ? 'Editar Contrato' : 'Novo Contrato SaaS'}</h2>
                    <div className="grid grid-cols-2 gap-6 mb-6">
                        <div><label className="block text-xs font-bold text-gray-400 mb-1">Empresa</label><input className="w-full bg-[#0f172a] border border-gray-600 p-2 rounded text-white" value={form.companyName} onChange={e => setForm({...form, companyName: e.target.value})} /></div>
                        <div><label className="block text-xs font-bold text-gray-400 mb-1">Plano</label><select className="w-full bg-[#0f172a] border border-gray-600 p-2 rounded text-white" value={form.planName} onChange={e => setForm({...form, planName: e.target.value})}><option value="Starter">Starter</option><option value="Pro">Pro</option><option value="Enterprise">Enterprise</option></select></div>
                        <div><label className="block text-xs font-bold text-gray-400 mb-1">Limite Usuários</label><input type="number" className="w-full bg-[#0f172a] border border-gray-600 p-2 rounded text-white" value={form.maxUsers} onChange={e => setForm({...form, maxUsers: e.target.value})} /></div>
                        <div><label className="block text-xs font-bold text-gray-400 mb-1">Limite WhatsApp</label><input type="number" className="w-full bg-[#0f172a] border border-gray-600 p-2 rounded text-white" value={form.maxInstances} onChange={e => setForm({...form, maxInstances: e.target.value})} /></div>
                    </div>
                    {!isEditing && (
                        <div className="bg-black/20 p-4 rounded-xl border border-gray-700 mb-6">
                            <h3 className="text-sm font-bold text-blue-400 mb-3">Admin Inicial</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <input className="bg-[#0f172a] border border-gray-600 p-2 rounded text-white text-sm" placeholder="Nome" value={form.adminName} onChange={e => setForm({...form, adminName: e.target.value})} />
                                <input className="bg-[#0f172a] border border-gray-600 p-2 rounded text-white text-sm" placeholder="Email" value={form.adminEmail} onChange={e => setForm({...form, adminEmail: e.target.value})} />
                                <input className="bg-[#0f172a] border border-gray-600 p-2 rounded text-white text-sm" placeholder="Senha" type="password" value={form.adminPassword} onChange={e => setForm({...form, adminPassword: e.target.value})} />
                            </div>
                        </div>
                    )}
                    <div className="flex justify-end gap-3"><button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-400 hover:text-white">Cancelar</button><button onClick={handleSubmit} className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg">Salvar</button></div>
                </div>
            </div>
        )}
    </div>
  );
}