import mongoose from 'mongoose';
import { env } from './env';

export async function connectDB() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri);
  // Never log env.mongoUri directly — it embeds the DB username/password. Atlas URIs
  // are comma-separated multi-host, so `new URL()` can't parse them; redact with regex instead.
  console.log(`[db] connected to ${env.mongoUri.replace(/\/\/[^@]+@/, '//<redacted>@')}`);
}
