'use client';

import { motion } from 'framer-motion';

interface SquishyCardProps {
  badge: string;
  title: React.ReactNode;
  description: string;
  subtext?: string;
  errorText?: string | null;
  imageSrc?: string;
  imageAlt?: string;
  imageFit?: 'contain' | 'cover';
  primaryLabel: string;
  secondaryLabel?: string;
  loading?: boolean;
  onPrimary: () => void;
  onSecondary?: () => void;
  /** Default: no scale/lift on hover. Background elements still animate. */
  enableHoverScale?: boolean;
}

export function SquishyCard({
  badge,
  title,
  description,
  subtext,
  errorText,
  imageSrc,
  imageAlt = '',
  imageFit = 'contain',
  primaryLabel,
  secondaryLabel,
  loading = false,
  onPrimary,
  onSecondary,
  enableHoverScale = false,
}: SquishyCardProps) {
  const scopeClass = 'aladdin-squishy-card';
  const hoverScale = enableHoverScale ? 1.05 : 1;

  return (
    <motion.div
      whileHover="hover"
      transition={{
        duration: 1,
        ease: 'backInOut',
      }}
      variants={{
        hover: {
          scale: hoverScale,
        },
      }}
      className={scopeClass}
      style={{
        position: 'relative',
        width: 380,
        minHeight: 460,
        overflow: 'hidden',
        borderRadius: 18,
        background: '#f7bfd3',
        padding: 28,
        boxShadow: '0 30px 70px rgba(0, 0, 0, 0.32)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <style>{`
        .${scopeClass} { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; }
        .${scopeClass}, .${scopeClass} * { box-sizing: border-box; }
        .${scopeClass} p { margin: 0; }
        .${scopeClass} img { display: block; }
        .${scopeClass} button { all: unset; box-sizing: border-box; }
        .${scopeClass} button:focus-visible { outline: 2px solid rgba(255,255,255,0.92); outline-offset: 3px; }
        .${scopeClass} .sadLine {
          display: block;
          width: 100%;
          text-align: center;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 18px;
          line-height: 1.1;
          font-weight: 900;
          letter-spacing: -0.01em;
          color: rgba(35, 24, 20, 0.92);
          text-shadow: 0 8px 24px rgba(0,0,0,0.10);
          margin-top: 2px;
          background: transparent !important;
          padding: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
        }
        .${scopeClass} .title {
          margin: 0;
          transform-origin: top left;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 40px;
          line-height: 1.06;
          font-weight: 900;
          color: #231814;
          letter-spacing: -0.01em;
          text-shadow: 0 8px 24px rgba(0,0,0,0.12);
        }
        .${scopeClass} .imageWrap {
          width: 140px;
          height: 140px;
          border-radius: 50%;
          overflow: hidden;
          background: #ffffff;
          border: 6px solid rgba(255,255,255,0.86);
          box-shadow: 0 18px 44px rgba(0,0,0,0.18);
          margin: 4px auto 8px;
        }
        .${scopeClass} .bodyText {
          color: rgba(35, 24, 20, 0.88);
          font-size: 14px;
          line-height: 1.55;
          font-weight: 650;
          text-shadow: 0 10px 30px rgba(255,255,255,0.32);
        }
        .${scopeClass} .subtext {
          margin-top: 8px;
          color: rgba(35, 24, 20, 0.68);
          font-weight: 600;
          font-size: 13px;
          line-height: 1.45;
          text-shadow: 0 10px 30px rgba(255,255,255,0.26);
        }
        .${scopeClass} .error {
          margin-top: 8px;
          color: #7a1d2d;
          font-weight: 800;
          font-size: 13px;
          text-shadow: 0 10px 30px rgba(255,255,255,0.32);
        }
        .${scopeClass} .actions { display: flex; flex-direction: column; gap: 10px; }
        .${scopeClass} .btnPrimary {
          width: 100%;
          border-radius: 12px;
          border: 2px solid rgba(255,255,255,0.95);
          background: rgba(255,255,255,0.92);
          padding: 12px 12px;
          text-align: center;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #231814;
          cursor: pointer;
          transition: background 140ms ease, color 140ms ease, opacity 140ms ease;
        }
        .${scopeClass} .btnPrimary:hover { background: rgba(255,255,255,0.55); }
        .${scopeClass} .btnSecondary {
          width: 100%;
          border-radius: 12px;
          border: 1px solid rgba(35, 24, 20, 0.22);
          background: rgba(255,255,255,0.16);
          padding: 10px 12px;
          text-align: center;
          font-size: 12px;
          font-weight: 650;
          color: rgba(35, 24, 20, 0.78);
          cursor: pointer;
          transition: background 140ms ease, opacity 140ms ease;
          backdrop-filter: blur(8px);
        }
        .${scopeClass} .btnSecondary:hover { background: rgba(255,255,255,0.26); }
        .${scopeClass} .disabled { cursor: default !important; opacity: 0.60 !important; }
      `}</style>

      <Background />

      <div style={{ position: 'relative', zIndex: 10, color: '#ffffff', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <motion.div
          initial={{ scale: 0.88 }}
          variants={{
            hover: {
              scale: 1,
            },
          }}
          transition={{
            duration: 1,
            ease: 'backInOut',
          }}
          className="title"
        >
          {title}
        </motion.div>

        {imageSrc ? (
          <div className="imageWrap" aria-hidden>
            <img
              src={imageSrc}
              alt={imageAlt}
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                objectFit: imageFit,
                objectPosition: 'center',
              }}
            />
          </div>
        ) : null}

        <span className="sadLine" style={{ fontSize: '22px', marginBottom: '10px', marginTop: '-5px', letterSpacing: '-0.5px', wordSpacing: '-2px' }}>{badge}</span>

        <div className="bodyText">
          <p>{description}</p>
          {subtext ? <p className="subtext">{subtext}</p> : null}
          {errorText ? <p className="error">{errorText}</p> : null}
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 20, marginTop: 'auto' }} className="actions">
        {secondaryLabel && onSecondary ? (
          <button
            type="button"
            onClick={onSecondary}
            disabled={loading}
            className={`btnSecondary${loading ? ' disabled' : ''}`}
          >
            {secondaryLabel}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onPrimary}
          disabled={loading}
          className={`btnPrimary${loading ? ' disabled' : ''}`}
        >
          {primaryLabel}
        </button>
      </div>
    </motion.div>
  );
}

const Background = () => {
  return (
    <motion.svg
      width="320"
      height="460"
      viewBox="0 0 320 460"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}
      variants={{
        hover: {
          scale: 1.5,
        },
      }}
      transition={{
        duration: 1,
        ease: 'backInOut',
      }}
    >
      <motion.circle
        variants={{
          hover: {
            scaleY: 0.5,
            y: -25,
          },
        }}
        transition={{
          duration: 1,
          ease: 'backInOut',
          delay: 0.2,
        }}
        cx="224"
        cy="58"
        r="101.5"
        fill="#231814"
        opacity="0.14"
      />
      <motion.ellipse
        variants={{
          hover: {
            scaleY: 2.25,
            y: -25,
          },
        }}
        transition={{
          duration: 1,
          ease: 'backInOut',
          delay: 0.2,
        }}
        cx="204"
        cy="292"
        rx="101.5"
        ry="43.5"
        fill="#231814"
        opacity="0.14"
      />
    </motion.svg>
  );
};

export default SquishyCard;
