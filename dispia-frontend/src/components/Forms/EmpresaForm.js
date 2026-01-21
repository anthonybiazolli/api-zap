import { useState } from 'react';

// URL fixa do Proxy
const PROXY_URL = '/api/interno'; 

export default function EmpresaForm({ onSubmit }) {
  const [activeTab, setActiveTab] = useState('dados'); 
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [loadingSave, setLoadingSave] = useState(false);
  
  const [formData, setFormData] = useState({
    cnpj: '',
    razaoSocial: '',
    nomeFantasia: '',
    email: '',
    telefone: '',
    cnae: '',
    dataAbertura: '',
    statusRF: '',
    endereco: { cep: '', rua: '', numero: '', bairro: '', cidade: '', estado: '' },
    socios: [] 
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddressChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      endereco: { ...prev.endereco, [name]: value }
    }));
  };

  const handleBlurCnpj = async () => {
    const cnpj = formData.cnpj.replace(/\D/g, '');
    if (cnpj.length !== 14) return;

    setLoadingCnpj(true);
    try {
      // Agora o Proxy vai mandar corretamente para http://backend:3000/api/empresas/consulta/...
      const res = await fetch(`${PROXY_URL}/empresas/consulta/${cnpj}`);
      
      if (res.ok) {
        const dados = await res.json();
        setFormData(prev => ({
          ...prev,
          razaoSocial: dados.razaoSocial || prev.razaoSocial,
          nomeFantasia: dados.nomeFantasia || prev.nomeFantasia,
          cnae: dados.cnae || prev.cnae,
          statusRF: dados.statusRF || prev.statusRF,
          email: dados.email || prev.email,
          telefone: dados.telefone || prev.telefone,
          endereco: dados.endereco || prev.endereco,
          socios: dados.socios ? dados.socios.map(s => ({
             nome: s.nome_socio || s.nome,
             cpf: s.cpf_representante_legal || '',
             cargo: s.qualificacao_socio || s.qualificacao_representante_legal
          })) : []
        }));
      } else {
        console.error("Erro API:", res.status);
      }
    } catch (error) {
      console.error("Erro na API CNPJ", error);
    } finally {
      setLoadingCnpj(false);
    }
  };

  const addSocio = () => setFormData(prev => ({ ...prev, socios: [...prev.socios, { nome: '', cpf: '', cargo: '' }] }));
  
  const updateSocio = (index, field, value) => {
    const novos = [...formData.socios];
    novos[index][field] = value;
    setFormData(prev => ({ ...prev, socios: novos }));
  };

  const removeSocio = (index) => {
    setFormData(prev => ({ ...prev, socios: prev.socios.filter((_, i) => i !== index) }));
  };

  const handleSave = async () => {
      setLoadingSave(true);
      await onSubmit(formData);
      setLoadingSave(false);
  }

  // Estilo padrão para inputs (Texto escuro forçado)
  const inputStyle = "w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 bg-white";

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 animate-fade-in text-gray-800">
      <div className="flex border-b mb-6">
        <button className={`px-4 py-2 font-bold transition ${activeTab === 'dados' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveTab('dados')}>🏢 Dados da Empresa</button>
        <button className={`px-4 py-2 font-bold transition ${activeTab === 'socios' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveTab('socios')}>👥 Quadro Societário ({formData.socios.length})</button>
      </div>

      {activeTab === 'dados' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-gray-600 mb-1">CNPJ (Busca Automática)</label>
            <div className="relative">
                <input 
                    name="cnpj" 
                    value={formData.cnpj} 
                    onChange={handleChange} 
                    onBlur={handleBlurCnpj}
                    className={`${inputStyle} pl-10 font-mono`} 
                    placeholder="00.000.000/0000-00"
                />
                <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
                {loadingCnpj && <span className="absolute right-3 top-2.5 text-xs text-blue-500 font-bold animate-pulse">Buscando...</span>}
            </div>
          </div>

          <div><label className="block text-xs font-bold text-gray-600">Razão Social</label><input name="razaoSocial" value={formData.razaoSocial} onChange={handleChange} className={inputStyle} /></div>
          <div><label className="block text-xs font-bold text-gray-600">Nome Fantasia</label><input name="nomeFantasia" value={formData.nomeFantasia} onChange={handleChange} className={inputStyle} /></div>
          <div><label className="block text-xs font-bold text-gray-600">E-mail</label><input name="email" value={formData.email} onChange={handleChange} className={inputStyle} /></div>
          <div><label className="block text-xs font-bold text-gray-600">Telefone</label><input name="telefone" value={formData.telefone} onChange={handleChange} className={inputStyle} /></div>
          
          <div className="md:col-span-2 bg-gray-50 p-4 rounded-lg mt-2 border border-gray-100">
            <h3 className="font-bold mb-2 text-gray-700 text-sm uppercase">Endereço</h3>
            <div className="grid grid-cols-6 gap-2">
                <div className="col-span-2"><input name="cep" placeholder="CEP" value={formData.endereco.cep} onChange={handleAddressChange} className={inputStyle} /></div>
                <div className="col-span-3"><input name="rua" placeholder="Rua" value={formData.endereco.rua} onChange={handleAddressChange} className={inputStyle} /></div>
                <div className="col-span-1"><input name="numero" placeholder="Nº" value={formData.endereco.numero} onChange={handleAddressChange} className={inputStyle} /></div>
                <div className="col-span-2"><input name="bairro" placeholder="Bairro" value={formData.endereco.bairro} onChange={handleAddressChange} className={inputStyle} /></div>
                <div className="col-span-3"><input name="cidade" placeholder="Cidade" value={formData.endereco.cidade} onChange={handleAddressChange} className={inputStyle} /></div>
                <div className="col-span-1"><input name="estado" placeholder="UF" value={formData.endereco.estado} onChange={handleAddressChange} className={inputStyle} /></div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'socios' && (
        <div>
            <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-gray-500">Sócios encontrados: {formData.socios.length}</p>
                <button onClick={addSocio} className="text-sm bg-blue-100 text-blue-600 px-3 py-1 rounded font-bold hover:bg-blue-200">+ Adicionar Manualmente</button>
            </div>
            <div className="space-y-3">
                {formData.socios.map((socio, idx) => (
                    <div key={idx} className="flex flex-col md:flex-row gap-2 items-start md:items-end bg-gray-50 p-3 rounded border border-gray-100">
                        <div className="flex-1 w-full"><label className="text-[10px] uppercase font-bold text-gray-400">Nome</label><input value={socio.nome} onChange={(e) => updateSocio(idx, 'nome', e.target.value)} className={inputStyle} /></div>
                        <div className="md:w-32 w-full"><label className="text-[10px] uppercase font-bold text-gray-400">CPF</label><input value={socio.cpf} onChange={(e) => updateSocio(idx, 'cpf', e.target.value)} className={inputStyle} /></div>
                        <div className="md:w-48 w-full"><label className="text-[10px] uppercase font-bold text-gray-400">Cargo</label><input value={socio.cargo} onChange={(e) => updateSocio(idx, 'cargo', e.target.value)} className={inputStyle} /></div>
                        <button onClick={() => removeSocio(idx)} className="text-red-500 font-bold px-2 py-1 hover:bg-red-50 rounded">🗑️</button>
                    </div>
                ))}
            </div>
        </div>
      )}

      <div className="mt-8 pt-4 border-t flex justify-end">
        <button onClick={handleSave} disabled={loadingSave} className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 font-bold shadow-lg shadow-blue-900/20 transition">
            {loadingSave ? 'Salvando...' : '💾 Salvar Empresa Completa'}
        </button>
      </div>
    </div>
  );
}