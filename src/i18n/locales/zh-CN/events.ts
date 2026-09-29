import type { LocaleMessages } from '../../define';

export default {
  title: '活动',
  addEvent: '添加新活动',
  noEvents: '没有已注册的活动',
  noEventsDesc: '添加新活动开始使用',
  eventName: '活动名称',
  eventNamePlaceholder: '活动名称（例：漫展100）',
  eventDate: '活动日期',
  eventLocation: '地点',
  eventLocationPlaceholder: '地点（例：会展中心）',
  deleteConfirm: '删除此活动？所有展位和商品也将被删除。',
  boothCount_one: '{count}个展位',
  boothCount_other: '{count}个展位',
  selectDate: '选择日期',
  clearDate: '清除日期',
} satisfies LocaleMessages['events'];
