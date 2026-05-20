import { getStoredAuthSession } from './auth'

const DEFAULT_API_BASE_URL = import.meta.env.DEV ? '' : 'http://localhost:8080'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(
  /\/$/,
  '',
)

const TRENDING_KEYWORDS_PATH = import.meta.env.VITE_YOUTUBE_TRENDING_KEYWORDS_PATH?.trim() || ''

const NEWS_POLITICS_KEYWORD_HINTS = [
  '뉴스',
  '속보',
  '정치',
  '국회',
  '대통령',
  '정부',
  '여당',
  '야당',
  '선거',
  '대선',
  '총선',
  '정당',
  '민주당',
  '국민의힘',
  '외교',
  '안보',
  '북한',
  '남북',
  '중국',
  '미국',
  '일본',
  '러시아',
  '전쟁',
  '우크라이나',
  '이스라엘',
  '검찰',
  '법원',
  '헌재',
  '탄핵',
  '장관',
  '의원',
  '국정',
  '정책',
  '브리핑',
  '기자회견',
]

const NEWS_POLITICS_CATEGORY_HINTS = ['news', 'politic', '정치', '뉴스']

function buildUrl(path, query = {}) {
  const queryString = new URLSearchParams(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  ).toString()

  const url = API_BASE_URL ? `${API_BASE_URL}${path}` : path

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
    payload.status?.message ||
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

async function requestJson(path, { query, accessToken, fallbackErrorMessage }) {
  try {
    const response = await fetch(buildUrl(path, query), {
      method: 'GET',
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
      throw new Error('영상 데이터를 불러오지 못했습니다. 서버 연결 상태를 확인해 주세요.')
    }

    throw error
  }
}

function getAccessToken(accessToken) {
  if (accessToken) {
    return accessToken
  }

  const storedSession = getStoredAuthSession()

  return storedSession?.token || null
}

export function normalizeVideoItems(payload) {
  const extractedItems = extractVideoItems(payload)
  const uniqueItems = []
  const seenKeys = new Set()

  extractedItems.forEach((item, index) => {
    const key =
      item.youtubeVideoId ||
      item.videoId ||
      item.originalUrl ||
      item.url ||
      `${item.title || item.videoTitle || 'video'}-${index}`

    if (!seenKeys.has(key)) {
      seenKeys.add(key)
      uniqueItems.push(item)
    }
  })

  return uniqueItems
}

function isVideoLike(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const videoKeys = [
    'youtubeVideoId',
    'videoId',
    'title',
    'videoTitle',
    'thumbnailUrl',
    'thumbnail',
    'channelName',
    'channelTitle',
    'publishedAt',
    'publishedDate',
    'originalUrl',
    'url',
  ]

  return videoKeys.some((key) => key in value)
}

function extractVideoItems(value) {
  if (!value) {
    return []
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => extractVideoItems(item))
  }

  if (typeof value !== 'object') {
    return []
  }

  if (isVideoLike(value)) {
    return [value]
  }

  const prioritizedKeys = [
    'body',
    'data',
    'result',
    'content',
    'items',
    'videos',
    'videoList',
    'youtubeVideos',
    'results',
    'list',
    'records',
  ]

  for (const key of prioritizedKeys) {
    if (key in value) {
      const nestedItems = extractVideoItems(value[key])

      if (nestedItems.length) {
        return nestedItems
      }
    }
  }

  return Object.values(value).flatMap((nestedValue) => extractVideoItems(nestedValue))
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

function normalizeCommentItems(payload) {
  const responseBody = extractResponseBody(payload)

  if (Array.isArray(responseBody)) {
    return responseBody
  }

  if (responseBody?.content && Array.isArray(responseBody.content)) {
    return responseBody.content
  }

  if (responseBody?.comments && Array.isArray(responseBody.comments)) {
    return responseBody.comments
  }

  return []
}

function normalizeTranscript(payload) {
  const responseBody = extractResponseBody(payload)

  if (responseBody && typeof responseBody === 'object' && !Array.isArray(responseBody)) {
    return responseBody
  }

  return null
}

function getKeywordText(value) {
  if (typeof value === 'string') {
    return value
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return ''
  }

  return (
    value.keyword ||
    value.searchKeyword ||
    value.query ||
    value.title ||
    value.name ||
    value.text ||
    value.value ||
    ''
  )
}

function getKeywordCategory(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return ''
  }

  return [value.category, value.topic, value.type, value.group, value.section, value.kind]
    .filter(Boolean)
    .join(' ')
}

function extractKeywordEntries(value) {
  if (!value) {
    return []
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => extractKeywordEntries(item))
  }

  const keyword = getKeywordText(value).trim()

  if (keyword) {
    return [
      {
        keyword,
        category: getKeywordCategory(value),
      },
    ]
  }

  if (typeof value !== 'object') {
    return []
  }

  const prioritizedKeys = [
    'body',
    'data',
    'result',
    'content',
    'keywords',
    'popularKeywords',
    'trendingKeywords',
    'items',
    'results',
    'list',
    'records',
  ]

  for (const key of prioritizedKeys) {
    if (key in value) {
      const nestedEntries = extractKeywordEntries(value[key])

      if (nestedEntries.length) {
        return nestedEntries
      }
    }
  }

  return Object.values(value).flatMap((nestedValue) => extractKeywordEntries(nestedValue))
}

