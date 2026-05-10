import { useEffect, useState } from 'react'
import Home from './pages/Home'
import VideoSummary from './pages/VideoSummary'
import VideoSummaryDetail from './pages/VideoSummaryDetail'
import CountryCompare from './pages/CountryCompare'
import Login from './pages/Login'
import MyPage from './pages/MyPage'
import OAuthCallback from './pages/OAuthCallback'
import Signup from './pages/Signup'
import ChatbotWidget from './components/chat/ChatbotWidget'
import {
  clearAuthSession,
  consumeAuthRedirect,
  createAuthSession,
  exchangeSocialCode,
  getSocialLoginLabel,
  getSocialProviderFromPath,
  getStoredAuthSession,
  persistAuthSession,
} from './services/auth'

const initialOAuthState = {
  status: 'idle',
  provider: null,
  errorMessage: '',
}

function getRouteStateFromLocation() {
  const socialProvider = getSocialProviderFromPath(window.location.pathname)

  if (socialProvider) {
    return {
      name: 'oauth-callback',
      provider: socialProvider,
    }
  }

  const route = window.location.hash.replace('#', '')

  if (route.startsWith('summary/video/')) {
    return {
      name: 'summary-detail',
      videoId: decodeURIComponent(route.replace('summary/video/', '')),
    }
  }

  if (
    route === 'summary' ||
    route === 'compare' ||
    route === 'mypage' ||
    route === 'login' ||
    route === 'signup'
  ) {
    return { name: route }
  }

  return { name: 'home' }
}

