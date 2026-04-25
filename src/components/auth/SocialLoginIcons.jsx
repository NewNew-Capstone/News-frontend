function KakaoIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="32" fill="#FEE500" />
      <path
        d="M32 19c-9.38 0-17 5.86-17 13.09 0 4.49 2.86 8.49 7.22 10.85l-1.72 6.08a.94.94 0 0 0 1.4 1.03l7.28-4.84c.92.14 1.86.21 2.82.21 9.38 0 17-5.87 17-13.15C49 24.86 41.38 19 32 19Z"
        fill="#381E1F"
      />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.56 0 6.77 1.23 9.28 3.64l6.91-6.91C35.99 2.33 30.37 0 24 0 14.62 0 6.51 5.38 2.56 13.22l8.03 6.23C12.5 13.55 17.77 9.5 24 9.5Z"
      />
      <path
        fill="#4285F4"
        d="M46.5 24.55c0-1.63-.14-3.2-.41-4.7H24v9.09h12.67c-.55 2.95-2.21 5.45-4.71 7.14l7.63 5.91c4.47-4.12 6.91-10.18 6.91-17.44Z"
      />
      <path
        fill="#FBBC05"
        d="M10.59 28.55A14.52 14.52 0 0 1 9.78 24c0-1.58.28-3.11.81-4.55l-8.03-6.23A24 24 0 0 0 0 24c0 3.87.92 7.53 2.56 10.78l8.03-6.23Z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.92-2.14 15.89-5.83l-7.63-5.91c-2.12 1.42-4.84 2.24-8.26 2.24-6.23 0-11.5-4.05-13.41-9.95l-8.03 6.23C6.51 42.62 14.62 48 24 48Z"
      />
    </svg>
  )
}

function SocialLoginIcon({ provider }) {
  if (provider === 'kakao') {
    return <KakaoIcon />
  }

  return <GoogleIcon />
}

export default SocialLoginIcon
