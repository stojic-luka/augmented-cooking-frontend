import { useMutation } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { orderIngredients, type OrderItemInput } from '../services/orderIntegration';

export function useOrderIngredients() {
  return useMutation({
    mutationFn: ({ userId, items }: { userId: string; items: OrderItemInput[] }) => orderIngredients(userId, items),
    onSuccess: (result) => {
      notifications.show({
        title: 'Order placed',
        message: `Order ${result.orderId} is ${result.status}.`,
        color: 'green',
      });
    },
    onError: (error) => {
      notifications.show({
        title: 'Order failed',
        message: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
        color: 'red',
      });
    },
  });
}
