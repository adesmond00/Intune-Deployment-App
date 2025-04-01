/**
 * ThemeContext
 *
 * Provides a context for managing the application's theme (light/dark).
 * It stores the current theme and provides a function to toggle it.
 * It also handles applying/removing the 'dark' class to the HTML element.
 */
import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';

// Define the shape of the context data
interface ThemeContextProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

// Create the context with a default value (or undefined if you prefer to check for provider)
const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

/**
 * Custom hook to use the ThemeContext.
 * Ensures the context is used within a ThemeProvider.
 */
export const useTheme = (): ThemeContextProps => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

/**
 * Props for the ThemeProvider component.
 */
interface ThemeProviderProps {
  children: ReactNode; // Allow wrapping components
}

/**
 * ThemeProvider Component
 *
 * Manages the theme state ('light' or 'dark'), persists it to localStorage,
 * applies the 'dark' class to the HTML element, and provides the theme
 * and toggle function to consuming components via context.
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // Initialize state, trying to read from localStorage first, defaulting to 'light'
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const storedTheme = localStorage.getItem('theme');
    // Add basic validation in case localStorage has invalid data
    if (storedTheme === 'light' || storedTheme === 'dark') {
      return storedTheme;
    }
    // Default to light theme if nothing stored or invalid
    return 'light';
  });

  // Effect to apply/remove the 'dark' class and update localStorage when theme changes
  useEffect(() => {
    const root = window.document.documentElement; // Get the <html> element
    root.classList.remove(theme === 'light' ? 'dark' : 'light'); // Remove the opposite class
    root.classList.add(theme); // Add the current theme class
    localStorage.setItem('theme', theme); // Persist the theme choice
  }, [theme]); // Re-run this effect whenever the theme state changes

  // Function to toggle the theme
  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  // Provide the theme state and toggle function to children
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
