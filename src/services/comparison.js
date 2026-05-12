import { getStoredAuthSession } from './auth'
import { normalizeYoutubeVideoId } from '../utils/youtubeVideo'

const DEFAULT_API_BASE_URL = import.meta.env.DEV ? '' : 'http://localhost:8080'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(
  /\/$/,
  '',
)

export const COMPARISON_COUNTRIES = [
  { code: 'KR', label: 'Korea', localLabel: '한국' },
  { code: 'US', label: 'United States', localLabel: '미국' },
  { code: 'CN', label: 'China', localLabel: '중국' },
]

const COUNTRY_LOOKUP = new Map(COMPARISON_COUNTRIES.map((country) => [country.code, country]))

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

  return getStoredAuthSession()?.token || ''
}

async function requestJson(path, { query, accessToken, fallbackErrorMessage }) {
  const response = await fetch(buildUrl(path, query), {
    method: 'GET',
    headers: createAuthHeaders(getAccessToken(accessToken)),
  })

  const payload = await parseResponse(response)

  if (!response.ok) {
    const error = new Error(extractErrorMessage(payload) || fallbackErrorMessage)
    error.status = response.status
    throw error
  }

  return payload
}

async function requestJsonCandidates(paths, options) {
  let lastError = null

  for (const path of paths) {
    try {
      return await requestJson(path, options)
    } catch (error) {
      lastError = error
    }
  }

  if (lastError instanceof TypeError) {
    throw new Error('국가별 비교 데이터를 불러오지 못했습니다. 서버 연결 상태를 확인해 주세요.')
  }

  throw lastError || new Error(options.fallbackErrorMessage)
}

