import { useState } from 'react';
import {
  ExternalLink,
  FileText,
  MessageSquare,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useBooth, useBooths } from '@/hooks/useBooths';
import { ItemChecklist } from '@/components/ItemChecklist';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useUIStore } from '@/stores/useUIStore';
import { t } from '@/lib/i18n';

interface BoothDetailProps {
  boothId: string;
  onOpenSettings?: () => void;
}

export function BoothDetail({ boothId, onOpenSettings }: BoothDetailProps) {
  const { booth, isLoading } = useBooth(boothId);
  const { updateBooth, deleteBooth } = useBooths(booth?.eventId || '');
  const { setSelectedBoothId } = useUIStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editBoothNumber, setEditBoothNumber] = useState('');
  const [editCircleName, setEditCircleName] = useState('');
  const [editFormUrl, setEditFormUrl] = useState('');
  const [editMemo, setEditMemo] = useState('');

  if (isLoading) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        {t('common', 'loading')}
      </div>
    );
  }

  if (!booth) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        {t('booths', 'noBooths')}
      </div>
    );
  }

  const startEditing = () => {
    setEditBoothNumber(booth.boothNumber);
    setEditCircleName(booth.circleName);
    setEditFormUrl(booth.formUrl || '');
    setEditMemo(booth.memo || '');
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!editBoothNumber.trim() || !editCircleName.trim()) return;
    await updateBooth(boothId, {
      boothNumber: editBoothNumber.trim(),
      circleName: editCircleName.trim(),
      formUrl: editFormUrl.trim() || null,
      memo: editMemo.trim() || null,
    });
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (confirm(t('booths', 'deleteConfirm'))) {
      await deleteBooth(boothId);
      setSelectedBoothId(null);
    }
  };

  return (
    <div className="flex flex-col">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        {isEditing ? (
          <div className="space-y-3">
            <Input
              placeholder={t('booths', 'boothNumber')}
              value={editBoothNumber}
              onChange={(e) => setEditBoothNumber(e.target.value)}
            />
            <Input
              placeholder={t('booths', 'circleName')}
              value={editCircleName}
              onChange={(e) => setEditCircleName(e.target.value)}
            />
            <Input
              placeholder={t('booths', 'formUrl')}
              value={editFormUrl}
              onChange={(e) => setEditFormUrl(e.target.value)}
            />
            <Input
              placeholder={t('booths', 'memo')}
              value={editMemo}
              onChange={(e) => setEditMemo(e.target.value)}
            />
            <div className="flex gap-2">
              <Button onClick={handleSaveEdit} className="flex-1">
                {t('common', 'save')}
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsEditing(false)}
                className="flex-1"
              >
                {t('common', 'cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <div>
                <span className="font-mono text-sm font-medium text-accent dark:text-primary bg-primary-light dark:bg-primary-light px-2 py-0.5 rounded">
                  {booth.boothNumber}
                </span>
                <h2 className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">
                  {booth.circleName}
                </h2>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={startEditing}
                  className="text-gray-600 dark:text-gray-300"
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleDelete}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {booth.formUrl &&
                (() => {
                  const urls = booth.formUrl.split('\n');
                  const hasMultiple = urls.length > 1;
                  return urls.map((url, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 text-sm"
                    >
                      <FileText className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-amber-600 dark:text-amber-400 hover:underline truncate"
                      >
                        {hasMultiple
                          ? `${t('booths', 'openForm')} ${index + 1}`
                          : t('booths', 'openForm')}
                      </a>
                    </div>
                  ));
                })()}
              {booth.sourceUrl && (
                <div className="flex items-center gap-2 text-sm">
                  <ExternalLink className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                  <a
                    href={booth.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-dark dark:text-primary hover:underline truncate"
                  >
                    {t('booths', 'openSource')}
                  </a>
                </div>
              )}
              {booth.memo && (
                <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <MessageSquare className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{booth.memo}</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <ItemChecklist
        boothId={boothId}
        imageUrls={booth.imageUrls}
        onOpenSettings={onOpenSettings}
      />
    </div>
  );
}
