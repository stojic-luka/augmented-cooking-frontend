import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { profileKeys } from '../query-keys';
import { updateProfile, uploadAvatar, type ProfileUpdateInput } from '../services';

export function useUpdateProfile(userId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ProfileUpdateInput) => {
      if (!userId) return Promise.reject(new Error('Sign in first.'));
      return updateProfile(userId, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.all });
      notifications.show({ message: 'Profile updated.', color: 'green' });
    },
    onError: (error) => {
      // The settings page keeps optimistic local state — without this the UI
      // would keep showing a value the server never accepted.
      notifications.show({ title: 'Could not save your profile', message: error.message, color: 'red' });
    },
  });
}

export function useUploadAvatar(userId: string | null) {
  const updateProfile = useUpdateProfile(userId);

  return useMutation({
    mutationFn: async (file: File) => {
      if (!userId) throw new Error('Sign in first.');
      const url = await uploadAvatar(userId, file);
      return url;
    },
    onSuccess: (url) => {
      if (userId) {
        updateProfile.mutate({ avatarUrl: url });
      }
    },
  });
}
