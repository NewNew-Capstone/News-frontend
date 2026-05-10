import './Mascot.css'

function Mascot({ className = '' }) {
  return (
    <div className={`mascot ${className}`}>
      <svg
        viewBox="0 0 180 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="mascot__svg"
        aria-label="뉴뉴 로봇 마스코트"
        role="img"
      >
        <ellipse
          cx="90"
          cy="188"
          rx="44"
          ry="8"
          fill="#3182F6"
          opacity="0.12"
          className="mascot__shadow"
        />

        <g className="mascot__float">
          <path
            d="M50 78C50 50 67 32 90 32s40 18 40 46"
            stroke="#B7D4FA"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray="18 14"
            className="mascot__orbit"
          />

          <line
            x1="90"
            y1="42"
            x2="90"
            y2="22"
            stroke="#91BDF8"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <circle cx="90" cy="17" r="6" fill="#3182F6" className="mascot__antenna-dot" />

          <rect x="32" y="76" width="18" height="40" rx="9" fill="#B8D5FA" />
          <rect x="130" y="76" width="18" height="40" rx="9" fill="#B8D5FA" />
          <rect x="38" y="84" width="9" height="24" rx="4.5" fill="#E7F2FF" opacity="0.72" />
          <rect x="133" y="84" width="9" height="24" rx="4.5" fill="#E7F2FF" opacity="0.72" />

          <rect
            x="46"
            y="52"
            width="88"
            height="82"
            rx="30"
            fill="#D8EAFF"
            stroke="#A7CCFA"
            strokeWidth="3"
          />
          <ellipse cx="90" cy="68" rx="29" ry="12" fill="#F4FAFF" opacity="0.76" />

          <rect
            x="60"
            y="78"
            width="60"
            height="36"
            rx="18"
            fill="white"
            stroke="#C8DFFB"
            strokeWidth="2"
          />

          <g className="mascot__eye-left">
            <circle cx="78" cy="96" r="6" fill="#1F64D8" />
            <circle cx="80" cy="94" r="2" fill="white" opacity="0.85" />
          </g>
          <g className="mascot__eye-right">
            <circle cx="102" cy="96" r="6" fill="#1F64D8" />
            <circle cx="104" cy="94" r="2" fill="white" opacity="0.85" />
          </g>

          <path
            d="M81 111Q90 117 99 111"
            stroke="#5F7EF0"
            strokeWidth="3"
            strokeLinecap="round"
          />

          <circle cx="58" cy="108" r="6" fill="#FFB3C6" opacity="0.34" />
          <circle cx="122" cy="108" r="6" fill="#FFB3C6" opacity="0.34" />

          <rect
            x="58"
            y="131"
            width="64"
            height="42"
            rx="17"
            fill="#D8EAFF"
            stroke="#A7CCFA"
            strokeWidth="3"
          />
          <rect x="72" y="141" width="36" height="6" rx="3" fill="#3182F6" opacity="0.78" />
          <rect x="78" y="154" width="24" height="4" rx="2" fill="#8CB9F7" />

          <path
            d="M59 142C45 137 40 126 44 116"
            stroke="#A7CCFA"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d="M121 142C136 137 141 126 136 116"
            stroke="#A7CCFA"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <circle cx="43" cy="115" r="6" fill="#D8EAFF" stroke="#A7CCFA" strokeWidth="3" />
          <circle cx="137" cy="115" r="6" fill="#D8EAFF" stroke="#A7CCFA" strokeWidth="3" />

          <g className="mascot__news-card">
            <rect x="108" y="122" width="48" height="38" rx="9" fill="white" stroke="#D7E6F8" strokeWidth="2" />
            <rect x="116" y="131" width="18" height="5" rx="2.5" fill="#3182F6" opacity="0.86" />
            <rect x="116" y="142" width="32" height="4" rx="2" fill="#C8DFFB" />
            <rect x="116" y="150" width="25" height="4" rx="2" fill="#D8EAFF" />
          </g>

          <path d="M73 174v11" stroke="#91BDF8" strokeWidth="5" strokeLinecap="round" />
          <path d="M107 174v11" stroke="#91BDF8" strokeWidth="5" strokeLinecap="round" />
        </g>

        <circle cx="142" cy="47" r="4" fill="#3182F6" opacity="0.22" className="mascot__sparkle mascot__sparkle--1" />
        <circle cx="34" cy="58" r="3.5" fill="#20A59C" opacity="0.24" className="mascot__sparkle mascot__sparkle--2" />
        <circle cx="151" cy="88" r="3" fill="#F5C84C" opacity="0.48" className="mascot__sparkle mascot__sparkle--3" />
        <circle cx="24" cy="132" r="4" fill="#3182F6" opacity="0.20" className="mascot__sparkle mascot__sparkle--4" />
      </svg>
    </div>
  )
}

export default Mascot
