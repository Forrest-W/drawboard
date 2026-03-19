import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (loading) return
    setError(null)
    setLoading(true)
    try {
      await login(name, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-title">电子黑板 · 登录</div>
        <div className="login-sub">输入昵称即可体验（密码仅作演示使用）</div>

        <form onSubmit={onSubmit} className="login-form">
          <label className="login-field">
            <span>昵称</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：数学老师、小明"
              autoComplete="username"
            />
          </label>

          <label className="login-field">
            <span>密码</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="任意密码（演示用）"
              autoComplete="current-password"
            />
          </label>

          {error && <div className="login-error">{error}</div>}

          <button className="login-submit" type="submit" disabled={loading}>
            {loading ? '登录中…' : '进入黑板'}
          </button>
        </form>

        <div className="login-tip">
          当前登录仅保存在本地浏览器中，不会发送到服务器，仅用于区分使用者身份。
        </div>
      </div>
    </div>
  )
}

