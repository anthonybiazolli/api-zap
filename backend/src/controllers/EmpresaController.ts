import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { OpenCnpjService } from '../services/OpenCnpjService';

const prisma = new PrismaClient();
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export class EmpresaController {
  
  async listar(req: Request, res: Response) {
    try {
      const empresas = await prisma.empresa.findMany({
        orderBy: { createdAt: 'desc' }
      });
      return res.json(empresas);
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao buscar empresas' });
    }
  }

  async consultarDadosExternos(req: Request, res: Response) {
    const { cnpj } = req.params;
    const dados = await OpenCnpjService.consultarCNPJ(String(cnpj));
    if (!dados) return res.status(404).json({ error: 'CNPJ não encontrado' });
    return res.json(dados);
  }

  async upsert(req: Request, res: Response) {
    const { id, cnpj, razaoSocial, nomeFantasia, endereco, dataAbertura, ...rest } = req.body;
    const dataAberturaLimpa = (dataAbertura && dataAbertura !== "") ? new Date(dataAbertura) : null;

    try {
      const empresa = await prisma.empresa.upsert({
        where: { cnpj },
        update: {
          razaoSocial, nomeFantasia, endereco, dataAbertura: dataAberturaLimpa, ...rest,
          dataAtualizacaoAPI: new Date()
        },
        create: {
          cnpj, razaoSocial, nomeFantasia, endereco, dataAbertura: dataAberturaLimpa, ...rest,
          dataAtualizacaoAPI: new Date()
        }
      });
      return res.json({ status: 'sucesso', empresa });
    } catch (error: any) {
      return res.status(500).json({ error: 'Erro ao salvar empresa', details: error.message });
    }
  }

  async delete(req: Request, res: Response) {
    const { id } = req.params;
    try {
        await prisma.empresa.delete({ where: { id: String(id) } });
        return res.json({ status: 'sucesso', message: 'Empresa removida' });
    } catch (error) { return res.status(500).json({ error: 'Erro ao excluir empresa' }); }
  }

  async deleteBatch(req: Request, res: Response) {
      const { ids, deleteAll } = req.body;
      try {
          if (deleteAll) {
              await prisma.empresa.deleteMany({});
              return res.json({ message: 'Base limpa.' });
          } 
          if (ids && ids.length > 0) {
              await prisma.empresa.deleteMany({ where: { id: { in: ids } } });
              return res.json({ message: `${ids.length} removidos.` });
          }
          return res.status(400).json({ error: 'Nenhum ID.' });
      } catch (error) { return res.status(500).json({ error: 'Erro batch delete.' }); }
  }

  async updateSingle(req: Request, res: Response) {
      const { id } = req.body;
      try {
          const empresa = await prisma.empresa.findUnique({ where: { id } });
          if (!empresa || !empresa.cnpj) return res.status(404).json({ status: 'erro', motivo: 'Empresa não encontrada' });

          const apiData = await OpenCnpjService.consultarCNPJ(empresa.cnpj);
          if (!apiData) return res.json({ status: 'ignorado', motivo: 'Dados não encontrados na API' });

          await prisma.empresa.update({
              where: { id },
              data: {
                  razaoSocial: apiData.razaoSocial || empresa.razaoSocial,
                  nomeFantasia: apiData.nomeFantasia || empresa.nomeFantasia,
                  telefone: apiData.telefone || empresa.telefone,
                  email: apiData.email || empresa.email,
                  statusRF: apiData.statusRF || empresa.statusRF,
                  endereco: apiData.endereco || empresa.endereco,
                  dataAtualizacaoAPI: new Date()
              }
          });
          await sleep(500); 
          return res.json({ status: 'sucesso', razao: apiData.razaoSocial });
      } catch (error: any) {
          return res.status(500).json({ status: 'erro', motivo: error.message });
      }
  }

  // === REFRESH DATA (ATUALIZADO) ===
  async refreshData(req: Request, res: Response) {
      const { id } = req.params;

      try {
          const empresa = await prisma.empresa.findUnique({ where: { id } });
          
          if (!empresa) return res.status(404).json({ error: 'Empresa não encontrada.' });
          if (!empresa.cnpj) return res.status(400).json({ error: 'Empresa sem CNPJ.' });

          const apiData = await OpenCnpjService.consultarCNPJ(empresa.cnpj);

          if (!apiData) {
              return res.status(502).json({ error: 'API externa não retornou dados.' });
          }

          const atualizada = await prisma.empresa.update({
              where: { id },
              data: {
                  razaoSocial: apiData.razaoSocial,
                  nomeFantasia: apiData.nomeFantasia,
                  email: apiData.email || empresa.email,
                  telefone: apiData.telefone || empresa.telefone,
                  cnae: String(apiData.cnae),
                  statusRF: apiData.statusRF,
                  endereco: apiData.endereco || empresa.endereco || {},
                  updatedAt: new Date()
              }
          });

          // RETORNA DADOS COMPLETOS PARA O RELATÓRIO DO FRONTEND
          return res.json({ 
              status: 'sucesso', 
              dados: {
                  razao: atualizada.razaoSocial,
                  email: atualizada.email,
                  telefone: atualizada.telefone,
                  socios: apiData.socios,
                  cidade: apiData.cidade, // Adicionado
                  uf: apiData.estado      // Adicionado
              }
          });

      } catch (error: any) {
          console.error(`Erro refresh empresa ${id}:`, error);
          return res.status(500).json({ error: 'Erro interno ao atualizar.' });
      }
  }
}