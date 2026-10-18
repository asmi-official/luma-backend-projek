import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import {
  createCabang,
  getAllCabangs,
  getCabangById,
  updateCabang,
  deleteCabang,
} from './controller';

const router = Router();

router.use(authenticate);

router.post('/', createCabang);
router.get('/', getAllCabangs);
router.get('/:id', getCabangById);
router.put('/:id', updateCabang);
router.delete('/:id', deleteCabang);

export default router;
