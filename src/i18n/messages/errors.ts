import { defineMessages } from '../define';

export default defineMessages({
  en: {
    imageLoadFailed: 'Failed to load images',
    rateLimitExceeded: 'API rate limit exceeded. Please try again later',
    networkError: 'Network error. Please check your internet connection',
    noAnalysisMethod:
      'AI analysis is not set up yet. Connect an AI provider in Settings.',
    apiKeyInvalid: 'API key is invalid',
    unknown: 'Something went wrong. Please try again.',
    databaseOpenFailed:
      'Could not open your saved data. Please reload the extension.',
  },
  ko: {
    imageLoadFailed: '이미지를 불러올 수 없습니다',
    rateLimitExceeded: 'API 요청 한도 초과. 잠시 후 다시 시도해주세요',
    networkError: '네트워크 오류. 인터넷 연결을 확인해주세요',
    noAnalysisMethod:
      'AI 분석이 아직 설정되지 않았습니다. 설정에서 AI 서비스를 연결해주세요.',
    apiKeyInvalid: 'API 키가 유효하지 않습니다',
    unknown: '알 수 없는 오류가 발생했습니다. 다시 시도해주세요.',
    databaseOpenFailed:
      '저장된 데이터를 열 수 없습니다. 확장 프로그램을 다시 불러와주세요.',
  },
  ja: {
    imageLoadFailed: '画像を読み込めません',
    rateLimitExceeded:
      'APIリクエスト制限を超えました。しばらくしてから再試行してください',
    networkError: 'ネットワークエラー。インターネット接続を確認してください',
    noAnalysisMethod:
      'AI分析はまだ設定されていません。設定でAIプロバイダーを接続してください。',
    apiKeyInvalid: 'APIキーが無効です',
    unknown: '予期しないエラーが発生しました。もう一度お試しください。',
    databaseOpenFailed:
      '保存データを開けませんでした。拡張機能を再読み込みしてください。',
  },
  'zh-CN': {
    imageLoadFailed: '无法加载图片',
    rateLimitExceeded: 'API请求超出限制。请稍后重试',
    networkError: '网络错误。请检查网络连接',
    noAnalysisMethod: 'AI 分析尚未设置。请在设置中连接 AI 服务。',
    apiKeyInvalid: 'API密钥无效',
    unknown: '出现未知错误，请重试。',
    databaseOpenFailed: '无法打开已保存的数据。请重新加载扩展程序。',
  },
  'zh-TW': {
    imageLoadFailed: '無法載入圖片',
    rateLimitExceeded: 'API 請求次數已達上限，請稍後再試',
    networkError: '網路錯誤，請檢查網路連線',
    noAnalysisMethod: 'AI 分析尚未設定。請在設定中連結 AI 服務。',
    apiKeyInvalid: 'API 金鑰無效',
    unknown: '發生未知錯誤，請再試一次。',
    databaseOpenFailed: '無法開啟已儲存的資料，請重新載入擴充功能。',
  },
});
