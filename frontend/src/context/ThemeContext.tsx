import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'droid' | 'pro';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  labels: {
    competitor: string;
    competitors: string;
    garage: string;
    tag: string;
    addCompetitor: string;
    roster: string;
  };
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const labelsMap = {
  droid: {
    competitor: 'Droid',
    competitors: 'Droids',
    garage: 'Droid Garage',
    tag: 'ArUco Tag',
    addCompetitor: 'Register Droid',
    roster: 'Roster'
  },
  pro: {
    competitor: 'Competitor',
    competitors: 'Competitors',
    garage: 'Paddock',
    tag: 'Sensor ID',
    addCompetitor: 'Register Competitor',
    roster: 'Entry List'
  }
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>('droid');

  useEffect(() => {
    const fetchTheme = async () => {
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        if (data.theme) {
          setThemeState(data.theme as Theme);
          document.documentElement.setAttribute('data-theme', data.theme);
        }
      } catch {
        console.error("Failed to fetch theme");
      }
    };
    fetchTheme();
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const value = {
    theme,
    setTheme,
    labels: labelsMap[theme]
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
