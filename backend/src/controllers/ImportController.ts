import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import { OpenCnpjService } from '../services/OpenCnpjService';

const prisma = new PrismaClient();

export class ImportController {

  async downloadTemplate(req: Request, res: Response) {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([['CNPJ', 'NOME_FANTASIA (Opcional)', 'OBSERVACAO'],['00000000000191', 'Empresa Exemplo', 'Cliente potencial']]);
      XLSX.utils.book_append_sheet(wb, ws, "Modelo Importação");
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Disposition', 'attachment; filename="modelo_importacao.xlsx"');
      res.status(200).send(buf);
  }

  async downloadCampaignTemplate(req: Request, res: Response) {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([['TELEFONE', 'NOME'], ['11999998888', 'João Silva']]);
      XLSX.utils.book_append_sheet(wb, ws, "Contatos");
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Disposition', 'attachment; filename="modelo_campanha.xlsx"');
      res.status(200).send(buf);
  }

  static parsePhonesFromExcel(buffer: Buffer): string[] {
      const wb = XLSX.read(buffer, { type: 'buffer' });
      const firstSheet = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
      let phones: string[] = [];
      data.forEach(row => {
          row.forEach(cell => { if (cell) { const cleaned = String(cell).replace(/\D/g, ''); if (cleaned.length >= 10 && cleaned.length <= 13) phones.push(cleaned); } });
      });
      return phones;
  }

  async importFile(req: Request, res: Response) { return res.json({ message: "Use o método importSingle." }); }

  async importSingle(req: Request, res: Response) {
      const { cnpj, razaoSocial } = req.body;
      
      console.log(`[IMPORT] Recebido: CNPJ=${cnpj}`); 

      const cleanCNPJ = String(cnpj || '').replace(/\D/g, '');
      
      if (cleanCNPJ.length !== 14) {
          return res.json({ status: 'erro', motivo: 'CNPJ Inválido', dados: { cnpj: cleanCNPJ } });
      }

      try {
          const exists = await prisma.empresa.findUnique({ where: { cnpj: cleanCNPJ } });
          if (exists) {
              return res.json({ 
                  status: 'ignorado', 
                  motivo: 'Já cadastrado',
                  dados: { 
                      razao: exists.razaoSocial, 
                      cidade: exists.endereco ? (exists.endereco as any).cidade : '',
                      uf: exists.endereco ? (exists.endereco as any).estado : '',
                      telefone: exists.telefone
                  }
              });
          }

          // CHAMA O NOVO SERVIÇO (OpenCNPJ)
          const apiData = await OpenCnpjService.consultarCNPJ(cleanCNPJ);
          
          if (!apiData) {
              console.log(`[IMPORT] Fallback: API sem resposta para ${cleanCNPJ}`);
              const nova = await prisma.empresa.create({
                  data: { cnpj: cleanCNPJ, razaoSocial: razaoSocial || `CNPJ ${cleanCNPJ}` }
              });
              return res.json({ 
                  status: 'sucesso', 
                  aviso: 'Dados básicos (API Offline)',
                  dados: { razao: nova.razaoSocial, cidade: '-', uf: '-', telefone: '-', socios: '-' }
              });
          }

          const nova = await prisma.empresa.create({
              data: {
                  cnpj: apiData.cnpj,
                  razaoSocial: apiData.razaoSocial || razaoSocial || "Sem Razão",
                  nomeFantasia: apiData.nomeFantasia,
                  email: apiData.email,
                  telefone: apiData.telefone,
                  cnae: String(apiData.cnae), // Garante string
                  dataAbertura: apiData.dataAbertura,
                  statusRF: apiData.statusRF,
                  endereco: apiData.endereco || {}
              }
          });

          return res.json({ 
              status: 'sucesso', 
              dados: { 
                  razao: nova.razaoSocial,
                  cidade: apiData.cidade,
                  uf: apiData.estado,
                  telefone: apiData.telefone,
                  email: apiData.email,
                  socios: apiData.socios 
              }
          });

      } catch (error: any) {
          console.error(`[IMPORT] Erro Crítico ${cleanCNPJ}:`, error);
          return res.status(500).json({ status: 'erro', motivo: error.message });
      }
  }
}