import { PrismaClient } from '@prisma/client';
import { getSession } from '../wabot';

const prisma = new PrismaClient();

export class CampaignDispatcher {
    private static isRunning = false;

    static startLoop() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log("🚀 Motor de Campanhas V4 (Com Agendamento) Iniciado...");
        // Intervalo de 40s
        setInterval(() => this.processarCampanhas(), 40000); 
    }

    private static async processarCampanhas() {
        const now = new Date();
        const diaSemana = now.getDay();
        const horaAtual = now.getHours() * 60 + now.getMinutes();

        // Busca apenas campanhas ativas
        const campanhas = await prisma.campanha.findMany({ where: { status: 'RODANDO' } });

        for (const camp of campanhas) {
            
            // === 1. VERIFICAÇÃO DE AGENDAMENTO ===
            if (camp.tipoEnvio === 'AGENDADO' && camp.dataAgendamento) {
                // Se a data atual for MENOR que a data agendada, ainda não é hora
                if (now < camp.dataAgendamento) {
                    continue; 
                }
                // Se chegou a hora (now >= dataAgendamento), o fluxo segue para o envio
            
            } else {
                // === 2. VERIFICAÇÃO DE RECORRÊNCIA (IMEDIATO) ===
                // Verifica Dias da Semana
                const diasOk = JSON.parse(camp.diasSemana);
                if (!diasOk.includes(diaSemana)) continue;

                // Verifica Horário Comercial
                const [hI, mI] = camp.horaInicio.split(':').map(Number);
                const [hF, mF] = camp.horaFim.split(':').map(Number);
                const inicio = hI * 60 + mI;
                const fim = hF * 60 + mF;
                
                if (horaAtual < inicio || horaAtual > fim) continue;
            }

            // === 3. VALIDAÇÃO DE LIMITE DIÁRIO ===
            const hoje = new Date(); hoje.setHours(0,0,0,0);
            const enviosHoje = await prisma.mensagemLog.count({
                where: { campanhaId: camp.id, dataEnvio: { gte: hoje } }
            });
            
            if (enviosHoje >= camp.limiteDiario) continue;

            // === 4. EXECUÇÃO DO DISPARO ===
            await this.executarDisparo(camp);
        }
    }

    private static async executarDisparo(camp: any) {
        let enviou = false;

        // A) Alvos Específicos (Manual ou Excel)
        if (camp.alvosManuais) {
            const lista = JSON.parse(camp.alvosManuais) as string[];
            for (const num of lista) {
                // Normaliza para verificar no banco (evita erro de duplicidade com 55)
                const numBusca = num.length > 8 ? num.slice(-8) : num;
                
                const jaFoi = await prisma.mensagemLog.findFirst({
                    where: { campanhaId: camp.id, destinatario: { contains: numBusca } }
                });

                if (!jaFoi) {
                    await this.enviar(camp, num, 'Visitante');
                    enviou = true;
                    break; // Envia apenas 1 por ciclo do loop principal
                }
            }
        }

        // B) Base de Dados (Se não enviou manual neste ciclo)
        if (!enviou) {
            const ddds = JSON.parse(camp.dddsAlvo) as string[];
            
            if (ddds.length > 0) {
                // Pega aleatório para não travar sempre nos primeiros registros
                const total = await prisma.empresa.count();
                const skip = Math.floor(Math.random() * (total > 50 ? total - 50 : 0));
                
                const candidatos = await prisma.empresa.findMany({ take: 50, skip });
                
                for (const alvo of candidatos) {
                    if(!alvo.telefone) continue;
                    const fone = alvo.telefone.replace(/\D/g, '');
                    if(fone.length < 10) continue;

                    // Verifica se o DDD bate
                    if(ddds.includes(fone.substring(0, 2))) {
                        const jaFoi = await prisma.mensagemLog.findFirst({
                            where: { campanhaId: camp.id, destinatario: { contains: fone.slice(-8) } }
                        });
                        
                        if (!jaFoi) {
                            await this.enviar(camp, fone, alvo.razaoSocial);
                            break;
                        }
                    }
                }
            }
        }
    }

    private static async enviar(camp: any, numero: string, nome: string) {
        // Tenta pegar a instância específica da campanha (SaaS), senão pega qualquer uma disponível (Fallback)
        let session = null;
        
        if (camp.instanceId) {
            session = getSession(camp.instanceId);
        } else {
            // === CORREÇÃO AQUI ===
            // Usamos (global as any) para evitar o erro TS7017
            const allSessions = (global as any).sessions || {};
            const firstId = Object.keys(allSessions)[0];
            if (firstId) session = getSession(firstId);
        }
        
        if (session && session.status === 'connected') {
            try {
                // CORREÇÃO DO 55 (Formato Internacional)
                let final = numero.replace(/\D/g, '');
                // Se tem 10 ou 11 digitos (ex: 1199998888), adiciona 55. Se tem 12 ou 13, assume que já tem DDI.
                if (final.length >= 10 && final.length <= 11) final = '55' + final;

                const jid = `${final}@s.whatsapp.net`;
                const msg = camp.mensagem.replace('{empresa}', nome);

                await session.socket.sendMessage(jid, { text: msg });

                // Registra o envio
                await prisma.mensagemLog.create({
                    data: { campanhaId: camp.id, destinatario: final, status: 'ENVIADO' }
                });
                
                // Atualiza contadores da campanha
                await prisma.campanha.update({
                    where: { id: camp.id },
                    data: { processados: { increment: 1 }, ultimoEnvio: new Date() }
                });

                console.log(`[DISPATCHER] ✅ ${camp.nome} > ${final}`);
            } catch (e) { 
                console.error(`[DISPATCHER] Erro envio ${numero}:`, e); 
            }
        }
    }
}