import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import YoutubeThumbnail from '../components/YoutubeThumbnail'
import { deleteMyAccount, fetchMyProfile, updateMyProfile } from '../services/auth'
import { deleteScrapVideo, fetchScrapVideos } from '../services/scraps'
import './MyPage.css'

function getDisplayText(value, fallbackText) {
  if (typeof value !== 'string') {
    return fallbackText
  }

  const trimmedValue = value.trim()

  return trimmedValue || fallbackText
}

function createProfileFormState(profile = {}) {
  return {
    name: getDisplayText(profile.name, ''),
    nickname: getDisplayText(profile.nickname, ''),
    birth: getDisplayText(profile.birth, ''),
    phone: getDisplayText(profile.phone, ''),
  }
}

function formatBirthDate(value) {
  const normalizedValue = getDisplayText(value, '')

  if (!normalizedValue) {
    return '생년월일 정보 없음'
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    return normalizedValue.replaceAll('-', '. ')
  }

  return normalizedValue
}

function formatDateLabel(value, fallbackText) {
  const normalizedValue = getDisplayText(value, '')

  if (!normalizedValue) {
    return fallbackText
  }

  const parsedTime = Date.parse(normalizedValue)

  if (Number.isNaN(parsedTime)) {
    return normalizedValue
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(new Date(parsedTime))
    .replace(/\.\s*$/, '')
}

function formatViewCount(value) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return '조회수 정보 없음'
  }

  return `조회수 ${new Intl.NumberFormat('ko-KR').format(numericValue)}`
}

