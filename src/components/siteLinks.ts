export type Page = 'calculator' | 'cache-break-even' | 'cache-keep-alive' | 'how-it-works' | 'sources'

/** Same-site pages (absolute paths; vite `base` is '/'). */
export const SITE_LINKS: readonly { page: Page; href: string; label: string }[] = [
  { page: 'calculator', href: '/', label: 'Calculator' },
  { page: 'cache-break-even', href: '/cache-break-even/', label: 'Claude Cache Break-even' },
  { page: 'cache-keep-alive', href: '/cache-keep-alive/', label: 'Cache Keep-alive' },
  { page: 'how-it-works', href: '/how-it-works/', label: 'How it is calculated' },
  { page: 'sources', href: '/sources/', label: 'Sources' },
]
