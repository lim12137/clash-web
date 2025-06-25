import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_FILE = /\.(.*)$/;
const locales = ['zh', 'en'];
const defaultLocale = 'zh';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Ignore static resources and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    PUBLIC_FILE.test(pathname)
  ) {
    return;
  }

  // Check if the path already has a locale prefix
  const hasLocale = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  );

  if (!hasLocale) {
    // 1. Prefer reading language from cookie
    let detectedLocale = defaultLocale;
    const cookieLocale = req.cookies.get('NEXT_LOCALE')?.value;

    if (cookieLocale && locales.includes(cookieLocale)) {
      detectedLocale = cookieLocale;
    } else {
      // 2. Read language from Accept-Language request header
      const acceptLang = req.headers.get('accept-language');
      if (acceptLang) {
        const preferred = acceptLang.split(',')[0].toLowerCase();
        if (preferred.startsWith('en')) detectedLocale = 'en';
        else if (preferred.startsWith('zh')) detectedLocale = 'zh';
      }
    }

    const url = req.nextUrl.clone();
    url.pathname = `/${detectedLocale}${pathname}`;
    return NextResponse.redirect(url);
  }
}