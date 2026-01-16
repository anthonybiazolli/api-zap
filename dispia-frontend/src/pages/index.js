import React, { useState } from 'react';
import Disparador from '../components/Disparador';
import Link from 'next/link';

export default function Home() {
    // Simulação simples de login para o MVP
    const [sessionName, setSessionName] = useState('');
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    if (isLoggedIn) {
        return (
            <div className="min-h-screen bg-gray-100">
                <nav className="bg-purple-800 p-4 text-white flex justify-between items-center shadow">
                    <span className="font-bold text-lg">DispIA SaaS</span>
                    <div className="space-x-4">
                        <span className="bg-purple-700 px-3 py-1 rounded text-sm">Sessão: {sessionName}</span>
                        <Link href="/admin/dashboard" className="hover:underline text-sm">Painel Admin</Link>
                        <Link href="/api-docs" className="hover:underline text-sm">API Docs</Link>
                        <button onClick={() => setIsLoggedIn(false)} className="text-red-300 hover:text-white ml-4 text-sm">Sair</button>
                    </div>
                </nav>
                <div className="container mx-auto mt-8">
                    <Disparador userId={sessionName} userToken="demo-token-123" />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="bg-white p-8 rounded shadow-md w-96">
                <h1 className="text-2xl font-bold text-center mb-6 text-purple-800">DispIA Login</h1>
                <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2">Nome da Sessão (WhatsApp)</label>
                    <input 
                        type="text" 
                        value={sessionName}
                        onChange={(e) => setSessionName(e.target.value)}
                        placeholder="Ex: suporte_01"
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    />
                </div>
                <button 
                    onClick={() => { if(sessionName) setIsLoggedIn(true) }}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                >
                    Entrar / Conectar
                </button>
            </div>
        </div>
    );
}