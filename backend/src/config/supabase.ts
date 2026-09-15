import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

<<<<<<< HEAD
export const supabase = createClient(
  env.supabaseUrl,
  env.supabasePublishableKey
);
=======
export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
 auth: {
   persistSession: false,
   autoRefreshToken: false,
 },
});

export const supabaseAdmin = env.supabaseServiceRoleKey
 ? createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
     auth: {
       persistSession: false,
       autoRefreshToken: false,
     },
   })
 : supabase;
>>>>>>> 651d277 (Implement phone OTP authentication)
