import axios from 'axios';

export class OpenCnpjService {
    static async consultarCNPJ(cnpj: string) {
        const limpo = cnpj.replace(/\D/g, '');
        if (limpo.length !== 14) {
            console.log(`[API] CNPJ Inválido (tamanho): ${limpo}`);
            return null;
        }

        try {
            console.log(`[API] Consultando OpenCNPJ: ${limpo}...`);
            
            // Timeout aumentado para garantir resposta de QSAs grandes
            const { data } = await axios.get(`https://api.opencnpj.org/${limpo}`, {
                timeout: 15000, 
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DispIA/1.0)' }
            });

            // === TRATAMENTO DE TELEFONE ===
            let telefoneFinal = null;
            if (data.telefone1) {
                const ddd = data.ddd1 ? String(data.ddd1).trim() : '';
                const num = String(data.telefone1).trim();
                telefoneFinal = `${ddd}${num}`.replace(/\D/g, '');
            } else if (data.telefones && Array.isArray(data.telefones) && data.telefones.length > 0) {
                const fone = data.telefones[0];
                telefoneFinal = `${fone.ddd || ''}${fone.numero || ''}`.replace(/\D/g, '');
            }

            // === TRATAMENTO DE SÓCIOS (QSA) - MELHORADO ===
            let sociosTexto = '';
            if (data.qsa && Array.isArray(data.qsa) && data.qsa.length > 0) {
                sociosTexto = data.qsa.map((s: any) => {
                    const nome = s.nome || s.nome_socio || 'Sócio';
                    const qual = s.qual || s.qualificacao_socio || '';
                    return qual ? `${nome} (${qual})` : nome;
                }).join(', ');
            } else {
                // Tenta pegar de natureza jurídica se for Empresário Individual
                if (data.natureza_juridica && data.natureza_juridica.includes('Individual')) {
                    sociosTexto = data.razao_social || data.nome; // O próprio dono
                }
            }

            return {
                cnpj: limpo,
                razaoSocial: data.razao_social || data.nome || "SEM RAZÃO SOCIAL",
                nomeFantasia: data.nome_fantasia || data.razao_social,
                email: data.email ? data.email.toLowerCase() : null, 
                telefone: telefoneFinal,
                
                logradouro: data.logradouro,
                numero: data.numero,
                complemento: data.complemento,
                bairro: data.bairro,
                cep: data.cep,
                cidade: data.municipio || data.cidade, 
                estado: data.uf,
                
                cnae: data.cnae_fiscal || data.cnae_principal, 
                dataAbertura: data.data_inicio_atividade ? new Date(data.data_inicio_atividade) : null,
                statusRF: data.situacao_cadastral || data.descricao_situacao_cadastral,
                
                // CAMPO CRÍTICO PARA O RELATÓRIO
                socios: sociosTexto,
                
                endereco: {
                    logradouro: data.logradouro,
                    numero: data.numero,
                    complemento: data.complemento,
                    bairro: data.bairro,
                    cidade: data.municipio || data.cidade,
                    estado: data.uf,
                    cep: data.cep
                }
            };

        } catch (error: any) {
            if (error.response) {
                console.error(`[API] Erro OpenCNPJ (${limpo}): Status ${error.response.status}`);
            } else {
                console.error(`[API] Erro Conexão (${limpo}): ${error.message}`);
            }
            return null; 
        }
    }
}