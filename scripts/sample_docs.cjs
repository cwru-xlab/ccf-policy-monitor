// Build a test set for the conflict engine: matching USPSTF recommendations and Aetna
// Clinical Policy Bulletins, printed to PDF (the upload pages accept PDF and DOCX only).
//
//   npm install --no-save playwright && npx playwright install chromium   (once)
//   node scripts/sample_docs.cjs [out_dir]          (default: data/sample_docs, gitignored)
//
// The pages are fetched live, so the PDFs are always the current versions. Aetna's
// bulletins are Aetna's copyright: keep the PDFs local, don't commit them.
// Upload each guideline/policy pair in the app, map them, then run the conflict check.

const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright')

const USPSTF = 'https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/'
const AETNA = 'https://www.aetna.com/cpb/medical/data/'

const PAIRS = [
  ['colorectal', `${USPSTF}colorectal-cancer-screening`, `${AETNA}500_599/0516.html`],
  ['breast', `${USPSTF}breast-cancer-screening`, `${AETNA}500_599/0584.html`],
  ['lung', `${USPSTF}lung-cancer-screening`, `${AETNA}300_399/0380.html`],
  ['cervical', `${USPSTF}cervical-cancer-screening`, `${AETNA}400_499/0443.html`],
  ['prostate', `${USPSTF}prostate-cancer-screening`, `${AETNA}500_599/0521.html`],
  ['osteoporosis', `${USPSTF}osteoporosis-screening`, `${AETNA}100_199/0134.html`],
]

// Render the raw HTML with no external assets: Aetna's stylesheet hides the page body
// until its JavaScript runs, so a normally loaded page prints blank.
async function print(page, url, file) {
  const res = await page.request.get(url, { timeout: 90000 })
  if (!res.ok()) throw new Error(`${url}: HTTP ${res.status()}`)
  await page.setContent(await res.text(), { waitUntil: 'domcontentloaded' })
  await page.pdf({ path: file, format: 'Letter' })
  const text = await page.evaluate(() => document.body.innerText.length)
  if (text < 2000) throw new Error(`${url}: only ${text} characters of text rendered`)
  return page.title()
}

async function main() {
  const out = path.resolve(process.argv[2] || 'data/sample_docs')
  fs.mkdirSync(out, { recursive: true })
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy
  const browser = await chromium.launch(proxy ? { proxy: { server: proxy } } : {})
  const page = await browser.newPage({
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36',
  })
  await page.route('**/*', (r) => r.abort()) // page.request.get is not routed
  try {
    for (const [topic, guidelineUrl, policyUrl] of PAIRS) {
      const policyNumber = path.basename(policyUrl, '.html')
      const files = [
        [guidelineUrl, `guideline_uspstf_${topic}.pdf`],
        [policyUrl, `policy_aetna_${policyNumber}_${topic}.pdf`],
      ]
      for (const [url, name] of files) {
        const title = await print(page, url, path.join(out, name))
        console.log(`${name}  <-  ${title}`)
      }
    }
  } finally {
    await browser.close()
  }
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
