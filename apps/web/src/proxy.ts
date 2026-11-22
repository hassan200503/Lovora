import { NextResponse, type NextRequest } from "next/server";
import { CSP_REPORT_PATH, contentSecurityPolicy, newNonce } from "@/lib/security/headers";

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const publicPath =
    path === "/" ||
    path === "/login" ||
    path === "/welcome" ||
    path === "/recover" ||
    path.startsWith("/join/") ||
    path.startsWith("/p/") ||
    path.startsWith("/media/");

  if (!publicPath && !request.cookies.has("lovora_session")) {
    const url = new URL("/login", request.url);
    if (path !== "/") url.searchParams.set("next", path + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  const nonce = newNonce();
  const csp = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Reporting-Endpoints", `csp-endpoint="${CSP_REPORT_PATH}"`);
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon|apple-icon|apple-touch-icon.png|robots.txt|sw.js|manifest.webmanifest).*)"],
};
