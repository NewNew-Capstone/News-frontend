import { useState } from 'react'
import AuthShell from '../components/auth/AuthShell'
import { beginSocialLogin, login } from '../services/auth'
import './Login.css'

function Login({ isLoggedIn, onAuthClick, onLoginSuccess, onMoveToSignup }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()

    setErrorMessage('')
    setIsSubmitting(true)

    try {
      const authResult = await login({ email, password })
      onLoginSuccess(authResult, { email })
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : '로그인 중 오류가 발생했습니다. 다시 시도해 주세요.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSocialLogin = (provider) => {
    setErrorMessage('')
    beginSocialLogin(provider)
  }

  return (
    <AuthShell
      pageClassName="login-page"
      title="NEW NEW"
      submitLabel={isSubmitting ? '로그인 중..' : '로그인'}
      onSubmit={handleSubmit}
      isLoggedIn={isLoggedIn}
      onAuthClick={onAuthClick}
      onSocialLogin={handleSocialLogin}
      message={errorMessage}
      messageTone="error"
      isSubmitDisabled={isSubmitting}
      areSocialButtonsDisabled={isSubmitting}
      footer={
        <>
          아직 회원이 아니신가요?{' '}
          <button className="login-page__link-button" type="button" onClick={onMoveToSignup}>
            회원가입
          </button>
        </>
      }
    >
      <input
        className="login-page__input"
        type="email"
        value={email}
        onChange={(event) => {
          setEmail(event.target.value)
          setErrorMessage('')
        }}
        placeholder="이메일을 입력해 주세요."
        required
      />
      <input
        className="login-page__input"
        type="password"
        value={password}
        onChange={(event) => {
          setPassword(event.target.value)
          setErrorMessage('')
        }}
        placeholder="비밀번호를 입력해 주세요."
        required
      />
    </AuthShell>
  )
}

export default Login
