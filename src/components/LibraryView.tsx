import React, { useState } from 'react';
import type { GenerationItem, User } from '../types';
import {
  FolderHeart,
  Search,
  Filter,
  Image as ImageIcon,
  Video,
  Heart,
  Download,
  Trash2,
  Copy,
  Check,
  Plus,
  Play,
  Share2,
  FileDown,
  FileUp,
  X,
  ExternalLink,
  Maximize2,
  Sparkles,
  CheckSquare,
  Square,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { haptic } from '../utils/haptics';
import { UpscaleModal } from './UpscaleModal';

interface LibraryViewProps {
  items: GenerationItem[];
  user: User;
  hfToken?: string;
  onDeleteItem: (id: string) => void;
  onDeleteItems?: (ids: string[]) => void;
  onClearAll?: () => void;
  onToggleFavorite: (id: string) => void;
  onSendToVideoLab: (imageUrl: string, prompt: string) => void;
  onExtendVideo: (item: GenerationItem) => void;
  onSaveGeneration?: (item: GenerationItem) => void;
  onExportData: () => void;
  onImportData: (jsonStr: string) => void;
  onNavigateToCreate?: (mode: 'image' | 'video') => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  items,
  user,
  hfToken,
  onDeleteItem,
  onDeleteItems,
  onClearAll,
  onToggleFavorite,
  onSendToVideoLab,
  onExtendVideo,
  onSaveGeneration,
  onExportData,
  onImportData,
  onNavigateToCreate,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'image' | 'video' | 'favorite'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<GenerationItem | null>(null);
  const [itemToUpscale, setItemToUpscale] = useState<GenerationItem | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');

  // Deletion & Batch Selection States
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [itemToDelete, setItemToDelete] = useState<GenerationItem | null>(null);
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);
  const [showClearAllModal, setShowClearAllModal] = useState(false);

  // Filter items
  const filteredItems = items.filter((item) => {
    if (filterType === 'image' && item.type !== 'image') return false;
    if (filterType === 'video' && item.type !== 'video') return false;
    if (filterType === 'favorite' && !item.isFavorite) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.prompt.toLowerCase().includes(q) ||
        item.model.toLowerCase().includes(q) ||
        item.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    haptic.trigger('selection');
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleImportSubmit = () => {
    if (!importJsonText.trim()) return;
    haptic.trigger('selection');
    onImportData(importJsonText);
    setShowImportDialog(false);
    setImportJsonText('');
  };

  // Toggle selection of a single item in batch mode
  const handleToggleSelectItem = (id: string) => {
    haptic.trigger('selection');
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select all or deselect all visible filtered items
  const handleToggleSelectAll = () => {
    haptic.trigger('selection');
    if (selectedIds.size === filteredItems.length && filteredItems.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((i) => i.id)));
    }
  };

  // Perform single deletion
  const handleConfirmSingleDelete = () => {
    if (!itemToDelete) return;
    haptic.trigger('warning');
    onDeleteItem(itemToDelete.id);
    // Also remove from selected set if present
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(itemToDelete.id);
      return next;
    });
    setItemToDelete(null);
  };

  // Perform batch deletion
  const handleConfirmBatchDelete = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    haptic.trigger('warning');

    if (onDeleteItems) {
      onDeleteItems(ids);
    } else {
      ids.forEach((id) => onDeleteItem(id));
    }

    setSelectedIds(new Set());
    setIsSelectionMode(false);
    setShowBatchDeleteModal(false);
  };

  // Perform clear all
  const handleConfirmClearAll = () => {
    haptic.trigger('warning');
    if (onClearAll) {
      onClearAll();
    } else {
      items.forEach((item) => onDeleteItem(item.id));
    }
    setSelectedIds(new Set());
    setIsSelectionMode(false);
    setShowClearAllModal(false);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 space-y-6">
      {/* Header and User profile summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Saved Creations & Library</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/60 font-mono">
              {items.length} Assets
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Persisted locally in your browser storage for account <strong className="text-slate-200">@{user.username}</strong>.
          </p>
        </div>

        {/* Action Controls: Batch Select, Clear, Backup & Restore */}
        <div className="flex items-center flex-wrap gap-2 shrink-0">
          {/* Batch Selection Mode Toggle */}
          {items.length > 0 && (
            <button
              onClick={() => {
                haptic.trigger('selection');
                const next = !isSelectionMode;
                setIsSelectionMode(next);
                if (!next) setSelectedIds(new Set());
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                isSelectionMode
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/20'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
              }`}
              title="Select multiple creations to delete or organize"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>{isSelectionMode ? 'Done Selecting' : 'Select'}</span>
            </button>
          )}

          {/* Clear All Button */}
          {items.length > 0 && (
            <button
              onClick={() => {
                haptic.trigger('selection');
                setShowClearAllModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-950/30 hover:bg-rose-900/50 text-rose-300 border border-rose-800/50 transition-colors"
              title="Delete all creations from library"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Clear All</span>
            </button>
          )}

          <button
            onClick={() => {
              haptic.trigger('selection');
              onExportData();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
            title="Export all creations to JSON backup"
          >
            <FileDown className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export Backup</span>
          </button>

          <button
            onClick={() => {
              haptic.trigger('selection');
              setShowImportDialog(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
            title="Restore creations from JSON backup"
          >
            <FileUp className="w-3.5 h-3.5 text-violet-400" />
            <span>Import</span>
          </button>
        </div>
      </div>

      {/* Batch Selection Action Bar (Sticky when items selected or in selection mode) */}
      {isSelectionMode && (
        <div className="sticky top-16 z-30 p-3 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-cyan-500/40 shadow-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleSelectAll}
              className="flex items-center gap-2 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 transition-colors"
            >
              {selectedIds.size === filteredItems.length && filteredItems.length > 0 ? (
                <CheckSquare className="w-4 h-4 text-cyan-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>
                {selectedIds.size === filteredItems.length && filteredItems.length > 0
                  ? 'Deselect All'
                  : 'Select All Visible'}
              </span>
            </button>

            <span className="text-xs font-mono font-bold text-cyan-300">
              {selectedIds.size} of {filteredItems.length} selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                haptic.trigger('selection');
                setIsSelectionMode(false);
                setSelectedIds(new Set());
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white"
            >
              Cancel
            </button>

            <button
              disabled={selectedIds.size === 0}
              onClick={() => {
                haptic.trigger('warning');
                setShowBatchDeleteModal(true);
              }}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedIds.size > 0
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-500/20 active:scale-95'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected ({selectedIds.size})</span>
            </button>
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search prompts, models, tags..."
            className="w-full bg-slate-900 text-slate-100 placeholder-slate-500 rounded-xl pl-9 pr-3.5 py-2 text-xs border border-slate-800 focus:border-cyan-400 focus:outline-none"
          />
        </div>

        {/* Filter Segmented Buttons */}
        <div className="flex items-center gap-1 p-1 bg-slate-900/90 rounded-xl border border-slate-800 shrink-0">
          {[
            { id: 'all', label: 'All' },
            { id: 'image', label: 'Images' },
            { id: 'video', label: 'Videos' },
            { id: 'favorite', label: 'Favorites' },
          ].map((tab) => {
            const isSelected = filterType === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  haptic.trigger('selection');
                  setFilterType(tab.id as any);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  isSelected
                    ? 'bg-slate-100 text-slate-950 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of Creations */}
      {filteredItems.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-4">
          <FolderHeart className="w-12 h-12 text-slate-600 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-200">
              {items.length === 0 ? 'Your Library is Empty' : 'No matching creations found'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {items.length === 0
                ? 'You have no saved images or videos in your collection. Generate fresh assets in the Image Studio or Video Lab to begin.'
                : searchQuery
                ? 'No creations match your search query. Try clearing the search filter.'
                : 'No items in this category yet.'}
            </p>
          </div>

          {items.length === 0 && onNavigateToCreate && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => onNavigateToCreate('image')}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Create Image</span>
              </button>
              <button
                onClick={() => onNavigateToCreate('video')}
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
              >
                <Video className="w-3.5 h-3.5" />
                <span>Create Video</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {filteredItems.map((item) => {
            const isVid = item.type === 'video';
            const isSelected = selectedIds.has(item.id);

            return (
              <div
                key={item.id}
                onClick={() => {
                  if (isSelectionMode) {
                    handleToggleSelectItem(item.id);
                  } else {
                    haptic.trigger('selection');
                    setSelectedItem(item);
                  }
                }}
                className={`group relative rounded-xl overflow-hidden bg-slate-900 border cursor-pointer transition-all aspect-square flex flex-col justify-between ${
                  isSelected
                    ? 'border-cyan-400 ring-2 ring-cyan-500/40 shadow-lg shadow-cyan-500/20 scale-[0.98]'
                    : 'border-slate-800/80 hover:border-cyan-500/50'
                }`}
              >
                {/* Media Thumbnail */}
                <img
                  src={item.thumbnailUrl || item.mediaUrl}
                  alt={item.prompt}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />

                {/* Selection Checkbox Badge */}
                {isSelectionMode && (
                  <div className="absolute top-2 left-2 z-10">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center transition-all shadow-md ${
                        isSelected
                          ? 'bg-cyan-500 text-slate-950'
                          : 'bg-black/60 border border-white/60 text-transparent'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  </div>
                )}

                {/* Top Badges Overlay (When not in selection mode or alongside it) */}
                <div className={`absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none ${isSelectionMode ? 'pl-8' : ''}`}>
                  <div className="flex items-center gap-1">
                    {isVid ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-md text-[10px] font-bold text-cyan-300 border border-cyan-500/30">
                        <Play className="w-2.5 h-2.5 fill-current" />
                        <span>{item.videoMetadata?.duration || 4}s</span>
                      </span>
                    ) : (
                      <>
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-950/70 text-[9px] font-mono text-slate-300">
                          {item.aspectRatio}
                        </span>
                        {item.isUpscaled && (
                          <span className="px-1.5 py-0.5 rounded-md bg-cyan-950/90 border border-cyan-500/40 text-[9px] font-mono font-bold text-cyan-300">
                            {item.upscaleFactor}x HD
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {!isSelectionMode && (
                      <>
                        {!isVid && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              haptic.trigger('selection');
                              setItemToUpscale(item);
                            }}
                            className="pointer-events-auto p-1.5 rounded-full bg-slate-950/70 hover:bg-slate-900 text-slate-300 hover:text-cyan-400 transition-colors"
                            title="Upscale 2x or 4x Resolution"
                          >
                            <Maximize2 className="w-3 h-3" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            haptic.trigger('selection');
                            onToggleFavorite(item.id);
                          }}
                          className="pointer-events-auto p-1.5 rounded-full bg-slate-950/70 hover:bg-slate-900 text-slate-300 transition-colors"
                          title="Toggle Favorite"
                        >
                          <Heart
                            className={`w-3.5 h-3.5 ${
                              item.isFavorite ? 'fill-rose-500 text-rose-500' : 'text-white'
                            }`}
                          />
                        </button>

                        {/* Quick Delete Trash Button directly on card */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            haptic.trigger('warning');
                            setItemToDelete(item);
                          }}
                          className="pointer-events-auto p-1.5 rounded-full bg-slate-950/70 hover:bg-rose-950 text-slate-300 hover:text-rose-400 transition-colors"
                          title="Delete creation"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Bottom Scrim & Caption */}
                <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                  <p className="text-[11px] font-medium text-white line-clamp-1">
                    {item.prompt}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mt-0.5">
                    <span className="truncate max-w-[90px]">{item.modelLabel}</span>
                    <span className="font-mono text-slate-500">
                      {new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detailed Media Inspector Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-400">
                  {selectedItem.type.toUpperCase()}
                </span>
                <span className="text-xs text-slate-300 font-bold truncate max-w-xs">
                  {selectedItem.modelLabel}
                </span>
              </div>

              <button
                onClick={() => setSelectedItem(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Viewport */}
            <div className="rounded-xl overflow-hidden bg-black flex items-center justify-center max-h-[460px]">
              {selectedItem.type === 'video' ? (
                <video
                  src={selectedItem.mediaUrl}
                  autoPlay
                  loop
                  playsInline
                  controls
                  className="max-h-[460px] w-auto max-w-full"
                />
              ) : (
                <img
                  src={selectedItem.mediaUrl}
                  alt={selectedItem.prompt}
                  referrerPolicy="no-referrer"
                  className="max-h-[460px] w-auto max-w-full object-contain"
                />
              )}
            </div>

            {/* Prompt & Details */}
            <div className="space-y-2 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Prompt</span>
                <button
                  onClick={() => handleCopy(selectedItem.prompt)}
                  className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[11px]"
                >
                  {copiedPrompt ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedPrompt ? 'Copied' : 'Copy Prompt'}</span>
                </button>
              </div>
              <p className="text-slate-200 leading-relaxed italic">
                "{selectedItem.prompt}"
              </p>

              {/* Metadata tags */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400 font-mono pt-2 border-t border-slate-800">
                <span>Seed: {selectedItem.seed}</span>
                <span>Dimensions: {selectedItem.width}×{selectedItem.height}px</span>
                {selectedItem.isUpscaled && (
                  <span className="text-cyan-400 font-bold font-mono">
                    ✓ {selectedItem.upscaleFactor}x Super-Res
                  </span>
                )}
                {selectedItem.videoMetadata && (
                  <span>Duration: {selectedItem.videoMetadata.duration}s</span>
                )}
                {selectedItem.videoMetadata?.isExtended && (
                  <span className="text-violet-400 font-bold">Extended Sequence</span>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800">
              {/* If Image: Upscale 2x / 4x CTA */}
              {selectedItem.type === 'image' && (
                <button
                  type="button"
                  onClick={() => {
                    haptic.trigger('selection');
                    const target = selectedItem;
                    setSelectedItem(null);
                    setItemToUpscale(target);
                  }}
                  className="flex-1 min-h-[42px] px-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                >
                  <Maximize2 className="w-4 h-4" />
                  <span>Upscale (2x / 4x)</span>
                </button>
              )}

              {/* If Image: Convert to Video */}
              {selectedItem.type === 'image' && (
                <button
                  type="button"
                  onClick={() => {
                    haptic.trigger('selection');
                    const img = selectedItem.mediaUrl;
                    const pr = selectedItem.prompt;
                    setSelectedItem(null);
                    onSendToVideoLab(img, pr);
                  }}
                  className="flex-1 min-h-[42px] px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                >
                  <Video className="w-4 h-4" />
                  <span>Convert to Video</span>
                </button>
              )}

              {/* If Video: Extend Video */}
              {selectedItem.type === 'video' && (
                <button
                  onClick={() => {
                    haptic.trigger('selection');
                    const itm = selectedItem;
                    setSelectedItem(null);
                    onExtendVideo(itm);
                  }}
                  className="flex-1 min-h-[42px] px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Extend Video (+3s)</span>
                </button>
              )}

              {/* Download */}
              <a
                href={selectedItem.mediaUrl}
                download={`noman_${selectedItem.id}.${selectedItem.type === 'video' ? 'webm' : 'jpg'}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => haptic.trigger('selection')}
                className="px-4 min-h-[42px] rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                <span>Download</span>
              </a>

              {/* Delete with explicit confirmation */}
              <button
                onClick={() => {
                  haptic.trigger('warning');
                  const item = selectedItem;
                  setSelectedItem(null);
                  setItemToDelete(item);
                }}
                className="px-3 min-h-[42px] rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 font-semibold text-xs flex items-center justify-center gap-1.5 border border-rose-800/60"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single Item Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-rose-950/80 text-rose-400 border border-rose-800/50">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Delete Creation?</h3>
                <p className="text-xs text-slate-400">This action cannot be undone.</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-3">
              <img
                src={itemToDelete.thumbnailUrl || itemToDelete.mediaUrl}
                alt=""
                className="w-12 h-12 rounded-lg object-cover shrink-0"
              />
              <p className="text-xs text-slate-300 line-clamp-2 italic">
                "{itemToDelete.prompt}"
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setItemToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSingleDelete}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-600/20"
              >
                Delete Creation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Delete Confirmation Modal */}
      {showBatchDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-rose-950/80 text-rose-400 border border-rose-800/50">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  Delete {selectedIds.size} Selected Creation{selectedIds.size > 1 ? 's' : ''}?
                </h3>
                <p className="text-xs text-slate-400">
                  These items will be permanently removed from your browser collection.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 max-h-40 overflow-y-auto space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                Items to be removed:
              </span>
              <div className="grid grid-cols-4 gap-2 pt-1">
                {Array.from(selectedIds).slice(0, 8).map((id) => {
                  const itm = items.find((i) => i.id === id);
                  if (!itm) return null;
                  return (
                    <img
                      key={id}
                      src={itm.thumbnailUrl || itm.mediaUrl}
                      alt=""
                      className="w-full aspect-square rounded-lg object-cover border border-slate-800"
                    />
                  );
                })}
              </div>
              {selectedIds.size > 8 && (
                <span className="text-[10px] text-slate-400 font-mono block pt-1">
                  + {selectedIds.size - 8} more creations
                </span>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowBatchDeleteModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBatchDelete}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-600/20"
              >
                Delete {selectedIds.size} Items
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Confirmation Modal */}
      {showClearAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-rose-900/60 shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-rose-950 text-rose-400 border border-rose-800/60">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Delete All Creations?</h3>
                <p className="text-xs text-slate-400">
                  This will remove all <strong className="text-rose-300">{items.length} creations</strong> from your library.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/40 text-xs text-amber-200/90 leading-relaxed">
              Tip: You can export a JSON backup first if you want to restore your creations later.
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                onClick={() => {
                  onExportData();
                }}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5"
              >
                <FileDown className="w-3.5 h-3.5 text-cyan-400" />
                <span>Export Backup First</span>
              </button>

              <div className="flex gap-2 flex-1">
                <button
                  onClick={() => setShowClearAllModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmClearAll}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-600/20"
                >
                  Delete All ({items.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* JSON Import Dialog */}
      {showImportDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-white">Import Collection Backup</h3>
            <p className="text-xs text-slate-400">
              Paste the exported JSON data below to restore your creations and settings:
            </p>
            <textarea
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder='{"app": "NoMan AI", "generations": [...] }'
              rows={6}
              className="w-full bg-slate-950 text-slate-200 text-xs rounded-xl p-3 border border-slate-800 focus:border-cyan-400 focus:outline-none font-mono"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowImportDialog(false)}
                className="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleImportSubmit}
                className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
              >
                Import Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Super-Resolution Upscaling Modal */}
      {itemToUpscale && (
        <UpscaleModal
          item={itemToUpscale}
          hfToken={hfToken}
          isOpen={!!itemToUpscale}
          onClose={() => setItemToUpscale(null)}
          onSaveUpscaled={(newItem) => {
            if (onSaveGeneration) onSaveGeneration(newItem);
            setItemToUpscale(null);
          }}
        />
      )}
    </div>
  );
};
