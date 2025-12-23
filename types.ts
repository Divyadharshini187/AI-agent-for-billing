export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Menu {
  category: string;
  items: MenuItem[];
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
}

export interface LogMessage {
  role: 'user' | 'model' | 'system';
  text: string;
  timestamp: Date;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
