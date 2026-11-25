"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Pencil, Plus, Minus, Trash2, X } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { useRouter } from "next/navigation";

export interface AttributeValueItem {
  id: string;
  value: string;
}

export interface AttributeItem {
  id: string;
  name: string;
  values: AttributeValueItem[];
}

interface ModalValueRow {
  id: string;
  name: string;
}

function emptyRow(): ModalValueRow {
  return {
    id: `tmp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: "",
  };
}

const isNewRow = (id: string) => id.startsWith("tmp-");

interface VariationsPageProps {
  initialData?: AttributeItem[];
  onChanged?: () => void;
}

export default function VariationsPage({
  initialData = [],
  onChanged,
}: VariationsPageProps) {
  const router = useRouter();
  const [attributes, setAttributes] = useState<AttributeItem[]>(initialData);
  const [isSaving, setIsSaving] = useState(false);

  /* Modal state */
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AttributeItem | null>(null);
  const [modalName, setModalName] = useState("");
  const [modalValues, setModalValues] = useState<ModalValueRow[]>([emptyRow()]);

  /* Delete target */
  const [deleteTarget, setDeleteTarget] = useState<AttributeItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const refresh = async () => {
    try {
      const response = await apiFetch("/attributes", { cache: "no-store" });
      const data = await response.json();
      if (response.ok && Array.isArray(data)) {
        setAttributes(data);
      } else {
        toast.error(data.error || "Failed to fetch variations");
      }
    } catch (error) {
      console.error("Error fetching variations:", error);
      toast.error("Network error while loading variations");
    }
  };

  useEffect(() => {
    if (!initialData || initialData.length === 0) {
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAdd = () => {
    setEditTarget(null);
    setModalName("");
    setModalValues([emptyRow()]);
    setModalOpen(true);
  };

  const openEdit = (attribute: AttributeItem) => {
    setEditTarget(attribute);
    setModalName(attribute.name);
    setModalValues(
      attribute.values.length > 0
        ? attribute.values.map((val) => ({ id: val.id, name: val.value }))
        : [emptyRow()]
    );
    setModalOpen(true);
  };

  const addRow = () => setModalValues((prev) => [...prev, emptyRow()]);
  const removeRow = (id: string) =>
    setModalValues((prev) => prev.filter((row) => row.id !== id));
  const updateRow = (id: string, name: string) =>
    setModalValues((prev) =>
      prev.map((row) => (row.id === id ? { ...row, name } : row))
    );

  const handleSave = async () => {
    if (!modalName.trim()) {
      toast.error("Variation name is required");
      return;
    }

    const cleanValues = modalValues
      .filter((row) => row.name.trim())
      .map((row) => ({ id: row.id, name: row.name.trim() }));

    if (cleanValues.length === 0) {
      toast.error("Add at least one value");
      return;
    }

    setIsSaving(true);
    try {
      if (editTarget) {
        /* Rename attribute if needed */
        if (modalName.trim() !== editTarget.name) {
          const res = await apiFetch(`/attributes/${editTarget.id}`, {
            method: "PATCH",
            body: JSON.stringify({ name: modalName.trim() }),
          });
          if (!res.ok) {
            const result = await res.json().catch(() => ({}));
            throw new Error(result.error || "Failed to update variation");
          }
        }

        const keptIds = new Set(
          cleanValues.filter((v) => !isNewRow(v.id)).map((v) => v.id)
        );

        /* Delete removed values */
        for (const oldValue of editTarget.values) {
          if (keptIds.has(oldValue.id)) continue;
          const res = await apiFetch(`/attributes/values/${oldValue.id}`, {
            method: "DELETE",
          });
          if (!res.ok) {
            const result = await res.json().catch(() => ({}));
            throw new Error(result.error || `Failed to delete "${oldValue.value}"`);
          }
        }

        /* Update renamed values */
        for (const value of cleanValues) {
          if (isNewRow(value.id)) continue;
          const oldValue = editTarget.values.find((v) => v.id === value.id);
          if (!oldValue || oldValue.value === value.name) continue;
          const res = await apiFetch(`/attributes/values/${value.id}`, {
            method: "PATCH",
            body: JSON.stringify({ value: value.name }),
          });
          if (!res.ok) {
            const result = await res.json().catch(() => ({}));
            throw new Error(result.error || `Failed to update "${value.name}"`);
          }
        }

        /* Add new values */
        for (const value of cleanValues) {
          if (!isNewRow(value.id)) continue;
          const res = await apiFetch(`/attributes/${editTarget.id}/values`, {
            method: "POST",
            body: JSON.stringify({ value: value.name }),
          });
          if (!res.ok) {
            const result = await res.json().catch(() => ({}));
            throw new Error(result.error || `Failed to add "${value.name}"`);
          }
        }

        toast.success("Variation updated");
      } else {
        const res = await apiFetch("/attributes", {
          method: "POST",
          body: JSON.stringify({ name: modalName.trim() }),
        });
        const created = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(created.error || "Failed to create variation");
        }

        const attributeId = created?.id ?? created?.attribute?.id;
        if (!attributeId) {
          throw new Error("Variation was created but its id was missing");
        }

        for (const value of cleanValues) {
          const valueRes = await apiFetch(`/attributes/${attributeId}/values`, {
            method: "POST",
            body: JSON.stringify({ value: value.name }),
          });
          if (!valueRes.ok) {
            const result = await valueRes.json().catch(() => ({}));
            throw new Error(result.error || `Failed to add "${value.name}"`);
          }
        }

        toast.success("Variation added");
      }

      setModalOpen(false);
      await refresh();
      onChanged?.();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Something went wrong"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await apiFetch(`/attributes/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(result.error || "Failed to delete variation");
      }

      toast.success("Variation deleted");
      setDeleteTarget(null);
      await refresh();
      onChanged?.();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete variation"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col space-y-5">
      {/* Main Card */}
      <div className="rounded-2xl border border-gray-200/80 dark:border-white/10 bg-white dark:bg-[#141414] shadow-xs overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-gray-200/70 dark:border-white/10 bg-gray-50/40 dark:bg-white/[0.01]">
          <h1 className="text-base font-bold text-gray-900 dark:text-white tracking-tight">
            Variations
          </h1>
          <Button
            onClick={openAdd}
            className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="size-4" />
            Add
          </Button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-200/70 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.01] text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <th className="px-5 py-3.5 w-1/3">Variations</th>
                <th className="px-4 py-3.5">Values</th>
                <th className="px-4 py-3.5 text-right w-40">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {attributes.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="py-14 text-center text-sm text-gray-400 dark:text-gray-500"
                  >
                    No variations yet. Click{" "}
                    <span className="font-semibold text-indigo-600">+ Add</span>{" "}
                    to create one.
                  </td>
                </tr>
              ) : (
                attributes.map((attribute) => (
                  <tr
                    key={attribute.id}
                    className="hover:bg-gray-50/60 dark:hover:bg-white/[0.015] transition-colors"
                  >
                    <td className="px-5 py-3.5 font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                      {attribute.name}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {attribute.values.map((val, idx) => (
                          <span key={val.id}>
                            {idx > 0 && <span className="text-gray-400">, </span>}
                            <span
                              className={
                                idx === attribute.values.length - 1
                                  ? "text-indigo-600 dark:text-indigo-400 font-medium"
                                  : ""
                              }
                            >
                              {val.value}
                            </span>
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="inline-flex items-center gap-2 justify-end">
                        <button
                          onClick={() => openEdit(attribute)}
                          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 text-xs font-semibold bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors cursor-pointer"
                        >
                          <Pencil className="size-3.5" />
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteTarget(attribute)}
                          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 text-xs font-semibold bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors cursor-pointer"
                        >
                          <Trash2 className="size-3.5" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD / EDIT MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            onClick={() => (isSaving ? undefined : setModalOpen(false))}
          />
          <div className="relative z-10 w-full max-w-md bg-white dark:bg-[#1c1c1c] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/10">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                {editTarget ? "Edit Variation" : "Add Variation"}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                disabled={isSaving}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer disabled:cursor-not-allowed"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Variation Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Variation Name: <span className="text-red-500">*</span>
                </label>
                <Input
                  value={modalName}
                  onChange={(e) => setModalName(e.target.value)}
                  placeholder="e.g. Size, Color, Storage"
                  className="h-10 rounded-xl border-gray-200 dark:border-white/10 text-sm"
                />
              </div>

              {/* Variation Values */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Add variation values: <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {modalValues.map((row, idx) => (
                    <div key={row.id} className="flex items-center gap-2">
                      <Input
                        value={row.name}
                        onChange={(e) => updateRow(row.id, e.target.value)}
                        placeholder="Value (e.g. S, M, L or Black, Blue)"
                        className="flex-1 h-9 rounded-xl border-gray-200 dark:border-white/10 text-sm"
                      />
                      {idx === modalValues.length - 1 && (
                        <button
                          type="button"
                          onClick={addRow}
                          className="size-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                          title="Add Value"
                        >
                          <Plus className="size-4" />
                        </button>
                      )}
                      {modalValues.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRow(row.id)}
                          className="size-9 rounded-xl bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                          title="Remove Value"
                        >
                          <Minus className="size-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.01]">
              <Button
                variant="outline"
                onClick={() => setModalOpen(false)}
                disabled={isSaving}
                className="h-10 px-5 rounded-xl text-xs font-semibold border-gray-300 dark:border-white/20"
              >
                Close
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="h-10 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
              >
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => (isDeleting ? undefined : setDeleteTarget(null))}
          />
          <div className="relative z-10 w-full max-w-sm bg-white dark:bg-[#1c1c1c] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 p-6 space-y-4">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Delete Variation
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-gray-900 dark:text-white">
                &quot;{deleteTarget.name}&quot;
              </span>
              ? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-10 rounded-xl text-xs"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1 h-10 rounded-xl text-xs"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
