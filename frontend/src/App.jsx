
import './App.css'
import { useEffect } from 'react'
import { listTrackedSources } from './api'
import { syncTrackedGuidelines } from './data/discoveredGuidelines'

import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom'

import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import PolicyReviewPage from './pages/PolicyReviewPage'
import NewPolicyReviewPage from './pages/NewPolicyReviewPage'
import PolicySelectionPage from './pages/PolicySelectionPage'
import GuidelineSelectionPage from './pages/GuidelineSelectionPage'
import ReviewFindingsPage from './pages/ReviewFindingsPage'
import PolicyReviewEditingPage from './pages/PolicyReviewEditingPage'
import GuidelinesPage from './pages/GuidelinesPage'
import NewGuidelinePage from './pages/NewGuidelinePage'
import GuidelineDetailsPage from './pages/GuidelineDetailsPage'
import PoliciesPage from './pages/PoliciesPage'
import NewPolicyPage from './pages/NewPolicyPage'
import PolicyDetailsPage from './pages/PolicyDetailsPage'
import AuditLogPage from './pages/AuditLogPage'

// New policy-to-guideline mapping page
import DocumentMappingsPage from './pages/DocumentMappingsPage'
import MappingAutomationPage from './pages/MappingAutomationPage'

function App() {
  // Guidelines found by the mapping engine follow their latest snapshot.
  useEffect(() => {
    listTrackedSources().then(syncTrackedGuidelines).catch(() => {})
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/guidelines/:guidelineId" element={<GuidelineDetailsPage />} />
        <Route
          path="/login"
          element={<LoginPage />}
        />

        <Route
          path="/dashboard"
          element={<DashboardPage />}
        />

        <Route
          path="/reviews"
          element={<PolicyReviewPage />}
        />

        <Route
          path="/reviews/new"
          element={<NewPolicyReviewPage />}
        />

        <Route
          path="/reviews/new/select-policies"
          element={<PolicySelectionPage />}
        />

        <Route
          path="/reviews/new/select-guidelines"
          element={<GuidelineSelectionPage />}
        />

        <Route
          path="/reviews/findings"
          element={<ReviewFindingsPage />}
        />

        <Route
          path="/reviews/findings/:findingId/edit"
          element={<PolicyReviewEditingPage />}
        />

        <Route
          path="/guidelines"
          element={<GuidelinesPage />}
        />

        <Route
          path="/guidelines/new"
          element={<NewGuidelinePage />}
        />

        <Route
          path="/policies"
          element={<PoliciesPage />}
        />

        <Route
          path="/policies/new"
          element={<NewPolicyPage />}
        />

        <Route
          path="/policies/:policyId"
          element={<PolicyDetailsPage />}
        />

        {/* Policy-to-guideline mapping manager */}
        <Route
          path="/mappings"
          element={<DocumentMappingsPage />}
        />

        {/* Mapping engine setup: schedule, approvals, tracked guidelines */}
        <Route
          path="/mappings/automation"
          element={<MappingAutomationPage />}
        />

        <Route
          path="/audit-log"
          element={<AuditLogPage />}
        />

        <Route
          path="/"
          element={
            <Navigate
              to="/login"
              replace
            />
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
