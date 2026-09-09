import { useState } from 'react'
import { api, TOKEN_KEY } from '../api'

export default function Auth({ onLogin }) {
  const [role, setRole] = useState('student')
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const isLogin = mode === 'login'

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await api(`/auth/${mode}/${role}`, { method: 'POST', body: JSON.stringify(form) })
      localStorage.setItem(TOKEN_KEY, data.token)
      onLogin(data.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const updateField = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))
  const toggleMode = () => { setMode(isLogin ? 'signup' : 'login'); setError('') }

  return (
    <main className="auth-page">
      <section className="auth-intro">
        <div className="brand-mark">sf</div>
        <p className="eyebrow">STUDENT FEEDBACK SYSTEM</p>
        <h1>Make every piece of work a step forward.</h1>
        <p className="intro-copy">Upload work, receive thoughtful AI feedback, and keep progress visible from first draft to final answer.</p>
        <div className="signal"><span /> AI-powered review <span /> teacher-led progress</div>
      </section>
      <section className="auth-card">
        <div className="role-switch" aria-label="Choose account type">
          {['student', 'teacher'].map((accountRole) => <button key={accountRole} className={role === accountRole ? 'active' : ''} onClick={() => setRole(accountRole)} type="button">{accountRole[0].toUpperCase() + accountRole.slice(1)}</button>)}
        </div>
        <div className="form-heading"><p className="eyebrow">{isLogin ? 'WELCOME BACK' : 'GET STARTED'}</p><h2>{isLogin ? `Sign in as a ${role}` : `Create your ${role} account`}</h2><p>{isLogin ? 'Pick up where you left off.' : 'A focused space for better learning.'}</p></div>
        <form onSubmit={submit}>
          {!isLogin && <label>Full name<input required value={form.name} onChange={updateField('name')} placeholder="Alex Morgan" /></label>}
          <label>Email address<input required type="email" value={form.email} onChange={updateField('email')} placeholder="you@school.edu" /></label>
          <label>Password<input required minLength="8" type="password" value={form.password} onChange={updateField('password')} placeholder="8+ characters" /></label>
          {error && <p className="error">{error}</p>}
          <button className="primary-button" disabled={loading} type="submit">{loading ? 'Opening your workspace...' : isLogin ? 'Sign in' : 'Create account'} <span>→</span></button>
        </form>
        <p className="auth-toggle">{isLogin ? 'New here?' : 'Already have an account?'}{' '}<button type="button" onClick={toggleMode}>{isLogin ? 'Create an account' : 'Sign in'}</button></p>
      </section>
    </main>
  )
}
