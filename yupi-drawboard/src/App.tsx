import './App.css'
import Blackboard from './components/Blackboard'
import { AuthProvider, useAuth } from './auth/AuthContext'
import Login from './pages/Login'

function InnerApp() {
  const { user } = useAuth()
  if (!user) {
    return <Login />
  }
  return <Blackboard />
}

function App() {
  return (
    <AuthProvider>
      <InnerApp />
    </AuthProvider>
  )
}

export default App
