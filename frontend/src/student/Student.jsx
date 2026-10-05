import { useEffect, useState } from 'react'
import { api, TOKEN_KEY } from '../api'

const formatDate = (value) => value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No date'

const getStatusMeta = (work) => {
  if (!work) return { key: 'pending', label: 'Pending', className: 'missing' }
  if (work.feedback_status === 'REVIEWED') return { key: 'feedback', label: 'Feedback Received', className: 'complete' }
  return { key: 'submitted', label: 'Submitted', className: 'pending' }
}

const getQuestions = (item) => {
  const gradedQuestions = item.grading?.questions || []
  if (gradedQuestions.length) return gradedQuestions

  const content = item.assignment?.assignment_content || item.assignment?.instructions || ''
  const parts = content.split(/(?=^\s*(?:question\s*)?\d+[.)]\s*)/im).map((part) => part.trim()).filter(Boolean)
  const questions = parts.length ? parts : content ? [content] : []
  return questions.map((question, index) => ({
    question: question.replace(/^\s*(?:question\s*)?\d+[.)]\s*/i, ''),
    answer: questions.length === 1 ? item.ocr_text : '',
    correct_answer: null,
    is_correct: questions.length === 1 && item.ai_score === 100 ? true : null,
    feedback: questions.length === 1 ? item.ai_feedback : '',
    number: index + 1,
  }))
}

function FeedbackDetails({ item }) {
  const questions = getQuestions(item)
  const feedbackSubmitted = item.feedback_status === 'REVIEWED'
  return (
    <div className="feedback-detail">
      <div className="feedback-meta">
        <p><strong>Assignment:</strong> {item.assignment?.title || 'Assignment review'}</p>
        <p><strong>Subject:</strong> {item.assignment?.subject || 'Not specified'}</p>
        <p><strong>Submitted:</strong> {formatDate(item.submitted_at)}</p>
        <p className={`feedback-review-status ${feedbackSubmitted ? 'complete' : 'pending'}`}><strong>Teacher feedback:</strong> {feedbackSubmitted ? 'Submitted / Completed' : 'Pending review'}</p>
      </div>

      <div className="feedback-question-list">
        {questions.length ? questions.map((question, index) => (
          <article className="feedback-question" key={`${item.id}-${index}`}>
            <h4>Question {index + 1}</h4>
            <p className="feedback-question-text">{question.question || 'Question not identified'}</p>
            <div className="feedback-answer-grid">
              <div><span>Your Answer</span><p>{question.answer || item.ocr_text || 'No answer identified'}</p></div>
              <div><span>Correct Answer</span><p>{question.correct_answer || 'Not provided'}</p></div>
            </div>
            <p className={`feedback-status ${question.is_correct === true ? 'correct' : question.is_correct === false ? 'incorrect' : 'unknown'}`}>
              Status: {question.is_correct === true ? '✓ Correct' : question.is_correct === false ? '✕ Needs another look' : 'Review with your teacher'}
            </p>
            {question.feedback && <p className="feedback-question-note">{question.feedback}</p>}
          </article>
        )) : <p className="muted">Question details are not available for this older submission.</p>}
      </div>

      <div className="feedback-summary">
        <div><span>Your Score</span><strong>{item.ai_score === null || item.ai_score === undefined ? 'Not scored' : `${item.ai_score}/100`}</strong></div>
        <div><span>AI Feedback</span><p>{item.ai_feedback || 'No AI feedback yet.'}</p></div>
        {feedbackSubmitted && <div className="teacher-feedback-summary"><span>Submitted Teacher Feedback</span><p>{item.teacher_feedback || 'Your teacher submitted feedback without an additional comment.'}</p></div>}
      </div>
    </div>
  )
}

function UploadForm({ assignment, onDone }) {
  const [file, setFile] = useState(null)
  const [message, setMessage] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    if (!file) return

    setMessage('Uploading...')
    const body = new FormData()
    body.append('file', file)

    try {
      const response = await fetch(`/api/student/assignments/${assignment.id}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY)}` },
        body,
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.detail || 'Could not send your work')
      setMessage('Sent to teacher')
      if (onDone) onDone(result)
    } catch (error) {
      setMessage(error.message)
    }
  }

  return (
    <form className="classroom-upload" onSubmit={submit}>
      <input
        type="file"
        accept="image/*,.pdf"
        required
        onChange={(event) => setFile(event.target.files[0] || null)}
      />
      <button className="primary-button" type="submit" disabled={!file}>
        {message || 'Upload work'}
      </button>
    </form>
  )
}

