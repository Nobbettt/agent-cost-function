/**
 * The compact-navbar breakpoint. From this width the navbar shows the currency select and Share with its
 * text; below it the currency select moves into the settings panel and Share is icon-only.
 * Keep it equal to the `max-width: 767px` media block in index.css (one rule set, one number).
 */
export const NAV_WIDE_QUERY = '(min-width: 768px)'

/**
 * From this width the Share button shows its text ("Share Current View"); below it, it is icon-only.
 * Separate from NAV_WIDE_QUERY (where the currency select moves into the navbar) because the long label, and the
 * "Link copied" status that appears beside it, need more room: they overflow the navbar at 768px. Keep equal to the
 * `max-width: 1023px` Share block in index.css.
 */
export const SHARE_TEXT_QUERY = '(min-width: 1024px)'
