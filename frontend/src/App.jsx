
import './App.css'
import {
  HashRouter,
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
import PoliciesPage from './pages/PoliciesPage'
import NewPolicyPage from './pages/NewPolicyPage'
import PolicyDetailsPage from './pages/PolicyDetailsPage'
import AuditLogPage from './pages/AuditLogPage'

function App() {
  return (
    <HashRouter>
      <Routes>
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
    </HashRouter>
  )
}

export default App