export default function Student({ user }) {
  const [tab, setTab] = useState('overview')
  const [dashboard, setDashboard] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [selectedSubject, setSelectedSubject] = useState(null)
  const [assignmentSearch, setAssignmentSearch] = useState('')
  const [assignmentStatus, setAssignmentStatus] = useState('')
  const [assignmentSort, setAssignmentSort] = useState('soonest')
  const [assignmentPage, setAssignmentPage] = useState(1)
  const [openFeedback, setOpenFeedback] = useState(null)
  const [error, setError] = useState('')

  const load = async () => {
    try {
      const [overview, assignmentData, submissionData] = await Promise.all([
        api('/student/dashboard'),
        api('/student/assignments'),
        api('/student/submissions'),
      ])
      setDashboard(overview)
      setAssignments(assignmentData.assignments || [])
      setSubmissions(submissionData.submissions || [])
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => { load() }, [])

  if (!dashboard) {
    return <main className="workspace"><p className={error ? 'error' : 'loading'}>{error || 'Loading your dashboard...'}</p></main>
  }

  const normalizedSearch = assignmentSearch.trim().toLowerCase()
  const subjectOptions = [...new Set(assignments.map((assignment) => assignment.subject).filter(Boolean))].sort()
  const filteredAssignments = assignments
    .filter((assignment) => {
      const status = getStatusMeta(assignment.submission)
      const matchesSearch = !normalizedSearch || [assignment.title, assignment.subject, assignment.teacher_name].some((value) => String(value || '').toLowerCase().includes(normalizedSearch))
      return matchesSearch && (!selectedSubject || assignment.subject === selectedSubject) && (!assignmentStatus || status.key === assignmentStatus)
    })
    .sort((first, second) => {
      const firstDate = first.due_date ? new Date(first.due_date).getTime() : Number.POSITIVE_INFINITY
      const secondDate = second.due_date ? new Date(second.due_date).getTime() : Number.POSITIVE_INFINITY
      return assignmentSort === 'latest' ? secondDate - firstDate : firstDate - secondDate
    })
  const assignmentPageSize = 8
  const assignmentPageCount = Math.max(1, Math.ceil(filteredAssignments.length / assignmentPageSize))
  const currentAssignmentPage = Math.min(assignmentPage, assignmentPageCount)
  const visibleAssignments = filteredAssignments.slice((currentAssignmentPage - 1) * assignmentPageSize, currentAssignmentPage * assignmentPageSize)
  const updateAssignmentView = (field) => (event) => {
    const value = event.target.value
    if (field === 'search') setAssignmentSearch(value)
    if (field === 'status') setAssignmentStatus(value)
    if (field === 'sort') setAssignmentSort(value)
    setAssignmentPage(1)
  }
  const resetAssignmentView = () => {
    setAssignmentSearch('')
    setAssignmentStatus('')
    setAssignmentSort('soonest')
    setSelectedSubject(null)
    setAssignmentPage(1)
  }

  const summaryCards = [
    ['pending_assignments', 'Pending assignments'],
    ['completed_assignments', 'Completed assignments'],
    ['average_score', 'Average score'],
    ['total_assignments', 'Total work'],
  ]

  return (
    <main className="workspace classroom-workspace">
      <div className="page-top">
        <div>
          <p className="eyebrow">Student dashboard</p>
         
          <p className="muted">
            {user.grade ? `Grade ${user.grade} · Class ${user.class_section}` : 'Your class space'}
          </p>
        </div>
        <div className="date-chip">Keep learning</div>
      </div>

      {error && <p className="error">{error}</p>}

      <nav className="classroom-tabs" aria-label="Student pages">
        {[['overview', 'Home'], ['assignments', 'My work'], ['submissions', 'Previous work']].map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={tab === key ? 'active' : ''}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'overview' && (
        <>
          <div className="stats-grid">
            {summaryCards.map(([key, label]) => (
              <article className="stat-card" key={key}>
                <p>{label}</p>
                <strong>
                  {key === 'average_score' ? `${dashboard.stats[key]}%` : dashboard.stats[key]}
                </strong>
                <small>
                  {key === 'pending_assignments'
                    ? 'Need your attention'
                    : key === 'completed_assignments'
                      ? 'Submitted and tracked'
                      : key === 'average_score'
                        ? 'Teacher-reviewed work'
                        : 'Across your class'}
                </small>
              </article>
            ))}
          </div>

          <section className="classroom-section">
            <div className="section-title">
              <div>
                <p className="eyebrow">Priority list</p>
                <h2>Pending assignments</h2>
              </div>
            </div>

            {assignments.filter((assignment) => !assignment.submission || assignment.submission.feedback_status !== 'REVIEWED').length ? (
              <div className="assignment-grid section-scroll pending-assignment-list">
                {assignments
                  .filter((assignment) => !assignment.submission || assignment.submission.feedback_status !== 'REVIEWED')
                  .map((assignment) => {
                    const status = getStatusMeta(assignment.submission)
                    return (
                      <button key={assignment.id} type="button" className="quick-assignment" onClick={() => { setSelectedSubject(assignment.subject); setTab('assignments') }}>
                        <span>{assignment.subject}</span>
                        <strong>{assignment.title}</strong>
                        <small>Due {formatDate(assignment.due_date)}</small>
                        <div style={{ marginTop: '12px' }}>
                          <span className={`status-indicator ${status.className}`}>{status.label}</span>
                        </div>
                      </button>
                    )
                  })}
              </div>
            ) : (
              <div className="empty-state">You are all caught up. Nice work.</div>
            )}
          </section>

          <section className="classroom-section">
            <div className="section-title">
              <div>
                <p className="eyebrow">Feedback</p>
                <h2>Recent feedback</h2>
              </div>
            </div>

            {(dashboard.recent_feedback || []).length ? (
              <div className="assignment-grid section-scroll feedback-list">
                {(dashboard.recent_feedback || []).map((item) => {
                  const assignment = assignments.find((candidate) => candidate.id === item.assignment_id)
                  const feedbackItem = { ...item, assignment: assignment || item.assignment }
                  return <article className="quick-assignment feedback-card" key={item.id}>
                    <span>{feedbackItem.assignment?.subject || 'Feedback'}</span>
                    <strong>{feedbackItem.assignment?.title || 'Assignment review'}</strong>
                    <small>Submitted {formatDate(item.submitted_at)}</small>
                    <button type="button" className="feedback-open-button" onClick={() => setOpenFeedback(openFeedback === item.id ? null : item.id)}>
                      {openFeedback === item.id ? 'Hide feedback' : 'View full feedback'}
                    </button>
                    {openFeedback === item.id && <FeedbackDetails item={feedbackItem} />}
                  </article>
                })}
              </div>
            ) : (
              <div className="empty-state">No recent feedback yet. Your teacher will share notes after review.</div>
            )}
          </section>

          <section className="classroom-section">
            <div className="section-title">
              <div>
                <p className="eyebrow">Progress</p>
                <h2>Progress by subject</h2>
              </div>
            </div>

            <div className="subject-progress-grid section-scroll subject-list">
              {(dashboard.subjects || []).map((subject) => (
                <button
                  key={subject.subject}
                  type="button"
                  className="subject-progress"
                  onClick={() => {
                    setSelectedSubject(subject.subject)
                    setTab('assignments')
                  }}
                >
                  <strong>{subject.subject}</strong>
                  <span>{subject.completed} / {subject.total} completed</span>
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      {tab === 'assignments' && (
        <section className="classroom-section">
          <div className="section-title">
            <div>
              <p className="eyebrow">My work</p>
              <h2>{selectedSubject || 'Assignments'}</h2>
            </div>
            <span>{filteredAssignments.length} of {assignments.length} shown</span>
          </div>

          <div className="student-assignment-filters">
            <label className="assignment-search">Search assignments
              <input type="search" placeholder="Title, subject, or teacher" value={assignmentSearch} onChange={updateAssignmentView('search')} />
            </label>
            <label>Subject
              <select value={selectedSubject || ''} onChange={(event) => { setSelectedSubject(event.target.value || null); setAssignmentPage(1) }}>
                <option value="">All subjects</option>
                {subjectOptions.map((subject) => <option key={subject}>{subject}</option>)}
              </select>
            </label>
            <label>Status
              <select value={assignmentStatus} onChange={updateAssignmentView('status')}>
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="submitted">Submitted</option>
                <option value="feedback">Feedback Received</option>
              </select>
            </label>
            <label>Due date
              <select value={assignmentSort} onChange={updateAssignmentView('sort')}>
                <option value="soonest">Soonest first</option>
                <option value="latest">Latest first</option>
              </select>
            </label>
            <button className="secondary-button filter-reset" type="button" onClick={resetAssignmentView}>Clear filters</button>
          </div>

          {visibleAssignments.length ? (
            <div className="section-scroll assignment-list">
              {visibleAssignments.map((assignment) => {
              const status = getStatusMeta(assignment.submission)
              const feedbackItem = assignment.submission ? { ...assignment.submission, assignment } : null
              return (
                <article className="assignment-card" key={assignment.id}>
                  <div className="assignment-card-head">
                    <div>
                      <span className="subject-tag">{assignment.subject}</span>
                      <h3>{assignment.title}</h3>
                      <p>
                        Due {formatDate(assignment.due_date)} · Teacher {assignment.teacher_name || 'Classroom'}
                      </p>
                    </div>
                    <span className={`status-indicator ${status.className}`}>{status.label}</span>
                  </div>

                  <div className="assignment-card-body">
                    <p>{assignment.instructions || assignment.assignment_content || 'Your teacher has shared this task for you to complete.'}</p>
                    {status.key === 'feedback' ? (
                      <>
                        <button type="button" className="feedback-open-button" onClick={() => setOpenFeedback(openFeedback === assignment.id ? null : assignment.id)}>
                          {openFeedback === assignment.id ? 'Hide feedback' : 'View Feedback'}
                        </button>
                        {openFeedback === assignment.id && <FeedbackDetails item={feedbackItem} />}
                      </>
                    ) : (
                      <UploadForm
                        assignment={assignment}
                        onDone={async () => {
                          await load()
                          setTab('submissions')
                        }}
                      />
                    )}
                  </div>
                </article>
              )
              })}
            </div>
          ) : (
            <div className="empty-state">No assignments match these filters.</div>
          )}

          <div className="assignment-pagination">
            <span>Page {currentAssignmentPage} of {assignmentPageCount}</span>
            <button className="secondary-button" type="button" disabled={currentAssignmentPage === 1} onClick={() => setAssignmentPage((page) => page - 1)}>Previous</button>
            <button className="secondary-button" type="button" disabled={currentAssignmentPage >= assignmentPageCount} onClick={() => setAssignmentPage((page) => page + 1)}>Next</button>
          </div>
        </section>
      )}

      {tab === 'submissions' && (
        <section className="classroom-section">
          <div className="section-title">
            <div>
              <p className="eyebrow">Previous work</p>
              <h2>Your submissions</h2>
            </div>
          </div>

          {(submissions || []).length ? (
            <div className="assignment-grid section-scroll submission-list">
              {(submissions || []).map((item) => {
                const status = getStatusMeta(item)
                return (
                  <article className="quick-assignment" key={item.id}>
                    <span>{item.assignment?.subject || 'Submission'}</span>
                    <strong>{item.assignment?.title || 'Assignment'}</strong>
                    <small>Submitted {formatDate(item.submitted_at)}</small>
                    <div style={{ marginTop: '12px' }}>
                      <span className={`status-indicator ${status.className}`}>{status.label}</span>
                    </div>
                    <p style={{ marginTop: '10px', color: '#59746d', lineHeight: 1.6 }}>
                      {item.feedback_status === 'REVIEWED' ? item.teacher_feedback || 'Your teacher submitted feedback without an additional comment.' : 'Your teacher is still reviewing this work.'}
                    </p>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="empty-state">You have not submitted any work yet. Start with an assignment in My work.</div>
          )}
        </section>
      )}
    </main>
  )
}
