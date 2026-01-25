import { Router } from 'express';
import multer from 'multer';
import { AuthController } from './controllers/AuthController';
import { InstanceController } from './controllers/InstanceController';
import { EmpresaController } from './controllers/EmpresaController';
import { CampanhaController } from './controllers/CampanhaController';
import { DashboardController } from './controllers/DashboardController';
import { ImportController } from './controllers/ImportController';
import { SaasController } from './controllers/SaasController';
import { UserController } from './controllers/UserController';
import { ChatController } from './controllers/ChatController';

const routes = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }); 

const authController = new AuthController();
const instanceController = new InstanceController();
const empresaController = new EmpresaController();
const campanhaController = new CampanhaController();
const dashboardController = new DashboardController();
const importController = new ImportController();
const saasController = new SaasController();
const userController = new UserController();
const chatController = new ChatController();

// --- ROTAS GERAIS ---
routes.post('/auth/login', (req, res) => authController.login(req, res));
routes.post('/auth/setup', (req, res) => saasController.setupSuperAdmin(req, res));

routes.post('/saas/clients', (req, res) => saasController.createClient(req, res));
routes.get('/saas/clients', (req, res) => saasController.listClients(req, res));
routes.put('/saas/clients/:id', (req, res) => saasController.updateClient(req, res));
routes.post('/saas/clients/:id/toggle', (req, res) => saasController.toggleStatus(req, res));
routes.delete('/saas/clients/:id', (req, res) => saasController.deleteClient(req, res));

routes.get('/team/:clientId', (req, res) => userController.listMyTeam(req, res));
routes.post('/team', (req, res) => userController.createMember(req, res));
routes.delete('/team/:id', (req, res) => userController.deleteMember(req, res));
routes.put('/profile/:id', upload.single('file'), (req, res) => userController.updateProfile(req, res));

routes.post('/instances', (req, res) => instanceController.create(req, res));
routes.get('/instances/user/:userId', (req, res) => instanceController.listByUser(req, res));
routes.post('/instances/:id/connect', (req, res) => instanceController.connect(req, res));
routes.post('/instances/:id/logout', (req, res) => instanceController.logout(req, res));
routes.delete('/instances/:id', (req, res) => instanceController.delete(req, res));

routes.get('/dashboard/summary', (req, res) => dashboardController.getSummary(req, res));

routes.get('/import/template', (req, res) => importController.downloadTemplate(req, res));
routes.get('/import/template-campanha', (req, res) => importController.downloadCampaignTemplate(req, res));
routes.post('/import/single', (req, res) => importController.importSingle(req, res));
routes.post('/import/file', upload.single('file'), (req, res) => importController.importFile(req, res));

routes.get('/empresas/consulta/:cnpj', (req, res) => empresaController.consultarDadosExternos(req, res));
routes.post('/empresas', (req, res) => empresaController.upsert(req, res));
routes.get('/empresas', (req, res) => empresaController.listar(req, res));
routes.delete('/empresas/:id', (req, res) => empresaController.delete(req, res));
routes.post('/empresas/batch-delete', (req, res) => empresaController.deleteBatch(req, res));
routes.post('/empresas/update-single', (req, res) => empresaController.updateSingle(req, res));
routes.post('/empresas/:id/refresh', (req, res) => empresaController.refreshData(req, res));

// --- ROTA DE CAMPANHA (CORRIGIDA) ---
// Define explicitamente os campos aceitos
routes.post('/campanhas', upload.fields([
    { name: 'file', maxCount: 1 }, 
    { name: 'media', maxCount: 1 },
    { name: 'audio', maxCount: 1 }
]), (req, res) => campanhaController.create(req, res));

routes.get('/campanhas', (req, res) => campanhaController.list(req, res));
routes.get('/campanhas/:id/report', (req, res) => campanhaController.report(req, res));
routes.get('/campanhas/:id/export', (req, res) => campanhaController.exportReport(req, res));
routes.post('/campanhas/:id/toggle', (req, res) => campanhaController.toggleStatus(req, res));

routes.get('/chat/contacts', (req, res) => chatController.getContacts(req, res));
routes.get('/chat/messages/:jid', (req, res) => chatController.getMessages(req, res));
routes.get('/ping', (req, res) => res.send('pong'));

export { routes };