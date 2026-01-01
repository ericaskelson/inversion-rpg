import { useState, useEffect } from 'react';
import { CharacterSelect } from './components/CharacterSelect';
import { ScenarioPlayer } from './components/ScenarioPlayer';
import type { Character, ScenarioBundle, GameState } from './types/game';
import './App.css';

type AppState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'character-select' }
  | { phase: 'playing'; gameState: GameState };

function App() {
  const [scenarios, setScenarios] = useState<ScenarioBundle | null>(null);
  const [appState, setAppState] = useState<AppState>({ phase: 'loading' });

  // Load scenarios on mount
  useEffect(() => {
    fetch('/scenarios.json')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load scenarios');
        return res.json();
      })
      .then((data: ScenarioBundle) => {
        setScenarios(data);
        setAppState({ phase: 'character-select' });
      })
      .catch(err => {
        setAppState({ phase: 'error', message: err.message });
      });
  }, []);

  const findStartScenario = (): string | null => {
    if (!scenarios) return null;
    const start = Object.values(scenarios).find(s => s.isStart);
    return start?.id ?? null;
  };

  const handleCharacterSelect = (character: Character) => {
    const startId = findStartScenario();
    if (!startId) {
      setAppState({ phase: 'error', message: 'No start scenario found' });
      return;
    }

    setAppState({
      phase: 'playing',
      gameState: {
        character,
        currentScenarioId: startId,
        history: [startId],
      },
    });
  };

  const handleChoice = (nextScenarioId: string) => {
    if (appState.phase !== 'playing') return;

    setAppState({
      phase: 'playing',
      gameState: {
        ...appState.gameState,
        currentScenarioId: nextScenarioId,
        history: [...appState.gameState.history, nextScenarioId],
      },
    });
  };

  const handleRestart = () => {
    setAppState({ phase: 'character-select' });
  };

  // Render based on state
  if (appState.phase === 'loading') {
    return <div className="loading">Loading scenarios...</div>;
  }

  if (appState.phase === 'error') {
    return (
      <div className="error">
        <h1>Error</h1>
        <p>{appState.message}</p>
      </div>
    );
  }

  if (appState.phase === 'character-select') {
    return <CharacterSelect onSelect={handleCharacterSelect} />;
  }

  if (appState.phase === 'playing' && scenarios) {
    const currentScenario = scenarios[appState.gameState.currentScenarioId];
    if (!currentScenario) {
      return (
        <div className="error">
          <h1>Error</h1>
          <p>Scenario not found: {appState.gameState.currentScenarioId}</p>
        </div>
      );
    }

    return (
      <div className="game-container">
        <header className="game-header">
          <span className="character-name">{appState.gameState.character.name}</span>
          <span className="step-counter">Step {appState.gameState.history.length}</span>
        </header>
        <ScenarioPlayer
          scenario={currentScenario}
          character={appState.gameState.character}
          onChoice={handleChoice}
          onRestart={handleRestart}
        />
      </div>
    );
  }

  return null;
}

export default App;
