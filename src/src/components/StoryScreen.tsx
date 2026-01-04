import ReactMarkdown from 'react-markdown';
import { getImageUrl } from '../utils/imagePath';
import type { StoryScreen as StoryScreenType, IntroSettings } from '../types/game';

interface StoryScreenProps {
  screen: StoryScreenType;
  settings: IntroSettings;
  currentIndex: number;
  totalScreens: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

export function StoryScreen({
  screen,
  settings,
  currentIndex,
  totalScreens,
  onNext,
  onBack,
  onSkip,
}: StoryScreenProps) {
  const backgroundStyle = screen.backgroundImage
    ? { backgroundImage: `url(${getImageUrl(screen.backgroundImage)})` }
    : undefined;

  const isLastScreen = currentIndex === totalScreens - 1;

  return (
    <div className="intro-screen story-screen" style={backgroundStyle}>
      <div className="intro-overlay" />
      <div className="story-content">
        {screen.title && <h2 className="story-title">{screen.title}</h2>}
        <div className="story-text">
          <ReactMarkdown>{screen.content}</ReactMarkdown>
        </div>
        <div className="story-navigation">
          <div className="story-progress">
            {currentIndex + 1} of {totalScreens}
          </div>
          <div className="story-buttons">
            {settings.allowSkip && (
              <button className="skip-button" onClick={onSkip}>
                {settings.skipButtonText}
              </button>
            )}
            <button className="back-button" onClick={onBack}>
              ← Back
            </button>
            <button className="continue-button" onClick={onNext}>
              {isLastScreen ? 'Begin Adventure' : 'Continue'} →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
