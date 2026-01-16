import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { smartContactCleaner, analyzeRisk } from '../utils/dispiaIntelligence';
import { jsPDF } from "jspdf";

export default function Disparador({ userId, userToken }) {
    const [message, setMessage] = useState('');
    const [contacts, setContacts] = useState([]);
    const [invalidContacts, setInvalidContacts] = useState([]);
    const [isSending, setIsSending] = useState(false);
    const [logs, setLogs] = useState([]);
    
    // Configurações de "Fugir do Radar"
    const [minDelay, setMinDelay] = useState(15);
    const [maxDelay, setMaxDelay] = useState(45);
    
    const [healthAnalysis, setHealthAnalysis] = useState(null);

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if(!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws);
            
            // Aciona a IA de correção
            const processed = smartContactCleaner(data);
            setContacts(processed.valid);
            setInvalidContacts(processed.invalid);
            
            // Analisa saúde preventiva
            const risk = analyzeRisk(processed.valid.length, minDelay, maxDelay);
            setHealthAnalysis(risk);
        };
        reader.readAsBinaryString(file);
    };

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const startCampaign = async () => {
        setIsSending(true);
        const newLogs = [];

        // Loop de envio
        for (let i = 0; i < contacts.length; i++) {
            const contact = contacts[i];
            
            // Lógica de Delay Variável (Anti-Ban)
            const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay) * 1000;
            
            // Atualiza status na tela
            setLogs(prev => [`[${new Date().toLocaleTimeString()}] Aguardando ${delay/1000}s para enviar p/ ${contact.telefone}...`, ...prev]);
            
            await sleep(delay);

            try {
                // Chamada à SUA API (Backend)
                const response = await fetch('http://localhost:3000/message/text', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId: userId, // Identificador da sessão
                        number: contact.telefone,
                        message: message
                    })
                });

                const result = await response.json();
                const status = response.ok ? '✅ Enviado' : '❌ Erro';
                
                newLogs.push({ phone: contact.telefone, status: status, time: new Date().toLocaleString() });
                setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${contact.telefone}: ${status}`, ...prev]);

            } catch (error) {
                console.error("Erro no envio", error);
                setLogs(prev => [`[Erro] Falha ao conectar na API`, ...prev]);
            }
        }
        setIsSending(false);
        generatePDFReport(newLogs);
    };

    const generatePDFReport = (finalLogs) => {
        const doc = new jsPDF();
        doc.text("Relatório de Envio - DispIA", 10, 10);
        let y = 20;
        finalLogs.forEach((log) => {
            if (y > 280) { doc.addPage(); y = 10; }
            doc.text(`${log.time} - ${log.phone} - ${log.status}`, 10, y);
            y += 10;
        });
        doc.save("relatorio_campanha.pdf");
    };

    return (
        <div className="bg-white p-6 rounded shadow-lg">
            <h2 className="text-xl font-bold mb-4 text-purple-700">Disparador de Campanhas</h2>
            
            {/* Aviso de Saúde do Número */}
            {healthAnalysis && (
                <div className={`p-4 mb-4 rounded border ${healthAnalysis.score < 50 ? 'bg-red-100 border-red-300 text-red-800' : 'bg-green-100 border-green-300 text-green-800'}`}>
                    <h3 className="font-bold flex items-center">
                        🛡️ Saúde da Campanha: {healthAnalysis.riskLevel} (Score: {healthAnalysis.score})
                    </h3>
                    <ul className="text-sm mt-2 list-disc list-inside">
                        {healthAnalysis.recommendations.map((rec, i) => <li key={i}>{rec}</li>)}
                    </ul>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Coluna da Esquerda: Configuração */}
                <div>
                    <div className="mb-4">
                        <label className="block text-sm font-bold text-gray-700 mb-1">Mensagem</label>
                        <textarea 
                            className="w-full border p-2 rounded focus:ring-2 focus:ring-purple-500" 
                            rows="5" 
                            placeholder="Digite sua mensagem aqui (suporta emojis 🚀)..." 
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                        />
                    </div>
                    
                    <div className="mb-4">
                        <label className="block text-sm font-bold text-gray-700 mb-1">Upload de Contatos (Excel/CSV)</label>
                        <input 
                            type="file" 
                            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" 
                            onChange={handleFileUpload} 
                        />
                    </div>

                    <div className="mb-6 bg-yellow-50 p-4 rounded border border-yellow-200">
                        <label className="block font-bold text-yellow-800 text-sm mb-2">⏱️ Intervalo Seguro (segundos)</label>
                        <div className="flex space-x-4 items-center">
                            <input type="number" value={minDelay} onChange={e => setMinDelay(Number(e.target.value))} className="border p-1 w-20 rounded" />
                            <span className="text-gray-500">até</span>
                            <input type="number" value={maxDelay} onChange={e => setMaxDelay(Number(e.target.value))} className="border p-1 w-20 rounded" />
                        </div>
                    </div>

                    <button 
                        onClick={startCampaign} 
                        disabled={isSending || contacts.length === 0}
                        className={`w-full text-white font-bold py-3 px-4 rounded shadow transition ${isSending ? 'bg-gray-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'}`}
                    >
                        {isSending ? '🚀 Enviando Campanha...' : `Iniciar Disparo (${contacts.length} contatos)`}
                    </button>
                </div>

                {/* Coluna da Direita: Logs e Status */}
                <div>
                    <div className="bg-gray-50 p-4 rounded border mb-4 h-40 overflow-y-auto">
                        <h3 className="font-bold text-gray-700 mb-2">Status da Importação</h3>
                        {contacts.length === 0 && <p className="text-gray-400 text-sm">Nenhum arquivo carregado.</p>}
                        {contacts.length > 0 && <p className="text-green-600 font-bold text-sm">✓ {contacts.length} Contatos Válidos</p>}
                        {invalidContacts.length > 0 && (
                            <div className="mt-2">
                                <p className="text-red-600 font-bold text-sm">⚠ {invalidContacts.length} Contatos Inválidos/Corrigidos</p>
                                <ul className="text-xs text-red-500 mt-1">
                                    {/* A CORREÇÃO PRINCIPAL ESTÁ AQUI ABAIXO */}
                                    {invalidContacts.slice(0, 5).map((c, i) => (
                                        <li key={i}>{c.original} &rarr; {c.reason}</li>
                                    ))}
                                    {invalidContacts.length > 5 && <li>...e mais {invalidContacts.length - 5}</li>}
                                </ul>
                            </div>
                        )}
                    </div>

                    <div className="bg-gray-900 text-green-400 p-4 rounded h-64 overflow-y-auto font-mono text-xs border border-gray-700">
                        <h3 className="font-bold text-white mb-2 border-b border-gray-700 pb-1">&gt; Terminal de Logs</h3>
                        {logs.map((log, i) => (
                            <div key={i} className="mb-1">{typeof log === 'string' ? log : `${log.time} - ${log.phone} - ${log.status}`}</div>
                        ))}
                        {logs.length === 0 && <span className="animate-pulse">Aguardando comando...</span>}
                    </div>
                </div>
            </div>
        </div>
    );
}