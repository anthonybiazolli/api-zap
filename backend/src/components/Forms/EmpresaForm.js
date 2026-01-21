import { useState, useEffect } from 'react';

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
    }
  };

  const [form, setForm] = useState(defaultState);

  // === A CORREÇÃO ESTÁ AQUI ===
  // Este useEffect monitora quando 'initialData' muda. 
  // Se tiver dados (Edição), preenche o form. Se for null (Novo), limpa.
  useEffect(() => {
    if (initialData) {
      // Garante que o objeto endereço exista para não quebrar
      setForm({
        ...initialData,
        endereco: initialData.endereco || defaultState.endereco
      });
    } else {
      setForm(defaultState);
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  // Tratamento específico para campos aninhados de endereço
  const handleAddressChange = (e) => {
    const { name, value } = e.target;
    setForm({
      ...form,
      endereco: { ...form.endereco, [name]: value }
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg text-gray-800 animate-fade-in">
      <h2 className="text-2xl font-bold mb-6 border-b pb-2 text-blue-600">
        {initialData ? '✏️ Editar Empresa' : '🏢 Nova Empresa'}
      </h2>
      
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">CNPJ</label>
            <input 
              name="cnpj" 
              value={form.cnpj} 
              onChange={handleChange} 
              className="w-full border p-2 rounded focus:border-blue-500 outline-none bg-gray-50"
              placeholder="Apenas números"
              disabled={!!initialData} // Bloqueia CNPJ na edição
              required
            />
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

        <div className="flex justify-end gap-3">
          {/* Botão Cancelar (Se quiser usar no cadastros.js, precisa passar a prop onCancel) */}
          <button type="submit" className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded font-bold shadow-lg transition">
            {initialData ? 'Salvar Alterações' : 'Cadastrar'}
          </button>
        </div>
      </form>
    </div>
  );
}