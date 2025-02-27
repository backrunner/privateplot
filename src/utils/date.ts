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

// Helper function to check if date is valid (not 1970-01-01)
export const isValidDate = (date: Date | undefined): boolean => {
  if (!date) return false;
  return date.getTime() > 86400000; // More than 1 day after 1970-01-01
};

// Helper function to check if dates are different
export const areDifferentDates = (date1: Date, date2?: Date): boolean => {
  if (!date1 || !date2) return false;
  return date1.getTime() !== date2.getTime();
};