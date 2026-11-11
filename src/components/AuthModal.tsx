import React, { useState } from 'react';
import type { User } from '../types';
import {
  User as UserIcon,
  ShieldCheck,
  HardDrive,
  LogOut,
  Sparkles,
  X,
  Check,
  UserPlus,
  RefreshCw,
} from 'lucide-react';
import { haptic } from '../utils/haptics';

interface AuthModalProps {
  user: User;
  itemCount: number;
  isOpen: boolean;
  onClose: () => void;
  onUpdateUser: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  user,
  itemCount,
  isOpen,
  onClose,
  onUpdateUser,
}) => {
  const [username, setUsername] = useState(user.username);
  const [displayName, setDisplayName] = useState(user.displayName);
  const [isEditing, setIsEditing] = useState(false);

  if (!isOpen) return null;

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !displayName.trim()) return;
    haptic.trigger('success');
    onUpdateUser({
      ...user,
      username: username.trim().toLowerCase().replace(/\s+/g, '_'),
      displayName: displayName.trim(),
    });
    setIsEditing(false);
  };

  const handleSwitchToGuest = () => {
    haptic.trigger('selection');
    onUpdateUser({
      id: `usr_${Date.now()}`,
      username: 'guest_creator',
      displayName: 'Guest Explorer',
      avatar: '/src/assets/images/noman_app_icon_1794392784917.jpg',
      createdAt: Date.now(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl p-5 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <UserIcon className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-white">Creator Account & Saved Workspace</h2>
          </div>
          <button
            onClick={() => {
              haptic.trigger('selection');
              onClose();
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Profile Card */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full overflow-hidden bg-slate-800 border-2 border-cyan-500/40 shrink-0">
            <img
              src={user.avatar || '/src/assets/images/noman_app_icon_1794392784917.jpg'}
              alt={user.displayName}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-white truncate">{user.displayName}</h3>
            <p className="text-xs text-cyan-400 font-mono">@{user.username}</p>
            <span className="text-[10px] text-slate-400 font-mono mt-1 block">
              Member since {new Date(user.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Storage & Saved Creations Status */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
              <span>Saved Assets</span>
            </div>
            <span className="text-lg font-bold text-white font-mono">{itemCount} Items</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Session Mode</span>
            </div>
            <span className="text-xs font-semibold text-emerald-400 mt-1 block">
              Local Vault Active
            </span>
          </div>
        </div>

        {/* Edit Profile Form */}
        {isEditing ? (
          <form onSubmit={handleSaveProfile} className="space-y-3 pt-2 border-t border-slate-800">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Display Name</label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-slate-950 text-slate-200 text-xs rounded-lg px-3 py-2 border border-slate-800 focus:border-cyan-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Username Handle</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-950 text-slate-200 text-xs rounded-lg px-3 py-2 border border-slate-800 focus:border-cyan-400 focus:outline-none font-mono"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
              >
                Save Changes
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <button
              onClick={() => {
                haptic.trigger('selection');
                setIsEditing(true);
              }}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5"
            >
              <span>Edit Profile Details</span>
            </button>

            <button
              onClick={handleSwitchToGuest}
              className="w-full py-2 rounded-xl text-slate-400 hover:text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Switch / Reset Account Session</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
