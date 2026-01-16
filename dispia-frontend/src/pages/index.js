import React, { useState, useEffect } from 'react';
import Disparador from '../components/Disparador';
import StatusConexao from '../components/StatusConexao';
import Link from 'next/link';

export default function Home() {
    const [sessionName, setSessionName] = useState('');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isConnected, setIsConnected] = useState(false); // Novo estado
    const [loading, setLoading] = useState(false);

    // Recupera sessão salva
    useEffect(() => {
        const saved = localStorage.getItem('dispia_session');
        if (saved) {
            setSessionName(saved);
        }
    }, []);

    const handleLogin = () => {
        if (!sessionName) return alert('Digite um nome para sua sessão');
        setLoading(true);
        setTimeout(() => {
            localStorage.setItem('dispia_session', sessionName);
            setIsLoggedIn(true);
            setLoading(false);
        }, 800);
    };

    const handleLogout = () => {
        localStorage.removeItem('dispia_session');
        setIsLoggedIn(false);
        setSessionName('');
        setIsConnected(false);
    };

    if (isLoggedIn) {
        return (
            <div className="min-h-screen bg-black text-white selection:bg-purple-500 selection:text-white">
                {/* Navbar */}
                <nav className="border-b border-gray-800 bg-dispia-card/50 backdrop-blur-md p-4 sticky top-0 z-50">
                    <div className="container mx-auto flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <span className="text-xl font-bold tracking-tighter text-white">
                                Disp<span className="text-purple-500">IA</span>
                            </span>
                            <span className="text-[10px] bg-purple-900/30 border border-purple-500/30 px-2 py-0.5 rounded text-purple-200">BETA</span>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm font-medium">
                            <Link href="/admin/dashboard" className="hidden md:block text-gray-400 hover:text-white transition">Admin</Link>
                            <div className="h-4 w-[1px] bg-gray-800 hidden md:block"></div>
                            <span className="text-gray-400 hidden md:inline">Sessão: <span className="text-white">{sessionName}</span></span>
                            <button onClick={handleLogout} className="text-red-400 hover:text-red-300 text-xs uppercase font-bold tracking-wider">Sair</button>
                        </div>
                    </div>
                </nav>

                <main className="container mx-auto p-4 md:p-8 max-w-6xl">
                    
                    {/* Título da Página */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-white mb-2">Painel de Controle</h1>
                        <p className="text-gray-500">Gerencie sua conexão e dispare suas campanhas.</p>
                    </div>

                    {/* Componente de Conexão (Sempre visível para monitorar status) */}
                    <StatusConexao 
                        sessionId={sessionName} 
                        onConnect={(connected) => setIsConnected(connected)} 
                    />

                    {/* Disparador (Só aparece se conectado) */}
                    {isConnected ? (
                        <div className="animate-slide-up">
                            <Disparador userId={sessionName} />
                        </div>
                    ) : (
                        /* Efeito de Bloqueio Visual quando desconectado */
                        <div className="opacity-30 pointer-events-none blur-sm select-none" aria-hidden="true">
                             <Disparador userId={sessionName} />
                        </div>
                    )}
                </main>
            </div>
        );
    }

    // Tela de Login (Landing)
    return (
        <div className="min-h-screen flex items-center justify-center bg-black relative overflow-hidden">
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-900/20 rounded-full blur-[120px]"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px]"></div>

            <div className="bg-dispia-card p-8 md:p-10 rounded-2xl shadow-2xl border border-gray-800 w-full max-w-md relative z-10 mx-4">
                <div className="text-center mb-10">
                    <h1 className="text-5xl font-bold text-white mb-3 tracking-tight">Disp<span className="text-purple-500">IA</span></h1>
                    <p className="text-gray-500 text-sm">Plataforma de Automação WhatsApp</p>
                </div>

                <div className="space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2 tracking-wider">Identificação</label>
                        <input 
                            type="text" 
                            value={sessionName}
                            onChange={(e) => setSessionName(e.target.value.replace(/\s/g, '_'))}
                            placeholder="Nome da sua sessão (ex: marketing)"
                            className="w-full bg-black border border-gray-700 rounded-lg p-4 text-white placeholder-gray-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition"
                        />
                    </div>
                    
                    <button 
                        onClick={handleLogin}
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600 text-white font-bold py-4 rounded-lg transition shadow-xl shadow-purple-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-3"
                    >
                        {loading ? 'Acessando...' : 'Entrar na Plataforma'}
                        {!loading && <span>&rarr;</span>}
                    </button>
                </div>
                
                <div className="mt-8 pt-6 border-t border-gray-800/50 text-center">
                    <p className="text-[10px] text-gray-600 uppercase tracking-widest">
                        The Biazolli Company &copy; 2026
                    </p>
                </div>
            </div>
        </div>
    );
}