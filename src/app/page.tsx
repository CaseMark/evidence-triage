'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Upload, 
  Search, 
  Filter, 
  Grid, 
  List, 
  Calendar,
  Tag,
  FileText,
  Image,
  Mail,
  FileSpreadsheet,
  Briefcase,
  PenTool,
  Heart,
  File,
  X,
  Check,
  Loader2,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  RefreshCw,
  FolderPlus,
  Eye,
  Download,
  ArrowLeft
} from 'lucide-react';
import { 
  EvidenceItem, 
  EvidenceCategory, 
  CATEGORY_LABELS, 
  CATEGORY_COLORS,
  ViewMode,
  FilterState,
  UploadProgress,
  Vault
} from '@/lib/types';

// Category icons mapping
const CATEGORY_ICONS: Record<EvidenceCategory, React.ReactNode> = {
  contract: <Briefcase className="w-4 h-4" />,
  email: <Mail className="w-4 h-4" />,
  photo: <Image className="w-4 h-4" />,
  handwritten_note: <PenTool className="w-4 h-4" />,
  medical_record: <Heart className="w-4 h-4" />,
  financial_document: <FileSpreadsheet className="w-4 h-4" />,
  legal_filing: <FileText className="w-4 h-4" />,
  correspondence: <Mail className="w-4 h-4" />,
  report: <FileText className="w-4 h-4" />,
  other: <File className="w-4 h-4" />,
};

