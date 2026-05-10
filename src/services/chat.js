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
    payload.body?.message ||
    payload.body?.error ||
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
  {
    method = 'GET',
    accessToken = getAccessToken(),
    body,
    requiresAuth = true,
    fallbackErrorMessage = '챗봇 요청 처리에 실패했습니다.',
  } = {},
) {
  if (requiresAuth && !accessToken) {
    throw new Error('챗봇을 이용하려면 로그인해 주세요.')
  }

  try {
    const response = await fetch(buildUrl(path), {
      method,
      headers: {
        ...(requiresAuth ? createAuthHeaders(accessToken) : { Accept: 'application/json' }),
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
      throw new Error('챗봇 서버에 연결할 수 없습니다. 서버 상태를 확인해 주세요.')
    }

    throw error
  }
}

function normalizeWelcome(payload) {
  const body = extractResponseBody(payload) || {}

  return {
    botName: body.botName || '뉴스봇',
    botProfileImageUrl: body.botProfileImageUrl || '',
    welcomeMessage:
      body.welcomeMessage ||
      '안녕하세요! 뉴스 편향 분석을 도와드리는 뉴스봇입니다. 궁금하신 내용을 선택하거나 직접 물어보세요.',
    guideItems: Array.isArray(body.guideItems)
      ? body.guideItems.filter(Boolean)
      : ['편향 점수가 뭔가요?', '이 영상 분석 결과 설명해줘', '한국 vs 미국 보도 차이 알려줘'],
  }
}

function normalizeChatSession(session, index = 0) {
  if (!session || typeof session !== 'object') {
    return null
  }

  const sessionId = session.sessionId ?? session.id ?? session.chatSessionId ?? null

  if (sessionId === null || sessionId === undefined) {
    return null
  }

  return {
    id: String(sessionId),
    sessionId,
    title: session.title || `새 대화 ${index + 1}`,
    lastMessage: session.lastMessage || '',
    createdAt: session.createdAt || '',
    updatedAt: session.updatedAt || session.createdAt || '',
  }
}

function normalizeChatMessage(message, index = 0) {
  if (!message || typeof message !== 'object') {
    return null
  }

  const messageId = message.messageId ?? message.id ?? `${message.role || 'message'}-${index}`
  const role = String(message.role || message.sender || '').toUpperCase()

  return {
    id: String(messageId),
    messageId,
    role: role === 'USER' ? 'USER' : 'BOT',
    content: message.content || message.message || '',
    createdAt: message.createdAt || '',
  }
}

export async function fetchChatWelcome() {
  const payload = await requestJson('/api/v1/chat/welcome', {
    requiresAuth: false,
    fallbackErrorMessage: '환영 메시지를 불러오지 못했습니다.',
  })

  return normalizeWelcome(payload)
}

export async function createChatSession(title = '새 대화', accessToken = getAccessToken()) {
  const payload = await requestJson('/api/v1/chat/sessions', {
    method: 'POST',
    accessToken,
    body: title ? { title } : undefined,
    fallbackErrorMessage: '새 대화를 만들지 못했습니다.',
  })

  const session = normalizeChatSession(extractResponseBody(payload) || payload)

  if (!session) {
    throw new Error('생성된 대화 정보를 확인하지 못했습니다.')
  }

  return session
}

export async function fetchChatSessions(accessToken = getAccessToken()) {
  const payload = await requestJson('/api/v1/chat/sessions', {
    accessToken,
    fallbackErrorMessage: '대화 목록을 불러오지 못했습니다.',
  })
  const body = extractResponseBody(payload)
  const sessions = Array.isArray(body?.sessions) ? body.sessions : Array.isArray(body) ? body : []

  return sessions
    .map((session, index) => normalizeChatSession(session, index))
    .filter(Boolean)
    .sort((left, right) => {
      const leftTime = Date.parse(left.updatedAt || left.createdAt || '') || 0
      const rightTime = Date.parse(right.updatedAt || right.createdAt || '') || 0

      return rightTime - leftTime
    })
}

export async function fetchChatMessages(sessionId, accessToken = getAccessToken()) {
  const normalizedSessionId = String(sessionId ?? '').trim()

  if (!normalizedSessionId) {
    throw new Error('메시지를 불러올 대화 정보가 없습니다.')
  }

  const payload = await requestJson(
    `/api/v1/chat/sessions/${encodeURIComponent(normalizedSessionId)}/messages`,
    {
      accessToken,
      fallbackErrorMessage: '메시지 목록을 불러오지 못했습니다.',
    },
  )
  const body = extractResponseBody(payload)
  const messages = Array.isArray(body?.messages) ? body.messages : Array.isArray(body) ? body : []

  return messages.map((message, index) => normalizeChatMessage(message, index)).filter(Boolean)
}

export async function sendChatMessage(
  sessionId,
  content,
  accessToken = getAccessToken(),
  context = null,
) {
  const normalizedSessionId = String(sessionId ?? '').trim()
  const normalizedContent = typeof content === 'string' ? content.trim() : ''

  if (!normalizedSessionId) {
    throw new Error('메시지를 보낼 대화 정보가 없습니다.')
  }

  if (!normalizedContent) {
    throw new Error('메시지를 입력해 주세요.')
  }

  const requestBody = { content: normalizedContent }

  if (context && typeof context === 'object') {
    requestBody.context = context
  }

  const payload = await requestJson(
    `/api/v1/chat/sessions/${encodeURIComponent(normalizedSessionId)}/messages`,
    {
      method: 'POST',
      accessToken,
      body: requestBody,
      fallbackErrorMessage: '메시지 전송에 실패했습니다.',
    },
  )
  const body = extractResponseBody(payload) || {}
  const nextMessages = [body.userMessage, body.botMessage]
    .map((message, index) => normalizeChatMessage(message, index))
    .filter(Boolean)

  return nextMessages
}

export async function deleteChatSession(sessionId, accessToken = getAccessToken()) {
  const normalizedSessionId = String(sessionId ?? '').trim()

  if (!normalizedSessionId) {
    throw new Error('삭제할 대화 정보가 없습니다.')
  }

  return requestJson(`/api/v1/chat/sessions/${encodeURIComponent(normalizedSessionId)}`, {
    method: 'DELETE',
    accessToken,
    fallbackErrorMessage: '대화 삭제에 실패했습니다.',
  })
}
