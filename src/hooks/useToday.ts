import { useState } from 'react'

/** Today's date in UTC as YYYY-MM-DD. The one place the clock is read for pricing. */
export const todayUtc = (): string => new Date().toISOString().slice(0, 10)

/**
 * The day whose prices apply: read once when the page loads, so a page left open across midnight UTC does not
 * switch by itself; a reload picks up the new day.
 */
export const useToday = (): string => useState(todayUtc)[0]
