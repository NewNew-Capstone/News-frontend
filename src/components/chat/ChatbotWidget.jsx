import { useEffect, useRef, useState } from 'react'
import {
  createChatSession,
  deleteChatSession,
  fetchChatMessages,
  fetchChatSessions,
  fetchChatWelcome,
  sendChatMessage,
} from '../../services/chat'
import './ChatbotWidget.css'

function HomeIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.5 10.8 12 4.4l7.5 6.4v8.1a1.7 1.7 0 0 1-1.7 1.7h-3.6v-5.7H9.8v5.7H6.2a1.7 1.7 0 0 1-1.7-1.7v-8.1Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  )
}

function ChatIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 6.8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v5.7a3 3 0 0 1-3 3H10l-4.5 4v-4.2A3 3 0 0 1 5 12.5V6.8Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M8.8 9.8h.1M12 9.8h.1M15.2 9.8h.1" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4" />
    </svg>
  )
}

function SettingsIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <path d="m19.2 13.4.1-1.4-.1-1.4 2-1.5-2-3.4-2.4 1a8 8 0 0 0-2.4-1.4L14 2.8h-4l-.4 2.5a8 8 0 0 0-2.4 1.4l-2.4-1-2 3.4 2 1.5-.1 1.4.1 1.4-2 1.5 2 3.4 2.4-1a8 8 0 0 0 2.4 1.4l.4 2.5h4l.4-2.5a8 8 0 0 0 2.4-1.4l2.4 1 2-3.4-2-1.5Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  )
}

function SendIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="m4.2 4.5 16 7.5-16 7.5 2.1-6.2 7.6-1.3-7.6-1.3-2.1-6.2Z" fill="currentColor" />
    </svg>
  )
}

function BackIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="m14.5 6-6 6 6 6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  )
}

function CloseIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4" />
    </svg>
  )
}

function TrashIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 7h14M10 11v5M14 11v5M9 7l.6-2h4.8L15 7M7 7l.7 12h8.6L17 7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  )
}

function BotAvatar({ imageUrl = '', label = '뉴스봇', size = 'default' }) {
  return (
    <span className={`chatbot-widget__avatar chatbot-widget__avatar--${size}`}>
      {imageUrl ? <img src={imageUrl} alt="" /> : <span aria-hidden="true">N</span>}
      <span className="chatbot-widget__avatar-label">{label}</span>
    </span>
  )
}

function formatRelativeTime(value) {
  const timestamp = Date.parse(value || '')

  if (!timestamp) {
    return ''
  }

  const diffSeconds = Math.round((timestamp - Date.now()) / 1000)
  const formatter = new Intl.RelativeTimeFormat('ko-KR', { numeric: 'auto' })
  const units = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ]

  for (const [unit, seconds] of units) {
    if (Math.abs(diffSeconds) >= seconds) {
      return formatter.format(Math.round(diffSeconds / seconds), unit)
    }
  }

  return '방금 전'
}

function getErrorMessage(error, fallbackMessage) {
  return error instanceof Error ? error.message : fallbackMessage
}

