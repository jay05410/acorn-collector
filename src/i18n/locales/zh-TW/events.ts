import type { LocaleMessages } from '../../define';

export default {
  title: '活動',
  addEvent: '新增活動',
  noEvents: '尚未新增任何活動',
  noEventsDesc: '新增一個活動開始使用吧',
  eventName: '活動名稱',
  eventNamePlaceholder: '活動名稱（例：FF43）',
  eventDate: '活動日期',
  eventLocation: '地點',
  eventLocationPlaceholder: '地點（例：花博爭艷館）',
  deleteConfirm: '確定要刪除這個活動嗎？活動中的所有攤位和商品也會一併刪除。',
  boothCount_one: '{count} 個攤位',
  boothCount_other: '{count} 個攤位',
  selectDate: '選擇日期',
  clearDate: '清除日期',
} satisfies LocaleMessages['events'];
