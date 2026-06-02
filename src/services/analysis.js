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

function normalizeAnalysisStatusValue(value) {
  if (typeof value === 'string') {
    return value.trim().toUpperCase()
  }

  if (!value || typeof value !== 'object') {
    return ''
  }

  return normalizeAnalysisStatusValue(
    value.analysis_status ??
      value.analysisStatus ??
      value.job_status ??
      value.jobStatus ??
      value.processing_status ??
      value.processingStatus ??
      value.result_status ??
      value.resultStatus ??
      value.status,
  )
}

function extractAnalysisJobStatus(payload, responseBody) {
  const statusCandidates = [
    responseBody?.analysis_status,
    responseBody?.analysisStatus,
    responseBody?.job_status,
    responseBody?.jobStatus,
    responseBody?.processing_status,
    responseBody?.processingStatus,
    responseBody?.result_status,
    responseBody?.resultStatus,
    responseBody?.status,
    payload?.body?.analysis_status,
    payload?.body?.analysisStatus,
    payload?.body?.job_status,
    payload?.body?.jobStatus,
    payload?.data?.analysis_status,
    payload?.data?.analysisStatus,
    payload?.result?.analysis_status,
    payload?.result?.analysisStatus,
  ]

  for (const candidate of statusCandidates) {
    const normalizedStatus = normalizeAnalysisStatusValue(candidate)

    if (normalizedStatus) {
      return normalizedStatus
    }
  }

  return ''
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
      source.analysis_id ??
      source.analysisId ??
      source.videoPk ??
      source.video_pk ??
      source.youtubeVideoPk ??
      source.youtube_video_pk ??
      source.dbId ??
      source.db_id ??
      source.pk ??
      source.id ??
      null,
  )

  if (directTargetId !== null) {
    return directTargetId
  }

  for (const key of ['body', 'data', 'result', 'response', 'target', 'analysis']) {
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
  if (typeof keyword === 'string') {
    return {
      keywordText: keyword,
      keywordType: '',
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
    keywordType: keyword.keyword_type || keyword.keywordType || '',
    score: Number(keyword.score),
    occurrenceCount: Number(keyword.occurrence_count ?? keyword.occurrenceCount),
    sentenceCount: Number(keyword.sentence_count ?? keyword.sentenceCount),
  }
}

function isEmotionKeyword(keyword) {
  return String(keyword?.keywordType || keyword?.keyword_type || '')
    .trim()
    .toUpperCase() === 'EMOTION'
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

function pickArray(source, keys) {
  for (const key of keys) {
    const value = source?.[key]

    if (Array.isArray(value)) {
      return value
    }
  }

  return []
}

function pickString(source, keys, fallback = '') {
  for (const key of keys) {
    const value = source?.[key]

    if (typeof value === 'string' && value.trim()) {
      return value
    }
  }

  return fallback
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

function normalizeAnalysisScore(value) {
  const numericValue = Number(value)

  return Number.isFinite(numericValue) ? numericValue : null
}

function hasAnalysisResultShape(source) {
  if (!source || typeof source !== 'object') {
    return false
  }

  return (
    'overall_bias_score' in source ||
    'overallBiasScore' in source ||
    'headline_body_gap_score' in source ||
    'headlineBodyGapScore' in source ||
    'score_reason_summary' in source ||
    'scoreReasonSummary' in source ||
    'fact_ratio' in source ||
    'factRatio' in source ||
    'summary_text' in source ||
    'summaryText' in source ||
    'tone_label' in source ||
    'toneLabel' in source ||
    'keywords' in source ||
    'emotion_keywords' in source ||
    'emotionKeywords' in source ||
    'focus_keywords' in source ||
    'focusKeywords' in source ||
    'sentence_labels' in source ||
    'sentenceLabels' in source
  )
}

function extractAnalysisResultBody(source) {
  const responseBody = extractResponseBody(source) || {}

  if (hasAnalysisResultShape(responseBody)) {
    return responseBody
  }

  const nestedCandidates = [
    responseBody.analysis_result,
    responseBody.analysisResult,
    responseBody.analysis,
    responseBody.result,
    responseBody.data,
  ]

  return nestedCandidates.find((candidate) => hasAnalysisResultShape(candidate)) || responseBody
}

function normalizeAnalysisResult(source) {
  const responseBody = extractAnalysisResultBody(source)
  const neutralityScoreValue = responseBody.neutrality_score ?? responseBody.neutralityScore
  const rawSentenceLabels = pickArray(responseBody, ['sentence_labels', 'sentenceLabels'])
  const normalizedKeywords = (Array.isArray(responseBody.keywords) ? responseBody.keywords : [])
    .map((keyword) => normalizeKeyword(keyword))
    .filter(Boolean)
  const rawEmotionKeywords = pickArray(responseBody, [
    'emotion_keywords',
    'emotionKeywords',
    'emotion_expression_keywords',
    'emotionExpressionKeywords',
    'emotional_expression_keywords',
    'emotionalExpressionKeywords',
    'emotion_expressions',
    'emotionExpressions',
    'emotional_expressions',
    'emotionalExpressions',
    'emotion_terms',
    'emotionTerms',
    'emotional_terms',
    'emotionalTerms',
  ])
  const fallbackEmotionKeywords = rawSentenceLabels
    .filter((label) => String(label?.label_type || label?.labelType || '').toLowerCase().includes('emotion'))
    .map((label) => ({
      keyword_text:
        label.evidence_keyword ||
        label.evidenceKeyword ||
        label.keyword_text ||
        label.keywordText ||
        label.keyword ||
        label.text ||
        '',
      keyword_type: label.label_type || label.labelType || 'emotion',
      score: label.score,
    }))
  const normalizedEmotionKeywords = (rawEmotionKeywords.length
    ? rawEmotionKeywords
    : normalizedKeywords.filter((keyword) => isEmotionKeyword(keyword)).length
      ? normalizedKeywords.filter((keyword) => isEmotionKeyword(keyword))
      : fallbackEmotionKeywords
  )
    .map((keyword) => normalizeKeyword(keyword))
    .filter((keyword) => keyword?.keywordText)

  const normalizedResult = {
    targetId: extractTargetId(responseBody) ?? extractTargetId(source),
    overallBiasScore: normalizeAnalysisScore(responseBody.overall_bias_score ?? responseBody.overallBiasScore),
    opinionScore: normalizeAnalysisScore(responseBody.opinion_score ?? responseBody.opinionScore),
    emotionScore: normalizeAnalysisScore(responseBody.emotion_score ?? responseBody.emotionScore),
    emotionExpressionCount: normalizeAnalysisScore(
      responseBody.emotion_expression_count ?? responseBody.emotionExpressionCount ?? responseBody.emotion_count,
    ),
    emotionSentenceCount: normalizeAnalysisScore(
      responseBody.emotion_sentence_count ??
        responseBody.emotionSentenceCount ??
        responseBody.emotion_detected_sentence_count,
    ),
    anonymousSourceScore: normalizeAnalysisScore(
      responseBody.anonymous_source_score ?? responseBody.anonymousSourceScore,
    ),
    factRatio: normalizeAnalysisScore(responseBody.fact_ratio ?? responseBody.factRatio),
    headlineBodyGapScore: normalizeAnalysisScore(
      responseBody.headline_body_gap_score ?? responseBody.headlineBodyGapScore,
    ),
    headlineBodyGapLead: normalizeAnalysisScore(
      responseBody.headline_body_gap_lead ?? responseBody.headlineBodyGapLead,
    ),
    headlineBodyGapTail: normalizeAnalysisScore(
      responseBody.headline_body_gap_tail ?? responseBody.headlineBodyGapTail,
    ),
    headlineBodyGapLabel:
      responseBody.headline_body_gap_label || responseBody.headlineBodyGapLabel || 'neutral',
    neutralityScore:
      neutralityScoreValue === null || neutralityScoreValue === undefined
        ? null
        : normalizeAnalysisScore(neutralityScoreValue),
    youtubeVideoId: pickString(responseBody, ['youtube_video_id', 'youtubeVideoId', 'videoId']),
    title: pickString(responseBody, ['title', 'video_title', 'videoTitle']),
    channelName: pickString(responseBody, ['channel_name', 'channelName', 'channelTitle', 'channel']),
    publishedAt: pickString(responseBody, ['published_at', 'publishedAt', 'publishedDate', 'uploadDate']),
    thumbnailUrl: pickString(responseBody, ['thumbnail_url', 'thumbnailUrl', 'thumbnail', 'imageUrl']),
    summaryText: pickString(responseBody, ['summary_text', 'summaryText']),
    perspectiveSummary: responseBody.perspective_summary || responseBody.perspectiveSummary || '',
    evidenceSummary: responseBody.evidence_summary || responseBody.evidenceSummary || '',
    scoreReasonSummary:
      responseBody.score_reason_summary ||
      responseBody.scoreReasonSummary ||
      '',
    scoreEvidence: responseBody.score_evidence || responseBody.scoreEvidence || '',
    toneLabel: responseBody.tone_label || responseBody.toneLabel || '',
    keywords: normalizedKeywords,
    focusKeywords: (Array.isArray(responseBody.focus_keywords ?? responseBody.focusKeywords)
      ? responseBody.focus_keywords ?? responseBody.focusKeywords
      : []
    )
      .map((keyword) => normalizeFocusKeyword(keyword))
      .filter(Boolean),
    emotionKeywords: normalizedEmotionKeywords,
    sentenceLabels: rawSentenceLabels
      .map((label, index) => normalizeSentenceLabel(label, index))
      .filter(Boolean),
    highlightSpans: (Array.isArray(responseBody.highlight_spans ?? responseBody.highlightSpans)
      ? responseBody.highlight_spans ?? responseBody.highlightSpans
      : []
    )
      .map((span, index) => normalizeHighlightSpan(span, index))
      .filter(Boolean),
    evidences: Array.isArray(responseBody.evidences ?? responseBody.evidenceItems)
      ? responseBody.evidences ?? responseBody.evidenceItems
      : [],
  }

  if (typeof console !== 'undefined') {
    console.groupCollapsed('[Analysis] normalize result')
    console.log('raw response body:', responseBody)
    console.log('raw summary candidates:', {
      summary_text: responseBody.summary_text,
      summaryText: responseBody.summaryText,
    })
    console.log('normalized summaryText:', normalizedResult.summaryText)
    console.log('raw score_reason_summary:', responseBody.score_reason_summary)
    console.log('raw scoreReasonSummary:', responseBody.scoreReasonSummary)
    console.log('normalized scoreReasonSummary:', normalizedResult.scoreReasonSummary)
    console.log('raw score_evidence:', responseBody.score_evidence)
    console.log('normalized scoreEvidence:', normalizedResult.scoreEvidence)
    console.groupEnd()
  }

  return normalizedResult
}

export async function startVideoAnalysis(youtubeId, accessToken = getAccessToken()) {
  const normalizedYoutubeId =
    typeof youtubeId === 'string' ? youtubeId.trim() : String(youtubeId || '').trim()

  if (!normalizedYoutubeId) {
    throw new Error('분석할 유튜브 영상 ID가 없습니다.')
  }

  const payload = await requestJson(
    `/api/v1/analysis/analyze/${encodeURIComponent(normalizedYoutubeId)}?clustering=true`,
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
    status: extractAnalysisJobStatus(payload, responseBody),
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
