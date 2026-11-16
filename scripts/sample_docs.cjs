// Build a test set for the conflict engine: USPSTF recommendations with matching Aetna
// Clinical Policy Bulletins and Medicare National Coverage Determinations (NCDs), printed
// to PDF (the upload pages accept PDF and DOCX only). See PAIRS for which conflict.
//
//   npm install --no-save playwright && npx playwright install chromium   (once)
//   node scripts/sample_docs.cjs [out_dir]          (default: data/sample_docs, gitignored)
//
// The pages are fetched live, so the PDFs are always the current versions. Aetna's
// bulletins are Aetna's copyright: keep the PDFs local, don't commit them. NCD text comes
// from the CMS Coverage API (public domain); the CMS website itself needs JavaScript.
// Upload each guideline/policy pair in the app, map them, then run the conflict check.

const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright')

const USPSTF = 'https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/'
const AETNA = 'https://www.aetna.com/cpb/medical/data/'

const NCD_API = 'https://api.coverage.cms.gov/v1/data/ncd/'
const ACR_TRANSGENDER = 'https://acsearch.acr.org/list/TopicNarrativePdf?topicId=283' // already a PDF
const DEMO_MAMMOGRAPHY = path.join(__dirname, 'demo_guideline_mammography.html') // fictional

// [topic, guideline page, policy: Aetna page or {ncdid, ncdver, number}, what to expect].
// Checked by reading both documents' coverage text (November 2026).
const PAIRS = [
  ['colorectal', `${USPSTF}colorectal-cancer-screening`, `${AETNA}500_599/0516.html`,
    'conflict: no coverage of follow-up colonoscopy after a positive stool, sigmoidoscopy or CT colonography screen'],
  ['lung', `${USPSTF}lung-cancer-screening`, { ncdid: 364, ncdver: 2, number: '210.14' },
    'conflict: Medicare covers ages 50-77 (USPSTF 50-80) and requires a shared decision-making visit'],
  ['hepatitis_c', `${USPSTF}hepatitis-c-screening`, { ncdid: 361, ncdver: 1, number: '210.13' },
    'conflict: Medicare covers only high-risk adults and a single test for those born 1945-1965 (USPSTF: all adults 18-79)'],
  ['lung', `${USPSTF}lung-cancer-screening`, `${AETNA}300_399/0380.html`,
    'no conflict: same ages, pack-years and quit window'],
  ['cervical', `${USPSTF}cervical-cancer-screening`, `${AETNA}400_499/0443.html`,
    'no conflict: follows USPSTF'],
  ['breast', `${USPSTF}breast-cancer-screening`, `${AETNA}500_599/0584.html`,
    'no conflict: Aetna is broader (annual from 40, no upper age)'],
  ['breast_acr_transgender', ACR_TRANSGENDER, `${AETNA}500_599/0584.html`,
    'conflict: ACR rates mammography usually appropriate for transmasculine patients (variants 6-8) and high-risk transfeminine patients from 25-30 (variant 2); Aetna covers transfeminine persons from 40 only'],
  ['breast_demo', DEMO_MAMMOGRAPHY, `${AETNA}500_599/0584.html`,
    'conflict (FICTIONAL guideline written for the demo): R3-R8 conflict, R1, R2 and R9 should not; see the file header'],
  ['prostate', `${USPSTF}prostate-cancer-screening`, `${AETNA}500_599/0521.html`,
    'no conflict: Aetna is broader (PSA from 45)'],
  ['osteoporosis', `${USPSTF}osteoporosis-screening`, `${AETNA}100_199/0134.html`,
    'no conflict: Aetna is broader (all postmenopausal women)'],
]

// Render the raw HTML with no external assets: Aetna's stylesheet hides the page body
// until its JavaScript runs, so a normally loaded page prints blank.
async function print(page, url, file, html) {
  if (html === undefined) {
    const res = await page.request.get(url, { timeout: 90000 })
    if (!res.ok()) throw new Error(`${url}: HTTP ${res.status()}`)
    html = await res.text()
  }
  await page.setContent(html, { waitUntil: 'domcontentloaded' })
  await page.pdf({ path: file, format: 'Letter' })
  const text = await page.evaluate(() => document.body.innerText.length)
  if (text < 1500) throw new Error(`${url}: only ${text} characters of text rendered`)
  return page.title()
}

// A document the source already serves as a PDF.
async function save(page, url, file) {
  const res = await page.request.get(url, { timeout: 90000 })
  const type = res.headers()['content-type'] || ''
  if (!res.ok() || !type.includes('pdf')) throw new Error(`${url}: HTTP ${res.status()} ${type}`)
  fs.writeFileSync(file, await res.body())
}

function escape(text) {
  return String(text).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])
}

// One NCD as a small HTML page: its official fields from the CMS Coverage API.
async function ncdHtml(page, { ncdid, ncdver, number }) {
  const res = await page.request.get(`${NCD_API}?ncdid=${ncdid}&ncdver=${ncdver}`, { timeout: 90000 })
  if (!res.ok()) throw new Error(`NCD ${number}: HTTP ${res.status()}`)
  const body = await res.json()
  const ncd = (body.data || [body])[0]
  const source = `https://www.cms.gov/medicare-coverage-database/view/ncd.aspx?ncdid=${ncdid}&ncdver=${ncdver}`
  return `<!doctype html><html><head><meta charset="utf-8"><title>NCD ${number} - ${escape(ncd.title)}</title>
    <style>body{font:12px/1.5 Georgia,serif;margin:40px}h1{font-size:18px}</style></head><body>
    <h1>Medicare National Coverage Determination ${number}: ${escape(ncd.title)}</h1>
    <p>Centers for Medicare &amp; Medicaid Services. Effective ${escape(ncd.effective_date || '')}.
    Source: ${escape(source)}</p>
    <h2>A. General</h2>${ncd.item_service_description || ''}
    ${ncd.indications_limitations || ''}</body></html>`
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
    const done = new Set()
    for (const [topic, guidelineUrl, policy, expect] of PAIRS) {
      const guideline = guidelineUrl === ACR_TRANSGENDER
        ? 'guideline_acr_transgender_breast_screening.pdf'
        : guidelineUrl === DEMO_MAMMOGRAPHY
        ? 'guideline_DEMO_fictional_mammography.pdf'
        : `guideline_uspstf_${topic}.pdf`
      const isNcd = typeof policy !== 'string'
      const name = isNcd
        ? `policy_medicare_ncd_${policy.number.replace('.', '_')}.pdf`
        : `policy_aetna_${path.basename(policy, '.html')}.pdf`
      if (!done.has(guideline)) {
        const file = path.join(out, guideline)
        if (guidelineUrl === ACR_TRANSGENDER) await save(page, guidelineUrl, file)
        else if (guidelineUrl === DEMO_MAMMOGRAPHY)
          await print(page, null, file, fs.readFileSync(DEMO_MAMMOGRAPHY, 'utf8'))
        else await print(page, guidelineUrl, file)
        done.add(guideline)
      }
      if (!done.has(name)) {
        const html = isNcd ? await ncdHtml(page, policy) : undefined
        await print(page, isNcd ? null : policy, path.join(out, name), html)
        done.add(name)
      }
      console.log(`${guideline} + ${name}\n    expect ${expect}`)
    }
  } finally {
    await browser.close()
  }
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