function extractBody(payload) {
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

function pickFirst(source, keys, fallback = '') {
  for (const key of keys) {
    const value = source?.[key]

    if (value !== undefined && value !== null && value !== '') {
      return value
    }
  }

  return fallback
}

function normalizeCountryCode(value) {
  const rawValue = String(value || '').trim()
  const normalizedValue = rawValue.toLowerCase()

  if (['kr', 'kor', 'ko', 'korea', 'south korea'].includes(normalizedValue) || rawValue.includes('한국')) {
    return 'KR'
  }

  if (['us', 'usa', 'u.s.', 'united states', 'america', 'en'].includes(normalizedValue) || rawValue.includes('미국')) {
    return 'US'
  }

  if (['cn', 'chn', 'zh', 'china', 'chinese'].includes(normalizedValue) || rawValue.includes('중국')) {
    return 'CN'
  }

  return rawValue.toUpperCase()
}

function toArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

function formatDate(value) {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}.${month}.${day}`
}

function normalizeVideoId(source) {
  const rawVideoId = pickFirst(source, [
    'video_id',
    'videoId',
    'youtubeVideoId',
    'youtube_video_id',
    'id',
    'url',
    'originalUrl',
  ])

  return normalizeYoutubeVideoId(rawVideoId) || String(rawVideoId || '').trim()
}

export function normalizeComparisonVideo(video, index = 0) {
  const videoId = normalizeVideoId(video)
  const countryCode = normalizeCountryCode(
    pickFirst(video, ['country_code', 'countryCode', 'country', 'countryName', 'nation'], 'KR'),
  )
  const country = COUNTRY_LOOKUP.get(countryCode)

  return {
    id: pickFirst(video, ['id', 'node_id', 'nodeId'], videoId || `comparison-video-${index + 1}`),
    videoId,
    title: pickFirst(video, ['title', 'videoTitle', 'name'], '영상 제목 정보가 없습니다.'),
    thumbnailUrl: pickFirst(video, ['thumbnail_url', 'thumbnailUrl', 'thumbnail', 'imageUrl', 'thumbUrl']),
    channelName: pickFirst(video, ['channel_name', 'channelName', 'channelTitle', 'channel'], '채널 정보 없음'),
    viewCount: pickFirst(video, ['view_count', 'viewCount', 'views'], null),
    publishedAt: pickFirst(video, ['published_at', 'publishedAt', 'publishedDate', 'uploadDate']),
    publishedLabel: formatDate(pickFirst(video, ['published_at', 'publishedAt', 'publishedDate', 'uploadDate'])),
    countryCode,
    countryName: country?.label || countryCode || 'Unknown',
    countryLocalLabel: country?.localLabel || countryCode || '기타',
    language: pickFirst(video, ['language', 'languageLabel', 'lang'], ''),
    analysisStatus: pickFirst(video, ['analysis_status', 'analysisStatus', 'status'], ''),
    nodeType: pickFirst(video, ['node_type', 'nodeType'], ''),
  }
}

function normalizeIssueKeywords(body) {
  const candidates =
    body?.issue_keywords ||
    body?.issueKeywords ||
    body?.today_issues ||
    body?.todayIssues ||
    body?.keywords ||
    []

  return toArray(candidates)
    .map((keyword) => {
      if (typeof keyword === 'string') {
        return keyword
      }

      return keyword.keyword || keyword.keyword_text || keyword.text || keyword.name || ''
    })
    .filter(Boolean)
    .slice(0, 5)
}

function normalizeSectionsFromObject(sectionsLike) {
  if (!sectionsLike || typeof sectionsLike !== 'object' || Array.isArray(sectionsLike)) {
    return []
  }

  return Object.entries(sectionsLike).map(([countryCode, videos]) => ({
    country_code: countryCode,
    videos,
  }))
}

export function normalizeComparisonSections(body) {
  const rawSections =
    toArray(body?.sections).length
      ? body.sections
      : normalizeSectionsFromObject(body?.sections || body?.country_sections || body?.countrySections)

  const fallbackVideos = toArray(body?.videos)
  const groupedSections = new Map(
    COMPARISON_COUNTRIES.map((country) => [
      country.code,
      {
        id: `country-${country.code}`,
        countryCode: country.code,
        countryName: country.label,
        countryLocalLabel: country.localLabel,
        videos: [],
      },
    ]),
  )

  const sourceSections = rawSections.length
    ? rawSections
    : fallbackVideos.reduce((sections, video) => {
        const countryCode = normalizeCountryCode(
          pickFirst(video, ['country_code', 'countryCode', 'country', 'countryName', 'nation'], 'KR'),
        )
        const section = sections.get(countryCode) || { country_code: countryCode, videos: [] }

        section.videos.push(video)
        sections.set(countryCode, section)

        return sections
      }, new Map()).values()

  Array.from(sourceSections).forEach((section, sectionIndex) => {
    const countryCode = normalizeCountryCode(
      pickFirst(section, ['country_code', 'countryCode', 'country', 'code'], COMPARISON_COUNTRIES[sectionIndex]?.code || ''),
    )
    const country = COUNTRY_LOOKUP.get(countryCode)
    const videos = toArray(section.videos || section.items || section.results).map((video, index) =>
      normalizeComparisonVideo(
        {
          ...video,
          country_code: pickFirst(video, ['country_code', 'countryCode', 'country'], countryCode),
        },
        index,
      ),
    )

    if (!groupedSections.has(countryCode)) {
      groupedSections.set(countryCode, {
        id: `country-${countryCode}`,
        countryCode,
        countryName: country?.label || countryCode,
        countryLocalLabel: country?.localLabel || countryCode,
        videos: [],
      })
    }

    groupedSections.get(countryCode).videos = videos.slice(0, 5)
  })

  return COMPARISON_COUNTRIES.map((country) => groupedSections.get(country.code))
}

export function normalizeComparisonHome(payload) {
  const body = extractBody(payload) || {}

  return {
    issueKeywords: normalizeIssueKeywords(body),
    sections: normalizeComparisonSections(body),
  }
}

export async function fetchComparisonHome({ limit = 5, accessToken } = {}) {
  const payload = await requestJsonCandidates(
    ['/api/comparison/home', '/kg/comparison-home'],
    {
      query: { limit },
      accessToken,
      fallbackErrorMessage: '국가별 비교 홈 데이터를 불러오지 못했습니다.',
    },
  )

  return normalizeComparisonHome(payload)
}

export async function searchComparisonVideos({ keyword, limit = 5, accessToken } = {}) {
  const payload = await requestJsonCandidates(
    ['/api/comparison/search', '/kg/search-videos'],
    {
      query: { keyword, limit },
      accessToken,
      fallbackErrorMessage: '국가별 비교 검색 결과를 불러오지 못했습니다.',
    },
  )

  const body = extractBody(payload) || {}

  return {
    searchKeyword: body.searchKeyword || body.search_keyword || keyword,
    sections: normalizeComparisonSections(body),
  }
}

function normalizeGraphNode(node, index = 0) {
  const normalizedVideo = normalizeComparisonVideo(node, index)

  return {
    ...normalizedVideo,
    id: String(pickFirst(node, ['id', 'node_id', 'nodeId'], normalizedVideo.videoId || `node-${index + 1}`)),
    nodeType: pickFirst(node, ['node_type', 'nodeType'], normalizedVideo.nodeType || 'related'),
  }
}

function normalizeGraphEdge(edge, index = 0) {
  return {
    id: String(pickFirst(edge, ['id', 'edge_id', 'edgeId'], `edge-${index + 1}`)),
    source: String(pickFirst(edge, ['source', 'source_id', 'sourceId'])),
    target: String(pickFirst(edge, ['target', 'target_id', 'targetId'])),
    relationType: pickFirst(edge, ['relation_type', 'relationType', 'type'], 'RELATED'),
    keywords: toArray(edge.keywords || edge.shared_keywords || edge.sharedKeywords),
    reasons: toArray(edge.reasons || edge.connection_reasons || edge.connectionReasons),
    sharedEntities: toArray(edge.shared_entities || edge.sharedEntities),
    sameIssueCluster: pickFirst(edge, ['same_issue_cluster', 'sameIssueCluster', 'cluster', 'cluster_name', 'clusterName']),
    weight: Number(edge.weight ?? edge.score ?? 0),
  }
}

function normalizePerspectiveItems(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean)
  }

  if (!value || typeof value !== 'object') {
    return []
  }

  return Object.entries(value).map(([countryCode, summary]) => ({
    countryCode: normalizeCountryCode(countryCode),
    summary,
  }))
}

export function normalizeComparisonGraph(payload, selectedVideoId = '') {
  const body = extractBody(payload) || {}
  const selectedVideo = normalizeGraphNode(
    body.selected_video || body.selectedVideo || body.video || { video_id: selectedVideoId, node_type: 'selected' },
  )
  const rawNodes = toArray(body.nodes)
  const normalizedNodes = rawNodes.map((node, index) => normalizeGraphNode(node, index))
  const hasSelectedNode = normalizedNodes.some(
    (node) => node.id === selectedVideo.id || node.videoId === selectedVideo.videoId,
  )
  const nodes = hasSelectedNode
    ? normalizedNodes.map((node) =>
        node.id === selectedVideo.id || node.videoId === selectedVideo.videoId
          ? { ...selectedVideo, ...node, nodeType: 'selected' }
          : node,
      )
    : [{ ...selectedVideo, nodeType: 'selected' }, ...normalizedNodes]

  return {
    selectedVideo: { ...selectedVideo, nodeType: 'selected' },
    mainKeywords: toArray(body.main_keywords || body.mainKeywords || body.keywords),
    nodes,
    edges: toArray(body.edges).map((edge, index) => normalizeGraphEdge(edge, index)),
    connectionReasons: toArray(body.connection_reasons || body.connectionReasons),
    countryPerspectives: normalizePerspectiveItems(body.country_perspectives || body.countryPerspectives),
    sharedKeywords: toArray(body.shared_keywords || body.sharedKeywords),
    sharedEntities: toArray(body.shared_entities || body.sharedEntities),
    clusterInfo: body.cluster_info || body.clusterInfo || body.same_issue_cluster || body.sameIssueCluster || null,
  }
}

export async function fetchComparisonGraph({ videoId, accessToken } = {}) {
  const encodedVideoId = encodeURIComponent(videoId || '')
  const payload = await requestJsonCandidates(
    [`/api/comparison/videos/${encodedVideoId}/graph`, `/kg/videos/${encodedVideoId}/comparison-graph`],
    {
      accessToken,
      fallbackErrorMessage: '국가별 비교 그래프를 불러오지 못했습니다.',
    },
  )

  return normalizeComparisonGraph(payload, videoId)
}
