import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';

const TIER_COLORS = {
  CROSS_VALIDATED_HIGH: 'bg-risk-high-bg text-risk-high border border-risk-high/15',
  DIVERGENT_ALGO_ONLY: 'bg-risk-medium-bg text-risk-medium border border-risk-medium/15',
  DIVERGENT_LLM_ONLY: 'bg-surface-sunken text-ink-primary border border-border',
  ALGO_FLAGGED_PENDING_REVIEW: 'bg-surface-sunken text-ink-secondary border border-border-hairline',
  ALGO_CLEAR_NOT_REVIEWED: 'bg-surface-sunken text-ink-muted border border-border-hairline',
  CROSS_VALIDATED_CLEAR: 'bg-accent-subtle text-accent border border-accent/20',
};

const FACTOR_LABELS = {
  watchlist_hit: 'Watchlist Hit (Max 25 pts)',
  rule_severity: 'Rule Engine Flags (Max 20 pts)',
  isolation_forest: 'ML Anomaly Score (Max 20 pts)',
  taint_propagation: 'Risk Taint Propagation (Max 20 pts)',
  betweenness: 'Network Centrality (Max 15 pts)',
};

const FACTOR_COLORS = {
  watchlist_hit: 'bg-risk-high',
  rule_severity: 'bg-risk-medium',
  isolation_forest: 'bg-accent',
  taint_propagation: 'bg-accent/80',
  betweenness: 'bg-ink-secondary',
};

