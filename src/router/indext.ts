import { Router } from 'express';
import userRoute from '../services/users/route';
import documentRoute from '../services/documents/route';
import flexParamRoute from '../services/flex-params/route';
import companyRoute from '../services/company/router';
import roleMenuPermissionRoute from '../services/role-menu-permissions/route';
import paymentMethodRoute from '../services/payment-methods/router';

const router = Router();

router.use('/users', userRoute);
router.use('/documents', documentRoute);
router.use('/flex-params', flexParamRoute);
router.use('/companies', companyRoute);
router.use('/role-menu-permissions', roleMenuPermissionRoute);
router.use('/payment-methods', paymentMethodRoute);

export default router;