export default function EvidenceTriagePage() {
  // State
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [selectedVault, setSelectedVault] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<EvidenceCategory, number>>({} as Record<EvidenceCategory, number>);
  const [viewMode, setViewMode] = useState<ViewMode>('gallery');
  const [filters, setFilters] = useState<FilterState>({
    categories: [],
    tags: [],
    dateRange: {},
    searchQuery: '',
    sortBy: 'date',
    sortOrder: 'desc',
  });
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<Set<string>>(new Set());
  const [isClassifying, setIsClassifying] = useState<Set<string>>(new Set());
  const [showCreateVault, setShowCreateVault] = useState(false);
  const [newVaultName, setNewVaultName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchResult, setIsSearchResult] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deletingEvidence, setDeletingEvidence] = useState<Set<string>>(new Set());
  const [viewingEvidence, setViewingEvidence] = useState<EvidenceItem | null>(null);
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);
  const [loadingImageUrl, setLoadingImageUrl] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load vaults on mount
  useEffect(() => {
    loadVaults();
  }, []);

  // Load evidence when vault changes
  const prevVaultRef = useRef<string | null>(null);

  useEffect(() => {
    if (selectedVault) {
      prevVaultRef.current = selectedVault;
      loadEvidence();
    }
  }, [selectedVault, filters.categories, filters.tags, filters.dateRange.start, filters.dateRange.end, filters.searchQuery, filters.sortBy, filters.sortOrder]);

  const loadVaults = async () => {
    try {
      const response = await fetch('/api/vaults');
      const data = await response.json();
      setVaults(data.vaults || []);
      if (data.vaults?.length > 0 && !selectedVault) {
        setSelectedVault(data.vaults[0].id);
      }
    } catch (error) {
      console.error('Failed to load vaults:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEvidence = async () => {
    if (!selectedVault) return;
    
    setIsSearchResult(false);
    
    try {
      const params = new URLSearchParams();
      params.set('sync', 'true');
      if (filters.categories.length > 0) {
        params.set('categories', filters.categories.join(','));
      }
      if (filters.tags.length > 0) {
        params.set('tags', filters.tags.join(','));
      }
      if (filters.dateRange.start) {
        params.set('dateStart', filters.dateRange.start);
      }
      if (filters.dateRange.end) {
        params.set('dateEnd', filters.dateRange.end);
      }
      if (filters.searchQuery) {
        params.set('q', filters.searchQuery);
      }
      params.set('sortBy', filters.sortBy);
      params.set('sortOrder', filters.sortOrder);

      const response = await fetch(`/api/vaults/${selectedVault}/evidence?${params}`);
      const data = await response.json();
      
      setEvidence(data.evidence || []);
      setAllTags(data.tags || []);
      setCategoryCounts(data.categoryCounts || {});
    } catch (error) {
      console.error('Failed to load evidence:', error);
    }
  };

  const createVault = async () => {
    if (!newVaultName.trim()) return;
    
    try {
      const response = await fetch('/api/vaults', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newVaultName, description: 'Evidence collection' }),
      });
      
      const vault = await response.json();
      setVaults(prev => [...prev, vault]);
      setSelectedVault(vault.id);
      setShowCreateVault(false);
      setNewVaultName('');
    } catch (error) {
      console.error('Failed to create vault:', error);
    }
  };

  const handleFileUpload = async (files: FileList | File[]) => {
    if (!selectedVault || files.length === 0) return;
    
    setIsUploading(true);
    const fileArray = Array.from(files);
    
    const initialProgress: UploadProgress[] = fileArray.map(f => ({
      filename: f.name,
      progress: 0,
      status: 'pending',
    }));
    setUploadProgress(initialProgress);

    const formData = new FormData();
    fileArray.forEach(file => {
      formData.append('files', file);
    });

    try {
      setUploadProgress(prev => prev.map(p => ({ ...p, status: 'uploading', progress: 50 })));

      const response = await fetch(`/api/vaults/${selectedVault}/evidence`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      setUploadProgress(prev => prev.map(p => {
        const result = data.results?.find((r: { filename: string }) => r.filename === p.filename);
        if (result) {
          return {
            ...p,
            status: result.status === 'uploaded' ? 'processing' : 'failed',
            progress: result.status === 'uploaded' ? 75 : 100,
            evidenceId: result.objectId || result.evidenceId,
            error: result.error,
          };
        }
        return p;
      }));

      // Auto-classify uploaded files
      for (const result of data.results || []) {
        if (result.status === 'uploaded' && result.objectId) {
          classifyEvidence(result.objectId);
        }
      }

      // Reload evidence after a short delay
      setTimeout(() => {
        loadEvidence();
      }, 2000);

    } catch (error) {
      console.error('Upload failed:', error);
      setUploadProgress(prev => prev.map(p => ({ ...p, status: 'failed', error: 'Upload failed' })));
    } finally {
      setIsUploading(false);
    }
  };

  const classifyEvidence = async (evidenceId: string) => {
    if (!selectedVault) return;
    
    setIsClassifying(prev => new Set(prev).add(evidenceId));
    
    try {
      // Poll for ingestion completion (max 120 seconds - 24 attempts × 5 seconds)
      const maxAttempts = 24;
      let attempts = 0;
      let ingestionComplete = false;
      let lastError = '';
      
      while (attempts < maxAttempts && !ingestionComplete) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        setUploadProgress(prev => prev.map(p => 
          p.evidenceId === evidenceId ? { ...p, status: 'processing', progress: Math.min(90, 50 + (attempts * 2)) } : p
        ));
        
        try {
          const response = await fetch(`/api/vaults/${selectedVault}/evidence/${evidenceId}/classify`, {
            method: 'POST',
          });
          
          if (response.ok) {
            const data = await response.json();
            
            // Update local evidence state with classification
            setEvidence(prev => prev.map(e => 
              e.id === evidenceId ? { ...e, ...data.evidence } : e
            ));
            
            setUploadProgress(prev => prev.map(p => 
              p.evidenceId === evidenceId ? { ...p, status: 'completed', progress: 100 } : p
            ));
            ingestionComplete = true;
            
            // Reload to get updated category counts
            loadEvidence();
          } else if (response.status === 400) {
            const errorData = await response.json();
            lastError = errorData.status || 'processing';
            console.log(`Ingestion status: ${lastError}, attempt ${attempts}/${maxAttempts}`);
          } else {
            const errorData = await response.json().catch(() => ({}));
            lastError = errorData.error || `HTTP ${response.status}`;
            console.error('Classification error:', lastError);
          }
        } catch (fetchError) {
          console.error('Fetch error during classification:', fetchError);
          lastError = 'Network error';
        }
      }
      
      if (!ingestionComplete) {
        setUploadProgress(prev => prev.map(p => 
          p.evidenceId === evidenceId ? { 
            ...p, 
            status: 'completed', 
            progress: 100,
            error: `Processing in background`
          } : p
        ));
        console.log('Ingestion timed out, will complete in background. Last status:', lastError);
        loadEvidence();
      }
      
    } catch (error) {
      console.error('Classification failed:', error);
      setUploadProgress(prev => prev.map(p => 
        p.evidenceId === evidenceId ? { ...p, status: 'failed', error: 'Classification failed' } : p
      ));
    } finally {
      setIsClassifying(prev => {
        const next = new Set(prev);
        next.delete(evidenceId);
        return next;
      });
    }
  };

  const handleSearch = async () => {
    if (!selectedVault || !searchQuery.trim()) {
      setIsSearchResult(false);
      loadEvidence();
      return;
    }
    
    setIsSearching(true);
    
    try {
      const response = await fetch(`/api/vaults/${selectedVault}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: searchQuery,
          // Pass current filters to search API
          categories: filters.categories,
          tags: filters.tags,
        }),
      });
      
      const data = await response.json();
      setEvidence(data.evidence || []);
      setIsSearchResult(true);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleDeleteEvidence = async (evidenceId: string) => {
    if (!selectedVault) return;
    
    if (!confirm('Are you sure you want to delete this evidence? This action cannot be undone.')) {
      return;
    }
    
    setDeletingEvidence(prev => new Set(prev).add(evidenceId));
    
    try {
      const response = await fetch(`/api/vaults/${selectedVault}/evidence/${evidenceId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setEvidence(prev => prev.filter(e => e.id !== evidenceId));
        if (viewingEvidence?.id === evidenceId) {
          setViewingEvidence(null);
        }
      } else {
        const error = await response.json();
        console.error('Delete failed:', error);
        alert('Failed to delete evidence: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete evidence');
    } finally {
      setDeletingEvidence(prev => {
        const next = new Set(prev);
        next.delete(evidenceId);
        return next;
      });
    }
  };

  const handleViewEvidence = async (item: EvidenceItem) => {
    setViewingEvidence(item);
    setViewingImageUrl(null);
    
    // If it's an image, fetch the download URL
    if (item.contentType.startsWith('image/') && selectedVault) {
      setLoadingImageUrl(true);
      try {
        const response = await fetch(`/api/vaults/${selectedVault}/evidence/${item.id}`);
        const data = await response.json();
        if (data.downloadUrl) {
          setViewingImageUrl(data.downloadUrl);
        }
      } catch (error) {
        console.error('Failed to get image URL:', error);
      } finally {
        setLoadingImageUrl(false);
      }
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files);
    }
  };

  const toggleCategory = (category: EvidenceCategory) => {
    setFilters(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category],
    }));
  };

  const toggleTag = (tag: string) => {
    setFilters(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  const clearFilters = () => {
    setFilters({
      categories: [],
      tags: [],
      dateRange: {},
      searchQuery: '',
      sortBy: 'date',
      sortOrder: 'desc',
    });
    setSearchQuery('');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getRelevanceClass = (score: number) => {
    if (score >= 70) return 'relevance-high';
    if (score >= 40) return 'relevance-medium';
    return 'relevance-low';
  };

  const formatDateForDisplay = (dateStr: string) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    return new Date(dateStr);
  };

  // Group evidence by date for timeline view
  const evidenceByDate = evidence.reduce((acc, item) => {
    const rawDate = item.dateDetected || item.createdAt;
    const date = rawDate.split('T')[0];
    if (!acc[date]) acc[date] = [];
    acc[date].push(item);
    return acc;
  }, {} as Record<string, EvidenceItem[]>);

  const sortedDates = Object.keys(evidenceByDate).sort((a, b) => b.localeCompare(a));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // Document Viewer Modal
  if (viewingEvidence) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setViewingEvidence(null)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Evidence
            </button>
            <div className="h-6 w-px bg-gray-300" />
            <h1 className="text-lg font-semibold text-gray-900 truncate">
              {viewingEvidence.filename}
            </h1>
          </div>
        </header>

        <div className="max-w-6xl mx-auto p-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {/* Document Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gray-100 rounded-lg">
                    {CATEGORY_ICONS[viewingEvidence.category]}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{viewingEvidence.filename}</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      {formatFileSize(viewingEvidence.sizeBytes)} • {viewingEvidence.contentType}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDeleteEvidence(viewingEvidence.id)}
                    disabled={deletingEvidence.has(viewingEvidence.id)}
                    className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {deletingEvidence.has(viewingEvidence.id) ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Delete
                  </button>
                </div>
              </div>
            </div>

            {/* Image Preview for photos/images */}
            {viewingEvidence.contentType.startsWith('image/') && (
              <div className="p-6 border-b border-gray-200 bg-gray-50">
                <h3 className="text-sm font-medium text-gray-500 mb-3">Image Preview</h3>
                {loadingImageUrl ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  </div>
                ) : viewingImageUrl ? (
                  <div className="flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src={viewingImageUrl} 
                      alt={viewingEvidence.filename}
                      className="max-h-96 max-w-full object-contain rounded-lg shadow-sm"
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64 bg-gray-100 rounded-lg">
                    <div className="text-center text-gray-400">
                      <Image className="w-12 h-12 mx-auto mb-2" />
                      <p>Unable to load image preview</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Document Details */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column - Metadata */}
              <div className="space-y-6">
                {/* Category */}
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Category</h3>
                  <span className={`category-badge ${CATEGORY_COLORS[viewingEvidence.category]}`}>
                    {CATEGORY_LABELS[viewingEvidence.category]}
                  </span>
                </div>

                {/* Tags */}
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Tags</h3>
                  {viewingEvidence.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {viewingEvidence.tags.map(tag => (
                        <span key={tag} className="tag">{tag}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">No tags</p>
                  )}
                </div>

                {/* Dates */}
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Dates</h3>
                  <div className="space-y-1 text-sm">
                    <p><span className="text-gray-500">Uploaded:</span> {new Date(viewingEvidence.createdAt).toLocaleString()}</p>
                    {viewingEvidence.dateDetected && (
                      <p><span className="text-gray-500">Document Date:</span> {formatDateForDisplay(viewingEvidence.dateDetected).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>

                {/* Status */}
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Status</h3>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                    viewingEvidence.ingestionStatus === 'completed' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {viewingEvidence.ingestionStatus === 'completed' ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    )}
                    {viewingEvidence.ingestionStatus === 'completed' ? 'Processed' : 'Processing'}
                  </span>
                </div>
              </div>

              {/* Right Column - Summary & Text */}
              <div className="space-y-6">
                {/* Summary */}
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Summary</h3>
                  <p className="text-sm text-gray-700">
                    {viewingEvidence.summary || 'No summary available. Document may still be processing.'}
                  </p>
                </div>

                {/* Extracted Text Preview */}
                {viewingEvidence.extractedText && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Extracted Text Preview</h3>
                    <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                      <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono">
                        {viewingEvidence.extractedText.substring(0, 2000)}
                        {viewingEvidence.extractedText.length > 2000 && '...'}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900">Evidence Triage</h1>
            
            {/* Vault selector */}
            <div className="flex items-center gap-2">
              <select
                value={selectedVault || ''}
                onChange={(e) => setSelectedVault(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="" disabled>Select a vault</option>
                {vaults.map(vault => (
                  <option key={vault.id} value={vault.id}>{vault.name}</option>
                ))}
              </select>
              
              <button
                onClick={() => setShowCreateVault(true)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                title="Create new vault"
              >
                <FolderPlus className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="relative flex items-center">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search evidence..."
                className="w-64 pl-10 pr-10 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Search className="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none" />
              {isSearching && (
                <div className="absolute right-3 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                </div>
              )}
              {!isSearching && searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setIsSearchResult(false);
                    loadEvidence();
                  }}
                  className="absolute right-3 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* View toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('gallery')}
                className={`view-toggle-btn ${viewMode === 'gallery' ? 'active' : ''}`}
                title="Gallery view"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('timeline')}
                className={`view-toggle-btn ${viewMode === 'timeline' ? 'active' : ''}`}
                title="Timeline view"
              >
                <Calendar className="w-4 h-4" />
              </button>
            </div>

            {/* Upload button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={!selectedVault}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="w-4 h-4" />
              Upload Evidence
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
              className="hidden"
              accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.tiff,.eml,.msg"
            />
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Filter Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Filters
              </h2>
              {(filters.categories.length > 0 || filters.tags.length > 0) && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Categories */}
            <div className="filter-section">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Categories</h3>
              <div className="space-y-1">
                {(Object.keys(CATEGORY_LABELS) as EvidenceCategory[]).map(category => (
                  <button
                    key={category}
                    onClick={() => toggleCategory(category)}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-sm transition-colors ${
                      filters.categories.includes(category)
                        ? 'bg-blue-100 text-blue-700'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {CATEGORY_ICONS[category]}
                      {CATEGORY_LABELS[category]}
                    </span>
                    <span className="text-xs text-gray-500">
                      {categoryCounts[category] || 0}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tags */}
            {allTags.length > 0 && (
              <div className="filter-section">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Tags</h3>
                <div className="flex flex-wrap gap-1">
                  {allTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`tag ${
                        filters.tags.includes(tag)
                          ? 'bg-blue-100 text-blue-700'
                          : ''
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sort */}
            <div className="filter-section">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Sort by</h3>
              <select
                value={`${filters.sortBy}-${filters.sortOrder}`}
                onChange={(e) => {
                  const [sortBy, sortOrder] = e.target.value.split('-') as [FilterState['sortBy'], FilterState['sortOrder']];
                  setFilters(prev => ({ ...prev, sortBy, sortOrder }));
                }}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
              >
                <option value="date-desc">Date (newest first)</option>
                <option value="date-asc">Date (oldest first)</option>
                <option value="relevance-desc">Relevance (highest first)</option>
                <option value="relevance-asc">Relevance (lowest first)</option>
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
              </select>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {/* Upload Progress */}
          {uploadProgress.length > 0 && (
            <div className="mb-6 bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900">Upload Progress</h3>
                <button
                  onClick={() => setUploadProgress([])}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2">
                {uploadProgress.map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="truncate">{item.filename}</span>
                        <span className="text-gray-500 capitalize">{item.status}</span>
                      </div>
                      <div className="progress-bar">
                        <div 
                          className={`progress-bar-fill ${
                            item.status === 'failed' ? 'bg-red-500' : 
                            item.status === 'completed' ? 'bg-green-500' : ''
                          }`}
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    </div>
                    {item.status === 'completed' && <Check className="w-4 h-4 text-green-500" />}
                    {item.status === 'failed' && <X className="w-4 h-4 text-red-500" />}
                    {(item.status === 'processing' || item.status === 'categorizing') && (
                      <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Drop Zone */}
          {selectedVault && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`dropzone mb-6 ${isDragging ? 'active' : ''}`}
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p className="text-gray-600">
                Drag and drop files here, or{' '}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-blue-600 hover:text-blue-700"
                >
                  browse
                </button>
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Supports PDFs, images, documents, and emails
              </p>
            </div>
          )}

          {/* No vault selected */}
          {!selectedVault && (
            <div className="text-center py-12">
              <FolderPlus className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No vault selected</h3>
              <p className="text-gray-500 mb-4">Create or select a vault to start uploading evidence</p>
              <button
                onClick={() => setShowCreateVault(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create Vault
              </button>
            </div>
          )}

          {/* Evidence Display */}
          {selectedVault && evidence.length === 0 && (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No evidence yet</h3>
              <p className="text-gray-500">Upload files to start building your evidence collection</p>
            </div>
          )}

          {/* Gallery View */}
          {viewMode === 'gallery' && evidence.length > 0 && (
            <div className="gallery-grid">
              {evidence.map(item => (
                <div 
                  key={item.id} 
                  className="evidence-card group relative cursor-pointer"
                  onClick={() => handleViewEvidence(item)}
                >
                  {/* Delete button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteEvidence(item.id);
                    }}
                    disabled={deletingEvidence.has(item.id)}
                    className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 disabled:opacity-50"
                    title="Delete evidence"
                  >
                    {deletingEvidence.has(item.id) ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                  
                  {/* View button */}
                  <div className="absolute top-2 left-2 p-1.5 bg-white/90 text-gray-400 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <Eye className="w-4 h-4" />
                  </div>
                  
                  {/* Thumbnail/Icon */}
                  <div className="h-32 bg-gray-100 flex items-center justify-center">
                    {item.contentType.startsWith('image/') ? (
                      <Image className="w-12 h-12 text-gray-400" />
                    ) : (
                      <div className="text-gray-400">
                        {CATEGORY_ICONS[item.category]}
                      </div>
                    )}
                  </div>
                  
                  {/* Content */}
                  <div className="p-3">
                    <h4 className="font-medium text-sm text-gray-900 truncate" title={item.filename}>
                      {item.filename}
                    </h4>
                    
                    {/* Category badge */}
                    <div className="mt-2">
                      <span className={`category-badge ${CATEGORY_COLORS[item.category]}`}>
                        {CATEGORY_LABELS[item.category]}
                      </span>
                    </div>
                    
                    {/* Relevance score - only show when searching */}
                    {isSearchResult && (item as EvidenceItem & { searchRelevance?: number }).searchRelevance !== undefined && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>Search Relevance</span>
                          <span>{(item as EvidenceItem & { searchRelevance?: number }).searchRelevance}%</span>
                        </div>
                        <div className="relevance-indicator w-full bg-gray-200 rounded-full">
                          <div 
                            className={`h-full rounded-full ${getRelevanceClass((item as EvidenceItem & { searchRelevance?: number }).searchRelevance || 0)}`}
                            style={{ width: `${(item as EvidenceItem & { searchRelevance?: number }).searchRelevance}%` }}
                          />
                        </div>
                      </div>
                    )}
                    
                    {/* Tags */}
                    {item.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {item.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="tag text-xs">{tag}</span>
                        ))}
                        {item.tags.length > 3 && (
                          <span className="text-xs text-gray-500">+{item.tags.length - 3}</span>
                        )}
                      </div>
                    )}
                    
                    {/* Status indicator */}
                    {item.ingestionStatus !== 'completed' && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-yellow-600">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Processing...
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* List View */}
          {viewMode === 'list' && evidence.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tags</th>
                    {isSearchResult && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Search Relevance</th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {evidence.map(item => {
                    const searchRelevance = (item as EvidenceItem & { searchRelevance?: number }).searchRelevance;
                    return (
                      <tr 
                        key={item.id} 
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleViewEvidence(item)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {CATEGORY_ICONS[item.category]}
                            <span className="text-sm font-medium text-gray-900 truncate max-w-xs">
                              {item.filename}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`category-badge ${CATEGORY_COLORS[item.category]}`}>
                            {CATEGORY_LABELS[item.category]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {item.tags.slice(0, 2).map(tag => (
                              <span key={tag} className="tag text-xs">{tag}</span>
                            ))}
                            {item.tags.length > 2 && (
                              <span className="text-xs text-gray-500">+{item.tags.length - 2}</span>
                            )}
                          </div>
                        </td>
                        {isSearchResult && (
                          <td className="px-4 py-3">
                            {searchRelevance !== undefined ? (
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-gray-200 rounded-full">
                                  <div 
                                    className={`h-full rounded-full ${getRelevanceClass(searchRelevance)}`}
                                    style={{ width: `${searchRelevance}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-500">{searchRelevance}%</span>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                        )}
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {formatFileSize(item.sizeBytes)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {new Date(item.dateDetected || item.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewEvidence(item);
                              }}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="View details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteEvidence(item.id);
                              }}
                              disabled={deletingEvidence.has(item.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Delete evidence"
                            >
                              {deletingEvidence.has(item.id) ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Timeline View */}
          {viewMode === 'timeline' && evidence.length > 0 && (
            <div className="space-y-6">
              {sortedDates.map(date => (
                <div key={date}>
                  <h3 className="text-sm font-medium text-gray-500 mb-3">
                    {formatDateForDisplay(date).toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </h3>
                  <div className="space-y-3">
                    {evidenceByDate[date].map(item => (
                      <div 
                        key={item.id} 
                        className="timeline-item group cursor-pointer"
                        onClick={() => handleViewEvidence(item)}
                      >
                        <div className="timeline-dot" />
                        <div className="evidence-card p-4 relative">
                          {/* Action buttons */}
                          <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewEvidence(item);
                              }}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="View details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteEvidence(item.id);
                              }}
                              disabled={deletingEvidence.has(item.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Delete evidence"
                            >
                              {deletingEvidence.has(item.id) ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                          
                          <div className="flex items-start justify-between pr-20">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-gray-100 rounded-lg">
                                {CATEGORY_ICONS[item.category]}
                              </div>
                              <div>
                                <h4 className="font-medium text-gray-900">{item.filename}</h4>
                                <p className="text-sm text-gray-500">{item.summary || 'No summary available'}</p>
                              </div>
                            </div>
                            <span className={`category-badge ${CATEGORY_COLORS[item.category]}`}>
                              {CATEGORY_LABELS[item.category]}
                            </span>
                          </div>
                          {item.tags.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1">
                              {item.tags.map(tag => (
                                <span key={tag} className="tag text-xs">{tag}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Create Vault Modal */}
      {showCreateVault && (
        <div className="modal-overlay" onClick={() => setShowCreateVault(false)}>
          <div className="modal-content p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New Vault</h2>
            <input
              type="text"
              value={newVaultName}
              onChange={(e) => setNewVaultName(e.target.value)}
              placeholder="Vault name (e.g., Smith v. Jones 2024)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCreateVault(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={createVault}
                disabled={!newVaultName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Create Vault
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
