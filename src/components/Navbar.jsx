import logo from '../assets/logo.svg'
import './Navbar.css'

function SummaryIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="14" rx="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="m10 9 4.2 3-4.2 3Z" fill="currentColor" />
      <path d="M16.5 9.5h1.5M16.5 14.5h1.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  )
}

function CompareIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.8 12h16.4M12 3.8c2.7 2.3 4.2 5.2 4.2 8.2S14.7 17.9 12 20.2M12 3.8C9.3 6.1 7.8 9 7.8 12s1.5 5.9 4.2 8.2" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
    </svg>
  )
}

function ServiceIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 4 1.5 4.5L18 10l-4.5 1.5L12 16l-1.5-4.5L6 10l4.5-1.5L12 4Z" fill="currentColor" />
    </svg>
  )
}

function ProfileIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17.5 19a5.5 5.5 0 0 0-11 0M12 13.2a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  )
}

const navItems = [
  { key: 'summary', label: '영상 요약', href: '#summary', Icon: SummaryIcon },
  { key: 'compare', label: '국가별 비교', href: '#comparison', Icon: CompareIcon },
]

function Navbar({ activeKey, isLoggedIn, onAuthClick, serviceHref = '#home', maxWidth }) {
  const navbarStyle = maxWidth ? { '--site-navbar-max-width': maxWidth } : undefined

  return (
    <div className="site-navbar" style={navbarStyle}>
      <a className="site-navbar__brand" href="#home" aria-label="뉴뉴 홈">
        <img className="site-navbar__logo" src={logo} alt="뉴뉴 로고" />
      </a>

      <nav className="site-navbar__menu" aria-label="서비스 메뉴">
        {navItems.map((item) => (
          <a
            key={item.key}
            className={`site-navbar__link ${
              activeKey === item.key ? 'site-navbar__link--active' : ''
            }`}
            href={item.href}
          >
            <item.Icon className="site-navbar__icon" />
            <span>{item.label}</span>
          </a>
        ))}

        <a
          className={`site-navbar__link ${
            activeKey === 'service' ? 'site-navbar__link--active' : ''
          }`}
          href={serviceHref}
        >
          <ServiceIcon className="site-navbar__service-icon" />
          <span>서비스 소개</span>
        </a>
      </nav>

      <div className="site-navbar__account">
        <a
          className={`site-navbar__profile ${
            isLoggedIn ? 'site-navbar__profile--logged-in' : 'site-navbar__profile--logged-out'
          }`}
          href={isLoggedIn ? '#mypage' : '#login'}
          onClick={isLoggedIn ? undefined : onAuthClick}
        >
          <ProfileIcon className="site-navbar__profile-icon" />
          <span>{isLoggedIn ? '마이페이지' : '로그인 / 회원가입'}</span>
        </a>
      </div>
    </div>
  )
}

export default Navbar
