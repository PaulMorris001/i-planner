import mongoose from 'mongoose';
import { env } from './env';

export async function connectDB() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri);
  // Never log env.mongoUri directly — it embeds the DB username/password. Atlas URIs
  // are comma-separated multi-host (`new URL()` can't parse those), so redact with a
  // regex instead of trying to parse out the host.
  console.log(`[db] connected to ${env.mongoUri.replace(/\/\/[^@]+@/, '//<redacted>@')}`);
}
