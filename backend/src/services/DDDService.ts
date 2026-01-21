export const ESTADOS_DDDS: Record<string, string[]> = {
    'AC': ['68'], 'AL': ['82'], 'AP': ['96'], 'AM': ['92', '97'],
    'BA': ['71', '73', '74', '75', '77'], 'CE': ['85', '88'],
    'DF': ['61'], 'ES': ['27', '28'], 'GO': ['62', '64'],
    'MA': ['98', '99'], 'MT': ['65', '66'], 'MS': ['67'],
    'MG': ['31', '32', '33', '34', '35', '37', '38'],
    'PA': ['91', '93', '94'], 'PB': ['83'], 'PR': ['41', '42', '43', '44', '45', '46'],
    'PE': ['81', '87'], 'PI': ['86'], 'RJ': ['21', '22', '24'],
    'RN': ['84'], 'RS': ['51', '53', '54', '55'],
    'RO': ['69'], 'RR': ['95'], 'SC': ['47', '48', '49'],
    'SP': ['11', '12', '13', '14', '15', '16', '17', '18', '19'],
    'SE': ['79'], 'TO': ['63']
};

export class DDDService {
    static getDDDsFromStates(states: any): string[] {
        // CORREÇÃO CRÍTICA: Se states for null/undefined/string vazia, retorna array vazio
        if (!states || !Array.isArray(states)) {
            return [];
        }
        
        let ddds: string[] = [];
        try {
            states.forEach(uf => {
                if(!uf) return;
                const estado = String(uf).toUpperCase().trim();
                if (ESTADOS_DDDS[estado]) {
                    ddds = [...ddds, ...ESTADOS_DDDS[estado]];
                }
            });
        } catch (e) {
            console.error("Erro ao processar DDDs:", e);
            return [];
        }
        return ddds;
    }
}