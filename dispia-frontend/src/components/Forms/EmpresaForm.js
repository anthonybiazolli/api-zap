import { useState, useEffect } from 'react';
import api from '@/services/api'; // <--- CORREÇÃO AQUI (Uso do @)
import { toast } from 'react-toastify'; 

export default function EmpresaForm({ onSubmit, initialData, onCancel }) {
  // Estado inicial vazio
  const defaultState = {
    cnpj: '',
    razaoSocial: '',
    nomeFantasia: '',
    email: '',
    telefone: '',
    endereco: {
        logradouro: '',
        numero: '',
        complemento: '',
        bairro: '',
        cidade: '',
        estado: '',
        cep: ''
    },
    socios: []
  };

  const [form, setForm] = useState(defaultState);
  const [loading, setLoading] = useState(false);

  // Monitora quando 'initialData' muda (edição ou retorno da API)
  useEffect(() => {
    if (initialData) {
      setForm({
        ...initialData,
        endereco: initialData.endereco || defaultState.endereco,
        // Garante compatibilidade se vier como 'socios' ou 'qsa' do backend
        socios: Array.isArray(initialData.socios) ? initialData.socios : 
                (Array.isArray(initialData.qsa) ? initialData.qsa : []) 
      });
    } else {
      setForm(defaultState);
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const handleAddressChange = (e) => {
    const { name, value } = e.target;
    setForm({
      ...form,
      endereco: { ...form.endereco, [name]: value }
    });
  };

  // === CONSULTAR CNPJ AUTOMÁTICO ===
  const handleConsultarCNPJ = async (e) => {
    const cnpjDigitado = e.target.value.replace(/\D/g, '');

    // Busca apenas se tiver 14 dígitos e for um cadastro novo (não tem ID)
    if (cnpjDigitado.length === 14 && !initialData?.id) {
        setLoading(true);
        try {
            // Toast informativo
            const toastId = toast.loading("Consultando Receita Federal...");
            
            // Chama o backend
            const { data } = await api.get(`/empresas/cnpj/${cnpjDigitado}`);

            if (data) {
                toast.update(toastId, { render: "Dados encontrados!", type: "success", isLoading: false, autoClose: 3000 });
                
                // Preenche o formulário
                setForm(prev => ({
                    ...prev,
                    cnpj: data.cnpj,
                    razaoSocial: data.razaoSocial,
                    nomeFantasia: data.nomeFantasia || '',
                    email: data.email || prev.email,
                    telefone: data.telefone || prev.telefone,
                    
                    // Endereço
                    endereco: {
                        logradouro: data.logradouro || '',
                        numero: data.numero || '',
                        complemento: data.complemento || '',
                        bairro: data.bairro || '',
                        cidade: data.cidade || '',
                        estado: data.uf || '', 
                        cep: data.cep || ''
                    },

                    // Sócios
                    socios: data.qsa ? data.qsa.map(s => ({
                        nome: s.nome_socio || s.nome,
                        cargo: s.qualificacao_socio || 'Sócio'
                    })) : []
                }));
            }
        } catch (error) {
            console.error(error);
            toast.dismiss();
            toast.warning("CNPJ não encontrado ou erro na busca.");
        } finally {
            setLoading(false);
        }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg text-gray-800 animate-fade-in relative">
      
      {/* Loading Overlay (Visual bonito enquanto busca) */}
      {loading && (
        <div className="absolute inset-0 bg-white bg-opacity-80 flex flex-col items-center justify-center z-20 rounded-lg">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-2"></div>
            <span className="text-blue-600 font-bold">Buscando na Receita...</span>
        </div>
      )}

      <div className="flex justify-between items-center mb-6 border-b pb-2">
        <h2 className="text-2xl font-bold text-blue-600">
          {initialData?.id ? '✏️ Editar Empresa' : '🏢 Nova Empresa'}
        </h2>
        {onCancel && (
            <button 
                type="button" 
                onClick={onCancel}
                className="text-gray-400 hover:text-red-500 font-bold text-xl"
            >
                ✕
            </button>
        )}
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">CNPJ</label>
            <input 
              name="cnpj" 
              value={form.cnpj} 
              onChange={handleChange} 
              onBlur={handleConsultarCNPJ} // <--- GATILHO DA BUSCA
              className={`w-full border p-2 rounded focus:border-blue-500 outline-none ${initialData?.id ? 'bg-gray-100 cursor-not-allowed' : 'bg-blue-50'}`}
              placeholder="Digite apenas números"
              disabled={!!initialData?.id} 
              maxLength={18}
              required
            />
            {!initialData?.id && (
                <span className="text-xs text-blue-500 mt-1 block font-semibold">
                    ✨ Digite para buscar automaticamente
                </span>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Razão Social</label>
            <input 
              name="razaoSocial" 
              value={form.razaoSocial} 
              onChange={handleChange} 
              className="w-full border p-2 rounded focus:border-blue-500 outline-none"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome Fantasia</label>
            <input name="nomeFantasia" value={form.nomeFantasia || ''} onChange={handleChange} className="w-full border p-2 rounded" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
            <input name="email" value={form.email || ''} onChange={handleChange} className="w-full border p-2 rounded" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Telefone</label>
            <input name="telefone" value={form.telefone || ''} onChange={handleChange} className="w-full border p-2 rounded" />
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded mb-6 border">
            <h3 className="text-sm font-bold text-gray-400 mb-3 uppercase">Endereço</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <input name="cep" placeholder="CEP" value={form.endereco?.cep || ''} onChange={handleAddressChange} className="border p-2 rounded text-sm" />
                <div className="md:col-span-2"><input name="logradouro" placeholder="Rua / Av" value={form.endereco?.logradouro || ''} onChange={handleAddressChange} className="w-full border p-2 rounded text-sm" /></div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <input name="numero" placeholder="Número" value={form.endereco?.numero || ''} onChange={handleAddressChange} className="border p-2 rounded text-sm" />
                <div className="md:col-span-2"><input name="cidade" placeholder="Cidade" value={form.endereco?.cidade || ''} onChange={handleAddressChange} className="w-full border p-2 rounded text-sm" /></div>
                <input name="estado" placeholder="UF" value={form.endereco?.estado || ''} onChange={handleAddressChange} className="border p-2 rounded text-sm" maxLength={2} />
            </div>
        </div>

        {/* Quadro de Sócios (QSA) */}
        {form.socios && form.socios.length > 0 && (
            <div className="mb-6 animate-fade-in">
                <h3 className="text-sm font-bold text-gray-400 mb-2 uppercase">Quadro Societário (QSA)</h3>
                <div className="bg-blue-50 p-3 rounded text-sm text-blue-800 border border-blue-100 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {form.socios.map((socio, idx) => (
                        <div key={idx} className="flex items-center bg-white p-2 rounded border border-blue-100 shadow-sm">
                            <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded mr-2 uppercase tracking-wide">
                                Sócio
                            </span>
                            <div className="flex flex-col">
                                <span className="font-bold text-gray-700">{socio.nome}</span>
                                {socio.cargo && <span className="text-gray-400 text-xs">{socio.cargo}</span>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t">
          {onCancel && (
             <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-600 hover:text-gray-800 transition">
               Cancelar
             </button>
          )}
          <button type="submit" disabled={loading} className={`bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded font-bold shadow-lg transition transform hover:scale-105 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}>
            {initialData?.id ? 'Salvar Alterações' : 'Cadastrar'}
          </button>
        </div>
      </form>
    </div>
  );
}