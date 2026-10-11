import { apiRequest } from './apiClient';

export const getNotifications = async () => {
  const result = await apiRequest('/api/notifications');
  return result.data || [];
};

export const markNotificationRead = async (notificationId) => apiRequest(
  `/api/notifications/${encodeURIComponent(notificationId)}/read`,
  { method: 'PATCH' },
);
