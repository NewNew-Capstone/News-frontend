const DEFAULT_API_BASE_URL = import.meta.env.DEV ? '' : 'http://54.180.92.239:8080'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(
  /\/$/,
  '',
)

const APP_ORIGIN = (import.meta.env.VITE_APP_ORIGIN || 'http://localhost:3000').replace(
  /\/$/,
  '',
)

const AUTH_STORAGE_KEY = 'newnew-auth-session'
const AUTH_REDIRECT_KEY = 'newnew-auth-redirect'
const SOCIAL_CODE_EXCHANGE_CACHE_TTL = 10_000

const socialCodeExchangePromises = new Map()

const SOCIAL_PROVIDER_CONFIG = {
  kakao: {
    label: '카카오',
    authorizeUrl: 'https://kauth.kakao.com/oauth/authorize',
    clientId:
      import.meta.env.VITE_KAKAO_REST_API_KEY || '402d0e564164d7308cd52a6a54d91efa',
    redirectUri: import.meta.env.VITE_KAKAO_REDIRECT_URI || `${APP_ORIGIN}/oauth/kakao`,
    scope: '',
  },
  google: {
    label: '구글',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    clientId:
      import.meta.env.VITE_GOOGLE_CLIENT_ID ||
      '840533157695-v6hbv8ncgb0sl7vtg694ltvf14vhtdkn.apps.googleusercontent.com',
    redirectUri: import.meta.env.VITE_GOOGLE_REDIRECT_URI || `${APP_ORIGIN}/oauth/google`,
    scope: 'email profile',
  },
}

function buildUrl(path) {
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path
}

function getSocialProviderConfig(provider) {
  const config = SOCIAL_PROVIDER_CONFIG[provider]

  if (!config) {
    throw new Error('지원하지 않는 소셜 로그인 제공자입니다.')
  }

  return config
}

async function parseResponse(response) {
  const rawText = await response.text()

  if (!rawText) {
    return null
  }

  try {
    return JSON.parse(rawText)
  } catch {
    return rawText
  }
}

function extractErrorMessage(payload) {
  if (!payload) {
    return ''
  }

  if (typeof payload === 'string') {
    return payload
  }

  return (
    payload.status?.description ||
    payload.status?.message ||
    payload.message ||
    payload.error ||
    payload.detail ||
    payload.description ||
    payload.body?.message ||
    payload.body?.error ||
    payload.data?.message ||
    payload.data?.error ||
    ''
  )
}

async function postJson(path, body, fallbackErrorMessage) {
  try {
    const response = await fetch(buildUrl(path), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(body),
    })

    const payload = await parseResponse(response)
    const responseHeaders = Object.fromEntries(response.headers.entries())

    if (!response.ok) {
      throw new Error(extractErrorMessage(payload) || fallbackErrorMessage)
    }

    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      return {
        ...payload,
        __responseHeaders: responseHeaders,
      }
    }

    return payload
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('인증 서버에 연결할 수 없습니다. 서버 상태를 확인해 주세요.')
    }

    throw error
  }
}

function collectAuthSources(authResult) {
  return [
    authResult,
    authResult?.body,
    authResult?.data,
    authResult?.result,
    authResult?.body?.data,
    authResult?.data?.body,
  ].filter((value) => value && typeof value === 'object')
}

function findFirstValue(sources, keys) {
  for (const source of sources) {
    for (const key of keys) {
      const value = source?.[key]

      if (value !== undefined && value !== null && value !== '') {
        return value
      }
    }
  }

  return null
}

function normalizeTokenValue(token) {
  if (typeof token !== 'string') {
    return token
  }

  return token.replace(/^Bearer\s+/i, '').trim()
}

