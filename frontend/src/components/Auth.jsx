import { useEffect, useState } from 'react'
import { api, TOKEN_KEY } from '../api'

export default function Auth({ onLogin }) {
  const [role, setRole] = useState('student')
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '', grade: '', class_section: '', subject: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [classes, setClasses] = useState([])
  const isLogin = mode === 'login'

  useEffect(() => {
    if (role !== 'student' || isLogin) return
    api('/classes').then((data) => setClasses(data.classes || [])).catch((err) => setError(err.message))
  }, [role, isLogin])

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
  const switchRole = (accountRole) => {
    setRole(accountRole)
    setForm({ name: '', email: '', password: '', grade: '', class_section: '', subject: '' })
    setShowPassword(false)
    setError('')
  }
  const toggleMode = () => { setMode(isLogin ? 'signup' : 'login'); setError('') }

  return (
    <main className="auth-page">
      <section className="auth-intro">
        <div className="brand-mark">sf</div>
        <p className="eyebrow">STUDENT FEEDBACK SYSTEM</p>
        <h1>Learn from your work.</h1>
        <p className="intro-copy">Upload your work, get feedback, and see your progress.</p>
        <div className="signal"><span /> Quick feedback <span /> teacher help</div>
      </section>
      <section className="auth-card">
        <div className="role-switch" aria-label="Choose account type">
          {['student', 'teacher'].map((accountRole) => <button key={accountRole} className={role === accountRole ? 'active' : ''} onClick={() => switchRole(accountRole)} type="button">{accountRole[0].toUpperCase() + accountRole.slice(1)}</button>)}
        </div>
        <div className="form-heading"><p className="eyebrow">{isLogin ? 'WELCOME BACK' : 'GET STARTED'}</p><h2>{isLogin ? `Log in as a ${role}` : `Make your ${role} account`}</h2><p>{isLogin ? 'Keep going from where you stopped.' : 'A simple place to learn.'}</p></div>
        <form onSubmit={submit}>
          {!isLogin && <label>Name<input required value={form.name} onChange={updateField('name')} placeholder="Alex Morgan" /></label>}
          {!isLogin && role === 'student' && <>{classes.length ? <><label>Grade<select required value={form.grade} onChange={(event) => setForm((current) => ({ ...current, grade: event.target.value, class_section: '' }))}><option value="">Choose a grade</option>{classes.map((item) => <option key={item.grade} value={item.grade}>{item.grade}</option>)}</select></label><label>Class<select required disabled={!form.grade} value={form.class_section} onChange={updateField('class_section')}><option value="">Choose a section</option>{classes.find((item) => item.grade === form.grade)?.sections.map((section) => <option key={section} value={section}>{section}</option>)}</select></label></> : <p className="error">No classes are available. Please contact your teacher.</p>}</>}
          {!isLogin && role === 'teacher' && <label>Subject<select value={form.subject} onChange={updateField('subject')} required><option value="">Choose a subject</option><option>Mathematics</option><option>English</option><option>Science</option></select></label>}
          <label>Email<input required type="email" value={form.email} onChange={updateField('email')} placeholder="you@school.edu" /></label>
          <label>Password<div className="password-field"><input required minLength="8" type={showPassword ? 'text' : 'password'} value={form.password} onChange={updateField('password')} placeholder="8+ characters" /><button className="password-toggle" type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'Hide' : 'Show'}</button></div></label>
          {error && <p className="error">{error}</p>}
          <button className="primary-button" disabled={loading} type="submit">{loading ? 'Getting things ready...' : isLogin ? 'Log in' : 'Sign up'} <span>→</span></button>
        </form>
        <p className="auth-toggle">{isLogin ? 'New here?' : 'Already have an account?'}{' '}<button type="button" onClick={toggleMode}>{isLogin ? 'Sign up' : 'Log in'}</button></p>
      </section>
    </main>
  )
}
