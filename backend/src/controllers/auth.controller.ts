import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User, toPublicUser } from '../models/User';
import { signToken } from '../utils/jwt';
import { ApiError } from '../utils/ApiError';

const SALT_ROUNDS = 10;

export async function register(req: Request, res: Response) {
  const { fullName, email, password } = req.body ?? {};

  if (!fullName) throw new ApiError(400, 'Full name is required.', 'fullName');
  if (!email) throw new ApiError(400, 'Email is required.', 'email');
  if (!password || password.length < 8) {
    throw new ApiError(400, 'Password must be at least 8 characters.', 'password');
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw new ApiError(409, 'An account with this email already exists.', 'email');

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({ email, fullName, passwordHash });

  const token = signToken({ userId: user.id });
  res.status(201).json({ token, user: toPublicUser(user) });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required.', 'general');
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) throw new ApiError(401, 'Invalid credentials.', 'general');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new ApiError(401, 'Invalid credentials.', 'general');

  const token = signToken({ userId: user.id });
  res.status(200).json({ token, user: toPublicUser(user) });
}

export async function forgotPassword(req: Request, res: Response) {
  const { email } = req.body ?? {};
  if (!email) throw new ApiError(400, 'Email is required.', 'email');

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) throw new ApiError(404, 'No account found with this email.', 'email');

  // TODO: send a real reset email once an email provider is wired up.
  res.status(200).json({ message: 'Reset link sent.' });
}
