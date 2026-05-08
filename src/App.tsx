import { useState } from 'react';
import { PracticeScreen } from './components/PracticeScreen';
import { MissedWordsScreen } from './components/MissedWordsScreen';
import { CustomWordsScreen } from './components/CustomWordsScreen';

type View = 'practice' | 'missed' | 'custom-words';

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

  return (
    <PracticeScreen
      onOpenMissed={() => setView('missed')}
      onOpenCustomWords={() => setView('custom-words')}
      customWordsVersion={customWordsVersion}
    />
  );
}

export default App;
