import { PrismaClient } from '@prisma/client';
import { getSession } from '../wabot';
import { GoogleDriveService } from './GoogleDriveService';

const prisma = new PrismaClient();

// Função de delay para evitar bloqueio e banimento (Humanização)
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export class CampaignDispatcher {
    private static isRunning = false;

    static startLoop() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log("🚀 Motor de Campanhas V13 (Auto-Remove Digito 9) Iniciado...");
        
        // Intervalo entre ciclos de processamento (15 segundos)
        setInterval(() => this.processarCampanhas(), 15000); 
    }

    private static async processarCampanhas() {
        try {
            const campanhas = await prisma.campanha.findMany({ where: { status: 'RODANDO' } });

            // Diagnóstico rápido
            const sessoesGlobais = (global as any).sessions || new Map();
            const idsNaMemoria = Array.from(sessoesGlobais.keys());
            if (campanhas.length > 0) {
                 const conectadas = idsNaMemoria.filter((id: any) => sessoesGlobais.get(id)?.status === 'connected');
                 console.log(`[DEBUG] Campanhas: ${campanhas.length} | Sessões ON: [${conectadas.join(', ')}]`);
            }

            for (const camp of campanhas) {
                // Checagens básicas
                const hoje = new Date(); hoje.setHours(0,0,0,0);
                const enviosHoje = await prisma.mensagemLog.count({ where: { campanhaId: camp.id, dataEnvio: { gte: hoje } } });
                if(enviosHoje >= camp.limiteDiario) continue;

                // Seleção de Sessão
                let session = null;
                let sessionIdUsado = '';

                if (camp.instanceId && sessoesGlobais.has(camp.instanceId)) {
                    const s = sessoesGlobais.get(camp.instanceId);
                    if (s.status === 'connected') { session = s; sessionIdUsado = camp.instanceId; }
                }
                
                if (!session) {
                    for (const [key, val] of sessoesGlobais.entries()) {
                        if (val.status === 'connected') { session = val; sessionIdUsado = key; break; }
                    }
                }

                if (!session) continue;

                await this.executarDisparo(camp, session, sessionIdUsado);
            }
        } catch (e) { console.error("Erro loop:", e); }
    }

    private static async executarDisparo(camp: any, session: any, sessionId: string) {
        let enviou = false;

        // Lógica de Alvos Manuais
        if (camp.alvosManuais) {
            let lista: string[] = [];
            try { lista = JSON.parse(camp.alvosManuais); } catch (e) { lista = []; }
            for (const num of lista) {
                // Remove tudo que não é dígito para busca
                const numLimpo = num.replace(/\D/g, '');
                // Busca pelos últimos 8 dígitos para garantir que ache mesmo se salvou com/sem 9
                const buscaFlexivel = numLimpo.slice(-8);
                
                const jaFoi = await prisma.mensagemLog.findFirst({ where: { campanhaId: camp.id, destinatario: { contains: buscaFlexivel } } });
                if (!jaFoi) {
                    await this.enviarPacote(camp, num, 'Visitante', session, sessionId);
                    enviou = true;
                    break; 
                }
            }
        }

        // Lógica de Banco de Dados
        if (!enviou) {
            try {
                const ddds = JSON.parse(camp.dddsAlvo || '[]');
                if (ddds.length > 0) {
                    const total = await prisma.empresa.count();
                    const skip = Math.floor(Math.random() * (total > 50 ? total - 50 : 0));
                    const batch = await prisma.empresa.findMany({ take: 50, skip, select: { telefone: true, nomeFantasia: true } });

                    for (const empresa of batch) {
                        if (!empresa.telefone) continue;
                        const foneLimpo = empresa.telefone.replace(/\D/g, '');
                        if (foneLimpo.length < 10) continue;
                        
                        // Verifica se já enviou
                        const jaFoi = await prisma.mensagemLog.findFirst({ where: { campanhaId: camp.id, destinatario: { contains: foneLimpo.slice(-8) } } });
                        if (!jaFoi && ddds.includes(foneLimpo.substring(0, 2))) {
                            await this.enviarPacote(camp, foneLimpo, empresa.nomeFantasia || 'Cliente', session, sessionId);
                            enviou = true;
                            break;
                        }
                    }
                }
            } catch (e) { console.error("Erro DB:", e); }
        }
    }

    private static async enviarPacote(camp: any, numero: string, nomeCliente: string, session: any, sessionId: string) {
        try {
            // === HIGIENIZAÇÃO DE NÚMERO (BRASIL) ===
            let final = numero.replace(/\D/g, ''); // Remove traços, parenteses, etc

            // 1. Se o número não tem DDI (tem 10 ou 11 digitos), adiciona 55
            if (!final.startsWith('55') && (final.length === 10 || final.length === 11)) {
                final = '55' + final;
            }

            // 2. CORREÇÃO DO 9º DÍGITO
            // Se for Brasil (55) e tiver 13 dígitos (55 + DDD + 9 + 8 Numeros)
            // Ex: 55 11 9 8888 7777 -> Transformamos para 55 11 8888 7777
            if (final.startsWith('55') && final.length === 13 && final[4] === '9') {
                // Remove o caractere na posição 4 (o nono dígito)
                final = final.slice(0, 4) + final.slice(5);
            }

            // Cria o JID do WhatsApp
            const jid = `${final}@s.whatsapp.net`;

            console.log(`[DISPATCHER] 🚀 Enviando para: ${final} (Original: ${numero})`);

            // 1. TEXTO
            if (camp.mensagem) {
                const msgFormatada = camp.mensagem.replace('{empresa}', nomeCliente);
                await session.socket.sendMessage(jid, { text: msgFormatada });
            }

            // 2. ANEXO (Baixa do Drive -> Envia Buffer)
            if (camp.mediaUrl && camp.mediaUrl.length > 5) {
                await sleep(1000);
                const fileData = await GoogleDriveService.downloadFileToBuffer(camp.mediaUrl);
                
                if (fileData) {
                    await session.socket.sendMessage(jid, { 
                        document: fileData.buffer,
                        mimetype: fileData.mime,
                        fileName: 'Anexo'
                    }).catch(async () => {
                        if (fileData.mime.includes('image')) await session.socket.sendMessage(jid, { image: fileData.buffer });
                    });
                }
            }

            // 3. ÁUDIO (Modo Arquivo)
            if (camp.audioUrl && camp.audioUrl.length > 5) {
                await sleep(2000);
                const audioData = await GoogleDriveService.downloadFileToBuffer(camp.audioUrl);

                if (audioData) {
                    await session.socket.sendMessage(jid, { 
                        audio: audioData.buffer, 
                        mimetype: 'audio/mp4', 
                        ptt: false 
                    }).catch(async () => {
                         await session.socket.sendMessage(jid, { 
                            document: audioData.buffer, mimetype: 'audio/mpeg', fileName: 'Audio.mp3'
                        });
                    });
                }
            }

            // Registrar Log
            await prisma.mensagemLog.create({ data: { campanhaId: camp.id, destinatario: final, status: 'ENVIADO' } });
            await prisma.campanha.update({ where: { id: camp.id }, data: { processados: { increment: 1 }, ultimoEnvio: new Date() } });

        } catch (e) {
            console.error(`[DISPATCHER] ❌ Falha envio ${numero}:`, e);
        }
    }
}