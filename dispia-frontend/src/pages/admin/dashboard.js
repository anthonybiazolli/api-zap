import React, { useEffect, useState } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import Link from 'next/link';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function AdminDashboard() {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);

    const chartData = {
        labels: sessions.map(s => s.sessionId),
        datasets: [{
            label: 'Status (1=On, 0=Off)',
            data: sessions.map(s => s.status === 'connected' ? 1 : 0.2),
            backgroundColor: sessions.map(s => s.status === 'connected' ? '#4ade80' : '#ef4444'),
            borderRadius: 4
        }],
    };

    const chartOptions = {
        responsive: true,
        plugins: { legend: { display: false }, tooltip: { enabled: true } },
        scales: {
            y: { ticks: { color: '#666' }, grid: { color: '#222' } },
            x: { ticks: { color: '#888' }, grid: { display: false } }
        }
    };

    const fetchSessions = async () => {
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
            const res = await fetch(`${apiUrl}/admin/sessions`);
            const data = await res.json();
            if (data.sessions) setSessions(data.sessions);
        } catch (error) { console.error(error); } finally { setLoading(false); }
    };

    useEffect(() => {
        fetchSessions();
        const interval = setInterval(fetchSessions, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="min-h-screen bg-black text-white p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-10">
                    <h1 className="text-3xl font-bold">Admin<span className="text-purple-500">Dashboard</span></h1>
                    <Link href="/" className="text-sm text-gray-400 hover:text-white transition">&larr; Voltar ao App</Link>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                    <div className="bg-dispia-card border border-gray-800 p-6 rounded-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition text-6xl">🤖</div>
                        <h3 className="text-gray-500 text-xs uppercase tracking-wider font-bold">Total Sessões</h3>
                        <p className="text-4xl font-bold mt-2 text-white">{sessions.length}</p>
                    </div>
                    <div className="bg-dispia-card border border-gray-800 p-6 rounded-xl border-l-4 border-l-green-500">
                        <h3 className="text-gray-500 text-xs uppercase tracking-wider font-bold">Online Agora</h3>
                        <p className="text-4xl font-bold mt-2 text-green-400">
                            {sessions.filter(s => s.status === 'connected').length}
                        </p>
                    </div>
                    <div className="bg-dispia-card border border-gray-800 p-6 rounded-xl border-l-4 border-l-red-500">
                        <h3 className="text-gray-500 text-xs uppercase tracking-wider font-bold">Offline / Erro</h3>
                        <p className="text-4xl font-bold mt-2 text-red-400">
                            {sessions.filter(s => s.status !== 'connected').length}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Lista */}
                    <div className="lg:col-span-2 bg-dispia-card border border-gray-800 rounded-xl overflow-hidden">
                        <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                            <h3 className="font-bold text-lg">Gerenciamento de Instâncias</h3>
                            <button onClick={fetchSessions} className="text-purple-400 hover:text-purple-300 text-xs">Atualizar</button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-500 uppercase bg-black/50">
                                    <tr>
                                        <th className="px-6 py-4">ID Sessão</th>
                                        <th className="px-6 py-4">Telefone</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Webhook</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                    {sessions.map((s, i) => (
                                        <tr key={i} className="hover:bg-white/5 transition">
                                            <td className="px-6 py-4 font-mono text-purple-300">{s.sessionId}</td>
                                            <td className="px-6 py-4">{s.phoneNumber || '-'}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide
                                                    ${s.status === 'connected' ? 'bg-green-900/30 text-green-400 border border-green-900' : 'bg-red-900/30 text-red-400 border border-red-900'}`}>
                                                    {s.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-500 truncate max-w-[150px]">{s.webhookUrl || 'N/A'}</td>
                                        </tr>
                                    ))}
                                    {sessions.length === 0 && (
                                        <tr><td colSpan="4" className="px-6 py-8 text-center text-gray-600">Nenhuma sessão encontrada.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Gráfico */}
                    <div className="bg-dispia-card border border-gray-800 rounded-xl p-6 flex flex-col justify-center">
                         <h3 className="font-bold text-gray-400 mb-6 text-xs uppercase text-center">Visão Geral de Conectividade</h3>
                         <div className="h-64">
                            {sessions.length > 0 ? <Bar data={chartData} options={chartOptions} /> : <div className="h-full flex items-center justify-center text-gray-700">Sem dados</div>}
                         </div>
                    </div>
                </div>
            </div>
        </div>
    );
}