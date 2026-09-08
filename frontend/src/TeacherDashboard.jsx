import { useEffect, useState } from 'react'

const api = async (path) => {
  const token = localStorage.getItem('sfs_token')
  const response = await fetch(`/api${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.detail || 'Something went wrong')
  return data
}

const formatDate = (value) => value ? new Date(value).toLocaleString() : 'Recently'

function StudentDetails({ detail, onBack }) {
  return <section className="student-detail"><div className="detail-header"><button className="back-button" onClick={onBack}>← All students</button><p className="eyebrow">STUDENT DETAILS</p><h2>{detail.student.name}</h2><p className="muted">{detail.student.email} · {detail.uploads.length} uploads</p></div>{detail.uploads.length ? <div className="submission-list">{detail.uploads.map((item, index) => <article className="submission-card" key={item.id}><div className="submission-heading"><div><span className="submission-number">{String(index + 1).padStart(2, '0')}</span><div><p className="eyebrow">UPLOADED {formatDate(item.created_at)}</p><h3>{item.filename}</h3></div></div><div className={`mini-score ${item.score === 100 ? 'correct' : ''}`}>{item.score}%</div></div><div className="submission-content"><div><p className="eyebrow">EXTRACTED WORK</p><p className="submission-text">{item.text || 'No text was extracted from this image.'}</p></div><div><p className="eyebrow">AI FEEDBACK</p><p className="submission-feedback">{item.feedback}</p></div></div></article>)}</div> : <div className="empty-state">This student has not uploaded any work yet.</div>}</section>
}

export default function TeacherDashboardView() {
  const [data, setData] = useState(null)
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')
  const [loadingStudent, setLoadingStudent] = useState('')
  useEffect(() => { api('/teacher/dashboard').then(setData).catch((err) => setError(err.message)) }, [])
  const openStudent = async (student) => { setLoadingStudent(student.id); setError(''); try { setDetail(await api(`/teacher/students/${student.id}`)) } catch (err) { setError(err.message) } finally { setLoadingStudent('') } }
  if (error && !data) return <main className="workspace"><p className="error">{error}</p></main>
  if (!data) return <div className="loading">Loading dashboard...</div>
  const cards = [['students', 'Total students', 'active learners'], ['uploads', 'Student uploads', 'pieces submitted'], ['images', 'Uploaded images', 'pages reviewed'], ['feedback', 'AI feedback', 'reviews completed'], ['average_score', 'Average score', 'across submissions']]
  return <main className="workspace"><div className="page-top"><div><p className="eyebrow">TEACHER DASHBOARD</p><h1>See learning take shape.</h1><p className="muted">A clear view of your students' work and momentum.</p></div><div className="date-chip">● Live overview</div></div><div className="stats-grid">{cards.map(([key, title, description]) => <article className="stat-card" key={key}><p>{title}</p><strong>{data.stats[key]}{key === 'average_score' ? '%' : ''}</strong><small>{description}</small></article>)}</div>{detail ? <StudentDetails detail={detail} onBack={() => { setDetail(null); setError('') }} /> : <section className="activity-section"><div className="section-title"><div><p className="eyebrow">LATEST STUDENT WORK</p><h2>Students and uploads</h2></div><span>{data.students.length} students</span></div>{error && <p className="error">{error}</p>}{data.students.length ? <div className="student-list"><div className="student-list-head"><span>STUDENT</span><span>UPLOADS</span><span /></div>{data.students.map((student) => <div className="student-row" key={student.id}><div className="student-name"><span className="student-avatar">{student.name.slice(0, 1).toUpperCase()}</span><div><strong>{student.name}</strong></div></div><strong className="upload-count">{student.uploads}</strong><button className="view-uploads" disabled={loadingStudent === student.id} onClick={() => openStudent(student)}>{loadingStudent === student.id ? 'Loading...' : 'View uploads →'}</button></div>)}</div> : <div className="empty-state">Students will appear here once they create an account.</div>}</section>}</main>
}
