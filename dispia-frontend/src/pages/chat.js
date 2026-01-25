import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';

const API_URL = '/api/interno';

export default function Chat() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [contacts, setContacts] = useState([]);
    const [activeJid, setActiveJid] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [sessionId, setSessionId] = useState(null); // ID da instância para enviar
    
    const messagesEndRef = useRef(null);

    // 1. Inicialização e Busca da Instância Ativa
    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (!storedUser) { router.push('/login'); return; }
        const u = JSON.parse(storedUser);
        setUser(u);

        // Busca a primeira instância ativa do usuário para usar no envio
        fetch(`${API_URL}/instances/user/${u.id}`)
            .then(r => r.json())
            .then(insts => {
                const connected = insts.find(i => i.statusReal === 'connected');
                // Se tiver conectada usa ela, senão usa a primeira (fallback)
                if (insts.length > 0) setSessionId(connected ? connected.id : insts[0].id);
            })
            .catch(err => console.error("Erro buscando instância:", err));
    }, []);

    // 2. Polling de Contatos (A cada 5s)
    useEffect(() => {
        const fetchContacts = async () => {
            try {
                const res = await fetch(`${API_URL}/chat/contacts`);
                if (res.ok) setContacts(await res.json());
            } catch (e) { console.error("Erro contatos", e); }
        };
        fetchContacts();
        const interval = setInterval(fetchContacts, 5000);
        return () => clearInterval(interval);
    }, []);

    // 3. Polling de Mensagens (A cada 2s quando um chat está aberto)
    useEffect(() => {
        if (!activeJid) return;
        const fetchMessages = async () => {
            try {
                const res = await fetch(`${API_URL}/chat/messages/${activeJid}`);
                if (res.ok) {
                    const data = await res.json();
                    setMessages(data);
                }
            } catch (e) { console.error("Erro msgs", e); }
        };
        
        fetchMessages();
        const interval = setInterval(fetchMessages, 2000);
        return () => clearInterval(interval);
    }, [activeJid]);

    // 4. Scroll automático para última mensagem
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !activeJid || !sessionId) return;

        const textToSend = newMessage;
        setNewMessage(''); // Limpa input imediatamente (UX otimista)

        try {
            await fetch(`${API_URL}/message/text`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: sessionId, 
                    number: activeJid.split('@')[0], // Remove @s.whatsapp.net para envio
                    message: textToSend
                })
            });
            // A mensagem aparecerá na tela no próximo polling (2s)
        } catch (e) {
            alert("Erro ao enviar. Verifique sua conexão.");
        }
    };

    const handleLogout = () => { localStorage.clear(); router.push('/login'); };

    return (
        <div className="flex h-screen bg-[#0f172a] text-gray-100 font-sans overflow-hidden">
            <Head><title>Chat Ao Vivo - DispIA</title></Head>

            {/* Sidebar Lateral */}
            <div className="w-1/3 md:w-1/4 border-r border-gray-800 flex flex-col bg-[#1e293b]">
                {/* Header Sidebar */}
                <div className="p-4 border-b border-gray-800 bg-[#1e293b] flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Link href="/" className="text-xl cursor-pointer no-underline">🤖</Link>
                        <h2 className="text-lg font-bold text-white">Conversas</h2>
                    </div>
                    <Link href="/" className="text-xs text-gray-400 hover:text-white">Voltar</Link>
                </div>
                
                {/* Lista de Contatos */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {contacts.length === 0 && (
                        <div className="p-6 text-center text-gray-500 text-sm">
                            <p>Nenhuma conversa iniciada.</p>
                            <p className="mt-2 text-xs">Envie uma campanha para começar.</p>
                        </div>
                    )}
                    {contacts.map(c => (
                        <div 
                            key={c.jid} 
                            onClick={() => setActiveJid(c.jid)}
                            className={`p-4 border-b border-gray-800 cursor-pointer hover:bg-gray-700 transition relative ${activeJid === c.jid ? 'bg-blue-900/20 border-l-4 border-l-blue-500' : 'border-l-4 border-l-transparent'}`}
                        >
                            <div className="flex justify-between mb-1">
                                <span className="font-bold text-sm text-white truncate max-w-[70%]">{c.name}</span>
                                <span className="text-[10px] text-gray-500">{new Date(c.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                            <p className="text-xs text-gray-400 truncate pr-2">
                                {c.source === 'campanha' && <span className="text-[9px] bg-purple-900/50 text-purple-300 px-1 rounded mr-1">BOT</span>}
                                {c.lastMessage}
                            </p>
                        </div>
                    ))}
                </div>
                
                {/* Footer Sidebar (Status da Sessão) */}
                <div className="p-3 bg-[#0f172a] border-t border-gray-800 text-xs text-gray-500 text-center">
                    {sessionId ? <span className="text-green-500">● Conectado (ID: {sessionId.slice(0,6)}...)</span> : <span className="text-red-500">● Offline</span>}
                </div>
            </div>

            {/* Área Principal do Chat */}
            <div className="flex-1 flex flex-col bg-[#0b101a] relative bg-chat-pattern">
                {activeJid ? (
                    <>
                        {/* Header Chat */}
                        <div className="p-4 border-b border-gray-800 bg-[#1e293b] flex justify-between items-center shadow-md z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-tr from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                                    {activeJid[0]}
                                </div>
                                <div>
                                    <h3 className="font-bold text-white">{activeJid.split('@')[0]}</h3>
                                    <p className="text-[10px] text-green-400">Online via DispIA</p>
                                </div>
                            </div>
                            <button onClick={() => setActiveJid(null)} className="md:hidden text-gray-400">✕</button>
                        </div>

                        {/* Janela de Mensagens */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {messages.map((msg) => (
                                <div key={msg.id} className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[70%] rounded-2xl p-3 text-sm shadow-md relative group ${msg.fromMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-[#1e293b] text-gray-200 rounded-tl-none border border-gray-700'}`}>
                                        
                                        {/* Link de Mídia (Drive) */}
                                        {msg.mediaUrl && (
                                            <div className="mb-2 pb-2 border-b border-white/10">
                                                <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-black/20 p-2 rounded hover:bg-black/30 transition">
                                                    <span className="text-xl">📄</span> 
                                                    <div>
                                                        <p className="font-bold text-xs underline">Arquivo Anexado</p>
                                                        <p className="text-[9px] opacity-70">Google Drive</p>
                                                    </div>
                                                </a>
                                            </div>
                                        )}

                                        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                        <span className={`text-[9px] block text-right mt-1 ${msg.fromMe ? 'text-blue-200' : 'text-gray-500'}`}>
                                            {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input de Envio */}
                        <div className="p-4 bg-[#1e293b] border-t border-gray-800">
                            <form onSubmit={handleSend} className="flex gap-3 max-w-4xl mx-auto">
                                <input 
                                    className="flex-1 bg-[#0f172a] border border-gray-600 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition placeholder-gray-600"
                                    placeholder="Digite sua mensagem..."
                                    value={newMessage}
                                    onChange={e => setNewMessage(e.target.value)}
                                />
                                <button 
                                    type="submit" 
                                    disabled={!newMessage.trim()}
                                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl px-6 py-2 shadow-lg transition font-bold"
                                >
                                    Enviar
                                </button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500 opacity-40">
                        <div className="text-8xl mb-6">💬</div>
                        <p className="text-lg">Selecione uma conversa para começar</p>
                        <p className="text-sm mt-2">O histórico é mantido enquanto a sessão estiver ativa.</p>
                    </div>
                )}
            </div>
        </div>
    );
}