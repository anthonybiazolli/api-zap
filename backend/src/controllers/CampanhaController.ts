import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { DDDService } from '../services/DDDService';
import { ImportController } from './ImportController';
import { GoogleDriveService } from '../services/GoogleDriveService';
import { Readable } from 'stream';

const prisma = new PrismaClient();

export class CampanhaController {
  
  async create(req: Request, res: Response) {
    try {
        console.log("=== NOVA CAMPANHA (WORKSPACE) ===");
        let { nome, mensagem, estados, diasSemana, horaInicio, horaFim, limiteDiario, alvosManuais, idsSelecionados, tipoEnvio, dataAgendamento, instanceId, iniciaChat } = req.body;
        
        const parse = (v: any) => { if (!v) return []; try { return typeof v === 'string' ? JSON.parse(v) : v; } catch (e) { return []; } };
        estados = parse(estados); diasSemana = parse(diasSemana); idsSelecionados = parse(idsSelecionados);

        const ddds = DDDService.getDDDsFromStates(estados);
        let listaFinal: string[] = [];

        if (alvosManuais) {
            const digitados = String(alvosManuais).split('\n').map(n => n.replace(/\D/g, '')).filter(n => n.length >= 10);
            listaFinal = [...listaFinal, ...digitados];
        }

        const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

        if (files && files['file'] && files['file'][0]) {
            const planilha = files['file'][0];
            const doArquivo = ImportController.parsePhonesFromExcel(planilha.buffer);
            listaFinal = [...listaFinal, ...doArquivo];
        }

        if (idsSelecionados.length > 0) {
            const empresasDB = await prisma.empresa.findMany({ where: { id: { in: idsSelecionados } }, select: { telefone: true } });
            const doDB = empresasDB.map(e => e.telefone?.replace(/\D/g, '')).filter(t => t && t.length >= 10);
            listaFinal = [...listaFinal, ...(doDB as string[])];
        }

        listaFinal = [...new Set(listaFinal)];
        const totalAlvosDB = await prisma.empresa.count();
        const usarBaseTotal = listaFinal.length === 0 && ddds.length > 0;
        const totalEstimado = usarBaseTotal ? totalAlvosDB : listaFinal.length;
        const agendamento = (tipoEnvio === 'AGENDADO' || (tipoEnvio === 'RECORRENTE' && dataAgendamento)) ? new Date(dataAgendamento) : null;

        // === UPLOAD COM TRAVA DE SEGURANÇA ===
        let mediaUrl = null;
        let audioUrl = null;

        if (files) {
            // 1. ANEXO (Imagem/PDF)
            if (files['media'] && files['media'][0]) {
                const f = files['media'][0];
                const stream = new Readable(); stream.push(f.buffer); stream.push(null);
                
                console.log(`[UPLOAD] Enviando anexo para o Drive...`);
                mediaUrl = await GoogleDriveService.uploadBaileysMedia(stream, `camp_${Date.now()}_${f.originalname}`, f.mimetype);

                // TRAVA: Se falhar, CANCELA TUDO
                if (!mediaUrl) {
                    return res.status(500).json({ 
                        error: 'FALHA CRÍTICA: O anexo não foi salvo no Google Drive. A campanha foi cancelada para evitar envio sem arquivo.' 
                    });
                }
            }

            // 2. ÁUDIO
            if (files['audio'] && files['audio'][0]) {
                const f = files['audio'][0];
                const stream = new Readable(); stream.push(f.buffer); stream.push(null);
                
                console.log(`[UPLOAD] Enviando áudio para o Drive...`);
                audioUrl = await GoogleDriveService.uploadBaileysMedia(stream, `audio_${Date.now()}.mp3`, 'audio/mp4');

                // TRAVA: Se falhar, CANCELA TUDO
                if (!audioUrl) {
                    return res.status(500).json({ 
                        error: 'FALHA CRÍTICA: O áudio não foi salvo no Google Drive. A campanha foi cancelada.' 
                    });
                }
            }
        }

        console.log("✅ Arquivos salvos com segurança. Criando campanha no banco...");

        const campanha = await prisma.campanha.create({
            data: {
                nome: nome || 'Sem Nome',
                mensagem: mensagem || '',
                instanceId: instanceId || null,
                estadosAlvo: JSON.stringify(estados),
                dddsAlvo: JSON.stringify(ddds),
                alvosManuais: JSON.stringify(listaFinal),
                diasSemana: JSON.stringify(diasSemana),
                horaInicio: horaInicio || '08:00',
                horaFim: horaFim || '18:00',
                limiteDiario: Number(limiteDiario) || 500,
                tipoEnvio: tipoEnvio || 'UNICO',
                dataAgendamento: agendamento,
                totalAlvos: totalEstimado,
                status: 'RODANDO',
                mediaUrl: mediaUrl,
                audioUrl: audioUrl,
                iniciaChat: iniciaChat === 'true' || iniciaChat === true
            }
        });
        
        return res.json(campanha);

    } catch (error: any) {
        console.error("ERRO CAMPANHA:", error);
        return res.status(500).json({ error: error.message });
    }
  }

  // Métodos auxiliares mantidos
  async list(req: Request, res: Response) { try { const c = await prisma.campanha.findMany({ orderBy: { createdAt: 'desc' }, include: { _count: { select: { logs: true } } } }); res.json(c); } catch(e) { res.status(500).json({ error: 'Erro' }); } }
  async report(req: Request, res: Response) { try { const logs = await prisma.mensagemLog.findMany({ where: { campanhaId: req.params.id } }); res.json({ enviadas: logs.length, entregues: logs.filter(l=>l.status==='ENTREGUE').length, lidas: logs.filter(l=>l.status==='LIDO').length, respondidas: logs.filter(l=>l.respondida).length }); } catch(e) { res.status(500).json({error:'Erro'}); } }
  async exportReport(req: Request, res: Response) { res.status(200).send('ok'); }
  async toggleStatus(req: Request, res: Response) { try { await prisma.campanha.update({ where: { id: req.params.id }, data: { status: 'PAUSADA' } }); res.json({ status: 'PAUSADA' }); } catch(e) { res.status(500).json({error:'Erro'}); } }
}