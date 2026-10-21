import { PRICES_CHECKED } from '../data/pricing'
import { Footer } from './Footer'
import { NavBar } from './NavBar'
import { SourcesTable } from './SourcesTable'

export function SourcesPage() {
  return (
    <>
      <NavBar page="sources" />
      <main>
        <h1>Sources</h1>
        <p className="lede">
          Prices and settings were checked on {PRICES_CHECKED}. Back to the <a href="/">calculator</a>.
        </p>
        <SourcesTable />
      </main>
      <Footer page="sources" />
    </>
  )
}
