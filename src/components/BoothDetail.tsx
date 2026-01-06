import { ExternalLink, MessageSquare } from 'lucide-react';
import { useBooth } from '@/hooks/useBooths';
import { ItemChecklist } from '@/components/ItemChecklist';

interface BoothDetailProps {
  boothId: string;
}

export function BoothDetail({ boothId }: BoothDetailProps) {
  const { booth, isLoading } = useBooth(boothId);

  if (isLoading) {
    return <div className="p-4 text-center text-gray-500">로딩 중...</div>;
  }

  if (!booth) {
    return <div className="p-4 text-center text-gray-500">부스를 찾을 수 없습니다</div>;
  }

  return (
    <div className="flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-start justify-between">
          <div>
            <span className="font-mono text-sm font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
              {booth.boothNumber}
            </span>
            <h2 className="mt-2 text-lg font-semibold text-gray-900">
              {booth.circleName}
            </h2>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {booth.sourceUrl && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <ExternalLink className="w-4 h-4 flex-shrink-0" />
              <a
                href={booth.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline truncate"
              >
                원본 링크
              </a>
            </div>
          )}
          {booth.memo && (
            <div className="flex items-start gap-2 text-sm text-gray-600">
              <MessageSquare className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{booth.memo}</span>
            </div>
          )}
        </div>
      </div>

      <ItemChecklist boothId={boothId} />
    </div>
  );
}
