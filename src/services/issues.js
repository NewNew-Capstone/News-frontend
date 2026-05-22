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

  const statusCode = payload.status?.statusCode || payload.status?.code || payload.code || ''

  if (statusCode === 'IS006') {
    return '현재 영상 분석이 아직 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.'
  }

  if (statusCode === 'IS007') {
    return '같은 이슈 묶음에서 반대 관점 영상을 찾을 수 없습니다.'
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
      error.statusCode = payload?.status?.statusCode || payload?.status?.code || ''
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

function normalizeIssueScore(value) {
  const numericValue = Number(value)

  return Number.isFinite(numericValue) ? numericValue : null
}

function normalizeOpposingVideo(body = {}) {
  return {
    youtubeVideoId: body.youtubeVideoId || body.youtube_video_id || '',
    title: body.title || '',
    channelName: body.channelName || body.channel_name || '',
    thumbnailUrl: body.thumbnailUrl || body.thumbnail_url || body.thumbnail || body.imageUrl || body.image_url || '',
    summaryText: body.summaryText || body.summary_text || '',
    opinionScore: normalizeIssueScore(body.opinionScore ?? body.opinion_score),
    emotionScore: normalizeIssueScore(body.emotionScore ?? body.emotion_score),
    factRatio: normalizeIssueScore(body.factRatio ?? body.fact_ratio),
    headlineBodyGapScore: normalizeIssueScore(body.headlineBodyGapScore ?? body.headline_body_gap_score),
    emotionExpressionCount: normalizeIssueScore(
      body.emotionExpressionCount ?? body.emotion_expression_count ?? body.emotion_count,
    ),
    emotionSentenceCount: normalizeIssueScore(
      body.emotionSentenceCount ?? body.emotion_sentence_count ?? body.emotion_detected_sentence_count,
    ),
    overallBiasScore: normalizeIssueScore(body.overallBiasScore ?? body.overall_bias_score),
    opinionGap: normalizeIssueScore(body.opinionGap ?? body.opinion_gap),
    scoreReasonSummary: body.scoreReasonSummary || body.score_reason_summary || '',
    scoreEvidence: body.scoreEvidence || body.score_evidence || '',
    analysisKeywords: Array.isArray(body.analysisKeywords ?? body.analysis_keywords)
      ? body.analysisKeywords ?? body.analysis_keywords
      : [],
  }
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

export async function fetchOpposingIssueVideo(videoId, accessToken) {
  const token = getAccessToken(accessToken)

  if (!token) {
    throw new Error('반대 영상 분석 결과를 보려면 다시 로그인해 주세요.')
  }

  const normalizedVideoId = typeof videoId === 'string' ? videoId.trim() : String(videoId || '').trim()

  if (!normalizedVideoId) {
    throw new Error('반대 영상 분석 결과를 조회할 영상 ID가 없습니다.')
  }

  const payload = await requestJson('/api/v1/issues/opposing', {
    accessToken: token,
    query: {
      videoId: normalizedVideoId,
    },
    fallbackErrorMessage: '반대 영상 분석 결과를 불러오지 못했습니다.',
  })

  const statusCode = payload?.status?.statusCode || payload?.status?.code || ''

  if (statusCode && statusCode !== 'C000') {
    const error = new Error(payload?.status?.message || '반대 영상 분석 결과를 불러오지 못했습니다.')
    error.statusCode = statusCode
    throw error
  }

  return normalizeOpposingVideo(extractResponseBody(payload) || {})
}
