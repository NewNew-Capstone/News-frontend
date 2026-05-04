import './Mascot.css'

function Mascot({ className = '' }) {
  return (
    <div className={`mascot ${className}`}>
      <svg
        viewBox="0 0 160 190"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="mascot__svg"
        aria-label="뉴뉴 마스코트"
        role="img"
      >
        {/* Shadow */}
        <ellipse
          cx="80" cy="184" rx="34" ry="6"
          fill="#3182F6" opacity="0.1"
          className="mascot__shadow"
        />

        {/* Main floating group */}
        <g className="mascot__float">

          {/* ── Ear tufts ── */}
          <path d="M50 40 L38 14 L62 32 Z" fill="#A8CAFE" />
          <path d="M110 40 L122 14 L98 32 Z" fill="#A8CAFE" />

          {/* ── Wings (behind body) ── */}
          <ellipse cx="26" cy="122" rx="20" ry="32" fill="#BDD5F7" transform="rotate(-18 26 122)" />
          {/* Left wing feather lines */}
          <path d="M18 112 Q26 108 34 118" fill="none" stroke="#A8CAFE" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
          <path d="M16 122 Q26 118 36 128" fill="none" stroke="#A8CAFE" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />

          <ellipse cx="134" cy="122" rx="20" ry="32" fill="#BDD5F7" transform="rotate(18 134 122)" />
          {/* Right wing feather lines */}
          <path d="M142 112 Q134 108 126 118" fill="none" stroke="#A8CAFE" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
          <path d="M144 122 Q134 118 124 128" fill="none" stroke="#A8CAFE" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />

          {/* ── Body ── */}
          <ellipse cx="80" cy="132" rx="44" ry="46" fill="#D6E9FF" />

          {/* ── Belly ── */}
          <ellipse cx="80" cy="140" rx="28" ry="30" fill="#EEF6FF" />

          {/* ── Head ── */}
          <circle cx="80" cy="68" r="40" fill="#D6E9FF" />

          {/* ── Forehead highlight ── */}
          <ellipse cx="80" cy="50" rx="22" ry="14" fill="#EEF6FF" opacity="0.7" />

          {/* ── Eyebrows (above glasses) ── */}
          <path d="M50 54 Q62 49 74 54" fill="none" stroke="#2B3544" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M86 54 Q98 49 110 54" fill="none" stroke="#2B3544" strokeWidth="2.2" strokeLinecap="round" />

          {/* ── Left eye group (blink animates this whole group) ── */}
          <g className="mascot__eye-left">
            <circle cx="62" cy="68" r="15" fill="white" />
            <circle cx="62" cy="68" r="15.5" fill="none" stroke="#2B3544" strokeWidth="2.5" />
            <circle cx="62" cy="68" r="9" fill="#3182F6" />
            <circle cx="64" cy="66" r="5.5" fill="#0D1B3E" />
            <circle cx="68" cy="62" r="2.8" fill="white" />
            <circle cx="60" cy="72" r="1.4" fill="white" opacity="0.6" />
          </g>

          {/* ── Right eye group (blink animates this whole group) ── */}
          <g className="mascot__eye-right">
            <circle cx="98" cy="68" r="15" fill="white" />
            <circle cx="98" cy="68" r="15.5" fill="none" stroke="#2B3544" strokeWidth="2.5" />
            <circle cx="98" cy="68" r="9" fill="#3182F6" />
            <circle cx="100" cy="66" r="5.5" fill="#0D1B3E" />
            <circle cx="104" cy="62" r="2.8" fill="white" />
            <circle cx="96" cy="72" r="1.4" fill="white" opacity="0.6" />
          </g>

          {/* ── Glasses bridge & temples (outside eye groups — not blinked) ── */}
          <line x1="76" y1="68" x2="84" y2="68" stroke="#2B3544" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M46.5 60 Q42 56 40 58" stroke="#2B3544" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path d="M113.5 60 Q118 56 120 58" stroke="#2B3544" strokeWidth="2.5" strokeLinecap="round" fill="none" />

          {/* ── Beak (larger, rounder) ── */}
          <path d="M75 80 Q80 92 85 80" fill="#FF9500" />
          <path d="M75 80 Q80 87 85 80 Q80 83 75 80 Z" fill="#E68600" />

          {/* ── Cheek blush ── */}
          <ellipse cx="44" cy="78" rx="9" ry="6" fill="#FFB3C6" opacity="0.45" />
          <ellipse cx="116" cy="78" rx="9" ry="6" fill="#FFB3C6" opacity="0.45" />

          {/* ── Tablet (news reader) ── */}
          <rect x="48" y="116" width="64" height="50" rx="6" fill="white" stroke="#D6E4F5" strokeWidth="2" />
          {/* Tablet header bar */}
          <rect x="48" y="116" width="64" height="12" rx="6" fill="#3182F6" />
          <rect x="48" y="122" width="64" height="6" rx="0" fill="#3182F6" />
          {/* Icon & text on header */}
          <rect x="53" y="119" width="16" height="6" rx="2" fill="white" opacity="0.3" />
          <rect x="73" y="120" width="20" height="3" rx="1.5" fill="white" opacity="0.4" />
          {/* Star icon on header right */}
          <path
            d="M107 119 L108.2 121.4 L110.8 122 L108.2 122.6 L107 125 L105.8 122.6 L103.2 122 L105.8 121.4 Z"
            fill="white"
            opacity="0.75"
          />
          {/* Article lines */}
          <rect x="53" y="133" width="54" height="3" rx="1.5" fill="#D0E4F7" />
          <rect x="53" y="139" width="44" height="3" rx="1.5" fill="#D0E4F7" />
          <rect x="53" y="145" width="50" height="3" rx="1.5" fill="#D0E4F7" />
          <rect x="53" y="151" width="38" height="3" rx="1.5" fill="#D0E4F7" />
          <rect x="53" y="157" width="48" height="3" rx="1.5" fill="#D0E4F7" />

          {/* ── Feet ── */}
          <path d="M62 170 L54 178 M62 170 L62 178 M62 170 L70 178" stroke="#9EC4F0" strokeWidth="3" strokeLinecap="round" />
          <path d="M98 170 L90 178 M98 170 L98 178 M98 170 L106 178" stroke="#9EC4F0" strokeWidth="3" strokeLinecap="round" />

        </g>

        {/* ── Floating sparkles ── */}
        <circle cx="136" cy="44" r="5" fill="#3182F6" opacity="0.22" className="mascot__sparkle mascot__sparkle--1" />
        <circle cx="22" cy="52" r="3.5" fill="#3182F6" opacity="0.18" className="mascot__sparkle mascot__sparkle--2" />
        <circle cx="150" cy="90" r="3" fill="#FF9500" opacity="0.38" className="mascot__sparkle mascot__sparkle--3" />
        <circle cx="10" cy="98" r="4" fill="#34C759" opacity="0.28" className="mascot__sparkle mascot__sparkle--4" />
        <circle cx="144" cy="140" r="2.5" fill="#FFB800" opacity="0.32" className="mascot__sparkle mascot__sparkle--5" />
        <circle cx="16" cy="144" r="3" fill="#3182F6" opacity="0.22" className="mascot__sparkle mascot__sparkle--6" />

        {/* ── Floating news badge ── */}
        <g className="mascot__badge">
          <rect x="106" y="26" width="46" height="22" rx="11" fill="white" stroke="#E8F0FF" strokeWidth="1.5" />
          <circle cx="118" cy="37" r="4" fill="#3182F6" opacity="0.8" />
          <rect x="126" y="33" width="20" height="3" rx="1.5" fill="#BDD5F7" />
          <rect x="126" y="39" width="14" height="2.5" rx="1.25" fill="#D6E9FF" />
        </g>
      </svg>
    </div>
  )
}

export default Mascot
