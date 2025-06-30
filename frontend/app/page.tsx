'use client'

import React, { useState, useEffect, useCallback } from 'react';
import { Filter, Bookmark, Eye, Calendar, DollarSign, Building, Award, ChevronDown, ChevronUp, ExternalLink, RefreshCw, AlertCircle } from 'lucide-react';

// Define interfaces for type safety
interface ContactInfo {
  name?: string;
  email?: string;
  phone?: string;
}

interface AdditionalInfo {
  classificationCode?: string;
  organizationType?: string;
  state?: string;
}

interface Opportunity {
  id: string;
  title?: string;
  agency?: string;
  office?: string;
  solicitationNumber?: string;
  naics?: string;
  naicsDescription?: string;
  setAsideType?: string;
  dueDate?: string;
  postedDate?: string;
  estimatedValue?: string;
  placeOfPerformance?: string;
  description?: string;
  url?: string;
  type?: string;
  matchScore?: number;
  contactInfo?: ContactInfo;
  additionalInfo?: AdditionalInfo;
}

interface Filters {
  setAside: string;
  naics: string;
  agency: string;
  valueRange: string;
}

const Dashboard = () => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'matched' | 'saved'>('matched');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [savedOpportunities, setSavedOpportunities] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<Filters>({
    setAside: '',
    naics: '',
    agency: '',
    valueRange: 'all'
  });

  // API Configuration
  const API_BASE_URL = 'http://localhost:8000';

  // Fetch opportunities from backend
  const fetchOpportunities = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        days_back: '14',
        limit: '50'
      });

      // Add filters if they exist
      if (filters.naics) params.append('naics', filters.naics);
      if (filters.setAside) params.append('set_aside', filters.setAside);
      if (filters.agency) params.append('agency', filters.agency);

      const response = await fetch(`${API_BASE_URL}/opportunities?${params}`);

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      setOpportunities(data.opportunities || []);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
        console.error('Failed to fetch opportunities:', err);
      } else {
        setError('An unknown error occurred');
        console.error('Failed to fetch opportunities:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [filters.naics, filters.setAside, filters.agency]); // Dependencies for useCallback

  // Then your useEffect becomes:
  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

  // Load opportunities on component mount and when filters change
  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

  // Helper functions
  const getDaysUntilDue = (dueDate?: string): number => {
    if (!dueDate) return 999;
    const days = Math.ceil((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return Math.max(0, days);
  };

  const getMatchColor = (score?: number): string => {
    if (!score) return 'bg-gray-100 text-gray-800 border-gray-200';
    if (score >= 0.8) return 'bg-green-100 text-green-800 border-green-200';
    if (score >= 0.6) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getUrgencyColor = (days: number): string => {
    if (days <= 7) return 'text-red-600 bg-red-50';
    if (days <= 14) return 'text-orange-600 bg-orange-50';
    return 'text-green-600 bg-green-50';
  };

  const handleSaveOpportunity = (id: string) => {
    const newSaved = new Set(savedOpportunities);
    if (savedOpportunities.has(id)) {
      newSaved.delete(id);
    } else {
      newSaved.add(id);
    }
    setSavedOpportunities(newSaved);

    // Save to localStorage
    localStorage.setItem('savedOpportunities', JSON.stringify([...newSaved]));
  };

  // Load saved opportunities from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('savedOpportunities');
    if (saved) {
      setSavedOpportunities(new Set(JSON.parse(saved)));
    }
  }, []);

  // Filter opportunities based on search and tab
  const filteredOpportunities = opportunities.filter((opp: Opportunity) => {
    const matchesSearch = !searchTerm ||
      opp.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      opp.agency?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      opp.description?.toLowerCase().includes(searchTerm.toLowerCase());

    if (activeTab === 'saved') {
      return savedOpportunities.has(opp.id) && matchesSearch;
    }
    if (activeTab === 'matched') {
      return (opp.matchScore || 0) >= 0.7 && matchesSearch;
    }
    return matchesSearch;
  });

  // Sort opportunities
  const sortedOpportunities = [...filteredOpportunities].sort((a: Opportunity, b: Opportunity) => {
    if (activeTab === 'matched') {
      return (b.matchScore || 0) - (a.matchScore || 0);
    }
    return getDaysUntilDue(a.dueDate) - getDaysUntilDue(b.dueDate);
  });

  // Calculate stats from current data
  const stats = {
    total_opportunities: opportunities.length,
    high_matches: opportunities.filter(o => (o.matchScore || 0) >= 0.8).length,
    due_soon: opportunities.filter(o => getDaysUntilDue(o.dueDate) <= 14).length,
    saved_count: savedOpportunities.size
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Connection Error</h2>
          <p className="text-gray-600 mb-4">Failed to connect to the backend API</p>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <button
            onClick={fetchOpportunities}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center mx-auto"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry Connection
          </button>
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-left max-w-md">
            <h3 className="font-medium text-yellow-800 mb-2">Quick Setup:</h3>
            <ol className="text-sm text-yellow-700 space-y-1">
              <li>1. Start your backend: <code className="bg-yellow-100 px-1 rounded">uvicorn main:app --reload</code></li>
              <li>2. Add your SAM.gov API key to .env</li>
              <li>3. Ensure CORS is configured for localhost:3000</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">GovCon AI</h1>
              <span className="ml-2 text-sm text-gray-500">Opportunity Scanner</span>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={fetchOpportunities}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span>{loading ? 'Scanning...' : 'Refresh Opportunities'}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Building className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{stats.total_opportunities}</p>
                <p className="text-gray-600">Active Opportunities</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Award className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{stats.high_matches}</p>
                <p className="text-gray-600">High Matches</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Calendar className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{stats.due_soon}</p>
                <p className="text-gray-600">Due Soon</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Bookmark className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{stats.saved_count}</p>
                <p className="text-gray-600">Saved</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-8">
          {/* Filters Sidebar */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Filter className="h-5 w-5 mr-2" />
                Filters
              </h3>

              {/* Search */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                <input
                  type="text"
                  placeholder="Keywords, agency..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Set-Aside Type */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Set-Aside Type</label>
                <select
                  value={filters.setAside}
                  onChange={(e) => setFilters({ ...filters, setAside: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Types</option>
                  <option value="SDVOSB">SDVOSB</option>
                  <option value="Small Business">Small Business</option>
                  <option value="WOSB">WOSB</option>
                  <option value="HubZone">HubZone</option>
                  <option value="8(a)">8(a)</option>
                </select>
              </div>

              {/* NAICS */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">NAICS Code</label>
                <input
                  type="text"
                  placeholder="e.g., 541512"
                  value={filters.naics}
                  onChange={(e) => setFilters({ ...filters, naics: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Agency */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Agency</label>
                <input
                  type="text"
                  placeholder="e.g., Veterans Affairs"
                  value={filters.agency}
                  onChange={(e) => setFilters({ ...filters, agency: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <button
                onClick={() => setFilters({ setAside: '', naics: '', agency: '', valueRange: 'all' })}
                className="w-full text-sm text-gray-600 hover:text-gray-800"
              >
                Clear Filters
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {/* Tabs */}
            <div className="border-b border-gray-200 mb-6">
              <nav className="-mb-px flex space-x-8">
                {[
                  { id: 'matched', name: 'Best Matches', count: opportunities.filter(o => (o.matchScore || 0) >= 0.7).length },
                  { id: 'all', name: 'All Opportunities', count: opportunities.length },
                  { id: 'saved', name: 'Saved', count: savedOpportunities.size }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as 'all' | 'matched' | 'saved')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                  >
                    {tab.name} ({tab.count})
                  </button>
                ))}
              </nav>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="text-center py-12">
                <RefreshCw className="h-8 w-8 text-blue-600 mx-auto mb-4 animate-spin" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Loading Opportunities</h3>
                <p className="text-gray-600">Fetching latest data from SAM.gov...</p>
              </div>
            )}

            {/* Opportunity Cards */}
            {!loading && (
              <div className="space-y-4">
                {sortedOpportunities.map((opportunity) => {
                  const daysUntilDue = getDaysUntilDue(opportunity.dueDate);
                  const isExpanded = expandedCard === opportunity.id;
                  const isSaved = savedOpportunities.has(opportunity.id);

                  return (
                    <div key={opportunity.id} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                      <div className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              {opportunity.matchScore && (
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getMatchColor(opportunity.matchScore)}`}>
                                  {Math.round(opportunity.matchScore * 100)}% Match
                                </span>
                              )}
                              {opportunity.setAsideType && opportunity.setAsideType !== "Open Competition" && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                                  {opportunity.setAsideType}
                                </span>
                              )}
                              {opportunity.dueDate && (
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getUrgencyColor(daysUntilDue)}`}>
                                  Due in {daysUntilDue} days
                                </span>
                              )}
                            </div>

                            <h3 className="text-lg font-semibold text-gray-900 mb-2 leading-tight">
                              {opportunity.title || 'Untitled Opportunity'}
                            </h3>

                            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-3">
                              <div className="flex items-center">
                                <Building className="h-4 w-4 mr-2 text-gray-400" />
                                <span>{opportunity.agency || 'Unknown Agency'}</span>
                              </div>
                              {opportunity.estimatedValue && (
                                <div className="flex items-center">
                                  <DollarSign className="h-4 w-4 mr-2 text-gray-400" />
                                  <span className="font-medium">{opportunity.estimatedValue}</span>
                                </div>
                              )}
                              {opportunity.naics && (
                                <div>
                                  <span className="font-medium">NAICS:</span> {opportunity.naics}
                                  {opportunity.naicsDescription && (
                                    <span className="text-gray-500"> - {opportunity.naicsDescription}</span>
                                  )}
                                </div>
                              )}
                              {opportunity.solicitationNumber && (
                                <div>
                                  <span className="font-medium">Sol #:</span> {opportunity.solicitationNumber}
                                </div>
                              )}
                            </div>

                            {isExpanded && opportunity.description && (
                              <div className="mt-4 space-y-4">
                                <div className="p-4 bg-gray-50 rounded-lg">
                                  <h4 className="font-medium text-gray-900 mb-2">Description</h4>
                                  <p className="text-sm text-gray-700 leading-relaxed">
                                    {opportunity.description}
                                  </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  {opportunity.office && (
                                    <div>
                                      <span className="font-medium text-gray-900">Office:</span>
                                      <p className="text-gray-700">{opportunity.office}</p>
                                    </div>
                                  )}
                                  {opportunity.placeOfPerformance && (
                                    <div>
                                      <span className="font-medium text-gray-900">Place of Performance:</span>
                                      <p className="text-gray-700">{opportunity.placeOfPerformance}</p>
                                    </div>
                                  )}
                                  {opportunity.postedDate && (
                                    <div>
                                      <span className="font-medium text-gray-900">Posted Date:</span>
                                      <p className="text-gray-700">{new Date(opportunity.postedDate).toLocaleDateString()}</p>
                                    </div>
                                  )}
                                  {opportunity.contactInfo?.name && (
                                    <div>
                                      <span className="font-medium text-gray-900">Contact:</span>
                                      <p className="text-gray-700">{opportunity.contactInfo.name}</p>
                                      {opportunity.contactInfo.email && (
                                        <p className="text-blue-600 text-xs">{opportunity.contactInfo.email}</p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center space-x-2 ml-4">
                            <button
                              onClick={() => handleSaveOpportunity(opportunity.id)}
                              className={`p-2 rounded-md ${isSaved
                                  ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                                  : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                                }`}
                              title={isSaved ? "Remove from saved" : "Save opportunity"}
                            >
                              <Bookmark className={`h-5 w-5 ${isSaved ? 'fill-current' : ''}`} />
                            </button>
                            <button
                              className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md"
                              title="Analyze with AI"
                            >
                              <Eye className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => setExpandedCard(isExpanded ? null : opportunity.id)}
                              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md"
                            >
                              {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                            </button>
                          </div>
                        </div>

                        <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100">
                          <div className="flex space-x-4">
                            {opportunity.url && (
                              <a
                                href={opportunity.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center"
                              >
                                View on SAM.gov
                                <ExternalLink className="h-3 w-3 ml-1" />
                              </a>
                            )}
                            <button className="text-sm text-green-600 hover:text-green-800 font-medium">
                              AI Analysis
                            </button>
                          </div>
                          <div className="text-xs text-gray-500">
                            {opportunity.type}
                            {opportunity.dueDate && (
                              <span> • Due {new Date(opportunity.dueDate).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {sortedOpportunities.length === 0 && !loading && (
                  <div className="text-center py-12">
                    <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No opportunities found</h3>
                    <p className="text-gray-600 mb-4">
                      {searchTerm || filters.naics || filters.setAside || filters.agency
                        ? "Try adjusting your filters or search terms."
                        : "No opportunities available. Check your API connection or try refreshing."
                      }
                    </p>
                    <button
                      onClick={fetchOpportunities}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                    >
                      Refresh Data
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;