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

const DEFAULT_COUNTRY_VIDEO_LIMIT = 3
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

async function requestJson(path, { query, accessToken, fallbackErrorMessage, method = 'GET', body } = {}) {
  const headers = createAuthHeaders(getAccessToken(accessToken))

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
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

  if (
    ['kr', 'kor', 'ko', 'korea', 'south korea', 'republic of korea', '대한민국'].includes(normalizedValue) ||
    rawValue.includes('한국') ||
    rawValue.includes('대한민국')
  ) {
    return 'KR'
  }

  if (
    ['us', 'usa', 'u.s.', 'u.s.a.', 'united states', 'united states of america', 'america', 'en'].includes(normalizedValue) ||
    rawValue.includes('미국')
  ) {
    return 'US'
  }

  if (
    ['cn', 'chn', 'zh', 'china', 'chinese', "people's republic of china", 'prc'].includes(normalizedValue) ||
    rawValue.includes('중국')
  ) {
    return 'CN'
  }

  return rawValue.toUpperCase()
}

function toArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

function normalizeFocusKeyword(keyword) {
  if (typeof keyword === 'string') {
    return {
      keywordText: keyword,
      score: null,
      occurrenceCount: null,
      sentenceCount: null,
    }
  }

  if (!keyword || typeof keyword !== 'object') {
    return null
  }

  return {
    keywordText:
      keyword.keyword_text ||
      keyword.keywordText ||
      keyword.keyword ||
      keyword.text ||
      keyword.name ||
      '',
    score: Number(keyword.score),
    occurrenceCount: Number(keyword.occurrence_count ?? keyword.occurrenceCount),
    sentenceCount: Number(keyword.sentence_count ?? keyword.sentenceCount),
  }
}

