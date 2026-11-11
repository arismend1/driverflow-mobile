import {
  INVOICE_PAGE_SIZE,
  loadAllBillingInvoices,
  summarizeBillingLedger,
} from '../src/api/invoiceLedger';
import { getBillingSummary, getBillingTickets } from '../src/api/client';

jest.mock('../src/api/config', () => ({
  API_URL: 'http://127.0.0.1:3000',
}));

const invoices = Array.from({ length: 205 }, (_, i) => ({
  id: i + 1,
  status: i % 2 === 0 ? 'charged' : 'pending',
  total_cents: i % 2 === 0 ? 200 : 100,
  currency: 'usd',
  week_start: '2026-01-01',
  week_end: '2026-01-07',
}));

describe('invoice ledger: backend 100-row page is not a storage limit', () => {
  it('loads 205 invoices via offsets 0,100,200 without losing ledger rows', async () => {
    const calls: Array<[number, number]> = [];
    const all = await loadAllBillingInvoices(async (limit, offset) => {
      calls.push([limit, offset]);
      return invoices.slice(offset, offset + limit);
    });
    expect(INVOICE_PAGE_SIZE).toBe(100);
    expect(calls).toEqual([[100, 0], [100, 100], [100, 200]]);
    expect(all).toHaveLength(205);
    expect(summarizeBillingLedger(all)).toEqual({
      pending_count: 102,
      pending_amount_cents: 10200,
      paid_count: 103,
      paid_amount_cents: 20600,
      currency: 'usd',
    });
  });

  it('checks one empty final page when count is exactly divisible by 100', async () => {
    const offsets: number[] = [];
    const loaded = await loadAllBillingInvoices(async (limit, offset) => {
      offsets.push(offset);
      return invoices.slice(0, 200).slice(offset, offset + limit);
    });
    expect(offsets).toEqual([0, 100, 200]);
    expect(loaded).toHaveLength(200);
  });

  it('fails closed when pages repeat the same invoice IDs instead of inflating totals', async () => {
    await expect(loadAllBillingInvoices(async () => invoices.slice(0, 100)))
      .rejects.toThrow('BILLING_LEDGER_DUPLICATE_INVOICE');
  });

  it('fails closed for a missing or invalid page', async () => {
    await expect(loadAllBillingInvoices(async () => ({ error: 'bad_response' })))
      .rejects.toThrow('BILLING_LEDGER_INVALID_PAGE');
    await expect(loadAllBillingInvoices(async () => [{ total_cents: 99, currency: 'usd', status: 'paid' }]))
      .rejects.toThrow('BILLING_LEDGER_INVALID_ID');
  });

  it('never sums different currencies into one balance', () => {
    expect(() => summarizeBillingLedger([
      { id: 1, status: 'charged', currency: 'usd', total_cents: 100 },
      { id: 2, status: 'pending', currency: 'eur', total_cents: 200 },
    ])).toThrow('BILLING_LEDGER_MIXED_CURRENCIES');
  });

  it('rejects malformed amounts instead of treating them as zero', () => {
    for (const amount of ['NaN', '-100', '1.25', '9007199254740992']) {
      expect(() => summarizeBillingLedger([
        { id: 1, status: 'paid', currency: 'usd', total_cents: amount },
      ])).toThrow('BILLING_LEDGER_INVALID_AMOUNT');
    }
    expect(() => summarizeBillingLedger([
      { id: 1, status: 'paid', currency: 'usd', total_cents: Number.MAX_SAFE_INTEGER },
      { id: 2, status: 'paid', currency: 'usd', total_cents: 1 },
    ])).toThrow('BILLING_LEDGER_AMOUNT_OVERFLOW');
  });
});

describe('billing API client with 205 invoices', () => {
  const oldFetch = globalThis.fetch;
  const requestedOffsets: number[] = [];

  beforeEach(() => {
    requestedOffsets.length = 0;
    (globalThis as any).fetch = jest.fn(async (url: string) => {
      const parsed = new URL(url);
      expect(parsed.pathname).toBe('/api/billing/invoices/me');
      expect(parsed.searchParams.get('limit')).toBe('100');
      const offset = Number(parsed.searchParams.get('offset'));
      requestedOffsets.push(offset);
      return {
        status: 200,
        ok: true,
        headers: { get: () => null },
        text: async () => JSON.stringify(invoices.slice(offset, offset + 100)),
      };
    });
  });

  afterEach(() => {
    globalThis.fetch = oldFetch;
  });

  it('getBillingSummary fetches all pages, including those beyond the first 100', async () => {
    expect(await getBillingSummary('synthetic-qa-token')).toEqual({
      pending_count: 102, pending_amount_cents: 10200,
      paid_count: 103, paid_amount_cents: 20600, currency: 'usd',
    });
    expect(requestedOffsets).toEqual([0, 100, 200]);
  });

  it('getBillingTickets returns all 205 and filters all pages', async () => {
    expect(await getBillingTickets('synthetic-qa-token')).toHaveLength(205);
    expect(await getBillingTickets('synthetic-qa-token', 'paid')).toHaveLength(103);
    expect(await getBillingTickets('synthetic-qa-token', 'pending')).toHaveLength(102);
    expect(requestedOffsets).toEqual([0, 100, 200, 0, 100, 200, 0, 100, 200]);
  });
});
