// dispia-frontend/src/components/Forms/PessoaForm.js
import { useState } from 'react';

export default function PessoaForm({ onSubmit }) {
  const [formData, setFormData] = useState({
    cpf: '',
    nomeCompleto: '',
    email: '',
    telefone: '',
    endereco: { cep: '', rua: '', numero: '', complemento: '', cidade: '', estado: '' }
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

  return (
    <div className="bg-white p-6 rounded shadow-md max-w-2xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Cadastro Pessoa Física</h2>
      <div className="grid grid-cols-1 gap-4">
        <div>
            <label className="block text-sm font-bold mb-1">Nome Completo</label>
            <input name="nomeCompleto" value={formData.nomeCompleto} onChange={handleChange} className="w-full border p-2 rounded" />
        </div>
        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-bold mb-1">CPF (Opcional)</label>
                <input name="cpf" value={formData.cpf} onChange={handleChange} className="w-full border p-2 rounded" />
            </div>
            <div>
                <label className="block text-sm font-bold mb-1">Telefone</label>
                <input name="telefone" value={formData.telefone} onChange={handleChange} className="w-full border p-2 rounded" />
            </div>
        </div>
        <div>
            <label className="block text-sm font-bold mb-1">E-mail</label>
            <input name="email" value={formData.email} onChange={handleChange} className="w-full border p-2 rounded" />
        </div>

        <div className="mt-4 border-t pt-2">
            <h3 className="font-bold mb-2 text-gray-700">Endereço</h3>
            <input name="rua" placeholder="Endereço completo" value={formData.endereco.rua} onChange={handleAddressChange} className="w-full border p-2 rounded mb-2" />
        </div>

        <button 
            onClick={() => onSubmit(formData)}
            className="mt-4 w-full bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 font-bold"
        >
            Salvar Pessoa
        </button>
      </div>
    </div>
  );
}