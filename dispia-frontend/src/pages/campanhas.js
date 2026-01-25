import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Chart } from "react-google-charts";

const API_URL = '/api/interno';

const DAYS = [
    { id: 1, label: 'Seg' }, { id: 2, label: 'Ter' }, { id: 3, label: 'Qua' },
    { id: 4, label: 'Qui' }, { id: 5, label: 'Sex' }, { id: 6, label: 'Sáb' }, { id: 0, label: 'Dom' }
];

export default function Campanhas() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [aba, setAba] = useState('lista'); 
  const [campanhas, setCampanhas] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const [empresasBase, setEmpresasBase] = useState([]);
  const [idsSelecionados, setIdsSelecionados] = useState([]);
  
  // Arquivos
  const [arquivoContatos, setArquivoContatos] = useState(null);
  const [arquivoMidia, setArquivoMidia] = useState(null);
  
  const [targetTab, setTargetTab] = useState('manual'); 

  // Audio Recording
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const [novoForm, setNovoForm] = useState({
    nome: '',
    mensagem: 'Olá {empresa}, tudo bem?',
    estados: [],
    alvosManuais: '',
    tipoEnvio: 'UNICO', 
    dataAgendamento: '',   
    diasSemana: [1,2,3,4,5], 
    horaInicio: '08:00',     
    horaFim: '18:00',        
    limiteDiario: 500        
  });

  useEffect(() => {
      const storedUser = localStorage.getItem('user');
      const token = localStorage.getItem('token');
      if (!storedUser || !token) { router.push('/login'); } 
      else { setUser(JSON.parse(storedUser)); setLoadingAuth(false); carregarCampanhas(); carregarBase(); }
  }, []);

  useEffect(() => { if (!loadingAuth) { const interval = setInterval(carregarCampanhas, 10000); return () => clearInterval(interval); } }, [loadingAuth]);

  const handleLogout = () => { localStorage.clear(); router.push('/login'); };
  const carregarCampanhas = async () => { try { const res = await fetch(`${API_URL}/campanhas`); if(res.ok) setCampanhas(await res.json()); } catch(e) {} };
  const carregarBase = async () => { try { const res = await fetch(`${API_URL}/empresas`); if(res.ok) setEmpresasBase(await res.json()); } catch(e) {} };
  
  const carregarRelatorio = async (id) => {
    const res = await fetch(`${API_URL}/campanhas/${id}/report`);
    if(res.ok) { setStats(await res.json()); setAba('relatorio'); }
  };

  const toggleDay = (dayId) => {
      const current = novoForm.diasSemana;
      if (current.includes(dayId)) setNovoForm({...novoForm, diasSemana: current.filter(d => d !== dayId)});
      else setNovoForm({...novoForm, diasSemana: [...current, dayId]});
  };

  const downloadCampaignTemplate = () => { window.open(`${API_URL}/import/template-campanha`, '_blank'); };

  const startRecording = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          mediaRecorderRef.current = new MediaRecorder(stream);
          audioChunksRef.current = [];
          mediaRecorderRef.current.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
          mediaRecorderRef.current.onstop = () => {
              const blob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
              const url = URL.createObjectURL(blob);
              setAudioBlob(blob);
              setAudioUrl(url);
          };
          mediaRecorderRef.current.start();
          setIsRecording(true);
      } catch (err) { alert("Erro: Microfone não permitido."); }
  };

  const stopRecording = () => {
      if (mediaRecorderRef.current) {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
      }
  };

  const clearAudio = () => {
      setAudioBlob(null);
      setAudioUrl(null);
  };

  const handleCriar = async () => {
    if(!novoForm.nome) return alert("Digite o nome da campanha.");
    
    const hInicio = parseInt(novoForm.horaInicio.replace(':',''));
    const hFim = parseInt(novoForm.horaFim.replace(':',''));
    if(hInicio < 800 || hFim > 1800) {
        if(!confirm("⚠️ HORÁRIO DE RISCO ⚠️\n\nVocê está configurando envios fora do horário comercial (08h-18h).\n\nDeseja continuar?")) return;
    }
    if(novoForm.diasSemana.includes(0) || novoForm.diasSemana.includes(6)) {
        if(!confirm("⚠️ FIM DE SEMANA DETECTADO ⚠️\n\nEnvios aos Sábados/Domingos têm alta taxa de denúncia.\n\nDeseja continuar?")) return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('nome', novoForm.nome);
    formData.append('mensagem', novoForm.mensagem);
    formData.append('tipoEnvio', novoForm.tipoEnvio);
    if(novoForm.dataAgendamento) formData.append('dataAgendamento', novoForm.dataAgendamento);
    formData.append('horaInicio', novoForm.horaInicio);
    formData.append('horaFim', novoForm.horaFim);
    formData.append('limiteDiario', novoForm.limiteDiario);
    formData.append('estados', JSON.stringify(novoForm.estados));
    formData.append('diasSemana', JSON.stringify(novoForm.diasSemana));
    formData.append('alvosManuais', novoForm.alvosManuais);
    formData.append('idsSelecionados', JSON.stringify(idsSelecionados));
    if (arquivoContatos) formData.append('file', arquivoContatos);

    // Mídia DUPLA
    if (arquivoMidia) formData.append('media', arquivoMidia);
    if (audioBlob) formData.append('audio', audioBlob, 'audio_gravado.mp3');

    try {
        const res = await fetch(`${API_URL}/campanhas`, { method: 'POST', body: formData });
        if(res.ok) {
            alert('Campanha Criada! 🚀');
            setAba('lista');
            carregarCampanhas();
            setIdsSelecionados([]);
            setArquivoContatos(null);
            setArquivoMidia(null);
            clearAudio();
            setNovoForm({...novoForm, alvosManuais: '', nome: '', mensagem: ''});
        } else { alert('Erro ao criar.'); }
    } catch(e) { alert('Erro de conexão'); } finally { setLoading(false); }
  };

  const toggleStatus = async (id) => { await fetch(`${API_URL}/campanhas/${id}/toggle`, { method: 'POST' }); carregarCampanhas(); }

  const SeletorBase = () => (
      <div className="h-48 overflow-y-auto border rounded bg-white p-2 text-gray-800">
          <div className="flex justify-between mb-2 pb-2 border-b">
              <span className="text-xs font-bold text-gray-500">{idsSelecionados.length} selecionados</span>
              <button onClick={() => setIdsSelecionados(empresasBase.map(e => e.id))} className="text-xs text-blue-600 underline">Todos</button>
          </div>
          {empresasBase.map(emp => (
              <label key={emp.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 border-b cursor-pointer">
                  <input type="checkbox" checked={idsSelecionados.includes(emp.id)} onChange={e => { if(e.target.checked) setIdsSelecionados([...idsSelecionados, emp.id]); else setIdsSelecionados(idsSelecionados.filter(id => id !== emp.id)); }} />
                  <div><div className="font-bold text-sm">{emp.nomeFantasia || emp.razaoSocial}</div><div className="text-xs text-gray-500">{emp.telefone || 'Sem fone'}</div></div>
              </label>
          ))}
      </div>
  );

  const ListaCampanhas = () => (
    <div className="grid gap-4">
        {campanhas.map(c => (
            <div key={c.id} className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500 flex justify-between items-center">
                <div>
                    <h3 className="font-bold text-lg text-gray-800">{c.nome}</h3>
                    <div className="flex gap-2 text-xs text-gray-500">
                        <span>{c.tipoEnvio === 'RECORRENTE' ? '🔄 Recorrente' : '🚀 Única'}</span>
                        <span>•</span>
                        <span>{c.processados} enviados</span>
                    </div>
                    {c.dataAgendamento && <p className="text-xs text-purple-600 font-bold mt-1">Início: {new Date(c.dataAgendamento).toLocaleString('pt-BR')}</p>}
                </div>
                <div className="flex gap-2">
                    <button onClick={() => toggleStatus(c.id)} className="px-3 py-1 bg-gray-200 rounded text-sm font-bold text-gray-700">{c.status === 'RODANDO' ? '⏸️' : '▶️'}</button>
                    <button onClick={() => carregarRelatorio(c.id)} className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm font-bold">📊</button>
                </div>
            </div>
        ))}
    </div>
  );

  const Relatorio = () => (
      <div className="bg-white p-6 rounded-lg shadow text-gray-800">
          <h2 className="text-xl font-bold mb-4">Relatório</h2>
          <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded font-bold text-blue-600 text-center">Enviadas: {stats?.enviadas}</div>
              <div className="bg-green-50 p-4 rounded font-bold text-green-600 text-center">Lidas: {stats?.lidas}</div>
              <div className="bg-yellow-50 p-4 rounded font-bold text-yellow-600 text-center">Respostas: {stats?.respondidas}</div>
          </div>
          <button onClick={() => setAba('lista')} className="mt-6 text-blue-600 underline">Voltar</button>
      </div>
  );

  if (loadingAuth) return <div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-white">Verificando acesso...</div>;

  return (
    <div className="min-h-screen bg-[#0f172a] text-gray-100 font-sans pb-20">
        <Head><title>Campanhas - DispIA Corp</title></Head>
        <nav className="bg-[#1e293b] border-b border-gray-700 px-6 py-4 flex justify-between items-center shadow-md sticky top-0 z-40 mb-8">
            <div className="flex items-center gap-3"><Link href="/" className="text-2xl">🤖</Link><Link href="/" className="text-xl font-bold">DispIA <span className="text-blue-400">Corp</span></Link></div>
            <div className="flex items-center gap-4 text-sm"><div className="text-right hidden md:block"><p className="text-white font-bold">{user?.name}</p><p className="text-xs text-gray-400 uppercase">{user?.role}</p></div><button onClick={handleLogout} className="bg-red-900/30 text-red-400 border border-red-800 px-4 py-2 rounded hover:bg-red-900/50">Sair</button></div>
        </nav>
        <div className="max-w-7xl mx-auto px-6">
            <h1 className="text-3xl font-bold mb-6">Gestor de Campanhas</h1>
            {aba === 'lista' && (
                <>
                    <div className="flex gap-4 mb-6"><button className="px-4 py-2 rounded font-bold bg-blue-600">Ativas</button><button onClick={() => setAba('nova')} className="px-4 py-2 rounded font-bold bg-gray-700 hover:bg-gray-600">+ Nova</button></div>
                    <ListaCampanhas />
                </>
            )}
            {aba === 'nova' && (
                <div className="bg-white p-6 rounded-lg shadow text-gray-800 animate-fade-in">
                    <h2 className="text-xl font-bold mb-4 border-b pb-2">Nova Campanha</h2>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold mb-1">Nome da Campanha</label>
                            <input value={novoForm.nome} onChange={e => setNovoForm({...novoForm, nome: e.target.value})} className="w-full border p-2 rounded mb-4 focus:ring-2 focus:ring-blue-500 outline-none" />
                            <label className="block text-xs font-bold mb-1">Mensagem</label>
                            <textarea value={novoForm.mensagem} onChange={e => setNovoForm({...novoForm, mensagem: e.target.value})} className="w-full border p-2 rounded h-24 mb-2 bg-yellow-50 focus:ring-2 focus:ring-blue-500 outline-none" />
                            
                            <div className="mb-4 bg-gray-50 p-3 rounded border border-gray-200">
                                <label className="block text-xs font-bold mb-2 text-gray-500 uppercase">Mídia / Anexo</label>
                                <div className="flex gap-4 items-start">
                                    <div className="flex-1">
                                        <label className="block text-[10px] font-bold mb-1">Arquivo</label>
                                        <input type="file" onChange={e => setArquivoMidia(e.target.files[0])} className="w-full text-xs" />
                                    </div>
                                    <div className="flex-1 border-l pl-4">
                                        <label className="block text-[10px] font-bold mb-1">Áudio (PTT)</label>
                                        {!audioBlob ? (
                                            <button onClick={isRecording ? stopRecording : startRecording} className={`w-full py-1 rounded text-xs font-bold ${isRecording ? 'bg-red-600 text-white animate-pulse' : 'bg-gray-200 text-gray-700'}`}>
                                                {isRecording ? '⏹️ Parar' : '🎤 Gravar'}
                                            </button>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <audio src={audioUrl} controls className="h-8 w-24" />
                                                <button onClick={clearAudio} className="text-red-500 font-bold px-2 hover:bg-red-50">✕</button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gray-50 p-4 rounded-lg mb-4 border border-gray-200">
                                <label className="block text-xs font-bold mb-3 uppercase text-gray-500">Proteção e Agendamento</label>
                                <div className="flex gap-3 mb-4">
                                    <button onClick={() => setNovoForm({...novoForm, tipoEnvio: 'UNICO'})} className={`flex-1 py-3 rounded-lg text-sm font-bold transition border-2 ${novoForm.tipoEnvio === 'UNICO' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 bg-white text-gray-500'}`}>🚀 Envio Único</button>
                                    <button onClick={() => setNovoForm({...novoForm, tipoEnvio: 'RECORRENTE'})} className={`flex-1 py-3 rounded-lg text-sm font-bold transition border-2 ${novoForm.tipoEnvio === 'RECORRENTE' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 bg-white text-gray-500'}`}>🔄 Recorrente</button>
                                </div>
                                <div className="space-y-3 p-3 bg-white rounded border border-gray-200">
                                    {novoForm.tipoEnvio === 'RECORRENTE' && (
                                        <div className="mb-2 pb-2 border-b"><label className="text-[10px] font-bold text-gray-500">Data de Início</label><input type="datetime-local" value={novoForm.dataAgendamento} onChange={e => setNovoForm({...novoForm, dataAgendamento: e.target.value})} className="w-full border p-1 rounded text-xs" /></div>
                                    )}
                                    <div>
                                        <label className="block text-[10px] font-bold mb-1 text-purple-800">Dias de Funcionamento</label>
                                        <div className="flex gap-1">
                                            {DAYS.map(day => (
                                                <button key={day.id} onClick={() => toggleDay(day.id)} className={`w-8 h-8 rounded text-[10px] font-bold transition ${novoForm.diasSemana.includes(day.id) ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-100 text-gray-400 border border-gray-200'}`}>{day.label[0]}</button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div><label className="text-[10px] font-bold">Início</label><input type="time" value={novoForm.horaInicio} onChange={e => setNovoForm({...novoForm, horaInicio: e.target.value})} className="w-full border p-1 rounded text-sm" /></div>
                                        <div><label className="text-[10px] font-bold">Fim</label><input type="time" value={novoForm.horaFim} onChange={e => setNovoForm({...novoForm, horaFim: e.target.value})} className="w-full border p-1 rounded text-sm" /></div>
                                    </div>
                                    <div className="pt-2"><label className="text-[10px] font-bold text-gray-600">Limite Diário</label><input type="number" value={novoForm.limiteDiario} onChange={e => setNovoForm({...novoForm, limiteDiario: e.target.value})} className="w-24 ml-2 border p-1 rounded text-xs text-center font-mono" /></div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded border flex flex-col h-full">
                            <h3 className="font-bold text-sm mb-3 text-blue-600">🎯 Quem receberá?</h3>
                            <div className="flex gap-1 mb-3 text-xs overflow-x-auto">
                                <button onClick={() => setTargetTab('manual')} className={`px-3 py-1 rounded-t whitespace-nowrap ${targetTab === 'manual' ? 'bg-white border-t border-x font-bold' : 'bg-gray-200'}`}>✍️ Manual</button>
                                <button onClick={() => setTargetTab('arquivo')} className={`px-3 py-1 rounded-t whitespace-nowrap ${targetTab === 'arquivo' ? 'bg-white border-t border-x font-bold' : 'bg-gray-200'}`}>📂 Planilha</button>
                                <button onClick={() => setTargetTab('base')} className={`px-3 py-1 rounded-t whitespace-nowrap ${targetTab === 'base' ? 'bg-white border-t border-x font-bold' : 'bg-gray-200'}`}>🗄️ Da Base</button>
                                <button onClick={() => setTargetTab('estados')} className={`px-3 py-1 rounded-t whitespace-nowrap ${targetTab === 'estados' ? 'bg-white border-t border-x font-bold' : 'bg-gray-200'}`}>🗺️ Estados</button>
                            </div>
                            <div className="flex-1 bg-white border p-3 rounded-b-lg rounded-tr-lg min-h-[250px]">
                                {targetTab === 'manual' && <textarea value={novoForm.alvosManuais} onChange={e => setNovoForm({...novoForm, alvosManuais: e.target.value})} className="w-full h-full border p-2 rounded font-mono text-sm focus:outline-none" placeholder="11999999999 (Um por linha)" />}
                                {targetTab === 'arquivo' && <div className="flex flex-col items-center justify-center h-full border-2 border-dashed rounded bg-gray-50 p-4 relative"><button onClick={downloadCampaignTemplate} className="absolute top-2 right-2 text-[10px] bg-blue-100 text-blue-600 px-2 py-1 rounded hover:bg-blue-200 font-bold z-10">📥 Modelo</button><p className="text-sm font-bold text-gray-600 mb-2 mt-4">Lista</p><input type="file" accept=".xlsx, .xls, .csv" onChange={e => setArquivoContatos(e.target.files[0])} className="text-xs" /></div>}
                                {targetTab === 'base' && <SeletorBase />}
                                {targetTab === 'estados' && <select multiple className="w-full h-full border p-2 rounded focus:outline-none" onChange={e => setNovoForm({...novoForm, estados: Array.from(e.target.selectedOptions, o => o.value)})}>{['SP','RJ','MG','PR','SC','RS'].map(uf => <option key={uf} value={uf}>{uf}</option>)}</select>}
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end mt-6 pt-4 border-t gap-3">
                        <button onClick={() => setAba('lista')} className="px-6 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg">Cancelar</button>
                        <button onClick={handleCriar} disabled={loading} className="bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold px-8 py-2 rounded-lg hover:from-green-500 hover:to-emerald-500 shadow-lg flex items-center gap-2 transform active:scale-95 disabled:opacity-50">
                            {loading ? <span className="animate-spin">⏳</span> : '🚀'} {loading ? 'Processando...' : 'Lançar Campanha'}
                        </button>
                    </div>
                </div>
            )}
            {aba === 'relatorio' && <Relatorio />}
        </div>
    </div>
  );
}