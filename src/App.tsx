import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Client, SellerGroup, MessageConfig } from './types';
import { SAMPLE_CLIENTS } from './data/sampleClients';
import { buildWhatsAppLink } from './utils/phone';
import { Header } from './components/Header';
import { SummaryStats } from './components/SummaryStats';
import { CampaignConfig } from './components/CampaignConfig';
import { SellerGroupView } from './components/SellerGroupView';
import { ImportModal } from './components/ImportModal';
import { EmptyState } from './components/EmptyState';
import {
  saveAppStateToFirestore,
  loadAppStateFromFirestore,
  subscribeToAppState,
} from './services/firestoreService';

const LOCAL_STORAGE_KEY = 'whatsapp_reactivation_clients';
const LOCAL_STORAGE_CONFIG_KEY = 'whatsapp_reactivation_config';

const DEFAULT_CONFIG: MessageConfig = {
  context:
    'Estamos com uma campanha especial de reativação com 15% de desconto no pedido de reposição e frete grátis para pedidos fechados esta semana.',
  keywords: 'desconto especial, frete grátis, reposição rápida, novidades',
  tone: 'amigavel',
  mentionDays: true,
  mentionSeller: true,
};

export default function App() {
  const [clients, setClients] = useState<Client[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error loading saved clients:', e);
    }
    return SAMPLE_CLIENTS;
  });

  const [config, setConfig] = useState<MessageConfig>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_CONFIG_KEY);
      if (saved) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('Error loading config:', e);
    }
    return DEFAULT_CONFIG;
  });

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [regeneratingClientId, setRegeneratingClientId] = useState<string | null>(null);

  // Firestore sync state
  const [syncStatus, setSyncStatus] = useState<'synced' | 'saving' | 'loading' | 'error'>('loading');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const isInitialLoadDone = useRef(false);
  const saveTimeoutRef = useRef<any>(null);

  // 1. Initial load from Firestore
  useEffect(() => {
    let isMounted = true;

    async function initFirestoreData() {
      try {
        setSyncStatus('loading');
        const remoteState = await loadAppStateFromFirestore();

        if (!isMounted) return;

        if (remoteState && remoteState.clients && remoteState.clients.length > 0) {
          // Cloud has saved data! Load it directly
          setClients(remoteState.clients);
          if (remoteState.config) {
            setConfig((prev) => ({ ...prev, ...remoteState.config }));
          }
          setLastSavedAt(remoteState.updatedAt || new Date().toISOString());
          setSyncStatus('synced');
        } else {
          // Firestore is empty: initialize with current state
          await saveAppStateToFirestore(clients, config, 'Planilha Inicial');
          if (isMounted) {
            setLastSavedAt(new Date().toISOString());
            setSyncStatus('synced');
          }
        }
      } catch (err) {
        console.error('Failed to initialize Firestore data:', err);
        if (isMounted) {
          setSyncStatus('synced'); // LocalStorage fallback
        }
      } finally {
        if (isMounted) {
          isInitialLoadDone.current = true;
        }
      }
    }

    initFirestoreData();

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Debounced save to Firestore whenever clients or config changes after initial load
  const triggerFirestoreSave = useCallback(
    (newClients: Client[], newConfig: MessageConfig, sourceName?: string) => {
      setSyncStatus('saving');

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          await saveAppStateToFirestore(newClients, newConfig, sourceName);
          setLastSavedAt(new Date().toISOString());
          setSyncStatus('synced');
        } catch (err) {
          console.error('Error auto-saving to Firestore:', err);
          setSyncStatus('error');
        }
      }, 1000);
    },
    []
  );

  // Save to localStorage & schedule Firestore auto-save
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(clients));
      localStorage.setItem(LOCAL_STORAGE_CONFIG_KEY, JSON.stringify(config));
    } catch (e) {
      console.error('Error persisting to local storage:', e);
    }

    if (isInitialLoadDone.current) {
      triggerFirestoreSave(clients, config);
    }
  }, [clients, config, triggerFirestoreSave]);

  // Group clients by seller
  const sellerGroups = useMemo<SellerGroup[]>(() => {
    const map = new Map<string, Client[]>();

    clients.forEach((client) => {
      const seller = client.seller?.trim() || 'Geral';
      if (!map.has(seller)) {
        map.set(seller, []);
      }
      map.get(seller)!.push(client);
    });

    const groups: SellerGroup[] = [];
    map.forEach((sellerClients, sellerName) => {
      const totalClients = sellerClients.length;
      const contactedCount = sellerClients.filter((c) => c.status === 'contacted').length;
      const avgDaysInactive = Math.round(
        sellerClients.reduce((acc, c) => acc + (c.daysInactive || 0), 0) / (totalClients || 1)
      );
      const maxDaysInactive = Math.max(...sellerClients.map((c) => c.daysInactive || 0), 0);

      groups.push({
        sellerName,
        clients: sellerClients,
        totalClients,
        avgDaysInactive,
        maxDaysInactive,
        contactedCount,
      });
    });

    // Sort by largest client volume
    return groups.sort((a, b) => b.totalClients - a.totalClients);
  }, [clients]);

  const totalClients = clients.length;
  const contactedCount = clients.filter((c) => c.status === 'contacted').length;
  const generatedCount = clients.filter((c) => !!c.generatedMessage).length;

  // Import handler
  const handleImportSuccess = async (newClients: Client[]) => {
    setClients(newClients);
    setSyncStatus('saving');
    try {
      await saveAppStateToFirestore(newClients, config, 'Planilha Importada em PDF');
      setLastSavedAt(new Date().toISOString());
      setSyncStatus('synced');
    } catch (err) {
      console.error('Error saving imported sheet to Firestore:', err);
      setSyncStatus('error');
    }
  };

  const handleLoadSample = async () => {
    setClients(SAMPLE_CLIENTS);
    setSyncStatus('saving');
    try {
      await saveAppStateToFirestore(SAMPLE_CLIENTS, config, 'Exemplo de Demonstração');
      setLastSavedAt(new Date().toISOString());
      setSyncStatus('synced');
    } catch (err) {
      console.error('Error saving sample to Firestore:', err);
      setSyncStatus('error');
    }
  };

  const handleClearData = async () => {
    if (window.confirm('Tem certeza que deseja limpar todos os clientes cadastrados?')) {
      setClients([]);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      setSyncStatus('saving');
      try {
        await saveAppStateToFirestore([], config, 'Base Limpa');
        setLastSavedAt(new Date().toISOString());
        setSyncStatus('synced');
      } catch (err) {
        console.error('Error clearing Firestore state:', err);
      }
    }
  };

  const handleManualSync = async () => {
    setSyncStatus('saving');
    try {
      await saveAppStateToFirestore(clients, config, 'Sincronização Manual');
      setLastSavedAt(new Date().toISOString());
      setSyncStatus('synced');
    } catch (err) {
      console.error('Error in manual sync:', err);
      setSyncStatus('error');
      alert('Erro ao sincronizar com Firestore. Verifique a conexão.');
    }
  };

  const handleUpdateClientMessage = (clientId: string, newMessage: string) => {
    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, generatedMessage: newMessage } : c))
    );
  };

  const handleToggleStatus = (clientId: string) => {
    setClients((prev) =>
      prev.map((c) => {
        if (c.id === clientId) {
          const newStatus = c.status === 'contacted' ? 'pending' : 'contacted';
          return {
            ...c,
            status: newStatus,
            contactedAt: newStatus === 'contacted' ? new Date().toISOString() : undefined,
          };
        }
        return c;
      })
    );
  };

  // Generate unique messages for all clients with AI
  const handleGenerateAll = async () => {
    if (clients.length === 0) return;
    setIsGeneratingAll(true);

    try {
      const res = await fetch('/api/generate-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clients: clients.map((c) => ({
            id: c.id,
            name: c.name,
            daysInactive: c.daysInactive,
            seller: c.seller,
            phone: c.phone,
            city: c.city,
          })),
          context: config.context,
          keywords: config.keywords,
          tone: config.tone,
          mentionDays: config.mentionDays,
          mentionSeller: config.mentionSeller,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao gerar mensagens com IA.');
      }

      if (Array.isArray(data.messages)) {
        const messageMap = new Map<string, string>();
        data.messages.forEach((m: any) => {
          if (m.clientId && m.message) {
            messageMap.set(m.clientId, m.message);
          }
        });

        const updatedClients = clients.map((c) => {
          const msg = messageMap.get(c.id);
          return msg ? { ...c, generatedMessage: msg } : c;
        });

        setClients(updatedClients);

        // Instantly persist the newly generated messages to Firestore
        try {
          await saveAppStateToFirestore(updatedClients, config, 'Mensagens Geradas por IA');
          setLastSavedAt(new Date().toISOString());
          setSyncStatus('synced');
        } catch (saveErr) {
          console.error('Error saving generated messages to Firestore:', saveErr);
        }
      }
    } catch (err: any) {
      console.error('Error in handleGenerateAll:', err);
      alert('Erro ao gerar mensagens: ' + (err.message || 'Falha na conexão com a IA.'));
    } finally {
      setIsGeneratingAll(false);
    }
  };

  // Regenerate single client message with AI
  const handleRegenerateSingle = async (client: Client) => {
    setRegeneratingClientId(client.id);

    try {
      const res = await fetch('/api/generate-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client,
          context: config.context,
          keywords: config.keywords,
          tone: config.tone,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao regenerar mensagem.');
      }

      if (data.message) {
        const updatedClients = clients.map((c) =>
          c.id === client.id ? { ...c, generatedMessage: data.message } : c
        );
        setClients(updatedClients);
        saveAppStateToFirestore(updatedClients, config, `Mensagem Atualizada: ${client.name}`).catch(
          (err) => console.error('Error saving updated single message to Firestore:', err)
        );
      }
    } catch (err: any) {
      console.error('Error in handleRegenerateSingle:', err);
      alert('Erro ao regenerar mensagem: ' + (err.message || 'Erro de conexão.'));
    } finally {
      setRegeneratingClientId(null);
    }
  };

  // Export data with WhatsApp links to CSV
  const handleExportCsv = () => {
    if (clients.length === 0) return;

    const headers = [
      'Vendedor',
      'Cliente',
      'Telefone',
      'Dias sem Comprar',
      'Status',
      'Link WhatsApp',
      'Mensagem Gerada',
    ];

    const rows = clients.map((c) => {
      const link = buildWhatsAppLink(c.cleanPhone, c.generatedMessage);
      return [
        `"${(c.seller || '').replace(/"/g, '""')}"`,
        `"${(c.name || '').replace(/"/g, '""')}"`,
        `"${(c.phone || c.cleanPhone || '').replace(/"/g, '""')}"`,
        c.daysInactive || 0,
        c.status === 'contacted' ? 'Contatado' : 'Pendente',
        `"${link.replace(/"/g, '""')}"`,
        `"${(c.generatedMessage || '').replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `clientes_reativacao_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* Top Header */}
      <Header
        totalClients={totalClients}
        totalSellers={sellerGroups.length}
        contactedCount={contactedCount}
        syncStatus={syncStatus}
        lastSavedAt={lastSavedAt}
        onOpenImport={() => setIsImportModalOpen(true)}
        onLoadSample={handleLoadSample}
        onClearData={handleClearData}
        onExportCsv={handleExportCsv}
        onManualSync={handleManualSync}
      />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {totalClients === 0 ? (
          <EmptyState
            onOpenImport={() => setIsImportModalOpen(true)}
            onLoadSample={handleLoadSample}
          />
        ) : (
          <div className="space-y-6">
            {/* Quick Stats Summary */}
            <SummaryStats clients={clients} sellerGroups={sellerGroups} />

            {/* Campaign Config with AI Message Generator */}
            <CampaignConfig
              config={config}
              onChangeConfig={setConfig}
              onGenerateAll={handleGenerateAll}
              isGenerating={isGeneratingAll}
              totalClients={totalClients}
              generatedCount={generatedCount}
            />

            {/* Seller Group View Accordions & Clients */}
            <SellerGroupView
              sellerGroups={sellerGroups}
              config={config}
              onUpdateClientMessage={handleUpdateClientMessage}
              onToggleStatus={handleToggleStatus}
              onRegenerateSingle={handleRegenerateSingle}
              regeneratingClientId={regeneratingClientId}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            Sistema de Reativação WhatsApp por Vendedor • Conectado ao Firebase Firestore
          </span>
          <span className="text-[11px] text-slate-400">
            Todas as planilhas, mensagens e palavras-chave ficam gravadas na nuvem até nova alteração.
          </span>
        </div>
      </footer>

      {/* Import Modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={handleImportSuccess}
        onLoadSample={handleLoadSample}
      />
    </div>
  );
}
