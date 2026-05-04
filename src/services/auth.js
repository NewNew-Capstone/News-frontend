const DEFAULT_API_BASE_URL = import.meta.env.DEV ? '' : 'http://54.180.92.239:8080'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(
  /\/$/,
  '',
)

const FALLBACK_APP_ORIGIN =
  typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'http://localhost:3000'

const APP_ORIGIN = (import.meta.env.VITE_APP_ORIGIN || FALLBACK_APP_ORIGIN).replace(
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

function createAuthHeaders(accessToken) {
  const normalizedToken = normalizeTokenValue(accessToken)
  const headers = {
    Accept: 'application/json',
  }

  if (normalizedToken) {
    headers.Authorization = `Bearer ${normalizedToken}`
    headers.AccessToken = normalizedToken
  }

  return headers
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

async function getJson(path, accessToken, fallbackErrorMessage) {
  try {
    const response = await fetch(buildUrl(path), {
      method: 'GET',
      headers: createAuthHeaders(accessToken),
    })

    const payload = await parseResponse(response)

    if (!response.ok) {
      const error = new Error(extractErrorMessage(payload) || fallbackErrorMessage)
      error.status = response.status
      throw error
    }

    return payload
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('프로필 정보를 불러오는 중 서버에 연결할 수 없습니다.')
    }

    throw error
  }
}

async function patchJson(path, body, accessToken, fallbackErrorMessage) {
  try {
    const response = await fetch(buildUrl(path), {
      method: 'PATCH',
      headers: {
        ...createAuthHeaders(accessToken),
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(body),
    })

    const payload = await parseResponse(response)

    if (!response.ok) {
      const error = new Error(extractErrorMessage(payload) || fallbackErrorMessage)
      error.status = response.status
      throw error
    }

    return payload
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('프로필 수정 중 서버에 연결할 수 없습니다.')
    }

    throw error
  }
}

async function deleteJson(path, accessToken, fallbackErrorMessage) {
  try {
    const response = await fetch(buildUrl(path), {
      method: 'DELETE',
      headers: createAuthHeaders(accessToken),
      credentials: 'include',
    })

    const payload = await parseResponse(response)

    if (!response.ok) {
      const error = new Error(extractErrorMessage(payload) || fallbackErrorMessage)
      error.status = response.status
      throw error
    }

    return payload
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('회원 탈퇴 처리 중 서버에 연결할 수 없습니다.')
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

function extractResponseBody(payload) {
  if (!payload || typeof payload !== 'object') {
    return payload
  }

  if ('body' in payload) {
    return payload.body
  }

  if ('data' in payload) {
    return payload.data
  }

  if ('result' in payload) {
    return payload.result
  }

  return payload
}

function normalizeUserProfile(source, fallbackProfile = {}) {
  const sources = collectAuthSources(source)
  const responseBody = extractResponseBody(source)
  const nestedUser =
    findFirstValue(sources, ['user', 'member', 'account', 'profile']) || responseBody || {}

  return {
    userId:
      nestedUser.userId ||
      nestedUser.id ||
      findFirstValue(sources, ['userId', 'memberId', 'id']) ||
      fallbackProfile.userId ||
      null,
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
    profileImageKey:
      nestedUser.profileImageKey ||
      nestedUser.profileImageUrl ||
      findFirstValue(sources, ['profileImageKey', 'profileImageUrl', 'imageUrl']) ||
      fallbackProfile.profileImageKey ||
      null,
  }
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

export function getAccessToken() {
  return normalizeTokenValue(getStoredAuthSession()?.token || null)
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
    user: normalizeUserProfile(authResult, fallbackProfile),
    raw: authResult,
    loggedInAt: new Date().toISOString(),
  }
}

export async function fetchMyProfile(accessToken = getAccessToken()) {
  const token = normalizeTokenValue(accessToken)

  if (!token) {
    throw new Error('프로필 정보를 불러오려면 다시 로그인해 주세요.')
  }

  const payload = await getJson(
    '/api/v1/users/me',
    token,
    '프로필 정보를 불러오지 못했습니다.',
  )

  return normalizeUserProfile(payload)
}

export async function updateMyProfile(profileInput, accessToken = getAccessToken()) {
  const token = normalizeTokenValue(accessToken)

  if (!token) {
    throw new Error('프로필을 수정하려면 다시 로그인해 주세요.')
  }

  const payload = await patchJson(
    '/api/v1/users/me',
    profileInput,
    token,
    '프로필 수정에 실패했습니다.',
  )

  return normalizeUserProfile(payload)
}

export async function deleteMyAccount(accessToken = getAccessToken()) {
  const token = normalizeTokenValue(accessToken)

  if (!token) {
    throw new Error('회원 탈퇴를 진행하려면 다시 로그인해 주세요.')
  }

  return deleteJson('/api/v1/users/me', token, '회원 탈퇴 처리에 실패했습니다.')
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
