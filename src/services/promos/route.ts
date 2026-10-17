import { Router } from 'express';
import {
  createPromo,
  getAllPromos,
  getActivePromos,
  getPromoById,
  updatePromo,
  togglePromoActive,
  deletePromo,
} from './controller';
import { authenticate } from '../../middlewares/authenticate';

const router = Router();

router.use(authenticate);

router.post('/', createPromo);                        // buat promo baru
router.get('/', getAllPromos);                         // list semua promo (paginated)
router.get('/active', getActivePromos);               // list promo aktif & dalam periode
router.get('/:id', getPromoById);                     // detail promo
router.put('/:id', updatePromo);                      // edit promo
router.patch('/:id/toggle-active', togglePromoActive); // non-aktifkan / aktifkan
router.delete('/:id', deletePromo);                   // hapus promo (soft delete)

export default router;
