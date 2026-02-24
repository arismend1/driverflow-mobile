export interface NotificationEvent {
    id: number;
    key: string;
    created_at: string;
    data: any;
}

class NotificationsService {
    private listeners: ((events: NotificationEvent[]) => void)[] = [];

    addListener(callback: (events: NotificationEvent[]) => void) {
        this.listeners.push(callback);
        // Devuelve una función para desuscribirse (unsubscribe)
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    emit(event: NotificationEvent) {
        // Emula la llegada de un evento push
        this.listeners.forEach(cb => cb([event]));
    }
}

export const notifications = new NotificationsService();
