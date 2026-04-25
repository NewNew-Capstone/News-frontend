import { useState } from 'react'
import AuthShell from '../components/auth/AuthShell'
import { beginSocialLogin, signup } from '../services/auth'
import './Signup.css'

function Signup({ isLoggedIn, onAuthClick, onSignupSuccess, onMoveToLogin }) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [nickname, setNickname] = useState('')
  const [birth, setBirth] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (password !== confirmPassword) {
      setErrorMessage('비밀번호를 다시 확인해 주세요.')
      return
    }

    setErrorMessage('')
    setIsSubmitting(true)

    try {
      const authResult = await signup({
        email,
        password,
        name,
        nickname,
        birth,
        phone,
      })

      onSignupSuccess(authResult, {
        email,
        name,
        nickname,
        birth,
        phone,
      })
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : '회원가입 중 오류가 발생했습니다. 다시 시도해 주세요.',
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
      pageClassName="signup-page"
      title="회원가입"
      submitLabel={isSubmitting ? '가입 중..' : '회원가입'}
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
          이미 계정이 있으신가요?{' '}
          <button className="signup-page__link-button" type="button" onClick={onMoveToLogin}>
            로그인
          </button>
        </>
      }
    >
      <input
        className="signup-page__input"
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
        className="signup-page__input"
        type="text"
        value={name}
        onChange={(event) => {
          setName(event.target.value)
          setErrorMessage('')
        }}
        placeholder="이름을 입력해 주세요."
        required
      />
      <input
        className="signup-page__input"
        type="text"
        value={nickname}
        onChange={(event) => {
          setNickname(event.target.value)
          setErrorMessage('')
        }}
        placeholder="닉네임을 입력해 주세요."
        required
      />
      <input
        className="signup-page__input"
        type="date"
        value={birth}
        onChange={(event) => {
          setBirth(event.target.value)
          setErrorMessage('')
        }}
        required
      />
      <input
        className="signup-page__input"
        type="tel"
        value={phone}
        onChange={(event) => {
          setPhone(event.target.value)
          setErrorMessage('')
        }}
        placeholder="전화번호를 입력해 주세요."
        required
      />
      <input
        className="signup-page__input"
        type="password"
        value={password}
        onChange={(event) => {
          setPassword(event.target.value)
          setErrorMessage('')
        }}
        placeholder="비밀번호를 입력해 주세요."
        required
      />
      <input
        className="signup-page__input"
        type="password"
        value={confirmPassword}
        onChange={(event) => {
          setConfirmPassword(event.target.value)
          setErrorMessage('')
        }}
        placeholder="비밀번호를 다시 입력해 주세요."
        required
      />
    </AuthShell>
  )
}

export default Signup