function MyPage({ isLoggedIn, onAuthClick, onLogout, onProfileUpdate, user }) {
  const [activeTab, setActiveTab] = useState('profile')
  const [profile, setProfile] = useState(user || null)
  const [profileFormState, setProfileFormState] = useState(createProfileFormState(user))
  const [isProfileLoading, setIsProfileLoading] = useState(isLoggedIn)
  const [profileErrorMessage, setProfileErrorMessage] = useState('')
  const [profileSuccessMessage, setProfileSuccessMessage] = useState('')
  const [profileFormErrorMessage, setProfileFormErrorMessage] = useState('')
  const [profileRefreshKey, setProfileRefreshKey] = useState(0)
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [accountErrorMessage, setAccountErrorMessage] = useState('')
  const [scrapItems, setScrapItems] = useState([])
  const [isScrapLoading, setIsScrapLoading] = useState(false)
  const [scrapErrorMessage, setScrapErrorMessage] = useState('')
  const [scrapRefreshKey, setScrapRefreshKey] = useState(0)
  const [pendingScrapIds, setPendingScrapIds] = useState([])

  useEffect(() => {
    setProfile((currentProfile) => currentProfile || user || null)
  }, [user])

  useEffect(() => {
    if (isEditingProfile) {
      return
    }

    setProfileFormState(createProfileFormState(profile || user || {}))
  }, [isEditingProfile, profile, user])

  useEffect(() => {
    if (!isLoggedIn) {
      setIsProfileLoading(false)
      return undefined
    }

    let isCancelled = false

    const loadProfile = async () => {
      setIsProfileLoading(true)
      setProfileErrorMessage('')

      try {
        const nextProfile = await fetchMyProfile()

        if (isCancelled) {
          return
        }

        setProfile(nextProfile)
      } catch (error) {
        if (isCancelled) {
          return
        }

        setProfileErrorMessage(
          error instanceof Error ? error.message : '프로필 정보를 불러오지 못했습니다.',
        )
      } finally {
        if (!isCancelled) {
          setIsProfileLoading(false)
        }
      }
    }

    loadProfile()

    return () => {
      isCancelled = true
    }
  }, [isLoggedIn, profileRefreshKey])

  useEffect(() => {
    if (!isLoggedIn || activeTab !== 'scrap') {
      return undefined
    }

    let isCancelled = false

    const loadScrapVideos = async () => {
      setIsScrapLoading(true)
      setScrapErrorMessage('')

      try {
        const nextScrapItems = await fetchScrapVideos()

        if (isCancelled) {
          return
        }

        setScrapItems(nextScrapItems)
      } catch (error) {
        if (isCancelled) {
          return
        }

        setScrapErrorMessage(
          error instanceof Error ? error.message : '스크랩 영상을 불러오지 못했습니다.',
        )
      } finally {
        if (!isCancelled) {
          setIsScrapLoading(false)
        }
      }
    }

    loadScrapVideos()

    return () => {
      isCancelled = true
    }
  }, [activeTab, isLoggedIn, scrapRefreshKey])

  const currentProfile = profile || user || {}
  const displayNickname =
    getDisplayText(currentProfile.nickname, '') ||
    getDisplayText(currentProfile.name, '') ||
    '뉴뉴 사용자'
  const displayInitial = (Array.from(displayNickname.trim())[0] || 'N').toLocaleUpperCase('ko-KR')
  const displayName = getDisplayText(currentProfile.name, '이름 정보 없음')
  const displayEmail = getDisplayText(currentProfile.email, '이메일 정보 없음')
  const displayBirth = formatBirthDate(currentProfile.birth)
  const displayPhone = getDisplayText(currentProfile.phone, '연락처 정보 없음')
  const hasProfileIdentity = Boolean(currentProfile.name && currentProfile.email)
  const profileStatusDescription = isProfileLoading
    ? '서버에서 최신 프로필 정보를 확인하고 있습니다.'
    : profileErrorMessage
      ? `${profileErrorMessage} 저장된 기본 정보로 먼저 보여드리고 있어요.`
      : hasProfileIdentity
        ? '계정에 연결된 최신 프로필 정보를 정상적으로 불러왔습니다.'
        : '이름 또는 이메일 정보가 비어 있어 추후 보완이 필요합니다.'
  const profileSyncLabel = isProfileLoading
    ? '실시간 프로필 동기화 중'
    : profileErrorMessage
      ? '세션 저장 정보 사용 중'
      : '최신 프로필 반영 완료'
  const profileSyncDescription = profileSuccessMessage || profileStatusDescription

  const handleProfileRefresh = () => {
    if (isProfileLoading) {
      return
    }

    setProfileSuccessMessage('')
    setProfileRefreshKey((previousKey) => previousKey + 1)
  }

  const handleStartProfileEdit = () => {
    setProfileFormErrorMessage('')
    setProfileSuccessMessage('')
    setProfileFormState(createProfileFormState(currentProfile))
    setIsEditingProfile(true)
  }

  const handleCancelProfileEdit = () => {
    setProfileFormErrorMessage('')
    setProfileFormState(createProfileFormState(currentProfile))
    setIsEditingProfile(false)
  }

  const handleProfileInputChange = (event) => {
    const { name, value } = event.target

    setProfileFormState((currentFormState) => ({
      ...currentFormState,
      [name]: value,
    }))
  }

  const handleProfileSave = async (event) => {
    event.preventDefault()

    const nextProfileInput = {
      name: profileFormState.name.trim(),
      nickname: profileFormState.nickname.trim(),
      birth: profileFormState.birth.trim(),
      phone: profileFormState.phone.trim(),
    }

    if (!nextProfileInput.name) {
      setProfileFormErrorMessage('이름을 입력해 주세요.')
      return
    }

    if (!nextProfileInput.nickname) {
      setProfileFormErrorMessage('닉네임을 입력해 주세요.')
      return
    }

    if (nextProfileInput.birth && !/^\d{4}-\d{2}-\d{2}$/.test(nextProfileInput.birth)) {
      setProfileFormErrorMessage('생년월일은 2000-10-20 형식으로 입력해 주세요.')
      return
    }

    if (nextProfileInput.phone && !/^\d{2,3}-\d{3,4}-\d{4}$/.test(nextProfileInput.phone)) {
      setProfileFormErrorMessage('연락처는 010-1234-5678 형식으로 입력해 주세요.')
      return
    }

    setIsSavingProfile(true)
    setProfileFormErrorMessage('')
    setProfileSuccessMessage('')

    try {
      const nextProfile = await updateMyProfile(nextProfileInput)

      setProfile(nextProfile)
      setIsEditingProfile(false)
      setProfileErrorMessage('')
      setProfileSuccessMessage('프로필 정보가 저장되었습니다.')
      onProfileUpdate?.(nextProfile)
    } catch (error) {
      setProfileFormErrorMessage(
        error instanceof Error ? error.message : '프로필 수정에 실패했습니다.',
      )
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (isDeletingAccount) {
      return
    }

    const isConfirmed = window.confirm(
      '회원 탈퇴를 진행하면 계정과 연결된 정보에 다시 접근하기 어려울 수 있습니다. 계속할까요?',
    )

    if (!isConfirmed) {
      return
    }

    setIsDeletingAccount(true)
    setAccountErrorMessage('')

    try {
      await deleteMyAccount()
      window.alert('회원 탈퇴가 완료되었습니다.')
      onLogout?.()
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '회원 탈퇴 처리에 실패했습니다.'

      if (errorMessage.includes('이미 탈퇴')) {
        onLogout?.()
        return
      }

      setAccountErrorMessage(errorMessage)
    } finally {
      setIsDeletingAccount(false)
    }
  }

  const handleScrapRefresh = () => {
    if (isScrapLoading) {
      return
    }

    setScrapRefreshKey((previousKey) => previousKey + 1)
  }

  const handleOpenScrapVideo = (scrapItem) => {
    if (scrapItem.youtubeVideoId) {
      window.location.hash = `#summary/video/${encodeURIComponent(scrapItem.youtubeVideoId)}`
      return
    }

    if (scrapItem.originalUrl) {
      window.open(scrapItem.originalUrl, '_blank', 'noopener,noreferrer')
    }
  }

  const handleDeleteScrap = async (event, scrapId) => {
    event.stopPropagation()

    if (!scrapId || pendingScrapIds.includes(scrapId)) {
      return
    }

    setPendingScrapIds((currentIds) => [...currentIds, scrapId])
    setScrapErrorMessage('')

    try {
      await deleteScrapVideo(scrapId)
      setScrapItems((currentItems) => currentItems.filter((item) => item.scrapId !== scrapId))
    } catch (error) {
      setScrapErrorMessage(
        error instanceof Error ? error.message : '스크랩 해제에 실패했습니다.',
      )
    } finally {
      setPendingScrapIds((currentIds) => currentIds.filter((currentId) => currentId !== scrapId))
    }
  }

  return (
    <main id="mypage-top" className="my-page">
      <section className="my-page__shell">
        <Navbar
          activeKey=""
          serviceHref="#home"
          isLoggedIn={isLoggedIn}
          onAuthClick={onAuthClick}
          maxWidth="1120px"
        />

        <div className="my-page__content">
          <header className="my-page__header">
            <h1>마이페이지</h1>
            <p className="my-page__lead">
              프로필, 스크랩, 계정 설정을 한눈에 정리해 관리해 보세요.
            </p>
          </header>

          <div className="my-page__tabs" role="tablist" aria-label="마이페이지 메뉴">
            <button
              className={`my-page__tab ${activeTab === 'profile' ? 'my-page__tab--active' : ''}`}
              type="button"
              role="tab"
              aria-selected={activeTab === 'profile'}
              onClick={() => setActiveTab('profile')}
            >
              내 정보 관리
            </button>
            <button
              className={`my-page__tab ${activeTab === 'scrap' ? 'my-page__tab--active' : ''}`}
              type="button"
              role="tab"
              aria-selected={activeTab === 'scrap'}
              onClick={() => setActiveTab('scrap')}
            >
              마이 스크랩
            </button>
          </div>

          {activeTab === 'profile' ? (
            <div className="my-page__section-stack">
              <section className="my-page__panel my-page__panel--profile">
                <div className="my-page__panel-heading">
                  <div>
                    <p className="my-page__section-eyebrow">Profile</p>
                    <h2 className="my-page__section-title">내 프로필</h2>
                  </div>
                  <div className="my-page__profile-toolbar" aria-label="프로필 도구">
                    <button
                      className="my-page__edit-button my-page__edit-button--strong"
                      type="button"
                      onClick={handleStartProfileEdit}
                      disabled={isSavingProfile || isEditingProfile}
                    >
                      {isEditingProfile ? '수정 중' : '프로필 수정'}
                    </button>
                    <button
                      className="my-page__ghost-button my-page__ghost-button--compact"
                      type="button"
                      onClick={handleProfileRefresh}
                      disabled={isProfileLoading}
                    >
                      {isProfileLoading ? '불러오는 중' : '새로고침'}
                    </button>
                  </div>
                </div>

                <div
                  className={`my-page__profile-sync ${
                    profileErrorMessage
                      ? 'my-page__profile-sync--error'
                      : isProfileLoading
                        ? 'my-page__profile-sync--loading'
                        : 'my-page__profile-sync--ready'
                  }`}
                >
                  <span className="my-page__profile-sync-dot" aria-hidden="true" />
                  <strong>{profileSyncLabel}</strong>
                  <p>{profileSyncDescription}</p>
                </div>

                {isEditingProfile ? (
                  <form className="my-page__profile-editor" onSubmit={handleProfileSave}>
                    <div className="my-page__editor-header">
                      <div>
                        <p className="my-page__section-eyebrow">Edit</p>
                        <h3 className="my-page__editor-title">프로필 수정</h3>
                      </div>
                      <span className="my-page__editor-note">PATCH /api/v1/users/me</span>
                    </div>

                    <div className="my-page__editor-grid">
                      <label className="my-page__field">
                        <span>이름</span>
                        <input
                          className="my-page__input"
                          type="text"
                          name="name"
                          value={profileFormState.name}
                          onChange={handleProfileInputChange}
                          placeholder="이름을 입력해 주세요"
                        />
                      </label>

                      <label className="my-page__field">
                        <span>닉네임</span>
                        <input
                          className="my-page__input"
                          type="text"
                          name="nickname"
                          value={profileFormState.nickname}
                          onChange={handleProfileInputChange}
                          placeholder="서비스에서 보여질 이름"
                        />
                      </label>

                      <label className="my-page__field">
                        <span>생년월일</span>
                        <input
                          className="my-page__input"
                          type="text"
                          name="birth"
                          value={profileFormState.birth}
                          onChange={handleProfileInputChange}
                          placeholder="2000-10-20"
                        />
                      </label>

                      <label className="my-page__field">
                        <span>연락처</span>
                        <input
                          className="my-page__input"
                          type="text"
                          name="phone"
                          value={profileFormState.phone}
                          onChange={handleProfileInputChange}
                          placeholder="010-1234-5678"
                        />
                      </label>
                    </div>

                    {profileFormErrorMessage ? (
                      <p className="my-page__form-message my-page__form-message--error">
                        {profileFormErrorMessage}
                      </p>
                    ) : null}

                    <div className="my-page__editor-actions">
                      <button
                        className="my-page__primary-button"
                        type="submit"
                        disabled={isSavingProfile}
                      >
                        {isSavingProfile ? '저장 중' : '저장하기'}
                      </button>
                      <button
                        className="my-page__ghost-button"
                        type="button"
                        onClick={handleCancelProfileEdit}
                        disabled={isSavingProfile}
                      >
                        취소
                      </button>
                    </div>
                  </form>
                ) : null}

                <div className="my-page__profile-layout">
                  <article className="my-page__identity-card">
                    <div className="my-page__identity-top">
                      <div className="my-page__identity-avatar" aria-hidden="true">
                        {displayInitial}
                      </div>
                      <span className="my-page__identity-badge">NNW</span>
                    </div>
                    <p className="my-page__identity-label">Profile Card</p>
                    <strong className="my-page__identity-name">{displayNickname}</strong>
                    <span className="my-page__identity-email">{displayEmail}</span>

                    <div className="my-page__identity-tags">
                      <span>{currentProfile.userId ? `회원 #${currentProfile.userId}` : '계정 보안'}</span>
                      <span>{currentProfile.profileImageKey ? '이미지 연결됨' : '기본 프로필'}</span>
                      <span>News dashboard</span>
                    </div>
                  </article>

                  <div className="my-page__profile-grid">
                    <article className="my-page__info-card my-page__info-card--accent my-page__info-card--wide">
                      <span className="my-page__info-label">닉네임</span>
                      <div className="my-page__profile-name-row">
                        <strong>{displayNickname}</strong>
                      </div>
                      <p className="my-page__info-description">
                        서비스 안에서 표시되는 대표 이름입니다.
                      </p>
                    </article>

                    <article className="my-page__info-card">
                      <span className="my-page__info-label">이름</span>
                      <strong>{displayName}</strong>
                      <p className="my-page__info-description">
                        계정에 연결된 기본 사용자 정보입니다.
                      </p>
                    </article>

                    <article className="my-page__info-card">
                      <span className="my-page__info-label">이메일</span>
                      <strong>{displayEmail}</strong>
                      <p className="my-page__info-description">
                        로그인과 계정 식별에 사용되는 대표 이메일입니다.
                      </p>
                    </article>

                    <article className="my-page__info-card">
                      <span className="my-page__info-label">생년월일</span>
                      <strong>{displayBirth}</strong>
                      <p className="my-page__info-description">
                        계정에 연결된 기본 생년월일 정보를 보여드립니다.
                      </p>
                    </article>

                    <article className="my-page__info-card">
                      <span className="my-page__info-label">연락처</span>
                      <strong>{displayPhone}</strong>
                      <p className="my-page__info-description">
                        본인 확인과 계정 안내에 사용하는 연락처입니다.
                      </p>
                    </article>
                  </div>
                </div>
              </section>

              <section className="my-page__panel my-page__panel--account">
                <div className="my-page__panel-heading">
                  <div>
                    <p className="my-page__section-eyebrow">Control</p>
                    <h2 className="my-page__section-title">계정 관리</h2>
                  </div>
                  <span className="my-page__section-chip">보안 설정</span>
                </div>

                <div className="my-page__action-grid">
                  <button className="my-page__action-card" type="button" onClick={onLogout}>
                    <span className="my-page__action-icon my-page__action-icon--logout">↪</span>
                    <span className="my-page__action-eyebrow">Session</span>
                    <strong>로그아웃</strong>
                    <span className="my-page__action-copy">
                      현재 기기에서 안전하게 로그아웃합니다.
                    </span>
                  </button>

                  <button
                    className="my-page__action-card my-page__action-card--danger"
                    type="button"
                    onClick={handleDeleteAccount}
                    disabled={isDeletingAccount}
                  >
                    <span className="my-page__action-icon my-page__action-icon--withdraw">×</span>
                    <span className="my-page__action-eyebrow">Danger Zone</span>
                    <strong>{isDeletingAccount ? '탈퇴 처리 중' : '탈퇴하기'}</strong>
                    <span className="my-page__action-copy">
                      계정과 연결된 모든 데이터가 삭제될 수 있습니다.
                    </span>
                  </button>
                </div>

                {accountErrorMessage ? (
                  <p className="my-page__form-message my-page__form-message--error my-page__account-message">
                    {accountErrorMessage}
                  </p>
                ) : null}
              </section>
            </div>
          ) : (
            <section className="my-page__panel my-page__panel--scrap">
              <div className="my-page__panel-heading">
                <div>
                  <p className="my-page__section-eyebrow">Archive</p>
                  <h2 className="my-page__section-title">나의 스크랩</h2>
                </div>
                <span className="my-page__section-chip">저장 {scrapItems.length}건</span>
              </div>

              <div className="my-page__scrap-toolbar">
                <p className="my-page__scrap-summary">
                  영상 요약에서 저장한 영상을 한 번에 모아보고 바로 이어서 볼 수 있습니다.
                </p>
                <button
                  className="my-page__ghost-button"
                  type="button"
                  onClick={handleScrapRefresh}
                  disabled={isScrapLoading}
                >
                  {isScrapLoading ? '불러오는 중' : '새로고침'}
                </button>
              </div>

              {isScrapLoading ? (
                <div className="my-page__feedback-card">
                  <strong>스크랩 영상을 불러오는 중입니다.</strong>
                  <p>저장된 콘텐츠를 정리해서 보여드리고 있어요.</p>
                </div>
              ) : scrapErrorMessage ? (
                <div className="my-page__feedback-card my-page__feedback-card--error">
                  <strong>스크랩 영상을 불러오지 못했습니다.</strong>
                  <p>{scrapErrorMessage}</p>
                </div>
              ) : scrapItems.length ? (
                <div className="my-page__scrap-grid">
                  {scrapItems.map((scrapItem) => (
                    <article
                      key={scrapItem.id}
                      className="my-page__scrap-card"
                    >
                      <button
                        className="my-page__scrap-main"
                        type="button"
                        onClick={() => handleOpenScrapVideo(scrapItem)}
                      >
                        <div className="my-page__scrap-thumb-shell">
                          <YoutubeThumbnail
                            className="my-page__scrap-thumb"
                            src={scrapItem.thumbnailUrl}
                            youtubeVideoId={scrapItem.youtubeVideoId}
                            alt={scrapItem.title}
                            placeholder={<div className="my-page__scrap-placeholder">NNW SCRAP</div>}
                          />
                          <span className="my-page__scrap-badge">스크랩</span>
                        </div>

                        <div className="my-page__scrap-body">
                          <div className="my-page__scrap-meta">
                            <span>{scrapItem.channelName}</span>
                            <span>{formatDateLabel(scrapItem.scrapCreatedAt, '저장일 없음')}</span>
                          </div>
                          <strong className="my-page__scrap-title">{scrapItem.title}</strong>
                          <div className="my-page__scrap-stats">
                            <span>{formatViewCount(scrapItem.viewCount)}</span>
                            <span>{formatDateLabel(scrapItem.publishedAt, '게시일 없음')}</span>
                          </div>
                        </div>
                      </button>

                      <button
                        className="my-page__scrap-remove"
                        type="button"
                        disabled={pendingScrapIds.includes(scrapItem.scrapId)}
                        onClick={(event) => handleDeleteScrap(event, scrapItem.scrapId)}
                      >
                        {pendingScrapIds.includes(scrapItem.scrapId) ? '처리 중' : '해제'}
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="my-page__empty-state">
                  <div className="my-page__empty-state-orb" aria-hidden="true">
                    <span>⌁</span>
                  </div>
                  <strong>스크랩한 항목이 아직 없습니다.</strong>
                  <p>영상 요약 페이지에서 저장한 콘텐츠가 여기에 모이게 됩니다.</p>
                </div>
              )}
            </section>
          )}
        </div>

        <a className="my-page__floating-top" href="#mypage-top" aria-label="맨 위로 이동">
          ↑
        </a>
      </section>
    </main>
  )
}

export default MyPage
