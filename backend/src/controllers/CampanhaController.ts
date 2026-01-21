import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import { DDDService } from '../services/DDDService';
import { ImportController } from './ImportController';

const prisma = new PrismaClient();

export class CampanhaController {
  
  async create(req: Request, res: Response) {
    try {
        console.log("=== NOVA CAMPANHA ===");
        let { nome, mensagem, estados, diasSemana, horaInicio, horaFim, limiteDiario, alvosManuais, idsSelecionados, tipoEnvio, dataAgendamento, instanceId } = req.body;
        
        const parse = (v: any) => typeof v === 'string' ? JSON.parse(v) : (v || []);
        try { estados = parse(estados); diasSemana = parse(diasSemana); idsSelecionados = parse(idsSelecionados); } catch(e) { estados=[]; diasSemana=[1,2,3,4,5]; idsSelecionados=[]; }

        const ddds = DDDService.getDDDsFromStates(estados);
        let listaFinal: string[] = [];

        if (alvosManuais) {
            const digitados = String(alvosManuais).split('\n').map(n => n.replace(/\D/g, '')).filter(n => n.length >= 10);
            listaFinal = [...listaFinal, ...digitados];
        }

        if (req.file) {
            const doArquivo = ImportController.parsePhonesFromExcel(req.file.buffer);
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
        const agendamento = (tipoEnvio === 'AGENDADO' && dataAgendamento) ? new Date(dataAgendamento) : null;

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
                limiteDiario: Number(limiteDiario) || 100,
                tipoEnvio: tipoEnvio || 'IMEDIATO',
                dataAgendamento: agendamento,
                totalAlvos: totalEstimado,
                status: 'RODANDO'
            }
        });
        
        return res.json(campanha);

    } catch (error: any) {
        console.error("ERRO CAMPANHA:", error);
        return res.status(500).json({ error: error.message });
    }
  }

  async list(req: Request, res: Response) {
    try {
      const campanhas = await prisma.campanha.findMany({ orderBy: { createdAt: 'desc' }, include: { _count: { select: { logs: true } } } });
      return res.json(campanhas);
    } catch (e) { return res.status(500).json({ error: 'Erro' }); }
  }

  // Relatório Resumido (JSON)
  async report(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const logs = await prisma.mensagemLog.findMany({ where: { campanhaId: String(id) } });
        return res.json({
            enviadas: logs.length,
            entregues: logs.filter(l => l.status === 'ENTREGUE' || l.status === 'LIDO').length,
            lidas: logs.filter(l => l.status === 'LIDO').length,
            respondidas: logs.filter(l => l.respondida).length,
            conversasReais: logs.filter(l => l.conversaLonga).length,
        });
    } catch (e) { return res.status(500).json({ error: 'Erro' }); }
  }

  // Relatório Completo (Download Excel)
  async exportReport(req: Request, res: Response) {
      const { id } = req.params;
      try {
          const logs = await prisma.mensagemLog.findMany({ 
              where: { campanhaId: String(id) },
              orderBy: { dataEnvio: 'desc' }
          });

          const wb = XLSX.utils.book_new();
          const data = logs.map(l => ({
              Destinatario: l.destinatario,
              Status: l.status,
              Respondida: l.respondida ? 'SIM' : 'NÃO',
              Data_Envio: l.dataEnvio ? new Date(l.dataEnvio).toLocaleString('pt-BR') : '-',
              Data_Resposta: l.dataResposta ? new Date(l.dataResposta).toLocaleString('pt-BR') : '-'
          }));

          const ws = XLSX.utils.json_to_sheet(data);
          XLSX.utils.book_append_sheet(wb, ws, "Relatório Detalhado");
          
          const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
          
          res.setHeader('Content-Disposition', `attachment; filename="relatorio_campanha_${id}.xlsx"`);
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          return res.status(200).send(buf);

      } catch (e) { 
          console.error(e);
          return res.status(500).send("Erro ao gerar relatório"); 
      }
  }

  async toggleStatus(req: Request, res: Response) {
      const { id } = req.params;
      try {
        const campanha = await prisma.campanha.findUnique({ where: { id: String(id) }});
        if(!campanha) return res.status(404).json({error: '404'});
        const novoStatus = campanha.status === 'RODANDO' ? 'PAUSADA' : 'RODANDO';
        await prisma.campanha.update({ where: { id: String(id) }, data: { status: novoStatus } });
        return res.json({ status: novoStatus });
      } catch (e) { return res.status(500).json({ error: 'Erro' }); }
  }
}