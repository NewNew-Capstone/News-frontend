import logo from '../assets/logo.svg'
import paperIcon from '../assets/paper.svg'
import personIcon from '../assets/person.svg'
import youtubeIcon from '../assets/youtube.svg'
import './Navbar.css'

const navItems = [
  { key: 'summary', label: '영상 요약', href: '#summary', icon: paperIcon },
  { key: 'compare', label: '국가별 비교', href: '#compare', icon: youtubeIcon },
]

function Navbar({ activeKey, isLoggedIn, onAuthClick, serviceHref = '#home' }) {
  return (
    <div className="site-navbar">
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
            <img className="site-navbar__icon" src={item.icon} alt="" aria-hidden="true" />
            {item.label}
          </a>
        ))}

        <a
          className={`site-navbar__link ${
            activeKey === 'service' ? 'site-navbar__link--active' : ''
          }`}
          href={serviceHref}
        >
          <span className="site-navbar__service-icon" aria-hidden="true" />
          서비스 소개
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
          {isLoggedIn ? (
            <>
              <img
                className="site-navbar__profile-icon"
                src={personIcon}
                alt=""
                aria-hidden="true"
              />
              마이페이지
            </>
          ) : (
            '로그인 / 회원가입'
          )}
        </a>
      </div>
    </div>
  )
}

export default Navbar
