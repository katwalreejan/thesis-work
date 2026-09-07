import { useEffect, useState } from 'react'

function App() {
  const [status, setStatus] = useState('checking...')
  const [file, setFile] = useState(null)
  const [uploadStatus, setUploadStatus] = useState('')
  const [grading, setGrading] = useState(null)

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setStatus(data.status))
      .catch(() => setStatus('backend unreachable'))
  }, [])

  const handleUpload = async () => {
    if (!file) return
    setUploadStatus('uploading...')
    setGrading(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setUploadStatus(`uploaded: ${data.filename}`)
      setGrading(data.grading)
    } catch {
      setUploadStatus('upload failed')
    }
  }

  return (
    <div>
      <h1>OCR</h1>
      <p>Backend status: {status}</p>

      <div>
        <input
          type="file"
          onChange={(e) => setFile(e.target.files[0] ?? null)}
        />
        <button onClick={handleUpload} disabled={!file}>
          Upload
        </button>
        {uploadStatus && <p>{uploadStatus}</p>}
      </div>

      {grading && (
        <div>
          <h2>{grading.is_correct ? 'Correct' : 'Incorrect'}</h2>
          <p>
            <strong>Question:</strong> {grading.question ?? '(not found)'}
          </p>
          <p>
            <strong>Answer:</strong> {grading.answer ?? '(not found)'}
          </p>
          <p>
            <strong>Feedback:</strong> {grading.feedback}
          </p>
        </div>
      )}
    </div>
  )
}

export default App
