import React, { useState, useEffect } from 'react';
import type { GenerationItem, User, UserSettings } from './types';
import {
  getStoredUser,
  saveStoredUser,
  getStoredSettings,
  saveStoredSettings,
  getStoredGenerations,
  saveStoredGenerations,
  exportUserData,
  importUserData,
} from './services/storage';
import { haptic } from './utils/haptics';

import { TopBar } from './components/TopBar';
import { BottomTabBar, type TabDestination } from './components/BottomTabBar';
import { ImageStudioView } from './components/ImageStudioView';
import { VideoStudioView } from './components/VideoStudioView';
import { ChatView } from './components/ChatView';
import { LocalModelsView } from './components/LocalModelsView';
import { LibraryView } from './components/LibraryView';
import { SettingsView } from './components/SettingsView';
import { AuthModal } from './components/AuthModal';
import { PwaInstallModal } from './components/PwaInstallModal';
import { ThemeStudioModal } from './components/ThemeStudioModal';
import { applyThemeToDocument } from './utils/themeManager';

export default function App() {
  const [user, setUser] = useState<User>(() => getStoredUser());
  const [settings, setSettings] = useState<UserSettings>(() => getStoredSettings());
  const [generations, setGenerations] = useState<GenerationItem[]>(() => getStoredGenerations());

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<TabDestination>('generate');

  // Cross-tab transfer states
  const [preloadedStudioPrompt, setPreloadedStudioPrompt] = useState<string | undefined>(undefined);
  const [preloadedStudioNsfw, setPreloadedStudioNsfw] = useState(false);
  const [preloadedVideoImage, setPreloadedVideoImage] = useState<string | undefined>(undefined);
  const [preloadedVideoPrompt, setPreloadedVideoPrompt] = useState<string | undefined>(undefined);
  const [preloadedExtendItem, setPreloadedExtendItem] = useState<GenerationItem | undefined>(undefined);

  // Modals
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isPwaInstallOpen, setIsPwaInstallOpen] = useState(false);
  const [isThemeStudioOpen, setIsThemeStudioOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Apply theme & typography on mount and settings changes
  useEffect(() => {
    applyThemeToDocument(settings);
  }, [
    settings.theme,
    settings.fontFamily,
    settings.fontHeading,
    settings.fontMono,
    settings.fontSizeScale,
    settings.activeCustomTheme,
  ]);

  // Sync haptic preference
  useEffect(() => {
    haptic.setEnabled(settings.hapticFeedback);
  }, [settings.hapticFeedback]);

  // Persist settings changes
  const handleUpdateSettings = (newSettings: Partial<UserSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    saveStoredSettings(updated);
  };

  // Persist user changes
  const handleUpdateUser = (updatedUser: User) => {
    setUser(updatedUser);
    saveStoredUser(updatedUser);
    showToast(`Logged in as ${updatedUser.displayName}`);
  };

  // Save new generation to library
  const handleSaveGeneration = (item: GenerationItem) => {
    setGenerations((prev) => {
      // Check if item already exists by ID
      const exists = prev.some((i) => i.id === item.id);
      const updated = exists ? prev.map((i) => (i.id === item.id ? item : i)) : [item, ...prev];
      saveStoredGenerations(updated);
      return updated;
    });
    showToast(item.type === 'video' ? 'Video saved to Library' : 'Image saved to Library');
  };

  // Delete from library
  const handleDeleteItem = (id: string) => {
    setGenerations((prev) => {
      const updated = prev.filter((i) => i.id !== id);
      saveStoredGenerations(updated);
      return updated;
    });
    showToast('Asset deleted from collection');
  };

  // Batch delete multiple creations from library
  const handleDeleteMultiple = (ids: string[]) => {
    const toDeleteSet = new Set(ids);
    setGenerations((prev) => {
      const updated = prev.filter((i) => !toDeleteSet.has(i.id));
      saveStoredGenerations(updated);
      return updated;
    });
    showToast(`Deleted ${ids.length} creation${ids.length > 1 ? 's' : ''} from collection`);
  };

  // Clear all creations from library
  const handleClearAll = () => {
    setGenerations([]);
    saveStoredGenerations([]);
    showToast('All collected creations deleted from library');
  };

  // Toggle favorite
  const handleToggleFavorite = (id: string) => {
    setGenerations((prev) => {
      const updated = prev.map((item) =>
        item.id === id ? { ...item, isFavorite: !item.isFavorite } : item
      );
      saveStoredGenerations(updated);
      return updated;
    });
  };

  // Switch to Image Studio with transferred prompt from Roleplay Chat
  const handleSendPromptToStudio = (prompt: string, options?: { nsfw?: boolean }) => {
    setPreloadedStudioPrompt(prompt);
    setPreloadedStudioNsfw(options?.nsfw === true);
    setActiveTab('generate');
    showToast('Character scene prompt transferred to Image Studio');
  };

  // Switch to Video Lab from Image Studio or Library
  const handleSendToVideoLab = (imageUrl: string, prompt: string) => {
    setPreloadedVideoImage(imageUrl);
    setPreloadedVideoPrompt(prompt);
    setPreloadedExtendItem(undefined);
    setActiveTab('video');
    showToast('Keyframe transferred to Video Lab');
  };

  // Switch to Extend Video from Library or Video Player
  const handleExtendVideo = (item: GenerationItem) => {
    setPreloadedExtendItem(item);
    setPreloadedVideoImage(undefined);
    setActiveTab('video');
    showToast('Timeline loaded into Video Extension');
  };

  // Export JSON backup
  const handleExportData = () => {
    const jsonStr = exportUserData();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `noman_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup JSON exported successfully');
  };

  // Import JSON backup
  const handleImportData = (jsonStr: string) => {
    const success = importUserData(jsonStr);
    if (success) {
      setUser(getStoredUser());
      setSettings(getStoredSettings());
      setGenerations(getStoredGenerations());
      showToast('Collection backup imported successfully');
    } else {
      showToast('Failed to import: Invalid JSON format');
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 3000);
  };

  // Determine theme background
  // Determine theme background
  const themeBackground =
    settings.theme === 'oled'
      ? 'bg-black text-slate-100'
      : settings.theme === 'navy'
      ? 'bg-slate-900 text-slate-100'
      : 'bg-slate-950 text-slate-100';

  return (
    <div
      className={`min-h-screen ${themeBackground} flex flex-col font-sans transition-colors duration-300 pb-20 sm:pb-24`}
      style={{
        backgroundColor: 'var(--theme-bg, #000000)',
        color: 'var(--theme-text, #f8fafc)',
      }}
    >
      {/* Top Navigation Bar */}
      <TopBar
        user={user}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenPwaInstall={() => setIsPwaInstallOpen(true)}
        onQuickGenerate={() => setActiveTab('generate')}
        onOpenThemeStudio={() => setIsThemeStudioOpen(true)}
        nsfwMode={settings.nsfwMode}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 w-full" role="main">
        {activeTab === 'generate' && (
          <ImageStudioView
            settings={settings}
            onSaveGeneration={handleSaveGeneration}
            onSendToVideoLab={handleSendToVideoLab}
            initialPrompt={preloadedStudioPrompt}
            initialNsfw={preloadedStudioNsfw}
            onUpdateSettings={handleUpdateSettings}
          />
        )}

        {activeTab === 'video' && (
          <VideoStudioView
            settings={settings}
            libraryItems={generations}
            preloadedImageUrl={preloadedVideoImage}
            preloadedPrompt={preloadedVideoPrompt}
            preloadedExtendItem={preloadedExtendItem}
            onSaveGeneration={handleSaveGeneration}
            onUpdateSettings={handleUpdateSettings}
          />
        )}

        {activeTab === 'chat' && (
          <ChatView
            settings={settings}
            onSendToStudio={handleSendPromptToStudio}
            onUpdateSettings={handleUpdateSettings}
            onOpenChatSettings={() => {
              setActiveTab('settings');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {activeTab === 'local' && (
          <LocalModelsView
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
          />
        )}

        {activeTab === 'library' && (
          <LibraryView
            items={generations}
            user={user}
            hfToken={settings.hfToken}
            onDeleteItem={handleDeleteItem}
            onDeleteItems={handleDeleteMultiple}
            onClearAll={handleClearAll}
            onToggleFavorite={handleToggleFavorite}
            onSendToVideoLab={handleSendToVideoLab}
            onExtendVideo={handleExtendVideo}
            onSaveGeneration={handleSaveGeneration}
            onExportData={handleExportData}
            onImportData={handleImportData}
            onNavigateToCreate={(mode) => setActiveTab(mode === 'video' ? 'video' : 'generate')}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onOpenThemeStudio={() => setIsThemeStudioOpen(true)}
          />
        )}
      </main>

      {/* Fixed Bottom Tab Bar for iOS touch ergonomics */}
      <BottomTabBar
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        savedCount={generations.length}
      />

      {/* Transient Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-slate-900/90 text-cyan-300 text-xs font-semibold shadow-2xl border border-cyan-500/30 backdrop-blur-md animate-fade-in flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Modals */}
      <AuthModal
        user={user}
        itemCount={generations.length}
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onUpdateUser={handleUpdateUser}
      />

      <PwaInstallModal
        isOpen={isPwaInstallOpen}
        onClose={() => setIsPwaInstallOpen(false)}
      />

      <ThemeStudioModal
        isOpen={isThemeStudioOpen}
        onClose={() => setIsThemeStudioOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onShowToast={showToast}
      />
    </div>
  );
}
