import { PRICES_CHECKED } from '../data/pricing'
import { Footer } from './Footer'
import { NavBar } from './NavBar'
import { ScrollRegion } from './ScrollRegion'
import { SourcesTable } from './SourcesTable'

export function SourcesPage() {
  return (
    <div className="app">
      <NavBar page="sources" />
      <ScrollRegion className="page-scroll">
        <main>
          <h1>Sources</h1>
          <p className="lede">
            Prices and settings were checked on {PRICES_CHECKED}. Back to the <a href="/">calculator</a>.
          </p>
          <SourcesTable />
        </main>
        <Footer page="sources" />
      </ScrollRegion>
    </div>
  )
}
