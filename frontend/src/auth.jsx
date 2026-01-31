import { createContext, useContext, useState } from 'react'
import { USE_MOCKS } from './mocks/useMockMode'

const AuthContext = createContext(null)

function getInitialAuth() {
  const params = new URLSearchParams(window.location.search)
  const urlToken = params.get('token')
  const urlEmail = params.get('email')
  if (urlToken && urlEmail) {
    localStorage.setItem('atlas_token', urlToken)
    localStorage.setItem('atlas_email', urlEmail)
    window.history.replaceState({}, '', '/')
    return { token: urlToken, email: urlEmail }
  }
  return {
    token: localStorage.getItem('atlas_token'),
    email: localStorage.getItem('atlas_email'),
  }
}

export function AuthProvider({ children }) {
  const [initial] = useState(getInitialAuth)
  const [token, setToken] = useState(initial.token)
  const [email, setEmail] = useState(initial.email)

  const login = (newToken, newEmail) => {
    localStorage.setItem('atlas_token', newToken)
    localStorage.setItem('atlas_email', newEmail)
    setToken(newToken)
    setEmail(newEmail)
  }

  const logout = () => {
    localStorage.removeItem('atlas_token')
    localStorage.removeItem('atlas_email')
    setToken(null)
    setEmail(null)
  }

  // MOCK MODE: Always authenticated
  const isAuthenticated = USE_MOCKS || !!token

  return (
    <AuthContext.Provider value={{ token, email: USE_MOCKS ? 'mock@example.com' : email, login, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

export function authHeaders() {
  const token = localStorage.getItem('atlas_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}
