import { Router } from 'express';
import { listBills, createBill, updateBill, deleteBill } from '../controllers/bill.controller';
import { requireAuth } from '../middleware/requireAuth';
import { asyncHandler } from '../utils/asyncHandler';

export const billRouter = Router();

billRouter.use(requireAuth);

billRouter.get('/', asyncHandler(listBills));
billRouter.post('/', asyncHandler(createBill));
billRouter.patch('/:id', asyncHandler(updateBill));
billRouter.delete('/:id', asyncHandler(deleteBill));
