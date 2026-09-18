import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!url || !key || !email || !password) throw new Error("Set Supabase + ADMIN env vars");
  if (password.length < 12) throw new Error("Use a password of at least 12 characters");

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name: "Administrator" } });
  if (error && !error.message.toLowerCase().includes("already")) throw error;

  let userId = data.user?.id;
  if (!userId) {
    const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    userId = list.users.find((user) => user.email === email)?.id;
  }
  if (!userId) throw new Error("Could not resolve admin user");

  const { error: profileError } = await supabase.from("profiles").upsert({ id: userId, email, name: "Administrator", role: "ADMIN", is_active: true });
  if (profileError) throw profileError;
  console.log("Admin ready:", email);
}

main().catch((error) => { console.error(error); process.exit(1); });
