export const formatDate = (date: Date): string => {
  if (!date) {
    return '';
  }
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};