export default function VerdictsPanel({ caseId }) {
  const [verdicts, setVerdicts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [runningOpinion, setRunningOpinion] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState('ALL');
  const [copiedId, setCopiedId] = useState(null);

  const loadVerdicts = async () => {
    try {
      setLoading(true);
      const r = await apiClient.get(`/cases/${caseId}/verdicts`);
      setVerdicts(r.data || []);
    } catch (e) {
      console.error('Failed to load verdicts:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVerdicts();
  }, [caseId]);

  const triggerSecondOpinion = async (accountId) => {
    try {
      setRunningOpinion(prev => ({ ...prev, [accountId]: true }));
      await apiClient.post(`/cases/${caseId}/accounts/${accountId}/second-opinion`);
      await loadVerdicts();
    } catch (e) {
      console.error('Failed to trigger second opinion:', e);
    } finally {
      setRunningOpinion(prev => ({ ...prev, [accountId]: false }));
    }
  };

  const copyToClipboard = (text, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedId(text);
      setTimeout(() => setCopiedId(null), 1800);
    }
  };

  // Filter & Search Calculations
  const counts = {
    all: verdicts.length,
    high: verdicts.filter(v => v.algo_verdict === 'HIGH' || v.agreement_tier === 'CROSS_VALIDATED_HIGH' || (v.composite_score >= 70)).length,
    medium: verdicts.filter(v => v.algo_verdict === 'MEDIUM' || v.agreement_tier?.includes('DIVERGENT') || (v.composite_score >= 40 && v.composite_score < 70)).length,
    clear: verdicts.filter(v => v.algo_verdict === 'CLEAR' || v.agreement_tier === 'CROSS_VALIDATED_CLEAR' || (v.composite_score < 40)).length,
    audited: verdicts.filter(v => v.llm_verdict && v.llm_verdict !== 'NOT_REVIEWED').length,
  };

  const filteredVerdicts = verdicts.filter((v) => {
    // 1. Tier / Risk filter
    if (tierFilter === 'HIGH') {
      const isHigh = v.algo_verdict === 'HIGH' || v.agreement_tier === 'CROSS_VALIDATED_HIGH' || (v.composite_score >= 70);
      if (!isHigh) return false;
    } else if (tierFilter === 'MEDIUM') {
      const isMed = v.algo_verdict === 'MEDIUM' || v.agreement_tier?.includes('DIVERGENT') || (v.composite_score >= 40 && v.composite_score < 70);
      if (!isMed) return false;
    } else if (tierFilter === 'CLEAR') {
      const isClear = v.algo_verdict === 'CLEAR' || v.agreement_tier === 'CROSS_VALIDATED_CLEAR' || (v.composite_score < 40);
      if (!isClear) return false;
    } else if (tierFilter === 'AUDITED') {
      if (!v.llm_verdict || v.llm_verdict === 'NOT_REVIEWED') return false;
    }

    // 2. Text Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = (v.account_holder || '').toLowerCase().includes(q);
      const matchAcc = (v.account_id || '').toLowerCase().includes(q);
      const matchBank = (v.bank_name || '').toLowerCase().includes(q);
      const matchRole = (v.role_label || '').toLowerCase().includes(q);
      const matchTier = (v.tier_label || '').toLowerCase().includes(q);
      const matchAlgo = (v.algo_verdict || '').toLowerCase().includes(q);
      const matchLlm = (v.llm_verdict || '').toLowerCase().includes(q);
      return matchName || matchAcc || matchBank || matchRole || matchTier || matchAlgo || matchLlm;
    }

    return true;
  });

  if (loading && verdicts.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
        <span className="ml-3 text-sm text-ink-muted">Loading verdicts...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h2 className="text-base font-bold text-ink-primary">Suspect & Verdict Profiles</h2>
          <p className="text-xs text-ink-muted mt-0.5">
            A comprehensive list of suspect accounts detected in statements with cross-validated GDS risk scores, and AI blind auditing.
          </p>
        </div>
        <button
          onClick={loadVerdicts}
          className="text-xs border border-border bg-surface-raised hover:bg-surface-sunken text-ink-secondary px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      {verdicts.length > 0 && (
        <div className="bg-surface-raised border border-border-hairline rounded-xl p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-card">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink-muted">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search suspect name, account ID, bank, role..."
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-surface-sunken/60 border border-border rounded-lg text-ink-primary placeholder-ink-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-ink-muted hover:text-ink-primary text-xs"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setTierFilter('ALL')}
              className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                tierFilter === 'ALL'
                  ? 'bg-accent text-accent-fg font-semibold'
                  : 'bg-surface-sunken text-ink-secondary hover:text-ink-primary border border-border-hairline'
              }`}
            >
              All <span className="opacity-75 text-[10px]">({counts.all})</span>
            </button>
            <button
              onClick={() => setTierFilter('HIGH')}
              className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                tierFilter === 'HIGH'
                  ? 'bg-risk-high text-white font-semibold'
                  : 'bg-risk-high-bg text-risk-high hover:opacity-90 border border-risk-high/20'
              }`}
            >
              High Risk <span className="opacity-75 text-[10px]">({counts.high})</span>
            </button>
            <button
              onClick={() => setTierFilter('MEDIUM')}
              className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                tierFilter === 'MEDIUM'
                  ? 'bg-risk-medium text-white font-semibold'
                  : 'bg-risk-medium-bg text-risk-medium hover:opacity-90 border border-risk-medium/20'
              }`}
            >
              Medium Risk <span className="opacity-75 text-[10px]">({counts.medium})</span>
            </button>
            <button
              onClick={() => setTierFilter('CLEAR')}
              className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                tierFilter === 'CLEAR'
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:opacity-90 border border-emerald-500/20'
              }`}
            >
              Clear / Low <span className="opacity-75 text-[10px]">({counts.clear})</span>
            </button>
            <button
              onClick={() => setTierFilter('AUDITED')}
              className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                tierFilter === 'AUDITED'
                  ? 'bg-accent text-accent-fg font-semibold'
                  : 'bg-accent-subtle text-accent hover:opacity-90 border border-accent/20'
              }`}
            >
              Audited <span className="opacity-75 text-[10px]">({counts.audited})</span>
            </button>
          </div>
        </div>
      )}

      {/* Results summary if filtered */}
      {(searchQuery || tierFilter !== 'ALL') && verdicts.length > 0 && (
        <div className="flex items-center justify-between text-xs text-ink-muted px-1">
          <span>
            Showing <strong className="text-ink-primary">{filteredVerdicts.length}</strong> of {verdicts.length} suspect accounts
          </span>
          <button
            onClick={() => { setSearchQuery(''); setTierFilter('ALL'); }}
            className="text-accent hover:underline text-xs font-semibold"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Suspect Cards Grid */}
      <div className="grid grid-cols-1 gap-6">
        {filteredVerdicts.map((v) => {
          const breakdown = v.score_breakdown || {};
          const isLlmReviewed = Boolean(v.llm_verdict && v.llm_verdict !== 'NOT_REVIEWED');
          const isCopied = copiedId === v.account_id;

          return (
            <div
              key={v.account_id}
              className="bg-surface-raised border border-border-hairline rounded-xl overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-200"
            >
              {/* Card Header */}
              <div className="px-5 py-4 border-b border-border-hairline bg-surface-sunken/40 flex flex-wrap gap-4 items-center justify-between">
                <div className="space-y-1 text-left">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-bold text-ink-primary">
                      {v.account_holder || 'Unnamed Suspect'}
                    </span>
                    <span className="text-xs text-ink-muted">|</span>
                    
                    {/* Account ID with Copy Button */}
                    <div className="inline-flex items-center gap-1 bg-accent/5 px-2 py-0.5 rounded border border-accent/15">
                      <Link
                        to={`/cases/${caseId}/suspects/${v.account_id}`}
                        className="font-mono text-xs font-semibold text-accent hover:text-accent-hover hover:underline transition-colors"
                      >
                        {v.account_id}
                      </Link>
                      <button
                        type="button"
                        onClick={(e) => copyToClipboard(v.account_id, e)}
                        title={isCopied ? "Copied to clipboard!" : "Copy account number"}
                        className="text-ink-muted hover:text-accent p-0.5 rounded transition-colors"
                      >
                        {isCopied ? (
                          <span className="text-[10px] font-bold text-emerald-500">✓</span>
                        ) : (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                    </div>

                    <span className={`text-[9px] font-extrabold tracking-wider px-2 py-0.5 rounded-full uppercase ${TIER_COLORS[v.agreement_tier] || 'bg-surface-sunken text-ink-secondary border border-border-hairline'}`}>
                      {(v.agreement_tier || 'PENDING_REVIEW').replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="text-[10px] text-ink-muted font-mono uppercase tracking-wider flex items-center gap-2">
                    <span>{v.bank_name || 'Unknown Bank'}</span>
                    <span>•</span>
                    <span className="text-accent font-semibold">{v.role_label || 'Unassigned'} ({v.tier_label || 'Pending'})</span>
                  </div>
                </div>

                {/* Composite Score Circle badge */}
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-[10px] text-ink-muted font-bold uppercase tracking-wider">Composite Score</div>
                    <div className="text-xs text-ink-secondary font-medium">Algo Verdict: <span className="font-bold text-ink-primary">{v.algo_verdict || 'N/A'}</span></div>
                  </div>
                  <div className="flex items-center justify-center w-14 h-14 rounded-full bg-accent text-accent-fg font-semibold text-lg relative shadow-sm">
                    {v.composite_score ?? 0}
                    <div className="absolute inset-0.5 rounded-full border border-white/20"></div>
                  </div>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                {/* Left side: breakdown bars */}
                <div className="space-y-3.5">
                  <h4 className="text-xs font-semibold text-ink-primary uppercase tracking-wider mb-2">Signal Breakdown</h4>
                  {Object.entries(FACTOR_LABELS).map(([key, label]) => {
                    const value = breakdown[key] || 0.0;
                    const maxVal = key === 'watchlist_hit' ? 25 : key === 'betweenness' ? 15 : 20;
                    const pct = Math.min(100, (value / maxVal) * 100);
                    return (
                      <div key={key} className="space-y-1">
                        <div className="flex justify-between text-[11px] font-medium">
                          <span className="text-ink-secondary">{label}</span>
                          <span className="text-ink-primary font-bold">{value} pts</span>
                        </div>
                        <div className="w-full bg-surface-sunken rounded-full h-1.5 overflow-hidden border border-border-hairline">
                          <div
                            className={`${FACTOR_COLORS[key]} h-full rounded-full transition-all duration-500`}
                            style={{ width: `${pct}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Right side: LLM audit review */}
                <div className="flex flex-col justify-between border-l border-border-hairline pl-0 md:pl-6">
                  <div>
                    <h4 className="text-xs font-semibold text-ink-primary uppercase tracking-wider mb-3 flex items-center justify-between">
                      <span>Blind AI Second Opinion</span>
                      {isLlmReviewed && (
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                          v.llm_verdict === 'SUSPICIOUS' ? 'bg-risk-high-bg text-risk-high border border-risk-high/15' : 'bg-accent-subtle text-accent border border-accent/20'
                        }`}>
                          {v.llm_verdict} (Conf: {v.llm_confidence})
                        </span>
                      )}
                    </h4>

                    {isLlmReviewed ? (
                      <div className="bg-surface-sunken border border-border-hairline rounded-lg p-3 text-xs text-ink-secondary leading-relaxed italic">
                        "{v.llm_reasoning}"
                      </div>
                    ) : (
                      <div className="bg-surface-sunken/30 border border-dashed border-border rounded-lg p-4 text-center">
                        <p className="text-xs text-ink-muted leading-relaxed mb-3">
                          This account fell outside the automatic audit pool limit (RULE 17). Click below to perform an on-demand audit.
                        </p>
                        <button
                          disabled={runningOpinion[v.account_id]}
                          onClick={() => triggerSecondOpinion(v.account_id)}
                          className="text-xs bg-accent hover:bg-accent-hover disabled:bg-surface-sunken text-accent-fg font-semibold px-4 py-2 rounded-md transition-colors inline-flex items-center"
                        >
                          {runningOpinion[v.account_id] ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-accent-fg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Running Blind Audit...
                            </>
                          ) : (
                            'Trigger Blind AI Audit'
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {isLlmReviewed ? (
                    <div className="mt-4 pt-3 border-t border-border-hairline flex items-center justify-between">
                      <span className="text-[10px] text-ink-muted">
                        Audited: {v.reviewed_at ? new Date(v.reviewed_at).toLocaleString() : '—'}
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          disabled={runningOpinion[v.account_id]}
                          onClick={() => triggerSecondOpinion(v.account_id)}
                          className="text-[11px] text-ink-secondary hover:text-ink-primary font-semibold transition-colors"
                        >
                          {runningOpinion[v.account_id] ? 'Auditing...' : 'Re-run AI Audit'}
                        </button>
                        <Link
                          to={`/cases/${caseId}/suspects/${v.account_id}`}
                          className="text-[11px] text-accent hover:text-accent-hover font-bold transition-colors uppercase tracking-wider flex items-center gap-1"
                        >
                          View Suspect Profile →
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 pt-3 border-t border-border-hairline/40 flex justify-end">
                      <Link
                        to={`/cases/${caseId}/suspects/${v.account_id}`}
                        className="text-[11px] text-accent hover:text-accent-hover font-bold transition-colors uppercase tracking-wider flex items-center gap-1"
                      >
                        View Suspect Profile →
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Empty filter results state */}
        {verdicts.length > 0 && filteredVerdicts.length === 0 && (
          <div className="text-center py-12 border border-dashed border-border rounded-xl bg-surface-sunken/40 space-y-3">
            <p className="text-xs text-ink-muted">No suspect profiles match your search or filter criteria.</p>
            <button
              onClick={() => { setSearchQuery(''); setTierFilter('ALL'); }}
              className="text-xs bg-surface-raised border border-border hover:bg-surface-sunken text-accent font-semibold px-3 py-1.5 rounded-md transition-colors"
            >
              Clear Filters
            </button>
          </div>
        )}

        {/* Global empty state */}
        {verdicts.length === 0 && (
          <div className="text-center py-12 border border-dashed border-border rounded-lg bg-surface-sunken/40">
            <span className="text-xs text-ink-muted">No account verdicts available. Please trigger an analysis first.</span>
          </div>
        )}
      </div>
    </div>
  );
}