function normalizeDisplayKeyword(keyword) {
  if (typeof keyword === 'string') {
    return {
      keywordText: keyword,
      keywordType: '',
      score: null,
    }
  }

  if (!keyword || typeof keyword !== 'object') {
    return null
  }

  return {
    keywordText: keyword.keyword_text || keyword.keywordText || keyword.keyword || keyword.text || keyword.name || '',
    keywordType: keyword.keyword_type || keyword.keywordType || '',
    score: Number(keyword.score),
  }
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

function isShortFormVideo(video) {
  const durationSeconds = Number(video?.duration_seconds ?? video?.durationSeconds ?? video?.duration)

  return Number.isFinite(durationSeconds) && durationSeconds > 0 && durationSeconds <= 60
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
    originalUrl: pickFirst(video, ['original_url', 'originalUrl', 'url'], videoId ? `https://www.youtube.com/watch?v=${videoId}` : ''),
    thumbnailUrl: pickFirst(video, ['thumbnail_url', 'thumbnailUrl', 'thumbnail', 'imageUrl', 'thumbUrl']),
    channelName: pickFirst(video, ['channel_name', 'channelName', 'channelTitle', 'channel'], '채널 정보 없음'),
    viewCount: pickFirst(video, ['view_count', 'viewCount', 'views'], null),
    durationSeconds: pickFirst(video, ['duration_seconds', 'durationSeconds', 'duration'], null),
    publishedAt: pickFirst(video, ['published_at', 'publishedAt', 'publishedDate', 'uploadDate']),
    publishedLabel: formatDate(pickFirst(video, ['published_at', 'publishedAt', 'publishedDate', 'uploadDate'])),
    countryCode,
    countryName: country?.label || countryCode || 'Unknown',
    countryLocalLabel: country?.localLabel || countryCode || '기타',
    language: pickFirst(video, ['language', 'languageLabel', 'lang', 'defaultLanguageCode', 'default_language_code'], ''),
    analysisStatus: pickFirst(video, ['analysis_status', 'analysisStatus', 'status'], ''),
    nodeType: pickFirst(video, ['node_type', 'nodeType'], ''),
    relevanceScore: Number(video.relevance_score ?? video.relevanceScore ?? video.score ?? video.weight ?? 0),
    reasons: toArray(video.reasons || video.connection_reasons || video.connectionReasons),
    sharedKeywords: toArray(video.shared_keywords || video.sharedKeywords || video.keywords),
    sharedEntities: toArray(video.shared_entities || video.sharedEntities),
    sameIssueCluster: pickFirst(video, ['same_issue_cluster', 'sameIssueCluster', 'cluster', 'cluster_name', 'clusterName']),
    focusKeywords: toArray(video.focus_keywords ?? video.focusKeywords)
      .map((keyword) => normalizeFocusKeyword(keyword))
      .filter(Boolean),
    emotionKeywords: toArray(video.emotion_keywords ?? video.emotionKeywords)
      .map((keyword) => normalizeDisplayKeyword(keyword))
      .filter(Boolean),
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

function pickCountryVideosFromBody(body, countryCode) {
  const country = COUNTRY_LOOKUP.get(countryCode)
  const countryNames = [
    countryCode,
    countryCode.toLowerCase(),
    country?.label,
    country?.label?.toLowerCase(),
    country?.localLabel,
  ].filter(Boolean)
  const countrySpecificKeys = {
    KR: ['koreaVideos', 'korea_videos', 'krVideos', 'kr_videos', 'korVideos', 'kor_videos'],
    US: ['usVideos', 'us_videos', 'usaVideos', 'usa_videos', 'unitedStatesVideos', 'united_states_videos'],
    CN: ['chinaVideos', 'china_videos', 'cnVideos', 'cn_videos', 'chnVideos', 'chn_videos'],
  }

  const directVideos = pickFirst(body, countrySpecificKeys[countryCode] || [], null)

  if (Array.isArray(directVideos)) {
    return directVideos
  }

  const countries = toArray(body?.countries || body?.countryVideos || body?.country_videos || body?.recommendations)
  const matchedCountry = countries.find((item) => {
    const itemCountryCode = normalizeCountryCode(
      pickFirst(item, ['country_code', 'countryCode', 'country', 'countryName', 'name', 'code'], ''),
    )

    return itemCountryCode === countryCode || countryNames.includes(String(item?.name || '').trim())
  })

  return toArray(matchedCountry?.videos || matchedCountry?.items || matchedCountry?.results || matchedCountry?.recommendations)
}

export function normalizeComparisonSections(body) {
  const normalizedBody = Array.isArray(body) ? { videos: body } : body || {}
  const directCountrySections = COMPARISON_COUNTRIES
    .map((country) => ({
      country_code: country.code,
      videos: pickCountryVideosFromBody(normalizedBody, country.code),
    }))
    .filter((section) => section.videos.length)
  const rawSections =
    directCountrySections.length
      ? directCountrySections
      : toArray(normalizedBody?.sections).length
        ? normalizedBody.sections
        : normalizeSectionsFromObject(normalizedBody?.sections || normalizedBody?.country_sections || normalizedBody?.countrySections)

  const fallbackVideos = toArray(normalizedBody?.videos)
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
    const videos = toArray(section.videos || section.items || section.results)
      .filter((video) => !isShortFormVideo(video))
      .map((video, index) =>
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

    groupedSections.get(countryCode).videos = videos.slice(0, DEFAULT_COUNTRY_VIDEO_LIMIT)
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

export async function fetchComparisonHome({ limit = DEFAULT_COUNTRY_VIDEO_LIMIT, accessToken } = {}) {
  const payload = await requestJsonCandidates(
    ['/api/v1/comparison/home'],
    {
      query: { limit },
      accessToken,
      fallbackErrorMessage: '국가별 비교 홈 데이터를 불러오지 못했습니다.',
    },
  )

  return normalizeComparisonHome(payload)
}

export async function searchComparisonVideos({ keyword, limit = DEFAULT_COUNTRY_VIDEO_LIMIT, accessToken } = {}) {
  const payload = await requestJsonCandidates(
    ['/api/v1/comparison/country-recommendations', '/api/v1/comparison/search'],
    {
      query: { keyword, limitPerCountry: limit, limit },
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
    return value.filter(Boolean).map((item) => {
      if (typeof item !== 'object') {
        return item
      }

      return {
        ...item,
        countryCode: normalizeCountryCode(
          pickFirst(item, ['country_code', 'countryCode', 'country', 'code'], item.countryCode),
        ),
        topKeywords: toArray(item.top_keywords || item.topKeywords),
      }
    })
  }

  if (!value || typeof value !== 'object') {
    return []
  }

  return Object.entries(value).map(([countryCode, summary]) => ({
    countryCode: normalizeCountryCode(countryCode),
    summary,
  }))
}

function createCompareOnClickGraph(body, selectedVideoId = '') {
  const selectedVideo = normalizeGraphNode(
    body.selected_video ||
      body.selectedVideo ||
      body.video ||
      { youtubeVideoId: selectedVideoId, node_type: 'selected' },
  )
  const sections = normalizeComparisonSections(body)
  const relatedNodes = sections.flatMap((section) =>
    toArray(section.videos).map((video, index) => ({
      ...video,
      id: video.id || video.videoId || `${section.countryCode}-${index + 1}`,
      countryCode: section.countryCode,
      countryName: section.countryName,
      countryLocalLabel: section.countryLocalLabel,
      nodeType: 'related',
    })),
  )
  const selectedNodeId = String(selectedVideo.id || selectedVideo.videoId || selectedVideoId)
  const searchKeyword = body.searchKeyword || body.search_keyword || ''
  const edges = relatedNodes.map((node, index) => {
    const country = COUNTRY_LOOKUP.get(node.countryCode)
    const nodeReasons = toArray(node.reasons)
    const nodeKeywords = toArray(node.sharedKeywords)
    const nodeEntities = toArray(node.sharedEntities)
    const relevanceScore = Number(node.relevanceScore)

    return {
      id: `compare-on-click-edge-${index + 1}`,
      source: selectedNodeId,
      target: String(node.id || node.videoId || `related-${index + 1}`),
      relationType: 'RELATED_COUNTRY_COVERAGE',
      keywords: nodeKeywords.length ? nodeKeywords : [searchKeyword].filter(Boolean),
      reasons: nodeReasons.length
        ? nodeReasons
        : [`${country?.localLabel || node.countryCode}에서 같은 이슈와 가까운 영상으로 검색된 결과입니다.`],
      sharedEntities: nodeEntities,
      sameIssueCluster: node.sameIssueCluster || searchKeyword,
      weight: Number.isFinite(relevanceScore) && relevanceScore > 0 ? relevanceScore : Math.max(0.58, 0.92 - index * 0.04),
    }
  })

  return {
    selectedVideo: {
      ...selectedVideo,
      id: selectedNodeId,
      videoId: selectedVideo.videoId || selectedVideoId,
      countryCode:
        normalizeCountryCode(body.source_country_code || body.sourceCountryCode || selectedVideo.countryCode) || 'KR',
      nodeType: 'selected',
    },
    mainKeywords: [searchKeyword].filter(Boolean),
    nodes: [
      {
        ...selectedVideo,
        id: selectedNodeId,
        videoId: selectedVideo.videoId || selectedVideoId,
        countryCode:
          normalizeCountryCode(body.source_country_code || body.sourceCountryCode || selectedVideo.countryCode) || 'KR',
        nodeType: 'selected',
      },
      ...relatedNodes,
    ],
    edges,
    connectionReasons: [
      searchKeyword
        ? `"${searchKeyword}" 제목 맥락을 기준으로 다른 국가의 관련 영상을 찾았습니다.`
        : '선택 영상과 다른 국가의 관련 영상을 연결했습니다.',
    ],
    countryPerspectives: normalizePerspectiveItems(body.country_perspectives || body.countryPerspectives).length
      ? normalizePerspectiveItems(body.country_perspectives || body.countryPerspectives)
      : sections
          .filter((section) => section.videos.length)
          .map((section) => ({
            countryCode: section.countryCode,
            summary: `${section.countryLocalLabel} 관련 영상 ${section.videos.length}개를 비교 후보로 표시합니다.`,
          })),
    sharedKeywords: [searchKeyword].filter(Boolean),
    sharedEntities: [],
    clusterInfo: searchKeyword ? { id: `compare-on-click-${selectedNodeId}`, title: searchKeyword } : null,
  }
}

export function normalizeComparisonGraph(payload, selectedVideoId = '') {
  const body = extractBody(payload) || {}
  const compareSections = toArray(body.sections || body.country_sections || body.countrySections)

  if (compareSections.length && !toArray(body.graph?.nodes || body.nodes).length) {
    return createCompareOnClickGraph(body, selectedVideoId)
  }

  const graph = body.graph || body
  const rawNodes = toArray(graph.nodes)
  const sourceNode = rawNodes.find((node) => {
    const nodeType = String(pickFirst(node, ['node_type', 'nodeType'], '')).toLowerCase()
    const videoId = normalizeVideoId(node)

    return (
      nodeType === 'source' ||
      nodeType === 'selected' ||
      videoId === selectedVideoId ||
      node.id === `video:${selectedVideoId}`
    )
  })
  const selectedVideo = normalizeGraphNode(
    body.selected_video ||
      body.selectedVideo ||
      body.video ||
      graph.selected_video ||
      graph.selectedVideo ||
      sourceNode ||
      { video_id: body.selectedVideoId || selectedVideoId, node_type: 'selected' },
  )
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
    mainKeywords: toArray(graph.main_keywords || graph.mainKeywords || graph.keywords || body.main_keywords || body.mainKeywords || body.keywords),
    nodes,
    edges: toArray(graph.edges).map((edge, index) => normalizeGraphEdge(edge, index)),
    connectionReasons: toArray(graph.connection_reasons || graph.connectionReasons || body.connection_reasons || body.connectionReasons),
    countryPerspectives: normalizePerspectiveItems(graph.country_perspectives || graph.countryPerspectives || body.country_perspectives || body.countryPerspectives),
    sharedKeywords: toArray(graph.shared_keywords || graph.sharedKeywords || body.shared_keywords || body.sharedKeywords),
    sharedEntities: toArray(graph.shared_entities || graph.sharedEntities || body.shared_entities || body.sharedEntities),
    clusterInfo: graph.cluster_info || graph.clusterInfo || graph.same_issue_cluster || graph.sameIssueCluster || body.cluster_info || body.clusterInfo || body.same_issue_cluster || body.sameIssueCluster || null,
  }
}

export async function fetchComparisonGraph({ videoId, accessToken } = {}) {
  const encodedVideoId = encodeURIComponent(videoId || '')

  const detailPayload = await requestJson(`/api/v1/youtube/${encodedVideoId}`, {
    accessToken,
    fallbackErrorMessage: '선택한 영상 정보를 불러오지 못했습니다.',
  })
  const selectedVideoDetail = extractBody(detailPayload) || { youtubeVideoId: videoId }
  const comparePayload = await requestJson('/api/videos/compare-on-click', {
    method: 'POST',
    query: { limitPerCountry: 3 },
    body: selectedVideoDetail,
    accessToken,
    fallbackErrorMessage: '국가별 비교 영상을 불러오지 못했습니다.',
  })

  return normalizeComparisonGraph(comparePayload, videoId)
}

export async function requestComparisonInsight({ selectedVideo, comparedVideo, relationEdge, graphData, accessToken } = {}) {
  const payload = await requestJson('/api/v1/comparison/llm-difference', {
    method: 'POST',
    accessToken,
    body: {
      selectedVideo,
      comparedVideo,
      relationEdge,
      mainKeywords: graphData?.mainKeywords || [],
      sharedKeywords: graphData?.sharedKeywords || [],
      sharedEntities: graphData?.sharedEntities || [],
      countryPerspectives: graphData?.countryPerspectives || [],
    },
    fallbackErrorMessage: 'LLM 비교 요약을 불러오지 못했습니다.',
  })
  const body = extractBody(payload) || {}

  return {
    summary: body.summary || body.differenceSummary || body.difference_summary || '',
    points: toArray(body.points || body.keyPoints || body.key_points),
    recommendationReason: body.recommendationReason || body.recommendation_reason || '',
  }
}
