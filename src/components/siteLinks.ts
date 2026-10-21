export type Page = 'calculator' | 'how-it-works' | 'sources'

/** Same-site pages (absolute paths; vite `base` is '/'). */
export const SITE_LINKS: readonly { page: Page; href: string; label: string }[] = [
  { page: 'calculator', href: '/', label: 'Calculator' },
  { page: 'how-it-works', href: '/how-it-works/', label: 'How it is calculated' },
  { page: 'sources', href: '/sources/', label: 'Sources' },
]
