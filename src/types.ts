export interface Client {
  id: string;
  name: string;
  phone: string;
  cleanPhone: string; // only numbers, with country code (e.g. 5511999999999)
  daysInactive: number;
  seller: string;
  lastPurchaseDate?: string;
  city?: string;
  generatedMessage?: string;
  isGeneratingMessage?: boolean;
  status: 'pending' | 'contacted' | 'skipped';
  contactedAt?: string;
  notes?: string;
}

export interface SellerGroup {
  sellerName: string;
  clients: Client[];
  totalClients: number;
  avgDaysInactive: number;
  maxDaysInactive: number;
  contactedCount: number;
}

export type MessageTone = 'amigavel' | 'consultivo' | 'promocional' | 'direto' | 'formal';

export interface MessageConfig {
  context: string;
  keywords: string;
  tone: MessageTone;
  mentionDays: boolean;
  mentionSeller: boolean;
  customInstructions?: string;
}

export interface ExtractionResponse {
  success: boolean;
  clients?: Array<{
    name: string;
    phone: string;
    daysInactive: number;
    seller: string;
    lastPurchaseDate?: string;
    city?: string;
  }>;
  error?: string;
  rawCount?: number;
}
