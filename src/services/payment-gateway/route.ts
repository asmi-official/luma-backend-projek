import { Router } from 'express';
import {
  createPaymentGateway,
  getPaymentGateway,
  updatePaymentGateway,
  deletePaymentGateway,
} from './controller';
import { authenticate } from '../../middlewares/authenticate';

const router = Router();

// semua route wajib login: isinya credential payment gateway
router.use(authenticate);

// tanpa :id — 1 owner hanya punya 1 credential, resource-nya di-resolve dari token
router.post('/', createPaymentGateway);
router.get('/', getPaymentGateway);
router.put('/', updatePaymentGateway);
router.delete('/', deletePaymentGateway);

export default router;
