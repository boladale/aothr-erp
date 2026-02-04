import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import type { Notification } from '@/lib/supabase';

export default function Notifications() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchNotifications();
  }, [user]);

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications((data || []) as Notification[]);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user?.id)
        .eq('is_read', false);

      setNotifications(prev => 
        prev.map(n => ({ ...n, is_read: true }))
      );
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleClick = (notification: Notification) => {
    markAsRead(notification.id);
    
    if (notification.entity_type === 'purchase_order') {
      navigate(`/purchase-orders/${notification.entity_id}`);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (loading) {
    return (
      <AppLayout>
        <div className="page-container">
          <Skeleton className="h-8 w-64 mb-4" />
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="page-container">
        <PageHeader
          title="Notifications"
          description={unreadCount > 0 ? `${unreadCount} unread notifications` : 'All caught up!'}
          actions={
            unreadCount > 0 && (
              <Button variant="outline" onClick={markAllAsRead}>
                <CheckCheck className="mr-2 h-4 w-4" /> Mark All Read
              </Button>
            )
          }
        />

        {notifications.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Bell className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No notifications yet</p>
              <p className="text-sm text-muted-foreground">
                You'll see notifications here when POs are ready to close.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {notifications.map(notification => (
              <Card 
                key={notification.id}
                className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                  !notification.is_read ? 'border-primary/50 bg-primary/5' : ''
                }`}
                onClick={() => handleClick(notification)}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <div className={`rounded-lg p-2 ${
                    notification.notification_type === 'po_ready_to_close' 
                      ? 'bg-success/10' 
                      : 'bg-primary/10'
                  }`}>
                    <FileText className={`h-5 w-5 ${
                      notification.notification_type === 'po_ready_to_close' 
                        ? 'text-success' 
                        : 'text-primary'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{notification.title}</p>
                    {notification.message && (
                      <p className="text-sm text-muted-foreground">{notification.message}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(notification.created_at).toLocaleString()}
                    </p>
                  </div>
                  {!notification.is_read && (
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); markAsRead(notification.id); }}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
