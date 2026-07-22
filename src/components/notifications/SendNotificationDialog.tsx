import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string;
}

interface SendNotificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent?: () => void;
}

export function SendNotificationDialog({ open, onOpenChange, onSent }: SendNotificationDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<Profile[]>([]);
  const [recipientId, setRecipientId] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [alsoEmail, setAlsoEmail] = useState(true);
  const [senderName, setSenderName] = useState('');

  useEffect(() => {
    if (open) {
      fetchUsers();
      setRecipientId('');
      setTitle('');
      setMessage('');
      setAlsoEmail(true);
      if (user) {
        supabase.from('profiles').select('full_name,email').eq('user_id', user.id).maybeSingle()
          .then(({ data }: any) => setSenderName(data?.full_name || data?.email || ''));
      }
    }
  }, [open, user]);

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, user_id, full_name, email')
      .order('full_name');
    setUsers((data || []).filter((p: any) => p.user_id !== user?.id) as Profile[]);
  };

  const handleSend = async () => {
    if (!recipientId || !title.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase.from('notifications').insert({
        user_id: recipientId,
        entity_type: 'user_message',
        entity_id: user?.id || '',
        notification_type: 'user_message',
        title: title.trim(),
        message: message.trim() || null,
      } as any);

      if (error) throw error;

      let emailNote = '';
      if (alsoEmail) {
        const recipient = users.find(u => u.user_id === recipientId);
        if (recipient?.email) {
          const origin = typeof window !== 'undefined' ? window.location.origin : '';
          const { error: emailErr } = await supabase.functions.invoke('send-transactional-email', {
            body: {
              templateName: 'notification',
              recipientEmail: recipient.email,
              idempotencyKey: `notif-${user?.id}-${Date.now()}`,
              templateData: {
                recipientName: recipient.full_name || undefined,
                senderName: senderName || undefined,
                title: title.trim(),
                message: message.trim() || undefined,
                actionUrl: `${origin}/notifications`,
                actionLabel: 'Open in ERP',
              },
            },
          });
          emailNote = emailErr ? ' (in-app only — email failed)' : ' + email';
        } else {
          emailNote = ' (in-app only — no email on file)';
        }
      }

      toast({ title: 'Notification sent', description: `Delivered${emailNote}.` });
      onOpenChange(false);
      onSent?.();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Notification</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Recipient</Label>
            <Select value={recipientId} onValueChange={setRecipientId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                {users.map(u => (
                  <SelectItem key={u.user_id} value={u.user_id}>
                    {u.full_name || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              placeholder="Notification title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label>Message (optional)</Label>
            <Textarea
              placeholder="Add more details..."
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="also-email"
              checked={alsoEmail}
              onCheckedChange={(v) => setAlsoEmail(v === true)}
            />
            <Label htmlFor="also-email" className="text-sm font-normal cursor-pointer">
              Also send an email to the recipient
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSend} disabled={sending || !recipientId || !title.trim()}>
            {sending ? 'Sending...' : 'Send'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
