import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { analyzeRisk } from '../utils/dispiaIntelligence';
import { jsPDF } from "jspdf";

// Configura a URL da API
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function Disparador({ userId }) {
    const [apiUrl, setApiUrl] = useState('http://localhost:3000');
    const [message, setMessage] = useState('');
    const [contacts, setContacts] = useState([]);
    const [manualNumber, setManualNumber] = useState('');
    const [invalidContacts, setInvalidContacts] = useState([]);
    const [isSending, setIsSending] = useState(false);
    const [logs, setLogs] = useState([]);
    const [minDelay, setMinDelay] = useState(5);
    const [maxDelay, setMaxDelay] = useState(15);
    const [healthAnalysis, setHealthAnalysis] = useState(null);

    // --- DETECÇÃO AUTOMÁTICA DA URL DA API ---
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const currentUrl = window.location.origin;
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                setApiUrl('http://localhost:3000');
            } else {
                const newUrl = currentUrl.replace('3001', '3000');
                setApiUrl(newUrl);
            }
        }
    }, []);

    // --- NOVA LÓGICA DE LEITURA DE EXCEL (MAIS ROBUSTA) ---
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if(!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            
            // Lê como matriz de dados (Array de Arrays) para ignorar nomes de colunas
            const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 });
            
            const valid = [];
            const invalid = [];

            // Percorre todas as linhas
            jsonData.forEach((row) => {
                // Procura na linha qualquer célula que pareça um telefone
                const phoneCell = row.find(cell => {
                    if (!cell) return false;
                    const clean = String(cell).replace(/\D/g, '');
                    return clean.length >= 10; // Mínimo 10 dígitos (DDD + Número)
                });

                if (phoneCell) {
                    let cleanPhone = String(phoneCell).replace(/\D/g, '');
                    
                    // Tratamento Brasil (Adiciona 55 se faltar)
                    if (cleanPhone.length >= 10 && cleanPhone.length <= 11) {
                        cleanPhone = '55' + cleanPhone;
                    }

                    // Validação Final
                    if (cleanPhone.length >= 12 && cleanPhone.length <= 15) {
                        valid.push({ telefone: cleanPhone });
                    } else {
                        invalid.push({ original: phoneCell, reason: "Formato inválido" });
                    }
                }
            });
            
            setContacts(valid);
            setInvalidContacts(invalid);
            
            // Análise de Risco
            const risk = analyzeRisk(valid.length, minDelay, maxDelay);
            setHealthAnalysis(risk);

            // Feedback visual
            console.log(`Planilha processada: ${valid.length} válidos, ${invalid.length} inválidos.`);
        };
        reader.readAsBinaryString(file);
    };

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const startCampaign = async () => {
        let targetList = [...contacts];
        
        // Se a lista da planilha estiver vazia, tenta o número manual
        if (targetList.length === 0 && manualNumber) {
            let cleanManual = manualNumber.replace(/\D/g, '');
            if (cleanManual.length >= 10 && cleanManual.length <= 11) cleanManual = '55' + cleanManual;
            targetList = [{ telefone: cleanManual }];
        }

        if (targetList.length === 0) return alert("Nenhum número válido encontrado. Verifique sua planilha.");
        if (!message) return alert("Digite uma mensagem para enviar.");

        setIsSending(true);
        const newLogs = [];

        for (let i = 0; i < targetList.length; i++) {
            const contact = targetList[i];
            const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay) * 1000;
            
            if (i > 0) {
                setLogs(prev => [`⏳ [${new Date().toLocaleTimeString()}] Aguardando ${delay/1000}s...`, ...prev]);
                await sleep(delay);
            }

            try {
                setLogs(prev => [`🚀 Enviando para ${contact.telefone}...`, ...prev]);

                const response = await fetch(`${apiUrl}/message/text`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId: userId,
                        number: contact.telefone,
                        message: message
                    })
                });

                const data = await response.json();
                const status = response.ok ? '✅ Enviado' : `❌ Falha: ${data.error || 'Erro desc.'}`;
                
                newLogs.push({ phone: contact.telefone, status: status, time: new Date().toLocaleString() });
                setLogs(prev => [`${status} -> ${contact.telefone}`, ...prev]);

            } catch (error) {
                console.error(error);
                setLogs(prev => [`❌ Erro de Conexão com Backend`, ...prev]);
            }
        }
        setIsSending(false);
        if(newLogs.length > 0) generatePDFReport(newLogs);
    };

    const generatePDFReport = (finalLogs) => {
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text("Relatório DispIA", 10, 10);
        doc.setFontSize(10);
        let y = 20;
        finalLogs.forEach((log) => {
            if (y > 280) { doc.addPage(); y = 10; }
            doc.text(`${log.time} | ${log.phone} | ${log.status}`, 10, y);
            y += 7;
        });
        doc.save(`Relatorio_${userId}_${new Date().toISOString().slice(0,10)}.pdf`);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
                <div className="bg-dispia-card border border-gray-800 p-6 rounded-xl">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <span className="text-purple-500">1.</span> Configurar Campanha
                    </h3>
                    <div className="mb-4">
                        <label className="block text-sm text-gray-400 mb-2">Mensagem</label>
                        <textarea 
                            className="w-full bg-black border border-gray-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none h-32" 
                            placeholder="Digite sua mensagem aqui..." 
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="mb-4">
                            <label className="block text-sm text-gray-400 mb-2 text-green-400">⚡ Teste Rápido (1 Número)</label>
                            <input 
                                type="text"
                                placeholder="5511999998888"
                                value={manualNumber}
                                onChange={e => setManualNumber(e.target.value)}
                                className="w-full bg-black border border-gray-700 rounded-lg p-3 text-white focus:border-green-500 outline-none"
                            />
                        </div>
                        <div className="mb-4">
                            <label className="block text-sm text-gray-400 mb-2 text-purple-400">📁 Importar Excel</label>
                            <input 
                                type="file" 
                                className="block w-full text-xs text-gray-400 file:mr-2 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-purple-900/20 file:text-purple-400 hover:file:bg-purple-900/40 cursor-pointer"
                                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" 
                                onChange={handleFileUpload} 
                            />
                        </div>
                    </div>
                    
                    {/* Exibe quantos contatos foram achados */}
                    {contacts.length > 0 && (
                        <div className="mb-4 p-2 bg-green-900/20 border border-green-800 rounded text-center text-green-400 text-sm font-bold">
                            {contacts.length} Números encontrados na planilha!
                        </div>
                    )}

                    {healthAnalysis && (
                        <div className={`p-4 rounded-lg border ${healthAnalysis.score < 60 ? 'bg-red-900/20 border-red-800 text-red-300' : 'bg-green-900/20 border-green-800 text-green-300'}`}>
                            <div className="font-bold flex justify-between">
                                <span>Risco: {healthAnalysis.riskLevel}</span>
                                <span>Score: {healthAnalysis.score}</span>
                            </div>
                            <ul className="text-xs mt-2 list-disc list-inside opacity-80">
                                {healthAnalysis.recommendations.map((rec, i) => <li key={i}>{rec}</li>)}
                            </ul>
                        </div>
                    )}
                </div>

                <div className="bg-dispia-card border border-gray-800 p-6 rounded-xl">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <span className="text-purple-500">2.</span> Anti-Bloqueio
                    </h3>
                    <div className="flex items-center gap-4">
                        <div className="flex-1">
                            <label className="text-xs text-gray-500">Delay Mínimo (s)</label>
                            <input type="number" value={minDelay} onChange={e => setMinDelay(Number(e.target.value))} className="w-full bg-black border border-gray-700 rounded p-2 text-white" />
                        </div>
                        <span className="text-gray-500 mt-4">até</span>
                        <div className="flex-1">
                            <label className="text-xs text-gray-500">Delay Máximo (s)</label>
                            <input type="number" value={maxDelay} onChange={e => setMaxDelay(Number(e.target.value))} className="w-full bg-black border border-gray-700 rounded p-2 text-white" />
                        </div>
                    </div>
                    <button 
                        onClick={startCampaign} 
                        disabled={isSending || (contacts.length === 0 && !manualNumber)}
                        className={`w-full mt-6 py-4 rounded-lg font-bold text-lg shadow-xl transition transform hover:scale-[1.02]
                            ${isSending || (contacts.length === 0 && !manualNumber)
                                ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                                : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500'}`}
                    >
                        {isSending ? '🚀 Enviando...' : 
                         manualNumber && contacts.length === 0 ? `ENVIAR TESTE PARA ${manualNumber}` : 
                         `INICIAR DISPARO (${contacts.length})`}
                    </button>
                    <div className="mt-2 text-center">
                         <small className="text-[10px] text-gray-700">API Conectada em: {apiUrl}</small>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <div className="bg-dispia-card border border-gray-800 p-6 rounded-xl h-full flex flex-col">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <span className="text-purple-500">3.</span> Monitoramento
                    </h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-black/50 p-3 rounded border border-gray-800 text-center">
                            <div className="text-2xl font-bold text-green-500">{contacts.length > 0 ? contacts.length : (manualNumber ? 1 : 0)}</div>
                            <div className="text-xs text-gray-500">Na Fila</div>
                        </div>
                        <div className="bg-black/50 p-3 rounded border border-gray-800 text-center">
                            <div className="text-2xl font-bold text-red-500">{invalidContacts.length}</div>
                            <div className="text-xs text-gray-500">Inválidos</div>
                        </div>
                    </div>
                    <div className="flex-1 bg-black border border-gray-800 rounded-lg p-4 overflow-y-auto font-mono text-xs max-h-[500px]">
                        {logs.length === 0 && <span className="text-gray-600 animate-pulse">&gt; Aguardando comando...</span>}
                        {logs.map((log, i) => (
                            <div key={i} className="mb-1 border-b border-gray-900 pb-1 last:border-0">
                                {typeof log === 'string' ? <span className="text-gray-400">{log}</span> : 
                                    <span className={log.status.includes('Enviado') ? 'text-green-400' : 'text-red-400'}>
                                        {`[${log.time}] ${log.phone} : ${log.status}`}
                                    </span>
                                }
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}