import { redirect } from "next/navigation";

export default function Home() {
  redirect("/login?role=admin");
  return null;
}