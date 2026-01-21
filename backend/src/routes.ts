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

const routes = Router();
const upload = multer({ storage: multer.memoryStorage() }); 

const authController = new AuthController();
const instanceController = new InstanceController();
const empresaController = new EmpresaController();
const campanhaController = new CampanhaController();
const dashboardController = new DashboardController();
const importController = new ImportController();
const saasController = new SaasController();
const userController = new UserController();

// AUTH
routes.post('/auth/login', (req, res) => authController.login(req, res));
routes.post('/auth/setup', (req, res) => saasController.setupSuperAdmin(req, res));

// SAAS ADMIN
routes.post('/saas/clients', (req, res) => saasController.createClient(req, res));
routes.get('/saas/clients', (req, res) => saasController.listClients(req, res));
routes.put('/saas/clients/:id', (req, res) => saasController.updateClient(req, res));
routes.post('/saas/clients/:id/toggle', (req, res) => saasController.toggleStatus(req, res));
routes.delete('/saas/clients/:id', (req, res) => saasController.deleteClient(req, res));

// EQUIPE
routes.get('/team/:clientId', (req, res) => userController.listMyTeam(req, res));
routes.post('/team', (req, res) => userController.createMember(req, res));
routes.delete('/team/:id', (req, res) => userController.deleteMember(req, res));

// INSTANCIAS
routes.post('/instances', (req, res) => instanceController.create(req, res));
routes.get('/instances/user/:userId', (req, res) => instanceController.listByUser(req, res));
routes.post('/instances/:id/connect', (req, res) => instanceController.connect(req, res));
routes.post('/instances/:id/logout', (req, res) => instanceController.logout(req, res));
routes.delete('/instances/:id', (req, res) => instanceController.delete(req, res));

// DASHBOARD
routes.get('/dashboard/summary', (req, res) => dashboardController.getSummary(req, res));

// IMPORT
routes.get('/import/template', (req, res) => importController.downloadTemplate(req, res));
routes.get('/import/template-campanha', (req, res) => importController.downloadCampaignTemplate(req, res));
routes.post('/import/single', (req, res) => importController.importSingle(req, res));
routes.post('/import/file', upload.single('file'), (req, res) => importController.importFile(req, res));

// EMPRESAS
routes.get('/empresas/consulta/:cnpj', (req, res) => empresaController.consultarDadosExternos(req, res));
routes.post('/empresas', (req, res) => empresaController.upsert(req, res));
routes.get('/empresas', (req, res) => empresaController.listar(req, res));
routes.delete('/empresas/:id', (req, res) => empresaController.delete(req, res));
routes.post('/empresas/batch-delete', (req, res) => empresaController.deleteBatch(req, res));
routes.post('/empresas/update-single', (req, res) => empresaController.updateSingle(req, res));
// 👇 ROTA NOVA PARA REFRESH EM MASSA
routes.post('/empresas/:id/refresh', (req, res) => empresaController.refreshData(req, res));

// CAMPANHAS
routes.post('/campanhas', upload.single('file'), (req, res) => campanhaController.create(req, res));
routes.get('/campanhas', (req, res) => campanhaController.list(req, res));
routes.get('/campanhas/:id/report', (req, res) => campanhaController.report(req, res));
routes.get('/campanhas/:id/export', (req, res) => campanhaController.exportReport(req, res));
routes.post('/campanhas/:id/toggle', (req, res) => campanhaController.toggleStatus(req, res));

routes.get('/ping', (req, res) => res.send('pong'));

export { routes };