function normalizeHashRedirect(hashValue) {
  const trimmed = typeof hashValue === 'string' ? hashValue.trim() : ''

  if (!trimmed || trimmed === '#login' || trimmed === '#signup') {
    return '#home'
  }

  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`
}

export function login(payload) {
  return postJson('/api/v1/auth/login', payload, '로그인에 실패했습니다. 입력 정보를 확인해 주세요.')
}

export function signup(payload) {
  return postJson('/api/v1/auth/signup', payload, '회원가입에 실패했습니다. 입력 정보를 확인해 주세요.')
}

export function getSocialLoginLabel(provider) {
  return getSocialProviderConfig(provider).label
}

export function getSocialLoginUrl(provider) {
  const config = getSocialProviderConfig(provider)
  const searchParams = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
  })

  if (config.scope) {
    searchParams.set('scope', config.scope)
  }

  return `${config.authorizeUrl}?${searchParams.toString()}`
}

export function rememberAuthRedirect(hashValue = window.location.hash) {
  try {
    sessionStorage.setItem(AUTH_REDIRECT_KEY, normalizeHashRedirect(hashValue))
  } catch {
    // sessionStorage is optional for now.
  }
}

export function consumeAuthRedirect() {
  try {
    const redirectHash = sessionStorage.getItem(AUTH_REDIRECT_KEY)

    if (redirectHash) {
      sessionStorage.removeItem(AUTH_REDIRECT_KEY)
    }

    return redirectHash
  } catch {
    return null
  }
}

export function beginSocialLogin(provider) {
  rememberAuthRedirect()
  window.location.assign(getSocialLoginUrl(provider))
}

export function getSocialProviderFromPath(pathname = '') {
  const normalizedPathname = pathname.replace(/\/+$/, '') || '/'

  if (normalizedPathname === '/oauth/kakao') {
    return 'kakao'
  }

  if (normalizedPathname === '/oauth/google') {
    return 'google'
  }

  return null
}

export function normalizeOAuthCode(code) {
  const trimmedCode = typeof code === 'string' ? code.trim() : ''

  if (!trimmedCode) {
    return ''
  }

  try {
    return decodeURIComponent(trimmedCode)
  } catch {
    return trimmedCode
  }
}

export function exchangeSocialCode(provider, code) {
  const normalizedCode = normalizeOAuthCode(code)

  if (!normalizedCode) {
    throw new Error('로그인에 필요한 인증 코드를 찾지 못했습니다.')
  }

  const cacheKey = `${provider}:${normalizedCode}`
  const cachedPromise = socialCodeExchangePromises.get(cacheKey)

  if (cachedPromise) {
    return cachedPromise
  }

  const exchangePromise = postJson(
    `/api/v1/auth/${provider}`,
    { code: normalizedCode },
    `${getSocialLoginLabel(provider)} 로그인에 실패했습니다.`,
  )

  socialCodeExchangePromises.set(cacheKey, exchangePromise)
  window.setTimeout(() => {
    socialCodeExchangePromises.delete(cacheKey)
  }, SOCIAL_CODE_EXCHANGE_CACHE_TTL)

  return exchangePromise
}

export function createAuthSession(authResult, fallbackProfile = {}) {
  const sources = collectAuthSources(authResult)
  const responseHeaders = authResult?.__responseHeaders || {}
  const nestedUser =
    findFirstValue(sources, ['user', 'member', 'account', 'profile']) || {}

  return {
    token: normalizeTokenValue(
      findFirstValue(sources, [
        'accessToken',
        'access_token',
        'token',
        'jwt',
        'authorization',
        'accessTokenValue',
      ]) ||
        responseHeaders.authorization ||
        responseHeaders.Authorization ||
        null,
    ),
    refreshToken: normalizeTokenValue(
      findFirstValue(sources, [
        'refreshToken',
        'refresh_token',
        'refreshJwt',
        'refreshTokenValue',
      ]),
    ),
    grantType: findFirstValue(sources, ['grantType', 'tokenType']),
    accessTokenExpiredAt: findFirstValue(sources, [
      'accessTokenExpiredAt',
      'access_token_expires_at',
      'accessTokenExpiresAt',
    ]),
    refreshTokenExpiredAt: findFirstValue(sources, [
      'refreshTokenExpiredAt',
      'refresh_token_expires_at',
      'refreshTokenExpiresAt',
    ]),
    user: {
      email:
        nestedUser.email ||
        findFirstValue(sources, ['email', 'loginId', 'username']) ||
        fallbackProfile.email ||
        '',
      name: nestedUser.name || findFirstValue(sources, ['name']) || fallbackProfile.name || '',
      nickname:
        nestedUser.nickname ||
        findFirstValue(sources, ['nickname', 'nickName']) ||
        fallbackProfile.nickname ||
        '',
      birth:
        nestedUser.birth ||
        findFirstValue(sources, ['birth', 'birthday']) ||
        fallbackProfile.birth ||
        '',
      phone:
        nestedUser.phone ||
        findFirstValue(sources, ['phone', 'phoneNumber']) ||
        fallbackProfile.phone ||
        '',
    },
    raw: authResult,
    loggedInAt: new Date().toISOString(),
  }
}

export function getStoredAuthSession() {
  try {
    const storedValue = localStorage.getItem(AUTH_STORAGE_KEY)
    return storedValue ? JSON.parse(storedValue) : null
  } catch {
    return null
  }
}

export function persistAuthSession(session) {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
  } catch {
    // localStorage is optional for now.
  }
}

export function clearAuthSession() {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY)
  } catch {
    // localStorage is optional for now.
  }
}
