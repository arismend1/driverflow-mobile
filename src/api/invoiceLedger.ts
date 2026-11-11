/**
 * Billing invoice ledger view. The backend limits a *response page* to 100 rows;
 * that is not a retention/storage limit. Never calculate balances from page 1.
 * All amounts are integer cents; mixed currencies must not be summed.
 */
export const INVOICE_PAGE_SIZE = 100;

export type LedgerInvoice = {
  id: number;
  status: string;
  currency: string;
  total_cents: number | string;
  [key: string]: unknown;
};

export type InvoiceLedgerSummary = {
  pending_count: number;
  pending_amount_cents: number;
  paid_count: number;
  paid_amount_cents: number;
  currency: string;
};

export const loadAllBillingInvoices = async (
  fetchPage: (limit: number, offset: number) => Promise<unknown>,
): Promise<LedgerInvoice[]> => {
  const collected: LedgerInvoice[] = [];
  const seenIds = new Set<number>();
  let offset = 0;

  while (true) {
    const page = await fetchPage(INVOICE_PAGE_SIZE, offset);
    if (!Array.isArray(page) || page.length > INVOICE_PAGE_SIZE) {
      throw new Error('BILLING_LEDGER_INVALID_PAGE');
    }
    for (const value of page) {
      if (!value || typeof value !== 'object') throw new Error('BILLING_LEDGER_INVALID_INVOICE');
      const invoice = value as LedgerInvoice;
      const id = Number(invoice.id);
      if (!Number.isSafeInteger(id) || id <= 0) throw new Error('BILLING_LEDGER_INVALID_ID');
      if (seenIds.has(id)) throw new Error('BILLING_LEDGER_DUPLICATE_INVOICE');
      seenIds.add(id);
      collected.push(invoice);
    }
    if (page.length < INVOICE_PAGE_SIZE) return collected;
    offset += INVOICE_PAGE_SIZE;
  }
};

export const summarizeBillingLedger = (invoices: LedgerInvoice[]): InvoiceLedgerSummary => {
  const result: InvoiceLedgerSummary = {
    pending_count: 0,
    pending_amount_cents: 0,
    paid_count: 0,
    paid_amount_cents: 0,
    currency: 'usd',
  };

  let firstCurrency: string | null = null;
  for (const invoice of invoices) {
    const currency = String(invoice.currency || '').toLowerCase();
    if (!/^[a-z]{3}$/.test(currency)) throw new Error('BILLING_LEDGER_INVALID_CURRENCY');
    if (firstCurrency !== null && firstCurrency !== currency) {
      throw new Error('BILLING_LEDGER_MIXED_CURRENCIES');
    }
    firstCurrency = currency;
    const cents = Number(invoice.total_cents);
    if (!Number.isSafeInteger(cents) || cents < 0) {
      throw new Error('BILLING_LEDGER_INVALID_AMOUNT');
    }
    const state = String(invoice.status || '').toLowerCase();
    if (state === 'charged' || state === 'paid') {
      result.paid_count += 1;
      result.paid_amount_cents += cents;
    } else if (state === 'pending') {
      result.pending_count += 1;
      result.pending_amount_cents += cents;
    }
    if (!Number.isSafeInteger(result.paid_amount_cents) ||
        !Number.isSafeInteger(result.pending_amount_cents)) {
      throw new Error('BILLING_LEDGER_AMOUNT_OVERFLOW');
    }
  }

  if (firstCurrency) result.currency = firstCurrency;
  return result;
};
