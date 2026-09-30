import { Router } from 'express';
import {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
} from './controller';
import { authenticate } from '../../middlewares/authenticate';
import upload from '../../config/multer';

const router = Router();

router.use(authenticate);

router.post('/', upload.single('photo'), createProduct);
router.get('/', getAllProducts);
router.get('/:id', getProductById);
router.put('/:id', upload.single('photo'), updateProduct);
router.delete('/:id', deleteProduct);

export default router;
