import React, { useState, useEffect } from 'react';
import QRCode from "react-qr-code";

const API_URL = '/api/interno';

export default function StatusConexao({ sessionId, onConnect }) {
    const [status, setStatus] = useState('checking'); // checking, disconnected, qrcode, connected
    const [qrCode, setQrCode] = useState('');
    const [loading, setLoading] = useState(false);

    // Monitoramento em tempo real
    useEffect(() => {
        let interval;
        const checkStatus = async () => {
            try {
                const res = await fetch(`${API_URL}/session/status?sessionId=${sessionId}`);
                const data = await res.json();

                if (data.status === 'connected') {
                    setStatus('connected');
                    onConnect(true); // Avisa o pai que conectou
                } else if (data.qrCode) {
                    setStatus('qrcode');
                    setQrCode(data.qrCode);
                } else if (data.status === 'reconnecting') {
                    setStatus('reconnecting');
                } else {
                    // Se não tiver status nem QR, assume desconectado/inicial
                    if(status !== 'qrcode') setStatus('disconnected');
                }
            } catch (error) {
                console.error("Erro ao verificar status:", error);
            }
        };

        // Verifica imediatamente e depois a cada 3s
        checkStatus();
        interval = setInterval(checkStatus, 3000);

        return () => clearInterval(interval);
    }, [sessionId, status]);

    const handleStartSession = async () => {
        setLoading(true);
        try {
            await fetch(`${API_URL}/session/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: sessionId })
            });
            // O useEffect vai pegar o QR Code automaticamente no próximo ciclo
        } catch (error) {
            alert("Erro ao iniciar sessão: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        if (!confirm("Tem certeza que deseja desconectar?")) return;
        await fetch(`${API_URL}/session/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: sessionId })
        });
        setStatus('disconnected');
        setQrCode('');
        onConnect(false);
        window.location.reload();
    };

    // Renderizações baseadas no estado
    if (status === 'connected') {
        return (
            <div className="bg-green-900/20 border border-green-800 p-4 rounded-xl flex justify-between items-center mb-6 animate-fade-in">
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-green-400 font-bold">WhatsApp Conectado</span>
                    <span className="text-xs text-gray-500 hidden md:inline">({sessionId})</span>
                </div>
                <button 
                    onClick={handleLogout}
                    className="text-xs border border-red-900 text-red-500 hover:bg-red-900/50 px-3 py-1 rounded transition"
                >
                    Desconectar
                </button>
            </div>
        );
    }

    if (status === 'qrcode') {
        return (
            <div className="bg-dispia-card border border-gray-800 p-8 rounded-xl text-center mb-6 flex flex-col items-center animate-fade-in">
                <h3 className="text-xl font-bold text-white mb-2">Escaneie o QR Code</h3>
                <p className="text-gray-400 text-sm mb-6">Abra o WhatsApp no seu celular &gt; Configurações &gt; Aparelhos conectados</p>
                
                <div className="bg-white p-4 rounded-lg shadow-lg">
                    <QRCode value={qrCode} size={200} />
                </div>
                
                <div className="mt-6 flex items-center gap-2 text-yellow-500 text-xs">
                    <span className="animate-spin">⌛</span> Aguardando leitura...
                </div>
            </div>
        );
    }

    // Estado inicial / Desconectado
    return (
        <div className="bg-dispia-card border border-gray-800 p-8 rounded-xl text-center mb-6 animate-fade-in">
            <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fa-brands fa-whatsapp text-3xl text-gray-400"></i>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Sessão Offline</h3>
            <p className="text-gray-500 text-sm mb-6">Conecte seu WhatsApp para começar a enviar campanhas.</p>
            
            <button 
                onClick={handleStartSession} 
                disabled={loading}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-full transition shadow-lg shadow-purple-900/20 disabled:opacity-50"
            >
                {loading ? 'Iniciando...' : 'Iniciar Conexão'}
            </button>
        </div>
    );
}