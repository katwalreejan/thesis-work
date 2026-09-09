import { useState } from 'react'
import { TOKEN_KEY } from '../api'

const REVIEW_STEPS = [['01', 'Read', 'Text is extracted from your page.'], ['02', 'Understand', 'Your answer is checked against the question.'], ['03', 'Improve', 'Feedback points you toward the next attempt.']]

export default function AssignmentUpload({ onComplete, onError }) {
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('')
  const isUploading = status === 'Reviewing your work...'

  const upload = async () => {
    if (!file) return
    setStatus('Reviewing your work...')
    const body = new FormData()
    body.append('file', file)
    try {
      const response = await fetch('/api/upload', { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY)}` }, body })
      const result = await response.json()
      if (!response.ok) throw new Error(result.detail || 'Upload failed')
      setStatus('Review complete')
      setFile(null)
      onComplete(result.grading)
    } catch (err) {
      setStatus(err.message)
      onError(err.message)
    }
  }

  return <section className="upload-grid"><div className="upload-panel"><div className="section-kicker">01 <span>SUBMIT YOUR WORK</span></div><h2>Turn a page into progress.</h2><p className="muted">Upload a clear photo of a question and your answer. Our AI will read it, check it, and explain what to try next.</p><label className={`dropzone ${file ? 'has-file' : ''}`}><input type="file" accept="image/*" onChange={(event) => setFile(event.target.files[0] || null)} /><span className="upload-icon">↥</span><strong>{file ? file.name : 'Drop an image here'}</strong><small>{file ? 'Ready to review' : 'or click to browse · PNG, JPG up to 10MB'}</small></label><button className="primary-button upload-button" disabled={!file || isUploading} onClick={upload}>{isUploading ? 'Analyzing image...' : 'Get AI feedback'} <span>→</span></button>{status && !['Review complete', 'Reviewing your work...'].includes(status) && <p className="error">{status}</p>}</div><div className="how-panel"><div className="section-kicker">02 <span>WHAT YOU'LL GET</span></div>{REVIEW_STEPS.map(([number, title, text]) => <div className="benefit" key={number}><b>{number}</b><div><strong>{title}</strong><p>{text}</p></div></div>)}</div></section>
}
