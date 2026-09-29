import type { LocaleMessages } from '../../define';

export default {
  title: 'イベント',
  addEvent: '新規イベント追加',
  noEvents: '登録されたイベントがありません',
  noEventsDesc: '新しいイベントを追加してください',
  eventName: 'イベント名',
  eventNamePlaceholder: 'イベント名（例：コミケ100）',
  eventDate: 'イベント日',
  eventLocation: '場所',
  eventLocationPlaceholder: '場所（例：東京ビッグサイト）',
  deleteConfirm:
    'このイベントを削除しますか？すべてのブースと商品も削除されます。',
  boothCount_one: '{count}ブース',
  boothCount_other: '{count}ブース',
  selectDate: '日付を選択',
  clearDate: '日付をクリア',
} satisfies LocaleMessages['events'];
