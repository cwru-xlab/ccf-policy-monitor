import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { policyRecord, guidelineRecords } from './data/documentCatalog.js'

test('document and review screens render real and empty catalogs without demo records', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected network request') })
  const previousStorage = globalThis.localStorage
  globalThis.localStorage = { getItem: () => null }
  const server = await createServer({
    server: { middlewareMode: true, hmr: false },
    plugins: [{
      name: 'provide-test-catalog', enforce: 'pre',
      load(id) {
        // Exercise page rendering with supplied data, independently of the async loader.
        if (id.endsWith('/data/withDocumentCatalog.jsx')) {
          return 'export const withDocumentCatalog = (Page) => Page'
        }
      },
    }],
  })
  try {
    const pages = ['PoliciesPage', 'GuidelinesPage', 'PolicySelectionPage',
      'GuidelineSelectionPage', 'NewPolicyReviewPage', 'DocumentMappingsPage',
      'PolicyDetailsPage', 'DashboardPage', 'PolicyReviewPage', 'ReviewFindingsPage',
      'PolicyReviewEditingPage']
    const populated = {
      policies: [policyRecord({ policy_number: '42', title: 'Uploaded policy', document_id: 'doc-42' })],
      guidelines: guidelineRecords([{ guideline_id: 'g-42', title: 'Uploaded guideline' }]),
    }
    for (const catalog of [{ policies: [], guidelines: [] }, populated]) {
      for (const page of pages) {
        const { default: Page } = await server.ssrLoadModule(`/src/pages/${page}.jsx`)
        const html = renderToString(React.createElement(MemoryRouter, null,
          React.createElement(Page, { catalog })))
        assert.doesNotMatch(html, /Cardiac Coverage|Diabetes Treatment|Oncology Coverage/, page)
        if (catalog === populated && page === 'PoliciesPage') assert.match(html, /Uploaded policy/)
        if (catalog === populated && page === 'GuidelinesPage') assert.match(html, /Uploaded guideline/)
      }
    }
  } finally {
    globalThis.localStorage = previousStorage
    await server.close()
  }
})
