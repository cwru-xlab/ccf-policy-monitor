import { useNavigate } from 'react-router-dom'
function LoginPage() {
const navigate = useNavigate()

const handleLogin = (event) => {
  event.preventDefault()
  navigate('/dashboard')
}
  return (
    <div className="login-page">
      <div className="login-box">

        <h1>Log In</h1>

        <div className="login-links">
          <a href="#">Create an Account</a>
          <a href="#">Forgot Password?</a>
        </div>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Username</label>
            <input type="text" />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input type="password" />
          </div>

          <div className="remember-me">
            <input type="checkbox" id="remember" />
            <label htmlFor="remember">Keep me logged in</label>
          </div>

          <button type="submit">Log In</button>
        </form>

      </div>
    </div>
  )
}

export default LoginPage