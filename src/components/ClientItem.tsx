import React, { useState } from 'react';
import {
  MessageSquare,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Edit2,
  Phone,
  Clock,
  MapPin,
  Calendar,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Client, MessageConfig } from '../types';
import { buildWhatsAppLink, formatPhoneDisplay } from '../utils/phone';

interface ClientItemProps {
  client: Client;
  config: MessageConfig;
  onUpdateClientMessage: (clientId: string, newMessage: string) => void;
  onToggleStatus: (clientId: string) => void;
  onRegenerateSingle: (client: Client) => Promise<void>;
  isRegenerating?: boolean;
}

export const ClientItem: React.FC<ClientItemProps> = ({
  client,
  config,
  onUpdateClientMessage,
  onToggleStatus,
  onRegenerateSingle,
  isRegenerating = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(client.generatedMessage || '');
  const [copied, setCopied] = useState(false);

  // Sync editedText when client.generatedMessage updates from batch AI
  React.useEffect(() => {
    if (client.generatedMessage) {
      setEditedText(client.generatedMessage);
    }
  }, [client.generatedMessage]);

  const handleSaveEdit = () => {
    onUpdateClientMessage(client.id, editedText);
    setIsEditing(false);
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const textToCopy = client.generatedMessage || editedText;
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleWhatsAppClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // If not already contacted, mark as contacted and shoot confetti
    if (client.status !== 'contacted') {
      onToggleStatus(client.id);
      try {
        confetti({
          particleCount: 40,
          spread: 60,
          origin: { y: 0.8 },
          colors: ['#22c55e', '#16a34a', '#4ade80'],
        });
      } catch (err) {
        // ignore if confetti fails
      }
    }
  };

  const whatsAppLink = buildWhatsAppLink(client.cleanPhone, client.generatedMessage || editedText);

  // Determine severity badge for days inactive
  const getDaysBadge = (days: number) => {
    if (days >= 90) {
      return {
        bg: 'bg-rose-50 text-rose-700 border-rose-200',
        dot: 'bg-rose-500',
        label: `${days} dias sem comprar (Crítico)`,
      };
    }
    if (days >= 45) {
      return {
        bg: 'bg-amber-50 text-amber-700 border-amber-200',
        dot: 'bg-amber-500',
        label: `${days} dias sem comprar (Alerta)`,
      };
    }
    return {
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      dot: 'bg-emerald-500',
      label: `${days} dias sem comprar (Recente)`,
    };
  };

  const daysBadge = getDaysBadge(client.daysInactive);

  return (
    <div
      className={`border rounded-xl p-4 transition-all ${
        client.status === 'contacted'
          ? 'bg-slate-50/70 border-emerald-200/80 shadow-2xs'
          : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        {/* Client Info Column */}
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-bold text-slate-900">{client.name}</h4>

            {/* Inactivity Badge */}
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${daysBadge.bg}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${daysBadge.dot}`} />
              {daysBadge.label}
            </span>

            {/* Status Badge */}
            {client.status === 'contacted' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <Check className="w-3 h-3 text-emerald-600" />
                Contatado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600">
                Pendente
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500">
            <div className="flex items-center gap-1">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-mono font-medium text-slate-700">
                {formatPhoneDisplay(client.phone || client.cleanPhone)}
              </span>
            </div>

            {client.city && (
              <div className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>{client.city}</span>
              </div>
            )}

            {client.lastPurchaseDate && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Última compra: {client.lastPurchaseDate}</span>
              </div>
            )}
          </div>

          {/* Message Area */}
          <div className="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs">
            <div className="flex items-center justify-between mb-1.5 text-slate-500 font-medium">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
                  Mensagem WhatsApp Personalizada:
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                  title="Copiar texto da mensagem"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-700 font-semibold">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      Copiar
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsEditing(!isEditing)}
                  className="inline-flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  <Edit2 className="w-3 h-3" />
                  {isEditing ? 'Cancelar' : 'Editar'}
                </button>

                <button
                  type="button"
                  disabled={isRegenerating}
                  onClick={() => onRegenerateSingle(client)}
                  className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer disabled:opacity-50"
                  title="Gerar uma nova variação de mensagem para este cliente"
                >
                  <RefreshCw className={`w-3 h-3 ${isRegenerating ? 'animate-spin' : ''}`} />
                  Regenerar IA
                </button>
              </div>
            </div>

            {isEditing ? (
              <div className="space-y-2 mt-2">
                <textarea
                  rows={4}
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  className="w-full p-2 text-xs text-slate-800 font-sans bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-2.5 py-1 text-[11px] text-slate-600 hover:text-slate-800"
                  >
                    Descartar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    className="px-3 py-1 text-[11px] font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors"
                  >
                    Salvar Alteração
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed text-xs">
                {client.generatedMessage || (
                  <span className="italic text-slate-400">
                    Nenhuma mensagem gerada ainda. Use o botão "Gerar Mensagens Únicas com IA" acima ou clique em "Regenerar IA".
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* WhatsApp Direct Action Column */}
        <div className="lg:w-56 shrink-0 flex flex-col gap-2 pt-1">
          <a
            href={whatsAppLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleWhatsAppClick}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-xs rounded-xl shadow-xs shadow-emerald-600/30 hover:shadow-md transition-all cursor-pointer text-center group"
          >
            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <MessageSquare className="w-3 h-3 text-white fill-current" />
            </div>
            <span>Conversar no WhatsApp</span>
            <ExternalLink className="w-3.5 h-3.5 text-emerald-200" />
          </a>

          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              onClick={() => onToggleStatus(client.id)}
              className="text-[11px] text-slate-500 hover:text-slate-800 underline decoration-slate-300 cursor-pointer"
            >
              {client.status === 'contacted' ? 'Marcar como Pendente' : 'Marcar como Contatado'}
            </button>
            <span className="text-[10px] text-slate-400 font-mono">
              wa.me/{client.cleanPhone || 'sem-numero'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
