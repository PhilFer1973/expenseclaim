/**
 * Backend API client + React Query hooks.
 * All routes hit ${EXPO_PUBLIC_BACKEND_URL}/api/*.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL ?? "";
const API = `${BASE}/api`;

// ---------- types ----------
export type ClaimStatus = "draft" | "submitted";
export type ReceiptStatus = "receipt" | "no_receipt";
export type VatCode = "UK20" | "UK0" | "UNREC" | "REVIEW";

export type Employee = {
  employee_id: string;
  name: string;
  email: string;
  is_demo: boolean;
};

export type Category = {
  name: string;
  is_unrecoverable: boolean;
  sort_order: number;
};

export type ClaimLine = {
  claim_line_id: string;
  claim_id: string;
  receipt_status: ReceiptStatus;
  image_quality_status: "ok" | "blurry" | "unreadable" | null;
  supplier_name: string | null;
  supplier_vat_number: string | null;
  receipt_number: string | null;
  receipt_date: string | null;
  category: string | null;
  net_amount: number | null;
  vat_amount: number | null;
  gross_amount: number | null;
  vat_code: VatCode;
  narrative_final: string | null;
  voice_transcript_raw: string | null;
  ai_category_suggestions: unknown;
  ai_category_explanation: string | null;
  duplicate_flag: boolean;
  old_receipt_flag: boolean;
};

export type ClaimSummary = {
  claim_id: string;
  claim_ref: string | null;
  claim_title: string;
  status: ClaimStatus;
  running_gross_total: number;
  created_at: string;
  submitted_at: string | null;
  line_count: number;
};

export type ClaimDetail = ClaimSummary & { lines: ClaimLine[] };

// ---------- low-level fetch ----------
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    let detail: unknown;
    try {
      detail = await res.json();
    } catch {
      detail = await res.text();
    }
    const message =
      typeof detail === "object" && detail && "detail" in detail
        ? JSON.stringify((detail as { detail: unknown }).detail)
        : String(detail);
    throw new Error(`${res.status} ${message}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---------- query keys ----------
export const qk = {
  me: ["me"] as const,
  categories: ["categories"] as const,
  claims: (status?: ClaimStatus) => ["claims", status ?? "all"] as const,
  claim: (id: string) => ["claim", id] as const,
};

// ---------- hooks ----------
export function useMe() {
  return useQuery({ queryKey: qk.me, queryFn: () => request<Employee>("/me") });
}

export function useCategories() {
  return useQuery({
    queryKey: qk.categories,
    queryFn: () => request<Category[]>("/categories"),
    staleTime: 1000 * 60 * 60,
  });
}

export function useClaims(status?: ClaimStatus) {
  return useQuery({
    queryKey: qk.claims(status),
    queryFn: () =>
      request<ClaimSummary[]>(status ? `/claims?status=${status}` : "/claims"),
  });
}

export function useClaim(id: string | undefined) {
  return useQuery({
    queryKey: qk.claim(id ?? "_"),
    queryFn: () => request<ClaimDetail>(`/claims/${id}`),
    enabled: !!id,
  });
}

export function useCreateClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (title: string) =>
      request<ClaimSummary>("/claims", {
        method: "POST",
        body: JSON.stringify({ title }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["claims"] }),
  });
}

export function useDeleteClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request<void>(`/claims/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["claims"] }),
  });
}

export function useSubmitClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      request<ClaimSummary>(`/claims/${id}/submit`, { method: "POST" }),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["claims"] });
      qc.invalidateQueries({ queryKey: qk.claim(id) });
    },
  });
}

export type LineWrite = {
  receipt_status?: ReceiptStatus;
  supplier_name?: string | null;
  supplier_vat_number?: string | null;
  receipt_number?: string | null;
  receipt_date?: string | null;
  category?: string | null;
  net_amount?: number | null;
  vat_amount?: number | null;
  gross_amount?: number | null;
  narrative_final?: string | null;
  voice_transcript_raw?: string | null;
};

export function useAddLine(claimId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: LineWrite) =>
      request<ClaimLine>(`/claims/${claimId}/lines`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.claim(claimId) });
      qc.invalidateQueries({ queryKey: ["claims"] });
    },
  });
}

export function useUpdateLine(claimId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lineId, body }: { lineId: string; body: LineWrite }) =>
      request<ClaimLine>(`/lines/${lineId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.claim(claimId) });
      qc.invalidateQueries({ queryKey: ["claims"] });
    },
  });
}

export function useDeleteLine(claimId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lineId: string) =>
      request<void>(`/lines/${lineId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.claim(claimId) });
      qc.invalidateQueries({ queryKey: ["claims"] });
    },
  });
}
