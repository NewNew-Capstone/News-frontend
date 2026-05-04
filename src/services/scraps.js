import { getAccessToken } from './auth'

const DEFAULT_API_BASE_URL = import.meta.env.DEV ? '' : 'http://localhost:8080'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(
  /\/$/,
  '',
)

function buildUrl(path) {
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path
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

async function requestJson(
  path,
  { method = 'GET', accessToken = getAccessToken(), body, fallbackErrorMessage },
) {
  if (!accessToken) {
    throw new Error('스크랩 기능을 사용하려면 다시 로그인해 주세요.')
  }

  try {
    const response = await fetch(buildUrl(path), {
      method,
      headers: {
        ...createAuthHeaders(accessToken),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
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
      throw new Error('스크랩 요청 중 서버에 연결할 수 없습니다.')
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

function normalizeScrapItem(item, index) {
  if (!item || typeof item !== 'object') {
    return null
  }

  return {
    id: item.scrapId || item.videoId || item.youtubeVideoId || `${index}`,
    scrapId: item.scrapId || null,
    videoId: item.videoId || null,
    targetType: item.targetType || '',
    youtubeVideoId: item.youtubeVideoId || '',
    title: item.title || '제목 정보 없음',
    thumbnailUrl: item.thumbnailUrl || '',
    channelName: item.channelName || '채널 정보 없음',
    originalUrl: item.originalUrl || '',
    viewCount: item.viewCount ?? null,
    publishedAt: item.publishedAt || '',
    scrapCreatedAt: item.scrapCreatedAt || '',
  }
}

export function createScrapLookup(scrapItems) {
  return (Array.isArray(scrapItems) ? scrapItems : []).reduce((lookup, item) => {
    if (item?.youtubeVideoId) {
      lookup[item.youtubeVideoId] = item
    }

    return lookup
  }, {})
}

export async function fetchScrapVideos(accessToken = getAccessToken()) {
  try {
    const payload = await requestJson('/api/v1/scraps', {
      method: 'GET',
      accessToken,
      fallbackErrorMessage: '스크랩 영상을 불러오지 못했습니다.',
    })
    const responseBody = extractResponseBody(payload)
    const items = Array.isArray(responseBody) ? responseBody : []

    return items
      .map((item, index) => normalizeScrapItem(item, index))
      .filter(Boolean)
      .sort((left, right) => {
        const leftTime = Date.parse(left.scrapCreatedAt || '') || 0
        const rightTime = Date.parse(right.scrapCreatedAt || '') || 0

        return rightTime - leftTime
      })
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('스크랩 영상을 불러오는 중 서버에 연결할 수 없습니다.')
    }

    throw error
  }
}

export async function saveScrapVideo(youtubeVideoId, accessToken = getAccessToken()) {
  const normalizedYoutubeVideoId =
    typeof youtubeVideoId === 'string' ? youtubeVideoId.trim() : String(youtubeVideoId || '').trim()

  if (!normalizedYoutubeVideoId) {
    throw new Error('스크랩할 영상 정보가 없습니다.')
  }

  await requestJson('/api/v1/scraps', {
    method: 'POST',
    accessToken,
    body: {
      youtubeVideoId: normalizedYoutubeVideoId,
    },
    fallbackErrorMessage: '스크랩 저장에 실패했습니다.',
  })
}

export async function deleteScrapVideo(scrapId, accessToken = getAccessToken()) {
  const normalizedScrapId = String(scrapId ?? '').trim()

  if (!normalizedScrapId) {
    throw new Error('해제할 스크랩 정보가 없습니다.')
  }

  await requestJson(`/api/v1/scraps/${encodeURIComponent(normalizedScrapId)}`, {
    method: 'DELETE',
    accessToken,
    fallbackErrorMessage: '스크랩 해제에 실패했습니다.',
  })
}
