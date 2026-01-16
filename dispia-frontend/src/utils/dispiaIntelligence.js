/**
 * Inteligência de Análise de Contatos e Risco (DispIA)
 */

export const analyzeRisk = (totalEnvios, intervaloMin, intervaloMax) => {
    let score = 100;
    let riskLevel = "BAIXO";
    let recommendations = [];

    // Análise Heurística Simples
    const mediaIntervalo = (intervaloMin + intervaloMax) / 2;

    if (mediaIntervalo < 10) {
        score -= 40;
        recommendations.push("Intervalo muito curto! Aumente para no mínimo 15-30 segundos.");
    }

    if (totalEnvios > 1000 && mediaIntervalo < 25) {
        score -= 30;
        recommendations.push("Alto volume com intervalo curto. Risco de banimento iminente.");
    }

    if (totalEnvios > 5000) {
         score -= 10;
         recommendations.push("Volume muito alto para um único dia. Considere dividir em lotes.");
    }

    // Classificação
    if (score < 50) riskLevel = "ALTO";
    else if (score < 80) riskLevel = "MÉDIO";

    return { score, riskLevel, recommendations };
};

export const smartContactCleaner = (rawRows) => {
    const report = {
        valid: [],
        invalid: [],
        corrected: []
    };

    rawRows.forEach((row) => {
        // Tenta encontrar o telefone em qualquer coluna que pareça ter um número
        let phone = row.telefone || row.phone || row.celular || Object.values(row).find(val => typeof val === 'string' || typeof val === 'number');
        
        if (!phone) return;

        let original = phone;
        // Remove caracteres não numéricos
        let cleanPhone = phone.toString().replace(/\D/g, '');

        // Lógica para Brasil (+55)
        // Se tem 10 ou 11 dígitos, provavelmente falta o DDI 55
        if (cleanPhone.length >= 10 && cleanPhone.length <= 11) {
            cleanPhone = '55' + cleanPhone;
            report.corrected.push({ original, corrected: cleanPhone, reason: "Adicionado DDI 55" });
        }
        
        // Verifica nono dígito (se for celular BR: 55 + 2 dígitos DDD + 8 dígitos número = 12 dígitos)
        // Se tiver 12 dígitos e o terceiro dígito (início do DDD) for maior que 0
        if (cleanPhone.length === 12 && cleanPhone.startsWith('55')) { 
             // IA: Detecta falta do 9
             const ddd = cleanPhone.substring(2, 4);
             const number = cleanPhone.substring(4);
             // Regra simples: se o número começa com 7, 8 ou 9, geralmente é celular
             if (['7','8','9'].includes(number[0])) {
                 cleanPhone = '55' + ddd + '9' + number;
                 report.corrected.push({ original, corrected: cleanPhone, reason: "Adicionado 9º dígito automaticamente" });
             }
        }

        // Validação Final
        if (cleanPhone.length < 10 || cleanPhone.length > 15) {
            report.invalid.push({ original, reason: "Formato desconhecido/Tamanho inválido" });
        } else {
            // Salva o contato limpo
            report.valid.push({ ...row, telefone: cleanPhone }); 
        }
    });

    return report;
};