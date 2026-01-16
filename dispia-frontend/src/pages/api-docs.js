import dynamic from 'next/dynamic';
import 'swagger-ui-react/swagger-ui.css';

const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });

export default function ApiDocs() {
    const spec = {
        openapi: "3.0.0",
        info: { title: "DispIA API", version: "1.0.0", description: "Documentação para integração externa." },
        servers: [{ url: "http://localhost:3000" }],
        paths: {
            "/message/text": {
                post: {
                    summary: "Enviar mensagem de texto",
                    tags: ["Mensagens"],
                    requestBody: {
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: ["sessionId", "number", "message"],
                                    properties: {
                                        sessionId: { type: "string", example: "sessao_1" },
                                        number: { type: "string", example: "5511999999999" },
                                        message: { type: "string", example: "Olá do DispIA!" }
                                    }
                                }
                            }
                        }
                    },
                    responses: { 200: { description: "Mensagem enviada com sucesso" } }
                }
            },
            "/session/start": {
                post: {
                    summary: "Iniciar uma nova sessão",
                    tags: ["Sessão"],
                    responses: { 200: { description: "QR Code gerado" } }
                }
            }
        }
    };

    return (
        <div className="bg-white h-screen">
            <div className="bg-gray-900 p-4 text-white">
                <h2 className="font-bold">DispIA Developer Hub</h2>
            </div>
            <SwaggerUI spec={spec} />
        </div>
    );
}