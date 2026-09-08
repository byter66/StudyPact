import dotenv from "dotenv";

dotenv.config();

const required = [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  port: Number(process.env.PORT ?? 5000),
  supabaseUrl: process.env.SUPABASE_URL!,
  supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY!,
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY,
};
