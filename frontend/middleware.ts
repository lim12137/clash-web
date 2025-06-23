import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_FILE = /\.(.*)$/;
const locales = ['zh', 'en'];
const defaultLocale = 'zh';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 忽略静态资源和 API 路由
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    PUBLIC_FILE.test(pathname)
  ) {
    return;
  }

  // 检查路径是否已经有 locale 前缀
  const hasLocale = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  );

  if (!hasLocale) {
    // 1. 优先读取 cookie
    let detectedLocale = defaultLocale;
    const cookieLocale = req.cookies.get('NEXT_LOCALE')?.value;

    if (cookieLocale && locales.includes(cookieLocale)) {
      detectedLocale = cookieLocale;
    } else {
      // 2. 读取 Accept-Language 请求头
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