import { Response } from 'express';
import { Bill, toPublicBill, BILL_CATEGORIES, BillCategory } from '../models/Bill';
import { AuthedRequest } from '../middleware/requireAuth';
import { ApiError } from '../utils/ApiError';
import { findOwnedOrThrow } from '../utils/ownedDoc';
import { awardPointsSafely, isCycleNearToday, isOldEnoughForPoints, isPaidOnTime } from '../services/points';
import { POINTS } from '../constants/points';

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

  const { name, amount, dueDate, recurring, category, notificationIds, lastPaidCycle } = req.body ?? {};
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
  // A schedule change invalidates whatever cycle was marked paid under the old
  // schedule — clear it unless this same request also sets a fresh value.
  let scheduleChanged = false;
  if (dueDate !== undefined) {
    if (!dueDate || typeof dueDate !== 'string') {
      throw new ApiError(400, 'Due date is required.', 'general');
    }
    if (dueDate !== bill.dueDate) scheduleChanged = true;
    bill.dueDate = dueDate;
  }
  if (recurring !== undefined) {
    if (!!recurring !== bill.recurring) scheduleChanged = true;
    bill.recurring = !!recurring;
  }
  if (isValidCategory(category)) bill.category = category;
  if (notificationIds !== undefined) {
    bill.notificationIds = Array.isArray(notificationIds) ? notificationIds : undefined;
  }
  const previousCycle = bill.lastPaidCycle;
  if (lastPaidCycle !== undefined) {
    bill.lastPaidCycle = typeof lastPaidCycle === 'string' && lastPaidCycle ? lastPaidCycle : undefined;
  } else if (scheduleChanged) {
    bill.lastPaidCycle = undefined;
  }

  await bill.save();

  // Points: once per bill per cycle. The cycle has to be a real date close to today
  // and later than the one before (so a cycle can't be re-paid or made up), and the
  // bill has to have existed for a few minutes. Paying on or before the due date
  // earns a little extra.
  const paidCycle = typeof lastPaidCycle === 'string' ? lastPaidCycle : '';
  if (
    paidCycle &&
    paidCycle !== previousCycle &&
    (!previousCycle || paidCycle > previousCycle) &&
    isCycleNearToday(paidCycle) &&
    isOldEnoughForPoints(bill)
  ) {
    await awardPointsSafely(req.userId!, `bill:${bill.id}:${paidCycle}`, 'bill', POINTS.bill);
    if (isPaidOnTime(paidCycle)) {
      await awardPointsSafely(req.userId!, `bill-ontime:${bill.id}:${paidCycle}`, 'bill', POINTS.billOnTime);
    }
  }

  res.json(toPublicBill(bill));
}

export async function deleteBill(req: AuthedRequest, res: Response) {
  const bill = await findOwnedOrThrow(Bill, req.params.id, req.userId!);
  await bill.deleteOne();
  res.status(204).send();
}
