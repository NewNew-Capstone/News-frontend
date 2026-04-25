import Navbar from '../components/Navbar'
import { getSocialLoginLabel } from '../services/auth'
import './OAuthCallback.css'

function OAuthCallback({ provider, status = 'loading', errorMessage = '' }) {
  const providerLabel = getSocialLoginLabel(provider)
  const isError = status === 'error'

  return (
    <main className="oauth-callback-page">
      <section className="oauth-callback-page__shell">
        <Navbar
          activeKey=""
          serviceHref="#home"
          isLoggedIn={false}
          onAuthClick={() => {}}
        />

        <div className="oauth-callback-page__card-wrap">
          <section
            className="oauth-callback-page__card"
            aria-live="polite"
            aria-busy={!isError}
          >
            <div
              className={`oauth-callback-page__status-ring ${
                isError ? 'oauth-callback-page__status-ring--error' : ''
              }`}
              aria-hidden="true"
            />

            <p className="oauth-callback-page__eyebrow">{providerLabel} 로그인</p>
            <h1 className="oauth-callback-page__title">
              {isError ? '로그인 처리에 실패했습니다.' : '로그인 정보를 확인하고 있습니다.'}
            </h1>
            <p className="oauth-callback-page__description">
              {isError
                ? errorMessage || `${providerLabel} 로그인 중 오류가 발생했습니다.`
                : '잠시만 기다려 주세요. 인증 코드를 확인한 뒤 로그인 세션을 생성하고 있습니다.'}
            </p>

            {isError ? (
              <div className="oauth-callback-page__actions">
                <a className="oauth-callback-page__action" href="/#login">
                  로그인으로 돌아가기
                </a>
                <a
                  className="oauth-callback-page__action oauth-callback-page__action--secondary"
                  href="/#home"
                >
                  홈으로 이동
                </a>
              </div>
            ) : null}
          </section>
        </div>
      </section>
    </main>
  )
}

export default OAuthCallback
