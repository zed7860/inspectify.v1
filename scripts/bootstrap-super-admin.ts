import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!url || !key || !email || !password) {
    throw new Error("Set Supabase + SUPER_ADMIN env vars");
  }

  if (password.length < 12) {
    throw new Error("Use a password of at least 12 characters");
  }

  const s = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await s.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: "Super Admin" }
  });

  if (error && !error.message.toLowerCase().includes("already")) {
    throw error;
  }

  let uid = data.user?.id;

  if (!uid) {
    const { data: list } = await s.auth.admin.listUsers({ perPage: 1000 });
    uid = list.users.find((u) => u.email === email)?.id;
  }

  if (!uid) {
    throw new Error("Could not resolve user");
  }

  const { error: profileError } = await s.from("profiles").upsert({
    id: uid,
    email,
    name: "Super Admin",
    role: "SUPER_ADMIN",
    is_active: true
  });

  if (profileError) {
    throw profileError;
  }

  console.log("Super Admin ready:", email);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});