function isNewsPoliticsKeyword(entry) {
  const keyword = entry.keyword.toLowerCase()
  const category = entry.category.toLowerCase()

  return (
    NEWS_POLITICS_CATEGORY_HINTS.some((hint) => category.includes(hint)) ||
    NEWS_POLITICS_KEYWORD_HINTS.some((hint) => keyword.includes(hint.toLowerCase()))
  )
}

function normalizeNewsPoliticsKeywords(payload, limit) {
  const fallbackKeywords = []
  const uniqueKeywords = []
  const seenFallbackKeywords = new Set()
  const seenKeywords = new Set()

  extractKeywordEntries(payload).forEach((entry) => {
    const normalizedKeyword = entry.keyword.replace(/\s+/g, ' ').trim()
    const seenKey = normalizedKeyword.toLowerCase()

    if (!seenFallbackKeywords.has(seenKey)) {
      seenFallbackKeywords.add(seenKey)
      fallbackKeywords.push(normalizedKeyword)
    }

    if (isNewsPoliticsKeyword(entry) && !seenKeywords.has(seenKey)) {
      seenKeywords.add(seenKey)
      uniqueKeywords.push(normalizedKeyword)
    }
  })

  return (uniqueKeywords.length ? uniqueKeywords : fallbackKeywords).slice(0, limit)
}

export async function fetchNewsPoliticsTrendingKeywords({ accessToken, limit = 3 } = {}) {
  if (!TRENDING_KEYWORDS_PATH) {
    return []
  }

  const token = getAccessToken(accessToken)

  const payload = await requestJson(TRENDING_KEYWORDS_PATH, {
    accessToken: token,
    query: {
      category: 'news_politics',
      limit,
    },
    fallbackErrorMessage: '실시간 인기 키워드를 불러오지 못했습니다.',
  })

  return normalizeNewsPoliticsKeywords(payload, limit)
}

export async function fetchYoutubeSearchResults(
  keyword,
  { accessToken, sort = 'relevant', page = 1, size = 12 } = {},
) {
  const trimmedKeyword = keyword.trim()

  if (!trimmedKeyword) {
    return []
  }

  const token = getAccessToken(accessToken)

  if (!token) {
    throw new Error('검색을 위해 다시 로그인해 주세요.')
  }

  const payload = await requestJson('/api/v1/youtube/search', {
    accessToken: token,
    query: {
      keyword: trimmedKeyword,
      sort,
      page,
      size,
    },
    fallbackErrorMessage: '검색 결과를 불러오지 못했습니다.',
  })

  return normalizeVideoItems(payload)
}

export async function fetchRecommendedChannelVideos(accessToken) {
  const token = getAccessToken(accessToken)

  if (!token) {
    throw new Error('추천 영상을 불러오려면 다시 로그인해 주세요.')
  }

  const payload = await requestJson('/api/v1/youtube/channels/videos', {
    accessToken: token,
    fallbackErrorMessage: '추천 영상을 불러오지 못했습니다.',
  })

  return normalizeVideoItems(payload)
}

export async function fetchYoutubeVideoDetail(youtubeVideoId, accessToken) {
  const token = getAccessToken(accessToken)

  if (!token) {
    throw new Error('영상 정보를 불러오려면 다시 로그인해 주세요.')
  }

  const payload = await requestJson(`/api/v1/youtube/${encodeURIComponent(youtubeVideoId)}`, {
    accessToken: token,
    fallbackErrorMessage: '영상 상세 정보를 불러오지 못했습니다.',
  })

  return normalizeVideoItems(payload)[0] || null
}

export async function fetchYoutubeComments(youtubeVideoId, accessToken) {
  const token = getAccessToken(accessToken)

  if (!token) {
    throw new Error('댓글을 불러오려면 다시 로그인해 주세요.')
  }

  const payload = await requestJson(`/api/v1/youtube/${encodeURIComponent(youtubeVideoId)}/comments`, {
    accessToken: token,
    fallbackErrorMessage: '댓글을 불러오지 못했습니다.',
  })

  return normalizeCommentItems(payload)
}

export async function fetchYoutubeTranscript(youtubeVideoId, accessToken) {
  const token = getAccessToken(accessToken)

  if (!token) {
    throw new Error('자막을 불러오려면 다시 로그인해 주세요.')
  }

  const payload = await requestJson(
    `/api/v1/youtube/${encodeURIComponent(youtubeVideoId)}/transcript`,
    {
      accessToken: token,
      fallbackErrorMessage: '자막을 불러오지 못했습니다.',
    },
  )

  return normalizeTranscript(payload)
}
