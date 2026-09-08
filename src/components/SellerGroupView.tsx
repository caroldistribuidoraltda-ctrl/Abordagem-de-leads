import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  User,
  Clock,
  CheckCircle2,
  Search,
  Filter,
  ArrowUpDown,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import { Client, SellerGroup, MessageConfig } from '../types';
import { ClientItem } from './ClientItem';

interface SellerGroupViewProps {
  sellerGroups: SellerGroup[];
  config: MessageConfig;
  onUpdateClientMessage: (clientId: string, newMessage: string) => void;
  onToggleStatus: (clientId: string) => void;
  onRegenerateSingle: (client: Client) => Promise<void>;
  regeneratingClientId: string | null;
}

export const SellerGroupView: React.FC<SellerGroupViewProps> = ({
  sellerGroups,
  config,
  onUpdateClientMessage,
  onToggleStatus,
  onRegenerateSingle,
  regeneratingClientId,
}) => {
  // Track open state for each seller (default: first open, or all open if <= 3)
  const [openSellers, setOpenSellers] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    sellerGroups.forEach((g, idx) => {
      initial[g.sellerName] = idx === 0 || sellerGroups.length <= 2;
    });
    return initial;
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'contacted'>('all');
  const [sortBy, setSortBy] = useState<'daysDesc' | 'daysAsc' | 'name'>('daysDesc');

  const toggleSeller = (sellerName: string) => {
    setOpenSellers((prev) => ({
      ...prev,
      [sellerName]: !prev[sellerName],
    }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    sellerGroups.forEach((g) => {
      all[g.sellerName] = true;
    });
    setOpenSellers(all);
  };

  const collapseAll = () => {
    const none: Record<string, boolean> = {};
    sellerGroups.forEach((g) => {
      none[g.sellerName] = false;
    });
    setOpenSellers(none);
  };

  return (
    <div className="space-y-4">
      {/* Global Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por cliente, telefone, cidade ou vendedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter */}
          <div className="flex items-center rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                statusFilter === 'pending'
                  ? 'bg-white text-amber-700 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pendentes
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('contacted')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                statusFilter === 'contacted'
                  ? 'bg-white text-emerald-700 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Contatados
            </button>
          </div>

          {/* Sort order */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg py-1.5 px-2.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="daysDesc">Mais dias inativo</option>
              <option value="daysAsc">Menos dias inativo</option>
              <option value="name">Nome (A-Z)</option>
            </select>
          </div>

          {/* Expand/Collapse buttons */}
          <div className="flex items-center gap-1 pl-1 border-l border-slate-200">
            <button
              type="button"
              onClick={expandAll}
              className="px-2 py-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer"
            >
              Expandir todos
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="px-2 py-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer"
            >
              Recolher
            </button>
          </div>
        </div>
      </div>

      {/* Seller Groups Accordions */}
      <div className="space-y-4">
        {sellerGroups.map((group) => {
          const isOpen = !!openSellers[group.sellerName];

          // Filter and sort clients for this seller
          let filteredClients = group.clients.filter((client) => {
            const matchesSearch =
              searchTerm === '' ||
              client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              client.phone.includes(searchTerm) ||
              client.cleanPhone.includes(searchTerm) ||
              (client.city && client.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
              group.sellerName.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesStatus =
              statusFilter === 'all' || client.status === statusFilter;

            return matchesSearch && matchesStatus;
          });

          // Sort clients
          filteredClients.sort((a, b) => {
            if (sortBy === 'daysDesc') return b.daysInactive - a.daysInactive;
            if (sortBy === 'daysAsc') return a.daysInactive - b.daysInactive;
            return a.name.localeCompare(b.name);
          });

          const sellerContacted = group.clients.filter((c) => c.status === 'contacted').length;
          const sellerProgressPct = Math.round((sellerContacted / group.clients.length) * 100);

          return (
            <div
              key={group.sellerName}
              className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden transition-all"
            >
              {/* Seller Header Clickable Row */}
              <div
                onClick={() => toggleSeller(group.sellerName)}
                className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer select-none transition-colors ${
                  isOpen ? 'bg-slate-50/80 border-b border-slate-200' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 text-white font-bold text-sm flex items-center justify-center shadow-2xs shrink-0">
                    {group.sellerName.slice(0, 2).toUpperCase()}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">
                        {group.sellerName}
                      </h3>
                      <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-700">
                        {group.clients.length} {group.clients.length === 1 ? 'cliente' : 'clientes'}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-500 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        Média de inatividade: <strong>{group.avgDaysInactive} dias</strong>
                      </span>
                      <span className="text-slate-300">•</span>
                      <span>
                        Máximo: <strong>{group.maxDaysInactive} dias</strong>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Progress bar */}
                  <div className="w-36 hidden sm:block">
                    <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                      <span>Progresso</span>
                      <span className="font-semibold text-emerald-700">
                        {sellerContacted}/{group.clients.length} ({sellerProgressPct}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${sellerProgressPct}%` }}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors"
                    aria-label={isOpen ? 'Recolher vendedor' : 'Abrir vendedor'}
                  >
                    {isOpen ? (
                      <ChevronUp className="w-5 h-5 text-slate-600" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-600" />
                    )}
                  </button>
                </div>
              </div>

              {/* Expanded Clients List */}
              {isOpen && (
                <div className="p-4 bg-slate-50/40 space-y-3">
                  {filteredClients.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs">
                      Nenhum cliente deste vendedor encontrado com os filtros atuais.
                    </div>
                  ) : (
                    filteredClients.map((client) => (
                      <ClientItem
                        key={client.id}
                        client={client}
                        config={config}
                        onUpdateClientMessage={onUpdateClientMessage}
                        onToggleStatus={onToggleStatus}
                        onRegenerateSingle={onRegenerateSingle}
                        isRegenerating={regeneratingClientId === client.id}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
