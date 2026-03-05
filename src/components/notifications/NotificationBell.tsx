import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Send, Check, CheckCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { SendNotificationDialog } from './SendNotificationDialog';

interface NotificationItem {
  id: string;
  title: string;
  message: string | null;
  is_read: boolean;
  entity_type: string;
  entity_id: string;
  notification_type: string;
  created_at: string;
  sender_id: string | null;
}

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setNotifications((data || []) as unknown as NotificationItem[]);
  }, [user]);

  useEffect(() => {
    fetchNotifications();

    if (!user) return;
    const channel = supabase
      .channel('user-notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchNotifications]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllAsRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleClick = (n: NotificationItem) => {
    markAsRead(n.id);
    setOpen(false);
    if (n.entity_type === 'purchase_orders' || n.entity_type === 'purchase_order') {
      navigate(`/purchase-orders/${n.entity_id}`);
    } else if (n.entity_type === 'requisitions') {
      navigate(`/requisitions/${n.entity_id}`);
    } else if (n.entity_type === 'user_message') {
      navigate('/notifications');
    } else {
      navigate('/notifications');
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={() => setSendOpen(true)}
          title="Send notification"
        >
          <Send className="h-4 w-4" />
        </Button>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end" side="right">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h4 className="text-sm font-semibold">Notifications</h4>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllAsRead}>
                    <CheckCheck className="mr-1 h-3 w-3" /> Read all
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setOpen(false); navigate('/notifications'); }}>
                  View all
                </Button>
              </div>
            </div>
            <ScrollArea className="max-h-80">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-muted-foreground">
                  <Bell className="h-8 w-8 mb-2 opacity-40" />
                  <p className="text-sm">No notifications</p>
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map(n => (
                    <div
                      key={n.id}
                      className={cn(
                        'flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors',
                        !n.is_read && 'bg-primary/5'
                      )}
                      onClick={() => handleClick(n)}
                    >
                      <div className={cn('mt-1 h-2 w-2 rounded-full flex-shrink-0', !n.is_read ? 'bg-primary' : 'bg-transparent')} />
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm truncate', !n.is_read && 'font-medium')}>{n.title}</p>
                        {n.message && <p className="text-xs text-muted-foreground truncate">{n.message}</p>}
                        <p className="text-xs text-muted-foreground mt-1">{timeAgo(n.created_at)}</p>
                      </div>
                      {!n.is_read && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}>
                          <Check className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </div>
      <SendNotificationDialog open={sendOpen} onOpenChange={setSendOpen} onSent={fetchNotifications} />
    </>
  );
}
