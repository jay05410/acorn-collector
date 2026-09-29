import type { MessageTable } from '../../define';

export default {
  title: 'Events',
  addEvent: 'Add New Event',
  noEvents: 'No events registered',
  noEventsDesc: 'Add a new event to get started',
  eventName: 'Event Name',
  eventNamePlaceholder: 'Event name (e.g., Comiket 100)',
  eventDate: 'Event Date',
  eventLocation: 'Location',
  eventLocationPlaceholder: 'Location (e.g., Tokyo Big Sight)',
  deleteConfirm:
    'Delete this event? All booths and items will also be deleted.',
  boothCount_one: '{count} booth',
  boothCount_other: '{count} booths',
  selectDate: 'Select date',
  clearDate: 'Clear date',
} satisfies MessageTable;
