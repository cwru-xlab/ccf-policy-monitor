
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './LoginPage.css'

function LoginPage() {
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // ==========================================
  // LOGIN
  // ==========================================

  const handleLogin = (event) => {
    event.preventDefault()

    // Demo login: no authentication backend is connected.
    navigate('/dashboard')
  }

  return (
    <div className="ccf-login-page">

      {/* LEFT BRANDING PANEL */}
      <section className="ccf-login-brand-panel">
        <div className="ccf-login-brand-top">
          <div className="ccf-login-brand-logo">
            CCF
          </div>

          <span className="ccf-login-brand-label">
            Insurance Policy Review Workspace
          </span>
        </div>

        <div className="ccf-login-brand-content">
          <div className="ccf-login-brand-mark">
            <span>CCF</span>
          </div>

          <h1>
            Insurance Policy
            <br />
            Review Workspace
          </h1>

          <p>
            A centralized workspace for reviewing
            insurance policies, managing clinical
            guidelines, and tracking policy updates.
          </p>

          <div className="ccf-login-brand-divider" />

          <div className="ccf-login-brand-features">
            <div>
              <span className="ccf-login-feature-icon">
                ✓
              </span>
              Policy Review Management
            </div>

            <div>
              <span className="ccf-login-feature-icon">
                ✓
              </span>
              Clinical Guideline References
            </div>

            <div>
              <span className="ccf-login-feature-icon">
                ✓
              </span>
              Document Mapping and Audit Tracking
            </div>
          </div>
        </div>

        <div className="ccf-login-brand-footer">
          CCF Insurance Policy Review Workspace
        </div>
      </section>

      {/* RIGHT LOGIN PANEL */}
      <section className="ccf-login-form-panel">
        <div className="ccf-login-form-container">

          <div className="ccf-login-mobile-brand">
            CCF
          </div>

          <div className="ccf-login-form-heading">
            <span className="ccf-login-welcome">
              WELCOME BACK
            </span>

            <h2>Log In</h2>

            <p>
              Enter your credentials to access the
              Insurance Policy Review Workspace.
            </p>
          </div>

          <form onSubmit={handleLogin}>

            {/* USERNAME */}
            <div className="ccf-login-field">
              <label htmlFor="login-username">
                Username
              </label>

              <input
                id="login-username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(event) =>
                  setUsername(event.target.value)
                }
                autoComplete="username"
                required
              />
            </div>

            {/* PASSWORD */}
            <div className="ccf-login-field">
              <div className="ccf-login-field-label-row">
                <label htmlFor="login-password">
                  Password
                </label>
              </div>

              <div className="ccf-login-password-wrapper">
                <input
                  id="login-password"
                  type={
                    showPassword ? 'text' : 'password'
                  }
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  autoComplete="current-password"
                  required
                />

                <button
                  type="button"
                  className="ccf-login-show-password"
                  onClick={() =>
                    setShowPassword(!showPassword)
                  }
                  aria-label={
                    showPassword
                      ? 'Hide password'
                      : 'Show password'
                  }
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {/* REMEMBER ME */}
            <div className="ccf-login-options">
              <label className="ccf-login-remember">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) =>
                    setRememberMe(event.target.checked)
                  }
                />

                <span>Keep me logged in</span>
              </label>
            </div>

            {/* LOGIN BUTTON */}
            <button
              type="submit"
              className="ccf-login-submit"
            >
              Log In
              <span aria-hidden="true">→</span>
            </button>

          </form>

          {/* ACCOUNT LINKS */}
          <div className="ccf-login-account-links">
            <p>
              Need an account?{' '}
              <a
                href="#"
                onClick={(event) =>
                  event.preventDefault()
                }
              >
                Contact your administrator
              </a>
            </p>
          </div>

          <div className="ccf-login-form-footer">
            <span>
              Authorized access only
            </span>

            <span>
              CCF Policy Review Workspace
            </span>
          </div>
        </div>
      </section>
    </div>
  )
}

export default LoginPage
