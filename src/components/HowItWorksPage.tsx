import { Footer } from './Footer'
import { NavBar } from './NavBar'
import { ScrollRegion } from './ScrollRegion'
import { Notes } from './Notes'

export function HowItWorksPage() {
  return (
    <div className="app">
      <NavBar page="how-it-works" />
      <ScrollRegion className="page-scroll">
        <main>
          <h1>How it is calculated</h1>
          <p className="lede">How the calculator turns your settings into cost. Back to the <a href="/">calculator</a>.</p>
          <Notes />
        </main>
        <Footer page="how-it-works" />
      </ScrollRegion>
    </div>
  )
}
