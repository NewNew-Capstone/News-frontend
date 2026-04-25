import { useEffect, useState } from 'react'
import { beginSocialLogin, login } from '../../services/auth'
import SocialLoginIcon from './SocialLoginIcons'
import './LoginModal.css'

function LoginModal({ isOpen, onClose, onLoginSuccess, onMoveToSignup }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) {
      setEmail('')
      setPassword('')
      setErrorMessage('')
      setIsSubmitting(false)
    }
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    setErrorMessage('')
    setIsSubmitting(true)

    try {
      const authResult = await login({ email, password })
      onLoginSuccess(authResult, { email })
      onClose()
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

  const handleSignupClick = () => {
    onClose()
    onMoveToSignup()
  }

  return (
    <div className="login-modal" role="presentation" onClick={onClose}>
      <div
        className="login-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="login-modal__close" type="button" onClick={onClose} aria-label="닫기">
          ×
        </button>

        <form className="login-modal__card" onSubmit={handleSubmit}>
          <h2 id="login-modal-title" className="login-modal__title">
            로그인
          </h2>
          <p className="login-modal__description">
            서비스를 이용하기 위해 먼저 로그인해 주세요.
          </p>

          <div className="login-modal__fields">
            <input
              className="login-modal__input"
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
              className="login-modal__input"
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                setErrorMessage('')
              }}
              placeholder="비밀번호를 입력해 주세요."
              required
            />
          </div>

          {errorMessage ? <p className="login-modal__message">{errorMessage}</p> : null}

          <button className="login-modal__submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? '로그인 중..' : '로그인'}
          </button>

          <div className="login-modal__social">
            <p>SNS 간편 로그인</p>
            <div className="login-modal__social-buttons">
              <button
                className="login-modal__social-button login-modal__social-button--kakao"
                type="button"
                onClick={() => handleSocialLogin('kakao')}
                aria-label="카카오로 로그인"
                disabled={isSubmitting}
              >
                <SocialLoginIcon provider="kakao" />
              </button>
              <button
                className="login-modal__social-button login-modal__social-button--google"
                type="button"
                onClick={() => handleSocialLogin('google')}
                aria-label="구글로 로그인"
                disabled={isSubmitting}
              >
                <SocialLoginIcon provider="google" />
              </button>
            </div>
          </div>

          <div className="login-modal__footer">
            아직 회원이 아니신가요?{' '}
            <button className="login-modal__link" type="button" onClick={handleSignupClick}>
              회원가입
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default LoginModal