function ChatbotWidget({ accessToken = '', context = null, isLoggedIn, onLoginClick, user }) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('home')
  const [welcome, setWelcome] = useState(null)
  const [sessions, setSessions] = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [isWelcomeLoading, setIsWelcomeLoading] = useState(false)
  const [isSessionsLoading, setIsSessionsLoading] = useState(false)
  const [isMessagesLoading, setIsMessagesLoading] = useState(false)
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isDeletingSession, setIsDeletingSession] = useState(false)
  const [chatErrorMessage, setChatErrorMessage] = useState('')
  const [settings, setSettings] = useState({
    translate: true,
    notifications: true,
    sms: false,
    email: false,
  })
  const widgetRef = useRef(null)
  const messageListRef = useRef(null)

  const botName = welcome?.botName || '뉴스봇'
  const botProfileImageUrl = welcome?.botProfileImageUrl || ''

  useEffect(() => {
    if (!isOpen || welcome || isWelcomeLoading) {
      return
    }

    let isCancelled = false

    const loadWelcome = async () => {
      setIsWelcomeLoading(true)

      try {
        const nextWelcome = await fetchChatWelcome()

        if (!isCancelled) {
          setWelcome(nextWelcome)
        }
      } catch {
        if (!isCancelled) {
          setWelcome({
            botName: '뉴스봇',
            botProfileImageUrl: '',
            welcomeMessage:
              '안녕하세요! 뉴스 편향 분석을 도와드리는 뉴스봇입니다. 궁금하신 내용을 선택하거나 직접 물어보세요.',
            guideItems: ['편향 점수가 뭔가요?', '이 영상 분석 결과 설명해줘', '한국 vs 미국 보도 차이 알려줘'],
          })
        }
      } finally {
        if (!isCancelled) {
          setIsWelcomeLoading(false)
        }
      }
    }

    loadWelcome()

    return () => {
      isCancelled = true
    }
  }, [isOpen, isWelcomeLoading, welcome])

  useEffect(() => {
    if (!isOpen || activeTab !== 'chat' || !isLoggedIn || activeSession) {
      return
    }

    let isCancelled = false

    const loadSessions = async () => {
      setIsSessionsLoading(true)
      setChatErrorMessage('')

      try {
        const nextSessions = await fetchChatSessions(accessToken)

        if (!isCancelled) {
          setSessions(nextSessions)
        }
      } catch (error) {
        if (!isCancelled) {
          setChatErrorMessage(getErrorMessage(error, '대화 목록을 불러오지 못했습니다.'))
        }
      } finally {
        if (!isCancelled) {
          setIsSessionsLoading(false)
        }
      }
    }

    loadSessions()

    return () => {
      isCancelled = true
    }
  }, [accessToken, activeSession, activeTab, isLoggedIn, isOpen])

  useEffect(() => {
    if (!isOpen || activeTab !== 'chat' || !isLoggedIn || !activeSession) {
      return
    }

    let isCancelled = false

    const loadMessages = async () => {
      setIsMessagesLoading(true)
      setChatErrorMessage('')

      try {
        const nextMessages = await fetchChatMessages(activeSession.sessionId, accessToken)

        if (!isCancelled) {
          setMessages(nextMessages)
        }
      } catch (error) {
        if (!isCancelled) {
          setChatErrorMessage(getErrorMessage(error, '메시지를 불러오지 못했습니다.'))
        }
      } finally {
        if (!isCancelled) {
          setIsMessagesLoading(false)
        }
      }
    }

    loadMessages()

    return () => {
      isCancelled = true
    }
  }, [accessToken, activeSession, activeTab, isLoggedIn, isOpen])

  useEffect(() => {
    const messageList = messageListRef.current

    if (!messageList) {
      return
    }

    messageList.scrollTop = messageList.scrollHeight
  }, [messages, isMessagesLoading, isSending])

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const handlePointerDown = (event) => {
      if (widgetRef.current?.contains(event.target)) {
        return
      }

      setIsOpen(false)
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    window.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const handleOpen = () => {
    setIsOpen(true)
  }

  const handleClose = () => {
    setIsOpen(false)
  }

  const handleRequireLogin = () => {
    setIsOpen(false)
    onLoginClick?.()
  }

  const upsertSession = (session, lastMessage = '') => {
    setSessions((currentSessions) => {
      const filteredSessions = currentSessions.filter(
        (currentSession) => currentSession.id !== session.id,
      )

      return [
        {
          ...session,
          lastMessage: lastMessage || session.lastMessage,
          updatedAt: new Date().toISOString(),
        },
        ...filteredSessions,
      ]
    })
  }

  const handleCreateSession = async (title = '새 대화') => {
    if (!isLoggedIn) {
      handleRequireLogin()
      return null
    }

    setIsCreatingSession(true)
    setChatErrorMessage('')

    try {
      const nextSession = await createChatSession(title, accessToken)

      setActiveTab('chat')
      setActiveSession(nextSession)
      setMessages([])
      upsertSession(nextSession)

      return nextSession
    } catch (error) {
      setChatErrorMessage(getErrorMessage(error, '새 대화를 만들지 못했습니다.'))
      return null
    } finally {
      setIsCreatingSession(false)
    }
  }

  const handleOpenSession = (session) => {
    setActiveTab('chat')
    setActiveSession(session)
    setMessages([])
    setChatErrorMessage('')
  }

  const handleBackToSessions = () => {
    setActiveSession(null)
    setMessages([])
    setChatErrorMessage('')
  }

  const handleSendMessage = async (presetContent) => {
    const content = (presetContent || inputValue).trim()

    if (!isLoggedIn) {
      handleRequireLogin()
      return
    }

    if (!content || isSending) {
      return
    }

    setInputValue('')
    setActiveTab('chat')
    setChatErrorMessage('')
    setIsSending(true)

    let targetSession = activeSession

    try {
      if (!targetSession) {
        targetSession = await createChatSession(content.slice(0, 24) || '새 대화', accessToken)

        setActiveSession(targetSession)
        setMessages([])
        upsertSession(targetSession)
      }

      const optimisticMessage = {
        id: `local-${Date.now()}`,
        role: 'USER',
        content,
        createdAt: new Date().toISOString(),
      }

      setMessages((currentMessages) => [...currentMessages, optimisticMessage])

      const nextMessages = await sendChatMessage(targetSession.sessionId, content, accessToken, context)

      setMessages((currentMessages) => [
        ...currentMessages.filter((message) => message.id !== optimisticMessage.id),
        ...nextMessages,
      ])
      upsertSession(targetSession, content)
    } catch (error) {
      setChatErrorMessage(getErrorMessage(error, '메시지 전송에 실패했습니다.'))
    } finally {
      setIsSending(false)
    }
  }

  const handleDeleteActiveSession = async () => {
    if (!activeSession || isDeletingSession) {
      return
    }

    const isConfirmed = window.confirm('이 대화 세션을 삭제할까요?')

    if (!isConfirmed) {
      return
    }

    setIsDeletingSession(true)
    setChatErrorMessage('')

    try {
      await deleteChatSession(activeSession.sessionId, accessToken)
      setSessions((currentSessions) =>
        currentSessions.filter((session) => session.id !== activeSession.id),
      )
      handleBackToSessions()
    } catch (error) {
      setChatErrorMessage(getErrorMessage(error, '대화 삭제에 실패했습니다.'))
    } finally {
      setIsDeletingSession(false)
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    handleSendMessage()
  }

  const renderHomePanel = () => (
    <div className="chatbot-widget__home">
      <div className="chatbot-widget__brand">
        <BotAvatar imageUrl={botProfileImageUrl} label={botName} size="large" />
        <strong>{botName}</strong>
      </div>

      <section className="chatbot-widget__welcome-card">
        <div className="chatbot-widget__welcome-header">
          <BotAvatar imageUrl={botProfileImageUrl} label={botName} />
          <div>
            <span>{botName} 고객센터</span>
            <strong>{isWelcomeLoading ? '환영 메시지를 불러오는 중입니다.' : '궁금한 내용을 아래에서 선택해 주세요.'}</strong>
          </div>
        </div>

        <p>{welcome?.welcomeMessage || '뉴스 편향 분석에 대해 궁금한 점을 물어보세요.'}</p>

        <div className="chatbot-widget__guide-list">
          {(welcome?.guideItems || ['편향 점수가 뭔가요?', '이 영상 분석 결과 설명해줘']).map(
            (guideItem) => (
              <button
                key={guideItem}
                type="button"
                onClick={() => handleSendMessage(guideItem)}
                disabled={isCreatingSession || isSending}
              >
                {guideItem}
              </button>
            ),
          )}
        </div>

        <button
          className="chatbot-widget__primary-action"
          type="button"
          onClick={() => handleCreateSession()}
          disabled={isCreatingSession}
        >
          {isLoggedIn ? '문의하기' : '로그인하고 문의하기'}
          <SendIcon className="chatbot-widget__send-icon" />
        </button>
      </section>

      <p className="chatbot-widget__powered">뉴스봇 상담 이용중</p>
    </div>
  )

  const renderSessionList = () => (
    <div className="chatbot-widget__sessions">
      <header className="chatbot-widget__panel-header">
        <h2>대화</h2>
      </header>

      {!isLoggedIn ? (
        <div className="chatbot-widget__empty">
          <BotAvatar imageUrl={botProfileImageUrl} label={botName} size="large" />
          <strong>로그인이 필요합니다</strong>
          <p>전문가 문의와 이전 대화 조회는 로그인 후 이용할 수 있습니다.</p>
          <button type="button" onClick={handleRequireLogin}>로그인하기</button>
        </div>
      ) : isSessionsLoading ? (
        <div className="chatbot-widget__empty">
          <strong>대화를 불러오는 중입니다</strong>
          <p>잠시만 기다려 주세요.</p>
        </div>
      ) : sessions.length ? (
        <div className="chatbot-widget__session-list">
          {sessions.map((session) => (
            <button
              className="chatbot-widget__session-item"
              key={session.id}
              type="button"
              onClick={() => handleOpenSession(session)}
            >
              <BotAvatar imageUrl={botProfileImageUrl} label={botName} />
              <span>
                <strong>{session.title}</strong>
                <small>{formatRelativeTime(session.updatedAt || session.createdAt)}</small>
                <em>{session.lastMessage || '아직 메시지가 없습니다.'}</em>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="chatbot-widget__empty">
          <BotAvatar imageUrl={botProfileImageUrl} label={botName} size="large" />
          <strong>아직 대화가 없습니다</strong>
          <p>새 문의를 시작하면 뉴스봇이 분석 내용을 이어서 도와드립니다.</p>
        </div>
      )}

      {chatErrorMessage ? <p className="chatbot-widget__error">{chatErrorMessage}</p> : null}

      {isLoggedIn ? (
        <button
          className="chatbot-widget__floating-action"
          type="button"
          onClick={() => handleCreateSession()}
          disabled={isCreatingSession}
        >
          새 문의하기
          <SendIcon className="chatbot-widget__send-icon" />
        </button>
      ) : null}
    </div>
  )

  const renderConversation = () => (
    <div className="chatbot-widget__conversation">
      <header className="chatbot-widget__conversation-header">
        <button type="button" onClick={handleBackToSessions} aria-label="대화 목록으로 이동">
          <BackIcon />
        </button>
        <div>
          <strong>{activeSession?.title || '새 대화'}</strong>
          <span>{botName}</span>
        </div>
        <button
          type="button"
          onClick={handleDeleteActiveSession}
          disabled={isDeletingSession}
          aria-label="대화 삭제"
        >
          <TrashIcon />
        </button>
      </header>

      <div className="chatbot-widget__message-list" ref={messageListRef}>
        {isMessagesLoading ? (
          <div className="chatbot-widget__empty chatbot-widget__empty--compact">
            <strong>메시지를 불러오는 중입니다</strong>
          </div>
        ) : messages.length ? (
          messages.map((message) => (
            <article
              className={`chatbot-widget__message ${
                message.role === 'USER'
                  ? 'chatbot-widget__message--user'
                  : 'chatbot-widget__message--bot'
              }`}
              key={message.id}
            >
              {message.role === 'BOT' ? (
                <BotAvatar imageUrl={botProfileImageUrl} label={botName} size="small" />
              ) : null}
              <div>
                <p>{message.content}</p>
                <time>{formatRelativeTime(message.createdAt)}</time>
              </div>
            </article>
          ))
        ) : (
          <div className="chatbot-widget__empty chatbot-widget__empty--compact">
            <BotAvatar imageUrl={botProfileImageUrl} label={botName} />
            <strong>무엇을 도와드릴까요?</strong>
            <p>편향 점수, 영상 분석 결과, 국가별 보도 차이를 질문해 보세요.</p>
          </div>
        )}

        {isSending ? (
          <article className="chatbot-widget__message chatbot-widget__message--bot">
            <BotAvatar imageUrl={botProfileImageUrl} label={botName} size="small" />
            <div>
              <p>답변을 준비하고 있습니다...</p>
            </div>
          </article>
        ) : null}
      </div>

      {chatErrorMessage ? <p className="chatbot-widget__error">{chatErrorMessage}</p> : null}

      <form className="chatbot-widget__composer" onSubmit={handleSubmit}>
        <input
          type="text"
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          placeholder="메시지를 입력해 주세요"
          disabled={!isLoggedIn || isSending}
        />
        <button type="submit" disabled={!inputValue.trim() || !isLoggedIn || isSending}>
          <SendIcon />
          <span>전송</span>
        </button>
      </form>
    </div>
  )

  const renderSettingsPanel = () => (
    <div className="chatbot-widget__settings">
      <header className="chatbot-widget__panel-header">
        <h2>설정</h2>
      </header>

      <div className="chatbot-widget__profile-summary">
        <BotAvatar imageUrl={botProfileImageUrl} label={botName} size="large" />
        <strong>{user?.nickname || user?.name || '연락처 정보'}</strong>
        <span>{user?.email || '로그인하면 계정 정보가 표시됩니다.'}</span>
        {!isLoggedIn ? <button type="button" onClick={handleRequireLogin}>로그인하기</button> : null}
      </div>

      <section className="chatbot-widget__setting-section">
        <h3>상담 환경</h3>
        <button className="chatbot-widget__setting-row" type="button">
          <span>언어</span>
          <strong>한국어</strong>
        </button>
        {[
          ['translate', '메시지 번역 표시'],
          ['notifications', '알림음'],
        ].map(([key, label]) => (
          <label className="chatbot-widget__setting-row" key={key}>
            <span>{label}</span>
            <input
              type="checkbox"
              checked={settings[key]}
              onChange={(event) =>
                setSettings((currentSettings) => ({
                  ...currentSettings,
                  [key]: event.target.checked,
                }))
              }
            />
          </label>
        ))}
      </section>

      <section className="chatbot-widget__setting-section">
        <h3>수신 설정</h3>
        {[
          ['sms', '문자 수신거부'],
          ['email', '이메일 수신거부'],
        ].map(([key, label]) => (
          <label className="chatbot-widget__setting-row" key={key}>
            <span>{label}</span>
            <input
              type="checkbox"
              checked={settings[key]}
              onChange={(event) =>
                setSettings((currentSettings) => ({
                  ...currentSettings,
                  [key]: event.target.checked,
                }))
              }
            />
          </label>
        ))}
      </section>

      <p className="chatbot-widget__version">v1.0.0</p>
    </div>
  )

  return (
    <div
      className={`chatbot-widget ${isOpen ? 'chatbot-widget--open' : ''}`}
      ref={widgetRef}
    >
      {isOpen ? (
        <section className="chatbot-widget__panel" aria-label="뉴스봇 채팅">
          <div className="chatbot-widget__body">
            {activeTab === 'home'
              ? renderHomePanel()
              : activeTab === 'chat' && activeSession
                ? renderConversation()
                : activeTab === 'chat'
                  ? renderSessionList()
                  : renderSettingsPanel()}
          </div>

          <nav className="chatbot-widget__nav" aria-label="챗봇 메뉴">
            {[
              { key: 'home', label: '홈', icon: <HomeIcon /> },
              { key: 'chat', label: '대화', icon: <ChatIcon /> },
              { key: 'settings', label: '설정', icon: <SettingsIcon /> },
            ].map(({ key, label, icon }) => (
              <button
                className={activeTab === key ? 'chatbot-widget__nav-item--active' : ''}
                key={key}
                type="button"
                onClick={() => {
                  setActiveTab(key)

                  if (key !== 'chat') {
                    setActiveSession(null)
                    setMessages([])
                  }
                }}
              >
                {icon}
                <span>{label}</span>
              </button>
            ))}
          </nav>

          <button className="chatbot-widget__close" type="button" onClick={handleClose} aria-label="챗봇 닫기">
            <CloseIcon />
          </button>
        </section>
      ) : (
        <button className="chatbot-widget__launcher" type="button" onClick={handleOpen}>
          <ChatIcon />
          <span>뉴스봇</span>
        </button>
      )}
    </div>
  )
}

export default ChatbotWidget
