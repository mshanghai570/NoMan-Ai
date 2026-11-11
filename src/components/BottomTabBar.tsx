import React from 'react';
import { Sparkles, Video, MessageSquareText, Cpu, FolderHeart, Sliders } from 'lucide-react';
import { haptic } from '../utils/haptics';

export type TabDestination = 'generate' | 'video' | 'chat' | 'local' | 'library' | 'settings';

interface BottomTabBarProps {
  activeTab: TabDestination;
  onTabChange: (tab: TabDestination) => void;
  savedCount: number;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  activeTab,
  onTabChange,
  savedCount,
}) => {
  const tabs = [
    {
      id: 'generate' as TabDestination,
      label: 'Studio',
      icon: Sparkles,
    },
    {
      id: 'video' as TabDestination,
      label: 'Video',
      icon: Video,
    },
    {
      id: 'chat' as TabDestination,
      label: 'Roleplay',
      icon: MessageSquareText,
    },
    {
      id: 'local' as TabDestination,
      label: 'GPU',
      icon: Cpu,
    },
    {
      id: 'library' as TabDestination,
      label: 'Library',
      icon: FolderHeart,
      badge: savedCount > 0 ? savedCount : undefined,
    },
    {
      id: 'settings' as TabDestination,
      label: 'Settings',
      icon: Sliders,
    },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 pb-safe bg-slate-950/90 backdrop-blur-xl border-t border-slate-800/80 transition-all select-none"
      role="navigation"
      aria-label="Main Navigation"
    >
      <div className="max-w-md md:max-w-xl mx-auto grid grid-cols-6 items-center h-16 px-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => {
                haptic.trigger('selection');
                onTabChange(tab.id);
              }}
              className={`relative flex flex-col items-center justify-center h-full min-h-[44px] py-1 transition-all group ${
                isActive ? 'text-cyan-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative flex items-center justify-center">
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 ${
                    isActive ? 'scale-110 stroke-[2.25px]' : 'scale-100 group-hover:scale-105'
                  }`}
                />
                {tab.badge !== undefined && (
                  <span className="absolute -top-1 -right-2 px-1 min-w-[15px] h-[15px] rounded-full bg-cyan-500 text-[9px] font-bold text-slate-950 flex items-center justify-center">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] mt-1 tracking-tight truncate max-w-[64px] transition-colors ${
                isActive ? 'text-cyan-400' : 'text-slate-400'
              }`}>
                {tab.label}
              </span>

              {/* iOS active indicator bar */}
              {isActive && (
                <div className="absolute top-0 w-8 h-[2px] rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
