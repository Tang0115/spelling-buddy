import { useState } from 'react';
import { PracticeScreen } from './components/PracticeScreen';
import { MissedWordsScreen } from './components/MissedWordsScreen';
import { CustomWordsScreen } from './components/CustomWordsScreen';
import { StatsScreen } from './components/StatsScreen';

type View = 'practice' | 'missed' | 'custom-words' | 'stats';

function App() {
  const [view, setView] = useState<View>('practice');
  const [customWordsVersion, setCustomWordsVersion] = useState(0);

  if (view === 'missed') {
    return <MissedWordsScreen onBack={() => setView('practice')} />;
  }

  if (view === 'custom-words') {
    return (
      <CustomWordsScreen
        onBack={() => {
          setCustomWordsVersion((v) => v + 1);
          setView('practice');
        }}
      />
    );
  }

  if (view === 'stats') {
    return <StatsScreen onBack={() => setView('practice')} />;
  }

  return (
    <PracticeScreen
      onOpenMissed={() => setView('missed')}
      onOpenCustomWords={() => setView('custom-words')}
      onOpenStats={() => setView('stats')}
      customWordsVersion={customWordsVersion}
    />
  );
}

export default App;
