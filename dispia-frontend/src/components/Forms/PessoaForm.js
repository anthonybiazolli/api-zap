import { useState } from 'react';

export default function PessoaForm({ onSubmit }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    cpf: '',
    nomeCompleto: '',
    email: '',
    telefone: '',
    endereco: { cep: '', rua: '', numero: '', bairro: '', cidade: '', estado: '' }
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

  const handleSubmit = async () => {
    setLoading(true);
    await onSubmit(formData);
    setLoading(false);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 animate-fade-in">
      <h2 className="text-xl font-bold mb-6 text-gray-800 border-b pb-2">Dados Pessoais</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
            <label className="block text-xs font-bold text-gray-600 mb-1">Nome Completo</label>
            <input name="nomeCompleto" value={formData.nomeCompleto} onChange={handleChange} className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ex: João da Silva" />
        </div>
        
        <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">CPF</label>
            <input name="cpf" value={formData.cpf} onChange={handleChange} className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" placeholder="000.000.000-00" />
        </div>
        <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Telefone/WhatsApp</label>
            <input name="telefone" value={formData.telefone} onChange={handleChange} className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" placeholder="(00) 00000-0000" />
        </div>
        <div className="md:col-span-2">
            <label className="block text-xs font-bold text-gray-600 mb-1">E-mail</label>
            <input name="email" value={formData.email} onChange={handleChange} className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" placeholder="joao@email.com" />
        </div>
      </div>

      <h3 className="font-bold mt-6 mb-3 text-gray-700 text-sm uppercase tracking-wide">Endereço</h3>
      <div className="grid grid-cols-6 gap-3 bg-gray-50 p-4 rounded-lg">
          <div className="col-span-2"><input name="cep" placeholder="CEP" value={formData.endereco.cep} onChange={handleAddressChange} className="w-full border p-2 rounded text-sm" /></div>
          <div className="col-span-3"><input name="rua" placeholder="Rua / Logradouro" value={formData.endereco.rua} onChange={handleAddressChange} className="w-full border p-2 rounded text-sm" /></div>
          <div className="col-span-1"><input name="numero" placeholder="Nº" value={formData.endereco.numero} onChange={handleAddressChange} className="w-full border p-2 rounded text-sm" /></div>
          <div className="col-span-2"><input name="bairro" placeholder="Bairro" value={formData.endereco.bairro} onChange={handleAddressChange} className="w-full border p-2 rounded text-sm" /></div>
          <div className="col-span-3"><input name="cidade" placeholder="Cidade" value={formData.endereco.cidade} onChange={handleAddressChange} className="w-full border p-2 rounded text-sm" /></div>
          <div className="col-span-1"><input name="estado" placeholder="UF" value={formData.endereco.estado} onChange={handleAddressChange} className="w-full border p-2 rounded text-sm" /></div>
      </div>

      <button 
          onClick={handleSubmit}
          disabled={loading}
          className="mt-6 w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-bold transition flex justify-center items-center gap-2"
      >
          {loading ? 'Salvando...' : '💾 Salvar Cadastro'}
      </button>
    </div>
  );
}