function App() {
  const [routeState, setRouteState] = useState(getRouteStateFromLocation)
  const [authSession, setAuthSession] = useState(getStoredAuthSession)
  const [oauthState, setOAuthState] = useState(initialOAuthState)

  const isLoggedIn = Boolean(authSession)
  const accessToken = authSession?.token || ''

  const completeAuth = (authResult, fallbackProfile = {}) => {
    const nextSession = createAuthSession(authResult, fallbackProfile)
    persistAuthSession(nextSession)
    setAuthSession(nextSession)
  }

  useEffect(() => {
    const handleLocationChange = () => {
      setRouteState(getRouteStateFromLocation())
    }

    window.addEventListener('hashchange', handleLocationChange)
    window.addEventListener('popstate', handleLocationChange)

    return () => {
      window.removeEventListener('hashchange', handleLocationChange)
      window.removeEventListener('popstate', handleLocationChange)
    }
  }, [])

  useEffect(() => {
    if (routeState.name !== 'oauth-callback') {
      if (oauthState.status !== 'idle') {
        setOAuthState(initialOAuthState)
      }

      return undefined
    }

    let isCancelled = false

    const handleOAuthCallback = async () => {
      const provider = routeState.provider
      const providerLabel = getSocialLoginLabel(provider)

      setOAuthState({
        status: 'loading',
        provider,
        errorMessage: '',
      })

      try {
        const searchParams = new URLSearchParams(window.location.search)
        const authorizationError = searchParams.get('error')
        const code = searchParams.get('code') || ''

        if (authorizationError) {
          throw new Error(`${providerLabel} 로그인 인증이 취소되었거나 실패했습니다.`)
        }

        if (!code.trim()) {
          throw new Error('로그인에 필요한 인증 코드를 찾지 못했습니다.')
        }

        const authResult = await exchangeSocialCode(provider, code)

        if (isCancelled) {
          return
        }

        completeAuth(authResult)

        const redirectHash = consumeAuthRedirect()
        const nextHash =
          redirectHash && redirectHash.startsWith('#') ? redirectHash : '#home'

        window.history.replaceState({}, '', `/${nextHash}`)
        setOAuthState(initialOAuthState)
        setRouteState(getRouteStateFromLocation())
      } catch (error) {
        if (isCancelled) {
          return
        }

        setOAuthState({
          status: 'error',
          provider,
          errorMessage:
            error instanceof Error
              ? error.message
              : `${providerLabel} 로그인 중 오류가 발생했습니다.`,
        })
      }
    }

    handleOAuthCallback()

    return () => {
      isCancelled = true
    }
  }, [routeState])

  const handleAuthClick = () => {}

  const handleAuthSuccess = (authResult, fallbackProfile) => {
    completeAuth(authResult, fallbackProfile)
    window.location.hash = '#home'
  }

  const handleInlineAuthSuccess = (authResult, fallbackProfile) => {
    completeAuth(authResult, fallbackProfile)
  }

  const handleProfileUpdate = (nextUserProfile) => {
    setAuthSession((currentSession) => {
      if (!currentSession) {
        return currentSession
      }

      const nextSession = {
        ...currentSession,
        user: {
          ...currentSession.user,
          ...nextUserProfile,
        },
      }

      persistAuthSession(nextSession)

      return nextSession
    })
  }

  const handleMoveToSignup = () => {
    window.location.hash = '#signup'
  }

  const handleMoveToLogin = () => {
    window.location.hash = '#login'
  }

  const handleLogout = () => {
    clearAuthSession()
    setAuthSession(null)
    window.location.hash = '#home'
  }

  const chatContext =
    routeState.name === 'summary-detail' && routeState.videoId
      ? {
          pageType: 'VIDEO_ANALYSIS',
          videoId: routeState.videoId,
        }
      : {
          pageType: routeState.name.toUpperCase().replace(/-/g, '_'),
        }

  const renderWithChatbot = (page) => (
    <>
      {page}
      <ChatbotWidget
        accessToken={accessToken}
        context={chatContext}
        isLoggedIn={isLoggedIn}
        onLoginClick={handleMoveToLogin}
        user={authSession?.user}
      />
    </>
  )

  if (routeState.name === 'oauth-callback') {
    return (
      <OAuthCallback
        provider={routeState.provider}
        status={oauthState.status}
        errorMessage={oauthState.errorMessage}
      />
    )
  }

  if (routeState.name === 'summary') {
    return renderWithChatbot(
      <VideoSummary
        isLoggedIn={isLoggedIn}
        onAuthClick={handleAuthClick}
        onLoginSuccess={handleInlineAuthSuccess}
        onMoveToSignup={handleMoveToSignup}
      />,
    )
  }

  if (routeState.name === 'summary-detail') {
    if (!isLoggedIn) {
      return renderWithChatbot(
        <Login
          isLoggedIn={isLoggedIn}
          onAuthClick={handleAuthClick}
          onLoginSuccess={handleAuthSuccess}
          onMoveToSignup={handleMoveToSignup}
        />,
      )
    }

    return renderWithChatbot(
      <VideoSummaryDetail
        isLoggedIn={isLoggedIn}
        onAuthClick={handleAuthClick}
        accessToken={accessToken}
        videoId={routeState.videoId}
      />,
    )
  }

  if (routeState.name === 'compare') {
    return renderWithChatbot(
      <CountryCompare isLoggedIn={isLoggedIn} onAuthClick={handleAuthClick} />,
    )
  }

  if (routeState.name === 'mypage') {
    if (!isLoggedIn) {
      return renderWithChatbot(
        <Login
          isLoggedIn={isLoggedIn}
          onAuthClick={handleAuthClick}
          onLoginSuccess={handleAuthSuccess}
          onMoveToSignup={handleMoveToSignup}
        />,
      )
    }

    return renderWithChatbot(
      <MyPage
        isLoggedIn={isLoggedIn}
        onAuthClick={handleAuthClick}
        onLogout={handleLogout}
        onProfileUpdate={handleProfileUpdate}
        user={authSession?.user}
      />,
    )
  }

  if (routeState.name === 'login') {
    return renderWithChatbot(
      <Login
        isLoggedIn={isLoggedIn}
        onAuthClick={handleAuthClick}
        onLoginSuccess={handleAuthSuccess}
        onMoveToSignup={handleMoveToSignup}
      />,
    )
  }

  if (routeState.name === 'signup') {
    return renderWithChatbot(
      <Signup
        isLoggedIn={isLoggedIn}
        onAuthClick={handleAuthClick}
        onSignupSuccess={handleAuthSuccess}
        onMoveToLogin={handleMoveToLogin}
      />,
    )
  }

  return renderWithChatbot(<Home isLoggedIn={isLoggedIn} onAuthClick={handleAuthClick} />)
}

export default App
