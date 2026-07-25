import { useEffect, useRef } from 'react';

interface Props {
  onClose: () => void;
}

export function SponsorModal({ onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Close on backdrop click
  const onOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div className="sponsor-overlay" ref={overlayRef} onClick={onOverlayClick}>
      <div className="sponsor-modal">
        <button type="button" className="sponsor-close" onClick={onClose} title="关闭">
          ✕
        </button>
        <h2 className="sponsor-title">☕ 赞助支持</h2>
        <p className="sponsor-desc">
          如果这个项目对你的教学或学习有帮助，欢迎请我喝杯咖啡 ❤️
          <br />
          你的支持是我持续改进的动力！
        </p>
        <div className="sponsor-qr-wrapper">
          <img
            src="/sponsor-qr.png"
            alt="微信赞赏码"
            className="sponsor-qr"
            onError={(e) => {
              // Fallback when QR image is not yet placed
              (e.target as HTMLImageElement).style.display = 'none';
              const fallback = (e.target as HTMLImageElement).nextElementSibling;
              if (fallback) (fallback as HTMLElement).style.display = 'block';
            }}
          />
          <p className="sponsor-qr-fallback" style={{ display: 'none' }}>
            请将你的微信赞赏码保存为 <code>public/sponsor-qr.png</code>
            <br />
            或联系作者获取赞助方式
          </p>
        </div>
        <p className="sponsor-footnote">赞赏金额随心，每一份鼓励都会被铭记 🙏</p>
      </div>
    </div>
  );
}
