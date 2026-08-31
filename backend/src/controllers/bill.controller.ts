import { Response } from 'express';
import { Bill, toPublicBill, BILL_CATEGORIES, BillCategory } from '../models/Bill';
import { AuthedRequest } from '../middleware/requireAuth';
import { ApiError } from '../utils/ApiError';
import { findOwnedOrThrow } from '../utils/ownedDoc';

function isValidCategory(value: unknown): value is BillCategory {
  return typeof value === 'string' && (BILL_CATEGORIES as readonly string[]).includes(value);
}

export async function listBills(req: AuthedRequest, res: Response) {
  const bills = await Bill.find({ firebaseUid: req.userId }).sort({ dueDate: 1 });
  res.json(bills.map(toPublicBill));
}

export async function createBill(req: AuthedRequest, res: Response) {
  const { name, amount, dueDate, recurring, category, notificationIds } = req.body ?? {};

  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new ApiError(400, 'Bill name is required.', 'general');
  }
  if (typeof amount !== 'number' || !(amount > 0)) {
    throw new ApiError(400, 'Amount must be greater than 0.', 'general');
  }
  if (!dueDate || typeof dueDate !== 'string') {
    throw new ApiError(400, 'Due date is required.', 'general');
  }

  const bill = await Bill.create({
    firebaseUid: req.userId,
    name: name.trim(),
    amount,
    dueDate,
    recurring: !!recurring,
    category: isValidCategory(category) ? category : 'other',
    notificationIds: Array.isArray(notificationIds) ? notificationIds : undefined,
  });

  res.status(201).json(toPublicBill(bill));
}

export async function updateBill(req: AuthedRequest, res: Response) {
  const bill = await findOwnedOrThrow(Bill, req.params.id, req.userId!);

  const { name, amount, dueDate, recurring, category, notificationIds } = req.body ?? {};
  if (name !== undefined) {
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new ApiError(400, 'Bill name is required.', 'general');
    }
    bill.name = name.trim();
  }
  if (amount !== undefined) {
    if (typeof amount !== 'number' || !(amount > 0)) {
      throw new ApiError(400, 'Amount must be greater than 0.', 'general');
    }
    bill.amount = amount;
  }
  if (dueDate !== undefined) {
    if (!dueDate || typeof dueDate !== 'string') {
      throw new ApiError(400, 'Due date is required.', 'general');
    }
    bill.dueDate = dueDate;
  }
  if (recurring !== undefined) bill.recurring = !!recurring;
  if (isValidCategory(category)) bill.category = category;
  if (notificationIds !== undefined) {
    bill.notificationIds = Array.isArray(notificationIds) ? notificationIds : undefined;
  }

  await bill.save();
  res.json(toPublicBill(bill));
}

export async function deleteBill(req: AuthedRequest, res: Response) {
  const bill = await findOwnedOrThrow(Bill, req.params.id, req.userId!);
  await bill.deleteOne();
  res.status(204).send();
}
