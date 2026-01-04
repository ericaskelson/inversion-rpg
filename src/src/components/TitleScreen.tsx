import { getImageUrl } from '../utils/imagePath';
import type { TitleScreenConfig, IntroSettings } from '../types/game';

interface TitleScreenProps {
  config: TitleScreenConfig;
  settings: IntroSettings;
  onBegin: () => void;
  onSkip: () => void;
}

export function TitleScreen({ config, settings, onBegin, onSkip }: TitleScreenProps) {
  const backgroundStyle = config.backgroundImage
    ? { backgroundImage: `url(${getImageUrl(config.backgroundImage)})` }
    : undefined;

  return (
    <div className="intro-screen title-screen" style={backgroundStyle}>
      <div className="intro-overlay" />
      <div className="title-content">
        <h1 className="game-title">{config.title}</h1>
        {config.subtitle && <p className="game-subtitle">{config.subtitle}</p>}
        <div className="title-buttons">
          <button className="begin-button" onClick={onBegin}>
            {config.buttonText}
          </button>
          {settings.allowSkip && (
            <button className="skip-button" onClick={onSkip}>
              {settings.skipButtonText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
