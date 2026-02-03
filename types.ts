export interface OzonCredentials {
  clientId: string;
  apiKey: string;
}

// Ozon V3 Posting List Request
export interface OzonPostingRequest {
  dir: string;
  filter: {
    since: string;
    to: string;
    status?: string;
  };
  limit: number;
  offset: number;
  with: {
    analytics_data: boolean;
    barcodes: boolean;
    financial_data: boolean;
    translit: boolean;
  };
}

export interface OzonProduct {
  name: string;
  offer_id: string;
  price: string;
  currency_code: string;
  quantity: number;
  sku: number;
  mandatory_mark: string[];
}

export interface OzonPosting {
  posting_number: string;
  order_id: number;
  order_number: string;
  status: string;
  delivery_method: {
    id: number;
    name: string;
    warehouse_id: number;
    warehouse: string;
    tpl_provider: string;
    tpl_provider_id: number;
  };
  tracking_number: string;
  tpl_integration_type: string;
  in_process_at: string;
  shipment_date: string;
  delivering_date: string | null;
  cancellation: {
    cancel_reason_id: number;
    cancel_reason: string;
    cancellation_type: string;
    cancelled_after_ship: boolean;
    affect_cancellation_rating: boolean;
    cancellation_initiator: string;
  };
  customer: {
    customer_id: number | null;
    address_tail: string | null;
    phone: string | null;
    name: string | null;
  } | null;
  products: OzonProduct[];
  analytics_data?: {
    region: string;
    city: string;
    delivery_type: string;
    payment_type_group_name: string;
    warehouse_id: number;
    warehouse_name: string;
  };
  financial_data?: {
    products: Array<{
      commission_amount: number;
      commission_percent: number;
      payout: number;
      product_id: number;
      old_price: number;
      price: number;
      total_discount_value: number;
      total_discount_percent: number;
    }>;
  };
  // Added to track which store this order belongs to in multi-store mode
  clientId?: string;
}

export interface OzonApiResponse {
  result: {
    postings: OzonPosting[];
    has_next: boolean;
  };
}

export interface DailySales {
  date: string;
  revenue: number;
  orders: number;
}