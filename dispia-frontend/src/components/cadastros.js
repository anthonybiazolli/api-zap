import { useState } from 'react';
import Head from 'next/head';
import EmpresaForm from '../components/Forms/EmpresaForm';
import PessoaForm from '../components/Forms/PessoaForm';

export default function Cadastros() {
  const [tipoCadastro, setTipoCadastro] = useState('empresa'); // 'empresa' | 'pessoa'
  const [mensagem, setMensagem] = useState(null);

  const handleSubmitEmpresa = async (dados) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/empresas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
      });
      if (res.ok) setMensagem({ tipo: 'sucesso', texto: 'Empresa salva com sucesso!' });
      else setMensagem({ tipo: 'erro', texto: 'Erro ao salvar empresa.' });
    } catch (error) {
      setMensagem({ tipo: 'erro', texto: 'Erro de conexão.' });
    }
  };

  const handleSubmitPessoa = async (dados) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/pessoas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
      });
      if (res.ok) setMensagem({ tipo: 'sucesso', texto: 'Pessoa salva com sucesso!' });
      else setMensagem({ tipo: 'erro', texto: 'Erro ao salvar pessoa.' });
    } catch (error) {
      setMensagem({ tipo: 'erro', texto: 'Erro de conexão.' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <Head><title>Cadastros - DispIA CRM</title></Head>
      
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Central de Cadastros</h1>
        
        {mensagem && (
          <div className={`p-4 mb-4 rounded text-white ${mensagem.tipo === 'sucesso' ? 'bg-green-500' : 'bg-red-500'}`}>
            {mensagem.texto}
            <button onClick={() => setMensagem(null)} className="float-right font-bold">X</button>
          </div>
        )}

        <div className="flex gap-4 mb-6">
          <button 
            onClick={() => setTipoCadastro('empresa')}
            className={`px-6 py-3 rounded-lg font-bold shadow transition ${tipoCadastro === 'empresa' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}
          >
            🏢 Cadastrar Empresa
          </button>
          <button 
            onClick={() => setTipoCadastro('pessoa')}
            className={`px-6 py-3 rounded-lg font-bold shadow transition ${tipoCadastro === 'pessoa' ? 'bg-green-600 text-white' : 'bg-white text-gray-600'}`}
          >
            👤 Cadastrar Pessoa Física
          </button>
        </div>

        {tipoCadastro === 'empresa' ? (
            <EmpresaForm onSubmit={handleSubmitEmpresa} />
        ) : (
            <PessoaForm onSubmit={handleSubmitPessoa} />
        )}
      </div>
    </div>
  );
}