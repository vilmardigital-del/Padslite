import { PadItem, CloudStorageStats } from '../types';

export async function fetchPads(): Promise<PadItem[]> {
  const res = await fetch('/api/pads');
  if (!res.ok) throw new Error('Falha ao carregar pads da nuvem');
  const data = await res.json();
  return data.pads || [];
}

export async function fetchCloudStats(): Promise<CloudStorageStats> {
  const res = await fetch('/api/stats');
  if (!res.ok) throw new Error('Falha ao obter estatísticas da nuvem');
  const data = await res.json();
  return {
    totalPads: data.totalPads || 0,
    totalSizeMb: data.totalSizeMb || 0,
    customPadsCount: data.customPadsCount || 0,
    storageQuotaMb: data.storageQuotaMb || 10240,
  };
}

export async function uploadAudioFiles(files: File[]): Promise<{ addedPads: PadItem[]; totalPads: number }> {
  const formData = new FormData();
  files.forEach(file => {
    formData.append('audioFiles', file);
  });

  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: 'Erro no envio' }));
    throw new Error(errData.error || 'Erro ao enviar áudios para a nuvem');
  }

  const data = await res.json();
  return {
    addedPads: data.addedPads,
    totalPads: data.totalPads,
  };
}

export async function updatePadOnServer(id: string, updates: Partial<PadItem>): Promise<PadItem> {
  const res = await fetch(`/api/pads/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });

  if (!res.ok) throw new Error('Falha ao atualizar pad');
  const data = await res.json();
  return data.pad;
}

export async function deletePadOnServer(id: string): Promise<void> {
  const res = await fetch(`/api/pads/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Falha ao excluir pad');
}

export async function resetPadsOnServer(): Promise<PadItem[]> {
  const res = await fetch('/api/pads/reset', {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Falha ao restaurar pads');
  const data = await res.json();
  return data.pads;
}
