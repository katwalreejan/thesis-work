import { useState } from 'react'
import AssignmentDetail from './AssignmentDetail'

const statusLabel = (assignment) => assignment.is_correct === true ? 'Correct' : assignment.is_correct === false ? 'Keep going' : 'Reviewed'

export default function AssignmentList({ assignments }) {
  const [selectedId, setSelectedId] = useState(null)

  return <div className="uploads-list">{assignments.map((assignment) => { const isSelected = selectedId === assignment.id; return <div className={`upload-entry ${isSelected ? 'selected' : ''}`} key={assignment.id}><div className="upload-row"><div><strong>{assignment.filename}</strong><small>{assignment.created_at ? new Date(assignment.created_at).toLocaleString() : 'Recently uploaded'}</small></div><div className="upload-row-actions"><span className={`upload-status ${assignment.is_correct === true ? 'correct' : assignment.is_correct === false ? 'needs-work' : ''}`}>{statusLabel(assignment)}</span><button className="view-upload-button" type="button" onClick={() => setSelectedId(isSelected ? null : assignment.id)}>{isSelected ? 'Hide assignment' : 'View uploaded assignment'} <span>{isSelected ? '↑' : '→'}</span></button></div></div>{isSelected && <AssignmentDetail assignment={assignment} />}</div> })}</div>
}
