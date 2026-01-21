import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import EmpresaForm from '../components/Forms/EmpresaForm';

const API_URL = '/api/interno';

export default function Cadastros() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // === ESTADO DE ABAS ===
  const [activeTab, setActiveTab] = useState('empresas'); 

  const [visao, setVisao] = useState('lista'); 
  const [empresas, setEmpresas] = useState([]);
  const [pessoas, setPessoas] = useState([]); 
  
  const [empresaEditando, setEmpresaEditando] = useState(null);
  const [notificacao, setNotificacao] = useState(null);
  
  const [idsSelecionados, setIdsSelecionados] = useState([]);
  const [processando, setProcessando] = useState(false);
  const [tipoProcesso, setTipoProcesso] = useState(''); 
  const [progresso, setProgresso] = useState({ atual: 0, total: 0, sucessos: 0, erros: 0, ignorados: 0 });
  const [logsProcesso, setLogsProcesso] = useState([]);
  
  const fileInputRef = useRef(null);

  useEffect(() => {
      const storedUser = localStorage.getItem('user');
      const token = localStorage.getItem('token');
      if (!storedUser || !token) { router.push('/login'); } 
      else {
          setUser(JSON.parse(storedUser));
          setLoadingAuth(false);
          carregarDados();
      }
  }, [activeTab]); 

  const handleLogout = () => { localStorage.clear(); router.push('/login'); };

  const carregarDados = async () => {
    try {
      if (activeTab === 'empresas') {
          const res = await fetch(`${API_URL}/empresas`);
          const data = await res.json();
          setEmpresas(Array.isArray(data) ? data : []);
      } else {
          setPessoas([]); 
      }
      setIdsSelecionados([]); 
    } catch (error) { console.error(error); }
  };

  const showNotify = (tipo, texto) => {
    setNotificacao({ tipo, texto });
    setTimeout(() => setNotificacao(null), 5000);
  };

  const handleSelectAll = (e) => {
      const listaAtual = activeTab === 'empresas' ? empresas : pessoas;
      if (e.target.checked) setIdsSelecionados(listaAtual.map(e => e.id));
      else setIdsSelecionados([]);
  };
  
  const handleSelectOne = (id) => {
      if (idsSelecionados.includes(id)) setIdsSelecionados(idsSelecionados.filter(i => i !== id));
      else setIdsSelecionados([...idsSelecionados, id]);
  };

  // === EXPORTAÇÃO DA BASE (Com UF separada) ===
  const handleExportBase = () => {
      const lista = activeTab === 'empresas' ? empresas : pessoas;
      if(lista.length === 0) return alert("Nada para exportar.");
      
      const dadosExport = lista.map(item => {
          if(activeTab === 'empresas') {
              return {
                  CNPJ: item.cnpj,
                  'Razão Social': item.razaoSocial,
                  'Nome Fantasia': item.nomeFantasia,
                  'Email': item.email,
                  'Telefone': item.telefone,
                  'Cidade': item.endereco?.cidade || '',
                  'UF': item.endereco?.estado || '', // ADICIONADO
                  'Status': item.statusRF
              };
          } else {
              return { Nome: item.name, CPF: item.documento, Telefone: item.telefone };
          }
      });

      const ws = XLSX.utils.json_to_sheet(dadosExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, activeTab === 'empresas' ? "Empresas" : "Pessoas");
      XLSX.writeFile(wb, `Base_${activeTab}_DispIA.xlsx`);
  };

  const handleDeleteBatch = async () => {
      if(activeTab !== 'empresas') return alert("Exclusão em lote disponível apenas para empresas.");
      if (idsSelecionados.length === 0) return alert("Selecione itens.");
      if (!confirm(`Confirmar exclusão de ${idsSelecionados.length} itens?`)) return;

      try {
          const res = await fetch(`${API_URL}/empresas/batch-delete`, {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ ids: idsSelecionados })
          });
          if (res.ok) { showNotify('sucesso', 'Excluído.'); carregarDados(); } 
      } catch (e) { showNotify('erro', 'Erro conexão.'); }
  };

  const findValue = (row, ...keys) => {
      const rowKeys = Object.keys(row);
      for (const k of keys) {
          const found = rowKeys.find(rk => rk.trim().toUpperCase() === k.toUpperCase());
          if (found) return row[found];
      }
      return null;
  };

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // === IMPORTAÇÃO ===
  const handleFileChange = async (e) => {
      if(activeTab !== 'empresas') return alert("Importação via API disponível apenas para Empresas (CNPJ).");
      
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      
      reader.onload = async (evt) => {
          const wb = XLSX.read(evt.target.result, { type: 'binary' });
          const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
          if (data.length === 0) return alert("Vazio.");

          setProcessando(true);
          setTipoProcesso('IMPORTACAO');
          setProgresso({ atual: 0, total: data.length, sucessos: 0, erros: 0, ignorados: 0 });
          setLogsProcesso([]);

          const logs = [];
          let succ = 0, err = 0, ign = 0;

          for (let i = 0; i < data.length; i++) {
              const row = data[i];
              const rawCnpj = findValue(row, 'CNPJ', 'cpf/cnpj', 'documento');
              const rawRazao = findValue(row, 'RAZAO', 'nome', 'empresa');

              if (!rawCnpj) {
                  logs.push({ cnpj: '?', status: 'Erro', msg: 'Sem CNPJ', razao: '-', socios: '-' });
                  err++;
                  setProgresso({ atual: i + 1, total: data.length, sucessos: succ, erros: err, ignorados: ign });
                  continue;
              }

              try {
                  const res = await fetch(`${API_URL}/import/single`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ cnpj: String(rawCnpj), razaoSocial: rawRazao })
                  });
                  const json = await res.json();
                  const det = json.dados || {};

                  logs.push({ 
                      cnpj: String(rawCnpj), 
                      status: json.status,
                      msg: json.motivo || 'OK',
                      razao: det.razao || rawRazao || '-',
                      cidade: det.cidade || '-',
                      uf: det.uf || '-', // ADICIONADO
                      telefone: det.telefone || '-',
                      email: det.email || '-',
                      socios: det.socios || '-'
                  });

                  if (json.status === 'sucesso') succ++;
                  else if (json.status === 'ignorado') ign++;
                  else err++;

              } catch (e) { err++; logs.push({ cnpj: String(rawCnpj), status: 'Erro', msg: 'Rede', socios: '-' }); }
              
              setProgresso({ atual: i + 1, total: data.length, sucessos: succ, erros: err, ignorados: ign });
              await sleep(1500); 
          }
          setLogsProcesso(logs);
          carregarDados();
      };
      reader.readAsBinaryString(file);
      e.target.value = null; 
  };

  // === ATUALIZAÇÃO EM MASSA (REFRESH) ===
  const handleBatchRefresh = async () => {
      if(activeTab !== 'empresas') return alert("Apenas para empresas.");
      
      let alvos = [];
      if (idsSelecionados.length > 0) {
          alvos = empresas.filter(e => idsSelecionados.includes(e.id));
      } else {
          if(!confirm(`Atualizar TODAS as ${empresas.length} empresas da base via API? Isso pode demorar.`)) return;
          alvos = [...empresas];
      }

      setProcessando(true);
      setTipoProcesso('ATUALIZACAO');
      setProgresso({ atual: 0, total: alvos.length, sucessos: 0, erros: 0, ignorados: 0 });
      setLogsProcesso([]);

      let succ = 0, err = 0;
      const logs = [];

      for (let i = 0; i < alvos.length; i++) {
          const empresa = alvos[i];
          
          try {
              const res = await fetch(`${API_URL}/empresas/${empresa.id}/refresh`, { method: 'POST' });
              const json = await res.json();

              if (res.ok) {
                  succ++;
                  const d = json.dados;
                  logs.push({
                      cnpj: empresa.cnpj,
                      status: 'Atualizado',
                      msg: 'Dados sincronizados',
                      razao: d.razao,
                      email: d.email,
                      telefone: d.telefone,
                      cidade: d.cidade || '-', // ADICIONADO
                      uf: d.uf || '-',         // ADICIONADO
                      socios: d.socios
                  });
              } else {
                  err++;
                  logs.push({ cnpj: empresa.cnpj, status: 'Erro', msg: json.error || 'Falha API', razao: empresa.razaoSocial, socios: '-' });
              }

          } catch (e) {
              err++;
              logs.push({ cnpj: empresa.cnpj, status: 'Erro Fatal', msg: 'Erro Conexão', razao: empresa.razaoSocial, socios: '-' });
          }

          setProgresso({ atual: i + 1, total: alvos.length, sucessos: succ, erros: err, ignorados: 0 });
          await sleep(1500);
      }
      
      setLogsProcesso(logs);
      carregarDados();
  };

  // === RELATÓRIO FINAL (Com UF e QSA) ===
  const gerarRelatorioFinal = (formato) => {
      const titulo = tipoProcesso === 'IMPORTACAO' ? "Resultado Importação" : "Resultado Atualização";

      if (formato === 'excel') {
          const dadosExport = logsProcesso.map(l => ({
              CNPJ: l.cnpj,
              Status: l.status,
              Mensagem: l.msg,
              'Razão Social': l.razao,
              'Cidade': l.cidade,
              'UF': l.uf, // ADICIONADO
              'Telefone': l.telefone,
              'Email': l.email,
              'Sócios (QSA)': l.socios
          }));
          const ws = XLSX.utils.json_to_sheet(dadosExport);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Resultado");
          XLSX.writeFile(wb, "Relatorio_Processamento.xlsx");
      } else {
          const doc = new jsPDF('l', 'mm', 'a4');
          doc.text(titulo, 14, 15);
          doc.setFontSize(8);
          
          autoTable(doc, { 
              startY: 20, 
              head: [['CNPJ', 'Status', 'Razão', 'Cidade', 'UF', 'QSA']], 
              body: logsProcesso.map(l => [
                  l.cnpj, 
                  l.status, 
                  l.razao?.substring(0, 20), 
                  l.cidade || '-', 
                  l.uf || '-', // ADICIONADO
                  l.socios?.substring(0, 30)
              ]),
              styles: { fontSize: 7, cellPadding: 1 },
              columnStyles: { 5: { cellWidth: 70 } }
          });
          doc.save("Relatorio_Processamento.pdf");
      }
      setProcessando(false);
  };

  const handleSubmitEmpresa = async (d) => { await fetch(`${API_URL}/empresas`,{method:'POST',body:JSON.stringify(d),headers:{'Content-Type':'application/json'}}); setVisao('lista'); carregarDados(); };
  const handleEdit = (e) => { setEmpresaEditando(e); setVisao('novo'); };
  const handleDelete = async (id) => { if(confirm('Apagar?')) { await fetch(`${API_URL}/empresas/${id}`,{method:'DELETE'}); carregarDados(); }};

  if (loadingAuth) return <div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-white">Carregando...</div>;

  return (
    <div className="min-h-screen bg-[#0f172a] text-gray-100 font-sans pb-20">
      <Head><title>Cadastros - DispIA</title></Head>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv, .xlsx, .xls" className="hidden" />

      <nav className="bg-[#1e293b] border-b border-gray-700 px-6 py-4 flex justify-between items-center shadow-md sticky top-0 z-40 mb-8">
          <div className="flex items-center gap-3"><Link href="/" className="text-2xl cursor-pointer">🤖</Link><Link href="/" className="text-xl font-bold">DispIA <span className="text-blue-400">Hub</span></Link></div>
          <div className="flex items-center gap-4 text-sm"><div className="text-right hidden md:block"><p className="text-white font-bold">{user?.nome}</p><p className="text-xs text-gray-400 uppercase">{user?.role}</p></div><button onClick={handleLogout} className="bg-red-900/30 text-red-400 border border-red-800 px-4 py-2 rounded hover:bg-red-900/50">Sair</button></div>
      </nav>

      {/* MODAL DE PROCESSAMENTO */}
      {processando && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 animate-fade-in">
              <div className="bg-white text-gray-800 p-6 rounded-lg w-full max-w-2xl shadow-2xl">
                  <h2 className="text-xl font-bold mb-4">
                      {tipoProcesso === 'IMPORTACAO' ? 'Importando Empresas...' : 'Atualizando via OpenCNPJ...'}
                  </h2>
                  <div className="w-full bg-gray-200 rounded-full h-4 mb-2"><div className="bg-blue-600 h-4 rounded-full transition-all" style={{ width: `${(progresso.atual / progresso.total) * 100}%` }}></div></div>
                  <p className="text-center text-sm font-bold mb-4">{progresso.atual} de {progresso.total}</p>
                  
                  {progresso.atual === progresso.total && (
                      <div className="text-center bg-gray-50 p-4 rounded border">
                          <p className="mb-2 text-green-600 font-bold">Processo Concluído!</p>
                          <p className="text-xs text-gray-500 mb-4">O relatório inclui os dados enriquecidos.</p>
                          <div className="flex gap-2 justify-center">
                              <button onClick={() => gerarRelatorioFinal('pdf')} className="bg-red-600 text-white px-4 py-2 rounded font-bold hover:bg-red-700">📄 Baixar PDF</button>
                              <button onClick={() => gerarRelatorioFinal('excel')} className="bg-green-600 text-white px-4 py-2 rounded font-bold hover:bg-green-700">📊 Baixar Excel</button>
                              <button onClick={() => setProcessando(false)} className="bg-gray-500 text-white px-4 py-2 rounded font-bold hover:bg-gray-600">Fechar</button>
                          </div>
                      </div>
                  )}
                  {progresso.atual < progresso.total && <p className="text-center text-xs text-gray-400 animate-pulse">Aguarde, consultando API...</p>}
              </div>
          </div>
      )}

      <div className="max-w-7xl mx-auto px-6">
        
        <div className="flex flex-col md:flex-row justify-between items-end mb-6 border-b border-gray-800 pb-4 gap-4">
            <div>
                <h1 className="text-3xl font-bold text-white mb-2">Central de Cadastros</h1>
                <div className="flex gap-2 mt-4">
                    <button onClick={() => { setActiveTab('empresas'); setVisao('lista'); }} className={`px-4 py-2 rounded-t-lg font-bold transition ${activeTab === 'empresas' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>🏢 Empresas (CNPJ)</button>
                    <button onClick={() => { setActiveTab('pessoas'); setVisao('lista'); }} className={`px-4 py-2 rounded-t-lg font-bold transition ${activeTab === 'pessoas' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>👤 Pessoas (CPF)</button>
                </div>
            </div>

            <div className="flex gap-2 flex-wrap justify-end">
                {visao === 'lista' && activeTab === 'empresas' && (
                    <>
                        <button onClick={handleDeleteBatch} className="bg-red-900/40 border border-red-600/50 hover:bg-red-800 text-red-100 px-3 py-2 rounded text-xs font-bold transition">🗑️ Apagar</button>
                        <button onClick={handleBatchRefresh} className="bg-yellow-600 hover:bg-yellow-500 text-white px-3 py-2 rounded text-xs font-bold transition flex items-center gap-1 shadow">🔄 Atualizar Dados</button>
                        <button onClick={handleExportBase} className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-2 rounded text-xs font-bold transition">📊 Exportar</button>
                        <button onClick={() => window.open(`${API_URL}/import/template`, '_blank')} className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded text-xs font-bold transition">📥 Modelo</button>
                        <button onClick={() => fileInputRef.current.click()} className="bg-green-700 hover:bg-green-600 px-3 py-2 rounded text-xs font-bold transition">📤 Importar API</button>
                    </>
                )}
                {visao === 'lista' && activeTab === 'pessoas' && (
                     <button onClick={handleExportBase} className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-2 rounded text-xs font-bold transition">📊 Exportar</button>
                )}
                <button onClick={() => { setEmpresaEditando(null); setVisao(visao === 'lista' ? 'novo' : 'lista'); }} className={`px-3 py-2 rounded text-xs font-bold transition ${visao === 'lista' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-600'}`}>{visao === 'lista' ? '+ Novo' : '← Voltar'}</button>
            </div>
        </div>

        {/* TABELA COM COLUNA UF SEPARADA */}
        {visao === 'lista' ? (
            <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden animate-fade-in text-gray-800">
                {activeTab === 'empresas' ? (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-100 text-gray-600 text-xs uppercase">
                                <th className="p-4 border-b w-10 text-center"><input type="checkbox" onChange={handleSelectAll} checked={empresas.length > 0 && idsSelecionados.length === empresas.length} /></th>
                                <th className="p-4 border-b">Empresa</th>
                                <th className="p-4 border-b">Dados</th>
                                <th className="p-4 border-b">Cidade</th>
                                <th className="p-4 border-b w-16">UF</th>
                                <th className="p-4 border-b text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {empresas.length === 0 && <tr><td colSpan="6" className="p-8 text-center text-gray-500">Nenhuma empresa cadastrada.</td></tr>}
                            {empresas.map(emp => (
                                <tr key={emp.id} className={`hover:bg-blue-50 border-b last:border-0 transition ${idsSelecionados.includes(emp.id) ? 'bg-blue-50' : ''}`}>
                                    <td className="p-4 text-center"><input type="checkbox" checked={idsSelecionados.includes(emp.id)} onChange={() => handleSelectOne(emp.id)} /></td>
                                    <td className="p-4"><div className="font-bold">{emp.nomeFantasia || emp.razaoSocial}</div><div className="text-xs text-gray-500">{emp.email || 'Sem email'}</div></td>
                                    <td className="p-4 font-mono text-sm"><div>{emp.cnpj}</div><div className="text-green-600 font-bold">{emp.telefone || '-'}</div></td>
                                    <td className="p-4 text-sm">{emp.endereco?.cidade || '-'}</td>
                                    <td className="p-4 text-sm font-bold">{emp.endereco?.estado || '-'}</td>
                                    <td className="p-4 flex justify-center gap-2">
                                        <button onClick={() => handleEdit(emp)} className="p-2 bg-blue-100 text-blue-600 rounded hover:bg-blue-200">✏️</button>
                                        <button onClick={() => handleDelete(emp.id)} className="p-2 bg-red-100 text-red-600 rounded hover:bg-red-200">🗑️</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="p-8 text-center"><h3 className="text-xl font-bold text-gray-400 mb-2">Módulo de Pessoas (CPF)</h3><p className="text-gray-500">Em breve.</p></div>
                )}
            </div>
        ) : (
            <div className="animate-fade-in">
                {activeTab === 'empresas' ? (<EmpresaForm onSubmit={handleSubmitEmpresa} initialData={empresaEditando} />) : (<div className="bg-white p-6 rounded text-gray-800"><p>Formulário Pessoa (Breve)</p></div>)}
            </div>
        )}
      </div>
    </div>
  );
}