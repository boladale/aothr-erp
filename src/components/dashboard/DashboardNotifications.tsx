import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ArrowRight, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SendNotificationDialog } from '@/components/notifications/SendNotificationDialog';

interface NotificationItem {
  id: string;
  title: string;
  message: string | null;
  is_read: boolean;
  notification_type: string;
  created_at: string;
}

export function DashboardNotifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [sendOpen, setSendOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('id, title, message, is_read, notification_type, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);
    setNotifications((data || []) as NotificationItem[]);
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Notifications</CardTitle>
            {unreadCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setSendOpen(true)}>
              <Send className="mr-1 h-4 w-4" /> Send
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/notifications')}>
              View All <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map(n => (
                <div
                  key={n.id}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors',
                    !n.is_read && 'border-primary/30 bg-primary/5'
                  )}
                  onClick={() => navigate('/notifications')}
                >
                  <div className={cn('mt-1.5 h-2 w-2 rounded-full flex-shrink-0', !n.is_read ? 'bg-primary' : 'bg-transparent')} />
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm truncate', !n.is_read && 'font-medium')}>{n.title}</p>
                    {n.message && <p className="text-xs text-muted-foreground truncate">{n.message}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">{timeAgo(n.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <SendNotificationDialog open={sendOpen} onOpenChange={setSendOpen} onSent={fetchNotifications} />
    </>
  );
}
