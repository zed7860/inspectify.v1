import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { inspectionReturnPath } from "@/lib/notifications/app-url";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookies) {
        cookies.forEach((cookie) => request.cookies.set(cookie.name, cookie.value));
        response = NextResponse.next({ request });
        cookies.forEach((cookie) => response.cookies.set(cookie.name, cookie.value, cookie.options));
      }
    } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  const destination = inspectionReturnPath(request.nextUrl.pathname);
  if (!user && destination) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", destination);
    const login = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => login.cookies.set(cookie));
    return login;
  }
  return response;
}
// Upload handlers authenticate independently. Avoid proxy buffering/truncating multi-photo requests.
export const config = { matcher: ["/((?!api/inspections|_next/static|_next/image|favicon.ico).*)"] };
