import './Mascot.css'

/*
  Layout (viewBox 0 0 200 240)
  ─────────────────────────────
  Antenna ball  cy=28,  r=8
  Antenna post  y=36..58
  Head rect     x=58  y=58  w=84  h=82  rx=24  → x 58–142, y 58–140
  Ear ports     cx=58/142  cy=97
  Body rect     x=68  y=140 w=64  h=64  rx=16  → x 68–132, y 140–204
  Arms          x=44/130  y=150  w=26  h=48  rx=13
  Feet          x=72/106  y=204  w=24  h=16  rx=8
  Shadow        cy=234
*/

function Mascot({ className = '' }) {
  return (
    <div className={`mascot ${className}`}>
      <svg
        viewBox="0 0 200 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="mascot__svg"
        aria-label="뉴뉴 로봇 마스코트"
        role="img"
      >
        <defs>
          {/* ── Fills ── */}
          <linearGradient id="r-head" x1="18%" y1="0%" x2="82%" y2="100%">
            <stop offset="0%"   stopColor="#EDF6FF" />
            <stop offset="100%" stopColor="#B8D4F5" />
          </linearGradient>

          <linearGradient id="r-body" x1="18%" y1="0%" x2="82%" y2="100%">
            <stop offset="0%"   stopColor="#D8EEFF" />
            <stop offset="100%" stopColor="#A0C4EE" />
          </linearGradient>

          <linearGradient id="r-arm-l" x1="0%" y1="30%" x2="100%" y2="70%">
            <stop offset="0%"   stopColor="#C8DFF5" />
            <stop offset="100%" stopColor="#A8C4E8" />
          </linearGradient>

          <linearGradient id="r-arm-r" x1="100%" y1="30%" x2="0%" y2="70%">
            <stop offset="0%"   stopColor="#C8DFF5" />
            <stop offset="100%" stopColor="#A8C4E8" />
          </linearGradient>

          <linearGradient id="r-foot" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#C8DFF5" />
            <stop offset="100%" stopColor="#A0BCD8" />
          </linearGradient>

          {/* Eye iris — 4-stop deep radial */}
          <radialGradient id="r-iris" cx="36%" cy="28%" r="62%">
            <stop offset="0%"   stopColor="#C0EEFF" />
            <stop offset="22%"  stopColor="#54C0FF" />
            <stop offset="58%"  stopColor="#2070E8" />
            <stop offset="100%" stopColor="#082070" />
          </radialGradient>

          {/* Eye frame — dark metallic gradient */}
          <linearGradient id="r-eye-frame" x1="20%" y1="0%" x2="80%" y2="100%">
            <stop offset="0%"   stopColor="#243858" />
            <stop offset="100%" stopColor="#0C1828" />
          </linearGradient>

          {/* Pupil — subtle depth */}
          <radialGradient id="r-pupil" cx="44%" cy="38%" r="56%">
            <stop offset="0%"   stopColor="#1C3050" />
            <stop offset="100%" stopColor="#02080E" />
          </radialGradient>

          {/* Iris outer glow for bloom effect */}
          <radialGradient id="r-iris-bloom" cx="50%" cy="50%" r="50%">
            <stop offset="60%"  stopColor="#3182F6" stopOpacity="0"   />
            <stop offset="100%" stopColor="#3182F6" stopOpacity="0.28" />
          </radialGradient>

          {/* Chest display */}
          <linearGradient id="r-screen" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#0C1B2C" />
            <stop offset="100%" stopColor="#071018" />
          </linearGradient>

          {/* Antenna glow aura */}
          <radialGradient id="r-aura" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#FF3B30" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#FF3B30" stopOpacity="0"   />
          </radialGradient>

          {/* Top-panel shine */}
          <linearGradient id="r-shine" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="white" stopOpacity="0.28" />
            <stop offset="100%" stopColor="white" stopOpacity="0"   />
          </linearGradient>

          {/* Shadow */}
          <radialGradient id="r-shadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#3182F6" stopOpacity="0.20" />
            <stop offset="100%" stopColor="#3182F6" stopOpacity="0"   />
          </radialGradient>
        </defs>

        {/* ── Ground shadow ── */}
        <ellipse
          cx="100" cy="234" rx="40" ry="7"
          fill="url(#r-shadow)"
          className="mascot__shadow"
        />

        {/* ════════════════════════════
            FLOATING GROUP
        ════════════════════════════ */}
        <g className="mascot__float">

          {/* ── Antenna ── */}
          {/* Glow aura (drawn first, behind ball) */}
          <circle cx="100" cy="28" r="14" fill="url(#r-aura)" className="mascot__antenna-aura" />
          {/* Post — base hidden by head */}
          <rect x="97" y="36" width="6" height="24" rx="3" fill="#A8C4E0" />
          {/* Ball */}
          <circle cx="100" cy="28" r="8"   fill="#FF3B30" className="mascot__antenna-ball" />
          <circle cx="97"  cy="25" r="2.8" fill="white" opacity="0.55" />

          {/* ── Arms (behind body — drawn before body) ── */}
          <g className="mascot__arm-left">
            <rect x="44" y="150" width="26" height="48" rx="13" fill="url(#r-arm-l)" />
            <rect x="44" y="150" width="26" height="48" rx="13"
              fill="none" stroke="#A0BEDD" strokeWidth="1.2" />
            {/* Arm shine */}
            <ellipse cx="54" cy="164" rx="5" ry="10" fill="url(#r-shine)" />
            {/* Joint ring at shoulder */}
            <ellipse cx="57" cy="152" rx="10" ry="5" fill="#C0D8EE" opacity="0.6" />
          </g>

          <g className="mascot__arm-right">
            <rect x="130" y="150" width="26" height="48" rx="13" fill="url(#r-arm-r)" />
            <rect x="130" y="150" width="26" height="48" rx="13"
              fill="none" stroke="#A0BEDD" strokeWidth="1.2" />
            <ellipse cx="146" cy="164" rx="5" ry="10" fill="url(#r-shine)" />
            <ellipse cx="143" cy="152" rx="10" ry="5" fill="#C0D8EE" opacity="0.6" />
          </g>

          {/* ── Feet (behind body) ── */}
          <rect x="72"  y="204" width="24" height="16" rx="8" fill="url(#r-foot)" />
          <rect x="72"  y="204" width="24" height="16" rx="8"
            fill="none" stroke="#A0BEDD" strokeWidth="1" />
          <rect x="104" y="204" width="24" height="16" rx="8" fill="url(#r-foot)" />
          <rect x="104" y="204" width="24" height="16" rx="8"
            fill="none" stroke="#A0BEDD" strokeWidth="1" />
          {/* Foot top shine */}
          <ellipse cx="84"  cy="208" rx="7" ry="2.5" fill="white" opacity="0.20" />
          <ellipse cx="116" cy="208" rx="7" ry="2.5" fill="white" opacity="0.20" />

          {/* ── Body ── */}
          <rect x="68" y="140" width="64" height="64" rx="16" fill="url(#r-body)" />
          <rect x="68" y="140" width="64" height="64" rx="16"
            fill="none" stroke="#A0BEDD" strokeWidth="1.2" />
          {/* Body top shine */}
          <ellipse cx="100" cy="150" rx="22" ry="7" fill="url(#r-shine)" />
          {/* Body horizontal divider */}
          <line x1="72" y1="160" x2="128" y2="160"
            stroke="#B8D0EA" strokeWidth="0.8" opacity="0.55" />
          {/* Bottom-corner bolts */}
          <circle cx="81"  cy="195" r="3.2" fill="#C8DFF5" />
          <circle cx="81"  cy="195" r="3.2" fill="none" stroke="#98B8D8" strokeWidth="0.8" />
          <circle cx="119" cy="195" r="3.2" fill="#C8DFF5" />
          <circle cx="119" cy="195" r="3.2" fill="none" stroke="#98B8D8" strokeWidth="0.8" />

          {/* ── Chest display screen ── */}
          {/* Bezel (slightly larger than screen) */}
          <rect x="76" y="148" width="48" height="36" rx="9" fill="#1B3050" />
          {/* Screen */}
          <rect x="78" y="150" width="44" height="32" rx="7" fill="url(#r-screen)" />
          {/* Screen border glow */}
          <rect x="78" y="150" width="44" height="32" rx="7"
            fill="none" stroke="#3182F6" strokeWidth="1.2" opacity="0.70" />
          {/* Signal bars — left cluster */}
          <rect x="84" y="169" width="3.5" height="5"  rx="1.75" fill="#3182F6" opacity="0.50" />
          <rect x="89" y="166" width="3.5" height="8"  rx="1.75" fill="#3182F6" opacity="0.72" />
          <rect x="94" y="163" width="3.5" height="11" rx="1.75" fill="#3182F6" />
          {/* 뉴뉴 label */}
          <text
            x="102" y="172"
            fontSize="10" fontWeight="700" fill="#3182F6"
            fontFamily="'Pretendard Variable', Pretendard, 'Apple SD Gothic Neo', sans-serif"
          >뉴뉴</text>
          {/* Scan line */}
          <rect x="79" y="153" width="42" height="1.2" rx="0.6"
            fill="#3182F6" opacity="0.14" className="mascot__scanline" />

          {/* ── Head ── */}
          <rect x="58" y="58" width="84" height="82" rx="24" fill="url(#r-head)" />
          <rect x="58" y="58" width="84" height="82" rx="24"
            fill="none" stroke="#A0BEDD" strokeWidth="1.2" />
          {/* Head top shine */}
          <ellipse cx="90" cy="70" rx="30" ry="11" fill="url(#r-shine)" />
          {/* Forehead panel divider */}
          <line x1="62" y1="82" x2="138" y2="82"
            stroke="#B8D0EA" strokeWidth="0.8" opacity="0.50" />
          {/* Forehead LED row */}
          <circle cx="90"  cy="74" r="2.5" fill="#3182F6" opacity="0.55" />
          <circle cx="100" cy="74" r="2.5" fill="#3182F6" opacity="0.80" className="mascot__led-center" />
          <circle cx="110" cy="74" r="2.5" fill="#3182F6" opacity="0.55" />

          {/* ── Ear ports ── */}
          {/* Left */}
          <circle cx="58"  cy="97" r="8" fill="#C8DFF5" />
          <circle cx="58"  cy="97" r="8" fill="none" stroke="#A0BEDD" strokeWidth="1.2" />
          <circle cx="58"  cy="97" r="4" fill="#B0CCE8" />
          {/* Right */}
          <circle cx="142" cy="97" r="8" fill="#C8DFF5" />
          <circle cx="142" cy="97" r="8" fill="none" stroke="#A0BEDD" strokeWidth="1.2" />
          <circle cx="142" cy="97" r="4" fill="#B0CCE8" />

          {/* ══ Left eye ══ */}
          <g className="mascot__eye-left">
            {/* 1. Outer bloom glow */}
            <circle cx="82" cy="101" r="23" fill="url(#r-iris-bloom)" />
            {/* 2. Outer metallic frame */}
            <circle cx="82" cy="101" r="20" fill="url(#r-eye-frame)" />
            {/* 3. Frame accent border — blue rim light */}
            <circle cx="82" cy="101" r="20"
              fill="none" stroke="#2C72D8" strokeWidth="2" opacity="0.70" />
            {/* 4. Inner screen bezel */}
            <circle cx="82" cy="101" r="17" fill="#060F1C" />
            {/* 5. Iris */}
            <circle cx="82" cy="101" r="14.5" fill="url(#r-iris)" />
            {/* 6. Iris outer edge glow ring */}
            <circle cx="82" cy="101" r="14.5"
              fill="none" stroke="#58C0FF" strokeWidth="1.2" opacity="0.38" />
            {/* 7. Targeting ring 1 */}
            <circle cx="82" cy="101" r="10.5"
              fill="none" stroke="#38A0EE" strokeWidth="0.9" opacity="0.35" />
            {/* 8. Targeting ring 2 */}
            <circle cx="82" cy="101" r="7"
              fill="none" stroke="#68D0FF" strokeWidth="0.7" opacity="0.22" />
            {/* 9. Pupil */}
            <circle cx="82.5" cy="100" r="8" fill="url(#r-pupil)" />
            {/* 10. Pupil core */}
            <circle cx="82.5" cy="100" r="4.5" fill="#030A12" />

            {/* ── Eyelid arc (top ridge) ── */}
            <path d="M63 92 Q82 83 101 92"
              fill="none" stroke="#0E1E30" strokeWidth="5" strokeLinecap="round" />
            <path d="M65 93 Q82 85 99 93"
              fill="none" stroke="#3870CC" strokeWidth="1" strokeLinecap="round" opacity="0.30" />

            {/* ── Highlights ── */}
            {/* Main shine — large upper-right */}
            <circle cx="88" cy="94" r="5" fill="white" />
            {/* Cross sparkle through main shine */}
            <line x1="88" y1="90" x2="88" y2="98"
              stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.65" />
            <line x1="84" y1="94" x2="92" y2="94"
              stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.65" />
            {/* Secondary shine — lower-left */}
            <circle cx="76" cy="108" r="3" fill="white" opacity="0.40" />
            {/* Bottom reflection arc */}
            <path d="M73 110 Q82 115 91 110"
              fill="none" stroke="white" strokeWidth="1.4" strokeLinecap="round" opacity="0.20" />
            {/* Accent micro-dots */}
            <circle cx="90" cy="105" r="1.4" fill="white" opacity="0.32" />
            <circle cx="77" cy="94"  r="0.9" fill="white" opacity="0.25" />
          </g>

          {/* ══ Right eye ══ */}
          <g className="mascot__eye-right">
            {/* 1. Outer bloom glow */}
            <circle cx="118" cy="101" r="23" fill="url(#r-iris-bloom)" />
            {/* 2. Outer metallic frame */}
            <circle cx="118" cy="101" r="20" fill="url(#r-eye-frame)" />
            {/* 3. Frame accent border */}
            <circle cx="118" cy="101" r="20"
              fill="none" stroke="#2C72D8" strokeWidth="2" opacity="0.70" />
            {/* 4. Inner screen bezel */}
            <circle cx="118" cy="101" r="17" fill="#060F1C" />
            {/* 5. Iris */}
            <circle cx="118" cy="101" r="14.5" fill="url(#r-iris)" />
            {/* 6. Iris outer edge glow ring */}
            <circle cx="118" cy="101" r="14.5"
              fill="none" stroke="#58C0FF" strokeWidth="1.2" opacity="0.38" />
            {/* 7. Targeting ring 1 */}
            <circle cx="118" cy="101" r="10.5"
              fill="none" stroke="#38A0EE" strokeWidth="0.9" opacity="0.35" />
            {/* 8. Targeting ring 2 */}
            <circle cx="118" cy="101" r="7"
              fill="none" stroke="#68D0FF" strokeWidth="0.7" opacity="0.22" />
            {/* 9. Pupil */}
            <circle cx="118.5" cy="100" r="8" fill="url(#r-pupil)" />
            {/* 10. Pupil core */}
            <circle cx="118.5" cy="100" r="4.5" fill="#030A12" />

            {/* ── Eyelid arc ── */}
            <path d="M99 92 Q118 83 137 92"
              fill="none" stroke="#0E1E30" strokeWidth="5" strokeLinecap="round" />
            <path d="M101 93 Q118 85 135 93"
              fill="none" stroke="#3870CC" strokeWidth="1" strokeLinecap="round" opacity="0.30" />

            {/* ── Highlights ── */}
            <circle cx="124" cy="94" r="5" fill="white" />
            <line x1="124" y1="90" x2="124" y2="98"
              stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.65" />
            <line x1="120" y1="94" x2="128" y2="94"
              stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.65" />
            <circle cx="112" cy="108" r="3" fill="white" opacity="0.40" />
            <path d="M109 110 Q118 115 127 110"
              fill="none" stroke="white" strokeWidth="1.4" strokeLinecap="round" opacity="0.20" />
            <circle cx="126" cy="105" r="1.4" fill="white" opacity="0.32" />
            <circle cx="113" cy="94"  r="0.9" fill="white" opacity="0.25" />
          </g>

          {/* ── Mouth — LED smile arc ── */}
          <path d="M86 124 Q100 134 114 124"
            fill="none" stroke="#3182F6" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M86 124 Q100 134 114 124"
            fill="none" stroke="white" strokeWidth="1.1" strokeLinecap="round" opacity="0.28" />

        </g>{/* end mascot__float */}

        {/* ── Sparkles (independent) ── */}
        <circle cx="162" cy="46"  r="5.5" fill="#3182F6" opacity="0.16" className="mascot__sparkle mascot__sparkle--1" />
        <circle cx="28"  cy="70"  r="3.5" fill="#3182F6" opacity="0.13" className="mascot__sparkle mascot__sparkle--2" />
        <circle cx="180" cy="118" r="3.2" fill="#FF9500" opacity="0.28" className="mascot__sparkle mascot__sparkle--3" />
        <circle cx="12"  cy="136" r="4"   fill="#34C759" opacity="0.17" className="mascot__sparkle mascot__sparkle--4" />
        <circle cx="172" cy="180" r="3"   fill="#A8CAFE" opacity="0.38" className="mascot__sparkle mascot__sparkle--5" />
        <circle cx="16"  cy="188" r="3"   fill="#3182F6" opacity="0.15" className="mascot__sparkle mascot__sparkle--6" />
        {/* 4-point star right */}
        <path
          d="M176 62 L177.5 65.5 L181 66 L177.5 66.5 L176 70 L174.5 66.5 L171 66 L174.5 65.5 Z"
          fill="#FFB300" opacity="0.44"
          className="mascot__sparkle mascot__sparkle--3"
        />
        {/* 4-point star left */}
        <path
          d="M20 110 L21.2 113 L24 113.5 L21.2 114 L20 117 L18.8 114 L16 113.5 L18.8 113 Z"
          fill="#A8CAFE" opacity="0.48"
          className="mascot__sparkle mascot__sparkle--5"
        />

        {/* ── 뉴뉴 badge (independent bob) ── */}
        <g className="mascot__badge">
          <rect x="132" y="52" width="56" height="24" rx="12"
            fill="white" stroke="#E0ECFF" strokeWidth="1.5" />
          <circle cx="145" cy="64" r="5" fill="#3182F6" opacity="0.90" />
          <text
            x="154" y="69"
            fontSize="11.5" fontWeight="700" fill="#3182F6"
            fontFamily="'Pretendard Variable', Pretendard, 'Apple SD Gothic Neo', sans-serif"
          >뉴뉴</text>
        </g>

      </svg>
    </div>
  )
}

export default Mascot
