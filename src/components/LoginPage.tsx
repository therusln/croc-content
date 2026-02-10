import { useState } from 'react'
import { supabase } from '../supabaseClient'

interface LoginPageProps {
  onLogin: () => void
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data, error: rpcError } = await supabase.rpc('verify_password', {
        input_password: password,
      })

      if (rpcError) throw rpcError
      if (!data) {
        setError('Incorrect password')
        setLoading(false)
        return
      }

      localStorage.setItem('tm_authenticated', 'true')
      onLogin()
    } catch {
      setError('Failed to verify password. Check your connection.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-gray-900 mb-2">
            Translation Manager
          </h1>
          <p className="text-gray-500 text-sm">Enter password to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoFocus
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm
                         focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent
                         placeholder:text-gray-400 transition-all"
            />
          </div>

          {error && (
            <p className="text-danger text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 bg-gray-900 text-white text-sm font-medium rounded-xl
                       hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Verifying...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}
