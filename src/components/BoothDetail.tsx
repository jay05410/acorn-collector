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

interface BoothDetailProps {
  boothId: string;
}

export function BoothDetail({ boothId }: BoothDetailProps) {
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
        로딩 중...
      </div>
    );
  }

  if (!booth) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        부스를 찾을 수 없습니다
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
    if (confirm('이 부스를 삭제하시겠습니까?')) {
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
              placeholder="부스 번호"
              value={editBoothNumber}
              onChange={(e) => setEditBoothNumber(e.target.value)}
            />
            <Input
              placeholder="서클/작가명"
              value={editCircleName}
              onChange={(e) => setEditCircleName(e.target.value)}
            />
            <Input
              placeholder="판매폼/인포 링크"
              value={editFormUrl}
              onChange={(e) => setEditFormUrl(e.target.value)}
            />
            <Input
              placeholder="메모"
              value={editMemo}
              onChange={(e) => setEditMemo(e.target.value)}
            />
            <div className="flex gap-2">
              <Button onClick={handleSaveEdit} className="flex-1">
                저장
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsEditing(false)}
                className="flex-1"
              >
                취소
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
                        {hasMultiple ? `판매폼 ${index + 1}` : '판매폼 열기'}
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
                    원본 트윗 열기
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

      <ItemChecklist boothId={boothId} imageUrls={booth.imageUrls} />
    </div>
  );
}
