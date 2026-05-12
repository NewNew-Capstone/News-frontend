import { getStoredAuthSession } from './auth'

const DEFAULT_API_BASE_URL = import.meta.env.DEV ? '' : 'http://localhost:8080'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(
  /\/$/,
  '',
)

function buildUrl(path, query = {}) {
  const searchParams = new URLSearchParams()

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return
    }

    searchParams.set(key, Array.isArray(value) ? value.join(',') : String(value))
  })

  const url = API_BASE_URL ? `${API_BASE_URL}${path}` : path
  const queryString = searchParams.toString()

  return queryString ? `${url}?${queryString}` : url
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
    payload.description ||
    payload.message ||
    payload.error ||
    payload.detail ||
    payload.data?.message ||
    payload.data?.error ||
    ''
  )
}

function createAuthHeaders(accessToken) {
  const headers = {
    Accept: 'application/json',
  }

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
    headers.AccessToken = accessToken
  }

  return headers
}

function getAccessToken(accessToken) {
  if (accessToken) {
    return accessToken
  }

  return getStoredAuthSession()?.token || null
}

async function requestJson(path, { query, accessToken, fallbackErrorMessage }) {
  try {
    const response = await fetch(buildUrl(path, query), {
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
      throw new Error('국가별 비교 데이터를 불러오지 못했습니다. 서버 연결 상태를 확인해 주세요.')
    }

    throw error
  }
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

function normalizeIssueResults(results) {
  return Array.isArray(results) ? results.filter((item) => item && typeof item === 'object') : []
}

export async function fetchIssueSearchResults({ searchKeyword }, accessToken) {
  const token = getAccessToken(accessToken)

  if (!token) {
    throw new Error('국가별 비교를 이용하려면 다시 로그인해 주세요.')
  }

  const trimmedKeyword = typeof searchKeyword === 'string' ? searchKeyword.trim() : ''

  if (!trimmedKeyword) {
    return {
      searchKeyword: '',
      clusterTitle: '',
      clusterSummary: '',
      results: [],
    }
  }

  const payload = await requestJson('/api/v1/issues/search', {
    accessToken: token,
    query: {
      searchKeyword: trimmedKeyword,
    },
    fallbackErrorMessage: '국가별 이슈 영상을 불러오지 못했습니다.',
  })

  const body = extractResponseBody(payload) || {}

  return {
    searchKeyword: body.searchKeyword || trimmedKeyword,
    clusterTitle: body.clusterTitle || '',
    clusterSummary: body.clusterSummary || '',
    results: normalizeIssueResults(body.results),
  }
}

export async function fetchIssueComparison(countryVideos, accessToken) {
  const token = getAccessToken(accessToken)

  if (!token) {
    throw new Error('국가별 비교 결과를 보려면 다시 로그인해 주세요.')
  }

  const query = Object.fromEntries(
    Object.entries(countryVideos || {}).filter(([, value]) => typeof value === 'string' && value.trim()),
  )

  if (!Object.keys(query).length) {
    return {
      searchKeyword: '',
      countries: [],
    }
  }

  const payload = await requestJson('/api/v1/issues/comparison', {
    accessToken: token,
    query,
    fallbackErrorMessage: '국가별 대표 영상 비교 결과를 불러오지 못했습니다.',
  })

  const body = extractResponseBody(payload) || {}

  return {
    searchKeyword: body.searchKeyword || '',
    countries: normalizeIssueResults(body.countries),
  }
}
