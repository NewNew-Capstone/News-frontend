import HeroChromeScene from './HeroChromeScene'
import './HomeSection.css'

const CUBE_FACE_NAMES = ['front', 'back', 'right', 'left', 'top', 'bottom']
const DEFAULT_FACE_POSITIONS = ['50% 50%', '50% 45%', '82% 50%', '18% 50%', '50% 24%', '50% 76%']

function getCubeFaces(card) {
  return CUBE_FACE_NAMES.map((faceName, index) => {
    const configuredFace = Array.isArray(card.faceImages) ? card.faceImages[index] : null

    if (configuredFace && typeof configuredFace === 'object') {
      return {
        faceName,
        image: configuredFace.image || card.image,
        position: configuredFace.position || DEFAULT_FACE_POSITIONS[index],
      }
    }

    return {
      faceName,
      image: typeof configuredFace === 'string' ? configuredFace : card.image,
      position: DEFAULT_FACE_POSITIONS[index],
    }
  })
}

function HomeSection({ section, isActive, isSimple, nextHref, sectionRef }) {
  const previewFaces = !isSimple && section.card ? getCubeFaces(section.card) : []

  return (
    <section
      id={section.id}
      ref={sectionRef}
      className={`home-section ${isActive ? 'home-section--active' : ''} ${
        isSimple ? 'home-section--simple' : ''
      }`}
    >
      <div className="home-section__shell">
        {isSimple ? (
          <div className="home-section__hero-layout">
            <div className="home-section__hero-scene" aria-hidden="true">
              <HeroChromeScene />
            </div>

            <div className="home-section__hero-content">
              <div className="home-section__hero-copy">
                <h1 className="home-section__title">
                  {section.titleLines.map((line, lineIndex) => (
                    <span
                      key={line}
                      className={
                        lineIndex === section.accentLine
                          ? 'home-section__title-line home-section__title-line--accent'
                          : 'home-section__title-line'
                      }
                    >
                      {line}
                    </span>
                  ))}
                </h1>
              </div>
            </div>
          </div>
        ) : (
          <div className="home-section__content">
            <div className="home-section__motion-scene" aria-hidden="true">
              <div className="home-section__motion-grid" />
            </div>

            <div className="home-section__copy">
              {section.eyebrow ? (
                <p className="home-section__eyebrow">{section.eyebrow}</p>
              ) : null}
              <h1 className="home-section__title">
                {section.titleLines.map((line, lineIndex) => (
                  <span
                    key={line}
                    className={
                      lineIndex === section.accentLine
                        ? 'home-section__title-line home-section__title-line--accent'
                        : 'home-section__title-line'
                    }
                  >
                    {line}
                  </span>
                ))}
              </h1>

              <p className="home-section__description">{section.description}</p>

              <div className="home-section__actions">
                <a className="home-section__primary-button" href={section.primaryHref}>
                  {section.primaryLabel}
                </a>
                <a className="home-section__secondary-button" href={section.secondaryHref}>
                  {section.secondaryLabel}
                </a>
              </div>
            </div>

            {section.card ? (
              <article className="home-section__preview-card">
                <div className="home-section__preview-media">
                  <div className="home-section__preview-cube-stage" aria-hidden="true">
                    <div className="home-section__preview-cube">
                      {previewFaces.map((face) => (
                        <div
                          key={`${section.card.heading}-${face.faceName}`}
                          className={`home-section__preview-face home-section__preview-face--${face.faceName}`}
                        >
                          <div
                            className="home-section__preview-face-image"
                            style={{
                              '--face-image': `url(${face.image})`,
                              '--face-position': face.position,
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="home-section__preview-cube-shadow" />
                  </div>
                  <div className="home-section__preview-glass" aria-hidden="true" />
                </div>
              </article>
            ) : null}
          </div>
        )}

        <div className="home-section__footer">
          <a className="home-section__scroll-indicator" href={nextHref}>
            <span className="home-section__scroll-chevron" aria-hidden="true" />
          </a>
          <a className="home-section__floating-top" href="#hero" aria-label="맨 위로 이동">
            ↑
          </a>
        </div>
      </div>
    </section>
  )
}

export default HomeSection
