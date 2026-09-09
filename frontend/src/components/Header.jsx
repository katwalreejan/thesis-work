export default function Header({ user, onLogout }) {
  return <header className="app-header"><div className="brand"><div className="brand-mark small">sf</div><span>student feedback</span></div><div className="user-menu"><span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span><span className="user-name">{user.name}</span><button onClick={onLogout}>Sign out</button></div></header>
}
