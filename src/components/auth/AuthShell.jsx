import Navbar from '../Navbar'
import SocialLoginIcon from './SocialLoginIcons'
import './AuthShell.css'

function AuthShell({
  pageClassName = '',
  title,
  submitLabel,
  onSubmit,
  children,
  footer,
  isLoggedIn,
  onAuthClick,
  showSocialLogin = true,
  onSocialLogin,
  message = '',
  messageTone = 'error',
  isSubmitDisabled = false,
  areSocialButtonsDisabled = false,
}) {
  const handleProviderLogin = (provider) => {
    if (typeof onSocialLogin === 'function') {
      onSocialLogin(provider)
    }
  }

  return (
    <main id="auth-top" className={`auth-page ${pageClassName}`.trim()}>
      <section className="auth-page__shell">
        <Navbar
          activeKey=""
          serviceHref="#home"
          isLoggedIn={isLoggedIn}
          onAuthClick={onAuthClick}
        />

        <div className="auth-page__card-wrap">
          <form className="auth-page__card" onSubmit={onSubmit}>
            <h1 className="auth-page__title">{title}</h1>

            <div className="auth-page__fields">{children}</div>

            {message ? (
              <p className={`auth-page__message auth-page__message--${messageTone}`}>{message}</p>
            ) : null}

            <button className="auth-page__submit" type="submit" disabled={isSubmitDisabled}>
              {submitLabel}
            </button>

            {showSocialLogin ? (
              <div className="auth-page__social">
                <p>SNS 간편 로그인</p>
                <div className="auth-page__social-buttons">
                  <button
                    className="auth-page__social-button auth-page__social-button--kakao"
                    type="button"
                    onClick={() => handleProviderLogin('kakao')}
                    aria-label="카카오로 로그인"
                    disabled={areSocialButtonsDisabled}
                  >
                    <SocialLoginIcon provider="kakao" />
                  </button>
                  <button
                    className="auth-page__social-button auth-page__social-button--google"
                    type="button"
                    onClick={() => handleProviderLogin('google')}
                    aria-label="구글로 로그인"
                    disabled={areSocialButtonsDisabled}
                  >
                    <SocialLoginIcon provider="google" />
                  </button>
                </div>
              </div>
            ) : null}

            {footer ? <div className="auth-page__footer">{footer}</div> : null}
          </form>
        </div>

        <a className="auth-page__floating-top" href="#auth-top" aria-label="맨 위로 이동">
          ↑
        </a>
      </section>
    </main>
  )
}

export default AuthShell
