import React from 'react';
import { Users, UserCheck, Clock, CheckCircle2 } from 'lucide-react';
import { Client, SellerGroup } from '../types';

interface SummaryStatsProps {
  clients: Client[];
  sellerGroups: SellerGroup[];
}

export const SummaryStats: React.FC<SummaryStatsProps> = ({ clients, sellerGroups }) => {
  const total = clients.length;
  if (total === 0) return null;

  const contacted = clients.filter((c) => c.status === 'contacted').length;
  const contactedPct = Math.round((contacted / total) * 100);
  const avgDays = Math.round(
    clients.reduce((acc, curr) => acc + (curr.daysInactive || 0), 0) / total
  );
  const criticalCount = clients.filter((c) => c.daysInactive >= 90).length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Clientes
          </span>
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-900">{total}</span>
          <span className="text-xs text-slate-500">em {sellerGroups.length} vendedores</span>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Inatividade Média
          </span>
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-900">{avgDays}</span>
          <span className="text-xs text-slate-500">dias sem comprar</span>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Mais Críticos (+90d)
          </span>
          <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
            <UserCheck className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-rose-600">{criticalCount}</span>
          <span className="text-xs text-slate-500">
            ({Math.round((criticalCount / total) * 100)}% da base)
          </span>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Contatados via Zap
          </span>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-emerald-600">{contacted}</span>
          <span className="text-xs text-slate-500">de {total} ({contactedPct}%)</span>
        </div>
        <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${contactedPct}%` }}
          />
        </div>
      </div>
    </div>
  );
};
