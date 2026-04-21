import { type NextRequest, NextResponse } from 'next/server';

export function GET(req: NextRequest): NextResponse {
  const url = req.nextUrl.clone();
  url.pathname = '/admin/workspaces';
  const response = NextResponse.redirect(url);
  response.cookies.delete('synterra_wjwt');
  response.cookies.delete('synterra_admin_impersonating');
  return response;
}
