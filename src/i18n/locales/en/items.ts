import type { MessageTable } from '../../define';

export default {
  title: 'Product List',
  addItem: 'Add Product',
  noItems: 'No products registered',
  noItemsDesc: 'Add products you want to purchase',
  itemName: 'Product Name',
  itemNamePlaceholder: 'Product name (Enter to add)',
  price: 'Price',
  pricePlaceholder: 'Price (optional)',
  quantity: 'Quantity',
  badge: 'Select Badge',
  newBadge: 'New badge name',
  extractFromImage: 'Extract from Image',
  imageHint:
    'Images available! Use "Extract from Image" for auto-registration.',
  totalItems_one: '{count} item total',
  totalItems_other: '{count} items total',
  customQuantity: 'Enter a quantity',
  addCustomBadge: 'Add custom badge',
  itemDeleted: 'Deleted "{name}"',
} satisfies MessageTable;
