import { useEffect, useState } from 'react'
import './teacher-dashboard.css'
import TeacherDashboardView from './TeacherDashboard'

const TOKEN_KEY = 'sfs_token'

const api = async (path, options = {}) => {
  const token = localStorage.getItem(TOKEN_KEY)
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.detail || 'Something went wrong')
  return data
}

function Auth({ onLogin }) {
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

function Header({ user, onLogout }) {
  return <header className="app-header"><div className="brand"><div className="brand-mark small">sf</div><span>student feedback</span></div><div className="user-menu"><span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span><span className="user-name">{user.name}</span><button onClick={onLogout}>Sign out</button></div></header>
}

const REVIEW_STEPS = [['01', 'Read', 'Text is extracted from your page.'], ['02', 'Understand', 'Your answer is checked against the question.'], ['03', 'Improve', 'Feedback points you toward the next attempt.']]

function StudentHome({ user }) {
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('')
  const [grading, setGrading] = useState(null)
  const isUploading = status === 'Reviewing your work...'

  const upload = async () => {
    if (!file) return
    setStatus('Reviewing your work...')
    setGrading(null)
    const body = new FormData()
    body.append('file', file)
    try {
      const response = await fetch('/api/upload', { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY)}` }, body })
      const result = await response.json()
      if (!response.ok) throw new Error(result.detail || 'Upload failed')
      setGrading(result.grading)
      setStatus('Review complete')
    } catch (err) {
      setStatus(err.message)
    }
  }

  return (
    <main className="workspace">
      <div className="page-top"><div><p className="eyebrow">STUDENT WORKSPACE</p><h1>Good to see you, {user.name.split(' ')[0]}.</h1><p className="muted">Share a piece of work and get a clear next step.</p></div><div className="date-chip"><span className="status-dot" /> Learning in progress</div></div>
      <section className="upload-grid">
        <div className="upload-panel"><div className="section-kicker">01 <span>SUBMIT YOUR WORK</span></div><h2>Turn a page into progress.</h2><p className="muted">Upload a clear photo of a question and your answer. Our AI will read it, check it, and explain what to try next.</p><label className={`dropzone ${file ? 'has-file' : ''}`}><input type="file" accept="image/*" onChange={(event) => setFile(event.target.files[0] || null)} /><span className="upload-icon">↥</span><strong>{file ? file.name : 'Drop an image here'}</strong><small>{file ? 'Ready to review' : 'or click to browse · PNG, JPG up to 10MB'}</small></label><button className="primary-button upload-button" disabled={!file || isUploading} onClick={upload}>{isUploading ? 'Analyzing image...' : 'Get AI feedback'} <span>→</span></button>{status && !['Review complete', 'Reviewing your work...'].includes(status) && <p className="error">{status}</p>}</div>
        <div className="how-panel"><div className="section-kicker">02 <span>WHAT YOU'LL GET</span></div>{REVIEW_STEPS.map(([number, title, text]) => <div className="benefit" key={number}><b>{number}</b><div><strong>{title}</strong><p>{text}</p></div></div>)}</div>
      </section>
      {grading && <section className="feedback-result"><div className="result-head"><div><p className="eyebrow">AI REVIEW · JUST NOW</p><h2>Your feedback is ready.</h2></div><div className={`score-badge ${grading.is_correct ? 'correct' : 'needs-work'}`}>{grading.is_correct ? 'Correct' : 'Keep going'}</div></div><div className="feedback-columns"><div><p className="eyebrow">QUESTION</p><p>{grading.question}</p></div><div><p className="eyebrow">YOUR ANSWER</p><p>{grading.answer}</p></div><div className="feedback-note"><p className="eyebrow">FEEDBACK</p><p>{grading.feedback}</p></div></div></section>}
    </main>
  )
}

function App() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(() => Boolean(localStorage.getItem(TOKEN_KEY)))

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return
    api('/me').then(setUser).catch(() => localStorage.removeItem(TOKEN_KEY)).finally(() => setChecking(false))
  }, [])

  const logout = () => { localStorage.removeItem(TOKEN_KEY); setUser(null) }
  if (checking) return <div className="loading">Preparing your workspace...</div>
  if (!user) return <Auth onLogin={setUser} />
  return <><Header user={user} onLogout={logout} />{user.role === 'teacher' ? <TeacherDashboardView /> : <StudentHome user={user} />}</>
}

export default App
