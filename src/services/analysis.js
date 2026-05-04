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

function normalizeNumericLikeValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const trimmedValue = value.trim()

    if (/^\d+$/.test(trimmedValue)) {
      return Number(trimmedValue)
    }
  }

  return null
}

function extractTargetId(source, depth = 0) {
  if (!source || typeof source !== 'object' || depth > 4) {
    return null
  }

  const directTargetId = normalizeNumericLikeValue(
    source.target_id ??
      source.targetId ??
      source.analysis_target_id ??
      source.analysisTargetId ??
      source.videoPk ??
      source.video_pk ??
      source.youtubeVideoPk ??
      source.youtube_video_pk ??
      source.dbId ??
      source.db_id ??
      source.pk ??
      null,
  )

  if (directTargetId !== null) {
    return directTargetId
  }

  for (const key of ['body', 'data', 'result', 'response']) {
    const nestedTargetId = extractTargetId(source[key], depth + 1)

    if (nestedTargetId !== null) {
      return nestedTargetId
    }
  }

  return null
}

async function requestJson(path, { method = 'GET', accessToken = getAccessToken() } = {}) {
  if (!accessToken) {
    throw new Error('영상 분석 기능을 사용하려면 다시 로그인해 주세요.')
  }

  try {
    const response = await fetch(buildUrl(path), {
      method,
      headers: createAuthHeaders(accessToken),
    })

    const payload = await parseResponse(response)

    if (!response.ok) {
      const error = new Error(extractErrorMessage(payload) || '영상 분석 요청에 실패했습니다.')
      error.status = response.status
      error.statusCode = payload?.status?.statusCode || ''
      throw error
    }

    return payload
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('영상 분석 서버에 연결할 수 없습니다.')
    }

    throw error
  }
}

function normalizeKeyword(keyword) {
  if (!keyword || typeof keyword !== 'object') {
    return null
  }

  return {
    keywordText: keyword.keyword_text || keyword.keywordText || keyword.text || '',
    keywordType: keyword.keyword_type || keyword.keywordType || '',
    score: Number(keyword.score),
  }
}

function normalizeSentenceLabel(label, index) {
  if (!label || typeof label !== 'object') {
    return null
  }

  return {
    id: `${label.content_sentence_id || label.contentSentenceId || 'sentence'}-${label.label_type || label.labelType || index}`,
    contentSentenceId: label.content_sentence_id || label.contentSentenceId || null,
    labelType: label.label_type || label.labelType || '',
    score: Number(label.score),
    highlightColor: label.highlight_color || label.highlightColor || null,
    evidenceKeyword: label.evidence_keyword || label.evidenceKeyword || null,
  }
}

function normalizeHighlightSpan(span, index) {
  if (!span || typeof span !== 'object') {
    return null
  }

  return {
    id: `${span.content_sentence_id || span.contentSentenceId || 'highlight'}-${index}`,
    contentSentenceId: span.content_sentence_id || span.contentSentenceId || null,
    startOffset: span.start_offset ?? span.startOffset ?? null,
    endOffset: span.end_offset ?? span.endOffset ?? null,
    labelType: span.label_type || span.labelType || '',
    score: Number(span.score),
    matchedWord: span.matched_word || span.matchedWord || '',
  }
}

function hasAnalysisResultShape(source) {
  if (!source || typeof source !== 'object') {
    return false
  }

  return (
    'overall_bias_score' in source ||
    'overallBiasScore' in source ||
    'summary_text' in source ||
    'summaryText' in source ||
    'tone_label' in source ||
    'toneLabel' in source
  )
}

function normalizeAnalysisResult(source) {
  const responseBody = extractResponseBody(source) || {}

  return {
    targetId: extractTargetId(responseBody) ?? extractTargetId(source),
    overallBiasScore: Number(responseBody.overall_bias_score),
    opinionScore: Number(responseBody.opinion_score),
    emotionScore: Number(responseBody.emotion_score),
    anonymousSourceScore: Number(responseBody.anonymous_source_score),
    headlineBodyGapScore: Number(responseBody.headline_body_gap_score),
    neutralityScore:
      responseBody.neutrality_score === null || responseBody.neutrality_score === undefined
        ? null
        : Number(responseBody.neutrality_score),
    summaryText: responseBody.summary_text || '',
    perspectiveSummary: responseBody.perspective_summary || '',
    evidenceSummary: responseBody.evidence_summary || '',
    toneLabel: responseBody.tone_label || '',
    keywords: (Array.isArray(responseBody.keywords) ? responseBody.keywords : [])
      .map((keyword) => normalizeKeyword(keyword))
      .filter(Boolean),
    sentenceLabels: (Array.isArray(responseBody.sentence_labels) ? responseBody.sentence_labels : [])
      .map((label, index) => normalizeSentenceLabel(label, index))
      .filter(Boolean),
    highlightSpans: (Array.isArray(responseBody.highlight_spans) ? responseBody.highlight_spans : [])
      .map((span, index) => normalizeHighlightSpan(span, index))
      .filter(Boolean),
    evidences: Array.isArray(responseBody.evidences) ? responseBody.evidences : [],
  }
}

export async function startVideoAnalysis(youtubeVideoId, accessToken = getAccessToken()) {
  const normalizedYoutubeVideoId =
    typeof youtubeVideoId === 'string' ? youtubeVideoId.trim() : String(youtubeVideoId || '').trim()

  if (!normalizedYoutubeVideoId) {
    throw new Error('분석할 유튜브 영상 ID가 없습니다.')
  }

  const payload = await requestJson(
    `/api/v1/analysis/analyze/${encodeURIComponent(normalizedYoutubeVideoId)}`,
    {
      method: 'POST',
      accessToken,
    },
  )

  const responseBody = extractResponseBody(payload)
  const targetId = extractTargetId(responseBody) ?? extractTargetId(payload)
  const analysisResult = hasAnalysisResultShape(responseBody)
    ? normalizeAnalysisResult(responseBody)
    : hasAnalysisResultShape(payload)
      ? normalizeAnalysisResult(payload)
      : null

  return {
    jobId: responseBody?.job_id || responseBody?.jobId || null,
    status: responseBody?.status || '',
    targetId,
    analysisResult,
  }
}

export async function fetchVideoAnalysisResult(targetId, accessToken = getAccessToken()) {
  const normalizedTargetId = String(targetId ?? '').trim()

  if (!normalizedTargetId) {
    throw new Error('분석 결과를 조회할 대상 ID가 없습니다.')
  }

  const payload = await requestJson(`/api/v1/analysis/${encodeURIComponent(normalizedTargetId)}`, {
    method: 'GET',
    accessToken,
  })

  return normalizeAnalysisResult(payload)
}
