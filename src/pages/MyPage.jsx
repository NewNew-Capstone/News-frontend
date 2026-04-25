import { useState } from 'react'
import logo from '../assets/logo.svg'
import Navbar from '../components/Navbar'
import './MyPage.css'

function MyPage({ isLoggedIn, onAuthClick, onLogout, user }) {
  const [activeTab, setActiveTab] = useState('profile')

  const displayNickname = user?.nickname || user?.name || '뉴뉴 사용자'
  const displayName = user?.name || '이름 정보 없음'
  const displayEmail = user?.email || '이메일 정보 없음'
  const profileStatus = user?.name ? '프로필 설정 완료' : '프로필 정보 보완 필요'
  const profileStatusDescription = user?.name
    ? '기본 프로필 정보가 정상적으로 연결되어 있습니다.'
    : '이름 정보가 비어 있어 추후 보완이 필요합니다.'

  return (
    <main id="mypage-top" className="my-page">
      <section className="my-page__shell">
        <Navbar
          activeKey=""
          serviceHref="#home"
          isLoggedIn={isLoggedIn}
          onAuthClick={onAuthClick}
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
                  <span className="my-page__section-chip">개인 정보</span>
                </div>

                <div className="my-page__profile-layout">
                  <article className="my-page__identity-card">
                    <div className="my-page__identity-logo-shell">
                      <img className="my-page__profile-logo" src={logo} alt="뉴뉴 로고" />
                    </div>
                    <p className="my-page__identity-label">NNW ACCOUNT</p>
                    <strong className="my-page__identity-name">{displayNickname}</strong>
                    <span className="my-page__identity-email">{displayEmail}</span>

                    <div className="my-page__identity-tags">
                      <span>프로필 관리</span>
                      <span>계정 보안</span>
                    </div>
                  </article>

                  <div className="my-page__profile-grid">
                    <article className="my-page__info-card my-page__info-card--accent">
                      <span className="my-page__info-label">닉네임</span>
                      <div className="my-page__profile-name-row">
                        <strong>{displayNickname}</strong>
                        <button className="my-page__edit-button" type="button">
                          수정
                        </button>
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
                      <span className="my-page__info-label">계정 상태</span>
                      <strong>{profileStatus}</strong>
                      <p className="my-page__info-description">{profileStatusDescription}</p>
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
                  >
                    <span className="my-page__action-icon my-page__action-icon--withdraw">×</span>
                    <span className="my-page__action-eyebrow">Danger Zone</span>
                    <strong>탈퇴하기</strong>
                    <span className="my-page__action-copy">
                      계정과 연결된 모든 데이터가 삭제될 수 있습니다.
                    </span>
                  </button>
                </div>
              </section>
            </div>
          ) : (
            <section className="my-page__panel my-page__panel--scrap">
              <div className="my-page__panel-heading">
                <div>
                  <p className="my-page__section-eyebrow">Archive</p>
                  <h2 className="my-page__section-title">나의 스크랩</h2>
                </div>
                <span className="my-page__section-chip">저장한 콘텐츠</span>
              </div>

              <div className="my-page__empty-state">
                <div className="my-page__empty-state-orb" aria-hidden="true">
                  <span>⌁</span>
                </div>
                <strong>스크랩한 항목이 아직 없습니다.</strong>
                <p>영상 요약 페이지에서 저장한 콘텐츠가 여기에 모이게 됩니다.</p>
              </div>
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
