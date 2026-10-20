import { Footer } from './Footer'
import { Notes } from './Notes'

export function HowItWorksPage() {
  return (
    <>
      <main>
        <h1>How it is calculated</h1>
        <p className="lede">How the calculator turns your settings into cost. Back to the <a href="/">calculator</a>.</p>
        <Notes />
      </main>
      <Footer page="how-it-works" />
    </>
  )
}
