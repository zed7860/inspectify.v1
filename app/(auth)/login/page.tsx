import { LoginForm } from "@/components/login-form";

export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) if (typeof value === "string") values[key] = value;
  return <LoginForm values={values} />;
}
