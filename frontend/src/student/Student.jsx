import { useEffect, useState } from 'react'
import { api } from '../api'
import AssignmentList from '../assignment/AssignmentList'
import AssignmentUpload from '../assignment/AssignmentUpload'
import FeedbackResult from '../assignment/FeedbackResult'

export default function Student({ user }) {
  const [status, setStatus] = useState('')
  const [grading, setGrading] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)

  const loadAssignments = async () => {
    try {
      const data = await api('/student/uploads')
      setAssignments(data.uploads)
    } catch (err) {
      setStatus(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAssignments() }, [])

  const handleUploadComplete = async (result) => {
    setGrading(result)
    setStatus('')
    await loadAssignments()
  }

  return <main className="workspace"><div className="page-top"><div><p className="eyebrow">STUDENT WORKSPACE</p><h1>Good to see you, {user.name.split(' ')[0]}.</h1><p className="muted">Share a piece of work and get a clear next step.</p></div><div className="date-chip"><span className="status-dot" /> Learning in progress</div></div><AssignmentUpload onComplete={handleUploadComplete} onError={() => {}} />{grading && <FeedbackResult grading={grading} />}<section className="uploads-panel"><div className="section-kicker">03 <span>YOUR UPLOADED ASSIGNMENTS</span></div><h2>Keep your progress in view.</h2>{loading ? <p className="muted">Loading your assignments...</p> : assignments.length === 0 ? <p className="muted">Your uploaded assignments will appear here after your first submission.</p> : <AssignmentList assignments={assignments} />}{status && <p className="error">{status}</p>}</section></main>
}
