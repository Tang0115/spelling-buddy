import { useState } from 'react';
import { PracticeScreen } from './components/PracticeScreen';
import { MissedWordsScreen } from './components/MissedWordsScreen';

type View = 'practice' | 'missed';

function App() {
  const [view, setView] = useState<View>('practice');

  if (view === 'missed') {
    return <MissedWordsScreen onBack={() => setView('practice')} />;
  }
  return <PracticeScreen onOpenMissed={() => setView('missed')} />;
}

export default App;
