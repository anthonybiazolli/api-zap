import { google } from 'googleapis';
import path from 'path';
import { Readable } from 'stream';
import fs from 'fs';

const KEY_FILE_PATH = path.resolve(__dirname, '../../google_credentials.json');
const SCOPES = ['https://www.googleapis.com/auth/drive'];

// SEU ID DA PASTA CORPORATIVA
const FOLDER_ID = '0AD_Xe_zQrOFFUk9PVA'; 

let drive: any = null;

try {
    if (fs.existsSync(KEY_FILE_PATH)) {
        const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE_PATH, scopes: SCOPES });
        drive = google.drive({ version: 'v3', auth });
        console.log("✅ Google Drive: Pronto para Upload e Download.");
    }
} catch (error) { console.error("❌ Erro ao iniciar Drive:", error); }

export class GoogleDriveService {
    // Função de Upload (Mantida)
    static async uploadBaileysMedia(baileysStream: any, fileName: string, mimeType: string): Promise<string | null> {
        if (!drive) return null;
        try {
            const readable = new Readable({ read() {} });
            if (baileysStream instanceof Buffer) { readable.push(baileysStream); readable.push(null); } 
            else { for await (const chunk of baileysStream) { readable.push(chunk); } readable.push(null); }
            
            const response = await drive.files.create({
                requestBody: { name: fileName, parents: [FOLDER_ID] },
                media: { mimeType: mimeType, body: readable },
                fields: 'id, webViewLink, webContentLink',
                supportsAllDrives: true,
                supportsTeamDrives: true
            });
            // Retorna o link que contém o ID
            return response.data.webContentLink || response.data.webViewLink || null;
        } catch (e: any) {
            console.error("❌ ERRO NO UPLOAD:", e.message);
            return null;
        }
    }

    // === NOVA FUNÇÃO: BAIXAR ARQUIVO PARA MEMÓRIA ===
    static async downloadFileToBuffer(fileUrl: string): Promise<{ buffer: Buffer, mime: string } | null> {
        if (!drive || !fileUrl) return null;

        // Extrai o ID do arquivo da URL do Google Drive
        let fileId = '';
        const patterns = [
            /id=([a-zA-Z0-9_-]{20,})/, // Formato ?id=...
            /\/d\/([a-zA-Z0-9_-]{20,})/, // Formato /d/...
            /open\?id=([a-zA-Z0-9_-]{20,})/ // Formato open?id=...
        ];

        for (const pattern of patterns) {
            const match = fileUrl.match(pattern);
            if (match && match[1]) {
                fileId = match[1];
                break;
            }
        }

        if (!fileId) {
            console.error(`[DRIVE] Não foi possível extrair ID da URL: ${fileUrl}`);
            return null;
        }

        try {
            console.log(`[DRIVE] Baixando arquivo ID: ${fileId} para envio...`);
            
            // 1. Pega metadados para saber o tipo
            const meta = await drive.files.get({ fileId, fields: 'mimeType', supportsAllDrives: true });
            
            // 2. Baixa o binário
            const response = await drive.files.get({
                fileId,
                alt: 'media',
                supportsAllDrives: true
            }, { responseType: 'arraybuffer' });

            return {
                buffer: Buffer.from(response.data),
                mime: meta.data.mimeType || 'application/octet-stream'
            };
        } catch (e: any) {
            console.error(`[DRIVE] Erro ao baixar arquivo ${fileId}:`, e.message);
            return null;
        }
    }
}